COURSE.register({
  id: 'm04-model-apis',
  track: 'core',
  order: 4,
  title: 'Model APIs & the provider landscape',
  short: 'Model APIs',
  tagline: 'Request anatomy across vendors, streaming that survives errors, rate limits and retries, and the cost math that decides your architecture.',
  minutes: 110,
  lessons: [
    {
      id: 'request-anatomy',
      title: 'Anatomy of a chat request across vendors',
      blurb: 'The same conceptual request wears three different suits — and the differences bite exactly at the seams.',
      html: '<h2>One conceptual shape, three wire formats</h2>' +
        '<p>Every major chat API is the same idea: send a model id, an ordered list of role-tagged messages, and generation parameters; get back assistant content plus usage accounting. But the encodings diverge in ways that matter the moment you support more than one vendor, or migrate between them:</p>' +
        '<table><tr><th></th><th>OpenAI Chat Completions</th><th>OpenAI Responses API</th><th>Anthropic Messages</th><th>Google Gemini</th></tr>' +
        '<tr><td>Endpoint</td><td><code>POST /v1/chat/completions</code></td><td><code>POST /v1/responses</code></td><td><code>POST /v1/messages</code></td><td><code>POST /v1beta/models/{m}:generateContent</code></td></tr>' +
        '<tr><td>System channel</td><td><code>system</code>/<code>developer</code> role message in the list</td><td><code>instructions</code> field (+ <code>developer</code> items)</td><td>Top-level <code>system</code> parameter — NOT a message role</td><td>Top-level <code>systemInstruction</code></td></tr>' +
        '<tr><td>Roles</td><td>system/developer, user, assistant, tool</td><td>input items: message, tool call/output, reasoning...</td><td>user, assistant (tool results ride INSIDE a user turn)</td><td>user, <b>model</b> (not "assistant"), function parts</td></tr>' +
        '<tr><td>Content</td><td>string or content-part array</td><td>typed item list</td><td>string or content-block array (text, image, tool_use, tool_result)</td><td><code>contents[].parts[]</code> (text, inlineData, functionCall...)</td></tr>' +
        '<tr><td>max tokens</td><td><code>max_completion_tokens</code> (legacy <code>max_tokens</code>)</td><td><code>max_output_tokens</code></td><td><code>max_tokens</code> — <b>required</b></td><td><code>generationConfig.maxOutputTokens</code></td></tr>' +
        '<tr><td>Statefulness</td><td>stateless</td><td>optional server-side state (<code>previous_response_id</code>, <code>store</code>)</td><td>stateless</td><td>stateless (+ separate cached/stateful offerings)</td></tr></table>' +
        '<p>The Responses API deserves a note: it is OpenAI\'s newer surface (2025+), designed for agentic/tool-heavy use — typed input "items" instead of bare messages, built-in tools (web search, code interpreter), and optional server-side conversation storage so you can send only the new turn plus <code>previous_response_id</code>. Chat Completions remains supported and is the de-facto industry interchange format — practically every non-OpenAI vendor and open-source server (vLLM, Ollama, Together, Groq) exposes an OpenAI-compatible <code>/chat/completions</code> endpoint. That compatibility is real but shallow: sampling params, tool-call edge cases, logprobs, and usage fields differ subtly per host.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> Seam bugs from real migrations: (1) Sending a <code>{"role": "system"}</code> message to Anthropic — 400 error; the system prompt is a top-level param. (2) Forgetting <code>max_tokens</code> on Anthropic — it is required, and cargo-culted low values silently truncate. (3) Gemini\'s role is <code>model</code>, not <code>assistant</code> — history replayed verbatim from another vendor 400s. (4) Anthropic requires strictly alternating user/assistant turns — consecutive same-role messages that OpenAI merges happily must be merged by YOU. (5) OpenAI\'s reasoning models rejected <code>max_tokens</code> in favor of <code>max_completion_tokens</code>, breaking pinned older SDKs.</div>' +
        '<h2>The parameters that actually matter</h2>' +
        '<ul>' +
        '<li><b><code>temperature</code>/<code>top_p</code></b> — sampling entropy (module 2). Change one, not both. Note the trend: several reasoning-model endpoints (OpenAI o-series, newer Anthropic Opus tiers) restrict or reject sampling params entirely — steering moved into prompts and effort settings.</li>' +
        '<li><b><code>max_tokens</code>-family</b> — a hard output cap, not a target. Undersize it and you get truncation with <code>finish_reason: "length"</code> / <code>stop_reason: "max_tokens"</code> — check for this in code; truncated JSON is the classic downstream breakage. On reasoning models the cap also covers hidden reasoning tokens: a 2,000-token budget can be eaten entirely by thinking, yielding an empty visible answer.</li>' +
        '<li><b><code>stop</code> sequences</b> — cut generation at delimiters. Cheap insurance for structured formats.</li>' +
        '<li><b><code>tools</code>/<code>tool_choice</code></b> — module 5\'s territory; anatomy note: tool schemas count as input tokens on every request.</li>' +
        '<li><b><code>seed</code></b> (some vendors) — best-effort determinism only; never a reproducibility guarantee (module 2).</li>' +
        '<li><b><code>stream</code></b> — lesson 2.</li>' +
        '</ul>' +
        '<h2>Reading the response like an operator</h2>' +
        '<p>Beyond the text: <b><code>finish_reason</code>/<code>stop_reason</code></b> is load-bearing — <code>stop</code>/<code>end_turn</code> (natural), <code>length</code>/<code>max_tokens</code> (truncated — handle it!), <code>tool_calls</code>/<code>tool_use</code> (continue the loop), <code>content_filter</code>/<code>refusal</code> (policy). And <b><code>usage</code></b> — input/output/cached/reasoning token counts — is your invoice in miniature. Log it per request with model, prompt version, and route; every cost dashboard and anomaly alert you\'ll ever build starts from this field. Also log the response <code>id</code> and any <code>request-id</code> header — vendor support will ask for them.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Treat the provider API like any external dependency: pin API + model versions, parse defensively (fields appear and vanish across vendor releases), and isolate vendor-specific request building behind one adapter module — the seam differences above are exactly what the adapter absorbs.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "What breaks when you swap OpenAI for Anthropic behind your abstraction?" is a favorite practical probe. Hit: system-as-parameter vs role, required max_tokens, strict turn alternation, tool results as user-message content blocks vs a dedicated tool role, different stop-reason vocabularies, different usage field names. Bonus: mention Gemini\'s <code>model</code> role and that OpenAI-compatible endpoints differ in the corners.</div>'
    },
    {
      id: 'streaming',
      title: 'Streaming: SSE, chunk formats, and dying gracefully mid-stream',
      blurb: 'Why every chat product streams, what actually comes over the wire, and the error paths nobody tests.',
      html: '<h2>Why streaming is non-negotiable for interactive products</h2>' +
        '<p>Decode is sequential (module 1): a 500-token answer at 60 tokens/s takes over 8 seconds to finish, but the first token can arrive in a few hundred milliseconds. Streaming converts "8 seconds staring at a spinner" into "instantly reading" — the psychological difference between broken and fast. The two latency metrics to keep separate: <b>TTFT</b> (time to first token: network + queueing + prefill, so it grows with prompt length) and <b>tokens/sec</b> (decode throughput). Optimize TTFT with caching and shorter prompts; tokens/sec is mostly the provider\'s hardware and the model\'s size.</p>' +
        '<h2>What\'s on the wire: SSE</h2>' +
        '<p>All major APIs stream via <b>Server-Sent Events</b> over one HTTP response: <code>Content-Type: text/event-stream</code>, lines of <code>data: {json}</code> separated by blank lines, incrementally flushed. OpenAI sends deltas and a terminal <code>data: [DONE]</code>:</p>' +
        '<pre><code>data: {"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{"content":"lo"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]</code></pre>' +
        '<p>Anthropic uses named event types forming a block structure — <code>message_start</code> → <code>content_block_start</code> / <code>content_block_delta</code> / <code>content_block_stop</code> (per block: text, tool_use, thinking...) → <code>message_delta</code> (carries stop_reason + usage) → <code>message_stop</code>, plus periodic <code>ping</code> events. Gemini streams incremental <code>GenerateContentResponse</code> chunks. Three operational notes: (1) usage/token counts arrive at or near the END of the stream — cost logging must wait for the terminal events; (2) tool-call arguments stream as JSON <em>fragments</em> you must accumulate before parsing; (3) intermediaries (nginx buffering, some corporate proxies, serverless platforms without response streaming) silently turn your stream into one big flush — test through your real infrastructure path.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> SSE won over WebSockets for this job because generation is strictly server→client and SSE is plain HTTP: works through ordinary load balancers and CDNs, resumable semantics, no upgrade handshake. Your backend typically re-streams to browsers rather than exposing provider keys client-side — meaning you own a second streaming hop with its own buffering and timeout traps.</div>' +
        '<h2>Error-mid-stream: the path nobody tests</h2>' +
        '<p>The nasty property of streaming: <b>the HTTP status code is sent before generation runs.</b> A stream that opened with <code>200 OK</code> can still fail halfway — provider overload, content-policy cutoff, network drop, idle timeout. Failures arrive as an <code>error</code> event in-band (Anthropic documents <code>error</code> events, e.g. <code>overloaded_error</code>, mid-stream), as an abrupt connection close, or as a final chunk with an unexpected finish reason. Your status-code-based error handling never fires. Requirements this imposes:</p>' +
        '<ul>' +
        '<li><b>Wrap stream consumption in error handling</b>, not just stream creation. Distinguish "completed" (saw the terminal event: <code>[DONE]</code> / <code>message_stop</code>) from "connection ended" — absence of the terminal marker means you have a partial response.</li>' +
        '<li><b>Decide the partial-output policy per product.</b> Chat UIs usually keep partial text and show "generation interrupted — retry". Pipelines that parse output must treat partials as failures: half a JSON object is worse than no JSON object.</li>' +
        '<li><b>Retrying a stream restarts from token zero</b> — there is no resume. Retry-with-partial-context tricks (feeding back the partial as a prefix) are fragile; prefer full regeneration and idempotent handling (lesson 3).</li>' +
        '<li><b>Watch for stalls, not just errors:</b> a wedged connection can deliver nothing without closing. Enforce an inter-chunk timeout (e.g. no delta for 30–60s → abort and retry), separate from the overall request timeout.</li>' +
        '<li><b>Cancellation propagates for a reason:</b> when the user navigates away, abort the upstream request — most providers stop billing tokens generated after the cut. Products that never cancel pay for text nobody reads.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team\'s summarization pipeline used streaming (copied from their chat code) and wrote accumulated text to the DB when the connection closed. During a provider incident, connections dropped mid-generation for an hour; the pipeline happily persisted thousands of half-summaries — no error, because close-without-terminal-event wasn\'t checked. The fix was one boolean: <code>saw_terminal_event</code>. For non-interactive pipelines, the better fix is usually: don\'t stream at all; use blocking calls (with long timeouts) or batch APIs.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Streaming UX floor as of early 2026: decent products deliver TTFT under ~1s for short prompts (cache-assisted) and render at the model\'s decode rate — roughly 50–200 tok/s on frontier hosted models, and 300–1000+ tok/s on speed-focused ASIC/LPU hosts (Groq, Cerebras) serving open models. Reasoning models add a thinking gap before the first visible token — stream a "thinking…" indicator (some APIs stream reasoning summaries you can show) or the app feels hung.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How do you handle errors during a streamed LLM response?" separates people who\'ve shipped from people who\'ve demoed. Cover: 200-before-failure, in-band error events, terminal-marker detection, partial-output policy, inter-chunk stall timeouts, restart-from-zero retries, and cancellation to stop billing. That list IS the answer.</div>'
    },
    {
      id: 'rate-limits',
      title: 'Rate limits, 429s, and retries that don\'t make things worse',
      blurb: 'RPM, TPM, and concurrency budgets — and the backoff-with-jitter discipline that keeps incidents small.',
      html: '<h2>The three meters you\'re being measured on</h2>' +
        '<p>Providers meter along several axes simultaneously; you throttle when ANY of them trips:</p>' +
        '<ul>' +
        '<li><b>RPM</b> — requests per minute. Binds first for high-volume small calls (classification at scale).</li>' +
        '<li><b>TPM</b> — tokens per minute, often split into input vs output TPM (Anthropic) or estimated-then-reconciled (OpenAI counts <code>max_tokens</code> against the budget at admission on some tiers — oversized max_tokens can throttle you for tokens you never generate). Binds first for long-context work: at 200k tokens per request, 2M TPM is just 10 requests a minute.</li>' +
        '<li><b>Concurrency / in-flight caps</b> — explicit on some platforms (Bedrock, Vertex quotas, many aggregators), implicit elsewhere. Binds for slow reasoning calls that each hold a slot for 30–120s.</li>' +
        '</ul>' +
        '<p>Limits scale with spend tier: as of early 2026, an entry-tier OpenAI account gets on the order of 500 RPM / 30k–200k TPM on mainline models (scaling to millions of TPM at higher tiers); Anthropic tier 1 starts around 50 RPM / tens of thousands of ITPM, also scaling with usage history. Exact numbers move constantly — the durable skill is knowing the axes, reading your current limits from the dashboard and response headers (<code>x-ratelimit-remaining-requests/-tokens</code>, <code>retry-after</code>, or Anthropic\'s <code>anthropic-ratelimit-*</code> family), and designing for the day you hit them.</p>' +
        '<h2>Handling 429 like an adult</h2>' +
        '<p>A 429 is not an error to log-and-drop; it is backpressure to obey. The canonical client:</p>' +
        '<ol>' +
        '<li><b>Honor <code>retry-after</code> when present.</b> The server is telling you the answer; exponential guessing on top of it is rude and slower.</li>' +
        '<li><b>Exponential backoff with jitter otherwise:</b> <code>sleep(min(cap, base × 2^attempt) × random(0,1))</code> — "full jitter" per the classic AWS analysis. Without jitter, a fleet of clients that failed together retries together, producing synchronized stampedes that re-trigger the limit every 2^n seconds. Jitter decorrelates them; it is the difference between recovery and a self-inflicted DDoS.</li>' +
        '<li><b>Cap attempts and total elapsed time</b>, then fail into a queue/dead-letter rather than retrying forever. Retry budgets (e.g. retries may add at most 20% extra load) keep meltdown behavior bounded.</li>' +
        '<li><b>Retry only what\'s retryable:</b> 429, 500, 502/503, 529 (Anthropic overloaded), connection resets, and timeouts. Do NOT blind-retry 400 (malformed — it will never succeed), 401/403 (auth), 404, or content-policy refusals. 408/timeout on a non-idempotent operation needs the idempotency story below.</li>' +
        '<li><b>Add client-side rate limiting and admission control</b> so you rarely see 429s at all: a token-bucket matched to your known RPM/TPM, and a bounded work queue. Bonus: a circuit breaker that sheds load early when error rate spikes, so one provider incident doesn\'t consume every worker in your service on doomed retries.</li>' +
        '</ol>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Most SDKs (OpenAI, Anthropic official clients) already do 2–3 retries with exponential backoff and jitter, honoring retry-after. Know this before wrapping SDK calls in your own retry loop — stacked retries multiply: your 5 retries × the SDK\'s 3 = 15 actual attempts per logical request during an outage, which is how incidents become billing events. Configure retries in ONE layer and disable them elsewhere.</div>' +
        '<h2>Idempotency: the retry\'s evil twin</h2>' +
        '<p>A timeout is ambiguous: the request may have completed after you gave up. For pure text generation the cost of a duplicate is paying twice; annoying but survivable. But the moment a request has side effects — you record usage against a customer quota, trigger a downstream action from the response, or the model call is an agent step that executes tools — duplicates corrupt state. Defenses:</p>' +
        '<ul>' +
        '<li><b>Idempotency keys</b> where supported (OpenAI supports an <code>Idempotency-Key</code> header on some surfaces; batch/queue systems support request dedup) — the server returns the original result for a replayed key instead of re-executing.</li>' +
        '<li><b>Your own dedup layer</b> otherwise: key requests by a content hash + purpose id, record completion in your DB, and have retries check before re-issuing. This is mandatory around agent tool execution (module 5/12): "retry the LLM call" must never mean "send the email twice".</li>' +
        '<li><b>Make downstream consumers idempotent</b> so a duplicate result is absorbed (upserts, not inserts).</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A launch-day traffic spike tripped TPM limits; the team\'s hand-rolled retry (no jitter, no cap, wrapping an SDK that also retried) turned every failed request into ~12 attempts, which held the limit pinned at zero headroom for 40 minutes — a steady 429 wall that only broke when they shipped a kill switch. Post-incident fixes: jittered backoff in exactly one layer, a client-side token bucket at 80% of quota, a circuit breaker, and a load test that replays 3× peak. Rate-limit handling is architecture, not a try/except.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> For bulk offline work, stop fighting the interactive rate limits entirely: batch APIs (OpenAI Batch, Anthropic Message Batches) take file/bulk submissions with a 24h SLA at <b>50% off</b> both input and output — separate, much larger quotas, no retry choreography. Half your "rate limit problem" is usually traffic that never needed to be synchronous.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Design the client layer for an API with RPM/TPM limits." Expected shape: client-side token bucket + bounded queue → SDK-or-yours (not both) jittered exponential backoff honoring retry-after → retryable-vs-fatal error taxonomy → idempotency for side-effectful paths → circuit breaker → overflow to batch API. Mentioning the thundering-herd/jitter reasoning and stacked-retry multiplication is what makes it a senior answer.</div>'
    },
    {
      id: 'cost-math',
      title: 'Token economics: doing the cost math before the invoice does',
      blurb: 'Real early-2026 prices, the input/output/cached asymmetry, and back-of-envelope models that keep architecture honest.',
      html: '<h2>The price sheet (early 2026 snapshot)</h2>' +
        '<p>Everything is billed per million tokens ($/Mtok), input and output priced separately, with discounts for cached input and batch. Representative published list prices <b>as of early 2026</b> — these WILL be stale; the structure won\'t:</p>' +
        '<table><tr><th>Model (class)</th><th>Input $/Mtok</th><th>Output $/Mtok</th><th>Notes</th></tr>' +
        '<tr><td>OpenAI GPT-5.x (frontier)</td><td>~$1.25</td><td>~$10</td><td>cached input ~$0.125; reasoning tokens bill as output</td></tr>' +
        '<tr><td>OpenAI mini / nano tiers</td><td>$0.05–0.25</td><td>$0.40–2</td><td>workhorse for classification/extraction</td></tr>' +
        '<tr><td>Anthropic Claude Opus 4.5</td><td>$5</td><td>$25</td><td>flagship; cache reads ~0.1×, writes 1.25–2×</td></tr>' +
        '<tr><td>Anthropic Claude Sonnet 4.5</td><td>$3</td><td>$15</td><td>long-context surcharge above 200k on some tiers</td></tr>' +
        '<tr><td>Anthropic Claude Haiku 4.5</td><td>$1</td><td>$5</td><td>fast tier</td></tr>' +
        '<tr><td>Google Gemini 3 Pro</td><td>~$2</td><td>~$12</td><td>higher rate above 200k context; Flash tiers ~$0.10–0.30 in</td></tr>' +
        '<tr><td>Open-weights via Groq/Together/Fireworks (70B–large MoE class)</td><td>$0.10–1</td><td>$0.30–3</td><td>e.g. DeepSeek V3-class ~$0.25–0.30 in; Llama 70B ~$0.6–0.9</td></tr></table>' +
        '<p>Structural constants worth memorizing: <b>output costs 3–8× input</b> (decode is memory-bandwidth-bound, module 1); <b>cached input costs ~10–25% of regular input</b>; <b>batch is 50% off</b> at both OpenAI and Anthropic; <b>reasoning/thinking tokens bill as output</b> even when hidden. Price-performance has fallen roughly 10× every 12–18 months for constant capability — any architecture decision premised on "LLM calls are expensive" should carry a date.</p>' +
        '<h2>Back-of-envelope models that catch six-figure mistakes</h2>' +
        '<p><b>Per-request cost</b> = in_tokens × in_price + cached_tokens × cache_price + out_tokens × out_price (÷ 1M). Three worked examples that generalize:</p>' +
        '<ul>' +
        '<li><b>Support chat turn</b> (Sonnet-class, $3/$15): 3k system+tools (cached: 3000 × $0.30/Mtok = $0.0009) + 4k history/input ($0.012) + 400 output ($0.006) ≈ <b>$0.019/turn</b>. At 100k turns/day ≈ $1.9k/day ≈ $57k/mo. Without caching: +$0.008/turn ≈ +$24k/mo. Caching is not a micro-optimization.</li>' +
        '<li><b>Classification at scale</b> (nano-class, $0.05/$0.40): 300 in + 5 out ≈ $0.000017 each — 10M/day ≈ $170/day. The same job on a flagship at $5/$25 is ~$16k/day: a <b>~90×</b> spread for a task the small model does at 99% parity. Model selection IS the cost lever.</li>' +
        '<li><b>Agent run</b>: 15 steps, context growing 2k→40k tokens across steps ≈ ~300k cumulative input + 8k output. Uncached on a $3/$15 model ≈ $1.02/run; with history caching (~90% of input cached) ≈ <b>$0.24/run</b>. Quadratic-ish context growth means agent cost is dominated by input replay — control loop length and compact context (module 8), or the demo that cost $0.30 becomes the feature that costs $3.</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Estimate cost per unit of business value (per ticket resolved, per document processed) BEFORE building. The three levers, in order of typical impact: (1) smaller model where quality allows — often 10–90×; (2) caching + prompt diet — 2–10× on input-heavy work; (3) batch for anything async — 2×. Sampling knobs and wording tweaks are noise by comparison.</div>' +
        '<h2>Operational cost hygiene</h2>' +
        '<ul>' +
        '<li><b>Log <code>usage</code> per request</b> tagged by route, model, prompt version, customer. "Which feature is spending the money" must be a query, not an investigation.</li>' +
        '<li><b>Alert on tokens, not dollars</b> — daily spend anomaly detection catches the retry loop or the runaway agent on day one, not on the invoice. Set per-route budget caps that trip a breaker.</li>' +
        '<li><b>Watch output-token creep:</b> model updates and prompt edits change verbosity; a 30% longer average answer is a 30% output-bill increase that no code review flagged. Reasoning models: monitor the reasoning-token field specifically; effort settings can swing cost 5–20× per request.</li>' +
        '<li><b>Count tokens pre-flight</b> for budget enforcement (tokenizer libraries locally, or provider count endpoints — Anthropic has <code>count_tokens</code>) rather than discovering a 180k-token prompt from the bill.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team shipped "answer quality improvements" that included switching a summarizer route from a mini-tier to a frontier reasoning model at medium effort "temporarily, for the demo". Nobody reverted it. The route ran 40k requests/day; reasoning tokens averaged 3.5k per request, billed as output. The delta — about $9k/day — sat inside a growing invoice for three weeks because spend was monitored monthly, per-account, not daily, per-route. Cost observability is a launch requirement, not a finance follow-up.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Expect a live estimation: "10M docs, 2k tokens each, extract 5 fields — what does it cost and how do you make it cheaper?" Show the multiplication (10M × 2.1k tokens ≈ 21B tokens ≈ e.g. $0.05/$0.40 nano-class ≈ $1.1k input + $200 output), then the levers: batch (−50%), smaller model with eval-verified parity, truncate/prefilter docs. Interviewers are checking you reach for arithmetic before opinions.</div>'
    },
    {
      id: 'provider-landscape',
      title: 'The provider landscape and model-selection frameworks',
      blurb: 'Frontier labs, open-weights hosts, aggregators, and cloud routes — and a defensible way to pick.',
      html: '<h2>The map, vendor-neutrally (early 2026)</h2>' +
        '<ul>' +
        '<li><b>Frontier labs, first-party APIs:</b> OpenAI (GPT-5.x line, o-series reasoning heritage, Responses API, strong tooling ecosystem), Anthropic (Claude Opus/Sonnet/Haiku, 200k–1M contexts, strong agentic/coding reputation, explicit prompt caching), Google (Gemini 3/2.5 Pro/Flash tiers, 1M+ context, deep GCP integration, aggressive Flash pricing). All three: multimodal input, tool calling, structured outputs, batch discounts, reasoning modes. Capability leadership rotates every few months; APIs and price structures are what you actually marry.</li>' +
        '<li><b>Second-tier labs / regional players:</b> Mistral (strong European option, mix of open-weights and hosted Large models, EU data residency), Cohere (enterprise/RAG focus), xAI, DeepSeek and Qwen (open-weight releases at frontier-adjacent quality that reset price floors — DeepSeek\'s V3/R1 line notably so).</li>' +
        '<li><b>Open-weights inference hosts:</b> Together, Fireworks, Groq (custom LPU hardware, 300–1000+ tok/s), Cerebras — serve Llama/Qwen/DeepSeek-class open models behind OpenAI-compatible APIs, competing on price and speed. This is where open-source becomes an operational option without you running GPUs (module 16 covers self-hosting).</li>' +
        '<li><b>Aggregators/routers:</b> OpenRouter and friends — one API key, hundreds of models, unified OpenAI-ish schema, per-request provider routing and fallbacks. Great for evaluation breadth and hedging; adds a third party to your data path and a thin layer of format normalization you must still test.</li>' +
        '<li><b>Enterprise cloud routes:</b> AWS Bedrock (Anthropic, Meta, Mistral, Amazon\'s own models), Google Vertex AI (Gemini + partners), Azure AI Foundry (OpenAI + others). Same or similar models, cloud-native auth/VPC/compliance wrappers, spend folded into existing cloud agreements and private networking. Tradeoffs: model/feature availability lags first-party APIs by weeks-to-months, quotas differ, and each wraps the API in its own envelope.</li>' +
        '</ul>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Enterprise selection is often decided by non-model factors: data-processing terms (training-on-your-data defaults, retention windows, zero-data-retention options), regional availability/data residency, SOC2/HIPAA/FedRAMP status, and SLA existence (most raw LLM APIs offer no meaningful uptime SLA — enterprise cloud routes do). Engineers who ignore these get overruled by procurement later; check them in week one.</div>' +
        '<h2>A model-selection framework that survives review</h2>' +
        '<ol>' +
        '<li><b>Write the requirements before touching a leaderboard:</b> task type, quality bar (measurable), latency budget (TTFT + total), cost ceiling per unit, context needed, modality, tool/structured-output needs, compliance constraints.</li>' +
        '<li><b>Build the eval first</b> (module 11): 50–200 real task examples. Public leaderboards (LMArena, artificial-analysis style indexes) tell you the shortlist, never the answer — benchmark contamination and task mismatch make marginal ranking differences meaningless for YOUR workload.</li>' +
        '<li><b>Shortlist three tiers:</b> a frontier model (quality ceiling / fallback), a mid-tier (likely winner), a small model (cost floor). Run the eval; measure quality, p50/p95 latency, and $/task together, not quality alone.</li>' +
        '<li><b>Pick the cheapest model that clears the bar — per route.</b> Real products are portfolios: frontier for the 5% hard path, mid for the main path, nano for classification/routing. Single-model architectures are almost always overpaying somewhere.</li>' +
        '<li><b>Re-run quarterly and on releases.</b> The capability floor rises constantly; "too hard for a small model" decisions expire (module 1). The eval you built in step 2 makes re-testing an afternoon instead of a debate.</li>' +
        '</ol>' +
        '<h2>Portability: real but not free</h2>' +
        '<p>The OpenAI-compatible de-facto standard means switching hosts is days, not months — IF you kept discipline: one adapter module owning request building, no vendor-exclusive feature in a hot path without a fallback, prompts re-evaluated per model (they do NOT transfer cleanly; every migration needs an eval run and usually prompt tuning — module 3). Multi-provider failover is a genuine resilience win (provider incidents happen quarterly), but only for routes whose prompts you have actually validated on the fallback model. An untested fallback is a second incident waiting behind the first.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A startup wired an aggregator\'s automatic failover across three providers for "resilience" but only ever eval\'d their prompts on provider A. During A\'s outage, traffic silently failed over to provider C, whose model interpreted their extraction prompt differently — schema violations tripled for six hours and poisoned a day of downstream data. Failover without per-provider eval coverage is chaos engineering you didn\'t consent to. Pin the fallback list to models you\'ve tested, and alert on failover activation.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How would you choose a model for X?" — the trap is answering with a model name. The senior answer is the process: requirements → own eval → three-tier shortlist → cheapest-that-clears-the-bar per route → scheduled re-evaluation, plus the compliance/SLA dimension for enterprise. Name-dropping the current leaderboard king dates your answer in a month; the framework doesn\'t.</div>'
    },
    {
      id: 'sdk-pitfalls',
      title: 'SDK pitfalls: timeouts, connections, and retry interplay',
      blurb: 'The client-library failure modes that only show up under load — or during the incident.',
      html: '<h2>Timeouts: the defaults are not your friends</h2>' +
        '<p>LLM calls are the slowest network calls your service makes — 100× slower than a DB query, with legitimate p99s in the tens of seconds and reasoning calls legitimately running minutes. Default SDK timeouts are generous (the OpenAI and Anthropic SDKs default to 10 minutes), and generic HTTP-client defaults (30–60s) are simultaneously too short for reasoning calls and too long for interactive ones. What good looks like:</p>' +
        '<ul>' +
        '<li><b>Per-route timeouts, not one global:</b> an interactive autocomplete route might cap total time at 10s; a batch enrichment route at 300s. One number cannot serve both.</li>' +
        '<li><b>Separate connect, first-byte (TTFT), inter-chunk, and total timeouts.</b> For streaming, the meaningful health signals are "did the first token arrive within N seconds" and "has any chunk arrived recently" — a single whole-request deadline either kills healthy long generations or lets wedged ones hang.</li>' +
        '<li><b>Long-output warning:</b> SDKs increasingly refuse or warn on large <code>max_tokens</code> without streaming (a 100k-token non-streaming response will sit inside one HTTP response for minutes — some middlebox will kill it). Streaming is the transport fix, independent of UX.</li>' +
        '<li><b>Propagate deadlines:</b> if your endpoint has a 30s SLA, the upstream LLM call must get a smaller budget, minus retry room. SDKs support per-request timeout overrides — use them; don\'t rebuild clients per call.</li>' +
        '</ul>' +
        '<h2>Connection reuse: boring until it takes you down</h2>' +
        '<p>TLS handshakes cost 1–3 RTTs; at hundreds of RPS without connection pooling you pay that per request, exhaust ephemeral ports, and hammer the provider\'s edge. The SDKs pool connections correctly <em>per client instance</em> — which is exactly the trap:</p>' +
        '<ul>' +
        '<li><b>Instantiate the client once</b> (per process), not per request. <code>client = OpenAI()</code> inside a request handler creates a new pool every call: no keep-alive reuse, file-descriptor creep, and mysterious latency that profiles as "network". Same rule for Anthropic\'s and Google\'s SDKs, and for any raw httpx/aiohttp client underneath.</li>' +
        '<li><b>Serverless nuance:</b> module-scope (container-scope) clients survive warm invocations — create them outside the handler. Cold starts still pay the handshake; provisioned concurrency or connection-warming mitigates if TTFT matters.</li>' +
        '<li><b>Tune pool size to your concurrency:</b> default pool limits (e.g. ~100 connections in common HTTP stacks) silently queue requests above the limit — under load this masquerades as provider slowness. Check pool-wait metrics before blaming the vendor.</li>' +
        '<li><b>Async clients for high fan-out:</b> LLM calls are I/O-bound; a thread per in-flight request stops scaling around hundreds. Async clients (or a bounded worker pool) are the standard fix — with a semaphore to respect your concurrency budget (lesson 3).</li>' +
        '</ul>' +
        '<h2>Where retries, streaming, and timeouts collide</h2>' +
        '<ul>' +
        '<li><b>Stacked retries (again, because it\'s the #1 offender):</b> SDK-internal retries (usually 2–3, jittered, on 408/429/5xx/connection errors) × your wrapper\'s retries × a service-mesh/gateway retry policy = attempt multiplication during incidents. Pick ONE layer; set the others to zero. Audit this — it hides in sidecars and API gateways where nobody looks.</li>' +
        '<li><b>Retries multiply inside timeouts:</b> an SDK doing 3 attempts with backoff inside your 60s deadline means each attempt effectively gets ~15s — your "60 second timeout" quietly became a 15s-per-try policy. Budget total time = attempts × per-try + backoff, or set per-try timeouts explicitly.</li>' +
        '<li><b>Streams and retries interact badly:</b> SDKs retry stream <em>establishment</em> (nothing sent yet — safe) but cannot retry a stream that died mid-body; that surfaces as an exception during iteration, YOUR code\'s problem (lesson 2). If you wrap streaming calls in a generic retrier, ensure it distinguishes pre-first-byte failures (retry fine) from mid-stream failures (regeneration — dedupe/idempotency applies).</li>' +
        '<li><b>Backpressure symptom to memorize:</b> healthy provider + rising client-side latency + low provider-reported latency = local queueing (pool exhaustion, semaphore too small, event loop blocked by a sync call in async code — the classic: calling the sync SDK inside an async handler, freezing the loop per request).</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> During a provider slowdown (p50 jumped from 2s to 20s), a service with a 100-connection pool, per-request client instantiation in one code path, and three layers of retries entered a death spiral: slow calls held connections longer → pool exhausted → requests queued → upstream timeouts fired → three retry layers resubmitted → queue grew. The provider recovered in 15 minutes; the service took 90 minutes to drain. Every element was a known pitfall from this lesson. Load-test the failure mode: inject 10× latency at a proxy and watch what your client stack does.</div>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Your SDK configuration is a distributed-systems policy document: one client instance per process, per-route deadlines with TTFT/stall detection for streams, retries in exactly one layer with jitter and caps, bounded concurrency with backpressure, and metrics on pool waits and retry counts. None of it is LLM-specific — all of it gets skipped because "it\'s just an API call".</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your LLM feature\'s latency spiked but the provider status page is green — walk me through debugging." Strong path: check client-side queueing (pool waits, semaphores, event-loop blocking), then retry amplification, then per-attempt timeout math, then TTFT vs decode split from your own metrics, THEN the provider. Reaching for provider blame first, or not having the metrics, is the junior tell.</div>'
    }
  ],
  quiz: [
    {
      text: 'You lift a working OpenAI Chat Completions request and send the same message array to Anthropic\'s Messages API. It fails with a 400. Which TWO differences are the most likely causes?',
      options: [
        'The {"role": "system"} message — Anthropic takes the system prompt as a top-level parameter, not a message role',
        'Anthropic requires max_tokens, which the OpenAI request omitted',
        'Anthropic requires temperature to be exactly 1.0',
        'Anthropic only accepts XML request bodies',
        'The model name contained hyphens'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'These are the two canonical migration 400s: system-as-parameter (a system role inside messages is rejected) and the required max_tokens field. (C) temperature is optional with a normal range. (D) all these APIs speak JSON. (E) hyphenated model ids are the norm everywhere. Honorable mention not listed: strict user/assistant alternation, which bites on multi-turn history replays.'
    },
    {
      text: 'Your streamed responses sometimes end mid-sentence with no exception raised, and the truncated text gets saved as final. What is the root cause and fix?',
      options: [
        'The model decided to stop early; raise temperature so it writes more',
        'The connection closed before the terminal event ([DONE] / message_stop); code treated connection-close as completion. Track whether the terminal marker arrived and treat its absence as a failed partial',
        'max_tokens was hit; raise it and the problem disappears entirely',
        'SSE cannot signal completion, so this is unavoidable'
      ],
      answer: [1],
      explanation: 'Streams open with 200 before generation runs, so mid-stream failures surface as in-band error events or silent connection closes — never as an HTTP error status. The completed-vs-dropped distinction is the terminal event, which robust consumers must check. (A) temperature doesn\'t cause connection drops. (C) max_tokens truncation is a DIFFERENT case — it arrives WITH a proper finish_reason ("length"), which you should also handle, but it isn\'t the silent-close signature described. (D) false: [DONE], message_stop, and finish_reason exist precisely to signal completion.'
    },
    {
      text: 'A fleet of 200 workers hits a TPM limit simultaneously during a spike. Each retries with plain exponential backoff (1s, 2s, 4s...) with no jitter. What happens and why?',
      options: [
        'The system recovers smoothly since backoff spreads the load over time',
        'All 200 workers retry at nearly the same instants, re-tripping the limit in synchronized waves — the thundering herd that jitter (randomizing each sleep) exists to decorrelate',
        'The provider bans the account for retrying',
        'Backoff without jitter is fine as long as the base delay is over 1 second'
      ],
      answer: [1],
      explanation: 'Deterministic backoff synchronizes clients that failed together: they all return at t+1, t+3, t+7..., each wave re-triggering the 429 and extending the incident. Full jitter — sleep(random(0, min(cap, base×2^n))) — spreads retries uniformly and is the documented fix (the classic AWS analysis). (A) describes backoff WITH jitter. (C) providers throttle; account bans for retry behavior at this scale aren\'t the failure mode. (D) the base delay doesn\'t fix synchronization — only randomization does.'
    },
    {
      text: 'A request times out after 60s. The operation records usage against a customer\'s monthly quota when the response arrives. Your retry succeeds. Later you find the customer was charged twice. What went wrong?',
      options: [
        'Timeouts are ambiguous — the first request completed server-side after you stopped waiting; a retry without an idempotency key or dedup layer executed the side effect twice',
        'The provider double-billed; open a support ticket',
        'The retry should have used a longer timeout',
        'Quota recording should happen before sending the request'
      ],
      answer: [0],
      explanation: 'A timeout means "no response observed", not "did not execute" — the canonical distributed-systems ambiguity. Side-effectful paths need idempotency: a key the server (or your dedup layer) uses to return the original result instead of re-executing. (B) the provider billed two completed requests — correctly. (C) longer timeouts reduce frequency but can\'t remove the ambiguity. (D) recording before the request charges customers for failures — worse, and still not idempotent across retries of the recording itself.'
    },
    {
      text: 'A summarizer route processes 500k documents per night; results are needed by 9am. It currently runs synchronous requests all night, fighting TPM limits with retries. What is the highest-leverage change?',
      options: [
        'Upgrade the account tier to raise TPM limits',
        'Submit the workload to the provider\'s batch API: 50% cheaper on input and output, separate larger quotas, 24h completion SLA — eliminating both the cost premium and the retry choreography',
        'Add more workers with more aggressive retry loops',
        'Shard the workload across five provider accounts'
      ],
      answer: [1],
      explanation: 'Overnight bulk work is exactly what batch endpoints (OpenAI Batch, Anthropic Message Batches) are for: half price and quota isolation from your interactive traffic. (A) raises limits but keeps full price and the operational fight. (C) more workers pounding the same TPM budget just manufactures more 429s. (D) violates most providers\' terms and is an operational liability — and still pays 2× the batch price.'
    },
    {
      text: 'Estimate: a chat feature does 50k turns/day on a $3-in/$15-out model. Each turn: 3,000 tokens of stable system+tools, 3,000 tokens of history/user input, 500 output tokens. With prefix caching (cache read ≈ $0.30/Mtok) covering the stable 3k, roughly what is the daily cost, and what would skipping caching add?',
      options: [
        '≈ $870/day with caching; skipping caching adds ≈ $405/day more',
        '≈ $87/day with caching; skipping caching adds ≈ $40/day more',
        '≈ $8,700/day with caching; caching does not change input cost',
        '≈ $870/day either way — caching only discounts output tokens'
      ],
      answer: [0],
      explanation: 'Per turn with caching: cached 3,000 × $0.30/Mtok = $0.0009; fresh 3,000 × $3/Mtok = $0.009; output 500 × $15/Mtok = $0.0075 → ≈ $0.0174/turn → × 50k ≈ $870/day. Without caching the stable 3k bills at $3/Mtok ($0.009 vs $0.0009), a delta of ≈ $0.0081/turn ≈ $405/day ≈ $12k/month — the decision-relevant number, and it falls out of one line of arithmetic. (B) is off by 10× — a classic $/Mtok slip. (C) inverts the discount: caching exists precisely to cut input cost. (D) is backwards — caching discounts INPUT tokens only; output is never cached.'
    },
    {
      text: 'Which task-to-model assignment best reflects the cost structure of early-2026 pricing?',
      options: [
        'Use one frontier model everywhere for consistency of behavior',
        'Frontier reasoning model for the rare hard escalations, mid-tier model for the main generation path, nano/mini-tier for high-volume classification and routing — cheapest model that clears each route\'s quality bar',
        'Nano-tier everywhere, since price-performance always wins',
        'Whichever model tops the public leaderboard this month, everywhere'
      ],
      answer: [1],
      explanation: 'Per-Mtok spreads between tiers are 10–90×, so portfolio routing is the dominant cost lever: match each route to the cheapest model clearing its measured bar. (A) pays flagship prices for classification — often ~90× overspend. (C) inverts the error: some routes genuinely need the frontier tier, and shipping under the quality bar costs more than tokens. (D) leaderboards inform the shortlist, not the assignment — and they say nothing about your task, latency, or cost.'
    },
    {
      text: 'Your Python service instantiates OpenAI() inside every request handler. Under load, latency rises and you see file-descriptor growth, but the provider dashboard shows normal API latency. What is happening?',
      options: [
        'The provider is silently throttling you',
        'Each per-request client creates a fresh connection pool: no keep-alive reuse, a TLS handshake per call, socket/FD churn, and no shared pooling — classic self-inflicted latency that profiles as network time. Instantiate one client per process',
        'Python garbage collection is pausing the event loop',
        'The SDK requires re-instantiation per request; the latency must come from elsewhere'
      ],
      answer: [1],
      explanation: 'SDK clients own a connection pool; per-request construction throws away keep-alive connections, pays 1–3 RTTs of TLS per call, and leaks descriptors under churn — while the provider correctly reports normal latency because each individual request, once connected, is fine. (A) contradicted by the dashboard and the FD symptom. (C) GC pauses don\'t explain FD growth. (D) backwards — the documented pattern for every major SDK is a long-lived module-level client.'
    },
    {
      text: 'Your wrapper retries 5 times; the SDK internally retries 3 times; the API gateway retries 2 times. A provider outage begins. How many attempts can one logical request generate, and what is the operational consequence?',
      options: [
        '5 attempts — the outermost retry policy wins',
        'Up to 5 × 3 × 2 = 30 attempts — multiplicative amplification that hammers the recovering provider, burns your rate limits, extends the incident, and inflates the bill. Configure retries in exactly one layer',
        '10 attempts — retry counts add: 5 + 3 + 2',
        'The layers detect each other and deduplicate automatically'
      ],
      answer: [1],
      explanation: 'Retry layers compose multiplicatively: every outer attempt triggers the full inner retry sequence. 30× amplification during an outage is how a provider blip becomes your own capacity incident and a billing surprise. (A) and (C) misunderstand the composition — inner layers run fully per outer attempt. (D) no such coordination exists across your code, the SDK, and a gateway; you must audit and disable all but one layer deliberately.'
    },
    {
      text: 'You need sub-second TTFT for an interactive feature, but also run 3-minute reasoning calls for a background analysis route, through the same client wrapper with one 30-second timeout. What is the right restructuring?',
      options: [
        'Set the global timeout to 300s so nothing gets killed',
        'Set the global timeout to 5s and retry the reasoning calls until they fit',
        'Per-route timeout budgets: the interactive route gets tight TTFT/total limits (streaming, stall detection), the background route gets a long total timeout (or moves to batch); a single global number cannot serve both',
        'Route both through the streaming API so timeouts no longer apply'
      ],
      answer: [2],
      explanation: 'Timeouts encode a route\'s latency contract; interactive and multi-minute workloads have opposite contracts, so per-route (often per-request-override) configuration is the only coherent answer — SDKs support this directly. (A) lets wedged interactive calls hang for 5 minutes. (B) a 3-minute computation never fits in 5s; retrying guarantees failure plus wasted spend. (D) streaming changes transport, not the need for deadlines — you still need TTFT and stall timeouts.'
    },
    {
      text: 'Which situations justify choosing an enterprise cloud route (Bedrock/Vertex/Azure) over a frontier lab\'s first-party API, despite lagging model availability? Choose TWO.',
      options: [
        'Your compliance requirements demand private networking (VPC endpoints), specific data-residency guarantees, and procurement through an existing cloud agreement',
        'You want day-zero access to every new model and API feature',
        'You need spend, auth (IAM), and audit to integrate with your existing cloud governance rather than a separate vendor relationship',
        'You want the lowest possible per-token price on frontier models',
        'You want to avoid rate limits entirely'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'Cloud routes exist for governance: network isolation, residency, compliance certifications, IAM integration, unified billing/committed-spend. Those regularly outweigh model lag for enterprises. (B) is the anti-reason — first-party APIs get models and features first. (D) prices are generally at parity or higher, not lower. (E) cloud routes have their own quota systems; rate limits are universal.'
    },
    {
      text: 'During a provider incident, your aggregator silently fails traffic over to a different vendor\'s model. Extraction-schema violations triple for the duration. What is the correct lesson?',
      options: [
        'Failover is inherently harmful; remove it and accept downtime',
        'Prompts are model-specific: failover targets must be limited to models your prompts have been eval-validated on, and failover activation must alert — otherwise resilience machinery silently swaps in an untested system',
        'The fallback model was defective; switch aggregators',
        'Schema violations were coincidental with the incident'
      ],
      answer: [1],
      explanation: 'Prompts do not transfer cleanly between models (module 3); a fallback you never evaluated is a second incident hiding behind the first. The fix is scoping the fallback list to validated models, running the eval per provider, and alerting when failover engages. (A) overcorrects — validated failover is a real resilience win. (C) the model isn\'t defective; it\'s different, which is the point. (D) tripled violations exactly bounded by the failover window is not coincidence.'
    },
    {
      text: 'Your finish_reason / stop_reason handling only checks for "stop". Which TWO unhandled cases will cause silent data corruption in a JSON-extraction pipeline?',
      options: [
        '"length" / "max_tokens" — output truncated mid-JSON, which then fails or (worse) half-parses downstream',
        '"tool_calls" / "tool_use" — the model is requesting a tool call; the content field is not the answer you expect',
        '"stop" arriving twice in one response',
        'A response with finish_reason in lowercase',
        'The absence of a finish_reason on streamed chunks before the final one'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'Truncation ("length") produces syntactically broken or — nastier — truncated-but-parseable JSON; tool-call stops mean the payload lives in tool_calls, not content, so naive content-readers see empty/irrelevant text. Both must branch. (C) doesn\'t occur — one terminal reason per choice. (D) reasons are lowercase strings normally. (E) is normal streaming behavior (finish_reason is null until the last chunk), not a corruption source if you await the terminal chunk.'
    },
    {
      text: 'You must pick a model for extracting 8 fields from 2M insurance documents monthly. Latency is irrelevant; budget is tight; errors above 2% cost real money. What is the defensible selection process?',
      options: [
        'Pick the current leaderboard #1 — accuracy matters most here',
        'Build a ~200-document labeled eval; run a frontier, a mid-tier, and a nano/mini model on it; compute error rate AND $/1k docs for each; choose the cheapest clearing the 2% bar, submit via batch API, and re-test quarterly as models improve',
        'Use the nano tier since the budget is tight, and fix errors manually',
        'Run all documents through two models and take the union of extractions'
      ],
      answer: [1],
      explanation: 'This is the selection framework end-to-end: requirements are explicit (2% error, cost-sensitive, async → batch −50%), the eval decides instead of leaderboards, and quarterly re-tests capture the falling capability floor. (A) leaderboards don\'t measure your documents, and the flagship may be 30–90× the cost for equal accuracy here. (C) picks cost first, quality never — 2M docs of manual fixing isn\'t a plan. (D) union-merging doubles cost and creates a conflict-resolution problem without an accuracy guarantee.'
    }
  ],
  flashcards: [
    { id: 'fc-system-channel', front: 'How do OpenAI, Anthropic, and Gemini each accept the system prompt?', back: 'OpenAI: a system/developer role message (Responses API: instructions field). Anthropic: top-level system PARAMETER — a system role in messages is a 400. Gemini: top-level systemInstruction; assistant role is called "model".' },
    { id: 'fc-anthropic-quirks', front: 'Three Anthropic Messages API quirks that break naive OpenAI ports?', back: 'max_tokens is REQUIRED; user/assistant turns must strictly alternate (merge consecutive same-role turns yourself); tool results are content blocks inside a USER message, not a dedicated tool role.' },
    { id: 'fc-responses-api', front: 'What does OpenAI\'s Responses API add over Chat Completions?', back: 'Typed input items, built-in tools (web search, code interpreter), and optional server-side conversation state (previous_response_id / store) so you send only the new turn. Chat Completions remains the cross-vendor de-facto interchange format.' },
    { id: 'fc-finish-reasons', front: 'The finish_reason/stop_reason values you must branch on?', back: 'stop/end_turn = natural; length/max_tokens = TRUNCATED (handle!); tool_calls/tool_use = continue the tool loop; content_filter/refusal = policy. Unhandled "length" is the classic broken-JSON bug.' },
    { id: 'fc-ttft', front: 'TTFT vs tokens/sec — and what improves each?', back: 'TTFT = network + queue + prefill → improve via prompt caching and shorter prompts. Tokens/sec = decode throughput → mostly provider hardware and model size (ASIC hosts like Groq reach 300–1000+ tok/s on open models).' },
    { id: 'fc-sse', front: 'What does an LLM SSE stream look like on the wire?', back: 'One HTTP response, Content-Type text/event-stream, "data: {json}" lines. OpenAI: deltas + terminal "data: [DONE]". Anthropic: named events — message_start, content_block_delta, message_delta (usage/stop_reason), message_stop, plus pings.' },
    { id: 'fc-midstream', front: 'Why is mid-stream error handling special?', back: 'The 200 status is sent BEFORE generation; failures arrive as in-band error events or silent connection closes. Detect completion via the terminal event; treat close-without-terminal as a partial; retries restart from token zero.' },
    { id: 'fc-stall', front: 'What timeout do streams need beyond a total deadline?', back: 'An inter-chunk (stall) timeout — no delta for 30–60s means a wedged connection that will never error on its own. Plus a TTFT deadline. A single whole-request timeout kills healthy long generations or tolerates hangs.' },
    { id: 'fc-limit-axes', front: 'The three rate-limit axes and when each binds?', back: 'RPM (binds on high-volume small calls), TPM — often split input/output, sometimes charged at admission from max_tokens (binds on long-context), concurrency/in-flight caps (binds on slow reasoning calls holding slots).' },
    { id: 'fc-jitter', front: 'Why must exponential backoff have jitter?', back: 'Clients that fail together retry together — synchronized waves re-trip the limit (thundering herd). Full jitter: sleep(random(0, min(cap, base×2^attempt))) decorrelates the fleet. Honor retry-after when the server sends it.' },
    { id: 'fc-retryable', front: 'Which errors do you retry, and which never?', back: 'Retry: 429, 500/502/503, 529, connection resets, timeouts (with idempotency care). Never blind-retry: 400 (malformed), 401/403 (auth), 404, content-policy refusals — they will fail identically forever.' },
    { id: 'fc-idempotency', front: 'Why do LLM retries need idempotency, and how?', back: 'Timeouts are ambiguous — the request may have completed. For side-effectful paths (quota recording, agent tool execution): idempotency keys where supported, else your own dedup keyed on content-hash + purpose, plus idempotent downstream consumers.' },
    { id: 'fc-batch', front: 'What do batch APIs trade, for what price?', back: 'Latency (up to 24h SLA) for 50% off input AND output at OpenAI and Anthropic, with separate larger quotas. The default answer for overnight/bulk workloads fighting interactive rate limits.' },
    { id: 'fc-prices-2026', front: 'Representative early-2026 list prices ($/Mtok in / out)?', back: 'GPT-5.x ~$1.25/$10 (cached in ~$0.125); Claude Opus 4.5 $5/$25, Sonnet $3/$15, Haiku $1/$5; Gemini 3 Pro ~$2/$12; open-weights hosts $0.1–1 in. Constants: output 3–8× input; cached in ~10–25%; batch −50%; reasoning tokens bill as output.' },
    { id: 'fc-cost-levers', front: 'The cost levers in order of typical impact?', back: '1) Smaller model per route where the eval allows (10–90×). 2) Prompt caching + prompt diet (2–10× on input-heavy). 3) Batch for async work (2×). 4) Output-length/reasoning-effort control. Wording tweaks are noise by comparison.' },
    { id: 'fc-landscape', front: 'Map the provider landscape in one breath (early 2026).', back: 'Frontier first-party: OpenAI, Anthropic, Google. Second tier/regional: Mistral, Cohere, xAI; open-weight leaders DeepSeek/Qwen/Llama. Open-weights hosts: Together, Fireworks, Groq, Cerebras. Aggregators: OpenRouter. Enterprise cloud: Bedrock, Vertex, Azure AI Foundry.' },
    { id: 'fc-selection', front: 'The model-selection framework?', back: 'Written requirements → own eval (50–200 real cases; leaderboards only shortlist) → three-tier shortlist (frontier/mid/small) → cheapest model clearing the bar, per route → re-run quarterly and on releases. Plus compliance/SLA screens for enterprise.' },
    { id: 'fc-client-once', front: 'The #1 SDK instantiation rule and why?', back: 'One client per process, module/container scope — clients own connection pools. Per-request construction = TLS handshake per call, no keep-alive, FD churn, and latency that profiles as "network" while the provider looks healthy.' },
    { id: 'fc-stacked-retries', front: 'What is retry stacking and the rule against it?', back: 'Wrapper retries × SDK-internal retries × gateway retries multiply (5×3×2 = 30 attempts/request during outages), amplifying incidents and bills. Configure retries in exactly ONE layer; audit sidecars/gateways where hidden policies live.' },
    { id: 'fc-latency-debug', front: 'Latency spiked, provider dashboard green — debugging order?', back: 'Client-side queueing first (pool waits, semaphore, event loop blocked by sync-in-async), then retry amplification, then per-attempt timeout math (attempts share the deadline), then TTFT-vs-decode split from your metrics, then the provider.' }
  ],
  lab: {
    title: 'Speak the wire: raw SSE, a correct retry loop, and a cost meter',
    intro: '<p>Three exercises against real APIs: read the raw SSE stream with no SDK sugar, build (and test) backoff-with-jitter by provoking real 429s safely, and turn usage fields into a per-request cost meter. Works with any OpenAI-compatible endpoint; Anthropic variants noted.</p><p><b>Needs:</b> <code>python3</code>, <code>curl</code>, an API key. Worst case ~$0.30.</p>',
    steps: [
      {
        title: 'Watch raw SSE with curl (no SDK)',
        html: '<pre><code>curl -N https://api.openai.com/v1/chat/completions \\\n  -H "Authorization: Bearer $OPENAI_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"gpt-4o-mini","stream":true,\n       "stream_options":{"include_usage":true},\n       "messages":[{"role":"user","content":"Count from 1 to 15 slowly, one number per line."}]}\'</code></pre>' +
          '<p>Observe: <code>data:</code> lines with content deltas, <code>finish_reason</code> null until the final chunk, the usage object arriving at the END, and the terminal <code>data: [DONE]</code>. Now press Ctrl-C halfway through — that abrupt close is exactly what your code sees during a mid-stream failure: no error status, no [DONE]. If you have an Anthropic key, repeat against <code>/v1/messages</code> (headers <code>x-api-key</code> + <code>anthropic-version: 2023-06-01</code>, body with <code>"stream": true, "max_tokens": 200</code>) and compare the named-event grammar: <code>message_start</code>, <code>content_block_delta</code>, <code>message_stop</code>.</p>'
      },
      {
        title: 'Backoff with jitter, tested against a fake 429 wall',
        html: '<p>Never load-test a real provider\'s limiter. Instead, wrap the call in a harness that injects 429s, and verify your policy: full jitter, retry-after honored, attempt cap, only-retryable-errors.</p>' +
          '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport random, time\n\nclass Fake429(Exception):\n    def __init__(self, retry_after=None): self.retry_after = retry_after\n\ncalls = {"n": 0}\ndef flaky_llm_call():\n    calls["n"] += 1\n    if calls["n"] &lt;= 3:                      # first 3 attempts throttled\n        raise Fake429(retry_after=1 if calls["n"] == 2 else None)\n    return "ok after %d attempts" % calls["n"]\n\ndef call_with_retry(fn, max_attempts=6, base=0.5, cap=8.0):\n    for attempt in range(max_attempts):\n        try:\n            return fn()\n        except Fake429 as e:\n            if attempt == max_attempts - 1: raise\n            if e.retry_after is not None:\n                delay = e.retry_after            # server knows best\n            else:\n                delay = random.uniform(0, min(cap, base * 2 ** attempt))  # full jitter\n            print(f"attempt {attempt+1}: 429, sleeping {delay:.2f}s")\n            time.sleep(delay)\n\nprint(call_with_retry(flaky_llm_call))\nEOF</code></pre>' +
          '<p>Then swap <code>flaky_llm_call</code> for a real SDK call — and FIRST check your SDK\'s built-in retry config (e.g. <code>max_retries</code>) so you configure retries in exactly one layer. Run the harness 10 times and note how jitter makes every run\'s delay sequence different: that variance is the anti-stampede property.</p>'
      },
      {
        title: 'A per-request cost meter from usage fields',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nfrom openai import OpenAI\nc = OpenAI()\n\nPRICE = {"gpt-4o-mini": {"in": 0.15, "cached": 0.075, "out": 0.60}}  # $/Mtok — update from the live pricing page\n\ndef metered(model, messages, **kw):\n    r = c.chat.completions.create(model=model, messages=messages, **kw)\n    u = r.usage\n    cached = getattr(u.prompt_tokens_details, "cached_tokens", 0) or 0\n    p = PRICE[model]\n    cost = ((u.prompt_tokens - cached) * p["in"] + cached * p["cached"]\n            + u.completion_tokens * p["out"]) / 1e6\n    print(f"in={u.prompt_tokens} (cached={cached}) out={u.completion_tokens} "\n          f"cost=${cost:.6f}")\n    return r\n\nSYS = "You are a meticulous analyst. " * 80   # stable prefix &gt; 1024 tokens\nfor q in ["Summarize the benefits of connection pooling in two sentences.",\n          "Now do the same for request batching.",\n          "And for prompt caching."]:\n    metered("gpt-4o-mini", [{"role":"system","content":SYS},\n                            {"role":"user","content":q}], max_tokens=80)\nEOF</code></pre>' +
          '<p>By the second call you should see <code>cached</code> jump and cost drop. Extend the experiment: set <code>max_tokens=15</code> and watch <code>finish_reason</code> become <code>"length"</code> — then make your meter flag truncations, because that flag is the difference between this toy and a production cost/health dashboard. Log line format matters: model, route, prompt version, tokens, cached, cost — that is the schema your future dashboards will query.</p>'
      }
    ],
    costNote: 'Worst case ≈ $0.30: the SSE step streams a few hundred tokens; the retry harness makes zero real API calls until you opt in; the cost meter sends ~4k tokens total on gpt-4o-mini-class pricing. Nothing persistent is created — no cleanup. Free variant: run steps 1 and 3 against a local Ollama server (no usage.cached_tokens field, but the stream grammar is identical).'
  }
});
