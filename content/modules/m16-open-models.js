COURSE.register({
  id: 'm16-open-models',
  track: 'advanced',
  order: 16,
  title: 'Open models & local inference',
  short: 'Open models',
  tagline: 'The open-weight landscape as of early 2026, llama.cpp and Ollama in anger, sizing models to tasks and VRAM, and the honest math of when self-hosting beats the API.',
  minutes: 115,
  lessons: [
    {
      id: 'landscape',
      title: 'The open-model landscape, early 2026 (date-stamped)',
      blurb: 'The families that matter, the licenses that actually bind you, and why "open source" is mostly the wrong term.',
      html: '<h2>The families and what each is known for</h2>' +
        '<p>Everything in this lesson is date-stamped <b>as of early 2026</b> — this is the fastest-moving map in the course, and the specific model names will age faster than the framework for reading them. The framework: for each family, know the license, the size ladder, and the personality.</p>' +
        '<ul>' +
        '<li><b>Llama (Meta):</b> the family that created the ecosystem — most tooling, most fine-tunes, most tutorials assume a Llama first. Ships dense models from ~1B edge sizes up through 70B-class, plus large MoE flagships in the newest generation. License: the <b>Llama Community License</b> — permissive-ish but with strings (see below).</li>' +
        '<li><b>Qwen (Alibaba):</b> the volume leader on release cadence and size coverage — 0.5B to 70B+-class dense plus large MoE, strong multilingual and coding lines (Qwen-Coder), most checkpoints <b>Apache-2.0</b>. As of early 2026 the default "just give me a good N-B model" answer at many sizes.</li>' +
        '<li><b>DeepSeek:</b> the efficiency shock troops — V3-class MoE (~671B total / ~37B active) and the R1 reasoning line, <b>MIT-licensed</b> with distillation explicitly blessed; R1\'s early-2025 release mainstreamed open reasoning models and spawned distills at every size within weeks.</li>' +
        '<li><b>Mistral (France):</b> efficient dense models and pioneering open MoE work; a mix of Apache-2.0 releases (e.g. small/edge lines) and gated commercial weights; strong European-sovereignty positioning.</li>' +
        '<li><b>Gemma (Google):</b> 1–27B-class, distilled from Gemini lineage, excellent quality-per-parameter at the small end; custom "Gemma Terms" license — permissive in practice, with use restrictions.</li>' +
        '<li><b>Also on the map:</b> Microsoft\'s Phi line (small models, synthetic-data-heavy training), IBM Granite (Apache-2.0, enterprise-flavored), NVIDIA Nemotron (often strong at instruction-following; check each license), and the GLM/Kimi/MiniMax wave of large MoE releases from Chinese labs that kept the frontier gap narrow through 2025.</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> The durable fact isn\'t any leaderboard position — it\'s the <b>capability lag</b>: open-weight models have run roughly 6–12 months behind the proprietary frontier for three years, and the gap narrowed through 2025 (DeepSeek-R1 was the proof point). Whatever you decided "only a frontier API can do" a year ago deserves re-testing against this quarter\'s open models.</div>' +
        '<h2>Open weights ≠ open source</h2>' +
        '<p>Precision matters here because your legal team will ask. <b>Open source</b> (per the OSI definition) would require the freedom to use, study, modify, and redistribute without field-of-use restrictions — and arguably the training data/recipe to "study." Almost no major model qualifies. What you actually get is <b>open weights</b>: the checkpoint is downloadable, and a license says what you may do with it. Read the license, not the marketing:</p>' +
        '<table><tr><th>License</th><th>Examples (early 2026)</th><th>What binds you</th></tr>' +
        '<tr><td><b>Apache-2.0 / MIT</b></td><td>Most Qwen; DeepSeek; IBM Granite; several Mistral releases</td><td>Genuinely permissive: commercial use, modification, redistribution, distillation. The clean choice for products.</td></tr>' +
        '<tr><td><b>Llama Community License</b></td><td>Llama 3.x / 4.x families</td><td>Commercial use OK below a 700M-MAU threshold (aimed at Big Tech rivals, not you); acceptable-use policy; derivative naming/attribution obligations ("Built with Llama", model names carrying "Llama"). Fine for most, but it is a <em>contract</em> — route it past counsel.</td></tr>' +
        '<tr><td><b>Custom terms (Gemma etc.)</b></td><td>Gemma Terms of Use</td><td>Permissive day-to-day plus prohibited-use policies the vendor can update; check redistribution clauses for your distribution model.</td></tr>' +
        '<tr><td><b>Research / non-commercial</b></td><td>Some Mistral research weights, various lab releases</td><td>No production use, full stop. Teams have shipped these by accident; do not be that postmortem.</td></tr></table>' +
        '<p>Practical hygiene: record the license of every checkpoint <em>and every fine-tune base</em> in your model registry — a LoRA of a Llama inherits Llama\'s terms; a distill trained on a proprietary API\'s outputs may inherit that provider\'s restrictions (module 14). "Where did these weights come from" is now a due-diligence question in acquisitions and a compliance question in regulated industries.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A startup built its product on a model whose weights were public but licensed research-only, assuming "it\'s on Hugging Face, so it\'s fine." It surfaced in vendor review by their first enterprise customer, and the remediation — swapping the model, re-running evals, re-tuning prompts under deadline — cost a quarter. The fix costs nothing at selection time: read the LICENSE file before the README.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "What open model would you pick and why?" is really three questions: do you know the current families and their personalities, do you know license classes and who they bind, and do you date-stamp your knowledge ("as of early 2026...") instead of pretending the map is static. Naming the open-vs-proprietary lag trend and one concrete license trap clears the bar.</div>'
    },
    {
      id: 'llama-cpp-practice',
      title: 'llama.cpp in practice: GGUF, quant levels, offloading, server mode',
      blurb: 'The single most important tool in local inference — and Ollama as the UX layer on top of it.',
      html: '<h2>Why llama.cpp is everywhere</h2>' +
        '<p><b>llama.cpp</b> started in 2023 as a CPU port of Llama inference and became the substrate of the entire local-model world: a dependency-free C/C++ engine that runs on x86, Apple Silicon (Metal), NVIDIA (CUDA), AMD (ROCm/Vulkan), and phones. Its file format, <b>GGUF</b>, is a single self-contained file: weights (usually quantized), tokenizer, chat template, and metadata — no Python environment, no config sprawl. Download one file, run one binary. Hugging Face hosts GGUF conversions of essentially every open model within days of release (community quantizers like bartowski/unsloth are the de facto distribution channel).</p>' +
        '<h2>Reading quant names: K-quants and friends</h2>' +
        '<p>GGUF filenames encode the quantization scheme, and you will choose between them weekly, so learn to read them: <code>Q4_K_M</code> means ~4-bit, K-quant (block-wise scheme with super-blocks and per-block scales), Medium variant (some tensors kept at higher precision). The ladder, with an 8B model as the yardstick:</p>' +
        '<table><tr><th>Quant</th><th>~bits/weight</th><th>8B file size</th><th>Character</th></tr>' +
        '<tr><td>Q8_0</td><td>8.5</td><td>~8.5 GB</td><td>Indistinguishable from FP16 in practice; use when disk/VRAM allow</td></tr>' +
        '<tr><td>Q6_K</td><td>6.6</td><td>~6.6 GB</td><td>Near-lossless; a comfortable default when you have headroom</td></tr>' +
        '<tr><td><b>Q4_K_M</b></td><td>4.8</td><td>~4.9 GB</td><td><b>The community workhorse</b> — the accepted quality/size sweet spot; small but measurable degradation</td></tr>' +
        '<tr><td>Q4_K_S / Q3_K_M</td><td>4.5 / 3.9</td><td>~4.7 / 4.0 GB</td><td>Squeeze options; Q3 is where degradation stops being subtle</td></tr>' +
        '<tr><td>Q2_K / IQ2-class</td><td>~2.6–3.4</td><td>~3 GB</td><td>Desperation sizes — visible quality loss; i-quants (importance-weighted, calibrated with an imatrix) hold up better than legacy Q2 but this tier is for "barely fits" situations</td></tr></table>' +
        '<p>Two rules of thumb carry most decisions: <b>Q4_K_M unless you have a reason</b>, and <b>a bigger model at Q4 usually beats a smaller model at Q8</b> at equal memory (lesson 3). Remember from module 15 that quant level also sets decode speed — bytes per token — so Q4 is faster than Q8, not just smaller.</p>' +
        '<h2>Offloading: the speed cliff you control</h2>' +
        '<p>llama.cpp can split a model between GPU VRAM and system RAM with <code>--n-gpu-layers N</code> (<code>-ngl</code>): the first N layers live on GPU, the rest run on CPU. This is how a 24 GB card runs a 70B — but understand the physics before celebrating: decode speed is bandwidth-bound (module 15), and system DDR5 (~60–90 GB/s) has 10–30× less bandwidth than GPU VRAM. The layers on CPU become the bottleneck, and speed falls off a cliff roughly in proportion to the fraction offloaded. A 70B Q4 fully in VRAM on dual 3090s: ~15–20 tok/s. Same model with half its layers in system RAM: 1–3 tok/s. Fine for batch jobs; miserable for chat. Special case: <b>Apple Silicon\'s unified memory</b> dodges the split entirely — a 128 GB M-series Mac holds a 70B Q4 wholly in memory at ~250–400 GB/s bandwidth, which is exactly why Macs became the enthusiast local-inference platform. MoE models complicate the picture favorably: with <code>--n-cpu-moe</code>-style options you can keep the always-hot attention layers on GPU and park expert weights in RAM, and since only a fraction of experts fire per token, the penalty is far smaller than dense-offload math suggests.</p>' +
        '<h2>Server mode, and Ollama as the UX layer</h2>' +
        '<p><code>llama-server</code> turns the engine into an OpenAI-compatible HTTP endpoint (<code>/v1/chat/completions</code>) with parallel slots, continuous batching, and prefix caching — meaning every SDK, framework, and eval harness you already use points at localhost with a one-line base_url change. That API compatibility is the strategic fact: <b>your application code doesn\'t know or care that the model is local.</b></p>' +
        '<p><b>Ollama</b> wraps this workflow in product ergonomics: <code>ollama pull llama3.2</code> / <code>ollama run</code>, a model registry with sane default quants (typically Q4_K_M), automatic GPU-layer selection, model lifecycle management (load on demand, unload after idle), Modelfiles for packaging system prompts and params, and the same OpenAI-compatible API. The trade for the convenience: someone else chose your quant and default context length (historically conservative — check and raise <code>num_ctx</code>; a silently-truncated context is a classic Ollama footgun), and you\'re a version behind llama.cpp\'s newest flags. The division of labor is honest: Ollama for developer machines and quick evals; raw llama-server (or vLLM/SGLang on real GPUs — module 15) when you need control and concurrency.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> GGUF files are memory-mapped: the OS pages weights in on first touch rather than copying the file into RAM, so "loading" is near-instant and warm restarts are free. It also means the first pass over a cold model is disk-speed — benchmark <em>after</em> a warmup generation, or you\'re measuring your SSD, not your inference stack.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team benchmarked "Llama-70B locally" and reported it unusable at 0.8 tok/s. The culprit: default settings had loaded 20 of 80 layers on the GPU, silently — llama.cpp happily runs with any split and prints the layer allocation only in startup logs nobody read. One flag (<code>-ngl 999</code> after moving to a Q3 quant that fit) took them to 14 tok/s. Always read the startup log: it tells you the layer split, the KV allocation, and which backend each tensor landed on.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How would you run a 70B on a workstation with one 24 GB GPU?" — the strong answer walks the ladder: pick a quant that respects memory (Q4 ≈ 40 GB won\'t fit VRAM alone → partial offload with measured expectations, or an MoE with experts in RAM, or a Mac with unified memory, or accept an 8–32B dense model instead), and names the bandwidth cliff as the reason offloading isn\'t free. Bonus: mention that llama-server speaks the OpenAI dialect, so the app layer is unaffected by any of these choices.</div>'
    },
    {
      id: 'sizing',
      title: 'Choosing model size: capability tiers vs VRAM reality',
      blurb: 'What 3B, 8B, 32B, and 70B-class models can actually do — and the quantized-large vs full-small decision.',
      html: '<h2>The capability tiers, honestly stated</h2>' +
        '<p>Parameter count is a loose proxy for capability, but tier boundaries are real enough to plan around. As of early 2026, for <em>current-generation</em> open instruct models (each generation shifts every tier upward — 2026\'s 8B beats 2023\'s 70B on most tasks):</p>' +
        '<table><tr><th>Tier</th><th>Runs on (Q4)</th><th>Realistically handles</th><th>Where it breaks</th></tr>' +
        '<tr><td><b>1–3B</b></td><td>Phones, Raspberry Pi-class, any laptop (~1–2 GB)</td><td>Classification, routing, extraction with tight schemas, autocomplete, summarization of short texts, guardrail pre-filters</td><td>Multi-step reasoning, instruction stacks with 3+ constraints, anything requiring broad knowledge</td></tr>' +
        '<tr><td><b>7–9B</b></td><td>8 GB VRAM / 16 GB RAM laptop (~5 GB)</td><td>The workhorse tier: solid chat, RAG answering over provided context, structured extraction, code completion, single-tool agent steps, most fine-tune targets</td><td>Long-horizon agent loops, subtle multi-document synthesis, hard math/code; hallucinates long-tail facts confidently</td></tr>' +
        '<tr><td><b>14–34B</b></td><td>Single 24 GB card (~9–20 GB)</td><td>The sweet spot per dollar: near-frontier on many workaday tasks, competent multi-step agents, good coding (Qwen-Coder-class), reliable JSON at complex schemas</td><td>Frontier-grade reasoning depth, esoteric domains</td></tr>' +
        '<tr><td><b>70B-class dense / large MoE</b></td><td>2× 24 GB, one 48–80 GB card, or 64–128 GB Mac (~40+ GB)</td><td>Genuine frontier-adjacent quality; complex reasoning, nuanced writing, hard RAG synthesis, capable multi-step agents</td><td>Still trails the proprietary frontier on the hardest reasoning; serving cost/latency becomes API-competitive territory where the API often wins on price</td></tr></table>' +
        '<p>Two structural notes. First, <b>reasoning variants</b> (R1-distills and successors) let small models trade tokens for capability — a 14B reasoning model can beat a 70B standard model on math/logic while being far slower per answer (it thinks in tokens; module 21). Second, <b>MoE models</b> (large total, small active parameter count) break the VRAM-capability coupling: memory needs scale with <em>total</em> params, speed with <em>active</em> params — great when RAM is cheap and bandwidth dear.</p>' +
        '<h2>Quantized-large vs full-precision-small</h2>' +
        '<p>The recurring decision: you have a fixed memory budget — spend it on a big model at low precision or a small model at high precision? The empirical answer is consistent and slightly counterintuitive: <b>above ~4 bits, the bigger model wins.</b> A 70B at Q4 (~40 GB) beats an 8B at FP16 (~16 GB) on essentially everything; a 32B-Q4 (~19 GB) beats an 8B-Q8 (~8.5 GB) comfortably. Parameter count buys knowledge, reasoning depth, and robustness that precision cannot; quantization above 4 bits costs only a thin slice of quality (module 15\'s degradation profile). The rule flips <em>below</em> ~4 bits: a 70B at Q2 is lobotomized enough that a clean 32B-Q4/Q5 is usually the better spend — and small models are proportionally more damaged by aggressive quants than large ones, so never feed a 3B anything below Q4.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Size for the <em>task</em>, then buy capability with the leftover memory. The professional failure mode is prestige-sizing: running a 70B for ticket routing that a 3B does at 40× the speed, or — the mirror image — burning a week prompt-torturing an 8B into a task a 32B does on the first try. Let an eval set make the call: run it across tiers once and the answer is usually unambiguous.</div>' +
        '<h2>Don\'t forget the KV cache in the budget</h2>' +
        '<p>Module 15\'s math follows you here: VRAM must hold weights <em>plus</em> KV cache. An 8B-Q4 (~5 GB) on an 8 GB card looks roomy until a 32k context adds ~4 GB of FP16 KV and you\'re swapping. llama.cpp lets you quantize the KV cache too (<code>--cache-type-k q8_0</code> etc.) — worth it at long context, with module 15\'s caveat about long-range recall. Budget: <code>weights + (KV/token × max_ctx × parallel_slots) + ~1–2 GB overhead</code>, and set your context length to what you actually use, not the model\'s advertised maximum — a 128k window you never fill is VRAM reserved for nothing if you pre-allocate it.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team shipped an on-prem RAG appliance on 8B-class hardware after validating quality with a 70B in the cloud "temporarily." The 8B couldn\'t synthesize across retrieved chunks the way the 70B did; faithfulness scores dropped 12 points and the fix — better retrieval, tighter prompts, chunk reranking — took six weeks of engineering to claw back what a hardware tier would have bought for $3k. Validate on the hardware tier you\'ll ship, from day one.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "We have one 24 GB GPU — what model do you deploy?" is a sizing interview in miniature. Strong answer: ask what the task is first; then reason out loud — 32B-class Q4 (~19 GB) if the task needs depth and context is short, 14B-Q4 if you need KV headroom for long context or parallelism, 8B if latency dominates; cite quantized-large-beats-full-small above 4 bits; end with "and I\'d confirm with our eval set across two tiers." That last sentence is what separates senior from well-read.</div>'
    },
    {
      id: 'economics',
      title: 'Self-hosting economics: the honest spreadsheet',
      blurb: 'GPU rental vs API math, break-even volumes, the utilization lie, and when self-hosting actually wins.',
      html: '<h2>The two cost curves</h2>' +
        '<p>API pricing is <b>pure variable cost</b>: $/Mtok, zero at zero traffic, linear forever. Self-hosting is <b>step-fixed cost</b>: a GPU costs the same per hour at 0% and 100% utilization, and capacity comes in lumps (one more GPU, not one more token). The entire economic question is whether your <em>sustained</em> token volume prices the fixed capacity below the API\'s variable rate — plus whether any non-price driver (lesson 5\'s privacy/compliance, latency, fine-tune ownership) overrides the math entirely.</p>' +
        '<p>Worked numbers, date-stamped early 2026 (recompute with current prices before deciding anything): an 8B-class open model via serverless open-model APIs runs ~$0.10–0.30 blended per Mtok; frontier proprietary models ~$3–15 blended per Mtok. A rented A100-80GB is ~$1.30–1.80/hr (~$1,000–1,300/mo); an H100 ~$2–3/hr. A well-tuned vLLM on one A100 serves an 8B at (order of magnitude) 2,000–5,000 tok/s aggregate under continuous batching with realistic traffic.</p>' +
        '<pre><code>Self-host $/Mtok = (GPU $/hr) / (achieved tok/s × 3600 / 1e6)\n\nA100 @ $1.50/hr, 3000 tok/s sustained:  $1.50 / 10.8 Mtok/hr ≈ $0.14/Mtok\nSame box at 10% utilization:            ≈ $1.40/Mtok  (10× worse)\nSame box at 1% utilization:             ≈ $14/Mtok    (frontier-API money for an 8B)</code></pre>' +
        '<h2>The utilization lie</h2>' +
        '<p>Every self-hosting pitch deck assumes the 3,000-tok/s row; almost every real deployment lives far below it. Traffic is diurnal (nights and weekends idle), bursty (you provision for p95, pay for the gaps), and autoscaling GPU inference is genuinely hard — cold-starting a model server takes minutes (pull weights, load, warm), so you keep headroom running. Honest capacity planning multiplies the marketing throughput by a <b>utilization factor of 10–40%</b> for interactive workloads. Batch workloads are the exception — they can be queued to fill the troughs, which is why "we self-host the nightly pipeline, API for interactive" is such a common and correct hybrid. And the spreadsheet must include the line items pitch decks omit: an on-call engineer who understands CUDA OOMs and driver/kernel matrixes, eval re-runs on every model/quant/engine upgrade, capacity buffer, and the opportunity cost of that engineer not building product. A realistic loaded ops cost is a fraction of an SRE, not zero.</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Break-even sketch: at $0.20/Mtok API price for an 8B-class model, a $1,100/mo A100 needs ~5.5 <b>billion</b> tokens/month just to tie on raw compute — before ops salary. That\'s ~65 sustained requests/minute at ~3k tokens each, around the clock. If your volume is millions of tokens a month, the API is cheaper by two to three orders of magnitude. Serverless open-model APIs moved this goalpost hard: you can consume <em>open</em> models at API economics, which decouples "we want open weights" from "we must run GPUs."</div>' +
        '<h2>When self-hosting actually wins</h2>' +
        '<ul>' +
        '<li><b>Privacy/compliance mandates</b> — data cannot leave the boundary, period (lesson 5). The math is irrelevant; self-hosting is the requirement.</li>' +
        '<li><b>Custom fine-tunes at volume:</b> your tuned 8B replacing frontier-API calls is the strongest pure-economics case — you\'re comparing $0.14/Mtok self-host not against $0.20 open-API but against $5+ frontier pricing, and per-token adapters may not be servable anywhere else at par.</li>' +
        '<li><b>Sustained high volume with steady load</b> — the break-even math genuinely clears, usually batch/pipeline workloads (classification at firehose scale, embedding generation, synthetic data).</li>' +
        '<li><b>Latency/locality:</b> on-device or on-prem inference removes network round-trips and rate-limit coupling; edge products and airgapped sites have no alternative.</li>' +
        '<li><b>Rate-limit and deprecation sovereignty:</b> no provider can throttle, reprice, or sunset a model you hold the weights to — a real option-value argument for products with long support commitments.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team migrated from a frontier API to self-hosted 70B "to save money" on ~200M tokens/month. The GPU bill alone matched their old API bill; add the half-engineer of ops and they paid <em>more</em> for a worse model. Post-mortem math showed the correct moves were either a cheaper API tier (they didn\'t need frontier quality — an open-model API at $0.60/Mtok would have cut the bill 80%) or nothing. The lesson: the alternative to self-hosting isn\'t only the frontier API — price the open-model APIs before buying GPUs.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Should we self-host?" in an interview is a trap for cached answers in both directions. The senior move: ask for volume, load shape, and constraints; write the $/Mtok = GPU-rate ÷ throughput formula; apply an honest utilization factor; name the serverless-open-model middle path; and list the non-economic overrides (compliance, fine-tunes, latency, sovereignty). Concluding "at your volume, rent the API; revisit at 100×" is a perfectly strong answer.</div>'
    },
    {
      id: 'chat-templates',
      title: 'Chat templates: the silent quality killer',
      blurb: 'Wrong template = no error, no crash, just a mysteriously dumber model. The footgun and the checklist.',
      html: '<h2>What the model actually sees</h2>' +
        '<p>Module 1 established that chat is an illusion over next-token prediction; here is where the illusion is manufactured. During instruction tuning, every training conversation was rendered into one token stream using fixed special tokens — and the model learned the roles, the turn boundaries, and when to stop <em>in terms of exactly those tokens</em>. Three current dialects, same conversation:</p>' +
        '<pre><code>Llama 3:  &lt;|start_header_id|&gt;user&lt;|end_header_id|&gt;\\n\\nHello&lt;|eot_id|&gt;\n          &lt;|start_header_id|&gt;assistant&lt;|end_header_id|&gt;\\n\\n\nChatML:   &lt;|im_start|&gt;user\\nHello&lt;|im_end|&gt;\\n&lt;|im_start|&gt;assistant\\n   (Qwen &amp; many others)\nGemma:    &lt;start_of_turn&gt;user\\nHello&lt;end_of_turn&gt;\\n&lt;start_of_turn&gt;model\\n</code></pre>' +
        '<p>Feed a Llama-3 checkpoint a ChatML-formatted prompt and nothing errors — the mismatched markup tokenizes into ordinary tokens the model treats as weird user text. The failure is <b>graded, not binary</b>, which is what makes it vicious: the model still answers (it saw plenty of raw text in pretraining), just consistently worse — ignoring system prompts, rambling past turn boundaries, injecting <code>&lt;|im_end|&gt;</code> literals into output, failing to stop (the server\'s stop-token config no longer matches what the model emits). It reads like "this model is overhyped," not like a config bug. Entire negative model reviews on forums trace to template mismatches.</p>' +
        '<h2>Where mismatches sneak in</h2>' +
        '<ul>' +
        '<li><b>Hand-built prompt strings.</b> Anyone concatenating <code>"User: " + msg + "\\nAssistant:"</code> against a modern instruct model is running degraded. Always render through the template shipped with the checkpoint (<code>tokenizer.apply_chat_template</code> in Transformers; GGUF embeds it and llama-server\'s chat endpoint applies it).</li>' +
        '<li><b>Stale or wrong metadata.</b> GGUF conversions inherit the template from the source repo — early conversions of a new model, or fine-tunes whose authors forgot to update tokenizer configs, can ship the <em>wrong</em> template in the file. Symptom: a fine-tune that "lost" its training. Check with the server\'s startup log or metadata dump, and compare against the model card.</li>' +
        '<li><b>Framework defaults.</b> Some serving/UI layers fall back to a generic template (often ChatML) when they can\'t find one, silently. A model that suddenly got worse after an infra upgrade is a template regression until proven otherwise.</li>' +
        '<li><b>Fine-tuning/serving skew (module 14):</b> train with one rendering, serve with another — the fine-tune evaporates at deploy time. Training and inference must render byte-identically.</li>' +
        '<li><b>System-prompt handling differs:</b> some templates have no system role (older Gemma merged it into the first user turn) — a system prompt your code "sends" may be dropped or mangled by the template layer without a warning.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why is degradation graded rather than total? The special tokens are <em>single dedicated token IDs</em> the model was trained to treat as hard structure. Mis-rendered markup tokenizes as ordinary text: the model still recognizes conversational shape from pretraining (it read forums), so it limps along — but the instruct-tuning behaviors keyed to the real structural tokens (obey system, stop at turn end, role separation) never trigger cleanly. You get the base model\'s manners with the instruct model\'s voice. Stop-token mismatch is the loudest tell: generation "not stopping" almost always means the server is watching for a stop token the template never produces.</div>' +
        '<h2>The five-minute template audit</h2>' +
        '<p>Run this whenever you adopt a checkpoint, change engines, or ship a fine-tune: <b>(1)</b> dump the template the runtime is actually using (llama-server logs it at startup; Transformers: print <code>tokenizer.chat_template</code>; Ollama: <code>ollama show --template</code>); <b>(2)</b> render one two-turn conversation and <em>read the tokens</em> — right special tokens, system prompt present, generation prompt ends awaiting the assistant; <b>(3)</b> send "Reply with exactly: OK" through the full serving path and confirm it obeys and <em>stops</em>; <b>(4)</b> keep 10 template-sensitive smoke prompts (system-prompt obedience, multi-turn reference, stop behavior) in CI against every engine/model upgrade. Total cost: minutes. It catches the single most common self-inflicted quality bug in local inference.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team\'s eval dashboard showed their local Qwen deployment 9 points under the same model\'s published scores, and two engineers spent a sprint "tuning sampling parameters" to close the gap. The actual bug: their gateway wrapped requests in a legacy Llama-2 <code>[INST]</code> template before forwarding to llama-server, which then applied ChatML around it — nested templates, double markup. The give-away in hindsight: outputs occasionally contained stray <code>[/INST]</code> strings, which everyone had been filtering out as "model weirdness" instead of reading as evidence. If you ever find yourself regex-stripping template tokens from outputs, stop — that is the bug telling you where it lives.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "A locally-served open model underperforms its benchmarks — debug it." Template mismatch should be your <em>first</em> hypothesis, before sampling params, before quant level: it\'s the most common cause and the cheapest to check. Narrating the audit (dump template → render and read → stop-token check) demonstrates operational scar tissue that reading benchmarks never gives.</div>'
    },
    {
      id: 'private-data-compliance',
      title: 'The private-data and compliance drivers',
      blurb: 'When "the data cannot leave" decides the architecture before any benchmark or price sheet gets a vote.',
      html: '<h2>The decision that precedes all other decisions</h2>' +
        '<p>Every preceding lesson assumed you were <em>choosing</em> between local and API on merit. A large class of deployments doesn\'t get that choice: the data governance requirement decides first, and the engineering follows. If prompts contain PHI, privileged legal material, classified or export-controlled data, or trade secrets under strict handling agreements, then "which model is smarter" is question number four. Getting this ordering wrong in either direction is expensive: sending regulated data to an unapproved processor is a reportable incident; reflexively banning APIs where a compliant path existed burns quarters rebuilding what a contract would have covered.</p>' +
        '<p>Be precise about what the API risk actually is, because sloppy versions of this argument lose to any competent counterargument. "HTTPS means it\'s safe" misses the point entirely: encryption in transit was never the issue. The issues are <b>processing and residency</b> — a third party\'s infrastructure decrypts and processes your plaintext; logs and abuse-monitoring systems may retain fragments for days; the processing may occur in jurisdictions your regulator hasn\'t approved; and your enterprise agreements (customer DPAs, government contracts) may enumerate approved subprocessors — adding an LLM provider means amending contracts, not just architecture.</p>' +
        '<h2>The compliance spectrum — self-hosting is one point, not the only one</h2>' +
        '<table><tr><th>Option</th><th>What it gives you</th><th>What to verify</th></tr>' +
        '<tr><td><b>Provider enterprise terms</b> (zero-data-retention riders, no-training commitments, BAAs for HIPAA)</td><td>API convenience with contractual data handling; all major providers offer ZDR/no-training tiers and HIPAA BAAs as of early 2026</td><td>Whether ZDR is actually in <em>your</em> contract (defaults differ by tier), abuse-log carve-outs, subprocessor lists</td></tr>' +
        '<tr><td><b>Hyperscaler-hosted models</b> (cloud ML platforms serving frontier + open models inside your cloud account)</td><td>Model runs within an existing compliance boundary (region pinning, existing DPA/BAA umbrella, VPC controls) — often the pragmatic middle path for regulated enterprises</td><td>Region availability of the model you want; that "your cloud" language matches your auditor\'s reading</td></tr>' +
        '<tr><td><b>Self-hosted open weights (VPC or on-prem)</b></td><td>The strongest story: plaintext never crosses an org boundary; no subprocessor to disclose; survives the strictest data-residency and sovereignty regimes; works airgapped</td><td>That your own logging/telemetry doesn\'t become the leak (see below); that you can actually operate it (lesson 4\'s ops tax)</td></tr></table>' +
        '<p>The senior-engineer contribution to these conversations is mapping requirement → minimum sufficient control, rather than maximal reflexes in either direction. GDPR data-minimization worries might be satisfied by ZDR terms plus PII redaction at the gateway; a sovereign-cloud mandate or an airgapped network is self-host territory, full stop; a hospital system may run both — an on-prem 32B for anything touching clinical notes, an API with BAA for the marketing team.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Self-hosting moves trust, it doesn\'t create it. Weights in your VPC eliminate the third-party processor — and make <em>you</em> the processor, with none of a major provider\'s security team. A local deployment that dumps full prompts into debug logs shipped to a third-party observability SaaS has rebuilt the original problem with worse controls. The compliance win must be engineered end-to-end: prompt-redacting logging, retention windows on traces, access control on the inference tier — module 12\'s discipline, applied to your own stack.</div>' +
        '<h2>Adjacent drivers that ride the same decision</h2>' +
        '<ul>' +
        '<li><b>Data as moat:</b> some orgs refuse external processing not for regulation but strategy — prompts encode the product roadmap, the M&amp;A pipeline, the training-data crown jewels. Same architecture, different sponsor (the GC instead of the compliance officer).</li>' +
        '<li><b>Auditability and reproducibility:</b> regulated decisions (credit, insurance, medical triage support) increasingly need "reproduce the exact model behavior from date X." Pinned local weights make that trivial; API model updates and deprecations make it somewhere between hard and impossible. Weight custody is version control for model behavior.</li>' +
        '<li><b>The fine-tune ownership loop:</b> compliance-driven local data begets local fine-tunes (the training data can\'t leave either — module 14), which begets local serving (lesson 4\'s strongest economic case). The drivers compound: many "cost-motivated" self-hosting stories are actually compliance stories two steps removed.</li>' +
        '<li><b>Know your regime\'s vocabulary:</b> GDPR (processing, transfer mechanisms), HIPAA (BAA required before any PHI touches a processor), EU AI Act obligations phasing in through 2025–27, sector rules (FINRA/SEC retention, FedRAMP/ITAR for government work). You don\'t need to lawyer these — you need to recognize which one is in the room so you bring the right architecture options to the meeting.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A healthcare startup proudly self-hosted models for PHI — then wired their inference gateway\'s request logging, full prompt bodies included, into a cloud logging SaaS with 30-day retention and broad internal access. The pen-test report was unkind: they had every cost of self-hosting and none of the benefit, since PHI was leaving the boundary anyway — through the observability stack nobody had threat-modeled. The audit now traces <em>every copy</em> of prompt data: inference logs, traces, eval datasets, fine-tune corpora, crash dumps.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Client says data can\'t leave their environment — walk me through your options" is a staple architecture screen. Strong shape: clarify the actual requirement and regime (contractual? HIPAA? sovereignty?) → lay out the spectrum (enterprise/ZDR terms → hyperscaler-in-your-VPC → self-hosted weights) → pick minimum sufficient control → close with the end-to-end point: the boundary includes logs, traces, and eval data, not just the inference call. That last clause is what auditors — and good interviewers — are listening for.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your team picked a model whose weights are freely downloadable on Hugging Face and built a commercial product on it. Legal review discovers the license is research-only. What is the correct takeaway for next time?',
      options: [
        'Downloadable weights imply commercial rights — legal is being overcautious',
        '"Open weights" only means the checkpoint is public; the license defines permitted use, and license classes range from Apache-2.0/MIT (genuinely permissive) through conditional community licenses to research-only — read the LICENSE before the README, and log licenses in the model registry',
        'Only models from US companies can be used commercially',
        'The fix is to fine-tune the model, which creates a new work free of the original license'
      ],
      answer: [1],
      explanation: 'Open-weights ≠ open-source: availability and rights are separate axes, and research-only weights on public hubs are common. (A) is exactly the assumption that caused the incident. (C) is invented — jurisdiction doesn\'t determine license class; Apache-2.0 Qwen and MIT DeepSeek are counterexamples in one direction, research-only western releases in the other. (D) is dangerously wrong: fine-tunes and LoRAs are derivatives that inherit the base license terms.'
    },
    {
      text: 'A colleague argues you must use frontier proprietary APIs because "open models are years behind." Which correction reflects the early-2026 reality?',
      options: [
        'Open models surpassed proprietary frontier models across the board in 2025',
        'The lag has run roughly 6–12 months and narrowed through 2025 (DeepSeek-R1 mainstreaming open reasoning models was the proof point) — so "only the frontier API can do X" claims should be re-tested against current open models every quarter or two, task by task',
        'The gap is irrelevant because all models perform identically on production tasks',
        'Open models are only usable for research, not production'
      ],
      answer: [1],
      explanation: 'The durable planning fact is the lag and its trend, not any leaderboard snapshot: open weights track the frontier by months, and decisions cached from last year rot. (A) overcorrects — the proprietary frontier still led on the hardest reasoning as of early 2026. (C) is empirically false; tiers differ measurably (that\'s the whole sizing lesson). (D) confuses license classes with capability — Apache/MIT open models run in production at massive scale.'
    },
    {
      text: 'You need to serve a fine-tuned model commercially, and you\'re choosing a base. Which pairing of base-model license and obligation is stated CORRECTLY?',
      options: [
        'Apache-2.0 (e.g. most Qwen): commercial use and redistribution allowed, no naming obligations — the cleanest choice',
        'Llama Community License: no commercial use permitted at any scale',
        'MIT (e.g. DeepSeek): permits use but explicitly prohibits distillation',
        'Research-only licenses: production use allowed if you attribute the authors'
      ],
      answer: [0],
      explanation: '(A) is correct: Apache-2.0/MIT are genuinely permissive, which is why they\'re the clean product choice. (B) misstates Llama\'s terms — commercial use is allowed below a 700M-MAU threshold; the real obligations are the AUP and derivative naming/attribution ("Built with Llama"). (C) inverts DeepSeek\'s position — MIT is permissive and DeepSeek explicitly blessed distillation, which is why R1-distills proliferated. (D) is flatly wrong: research-only means no production use; attribution doesn\'t transform the grant.'
    },
    {
      text: 'You have a 24 GB GPU and want the best quality for a complex RAG-synthesis task with ~4k contexts. Per the quantized-large vs full-small evidence, which is the best first candidate?',
      options: [
        'An 8B model at FP16 (~16 GB) — full precision preserves the most capability',
        'A 32B-class model at Q4_K_M (~19 GB) — above ~4 bits, the larger model\'s knowledge and reasoning depth beat the precision advantage of a smaller model, and the remaining ~5 GB covers KV at 4k contexts',
        'A 70B model at Q2 (~25 GB with cache) — maximum parameters always win',
        'A 3B model at Q8 to maximize speed'
      ],
      answer: [1],
      explanation: 'The empirical rule: at equal memory, bigger-at-Q4 beats smaller-at-high-precision — 32B-Q4 comfortably outperforms 8B-FP16 on synthesis depth. (A) spends 16 GB buying precision that purchases almost nothing above 4-bit. (C) breaks the rule\'s boundary twice: below ~4 bits degradation is severe (Q2 lobotomy), and it doesn\'t even fit 24 GB with KV. (D) optimizes the wrong axis — the task is quality-bound, and 3B-class models break down on multi-document synthesis.'
    },
    {
      text: 'A teammate runs a 70B Q4 GGUF on a 24 GB GPU with default llama.cpp settings and reports "70B models are unusable — 1 tok/s." What most likely happened, and what should they check first?',
      options: [
        'The model file is corrupted; re-download it',
        'Only a fraction of layers fit in VRAM, so most run from system RAM whose 10–30× lower bandwidth throttles bandwidth-bound decode — read the startup log\'s layer-split line and either accept partial-offload speed, use a smaller/MoE model, or change hardware',
        '70B models genuinely cannot exceed 1 tok/s on any single-GPU system',
        'The chat template is wrong, which slows generation'
      ],
      answer: [1],
      explanation: 'A ~40 GB model on a 24 GB card means half-plus layers on CPU; decode speed collapses proportionally because system DDR bandwidth is the bottleneck — the offloading speed cliff, printed plainly in the startup log nobody reads. (A) corruption fails loudly, it doesn\'t run slowly. (C) is falsified by e.g. unified-memory Macs and dual-GPU rigs hitting 15–20 tok/s. (D) template mismatch degrades quality and stop behavior, not tokens-per-second — different footgun, different lesson.'
    },
    {
      text: 'Which TWO statements about GGUF quant levels reflect the working consensus as of early 2026?',
      options: [
        'Q4_K_M is the community default sweet spot — small measurable degradation, roughly 4.8 bits/weight',
        'Q8_0 outputs are dramatically better than Q6_K for most models and worth double the memory of Q4',
        'Below roughly 4 bits (Q3/Q2 tiers), degradation steepens sharply, and small models suffer proportionally more than large ones',
        'Quant level affects only file size, never generation speed',
        'i-quants (importance-weighted) are always worse than legacy K-quants at the same bit budget'
      ],
      answer: [0, 2],
      multi: true,
      explanation: '(A) and (C) are the two rules that carry most quant decisions: Q4_K_M as default, and the sub-4-bit cliff that hits small models hardest. (B) overstates — Q8_0 vs Q6_K differences are usually marginal; neither justifies "dramatically better." (D) misses module 15\'s physics: decode speed ≈ bandwidth ÷ bytes, so lower-bit quants generate faster, not just smaller. (E) is backwards — imatrix-calibrated i-quants generally hold up better than legacy quants at aggressive bit budgets, which is their reason to exist.'
    },
    {
      text: 'Your product does high-volume ticket routing into 12 categories with a strict JSON schema. An engineer proposes the same 70B used by your chat feature "for consistency." What does task-based sizing say?',
      options: [
        'Agree — always use the largest available model for maximum accuracy',
        'Routing/classification with tight schemas is squarely 1–8B-tier work; a small model does it at a fraction of the latency and cost, and an eval set comparing tiers will likely show negligible accuracy difference — reserve the 70B for tasks that need its depth',
        'Use the 70B but at Q2 quantization so it costs the same as a small model',
        'Split every ticket across both models and average the answers'
      ],
      answer: [1],
      explanation: 'Prestige-sizing is the named failure mode: constrained classification doesn\'t exercise what 70B parameters buy, and the tier table puts schema-tight extraction/routing in the small-model band — with the eval set as arbiter, not vibes. (A) ignores that capability beyond task requirements is pure cost. (C) misuses quantization: Q2 lobotomizes the 70B (worst of both worlds) and still streams more bytes than an 8B-Q4. (D) doubles cost for a task one small model handles, and "averaging" JSON category outputs isn\'t even well-defined.'
    },
    {
      text: 'You serve an 8B-Q4 (~5 GB) on an 8 GB GPU. Short-context tests are fine, but with 32k-token contexts the server slows to a crawl or OOMs. What did the capacity plan miss?',
      options: [
        'The KV cache: at ~128 KB/token FP16 (GQA 8B), 32k tokens adds ~4 GB on top of the 5 GB weights — blowing the budget; fixes include KV quantization, capping context to actual usage, or a smaller model',
        'Q4 quantization is unstable at long contexts and must be Q8',
        'The GPU driver limits context length and needs an update',
        '8B models architecturally cannot process 32k tokens'
      ],
      answer: [0],
      explanation: 'Weights-only VRAM budgeting is the classic sizing error — module 15\'s formula (2·layers·kv_heads·head_dim·dtype) gives ~128 KB/token, so long contexts rival the model itself; llama.cpp\'s cache-type flags, honest context caps, or a smaller model close the gap. (B) invents a failure mode — weight quant level and context stability are unrelated. (C) drivers don\'t meter context length. (D) is false; modern 8B-class models support 32k+ — the constraint here is memory, not architecture.'
    },
    {
      text: 'Your API bill for an 8B-class open model via a serverless provider is $180/month (~600M tokens at ~$0.30/Mtok blended). An engineer proposes renting an A100 (~$1,100/month) to "cut costs," projecting 3,000 tok/s throughput. What does the honest math say?',
      options: [
        'Self-hosting wins — GPUs are always cheaper than APIs at any volume',
        'At 600M tokens/month the A100 costs ~6× more before ops labor; the box only ties the API around ~3.7B tokens/month at genuinely sustained utilization — and interactive traffic realistically achieves 10–40% utilization, pushing break-even further out. Stay on the API; revisit at order-of-magnitude higher volume',
        'Self-hosting wins because achieved throughput will exceed the marketing number',
        'The comparison is impossible without knowing the model\'s parameter count'
      ],
      answer: [1],
      explanation: 'Run the formula: $1,100/mo needs ~3.7B tokens to match $0.30/Mtok on raw compute (1100/0.30 ≈ 3,667 Mtok), 6× this workload — before adding the on-call ops fraction, and before the utilization lie (diurnal, bursty traffic idles the fixed-cost box). (A) is the cached answer the math refutes at low volume. (C) inverts reality — real deployments achieve less than benchmark throughput, not more. (D) is a dodge; the parameter count is embedded in both the API price and the throughput estimate already given.'
    },
    {
      text: 'Which THREE scenarios are genuine cases where self-hosting open weights beats using an API, per the economics and compliance lessons?',
      options: [
        'An airgapped defense facility where no external network calls are permitted',
        'A tuned 8B handling 5B+ tokens/month of steady batch traffic, replacing what would otherwise be frontier-API calls',
        'A three-person startup serving 2M tokens/month of chat traffic that wants to "own its stack"',
        'A product whose contracts require reproducing exact model behavior years later, needing pinned weights immune to provider deprecation',
        'Any team that finds GPU marketing throughput numbers exceed their API costs on paper'
      ],
      answer: [0, 1, 3],
      multi: true,
      explanation: '(A) is the absolute case — no network means no API, math irrelevant. (B) is the strongest economic case: high sustained volume (batch fills utilization troughs) plus a fine-tune whose alternative cost is frontier pricing. (D) is the sovereignty/auditability driver — weight custody is version control for behavior; APIs deprecate on their schedule. (C) is the anti-pattern: at 2M tokens/month the API costs pocket change while a GPU plus ops burns orders of magnitude more — "owning the stack" is aesthetics, not engineering. (E) names the utilization lie: paper throughput at 100% duty cycle is the number real deployments miss by 3–10×.'
    },
    {
      text: 'A locally-served instruct model answers but rambles past turn boundaries, ignores the system prompt, and occasionally emits literal strings like &lt;|im_end|&gt;. Benchmarks for this model are far better than what you observe. First hypothesis?',
      options: [
        'The model needs lower temperature',
        'Chat-template mismatch: the serving path is rendering conversations with the wrong dialect, so the structural tokens the instruct-tuning keyed on never appear (and the stop token the server watches for never matches) — dump the runtime\'s actual template, render one conversation, and read the tokens',
        'The quantization is too aggressive and destroyed instruction-following',
        'The model card benchmarks were fabricated'
      ],
      answer: [1],
      explanation: 'Leaked template literals in output plus ignored system prompts plus non-stopping generation is the textbook template-mismatch triad — graded degradation with no error thrown, and the single most common self-inflicted local-inference bug, hence first hypothesis. (A) temperature affects variance, not role structure or stop behavior. (C) quant damage looks like knowledge/reasoning slippage (module 15), not structural token leakage. (D) is a last resort after config hypotheses — and the specific symptoms here point squarely at rendering, not capability.'
    },
    {
      text: 'After migrating from raw llama-server to a new gateway, your fine-tuned model seems to have "lost" its training — generic outputs, format drift. Training-time evals had been excellent. What is the most likely cause?',
      options: [
        'Fine-tunes decay over time and must be retrained monthly',
        'Template skew: the gateway renders conversations differently from how training data was rendered (or falls back to a generic template), so the exact token structure the fine-tune learned never appears at inference — verify training and serving render byte-identically',
        'The gateway strips the LoRA adapter from requests',
        'The base model auto-updated underneath the fine-tune'
      ],
      answer: [1],
      explanation: 'Fine-tunes are welded to their training-time rendering (module 14); serving through a layer that re-renders — or silently falls back to ChatML when it can\'t find a template — makes the tuned behavior unreachable while everything still "works." (A) weights are static files; they don\'t decay. (C) adapters live server-side in the serving stack, not in requests — a category confusion. (D) local weights don\'t auto-update; that\'s an API-model failure mode, and avoiding it is one of the reasons to hold weights (pinning/reproducibility).'
    },
    {
      text: 'A hospital wants LLM-assisted summarization of clinical notes (PHI). The CTO says "the API uses HTTPS, so it\'s compliant." What is the correct framing?',
      options: [
        'HTTPS is sufficient — encrypted transport satisfies HIPAA',
        'Transport encryption was never the issue: a third party processing plaintext PHI requires (at minimum) a BAA and appropriate retention/no-training terms — the option spectrum runs from provider enterprise/ZDR+BAA terms, through hyperscaler models inside the hospital\'s existing cloud compliance boundary, to self-hosted weights; pick the minimum sufficient control, and audit the whole data path including logs and traces',
        'PHI can never touch any LLM under any arrangement',
        'Self-hosting is automatically compliant with no further work'
      ],
      answer: [1],
      explanation: 'The API risk is processing and residency, not transport — HIPAA requires a BAA before PHI touches a processor, and mainstream providers do offer BAAs/ZDR tiers, making the API potentially viable with the right contract; the spectrum framing plus end-to-end data-path audit is the senior answer. (A) is the sloppy argument that loses in audit. (C) overcorrects into reflexive prohibition — compliant arrangements exist at several points on the spectrum. (D) misses the lesson\'s sting: self-hosting makes you the processor, and PHI leaking through your own observability stack rebuilds the problem with worse controls.'
    },
    {
      text: 'Your compliance-driven on-prem deployment is set. Now the team wants usage analytics and debugging, proposing full prompt/response logging to a third-party cloud observability service. What is wrong?',
      options: [
        'Nothing — observability data is exempt from data-handling requirements',
        'The logs ARE the data: shipping full prompts off-prem reintroduces exactly the third-party processing and retention the architecture existed to prevent — use redacted/structured logging, keep raw traces inside the boundary with retention windows, and treat every copy (logs, traces, eval sets, fine-tune corpora) as in scope',
        'Third-party logging is fine as long as the LLM itself stays on-prem',
        'The fix is to log only responses, since prompts alone are not sensitive'
      ],
      answer: [1],
      explanation: 'Self-hosting moves trust rather than creating it, and the boundary must hold end-to-end — the healthcare-startup gotcha in this module was precisely PHI exfiltrating via the logging SaaS nobody threat-modeled. (A) inverts reality: logs containing prompts are the sensitive data, with none of the inference tier\'s controls. (C) draws the boundary around the model instead of the data — the model was never the thing regulators care about. (D) is confused in both directions: prompts typically carry the sensitive input, and responses about that input are derivative of it; neither is safely exempt.'
    }
  ],
  flashcards: [
    { id: 'fc-families', front: 'The five open-model families to know as of early 2026, one hook each?', back: '<b>Llama</b> (ecosystem default, community license), <b>Qwen</b> (size coverage + cadence, mostly Apache-2.0), <b>DeepSeek</b> (MoE efficiency + R1 reasoning, MIT), <b>Mistral</b> (efficient dense/MoE, mixed licensing, EU flag), <b>Gemma</b> (Gemini-distilled small models, custom terms).' },
    { id: 'fc-open-weights', front: 'Open weights vs open source — the distinction?', back: 'Open weights = checkpoint downloadable; the license still governs use. Almost nothing meets the OSI open-source bar (no field-of-use limits, study/modify freedoms, arguably data/recipe). Read the LICENSE, not the marketing.' },
    { id: 'fc-license-classes', front: 'The four license classes and one example each?', back: 'Apache-2.0/MIT — genuinely permissive (Qwen, DeepSeek). Community-conditional — Llama (700M-MAU cutoff, AUP, "Built with Llama" naming). Custom terms — Gemma (updatable prohibited-use policy). Research-only — no production, ever.' },
    { id: 'fc-lag', front: 'The durable planning fact about open vs proprietary capability?', back: 'Open weights have tracked the proprietary frontier by roughly <b>6–12 months</b>, narrowing through 2025 (R1 as proof point). Consequence: re-test every "only the frontier API can do this" decision each quarter.' },
    { id: 'fc-derivative-license', front: 'Does your LoRA/fine-tune escape the base model\'s license?', back: '<b>No.</b> Fine-tunes and adapters are derivatives inheriting base terms (Llama naming clauses included); distills may also inherit the teacher\'s API terms. Log the license of every base in the model registry.' },
    { id: 'fc-gguf', front: 'What is GGUF and why did it win local inference?', back: 'llama.cpp\'s single-file format: quantized weights + tokenizer + chat template + metadata, memory-mapped (near-instant load). One file, one binary, no Python — with community quants on HF within days of any release.' },
    { id: 'fc-quant-ladder', front: 'GGUF quant ladder for an 8B: name the tiers and the default.', back: 'Q8_0 ~8.5 GB (≈FP16) → Q6_K ~6.6 (near-lossless) → <b>Q4_K_M ~4.9 (the default sweet spot)</b> → Q3 tier (degradation stops being subtle) → Q2/IQ2 ~3 GB (desperation; i-quants degrade more gracefully). Lower bits also = faster decode.' },
    { id: 'fc-offload-cliff', front: 'What happens when llama.cpp offloads layers to CPU (-ngl)?', back: 'CPU-resident layers run at system-RAM bandwidth (10–30× below VRAM) and bandwidth-bound decode collapses proportionally: 70B fully-GPU ~15–20 tok/s vs ~1–3 half-offloaded. Exceptions: Apple unified memory (no split), MoE with experts-in-RAM (only active experts pay).' },
    { id: 'fc-ollama', front: 'Ollama vs llama.cpp — the division of labor?', back: 'Ollama = UX layer on llama.cpp: pull/run registry, default quants (Q4_K_M), auto GPU layers, lifecycle mgmt, OpenAI-compatible API. Cost: someone else\'s defaults (check num_ctx!) and version lag. Dev machines → Ollama; control/concurrency → llama-server or vLLM/SGLang.' },
    { id: 'fc-openai-compat', front: 'Why does local serving barely touch your application code?', back: 'llama-server, Ollama, vLLM, SGLang all expose the OpenAI API dialect — swap base_url and the app doesn\'t know the model moved. Consequence: bake-offs between local and API backends are cheap; exploit that constantly.' },
    { id: 'fc-tiers', front: 'Capability tiers: what do 1–3B / 7–9B / 14–34B / 70B-class realistically own?', back: '1–3B: classification, routing, tight-schema extraction, guardrails. 7–9B: workhorse chat/RAG/extraction/code-complete, fine-tune target. 14–34B: per-dollar sweet spot — multi-step agents, complex JSON, strong coding. 70B+: frontier-adjacent reasoning/synthesis — but check API pricing before serving it yourself.' },
    { id: 'fc-quant-vs-size', front: 'Fixed memory budget: big model quantized or small model full-precision?', back: '<b>Above ~4 bits, bigger wins:</b> 70B-Q4 &gt; 8B-FP16; 32B-Q4 &gt; 8B-Q8. Params buy knowledge/depth that precision can\'t. Flips below ~4 bits (Q2 lobotomy), and small models bruise more from aggressive quants — never sub-Q4 a 3B.' },
    { id: 'fc-vram-budget', front: 'The local VRAM budget formula?', back: '<b>weights + (KV/token × max_ctx × parallel slots) + 1–2 GB overhead.</b> KV/token = 2·layers·kv_heads·head_dim·dtype (module 15) — ~128 KB for an 8B, so 32k ctx ≈ +4 GB. Set context to actual usage, consider KV quantization (cache-type flags).' },
    { id: 'fc-selfhost-math', front: 'The self-hosting cost formula and the utilization lie?', back: '$/Mtok = GPU $/hr ÷ (achieved tok/s × 3600 / 1e6). A100 @$1.50 at 3k tok/s ≈ $0.14/Mtok — but at 10% utilization ≈ $1.40. Interactive traffic realistically achieves 10–40% of marketing throughput; batch work can fill troughs. Add ops labor before comparing.' },
    { id: 'fc-breakeven', front: 'Ballpark break-even vs a $0.20/Mtok open-model API for a ~$1,100/mo GPU?', back: '~5.5 <b>billion</b> tokens/month sustained, before ops salary. Millions of tokens/month → API wins by 100–1000×. Serverless open-model APIs decoupled "want open weights" from "must run GPUs" — price them before buying hardware.' },
    { id: 'fc-selfhost-wins', front: 'The five legitimate self-hosting wins?', back: '1) Compliance/airgap (math irrelevant) · 2) custom fine-tunes at volume (vs frontier pricing) · 3) sustained high-volume batch (fills utilization) · 4) latency/edge/on-device · 5) sovereignty — no throttling, repricing, or deprecation of weights you hold.' },
    { id: 'fc-template-symptoms', front: 'Symptom triad of a chat-template mismatch?', back: 'Ignores system prompt + rambles past turn boundaries/never stops + literal template tokens (&lt;|im_end|&gt;, [/INST]) leaking into output. Graded degradation, zero errors — reads as "model is overhyped." If you\'re regex-stripping template tokens, the bug is telling you where it lives.' },
    { id: 'fc-template-audit', front: 'The five-minute template audit?', back: '1) Dump the template the runtime actually uses (server startup log / tokenizer.chat_template / ollama show --template) · 2) render a 2-turn conversation and read the special tokens · 3) "Reply with exactly: OK" through the full path — obeys and <em>stops</em> · 4) keep 10 template smoke prompts in CI for every engine/model upgrade.' },
    { id: 'fc-compliance-spectrum', front: 'The compliance option spectrum for sensitive data?', back: 'Provider enterprise terms (ZDR, no-training, HIPAA BAA) → hyperscaler-hosted models inside your existing cloud boundary → self-hosted weights (VPC/on-prem/airgap). Pick the <b>minimum sufficient control</b> for the actual regime — not the reflex in either direction.' },
    { id: 'fc-trust-moved', front: 'Why isn\'t self-hosting automatically the compliance win?', back: 'It moves trust — you become the processor. Full-prompt logs shipped to a cloud observability SaaS rebuild third-party processing with worse controls. Audit every copy of prompt data: logs, traces, eval sets, fine-tune corpora, crash dumps.' },
    { id: 'fc-weight-custody', front: 'The auditability argument for holding weights?', back: 'Pinned local weights = reproduce exact model behavior from any date — version control for behavior. API models update and deprecate on the provider\'s schedule, making "replay the decision from last March" somewhere between hard and impossible. Regulated decisions increasingly require it.' }
  ],
  lab: {
    title: 'Local vs API bake-off: run an open model and grade it honestly',
    intro: '<p>You will stand up a local open model (Ollama for speed, with the llama.cpp layer visible underneath), verify its chat template, benchmark tokens/sec, then run a blind quality bake-off against an API model on your own prompts — the exact evaluation you\'d run before any local-vs-API decision at work.</p><p><b>Needs:</b> <code>python3</code>, ~8 GB RAM (any laptop works — CPU is fine, a GPU or Apple Silicon is nicer), one API key for any OpenAI-compatible provider, ~$0.10 worst case.</p>',
    steps: [
      {
        title: 'Install and run a local model',
        html: '<pre><code># install Ollama (macOS/Linux; Windows installer on the site)\ncurl -fsSL https://ollama.com/install.sh | sh\n\nollama pull llama3.2        # 3B, ~2 GB download, Q4_K_M by default\nollama pull qwen2.5:7b      # 7B if you have ~8 GB free memory\nollama run llama3.2 "Explain what a chat template is in two sentences."</code></pre>' +
          '<p>While it generates, note the machinery from the lessons: Ollama picked the quant (Q4_K_M), the GPU/CPU layer split, and a default context length for you. Inspect its choices:</p>' +
          '<pre><code>ollama show llama3.2            # params, quant, context length\nollama show --template llama3.2 # THE chat template — read it\nollama ps                       # after a run: how much is on GPU vs CPU</code></pre>' +
          '<p>That template dump is lesson 5 made tangible — you now know exactly what markup your model expects, and where to look first when a local model inexplicably underperforms.</p>'
      },
      {
        title: 'Benchmark it: tokens/sec and the size ladder',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json, time, urllib.request\n\ndef bench(model, prompt="Write a 300-word explanation of TCP slow start."):\n    body = json.dumps({"model": model, "prompt": prompt, "stream": False,\n                       "options": {"num_predict": 400}}).encode()\n    t0 = time.time()\n    r = json.load(urllib.request.urlopen(urllib.request.Request(\n        "http://localhost:11434/api/generate", body, {"Content-Type": "application/json"})))\n    wall = time.time() - t0\n    ev, ed = r["eval_count"], r["eval_duration"]/1e9\n    pv, pd = r.get("prompt_eval_count", 0), r.get("prompt_eval_duration", 0)/1e9\n    print(f"{model:14s} prefill {pv/pd if pd else 0:7.0f} tok/s | decode {ev/ed:6.1f} tok/s | wall {wall:5.1f}s")\n\nfor m in ("llama3.2", "qwen2.5:7b"):\n    bench(m)  # run twice; first pass includes model load\n    bench(m)\nEOF</code></pre>' +
          '<p>Three things to verify against modules 15–16: prefill tok/s should dwarf decode tok/s (compute-bound vs bandwidth-bound); the 7B should decode roughly proportionally slower than the 3B (more bytes per token); and the second run of each should beat the first (memory-mapped warm load). Write your decode numbers down — they feed the economics step.</p>'
      },
      {
        title: 'The blind bake-off: local vs API on YOUR prompts',
        html: '<p>Write 8–10 prompts that resemble your real work — a code review ask, a RAG-style "answer from this context" with a pasted paragraph, a strict-JSON extraction, a reasoning question, an edge-case refusal. Then collect answers from both sides through the same OpenAI-compatible interface:</p>' +
          '<pre><code>pip install openai\npython3 - &lt;&lt;\'EOF\'\nimport json, random\nfrom openai import OpenAI\n\nlocal = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")\ncloud = OpenAI()  # set OPENAI_API_KEY, or point base_url at any provider\n\nprompts = [\n    "Extract {name, severity, component} as JSON from: \'Login page throws 500 after the 2.3.1 deploy, affects all SSO users\'",\n    "Here is a paragraph: &lt;paste something from your own docs&gt;. Answer strictly from it: &lt;your question&gt;",\n    "Review this function for bugs: def retry(f, n): [f() for _ in range(n)]",\n    # ... add 5-7 more from your actual work\n]\n\nout = []\nfor p in prompts:\n    a = local.chat.completions.create(model="qwen2.5:7b",\n        messages=[{"role": "user", "content": p}]).choices[0].message.content\n    b = cloud.chat.completions.create(model="gpt-4o-mini",\n        messages=[{"role": "user", "content": p}]).choices[0].message.content\n    pair = [("LOCAL", a), ("API", b)]; random.shuffle(pair)\n    out.append({"prompt": p, "A": pair[0], "B": pair[1]})\njson.dump(out, open("bakeoff.json", "w"), indent=2)\nprint("wrote bakeoff.json - grade A vs B per prompt WITHOUT peeking at labels")\nEOF</code></pre>' +
          '<p>Grade each pair A-vs-B <em>before</em> looking at which is which (the labels are inside the shuffled tuples — resist). Blind grading matters: knowing which answer is the 7B measurably biases judgment, the same halo effect that corrupts sighted evals at work (module 11). Tally wins per category.</p>'
      },
      {
        title: 'Read the results like an engineer, then price them',
        html: '<p>Typical early-2026 pattern for a 7B-Q4 vs a budget frontier API model: near-parity on extraction, summarization, and answer-from-context; visible gaps on multi-step reasoning, subtle code bugs, and long-tail knowledge — map your tally onto the module\'s capability tiers and note <em>which of your categories</em> the local model already owns. Then price the split architecture your results suggest:</p>' +
          '<pre><code>python3 - &lt;&lt;\'EOF\'\nmonthly_tokens_mtok = 50        # your workload, Mtok/month\napi_price = 0.30                 # $/Mtok blended, open-model API class\ndecode_tps = 25                  # YOUR measured local decode speed\ngpu_hr = 0.40                    # rented 4090-class, early 2026\n\napi = monthly_tokens_mtok * api_price\nhrs = monthly_tokens_mtok * 1e6 / decode_tps / 3600\nprint(f"API: ${api:.0f}/mo | naive self-host: {hrs:.0f} GPU-hrs = ${hrs*gpu_hr:.0f}/mo"\n      f" at 100% utilization -- now divide utilization by 5 and add ops time")\nEOF</code></pre>' +
          '<p>For most personal/team workloads the API side wins on price and the local side wins on privacy and control — which is the honest, boring, correct conclusion of the module. The valuable artifact is your <code>bakeoff.json</code>: re-run it against next quarter\'s open models and watch the capability lag close on your own tasks.</p>'
      },
      {
        title: 'Cleanup',
        html: '<pre><code>ollama list                 # see what you downloaded and sizes\nollama rm llama3.2 qwen2.5:7b   # reclaim ~6-7 GB when done\n# or keep them - a local model you can poke is worth the disk</code></pre>' +
          '<p>No cloud resources were created. If you pointed the cloud client at a paid provider, total spend for ~10 short prompts on a mini-class model is around a cent.</p>'
      }
    ],
    costNote: 'Worst case ~$0.10: the API side of the bake-off (~10 prompts on a mini-class model) costs about a cent; everything local is $0. Cleanup: <code>ollama rm</code> the pulled models to reclaim ~6–7 GB of disk; no cloud resources or persistent services to tear down (Ollama\'s daemon unloads idle models automatically).'
  }
});
