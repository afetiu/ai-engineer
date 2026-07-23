COURSE.register({
  id: 'm15-inference-internals',
  track: 'advanced',
  order: 15,
  title: 'Inference internals',
  short: 'Inference internals',
  tagline: 'Prefill vs decode, KV cache arithmetic, continuous batching, quantization, and speculative decoding — the physics behind every latency number and price sheet you\'ll ever see.',
  minutes: 120,
  lessons: [
    {
      id: 'prefill-decode',
      title: 'Prefill vs decode: two different physics problems',
      blurb: 'Why generating a token is bandwidth-bound, why reading your prompt is compute-bound, and the one formula that predicts tokens/sec.',
      html: '<h2>One request, two regimes</h2>' +
        '<p>Serving an LLM request has two phases with completely different bottlenecks, and almost every inference number you\'ll ever debug traces back to this split. <b>Prefill</b> processes the whole prompt at once: every prompt token\'s Q/K/V and MLP activations are computed in parallel in big dense matrix multiplies. GPUs are matmul furnaces — prefill saturates the compute units and is <b>compute-bound</b>. <b>Decode</b> then generates one token per step: each step multiplies a <em>single</em> token\'s activations against every weight matrix in the model. The arithmetic is trivial; the problem is that all the weights must stream from GPU memory (HBM) to the compute units to do it. Decode is <b>memory-bandwidth-bound</b>: the GPU\'s multiply units sit mostly idle, waiting on the memory bus.</p>' +
        '<p>The concept that formalizes this is <b>arithmetic intensity</b>: FLOPs performed per byte fetched from memory. An H100 does ~989 TFLOPs (BF16, dense) against ~3.35 TB/s of HBM bandwidth — meaning it needs roughly <b>~300 FLOPs per byte</b> loaded to stay busy. Prefill on a long prompt clears that bar easily (one weight load is reused across thousands of tokens). Batch-1 decode performs ~2 FLOPs per parameter per token while loading each parameter\'s bytes fresh every step — an arithmetic intensity of ~1. The compute units are starved two orders of magnitude below capacity.</p>' +
        '<h2>The napkin formula that predicts tokens/sec</h2>' +
        '<p>Because batch-1 decode must stream the entire model per token, the speed ceiling is just:</p>' +
        '<pre><code>tokens/sec  ≈  memory_bandwidth / bytes_per_token\nbytes_per_token ≈ model_bytes (weights) + KV_read_per_token</code></pre>' +
        '<ul>' +
        '<li><b>8B model, FP16 (16 GB) on an H100 (3.35 TB/s):</b> 3350/16 ≈ <b>~210 tok/s</b> theoretical single-stream ceiling. Real systems hit 50–70% of it.</li>' +
        '<li><b>Same model, 4-bit (~4.5 GB):</b> 3350/4.5 ≈ ~740 tok/s ceiling — <em>quantization is a decode speedup, not just a memory saving</em>, because fewer bytes stream per token.</li>' +
        '<li><b>70B FP16 (140 GB) across 2× H100:</b> ~6.7 TB/s aggregate / 140 ≈ ~48 tok/s ceiling; ~25–35 realistic. On a consumer RTX 4090 (1.0 TB/s), an 8B FP16 tops out near 60 tok/s — bandwidth, not "GPU speed," is the spec that matters.</li>' +
        '</ul>' +
        '<p>This formula explains half of inference engineering in one line: quantization, batching (amortize the same weight-stream across many requests), GQA, and speculative decoding are all attacks on <code>bytes_per_token</code> or on how many useful tokens each weight-stream buys.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Prefill is compute-bound; decode is bandwidth-bound. TTFT (time to first token) is mostly a prefill/queueing story; TPS (tokens/sec after the first) is mostly a bandwidth story. They are separate SLOs with separate levers — conflating them is the most common inference-perf mistake.</div>' +
        '<h2>Consequences you can bill for</h2>' +
        '<ul>' +
        '<li><b>Input vs output pricing.</b> Providers price input tokens 3–5× cheaper than output (as of early 2026) because prefill tokens are processed at high hardware efficiency in parallel while each output token monopolizes a bandwidth-bound decode step. Cached input is cheaper still — the KV cache already exists, so "processing" is a lookup (module 3).</li>' +
        '<li><b>TTFT scales with prompt length</b> — prefill is O(prompt) compute (with an O(n²) attention term that bites past ~32k) — so a 100k-token prompt can take several seconds before the first byte streams. Long-context RAG designs pay this on every request unless prefix caching absorbs the static part.</li>' +
        '<li><b>Chunked prefill:</b> modern servers split a large prefill into chunks interleaved with other requests\' decode steps, so one whale prompt doesn\'t freeze every active stream\'s token flow. If your users report "the bot stutters when someone uploads a big doc," this — or its absence — is the knob.</li>' +
        '<li><b>Batching fixes decode utilization, not latency:</b> 32 concurrent requests share each weight-stream, multiplying aggregate throughput ~32× while each stream still sees roughly single-stream speed (until bandwidth saturates). This asymmetry is the entire economic basis of lesson 3.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why can\'t decode be parallelized like prefill? Autoregression: token n+1\'s computation needs token n\'s output as input — a strict serial dependency. Prefill has no such dependency (all prompt tokens are known), so it parallelizes across the sequence. Every decode acceleration trick either amortizes weight-streaming across a batch (continuous batching) or speculates past the serial chain and verifies in parallel (speculative decoding, lesson 5).</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Why is generating 1,000 tokens so much slower than reading a 1,000-token prompt?" is the standard inference screen. Full-credit answer: parallel-vs-serial, compute-vs-bandwidth-bound, arithmetic intensity, and the tokens/sec ≈ bandwidth ÷ model-bytes napkin with one worked number. Deriving the ~210 tok/s H100/8B figure live is a flex that lands.</div>'
    },
    {
      id: 'kv-cache',
      title: 'KV cache math: the memory that eats your GPU',
      blurb: 'The formula, worked 8B and 70B examples, and GQA/MQA/MLA as compression schemes.',
      html: '<h2>What the cache holds and the formula</h2>' +
        '<p>Causal attention means each new token attends to every previous token\'s keys and values. Recomputing them every step would make step n cost O(n) redundant work — so we cache K and V for every token, every layer. The cost of that convenience:</p>' +
        '<pre><code>KV bytes per token = 2 × n_layers × n_kv_heads × head_dim × dtype_bytes\n                     (2 = one K + one V vector per layer per kv-head)</code></pre>' +
        '<p>Worked examples you should be able to reproduce on a whiteboard (FP16, i.e. 2 bytes):</p>' +
        '<table><tr><th>Model</th><th>layers</th><th>kv_heads × head_dim</th><th>KV per token</th><th>32k ctx</th><th>128k ctx</th></tr>' +
        '<tr><td>Llama-3.1-8B (GQA)</td><td>32</td><td>8 × 128</td><td>2·32·8·128·2 = <b>128 KB</b></td><td>4 GB</td><td>16 GB</td></tr>' +
        '<tr><td>Same 8B if it were full MHA</td><td>32</td><td>32 × 128</td><td>512 KB</td><td>16 GB</td><td>64 GB</td></tr>' +
        '<tr><td>Llama-3.1-70B (GQA)</td><td>80</td><td>8 × 128</td><td>2·80·8·128·2 = <b>320 KB</b></td><td>10 GB</td><td>40 GB</td></tr></table>' +
        '<p>Now stack it against the weights: an 8B FP16 model is 16 GB — <b>a single 128k-context request carries a cache as large as the model itself.</b> On an 80 GB H100 serving that 8B, weights take 16 GB and the remaining ~60 GB of cache space fits only ~4 full-length 128k streams — or ~120 streams at 4k. KV capacity, not compute, is what decides your max batch size, and therefore your throughput, and therefore your cost per token. This is why long context is priced like a luxury good.</p>' +
        '<h2>GQA, MQA, MLA: three compression schemes</h2>' +
        '<ul>' +
        '<li><b>MQA (multi-query):</b> all query heads share <em>one</em> K/V head. Maximum compression (32× vs 32-head MHA), visible quality cost; used by some earlier models (Falcon).</li>' +
        '<li><b>GQA (grouped-query):</b> the industry default as of early 2026 — query heads share K/V in groups. Llama\'s 32 query heads share 8 KV heads: 4× cache reduction for near-zero quality loss. That one design choice is the difference between the 128 KB and 512 KB rows above.</li>' +
        '<li><b>MLA (multi-head latent attention, DeepSeek-V2/V3):</b> instead of storing full K/V, store a low-rank <em>latent</em> compression per token (~576 dims in DeepSeek-V3 vs 128 heads\' worth of K/V) and up-project at attention time — an order-of-magnitude cache shrink that trades a little extra compute (cheap during bandwidth-bound decode!) for scarce memory. The signature example of exploiting the compute/bandwidth asymmetry.</li>' +
        '</ul>' +
        '<h2>Orthogonal levers that stack</h2>' +
        '<p>The attention-architecture choices above are baked in at training time; three more levers stack on top at serving time, and a production deployment typically runs all of them at once. <b>Sliding-window layers</b> (Mistral and Gemma interleave layers that only attend to the last 4–8k tokens) mean cache for those layers stops growing past the window — a training-time choice, but one you inherit for free. <b>KV cache quantization</b> to FP8 or INT4 halves or quarters every number in the table above (lesson 4 covers the quality trade). And <b>prefix caching</b> reuses the KV blocks of a shared prompt prefix — system prompt, few-shot examples, a document being interrogated across turns — instead of re-prefilling it per request; this is what providers\' "cached input" pricing literally bills for, and locally it is the difference between re-paying a 6k-token preamble on every call and paying it once.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why cache K and V but never Q? Attention at step n uses only the <em>current</em> token\'s query against <em>all</em> past keys/values. Past queries are dead — they were consumed producing past outputs. So Q is computed fresh each step and discarded; K and V are write-once, read-every-step. That read is also why KV size hits <em>speed</em>, not just capacity: at long context the per-step KV read rivals the weight read in the bytes_per_token formula — a 128k-context 8B stream moves ~16 GB of cache per token generated, halving your tokens/sec even with VRAM to spare.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team sized their self-hosted 8B deployment on weights alone: "16 GB model, 24 GB card, plenty of room." At launch, concurrency stalled at a handful of streams and p95 TTFT exploded — the scheduler was queueing requests waiting for KV space, and the occasional 60k-token power-user prompt evicted everyone else. Capacity-plan with the formula: <code>concurrent_streams ≈ (VRAM − weights − overhead) / (KV_per_token × mean_context)</code>, using p95 context, not mean, if you value your pager.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How much memory does a 128k-token conversation take on Llama-3.1-8B?" is now a standard whiteboard item: state the formula, plug 2·32·8·128·2 = 128 KB/token, multiply to 16 GB, then earn the senior nod by naming GQA as the reason it isn\'t 64 GB — and MLA as where the frontier pushed next.</div>'
    },
    {
      id: 'continuous-batching',
      title: 'Continuous batching and PagedAttention: the serving revolution',
      blurb: 'How vLLM-era scheduling took GPU serving from single-digit utilization to 10–20× throughput.',
      html: '<h2>Static batching and why it wasted the GPU</h2>' +
        '<p>Recall the physics: batch-1 decode uses ~1% of the GPU\'s compute because every step streams all weights for one token\'s worth of math. Batching N requests shares that weight-stream across N tokens per step — decode throughput scales almost linearly with batch size until you approach the compute roof. Batching isn\'t an optimization for LLM serving; it <em>is</em> the economics.</p>' +
        '<p>The naive implementation — <b>static batching</b> — collects N requests, launches them together, and returns when all finish. Two structural failures: <b>(1) tail hostage-taking</b> — generation lengths vary wildly (one request wants 10 tokens, another 2,000), and finished sequences sit as dead weight doing no-op steps until the longest finishes; <b>(2) batch boundaries</b> — arriving requests wait for the next batch to form even while the GPU idles. Real-world utilization was routinely single-digit percent.</p>' +
        '<h2>Continuous batching: schedule per step, not per batch</h2>' +
        '<p><b>Continuous (in-flight) batching</b> reschedules at <em>every decode step</em>: the engine maintains a pool of active sequences; each step it runs one forward pass over all of them; any sequence that emits EOS or hits its limit leaves <em>immediately</em>, and a waiting request takes the free slot on the very next step. New arrivals get their prefill interleaved (chunked, in modern engines) with ongoing decodes. No dead slots, no batch boundaries — the GPU is always full of whatever work exists. Orca (2022) introduced the idea; vLLM made it ubiquitous; every serious engine (vLLM, SGLang, TensorRT-LLM, TGI) now does it. Measured effect versus static batching on real traffic: <b>roughly 10–20× throughput at the same hardware</b> — the single biggest step-change in serving economics of the LLM era, and the reason API prices fell the way they did through 2024–25.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Continuous batching turned the unit of scheduling from "a batch of requests" into "one decode step across whatever is active." Everything else in modern serving — chunked prefill, priority scheduling, preemption — falls out of owning the per-step schedule.</div>' +
        '<h2>PagedAttention: virtual memory for the KV cache</h2>' +
        '<p>Continuous batching creates a memory problem: sequences enter and exit constantly, each with an unpredictable, growing KV cache. Pre-vLLM engines allocated each sequence a <em>contiguous</em> region sized for max possible length — and profiling showed <b>60–80% of KV memory wasted</b> on reservation the sequence never used, plus external fragmentation from variable-size chunks. Waste in KV memory is waste in batch size is waste in throughput.</p>' +
        '<p><b>PagedAttention</b> (the vLLM paper, 2023) imported the OS playbook: carve KV memory into fixed-size <b>blocks</b> (16 tokens\' worth, typically), give each sequence a <b>block table</b> mapping its logical positions to physical blocks scattered anywhere in VRAM, and allocate blocks on demand as the sequence grows. The attention kernel walks the block table — exactly page tables and virtual memory. Waste drops to under ~4% (only the last partial block per sequence), which converts directly into 2–4× more concurrent sequences in the same VRAM. Bonus features fall out free, exactly like OS paging:</p>' +
        '<ul>' +
        '<li><b>Sharing / copy-on-write:</b> N requests with the same prompt prefix (system prompt, few-shot block) map to the <em>same physical blocks</em>; blocks fork only when sequences diverge. Prefix caching and parallel sampling (n candidates from one prompt) become nearly free.</li>' +
        '<li><b>Preemption:</b> under pressure, a low-priority sequence\'s blocks can be swapped to CPU RAM or dropped-and-recomputed, then resumed — the scheduler can make hard choices instead of OOMing.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> Continuous batching has a throughput/latency tension baked in: the fuller the GPU, the more sequences share each step, and per-stream tokens/sec sags while aggregate throughput climbs. Teams that benchmark an empty vLLM at 90 tok/s/stream and promise that in the SLO get a surprise at peak traffic when it\'s 35. Load-test at target concurrency; watch the engine\'s own metrics (queue depth, KV utilization, preemption count — vLLM exports all three) rather than nvidia-smi\'s misleading "GPU util" percentage, which reads high even when bandwidth-starved.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Batching amortizes <em>weights</em>, not KV: each sequence still reads its own cache every step, so at long contexts aggregate KV bandwidth becomes the new roof — 100 streams × 4 GB of cache each is 400 GB touched per token-step, and no scheduler fixes physics. This is why long-context serving batches shallow no matter how clever the engine, and why GQA/MLA (lesson 2) and KV quantization (lesson 4) are throughput features, not just capacity features.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Explain what vLLM actually does" is a fair senior question. Two-part answer: continuous batching (per-step scheduling, immediate slot recycling — the 10–20× throughput unlock) and PagedAttention (block-table KV allocation killing the 60–80% fragmentation waste, enabling prefix sharing and preemption). Candidates who only say "it\'s a fast server" haven\'t looked inside.</div>'
    },
    {
      id: 'quantization',
      title: 'Quantization: the compression landscape and what actually degrades',
      blurb: 'GGUF, AWQ, GPTQ, FP8, INT4 — what each is for, and where quality quietly goes.',
      html: '<h2>Why quantization is a speed feature</h2>' +
        '<p>Quantization stores weights (and optionally KV cache and activations) in fewer bits. The naive pitch is "fit bigger models in less VRAM," which is true — but the bytes_per_token formula from lesson 1 gives the sharper truth: decode speed ≈ bandwidth ÷ bytes streamed, so <b>halving the bits roughly doubles the decode ceiling</b>. A 4-bit 70B (~40 GB) both fits on hardware that FP16 (140 GB) never could <em>and</em> decodes ~3.5× faster per stream on it. Weight-only quantization keeps activations and arithmetic in FP16/BF16 — weights are dequantized on the fly in the kernel — because weights are the static, offline-compressible bulk while activations are dynamic and outlier-riddled.</p>' +
        '<h2>The format landscape, as of early 2026</h2>' +
        '<table><tr><th>Format</th><th>What it is</th><th>Where it lives</th></tr>' +
        '<tr><td><b>GGUF</b> (K-quants, I-quants)</td><td>llama.cpp\'s file format + block-wise quant schemes, 2–8 bit (Q4_K_M ≈ 4.7 bits/weight is the workhorse); CPU-first design, GPU offload supported</td><td>Local/edge inference, Ollama, the entire hobbyist-to-workstation world (module 16)</td></tr>' +
        '<tr><td><b>GPTQ</b></td><td>One-shot 4-bit using second-order (Hessian-based) error compensation over a calibration set</td><td>The 2023 GPU standard; still common on older checkpoints</td></tr>' +
        '<tr><td><b>AWQ</b></td><td>Activation-aware: identifies the ~1% of weight channels with large activations and protects them via per-channel scaling before 4-bit rounding</td><td>Default 4-bit for GPU serving in vLLM/SGLang; generally edges GPTQ on quality</td></tr>' +
        '<tr><td><b>FP8 (E4M3/E5M2)</b></td><td>8-bit <em>floating</em> point for weights, activations, and KV; native on Hopper/Ada and later — actual FP8 tensor-core matmuls, so it accelerates compute-bound prefill too, not just decode</td><td>The datacenter serving default; near-lossless (typically ≤0.1–0.5% on benchmarks); many frontier and open models now ship FP8-native</td></tr>' +
        '<tr><td><b>INT4/NF4 (bitsandbytes)</b></td><td>Load-time 4-bit, no calibration; NF4 is the QLoRA training workhorse (module 14)</td><td>Convenient loading and fine-tuning; slower kernels than AWQ/GPTQ for serving</td></tr></table>' +
        '<h2>What actually degrades — and what doesn\'t</h2>' +
        '<p>The headline benchmarks are misleadingly kind: a good 4-bit quant of a big model loses ~1–3% on MMLU-style multiple choice, and FP8 loses approximately nothing. But degradation is not uniform across capabilities; it concentrates where precision carries information density:</p>' +
        '<ul>' +
        '<li><b>Long-tail knowledge goes first</b> — rare facts, niche APIs, obscure entities. Quantization noise drowns weakly-stored associations while common knowledge survives. Benchmarks over-sample common knowledge, which is why "no measurable loss" claims and user complaints coexist.</li>' +
        '<li><b>Multi-step reasoning and math</b> degrade next: small per-token errors compound across long chains. A model that\'s 99% per-step is 74% over 30 steps.</li>' +
        '<li><b>Multilingual and code edge cases</b> — anything under-represented in training (and in the quantizer\'s calibration set, which is usually English web text) takes outsized damage.</li>' +
        '<li><b>Format compliance and short factual QA</b> barely move — which is why quantized models feel fine in casual testing and then miss in production evals.</li>' +
        '<li>Below ~4 bits the floor drops fast: 3-bit is noticeably lossy, 2-bit needs exotic schemes and still visibly hurts. As of early 2026, <b>4-bit weights are the sweet spot; FP8 is the "free" choice</b> when the hardware supports it. And a subtle asymmetry: aggressive quantization hurts <em>small</em> models proportionally more — an 8B has less redundancy to spend than a 70B, which is part of why quantized-large usually beats full-precision-small at equal VRAM (module 16).</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Never trust a quant on someone else\'s benchmark. Run <em>your</em> eval suite against the exact artifact you\'ll serve — quantized checkpoints differ by calibration data, scheme, and even by who uploaded them. The eval bill is minutes; the silent-regression bill is unbounded.</div>' +
        '<h2>KV cache quantization</h2>' +
        '<p>Weights aren\'t the only tensor worth shrinking: lesson 2 showed the KV cache rivaling model size at long context. <b>FP8 KV</b> halves cache size and read bandwidth for near-zero quality loss and is increasingly the serving default; <b>INT4 KV</b> quarters it but measurably hurts long-range recall — keys are more sensitive than values (attention logits amplify key error), which is why asymmetric schemes (e.g. K at 8-bit, V at 4-bit) exist. The win compounds: half the cache bytes means double the concurrent streams <em>and</em> lighter per-step KV reads — capacity and speed in one knob. Trade-off testing must include long-context retrieval evals (needle-style plus your real RAG traces), because that\'s precisely where KV noise bites and where generic benchmarks are blind.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team A/B\'d "the same model" between their staging vLLM (FP16) and prod (a community AWQ checkpoint from a hub) and chased a phantom 4-point drop in their RAG faithfulness eval for a week — it was the quant, specifically degraded recall over 20k-token contexts, invisible in their short-prompt smoke tests. Pin quantized artifacts by hash, record the quant config next to the model id in every eval report, and always include long-context cases in the regression suite.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Expect "we need to serve 70B on two 24 GB cards — options?" Walk it: FP16 needs 140 GB, dead; 4-bit AWQ ≈ 40 GB weights + KV headroom across 2× 24 GB is tight but workable with GQA and FP8 KV; name the expected damage (long-tail recall, long CoT) and insist on running the team\'s own evals on the exact artifact. Naming K-vs-V sensitivity marks genuine depth.</div>'
    },
    {
      id: 'speculative-decoding',
      title: 'Speculative decoding: spending compute to buy latency',
      blurb: 'Draft models, self-speculation, Medusa heads — and the regime where it stops paying.',
      html: '<h2>The idea: guess serially, verify in parallel</h2>' +
        '<p>Decode is bandwidth-bound: each step streams the whole model to produce one token, leaving compute idle. Speculative decoding spends that idle compute to break the serial chain. A cheap <b>draft</b> proposes k tokens (say 4–8), then the big <b>target</b> model runs <em>one</em> forward pass over all k positions at once — verification is prefill-shaped, parallel, nearly the cost of a single decode step. Accepted tokens (the prefix where the target agrees) commit in bulk; the first disagreement is replaced by the target\'s own token and drafting resumes from there.</p>' +
        '<p>The elegant part — and the part interviewers probe — is the <b>acceptance rule</b>: draft token x is accepted with probability <code>min(1, p_target(x)/p_draft(x))</code>; on rejection you sample from the renormalized difference <code>max(0, p_target − p_draft)</code>. This makes the output distribution <em>provably identical</em> to sampling the target model alone. Speculative decoding is a pure latency optimization with zero quality cost — not an approximation. (Some deployments do run "relaxed" acceptance for extra speed; that <em>is</em> an approximation, and vendors are not always loud about it.)</p>' +
        '<h2>The speedup arithmetic</h2>' +
        '<p>Let a = per-token acceptance rate. Expected committed tokens per target pass ≈ (1−a^(k+1))/(1−a) — at a=0.7, k=5 that\'s ~2.9 tokens per pass, i.e. roughly <b>2–3× decode speedup</b> in the classic setup, minus drafting overhead. Everything hinges on a, which is a <em>distribution-match</em> property between draft and target on <em>your traffic</em>:</p>' +
        '<ul>' +
        '<li><b>High acceptance (0.7–0.9):</b> predictable text — code, JSON, boilerplate, RAG answers quoting context, low temperature. Structured-output endpoints are speculation\'s best customer.</li>' +
        '<li><b>Low acceptance (0.3–0.5):</b> creative prose, high temperature, domains the draft never saw. At low a you pay drafting cost plus verification for ~1 token per pass — you can end up <em>slower</em> than plain decode.</li>' +
        '</ul>' +
        '<h2>Three families of drafter</h2>' +
        '<table><tr><th>Family</th><th>Mechanism</th><th>Trade-offs</th></tr>' +
        '<tr><td><b>Separate draft model</b></td><td>A small same-family model (e.g. 1B drafting for 70B) runs autoregressively ahead</td><td>Best acceptance when tokenizers/training match; costs extra VRAM + a second model to deploy, version, and keep distribution-matched</td></tr>' +
        '<tr><td><b>Self-speculative</b></td><td>The target drafts with part of itself — skipped layers, early exit, or n-gram/prompt-lookup drafting (copy candidate continuations straight from the prompt — free and shockingly effective for RAG/editing traffic that quotes its input)</td><td>No second model, no extra memory for the n-gram variants; acceptance more traffic-dependent</td></tr>' +
        '<tr><td><b>Medusa-style / EAGLE-style heads</b></td><td>Small trained heads predict several future tokens from the target\'s own hidden state, verified as a tree of candidate branches in one pass</td><td>No separate model, high acceptance (EAGLE-family reports ~3–4× on code as of early 2026); requires a training step per target model, engine support for tree attention</td></tr></table>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why does verifying k tokens cost about one step? The same reason prefill is fast: the k draft positions are all <em>known</em>, so the target processes them in parallel — one weight-stream serves k positions instead of one. Speculation converts bandwidth-bound serial decode into small bursts of compute-bound parallel verification. It is arbitrage on the compute/bandwidth gap, which also tells you exactly when it dies: when there is no idle compute left to arbitrage.</div>' +
        '<h2>When it pays — and when it fights batching</h2>' +
        '<p>That caveat is the production-relevant one. At high batch sizes, continuous batching has <em>already</em> filled the idle compute with other requests\' tokens; speculation\'s verification FLOPs now compete with real work, and wasted rejected-token compute is throughput straight off the top. Speculative decoding shines at <b>low-to-medium concurrency where latency is the SLO</b> — interactive chat, coding assistants, agent loops (where total wall-clock is decode-dominated across many serial calls) — and fades or inverts at throughput-saturated batch serving. Engines expose it as config (vLLM speculative config, TensorRT-LLM Medusa/EAGLE modes, llama.cpp draft models; SGLang EAGLE): measure accepted-tokens-per-pass and end-to-end latency on your traffic at your concurrency, not the paper\'s.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team shipped a 1B drafter for their 70B and saw a clean 2.4× in staging. Prod p50 improved; p99 got <em>worse</em> and throughput dropped at peak. Three compounding causes: peak-hour batches were compute-saturated (speculation now stole from throughput), their multilingual evening traffic had ~0.35 acceptance (draft was English-tuned), and the drafter\'s VRAM shrank KV capacity, cutting max concurrency. They kept speculation but gated it on engine load — on below 60% utilization, off above. Speculation is a <em>regime</em> optimization; deploy it with a switch, not a religion.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Two levels of probe: "explain speculative decoding" (draft → parallel verify → accept prefix; the min(1, p_t/p_d) rule; output distribution provably unchanged) and the senior follow-up, "when would you turn it OFF?" — high-batch throughput serving, low-acceptance traffic, VRAM-constrained deployments. The second question is where the real signal is.</div>'
    },
    {
      id: 'serving-stacks',
      title: 'Serving stacks and the latency/throughput dial',
      blurb: 'vLLM, SGLang, TensorRT-LLM, llama.cpp — who they\'re for — and how to design SLOs that respect the physics.',
      html: '<h2>The four stacks that matter (vendor-neutral, early 2026)</h2>' +
        '<table><tr><th></th><th><b>vLLM</b></th><th><b>SGLang</b></th><th><b>TensorRT-LLM</b></th><th><b>llama.cpp</b></th></tr>' +
        '<tr><td>Sweet spot</td><td>Default production GPU serving; broadest model + hardware support (NVIDIA/AMD/TPU/others)</td><td>High-QPS structured/agentic workloads; heavy shared-prefix traffic</td><td>Maximum single-node NVIDIA performance; latency-critical enterprise serving</td><td>CPU/consumer-GPU/edge; single-box and local (module 16)</td></tr>' +
        '<tr><td>Signature tech</td><td>PagedAttention, continuous batching, prefix caching, multi-LoRA, spec-decode options</td><td>RadixAttention — a prefix tree over KV so <em>all</em> overlapping prefixes share cache automatically; very fast constrained/JSON decoding; EAGLE integration</td><td>Compiled per-model/per-GPU kernels, best-in-class FP8/FP4 paths, Medusa/EAGLE, in-flight batching</td><td>GGUF quants, CPU+GPU layer offload, runs anywhere including phones</td></tr>' +
        '<tr><td>Ops profile</td><td>pip install, OpenAI-compatible server, huge community — the safe default</td><td>Similar ergonomics to vLLM, younger ecosystem, wins benchmarks on agent/JSON traffic</td><td>Engine build step per model+GPU combo; NVIDIA-only; real engineering investment</td><td>Single binary, zero Python; not built for large-scale multi-tenant batch serving</td></tr></table>' +
        '<p>Honest guidance: <b>start with vLLM</b> unless you have a reason; reach for <b>SGLang</b> when traffic is agentic/structured with massive prefix reuse (multi-turn agent trees hit RadixAttention\'s exact strength); justify <b>TensorRT-LLM</b>\'s build pipeline when you\'re NVIDIA-committed and the last 20–40% of latency is worth engineer-months; use <b>llama.cpp</b> when the deployment target is a workstation, a laptop, or a box in a clinic\'s closet. All four speak the OpenAI API dialect now, which makes bake-offs cheap — exploit that: benchmark on <em>your</em> traffic shape, because published benchmarks are all someone else\'s traffic.</p>' +
        '<h2>TTFT vs TPS: one GPU, two SLOs, opposite levers</h2>' +
        '<p>Every serving conversation eventually collapses to two numbers: <b>TTFT</b> (time to first token — queueing + prefill) and <b>TPS</b> per stream (decode rate — bandwidth ÷ bytes, shared across the batch). The uncomfortable truth from lessons 1–3: <b>aggregate throughput and per-request experience pull against each other on the same hardware.</b> Pack the batch fuller → each weight-stream serves more requests → cost per token falls → and every stream\'s TPS sags while new arrivals queue longer behind deeper prefill backlogs. There is no setting that maximizes both; there is only choosing your point on the curve.</p>' +
        '<ul>' +
        '<li><b>Latency-biased (chat, coding assistants):</b> cap concurrent sequences below saturation, enable chunked prefill so whale prompts don\'t stall streams, consider speculative decoding (low-batch regime is where it pays), keep utilization headroom for bursts. You are deliberately buying p95 with idle silicon.</li>' +
        '<li><b>Throughput-biased (batch pipelines, evals, data generation):</b> max out concurrency and queue depth, long scheduling windows, no speculation, quantize KV to pack more streams. Nobody is watching a spinner; only $/Mtok matters. Run these on separate deployments — or at separate hours — from interactive traffic. Mixing the two workloads on one pool is the classic self-inflicted incident.</li>' +
        '</ul>' +
        '<h2>Designing SLOs that respect the physics</h2>' +
        '<p>Good LLM SLOs name the phase they constrain: <b>TTFT p95 ≤ 800 ms</b> (queueing + prefill — the "feels responsive" number, hidden further by streaming the tokens as they come), <b>per-stream TPS ≥ 25–30 tok/s</b> (faster than humans read; more only matters for agents and code), and for non-streaming API consumers, <b>end-to-end p95 by request class</b> — because E2E = TTFT + output_len/TPS, and output length is the biggest variance source you control (cap max_tokens per endpoint; unbounded generation is unbounded latency). Then alarm on the <em>leading</em> indicators from the engine itself: queue depth, KV-cache utilization, preemption/eviction counts — they move minutes before user-facing percentiles do.</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Know your ceilings before tuning: single-stream TPS ceiling = bandwidth ÷ model bytes (lesson 1); max concurrency ceiling = free VRAM ÷ (KV per token × p95 context) (lesson 2); aggregate token throughput ceiling ≈ compute roof at full batch. If an SLO implies exceeding a ceiling, no config flag will save you — change the model size, the quant, the hardware, or the promise.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team "load-tested" with uniform 200-token prompts and declared TTFT p95 of 300 ms. Prod traffic arrived with a bimodal prompt distribution — chat turns plus 40k-token document dumps — and the big prompts\' prefills queued behind each other, dragging chat TTFT past 4 s every few minutes. Fixes, in order of yield: chunked prefill, a separate queue/deployment for long-context requests, and prefix caching for the shared 6k-token system preamble that every request was needlessly re-prefilling. Load-test with production-shaped traffic — prompt lengths, arrival bursts, and cancellations — or you are testing a different product.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> The system-design staple: "Serve an 8B model to 500 concurrent users — walk me through it." Structure the answer as: SLOs first (TTFT/TPS targets by workload) → napkin ceilings (bandwidth math, KV budget at p95 context) → engine choice with a default-to-vLLM rationale → the knobs (quantization, chunked prefill, prefix caching, batch caps) → observability (queue depth, KV utilization, preemptions). Leading with hardware SKUs before SLOs is the junior tell.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your single-stream chatbot on one H100 (3.35 TB/s) generates ~180 tok/s from an FP16 8B model. An engineer proposes moving to a GPU with 2× the TFLOPs but the same memory bandwidth to "double generation speed." What happens?',
      options: [
        'Roughly 2× faster generation — decode is compute-limited',
        'Almost no change: batch-1 decode is memory-bandwidth-bound (~3350/16 ≈ 210 tok/s ceiling), and 180 is already near it; more FLOPs address the wrong bottleneck',
        'Generation gets faster but prefill gets slower',
        '2× faster only if the KV cache is disabled'
      ],
      answer: [1],
      explanation: 'Batch-1 decode streams all 16 GB of weights per token; the ceiling is bandwidth ÷ bytes ≈ 210 tok/s, and 180 is ~85% of it — extra FLOPs sit idle exactly like the current ones do. (A) describes prefill, the compute-bound phase. (C) has no mechanism — more compute would if anything help prefill. (D) is backwards: disabling the KV cache would force O(n) recompute per step and crater speed. The fixes that would help: quantize (fewer bytes/token) or batch (share the weight-stream).'
    },
    {
      text: 'Users complain the assistant "hangs" for 6 seconds before text starts, but once started it streams fast. Prompts include a 60k-token retrieved context. Which diagnosis and lever pair is right?',
      options: [
        'Decode is too slow — quantize the model to 4-bit',
        'TTFT is dominated by the 60k-token prefill (compute-bound, with an O(n²) attention term); levers are prefix caching for the reusable context, chunked prefill, and trimming retrieval — decode speed is evidently fine',
        'The KV cache is full — reduce max concurrent users',
        'Network latency — move the client closer to the server'
      ],
      answer: [1],
      explanation: 'Slow-to-first-token + fast-thereafter is the prefill signature: 60k tokens of prompt processing happens before any output, and attention\'s quadratic term is material at that length; caching the static prefix (or the whole retrieved doc across turns) attacks it directly. (A) tunes decode, which the user experience already shows is healthy. (C) KV pressure shows up as queueing/preemption across users, plausible but not indicated by a consistent per-request 6 s tied to prompt size. (D) network RTT is milliseconds, not six seconds, and wouldn\'t scale with prompt length.'
    },
    {
      text: 'Capacity planning: Llama-3.1-70B-class model (80 layers, 8 KV heads, head_dim 128, FP16 KV) serving requests that average 16k tokens of context. How much KV memory does one such request hold?',
      options: [
        'About 320 MB — KV cache is negligible next to the weights',
        'About 5 GB: 2 × 80 × 8 × 128 × 2 bytes = 320 KB per token, × 16,384 tokens ≈ 5.2 GB',
        'About 20 GB — 4× more because all 64 query heads store KV',
        'Zero if you enable PagedAttention, which eliminates the cache'
      ],
      answer: [1],
      explanation: 'Apply the formula: 2 (K+V) × layers × kv_heads × head_dim × dtype = 2·80·8·128·2 = 320 KB/token; at 16k tokens that\'s ~5 GB per request — a dozen concurrent users of this shape need ~60 GB for cache alone. (A) understates by ~16×, the classic weights-only capacity-planning error. (C) is what it would cost without GQA — query heads don\'t store KV; the 8 shared KV heads are the whole point. (D) PagedAttention eliminates fragmentation waste in how the cache is allocated; the cache itself is irreducible physics.'
    },
    {
      text: 'Why did DeepSeek\'s MLA (multi-head latent attention) accept extra compute at decode time to shrink the KV cache, and why is that a good trade specifically during decode?',
      options: [
        'It is not a good trade — decode compute is the scarce resource',
        'Decode is bandwidth-bound with compute sitting idle, so spending spare FLOPs to up-project a compact latent (instead of reading full K/V from memory) converts an abundant resource into relief for the scarce one — less memory read per step, more streams per GPU',
        'MLA only helps training, not inference',
        'The extra compute is offset because MLA removes the need for causal masking'
      ],
      answer: [1],
      explanation: 'MLA stores a low-rank latent per token and reconstructs K/V on the fly: memory traffic and cache size drop by an order of magnitude while the reconstruction FLOPs land on compute units that were idling anyway — textbook arbitrage of the compute/bandwidth asymmetry. (A) inverts the physics: decode compute is the abundant resource. (C) is false — KV cache is precisely an inference-serving concern. (D) is invented; causal masking is unrelated to KV compression.'
    },
    {
      text: 'Your static-batching server (batch 16, return when all finish) shows terrible GPU efficiency: some requests emit 10 tokens, others 2,000. What does continuous batching change, mechanically?',
      options: [
        'It compresses all responses to similar lengths so batches finish together',
        'Scheduling moves to per-decode-step: finished sequences free their slot immediately and queued requests join mid-flight, so the batch is always full of live work — typically ~10–20× throughput on real traffic vs static batching',
        'It runs each request on a dedicated CUDA stream, eliminating batching entirely',
        'It reorders the queue shortest-job-first so long generations never delay short ones'
      ],
      answer: [1],
      explanation: 'Continuous (in-flight) batching\'s whole trick is making the schedule per-step: no dead slots doing no-op work while the longest sequence finishes, no waiting for batch boundaries — that recovered dead time is where the order-of-magnitude gain comes from. (A) no engine alters generation lengths to help scheduling. (C) dedicated streams would abandon weight-stream sharing, the thing that makes batching economical at all. (D) SJF-style priorities can sit on top, but reordering a static queue doesn\'t fix dead slots — the mechanism is slot recycling, not ordering.'
    },
    {
      text: 'Pre-vLLM engines reserved contiguous max-length KV regions per sequence and measured 60–80% of KV memory wasted. Which TWO mechanisms of PagedAttention recover that memory?',
      options: [
        'Fixed-size KV blocks allocated on demand as sequences grow, with a per-sequence block table mapping logical to scattered physical blocks — waste falls to the last partial block',
        'Compressing the KV cache with 4-bit quantization',
        'Copy-on-write sharing of physical blocks across sequences with identical prefixes (system prompts, parallel samples)',
        'Storing the KV cache in CPU RAM instead of VRAM',
        'Recomputing attention from scratch each step so no cache is needed'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'PagedAttention is virtual memory for KV: (A) on-demand block allocation kills both over-reservation and fragmentation, and (C) block-level sharing with copy-on-write makes shared prefixes nearly free — together enabling 2–4× more concurrent sequences. (B) KV quantization is real but a separate, orthogonal technique. (D) CPU offload exists as a preemption/swap escape hatch, not the memory-efficiency mechanism, and it costs dearly in bandwidth. (E) would trade the cache for O(n) recompute per step — the disaster the cache exists to prevent.'
    },
    {
      text: 'You serve an 8B FP16 on a 24 GB GPU for an internal tool. VRAM is tight (few concurrent users fit) and decode feels sluggish. Which single change most directly improves BOTH problems, and why?',
      options: [
        'Enable speculative decoding with a 1B draft model',
        'Quantize weights to 4-bit (e.g. AWQ): weights drop ~16 GB → ~5 GB, freeing ~11 GB for more KV/concurrency, and decode\'s bytes-per-token drop lifts the tokens/sec ceiling ~3×',
        'Switch from vLLM to TensorRT-LLM',
        'Double max_tokens so requests finish in fewer round-trips'
      ],
      answer: [1],
      explanation: 'Weight quantization is the rare double win: VRAM freed for KV (capacity/concurrency) and fewer bytes streamed per decode step (speed), per the bandwidth formula. (A) speculation costs extra VRAM for the drafter — it would worsen the capacity problem it doesn\'t address. (C) an engine swap yields incremental gains, doesn\'t change the 16 GB weight footprint dominating a 24 GB card. (D) is confused — max_tokens caps output length; raising it does nothing for speed or memory and worsens tail latency.'
    },
    {
      text: 'After moving from FP16 to a community 4-bit quant, your short-prompt smoke tests pass but production evals show degraded recall of niche API details and more arithmetic slips in long chains. Is this expected?',
      options: [
        'No — 4-bit quantization is lossless; look for a serving bug',
        'Yes — quantization damage concentrates in long-tail knowledge (weakly-stored associations drown in quantization noise) and multi-step reasoning (per-token errors compound); standard benchmarks and smoke tests over-sample common knowledge and short outputs, so they miss it',
        'No — quantization only affects memory usage, never outputs',
        'Yes, but only because the quant was 4-bit; 8-bit formats degrade identically'
      ],
      answer: [1],
      explanation: 'This is the canonical quantization-quality signature: rare facts and long reasoning chains degrade first while common-knowledge QA and format compliance barely move — exactly why "no measurable loss on MMLU" coexists with real regressions, and why you eval your own suite on the exact artifact. (A)/(C) are false: lossy compression of weights is lossy in behavior, by definition. (D) inverts the dose-response: FP8/8-bit is near-lossless; damage grows as bits shrink, steeply below 4.'
    },
    {
      text: 'Long-context RAG traffic is limiting your concurrency: KV cache fills VRAM. You consider FP8 KV cache quantization vs INT4 KV. What is the right way to frame the choice?',
      options: [
        'Both are free wins; take INT4 for maximum savings',
        'FP8 KV halves cache size and per-step KV reads at near-zero quality cost; INT4 quarters them but measurably hurts long-range recall (keys are more error-sensitive than values) — so validate on long-context retrieval evals, exactly the workload you serve',
        'KV quantization only saves memory, not speed, so it will not help concurrency',
        'Quantize the weights instead — KV cache cannot be quantized'
      ],
      answer: [1],
      explanation: 'FP8 KV is the increasingly-default safe choice; INT4 KV is a real quality trade specifically where this team lives (long-context recall), and key-vs-value asymmetry is why mixed schemes exist. (A) ignores that the aggressive option damages precisely the served workload. (C) is doubly wrong: halving KV bytes both fits more streams (capacity) and lightens the per-step KV read that throttles long-context decode (speed). (D) is false — KV quantization is standard in every major engine, and this bottleneck is cache, not weights.'
    },
    {
      text: 'Speculative decoding with a well-matched draft gives you 2.5× on your JSON-extraction endpoint at low traffic. At peak hours (GPU near compute saturation from continuous batching), the same config reduces total throughput. Why?',
      options: [
        'The draft model forgets its training at high load',
        'At high batch, the compute that verification and rejected-token speculation consume was already fully employed serving other requests\' tokens — speculation arbitrages idle compute, and at saturation there is none to arbitrage, so wasted draft/verify FLOPs come straight out of throughput',
        'Acceptance rate drops to zero when batches are large',
        'PagedAttention is incompatible with speculative decoding'
      ],
      answer: [1],
      explanation: 'Speculation converts idle decode-time compute into latency gains; continuous batching at peak has already converted that idle compute into other users\' throughput — the two optimizations compete for the same slack, which is why load-gated speculation (on at low utilization, off at high) is the mature deployment. (A) is nonsense — models don\'t degrade with load. (C) acceptance is a draft/target distribution-match property, independent of batch size. (D) they compose fine in mainstream engines; no such incompatibility exists.'
    },
    {
      text: 'Your agent product makes 15 serial model calls per user task, mostly emitting structured tool calls and code at temperature 0. Concurrency is modest. Which inference optimization is the single best fit for this traffic, and why?',
      options: [
        'Speculative decoding (including cheap prompt-lookup/n-gram drafting): low-temperature structured output has high acceptance rates, the workload is decode-dominated across serial calls, and low concurrency leaves idle compute to exploit',
        'Maximum-depth continuous batching to raise aggregate throughput',
        'INT4 KV cache quantization to fit more concurrent streams',
        'A bigger GPU with more TFLOPs'
      ],
      answer: [0],
      explanation: 'This traffic is speculation\'s ideal customer on all three axes: predictable tokens (structured/code, temp 0 → high acceptance), wall-clock dominated by serial decode (15 chained calls multiply any per-call latency win), and low concurrency (idle compute available). (B) deep batching optimizes aggregate $/token at the cost of per-stream latency — the opposite of what serial agent chains need. (C) solves a KV-capacity problem this modest-concurrency workload doesn\'t have. (D) buys compute for a bandwidth-bound phase — the lesson-1 mistake in hardware form.'
    },
    {
      text: 'Which serving stack is the most defensible default for each need, matching stack to scenario? (i) broad-model production GPU serving with minimal ops; (ii) agent platform with huge shared-prefix reuse and strict JSON; (iii) NVIDIA-only fleet chasing the last 30% of latency, engineering time available; (iv) on-prem workstation with a consumer GPU.',
      options: [
        '(i) llama.cpp, (ii) TensorRT-LLM, (iii) vLLM, (iv) SGLang',
        '(i) vLLM, (ii) SGLang, (iii) TensorRT-LLM, (iv) llama.cpp',
        '(i) TensorRT-LLM, (ii) vLLM, (iii) llama.cpp, (iv) SGLang',
        '(i) SGLang, (ii) llama.cpp, (iii) vLLM, (iv) TensorRT-LLM'
      ],
      answer: [1],
      explanation: 'vLLM is the broad-support, low-ops production default; SGLang\'s RadixAttention (automatic KV sharing across all overlapping prefixes) plus fast constrained decoding is built for exactly the agent/JSON shape; TensorRT-LLM\'s compiled per-model engines buy peak NVIDIA performance at real engineering cost; llama.cpp owns consumer/edge hardware with GGUF and CPU/GPU offload. The other orderings misplace at least two: llama.cpp is not a multi-tenant datacenter server, and TensorRT-LLM on a consumer workstation is effort with no payoff. All four expose OpenAI-compatible APIs, so verifying this choice with a bake-off on your own traffic is cheap.'
    },
    {
      text: 'You must set SLOs for two workloads sharing a GPU pool: interactive chat, and a nightly batch summarization pipeline. What does the physics of batching say about this arrangement?',
      options: [
        'Share the pool and set one SLO: p95 end-to-end latency of 5 seconds for everything',
        'Per-stream latency and aggregate throughput trade against each other on shared hardware — batch work wants saturated deep batches that would crush chat\'s TTFT/TPS; separate the workloads (different deployments, or time-windows), give chat TTFT+TPS SLOs with utilization headroom, and run batch throughput-maxed with no per-request latency promise',
        'Run both together but give chat requests bigger max_tokens so they finish faster',
        'The GPU scheduler automatically isolates workloads, so no design is needed'
      ],
      answer: [1],
      explanation: 'Deeper batches raise aggregate throughput while sagging every stream\'s TPS and queueing new prefills — a full-throttle batch pipeline on the chat pool is a standing TTFT incident; the standard fix is workload separation plus phase-specific SLOs (TTFT p95, per-stream TPS floor for chat; $/Mtok for batch). (A) one E2E number ignores that E2E = TTFT + length/TPS, with output length as a huge variance source across workloads. (C) is backwards — bigger max_tokens lengthens generations. (D) no such isolation exists; the engine\'s scheduler shares steps across everything you send it.'
    },
    {
      text: 'A vendor demo shows their serving setup doing 40,000 aggregate tokens/sec on an 8B model, and your team concludes each of your users will see fast responses. What is wrong with that inference?',
      options: [
        'Nothing — aggregate throughput divided by users gives per-user speed',
        'Aggregate throughput is achieved by deep batching, where each individual stream may decode at a small fraction of single-stream speed and new requests queue behind prefill backlogs — per-user experience is TTFT and per-stream TPS at your concurrency and traffic shape, which the aggregate number does not reveal',
        'The number is fake — 8B models cannot exceed 10,000 tokens/sec on any hardware',
        'Throughput only measures prefill, which users never see'
      ],
      answer: [1],
      explanation: 'This is the throughput/latency conflation in vendor-benchmark form: 40k tok/s across hundreds of packed streams coexists with 20 tok/s per stream and multi-second TTFT under bursty arrivals — the demo number and user experience are nearly independent, and only load-testing production-shaped traffic (real prompt-length mix, burst arrival patterns) reveals the latter. (A) division assumes streams and traffic are uniform and queueing is free; neither holds. (C) aggregate numbers of that scale are routine for batched 8B serving on modern hardware. (D) is confused — throughput counts generated tokens; prefill is separate and users do experience it, as TTFT.'
    }
  ],
  flashcards: [
    { id: 'fc-two-phases', front: 'Prefill vs decode: bottleneck of each phase?', back: 'Prefill: all prompt tokens in parallel → big matmuls → <b>compute-bound</b>. Decode: one token per step, streams all weights from HBM each step → <b>memory-bandwidth-bound</b>. Separate SLOs (TTFT vs TPS), separate levers.' },
    { id: 'fc-arith-intensity', front: 'Arithmetic intensity — definition and why decode fails it?', back: 'FLOPs per byte fetched from memory. H100 needs ~300 FLOPs/byte to stay busy; batch-1 decode does ~2 FLOPs/param while streaming each param\'s bytes → intensity ≈ 1 → compute idles ~99%.' },
    { id: 'fc-tps-formula', front: 'The napkin formula for single-stream decode speed?', back: '<b>tokens/sec ≈ memory bandwidth ÷ bytes per token</b> (weights + KV read). H100 3.35 TB/s ÷ 16 GB (FP16 8B) ≈ 210 tok/s ceiling; 4-bit → ~740. Quantization is a speed feature.' },
    { id: 'fc-why-serial', front: 'Why can\'t decode parallelize like prefill?', back: 'Autoregression: token n+1 needs token n\'s output — a strict serial dependency. Prompt tokens are all known, so prefill parallelizes across the sequence. Speculation breaks the chain by guessing + verifying in parallel.' },
    { id: 'fc-kv-formula', front: 'KV cache bytes per token — the formula?', back: '<b>2 × n_layers × n_kv_heads × head_dim × dtype_bytes</b> (2 = K and V). Llama-3.1-8B FP16: 2·32·8·128·2 = 128 KB/token → 16 GB at 128k. 70B: 320 KB/token → 40 GB at 128k.' },
    { id: 'fc-kv-vs-weights', front: 'Why does KV cache, not compute, usually cap concurrency?', back: 'One 128k stream on an 8B carries a cache as big as the 16 GB model. Streams ≈ (VRAM − weights) ÷ (KV/token × p95 context). Long context is priced like a luxury good because it is one.' },
    { id: 'fc-gqa-mqa-mla', front: 'GQA vs MQA vs MLA in one line each?', back: 'MQA: one shared KV head (max compression, quality cost). <b>GQA</b>: KV shared in groups (Llama: 32Q→8KV = 4× smaller; the early-2026 default). <b>MLA</b> (DeepSeek): store a low-rank latent, up-project at attention time — ~10× smaller cache for extra (cheap) decode compute.' },
    { id: 'fc-why-not-q', front: 'Why cache K and V but never Q?', back: 'Step n\'s attention uses only the <em>current</em> query against all past K/V. Past queries were consumed producing past outputs — dead. K/V are write-once read-every-step; Q is computed fresh and discarded.' },
    { id: 'fc-cont-batching', front: 'Continuous batching — mechanism and magnitude?', back: 'Reschedule every decode step: finished sequences exit instantly, queued requests join mid-flight, prefills interleave (chunked). No dead slots or batch boundaries → ~<b>10–20×</b> throughput vs static batching on real traffic.' },
    { id: 'fc-paged-attn', front: 'PagedAttention in one sentence + the waste number it fixed?', back: 'Virtual memory for KV: fixed-size blocks allocated on demand, per-sequence block tables, copy-on-write prefix sharing. Killed the 60–80% waste of contiguous max-length reservation → &lt;~4% waste → 2–4× more streams.' },
    { id: 'fc-batch-tension', front: 'What does batching amortize — and what can it not amortize?', back: 'Amortizes the <b>weight stream</b> across concurrent tokens. Cannot amortize per-sequence <b>KV reads</b> — at long context, aggregate KV bandwidth becomes the roof, so long-context serving batches shallow regardless of engine.' },
    { id: 'fc-quant-map', front: 'Map the quant formats: GGUF, GPTQ, AWQ, FP8, NF4.', back: 'GGUF: llama.cpp block quants (Q4_K_M workhorse), CPU/edge. GPTQ: Hessian-compensated 4-bit, 2023 GPU standard. AWQ: activation-aware channel protection, current GPU 4-bit default. FP8: native Hopper+ floating 8-bit, near-lossless datacenter default (accelerates prefill too). NF4: bitsandbytes load-time 4-bit, QLoRA training.' },
    { id: 'fc-quant-degrade', front: 'What degrades first under 4-bit quantization?', back: 'Long-tail knowledge (weak associations drown in noise) → multi-step reasoning/math (errors compound) → multilingual/edge cases. Short factual QA and format compliance barely move — why smoke tests pass while prod evals regress. Eval YOUR suite on the exact artifact.' },
    { id: 'fc-kv-quant', front: 'KV cache quantization: FP8 vs INT4 trade?', back: 'FP8 KV: half the cache + half the per-step KV read, near-zero loss — increasingly default. INT4 KV: quarter size but hurts long-range recall; keys more sensitive than values (logits amplify K error) → mixed K8/V4 schemes. Validate on long-context evals.' },
    { id: 'fc-specdec', front: 'Speculative decoding — mechanism and the acceptance rule?', back: 'Draft proposes k tokens; target verifies all k in ONE parallel pass; accept the agreeing prefix. Accept x with prob <b>min(1, p_target/p_draft)</b>, resample from max(0, p_t − p_d) on reject → output distribution provably identical to the target alone.' },
    { id: 'fc-specdec-when', front: 'When does speculative decoding pay, and when does it invert?', back: 'Pays: low/medium concurrency + latency SLO + predictable tokens (code, JSON, RAG, temp 0 → acceptance 0.7–0.9 → ~2–3×). Inverts: compute-saturated deep batching (no idle FLOPs to arbitrage) or low-acceptance traffic. Deploy behind a load gate.' },
    { id: 'fc-drafter-families', front: 'Three drafter families for speculation?', back: '1) Separate small draft model (best match, extra VRAM/ops). 2) Self-speculative: layer-skip or n-gram/prompt-lookup (free; great for text that quotes its input). 3) Medusa/EAGLE-style trained heads + tree verification (high acceptance, needs per-model training + engine support).' },
    { id: 'fc-stack-pick', front: 'Default serving stack per scenario: production GPU / agentic-JSON / peak NVIDIA / consumer box?', back: 'vLLM (broad, low-ops default) / SGLang (RadixAttention prefix sharing + fast constrained decoding) / TensorRT-LLM (compiled engines, real eng cost) / llama.cpp (GGUF, CPU+GPU offload). All speak OpenAI dialect — bake-offs are cheap.' },
    { id: 'fc-ttft-tps', front: 'TTFT vs TPS — what drives each and why do they trade?', back: 'TTFT = queueing + prefill (prompt length, backlog, chunked prefill, prefix cache). TPS = bandwidth ÷ bytes, shared across the batch. Fuller batches → cheaper tokens but slower streams and longer queues. Choose a point on the curve per workload; separate chat from batch pipelines.' },
    { id: 'fc-slo-design', front: 'What does a physics-respecting LLM SLO set look like?', back: 'TTFT p95 (e.g. ≤800 ms) + per-stream TPS floor (~25–30 tok/s ≈ reading speed) + E2E p95 per request class with capped max_tokens. Alarm on leading engine metrics: queue depth, KV utilization, preemptions — they fire before user percentiles move.' }
  ],
  lab: {
    title: 'Measure the physics: prefill vs decode, KV math, and batching on your own machine',
    intro: '<p>Four experiments that turn this module\'s formulas into numbers you measured yourself: benchmark prefill vs decode throughput, verify the bandwidth napkin math, compute KV budgets with a script, and watch batching multiply throughput. Everything runs locally with llama.cpp — $0. An optional final step reproduces the batching result on a rented GPU with vLLM.</p><p><b>Needs:</b> <code>python3</code>, ~8 GB RAM, any laptop/desktop (GPU optional but more dramatic). Worst case cost: $0 local; optional vLLM step ~$2 for one rented GPU-hour.</p>',
    steps: [
      {
        title: 'Install llama.cpp and grab a small GGUF model',
        html: '<pre><code># macOS: brew install llama.cpp   |   Linux: prebuilt releases or build from source\ngit clone https://github.com/ggml-org/llama.cpp\ncmake -B build llama.cpp &amp;&amp; cmake --build build --config Release -j\n\n# ~1 GB, 4-bit quant of a 1B model — plenty for measuring physics\nbuild/bin/llama-cli --hf-repo bartowski/Llama-3.2-1B-Instruct-GGUF \\\n  --hf-file Llama-3.2-1B-Instruct-Q4_K_M.gguf -p "hello" -n 8</code></pre>' +
          '<p>The first run downloads and caches the model. Any comparable GGUF works (Qwen2.5-1.5B-Instruct is ungated); module 16 goes deep on choosing quant levels — today the model is just a probe for measuring the serving physics.</p>'
      },
      {
        title: 'Benchmark prefill vs decode and check the napkin math',
        html: '<pre><code># pp = prompt processing (prefill), tg = token generation (decode)\nbuild/bin/llama-bench -m ~/.cache/llama.cpp/*Llama-3.2-1B*Q4_K_M.gguf \\\n  -p 512 -n 128</code></pre>' +
          '<p>Read the two rows: <code>pp512</code> (prefill tok/s) and <code>tg128</code> (decode tok/s). Expect prefill to be <b>1–2 orders of magnitude faster per token</b> than decode — the compute-bound vs bandwidth-bound split, measured. Now verify the formula: the Q4_K_M file is ~0.8 GB, so predicted decode ceiling ≈ your_memory_bandwidth ÷ 0.8 GB. Look up your machine\'s bandwidth (Apple M-series: ~100–400 GB/s; DDR5 desktop: ~60–90 GB/s; discrete GPU: 300–1000+ GB/s) and compare — measured tg should land within ~2× of bandwidth ÷ model_bytes. Then rerun with a Q8_0 file (~1.4 GB): decode slows roughly in proportion to file size while prefill barely moves. You have just demonstrated that decode speed is a bytes-per-token game.</p>'
      },
      {
        title: 'The KV cache calculator — reproduce the lesson\'s numbers',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\ndef kv(name, layers, kv_heads, head_dim, dtype_bytes=2):\n    per_tok = 2 * layers * kv_heads * head_dim * dtype_bytes\n    print(f"{name:28s} {per_tok/1024:7.0f} KB/token"\n          f"  | 8k: {per_tok*8192/2**30:6.2f} GB"\n          f"  | 32k: {per_tok*32768/2**30:6.2f} GB"\n          f"  | 128k: {per_tok*131072/2**30:6.2f} GB")\n\nkv("Llama-3.1-8B (GQA 8kv)",  32,  8, 128)\nkv("  same, hypothetical MHA", 32, 32, 128)\nkv("Llama-3.1-70B (GQA 8kv)", 80,  8, 128)\nkv("  70B with FP8 KV",       80,  8, 128, dtype_bytes=1)\n\nvram, weights, ctx = 80, 16, 16384   # H100 serving FP16 8B, p95 ctx 16k\nper_tok = 2*32*8*128*2\nprint(f"\\nmax concurrent 16k streams on 80GB: {(vram-weights-4)*2**30 // (per_tok*ctx):.0f}")\nEOF</code></pre>' +
          '<p>Confirm the module\'s numbers: 128 KB/token for the 8B, the 4× GQA saving vs MHA, 40 GB for a 70B at 128k, and FP8 KV halving everything. Then play capacity planner: change <code>ctx</code> to 4k and 64k and watch max concurrency swing by an order of magnitude — the whole long-context pricing story in one variable.</p>'
      },
      {
        title: 'Watch batching multiply throughput',
        html: '<pre><code># start an OpenAI-compatible server with room for 8 parallel sequences\nbuild/bin/llama-server -m ~/.cache/llama.cpp/*Llama-3.2-1B*Q4_K_M.gguf \\\n  --parallel 8 -c 16384 --port 8080 &amp;\n\npython3 - &lt;&lt;\'EOF\'\nimport json, time, urllib.request, concurrent.futures as cf\n\ndef gen(i):\n    body = json.dumps({"model": "x", "max_tokens": 96, "temperature": 0.8,\n        "messages": [{"role": "user", "content": f"Write a limerick about GPU number {i}."}]}).encode()\n    req = urllib.request.Request("http://localhost:8080/v1/chat/completions",\n        body, {"Content-Type": "application/json"})\n    r = json.load(urllib.request.urlopen(req))\n    return r["usage"]["completion_tokens"]\n\nfor conc in (1, 2, 4, 8):\n    t0 = time.time()\n    with cf.ThreadPoolExecutor(conc) as ex:\n        toks = sum(ex.map(gen, range(conc)))\n    dt = time.time() - t0\n    print(f"concurrency {conc}: {toks:4d} tokens in {dt:5.1f}s"\n          f"  -&gt; aggregate {toks/dt:6.1f} tok/s, per-stream {toks/dt/conc:5.1f} tok/s")\nEOF</code></pre>' +
          '<p>The pattern to observe: <b>aggregate tok/s climbs with concurrency while per-stream tok/s sags</b> — the throughput/latency dial from lesson 6, on your own hardware. (On CPU the effect saturates early because CPUs lack the GPU\'s idle-compute reservoir; on a GPU the aggregate scaling runs much further — which is the point of the optional next step.) Kill the server when done: <code>kill %1</code>.</p>'
      },
      {
        title: 'Optional: continuous batching at GPU scale with vLLM (~$2)',
        html: '<pre><code># on a rented GPU box (RTX 4090 ~$0.40/hr or A100 ~$1.50/hr as of early 2026)\npip install vllm\nvllm serve Qwen/Qwen2.5-1.5B-Instruct --max-model-len 8192 &amp;\n\n# vLLM ships a load-testing client — production-shaped traffic, not uniform prompts\nvllm bench serve --model Qwen/Qwen2.5-1.5B-Instruct \\\n  --dataset-name random --num-prompts 200 --request-rate 8</code></pre>' +
          '<p>Read the report like an SRE: request throughput, <b>mean/median/p99 TTFT</b>, and <b>per-request output token throughput</b>. Re-run with <code>--request-rate 2</code> and <code>--request-rate 32</code> and plot the trade: TTFT degrades as arrival rate approaches saturation while aggregate throughput plateaus at the hardware roof. Also hit <code>curl localhost:8000/metrics</code> mid-run and find the leading indicators from lesson 6: queue depth (<code>num_waiting</code>), KV utilization (<code>kv_cache_usage</code>), and preemptions. <b>Terminate the instance when finished.</b></p>'
      }
    ],
    costNote: 'Local steps: $0 and no cleanup beyond <code>kill %1</code> for the server and deleting cached GGUF files (~1–2 GB in <code>~/.cache/llama.cpp</code>) if disk matters. Optional vLLM step: worst case ~$2 (one hour on an A100-class rental) — terminate the GPU instance immediately after the benchmark; an idle rental bills identically to a busy one.'
  }
});
