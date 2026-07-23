COURSE.register({
  id: 'm02-tokens-sampling',
  track: 'core',
  order: 2,
  title: 'Tokens & sampling',
  short: 'Tokens & sampling',
  tagline: 'BPE, the weird failures tokenization causes, and what temperature/top-p actually do to the distribution.',
  minutes: 95,
  lessons: [
    {
      id: 'bpe',
      title: 'BPE: how text becomes tokens',
      blurb: 'The compression algorithm underneath every price sheet and context limit.',
      html: '<h2>The algorithm in 60 seconds</h2>' +
        '<p>Byte-Pair Encoding starts from raw bytes (256 base tokens) and greedily merges the most frequent adjacent pair in the training corpus into a new token, repeating until the vocabulary hits its target size (GPT-4o\'s o200k_base: ~200k; Llama 3: 128k; older cl100k_base: ~100k). The result is a learned compression dictionary: frequent strings ("the", " function", "ing") become single tokens; rare strings shatter into pieces.</p>' +
        '<p>Practical yardsticks for English prose: <b>1 token ≈ 4 characters ≈ 0.75 words</b>; 1,000 words ≈ 1,300–1,500 tokens. Code is less predictable — heavy indentation and repeated keywords compress well; minified JS and hashes explode. Non-Latin scripts pay a real tax with English-centric vocabularies: Thai/Hindi/Khmer text can cost 2–5× the tokens of equivalent English, i.e. 2–5× the price and context usage — a genuine product-economics issue for multilingual apps.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Vocabularies are trained once, on a corpus snapshot, then frozen. Merge tables encode corpus frequency, not linguistics: " the" (leading space) and "the" are different tokens; "Hello" at sentence start and "hello" mid-sentence tokenize differently. Whitespace is part of tokens, which is why trailing spaces in prompts can measurably change completions.</div>' +
        '<h2>Why not characters or words?</h2>' +
        '<p>Characters make sequences ~4× longer — attention is O(n²), so that\'s ~16× the attention compute for the same text, plus longer-range dependencies to learn. Whole words can\'t handle novel strings (typos, code identifiers, "Kubernetesification") without an unknown-token escape hatch. BPE is the engineering compromise: open-vocabulary like characters, compact like words. Its costs are the subject of the next lesson.</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Everything is denominated in tokens: pricing ($/Mtok), context windows (128k–200k typical, 1M+ in some tiers as of early 2026), rate limits (TPM), latency (tokens/sec). If you cannot estimate token counts for your traffic within ±20%, you cannot estimate your COGS. Use the provider tokenizer (<code>tiktoken</code>, <code>tokenizers</code>) in CI to track prompt sizes — counts differ between vendors\' tokenizers by 10–30% on the same text.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Why do LLMs use subword tokenization?" — answer with the character/word trade-off and the O(n²) attention argument. Follow-up is usually a failure mode (next lesson): have the strawberry-counting or arithmetic example loaded.</div>'
    },
    {
      id: 'token-failures',
      title: 'Weird failures caused by tokenization',
      blurb: 'Strawberry, arithmetic, string reversal — diagnosing the class of bug that lives below the model.',
      html: '<h2>The model never sees letters</h2>' +
        '<p>The model receives token IDs — opaque integers. "strawberry" arriving as <code>[straw][berry]</code> means counting its r\'s requires recalling the spelling of two tokens from training data, not reading characters. A whole genre of "LLMs are dumb" screenshots is this one implementation detail:</p>' +
        '<ul>' +
        '<li><b>Character tasks:</b> counting letters, reversing strings, acrostics, rhyme precision — all handicapped. Fix: don\'t use a token model for character work; have it write code (<code>len()</code>, <code>[::-1]</code>) or space out the letters (s t r a w b e r r y → one token per letter).</li>' +
        '<li><b>Arithmetic:</b> numbers tokenize inconsistently (modern tokenizers chunk digits in groups of up to three: 1234567 → <code>[123][456][7]</code>). Digit alignment for carrying is invisible. Fix: calculator/code tools, never mental math in production.</li>' +
        '<li><b>Rare identifiers:</b> UUIDs, hashes, obscure package names shatter into many tokens, each carrying little signal — one reason exact-string recall and matching is unreliable (and why vector search whiffs on part numbers, module 6).</li>' +
        '<li><b>Cross-tokenizer counting:</b> your "500-token budget" measured with tiktoken is a different number in Llama or Gemini tokens. Budgets must be per-tokenizer.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team enforced "≤ 280 characters" by prompting the model to count characters. It can\'t — it sees tokens. Outputs drifted 10–20% over the limit, truncation mid-sentence in prod, angry tickets. The rule: <b>constraints the model can\'t perceive must be enforced in code</b> — generate, then measure with <code>len()</code>, then trim or regenerate.</div>' +
        '<h2>Glitch tokens and boundary artifacts</h2>' +
        '<p>Vocabularies contain junk learned from corpus quirks — the famous <code>SolidGoldMagikarp</code> class of glitch tokens (Reddit usernames that appeared in the tokenizer corpus but rarely in training text) triggered bizarre behavior in GPT-3-era models. Modern vocabularies are cleaner but boundary effects persist: a trailing space changing the next-token distribution, "词元 splitting" in CJK, and prompt-format sensitivity that shows up as unexplained eval variance. When output quality shifts after an innocent-looking prompt edit, diff the <em>token sequences</em>, not the strings.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Tokenization bugs form a diagnostic class: failures that feel like stupidity but are perception. Ask "can the model even see what I\'m asking about?" before "why is the model bad at this?"</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Why can\'t GPT count the r\'s in strawberry?" is practically a rite of passage. Nail the mechanism (opaque token IDs, no character access), then volunteer the engineering fix (tool use / code execution), then the general principle (enforce imperceptible constraints in code). That three-beat answer signals seniority.</div>'
    },
    {
      id: 'sampling',
      title: 'Temperature, top-p, top-k: reshaping the distribution',
      blurb: 'What the knobs actually do mathematically — and how to set them per task.',
      html: '<h2>The pipeline: logits → reshape → truncate → sample</h2>' +
        '<p>Each step, the model emits a logit per vocabulary entry. Sampling parameters transform that distribution <em>after</em> the model has done its work — they change selection, not intelligence:</p>' +
        '<ol>' +
        '<li><b>Temperature</b> divides logits before softmax: <code>softmax(logits / T)</code>. T&lt;1 sharpens (rich get richer), T&gt;1 flattens (tail gets airtime), T→0 becomes argmax (greedy). It rescales <em>relative confidence</em> — it cannot add knowledge, only redistribute probability the model already assigned.</li>' +
        '<li><b>Top-k</b> keeps only the k highest-probability tokens, renormalizes. Crude: k=40 is too many candidates in confident moments, too few in genuinely open ones.</li>' +
        '<li><b>Top-p (nucleus)</b> keeps the smallest set whose cumulative probability ≥ p, renormalizes. Adaptive: confident distribution → tiny nucleus; flat distribution → wide nucleus. This is why top-p aged better than top-k as the default truncation.</li>' +
        '<li><b>Penalties</b> (frequency/presence/repetition) subtract from logits of already-seen tokens — band-aids for repetition loops, useful at low doses, word-salad generators at high ones.</li>' +
        '</ol>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Order matters and differs by stack (temperature-then-top-p vs the reverse produce different results); OpenAI applies both against the same logits, llama.cpp lets you re-order samplers. Also: min-p sampling (keep tokens ≥ some fraction of the max probability) is a newer alternative popular in open-source stacks — better quality at high temperatures.</div>' +
        '<h2>Settings by task — starting points, then eval</h2>' +
        '<table><tr><th>Task</th><th>Temperature</th><th>Notes</th></tr>' +
        '<tr><td>Extraction, classification, tool args</td><td>0 – 0.2</td><td>You want the modal answer; variance is pure downside</td></tr>' +
        '<tr><td>Code generation</td><td>0 – 0.3</td><td>Low temp; correctness beats creativity. Sampling k candidates + running tests beats raising T</td></tr>' +
        '<tr><td>General chat / drafting</td><td>0.5 – 0.8</td><td>Provider defaults live here for a reason</td></tr>' +
        '<tr><td>Brainstorming, fiction</td><td>0.9 – 1.2</td><td>Pair with top-p 0.95; expect and want variance</td></tr>' +
        '<tr><td>LLM-as-judge, evals</td><td>0</td><td>Reduce variance in the <em>measuring instrument</em> (module 11)</td></tr></table>' +
        '<p>Two caveats that separate practitioners from tourists: <b>(1)</b> reasoning models (o-series, extended thinking) often ignore or forbid sampling params — the deliberation phase wants its own settings; read the model docs. <b>(2)</b> "temperature 0 for accuracy" is folk wisdom, not a law — greedy decoding can lock into degenerate repetition, and on some tasks light sampling with self-consistency voting (sample 5, majority-vote) beats greedy.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team debugged "random" JSON schema violations for a week. Cause: a shared client library defaulted temperature to 1.0, and the tail occasionally sampled a prose apology mid-object. Extraction endpoints had never overridden it. Sampling params are <em>per-request config that belongs in code review</em> — treat an unpinned temperature like an unpinned dependency version.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Expect "explain temperature to a PM" (rescales confidence; doesn\'t add knowledge) and "when would you NOT use temperature 0?" (creative tasks; self-consistency sampling; greedy repetition traps). Knowing min-p exists is a strong open-source-fluency signal.</div>'
    },
    {
      id: 'logprobs',
      title: 'Logprobs: the confidence signal hiding in the API',
      blurb: 'Per-token probabilities as a free-ish uncertainty meter — with sharp limits.',
      html: '<h2>What you get</h2>' +
        '<p>Ask for <code>logprobs</code> (OpenAI-compatible APIs; top_logprobs up to ~20 alternatives per position) and you receive log P(token) for each emitted token under the final distribution. <code>exp(logprob)</code> = probability. What they\'re genuinely good for:</p>' +
        '<ul>' +
        '<li><b>Classification confidence:</b> constrain output to one token ("YES"/"NO") and read its probability — a usable confidence score for routing: auto-accept above 0.95, human-review below. This is the cheapest confidence signal in the entire stack.</li>' +
        '<li><b>Fabrication smell test:</b> confident facts ride high-probability tokens; fabricated specifics (fake citations, invented numbers) often ride flatter distributions. Semantic-entropy-style detectors build on exactly this.</li>' +
        '<li><b>Prompt A/B forensics:</b> compare logprobs of a <em>fixed</em> target completion under two prompts to measure which prompt makes the desired behavior more likely — finer-grained than accuracy on small eval sets.</li>' +
        '<li><b>Cheap perplexity:</b> mean negative logprob over a fixed text = how "surprising" the model finds it; useful for drift detection and data-quality filters.</li>' +
        '</ul>' +
        '<h2>Where the signal lies to you</h2>' +
        '<p>Logprobs are the model\'s <em>self-reported</em> uncertainty, and RLHF miscalibrates it: preference-tuned models are systematically overconfident (base models are better calibrated — a known, measured effect since GPT-4\'s model card). A 0.98 on a wrong answer is common in domains the model "believes" it knows. Also: probability is per-token, not per-claim — a hedged wrong sentence can carry higher token probabilities than a precise right one. And providers may not expose logprobs at all (Anthropic doesn\'t, as of early 2026) or not under sampling transforms you expect.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Treat logprobs as a <b>relative</b> signal for ranking/routing within one model+prompt, never as an absolute calibrated probability across models, prompts, or domains.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A moderation pipeline routed by P("SAFE") from a preference-tuned model, threshold 0.9, validated on last quarter\'s traffic. A new abuse pattern emerged that the model confidently misread — 0.97 SAFE on violations. Confidence thresholds need the same drift monitoring as any model score (module 12); overconfidence failures are silent by construction.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How would you get a confidence score out of an LLM?" Layered answer: single-token logprob for closed-set outputs; sample-N-and-measure-agreement (self-consistency) for open outputs; trained verifier for high stakes. Mentioning RLHF calibration damage is the differentiator.</div>'
    },
    {
      id: 'determinism',
      title: 'Determinism myths: why temperature 0 still isn\'t reproducible',
      blurb: 'The full stack of nondeterminism, and what "reproducible" can realistically mean.',
      html: '<h2>The myth</h2>' +
        '<p>"Set temperature to 0 and you get the same output every time." Every team believes it until the flaky test appears. Temperature 0 removes <em>sampling</em> randomness (argmax selection) but leaves at least four other sources:</p>' +
        '<ol>' +
        '<li><b>Floating-point non-associativity:</b> (a+b)+c ≠ a+(b+c) in fp16/bf16. GPU kernels sum in whatever order the parallel schedule produces; batch composition changes reduction order (your request shares a batch with strangers — continuous batching, module 15). When two top logits sit within ~1e-4, a rounding wobble flips the argmax, and one flipped token cascades through the rest of the generation.</li>' +
        '<li><b>Mixture-of-Experts routing:</b> MoE models route per-token to experts; capacity overflow under load can reroute, changing results. (Whether specific frontier models are MoE is often unconfirmed — treat vendor architecture claims as rumors; the observable fact is nondeterminism.)</li>' +
        '<li><b>Fleet heterogeneity:</b> different GPU generations / kernel versions / tensor-parallel splits behind one endpoint produce different rounding.</li>' +
        '<li><b>Silent model updates:</b> aliases like <code>-latest</code> move under you; even "pinned" snapshots have had serving-stack changes alter outputs.</li>' +
        '</ol>' +
        '<p>OpenAI\'s <code>seed</code> parameter + <code>system_fingerprint</code> is explicitly best-effort — the fingerprint tells you when the backend changed, it doesn\'t prevent it. Local inference (llama.cpp, single GPU, fixed batch size, fixed seed) is the only place bit-exact reproducibility is realistically achievable — and even there, changing <code>-ngl</code> or batch size breaks it.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> The 2025 Thinking Machines "Defeating Nondeterminism" work pinned down the serving-side story precisely: the dominant cause is <b>lack of batch invariance</b> — kernels whose reduction order depends on how many other requests share the batch. Batch-invariant kernels fix it at a throughput cost, which is why providers don\'t default to them.</div>' +
        '<h2>Engineering for a nondeterministic dependency</h2>' +
        '<ul>' +
        '<li><b>Tests:</b> assert properties, not strings — schema validity, presence of required facts, judge scores above threshold. Snapshot tests on raw completions are flake factories.</li>' +
        '<li><b>Evals:</b> run N≥5 samples per case; report mean ± spread; alert on distribution shift, not single-run dips (module 11).</li>' +
        '<li><b>Reproducibility for debugging:</b> log the exact request (model snapshot id, full params, full prompt) so you can replay the <em>distribution</em> even if not the sample.</li>' +
        '<li><b>Caching as determinism:</b> semantic/exact-match response caches (module 18) make repeated identical requests deterministic by never re-sampling — often the cheapest "fix."</li>' +
        '</ul>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Is temperature 0 deterministic?" is a filter question. "No — floating-point reduction order varies with batching, plus MoE routing and fleet/model drift; design tests around properties and distributions" puts you in the top decile of answers.</div>'
    },
    {
      id: 'context-as-budget',
      title: 'Counting tokens like you count bytes',
      blurb: 'Token accounting as an engineering discipline: budgets, estimation, CI checks.',
      html: '<h2>The budget mindset</h2>' +
        '<p>A production prompt is a packed struct: system prompt + tool schemas + few-shot examples + conversation history + retrieved chunks + the actual question + reserved output space. All of it competes inside one window, and every token is billed per request, per user, forever. Teams that treat tokens like an infinite resource ship prompts that cost 8× what they should — a system prompt bloated to 6k tokens is a 6k-token tax on every single call (partially refunded by prompt caching — module 3 — but only partially).</p>' +
        '<p>Ballpark numbers to carry in your head (tiktoken-class tokenizers): a tool/function schema: 150–800 tokens each; a typical retrieved chunk: 300–600; a chat turn pair: 50–400; a "you are a helpful assistant" paragraph: 30–60; your 40-page PDF: 25k–40k. The context-window budget calculator in the Playground makes these trade-offs tangible — go move the sliders.</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Real budget math for a support bot on a 128k model: system 2k + tools 3k + history cap 8k + RAG 6k + output reserve 4k = 23k/request steady state. At $2.50/Mtok input (mid-tier, early-2026 pricing) that\'s ~$0.06/request input cost before caching — at 100k requests/day, $6k/day. This arithmetic, done early, is the difference between a viable product and a viral postmortem.</div>' +
        '<h2>Operational practices</h2>' +
        '<ul>' +
        '<li><b>Count in CI:</b> tokenize your system prompts and tool schemas on every PR; fail the build on unexplained growth (prompt bloat creeps like bundle size).</li>' +
        '<li><b>Reserve output explicitly:</b> <code>max_tokens</code> is a budget fence, not a suggestion box — a runaway generation at $10–15/Mtok output is real money; truncated JSON from a too-tight fence is a real outage. Set it per endpoint deliberately.</li>' +
        '<li><b>Measure, don\'t estimate, per-vendor:</b> the same prompt is 10–30% different token counts across OpenAI/Anthropic/Llama tokenizers. Migration cost estimates need re-tokenization, not a constant factor.</li>' +
        '<li><b>Log tokens per request</b> (in/out/cached separately) as first-class metrics; they are your unit economics (module 12, 18).</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> An agent team saw costs triple in a week with flat traffic. Cause: a tool\'s JSON output had verbose debug fields; every tool call dumped 4k tokens into context, and multi-step loops resent that history <em>every subsequent step</em>. Tokens compound in loops — output becomes input n more times. Trim tool outputs at the source; the agent needs the signal, not the log file.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> System-design rounds increasingly want the token-budget table: they give you traffic numbers, you produce tokens/request × requests/day × $/Mtok and a caching strategy. Practice until the arithmetic is reflexive — it\'s the AI-era equivalent of back-of-envelope QPS math.</div>'
    }
  ],
  quiz: [
    {
      text: 'A user reports the model fails at "list all words in this paragraph containing the letter q". What is the root cause and the right production fix?',
      options: [
        'The model is too small; upgrade to the frontier tier',
        'The model sees token IDs, not characters — have it generate and run code (or do the scan in your backend) instead of asking it to perceive letters',
        'Temperature is too high for precise tasks; set it to 0',
        'The paragraph exceeds the context window'
      ],
      answer: [1],
      explanation: 'Character-level perception doesn\'t exist in a token model — "q" is invisible inside multi-character tokens. Code execution gives exact results. Upgrading (A) improves memorized spelling slightly but stays unreliable. Temperature 0 (C) removes variance from a computation the model can\'t do. (D) is a different failure with different symptoms.'
    },
    {
      text: 'Your extraction endpoint intermittently outputs prose apologies instead of JSON, roughly 1 in 200 calls. Sampling config was never explicitly set. Most likely culprit?',
      options: [
        'The model was silently deprecated',
        'Default temperature (~1.0) occasionally samples from the low-probability tail where non-JSON continuations live; pin temperature ≈ 0 for extraction',
        'The JSON schema has a syntax error',
        'Rate limiting corrupts responses under load'
      ],
      answer: [1],
      explanation: 'Intermittent-at-low-rate format breaks are the signature of tail sampling under default temperature; extraction wants the modal answer (T≈0, ideally plus structured-output enforcement, module 5). A deprecation (A) or schema error (C) would fail consistently, not 0.5% of the time. Rate limits (D) return errors, not corrupted bodies.'
    },
    {
      text: 'Why did top-p (nucleus) sampling largely replace top-k as the default truncation strategy?',
      options: [
        'Top-p is faster to compute on GPUs',
        'Top-p adapts the candidate set to the distribution\'s shape — narrow when the model is confident, wide when it\'s genuinely uncertain — while a fixed k is wrong in both regimes',
        'Top-k cannot be combined with temperature',
        'Top-p guarantees grammatical output'
      ],
      answer: [1],
      explanation: 'A fixed k=40 includes 39 junk candidates when one token deserves 0.98, and excludes valid diversity when the distribution is flat. The nucleus resizes with entropy. Compute cost (A) is trivially similar. (C) is false — they compose fine. (D) — no sampling truncation guarantees grammar; that comes from the distribution itself.'
    },
    {
      text: 'You need a confidence score to route classification outputs: auto-accept vs human review. Cheapest robust first approach?',
      options: [
        'Ask the model "how confident are you, 0-100?" in a follow-up turn',
        'Constrain the answer to a single token (label) and read its logprob; calibrate the threshold on YOUR validation data',
        'Run the classification 50 times and count agreement',
        'Fine-tune a calibration head on the base model'
      ],
      answer: [1],
      explanation: 'Single-token logprob is nearly free (same call) and works well for closed-set outputs — provided you calibrate thresholds on your own data and monitor drift, since RLHF\'d models are overconfident. Verbalized confidence (A) is poorly correlated with correctness and clusters around 85–95. Sampling 50× (C) works but costs 50×— it\'s the fallback for open-ended outputs at lower N. (D) is a research project, not a first approach.'
    },
    {
      text: 'A teammate insists your flaky LLM test suite proves the provider is lying about temperature 0. Which TWO mechanisms actually explain different outputs at T=0 on identical requests?',
      options: [
        'Floating-point reduction order varies with continuous-batch composition, occasionally flipping near-tied argmax decisions',
        'The provider secretly raises temperature at peak load to save money',
        'MoE expert routing can vary under load/capacity constraints',
        'JSON key order randomization in the HTTP layer',
        'Temperature 0 is only applied to the first 100 tokens'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'Batch-dependent fp reduction order (the dominant, well-documented cause — batch invariance research addresses exactly this) and MoE routing variability are real. (B) is conspiracy, not mechanism. (D) — key order in a JSON body doesn\'t change model computation. (E) is invented. Design tests around properties, not exact strings.'
    },
    {
      text: 'Your multilingual product launches in Thai. Support costs per conversation come in ~3× the English forecast at identical conversation lengths. Why?',
      options: [
        'Thai users write longer messages culturally',
        'English-centric BPE vocabularies fragment Thai into several times more tokens per word — billing, context use, and latency all scale with that token count',
        'The Thai model variant is priced higher per token',
        'Unicode encoding doubles byte counts for Thai'
      ],
      answer: [1],
      explanation: 'Token fragmentation is the whole story: same semantic content, several× the tokens, and every meter (price, TPM limits, window, tokens/sec latency) runs on tokens. (A) is unfounded and wouldn\'t give a clean 3×. (C) — same model, same $/Mtok; the count changed, not the rate. (D) — UTF-8 bytes matter to storage, not token billing.'
    },
    {
      text: 'When is temperature 0 the WRONG choice? Select TWO.',
      options: [
        'Brainstorming 20 distinct campaign concepts',
        'Extracting invoice fields to a fixed schema',
        'Self-consistency: sampling 7 solutions to a math problem and majority-voting the answer',
        'Generating tool-call arguments in an agent loop',
        'An LLM-as-judge scoring outputs in CI'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'Brainstorming needs distribution coverage — T=0 yields one modal idea repeated in 20 phrasings. Self-consistency mathematically requires sampling diversity; at T=0 all 7 samples are (near-)identical and voting is void. Extraction (B), tool args (D), and judges (E) all want minimum variance — T≈0 territory.'
    },
    {
      text: 'You must enforce "summary ≤ 400 characters" as a hard product constraint. Correct architecture?',
      options: [
        'Prompt: "Your summary MUST be under 400 characters" — models follow explicit instructions',
        'Set max_tokens = 100 (400 chars ÷ 4 chars/token)',
        'Prompt for brevity as guidance, then enforce in code: measure len(), trim at a sentence boundary or regenerate if over',
        'Lower temperature so the model is more precise about lengths'
      ],
      answer: [2],
      explanation: 'The model can\'t count characters it can\'t see; prompts (A) get you approximately-short, not ≤400. max_tokens (B) uses an average ratio that varies by content — it truncates mid-sentence when the ratio runs short, i.e. a worse bug. Temperature (D) is orthogonal. Imperceptible constraints get enforced in code — always.'
    },
    {
      text: 'Comparing two candidate system prompts on a 30-example eval set, accuracy is 24/30 vs 26/30. A colleague calls it decided. What\'s the sharper, cheaper measurement using logprobs?',
      options: [
        'There is none; accuracy is the only valid metric',
        'For each example, compare the logprob each prompt assigns to a fixed reference completion — a continuous per-example signal that separates prompts without needing hundreds of samples',
        'Ask the model which prompt it prefers',
        'Sum the logprobs of the system prompts themselves'
      ],
      answer: [1],
      explanation: '2/30 difference is statistical noise (±3+ at this n). Scoring a fixed target under each prompt turns a coin-flip binary metric into a continuous one with far more statistical power per example. (C) is vibes with extra steps. (D) measures how "natural" the prompt text is to the model — irrelevant to downstream behavior.'
    },
    {
      text: 'An agent\'s per-task cost tripled with no traffic change. Logs show a tool now returns verbose debug JSON (~4k tokens). Why is the impact so much larger than 4k tokens per call?',
      options: [
        'Output tokens cost more than input tokens',
        'In a multi-step loop, each tool result is re-sent as input on every subsequent step — an n-step loop pays that 4k roughly n times, compounding across the episode',
        'Debug JSON disables prompt caching entirely',
        'The vector database re-indexes every tool output'
      ],
      answer: [1],
      explanation: 'Loops compound context: one bloated observation becomes input for every later step (4k × remaining steps, per episode). That\'s the tripling. (A) — tool results are input tokens, the cheap direction, and it doesn\'t explain compounding. (C) — caching may still cover the stable prefix; not the mechanism. (D) — nothing auto-indexes tool outputs. Fix: trim/summarize tool outputs at the source.'
    },
    {
      text: 'Why can a single trailing space at the end of a prompt measurably change model output?',
      options: [
        'The API strips it, shifting all offsets',
        'Whitespace is part of BPE tokens (" the" ≠ "the"); a trailing space changes which token boundaries are possible for the continuation, altering the next-token distribution',
        'It cannot — whitespace is semantically ignored by transformers',
        'Trailing spaces trigger code-mode formatting'
      ],
      answer: [1],
      explanation: 'Most word tokens include their leading space. Ending your prompt with a space means the next token is unlikely to be a space-prefixed word token — you\'ve constrained the continuation to unusual boundaries and shifted the distribution. (A) — APIs pass prompts as-is. (C) is exactly backwards. (D) is invented. Diff token sequences when "identical" prompts behave differently.'
    },
    {
      text: 'Your eval harness runs each case once at temperature 0 nightly and alerts on any changed output. It pages twice a week with no real regressions. What\'s the correct redesign?',
      options: [
        'Pin the seed parameter — that makes outputs bit-stable',
        'Assert properties (schema validity, required facts, judge scores) and track score distributions over N samples; alert on distribution shift, not string inequality',
        'Move evals to a local GPU where determinism is possible, testing the production model by proxy',
        'Reduce eval frequency to monthly to cut alert volume'
      ],
      answer: [1],
      explanation: 'Exact-string comparison against a nondeterministic dependency is a flake generator by design. Property assertions + distributional tracking is the durable pattern. Seeds (A) are best-effort — backend changes still shift outputs. (C) tests a different model on different hardware — proxy validity is poor. (D) reduces noise by reducing signal — you\'ll page less and miss more.'
    },
    {
      text: 'Estimating migration cost from Vendor A to Vendor B, a teammate multiplies current monthly token spend by B\'s price ratio. What\'s wrong?',
      options: [
        'Nothing — price per token is the only variable',
        'Different tokenizers produce 10–30% different token counts on identical text, and B\'s counts may skew worse for your language/content mix — re-tokenize a real traffic sample',
        'Vendor B\'s tokens are always half the size',
        'Token counts only matter for open-source models'
      ],
      answer: [1],
      explanation: 'Tokens aren\'t a portable unit — they\'re vendor-specific compression dictionaries. The honest estimate re-tokenizes representative traffic with B\'s tokenizer (plus re-benchmarks quality, since equivalent-tier models differ). (A) misses the unit change. (C) is made up. (D) — every hosted API bills in its own tokens.'
    }
  ],
  flashcards: [
    { id: 'fc-bpe', front: 'How does BPE build its vocabulary?', back: 'Start from 256 byte tokens; repeatedly merge the most frequent adjacent pair in the training corpus into a new token until target vocab size (~100k–200k). A learned, frozen compression dictionary.' },
    { id: 'fc-ratios', front: 'Token estimation yardsticks for English?', back: '1 token ≈ 4 chars ≈ 0.75 words; 1,000 words ≈ 1,300–1,500 tokens. Code varies; non-Latin scripts can cost 2–5× with English-centric vocabularies.' },
    { id: 'fc-why-subword', front: 'Why subword tokens instead of characters or words?', back: 'Characters → ~4× longer sequences → ~16× attention compute (O(n²)). Words → can\'t handle novel strings. BPE: open-vocabulary AND compact.' },
    { id: 'fc-strawberry', front: 'Why can\'t LLMs reliably count letters in a word?', back: 'They receive opaque token IDs, not characters — "strawberry" might be [straw][berry]. Fix: generate code to count, or space out letters. Enforce such constraints in code.' },
    { id: 'fc-digit-tok', front: 'Why is LLM mental arithmetic unreliable at the token level?', back: 'Numbers tokenize in inconsistent chunks (up to 3 digits per token); digit alignment for carrying is invisible. Production rule: calculator/code tools, never mental math.' },
    { id: 'fc-temp', front: 'What does temperature do, mathematically?', back: 'Divides logits before softmax: softmax(logits/T). T<1 sharpens, T>1 flattens, T→0 = argmax. Rescales relative confidence — cannot add knowledge.' },
    { id: 'fc-topp', front: 'Top-p (nucleus) sampling — mechanism and why it beat top-k?', back: 'Keep the smallest token set with cumulative probability ≥ p, renormalize. Adapts to distribution shape: narrow when confident, wide when uncertain — fixed k is wrong in both regimes.' },
    { id: 'fc-minp', front: 'What is min-p sampling?', back: 'Keep tokens whose probability ≥ (min_p × max token probability). Popular in open-source stacks; holds quality better at high temperatures than top-p.' },
    { id: 'fc-task-temps', front: 'Starting temperatures: extraction / code / chat / brainstorm / judge?', back: 'Extraction & tool args 0–0.2 · code 0–0.3 · chat 0.5–0.8 · brainstorming 0.9–1.2 · LLM-as-judge 0. Then eval, don\'t trust folklore.' },
    { id: 'fc-logprob-use', front: 'Best first use of logprobs in production?', back: 'Closed-set confidence: constrain output to one label token, read exp(logprob), route by calibrated threshold (auto-accept vs human review). Nearly free.' },
    { id: 'fc-calibration', front: 'What does RLHF do to logprob calibration?', back: 'Damages it — preference-tuned models are systematically overconfident (base models calibrate better). Treat logprobs as relative signals; calibrate thresholds on your own data; monitor drift.' },
    { id: 'fc-t0-myth', front: 'Four reasons temperature 0 still isn\'t reproducible?', back: '(1) fp reduction order varies with batch composition (dominant), (2) MoE routing under load, (3) heterogeneous fleet hardware/kernels, (4) silent model/serving updates. Seeds are best-effort.' },
    { id: 'fc-batch-invar', front: 'What is batch invariance and why do providers skip it?', back: 'Kernels whose results don\'t depend on batch composition — fixes T=0 nondeterminism (Thinking Machines, 2025) but costs throughput, so serving stacks don\'t default to it.' },
    { id: 'fc-test-nondet', front: 'How do you test against a nondeterministic model?', back: 'Assert properties (schema, required facts, judge thresholds), not exact strings; run N samples and track distributions; alert on shift. Log full request configs for replay.' },
    { id: 'fc-selfconsist', front: 'What is self-consistency and what does it require?', back: 'Sample k solutions (T>0 required), majority-vote the final answer. Beats greedy on reasoning tasks; useless at T=0 where all samples collapse to one.' },
    { id: 'fc-budget', front: 'What competes inside one context window in production?', back: 'System prompt + tool schemas + few-shot examples + history + retrieved chunks + question + reserved output. All billed per request — budget each slice explicitly.' },
    { id: 'fc-loop-compound', front: 'Why do bloated tool outputs cost n× in agent loops?', back: 'Each observation is re-sent as input on every subsequent step: 4k of debug JSON in a 10-step loop ≈ 40k extra input tokens per episode. Trim tool outputs at the source.' },
    { id: 'fc-vendor-tok', front: 'Is a token count portable across vendors?', back: 'No — tokenizers differ 10–30% on identical text (more across languages). Migration estimates must re-tokenize real traffic with the target tokenizer.' },
    { id: 'fc-trailing-space', front: 'Why does a trailing space change completions?', back: 'Whitespace lives inside BPE tokens (" the" ≠ "the"); a trailing space constrains valid continuation boundaries and shifts the next-token distribution.' },
    { id: 'fc-maxtokens', front: 'What is max_tokens actually for?', back: 'A cost/runaway fence per endpoint — not a length-control mechanism. Too tight → truncated output (broken JSON); absent → runaway generations at output-token prices.' }
  ],
  lab: {
    title: 'Tokenizers and samplers, hands on',
    intro: '<p>Count real tokens with <code>tiktoken</code>, break the model with character tasks, then sweep temperature and watch the distribution reshape. Under $0.05 of API spend, or $0 fully local.</p>',
    steps: [
      {
        title: 'Tokenize your own prompts',
        html: '<pre><code>pip install tiktoken\n\npython3 - &lt;&lt;\'EOF\'\nimport tiktoken\nenc = tiktoken.get_encoding("o200k_base")\nfor s in ["strawberry", " strawberry", "The quick brown fox", \n          "df.groupby(\'user_id\').agg({\'amount\':\'sum\'})",\n          "1234567 + 7654321", "สวัสดีครับ ยินดีต้อนรับ"]:\n    toks = enc.encode(s)\n    print(f"{len(toks):3d} tokens  {[enc.decode([t]) for t in toks]}")\nEOF</code></pre>' +
          '<p>Note "strawberry" vs " strawberry" (leading space = different tokens), digit chunking in the arithmetic line, and the Thai token explosion. Now tokenize your actual production system prompt — most people find 20–30% dead weight on first read.</p>'
      },
      {
        title: 'Break it with character tasks, fix it with code',
        html: '<p>Ask any chat model: <em>"How many r\'s in strawberry? Answer with just a number."</em> Run it 10× at temperature 1. Then ask: <em>"Write and mentally execute Python to count r\'s in \'strawberry\'. Show the code, then the answer."</em> Score both. The code-path reliability jump is the tool-use argument in miniature — the same reason production agents get calculators and interpreters (modules 5, 9).</p>'
      },
      {
        title: 'Sweep temperature against a fixed prompt',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nfrom openai import OpenAI\nfrom collections import Counter\nc = OpenAI()\nfor T in [0.0, 0.7, 1.2]:\n    outs = Counter()\n    for _ in range(12):\n        r = c.chat.completions.create(model="gpt-4o-mini", temperature=T, max_tokens=6,\n            messages=[{"role":"user","content":"Name one animal. One word only."}])\n        outs[r.choices[0].message.content.strip().lower()] += 1\n    print(f"T={T}: {dict(outs)}")\nEOF</code></pre>' +
          '<p>T=0 collapses to (nearly) one answer; T=1.2 spreads across the tail. Repeat with a factual question ("capital of France?") — note the distribution barely widens: when the model is confident, temperature has little to bite on. That asymmetry is the whole practical theory of sampling.</p>'
      }
    ],
    costNote: 'gpt-4o-mini at ~40 requests × ~50 tokens each ≈ $0.01–0.05 total. Zero persistent resources; nothing to clean up. Fully free alternative: run all three steps against Ollama (<code>ollama run llama3.2</code>, base_url <code>http://localhost:11434/v1</code>, api_key "x").'
  }
});
