COURSE.register({
  id: 'm18-cost-latency',
  track: 'advanced',
  order: 18,
  title: 'Cost & latency engineering',
  short: 'Cost & latency',
  tagline: 'Routing, caching, cascades, token dieting, and streaming — the discipline that decides whether your AI feature has a gross margin.',
  minutes: 120,
  lessons: [
    {
      id: 'model-routing',
      title: 'Model routing: the right model per request',
      blurb: 'Complexity classifiers, rule-based vs learned routers, and what the savings actually measure out to.',
      html: '<h2>The core observation: traffic is bimodal</h2>' +
        '<p>Pull a day of production prompts and classify them by difficulty. Every team that does this finds the same shape: a large majority of requests are easy — greetings, rephrasing, simple extraction, questions answered verbatim in the provided context — and a minority genuinely need frontier reasoning. As of early 2026, the price spread between tiers is enormous: small models run $0.05–0.50/Mtok input while frontier models run $3–15/Mtok input and $15–75/Mtok output — a 30–100× gap. Serving easy traffic on the expensive model is the single largest avoidable line item in most AI products. Routing is the fix: a decision layer in front of N models that picks per request.</p>' +
        '<p>Three router families, in ascending sophistication:</p>' +
        '<ul>' +
        '<li><b>Rule-based:</b> route on observable request features — endpoint, prompt length, presence of code blocks, user tier, feature flag, language. Five lines of code, fully debuggable, zero added latency. This captures a surprising fraction of the win because <em>which feature the request came from</em> is a strong difficulty proxy: the "summarize this ticket" button never needs the frontier model; the "architect my migration" flow always does.</li>' +
        '<li><b>Learned routers:</b> a small classifier (fine-tuned encoder or a cheap LLM) scores each prompt for difficulty, routing above-threshold traffic upward. The public benchmark line, as of early 2026: RouteLLM-style routers report holding ~95% of frontier-quality scores while cutting frontier-model calls enough to save 40–85% on the routed workload. Treat vendor "85% savings" claims as the optimistic end measured on benchmark mixes — your distribution differs. The threshold is a product decision: it is literally a quality/cost dial.</li>' +
        '<li><b>Escalate-on-failure:</b> do not predict difficulty — detect failure. Send everything to the cheap model, validate the output (schema check, groundedness check, judge score, user retry signal), and re-run failures on the big model. No classifier to train, and it is self-correcting as models improve. Cost: added latency on the escalated fraction (two sequential calls) — fine for async, painful for interactive.</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Routing is a prediction; escalation is a measurement. Predictive routers are fast but wrong on the margin; escalation is slow on the margin but never over-serves an easy request. Mature stacks combine them: rules for the obvious, a learned router for the middle, escalation as the safety net.</div>' +
        '<h2>Building it without regretting it</h2>' +
        '<p>Operational requirements that separate a router from a liability:</p>' +
        '<ul>' +
        '<li><b>Per-route evals before flipping traffic.</b> The router changes which model answers, so every routed feature needs its eval run against the cheap model <em>first</em> (module 11). "The small model is fine for this" is an empirical claim, not a vibe.</li>' +
        '<li><b>Log the routing decision</b> (route taken, classifier score, model version) on every request. When quality complaints arrive, the first question is "which model actually answered?" — teams without this field burn days rediscovering it.</li>' +
        '<li><b>Prompt portability is not free.</b> Prompts tuned on one model degrade on another (different instruction-following quirks, different format adherence). Budget a prompt-adaptation pass per route target, and keep per-model prompt variants versioned together (module 19).</li>' +
        '<li><b>Sticky sessions:</b> mid-conversation model switches change tone and capability visibly. Route per conversation, or only upgrade (never downgrade) mid-session.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A support-bot team shipped a learned router trained on their eval set and celebrated a 60% cost cut. Two weeks later CSAT dipped: the router had learned "short prompt = easy" and was sending terse-but-hard questions ("refund policy edge case, annual plan, EU?") to the small model. Short is not easy. They added an escalate-on-low-groundedness check behind the router and recovered quality while keeping 45% of the savings. Routers need the same regression evals as prompts — they are behavior, not plumbing.</div>' +
        '<h2>What the savings look like in practice</h2>' +
        '<p>Realistic early-2026 arithmetic for a support assistant doing 1M requests/month, avg 2k input + 500 output tokens: all-frontier at ~$3/$15 per Mtok ≈ $13.5k/month. Route 70% of traffic to a $0.15/$0.60 small model: ≈ $4.6k/month — a 66% cut, before caching or dieting. Numbers like these are why routing is usually the <em>first</em> optimization: it needs no product changes and compounds with everything else in this module. The honest caveats: routing adds a component that can misfire, savings shrink if your traffic skews genuinely hard, and every new model release changes the optimal split — re-benchmark the router quarterly, because the capability floor rises (module 1: distillation) and yesterday\'s "needs frontier" tasks become today\'s small-model tasks.</p>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your LLM bill is $80k/month — walk me through cutting it" is now a standard senior interview. Lead with measurement (per-feature cost breakdown), then routing with an eval-gated rollout, then caching/dieting. Candidates who jump straight to "use a smaller model everywhere" fail the quality-protection half of the question.</div>'
    },
    {
      id: 'semantic-caching',
      title: 'Semantic caching: hit rates, invalidation, and the near-miss trap',
      blurb: 'Exact vs embedding-similarity caches — and why a 0.92 similarity hit can be a lawsuit.',
      html: '<h2>Two caches, two risk profiles</h2>' +
        '<p>LLM calls are expensive and slow; caching is the classic answer. But "cache" covers two very different mechanisms, and conflating them causes incidents:</p>' +
        '<ul>' +
        '<li><b>Exact-match caching:</b> key = hash(model + prompt + params). Hit ⇒ return the stored response. Zero correctness risk (same input, same cached output), trivial to implement, and useless the moment inputs vary by even a whitespace change. Works brilliantly for deterministic sub-calls inside pipelines: classification of canonical strings, embedding lookups, repeated tool descriptions. (Note: distinct from <em>provider-side prompt caching</em>, which discounts re-processing of shared prompt <em>prefixes</em> — up to 90% off cached input tokens as of early 2026 — but still runs the model. Different layer, complementary, covered in module 3.)</li>' +
        '<li><b>Semantic caching:</b> embed the incoming query; if a stored query\'s embedding is within a similarity threshold (typically cosine ≥ 0.92–0.97), serve its stored response without calling the model. This is the one with real upside — paraphrases hit — and real danger, because <b>similar embedding ≠ same answer</b>.</li>' +
        '</ul>' +
        '<h2>The near-miss problem is the whole problem</h2>' +
        '<p>Embedding similarity measures topical closeness, not answer equivalence. The canonical failure pairs sit around 0.93–0.97 cosine: "Can I cancel my subscription?" vs "How do I cancel my subscription?" (same answer — great hit) but also "reset my password" vs "reset my colleague\'s password" (different answer, different <em>authorization</em>), "fees for wire transfers" vs "fees for international wire transfers", and any pair differing by a negation, an entity, a number, or a date. Serving the cached answer for the second member of those pairs is not a latency win, it is a wrong answer delivered instantly and confidently — with your product\'s name on it.</p>' +
        '<p>Mitigations that hold up in production:</p>' +
        '<ol>' +
        '<li><b>Threshold per traffic class, tuned on labeled pairs.</b> Collect (query A, query B, same-answer?) labels from real traffic and pick the threshold where false-hit rate is acceptable <em>for that feature</em>. A marketing FAQ tolerates 2% false hits; a billing bot tolerates ~0%.</li>' +
        '<li><b>Entity/negation guards:</b> cheap pre-checks that block a hit when the candidate pair differs in extracted entities, numbers, dates, or negation — catches most of the dangerous near-misses for tenths of a cent.</li>' +
        '<li><b>Verification hits:</b> on a near-threshold hit, have a tiny model answer "do these two questions have the same answer? yes/no" before serving. Costs ~$0.0001; converts the worst risk band into a small model call.</li>' +
        '<li><b>Scope keys ruthlessly:</b> cache key must include tenant, user role/entitlements, locale, and model+prompt version. A cross-tenant cache hit is a data leak, full stop (module 19).</li>' +
        '</ol>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A fintech support bot cached "what are your transfer limits?" and served it — for weeks — to users asking about <em>their</em> transfer limits, which were account-specific. Embedding similarity: 0.96. Nobody noticed until a user with a restricted account wired money based on the generic answer. The postmortem finding: any query whose answer depends on caller identity must be uncacheable or per-user-keyed. Classify cacheability at the feature level, not the query level.</div>' +
        '<h2>Hit-rate realities and invalidation</h2>' +
        '<p>Semantic cache ROI is entirely a function of traffic shape. Realistic hit rates as of early 2026: <b>FAQ-style support</b> 20–40% (users ask the same 500 things forever), <b>search/lookup-style queries</b> 10–25%, <b>freeform generation</b> (writing, coding, analysis on user-specific content) &lt;5% — often not worth the infrastructure and the false-hit risk at all. Measure before building: embed a week of production queries, cluster them, and the cluster mass above your threshold <em>is</em> your ceiling hit rate.</p>' +
        '<p>Invalidation is where caches rot. LLM answers are functions of (model, prompt template, retrieved knowledge, policy). When any of those change, cached responses are stale — and semantically cached responses stay stale <em>silently</em>. Non-negotiables: version the cache key with model id + prompt version + knowledge-base snapshot id, so deploys naturally cold-start the cache; TTLs matched to content volatility (pricing answers: hours; product how-tos: weeks); and an explicit purge hook wired into your knowledge-base update pipeline. Teams consistently over-invest in hit rate and under-invest in invalidation — the failure mode of a stale cache (confidently outdated answers after a policy change) is worse than the failure mode of a cold one (paying for a model call).</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Do the math before building: cache infra (vector store + embedding calls at ~$0.02–0.13/Mtok + eng time) vs savings (hit_rate × avoided_call_cost). At a 25% hit rate on $0.002 calls and 100k requests/day, you save ~$50/day — real, but only if false hits don\'t cost you one support escalation a day. At &lt;10% hit rate on cheap-model traffic, semantic caching is usually negative ROI. Cache the expensive calls, not all calls.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> The probe is always the near-miss: "your semantic cache returns a wrong answer for a similar-looking query — walk me through the failure and the fix." Strong answers name the topical-similarity vs answer-equivalence gap, per-class thresholds, entity guards, and identity-scoped keys. Bonus: knowing that negations and entity swaps live exactly in the danger band of cosine similarity.</div>'
    },
    {
      id: 'cascades',
      title: 'Cascades: cheap first, verify, escalate',
      blurb: 'Draft-then-polish, verifier-gated escalation, and when a cascade beats a router.',
      html: '<h2>The cascade pattern</h2>' +
        '<p>A cascade runs the cheap model <em>first</em> on every request, checks the result, and only invokes the expensive model when the check fails. Where a router predicts difficulty upfront, a cascade discovers it empirically per request. The economics work whenever (cheap_cost + check_cost) + failure_rate × expensive_cost &lt; expensive_cost — which, with small models at 1–3% of frontier price as of early 2026, holds even at surprisingly high failure rates. A cascade with a 30% escalation rate still cuts spend ~65% versus all-frontier.</p>' +
        '<p>Everything hinges on the <b>verifier</b> — the check between tiers. Verifiers, in ascending cost:</p>' +
        '<ul>' +
        '<li><b>Deterministic checks (~free):</b> schema validation, required fields present, output parses, code compiles, tests pass, citations resolve to real sources, regex/enum constraints. Use these whenever the task has any checkable structure — they are the highest-precision verifiers you will ever get.</li>' +
        '<li><b>Self-reported confidence (cheap, weak):</b> ask the small model to rate its own confidence, or read logprobs on short outputs. Miscalibrated — models are confident when wrong — but usable as a coarse first filter for short factual/classification outputs.</li>' +
        '<li><b>Model-as-judge (~$0.0001–0.001):</b> a small judge model scores the draft against a rubric (grounded? complete? on-policy?). The workhorse verifier for freeform outputs; needs its own eval (module 11) because judges have blind spots and systematically favor fluent-but-wrong drafts if the rubric is loose.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why cascades work at all: verification is usually easier than generation. Checking that code passes tests, that a summary is entailed by its source, or that a JSON matches a schema requires far less capability than producing it — so a weak verifier can gate a weak generator reliably. When verification is <em>as hard as</em> generation (open-ended strategy advice, nuanced judgment calls), cascades lose their edge; that traffic should be routed to the big model directly.</div>' +
        '<h2>Draft-then-polish and other shapes</h2>' +
        '<p>The escalate-on-failure cascade discards the cheap draft. Two variants keep it:</p>' +
        '<ul>' +
        '<li><b>Draft-then-polish:</b> the small model produces a full draft; the large model edits rather than regenerates ("fix errors, improve precision, keep structure"). The big model reads mostly and writes little — and since input tokens are 3–5× cheaper than output tokens, editing is structurally cheaper than generating. Strong for long-form content, summaries, and report generation; weak when the draft\'s <em>structure</em> is wrong, because polishing inherits skeletons.</li>' +
        '<li><b>Best-of-n with a picker:</b> sample the cheap model 3–5 times, have a judge pick the best. Exploits output variance: on tasks where the small model is right 60% of the time per sample, the best of 4 clears 85%+ if the judge can tell. Total cost still well under one frontier call. (This is test-time compute economics applied downmarket — same logic as module 21.)</li>' +
        '<li><b>Speculative UX:</b> show the cheap draft immediately (labeled as draft), swap in the polished version when ready. Users get instant response; you get the quality of the big model. Works only where a visibly-updating answer is acceptable.</li>' +
        '</ul>' +
        '<h2>Cascade vs router: choosing</h2>' +
        '<table><tr><th></th><th>Router</th><th>Cascade</th></tr>' +
        '<tr><td>Latency on hard requests</td><td>One call (good)</td><td>Two sequential calls (bad for interactive)</td></tr>' +
        '<tr><td>Cost on easy requests</td><td>One cheap call</td><td>One cheap call + verifier</td></tr>' +
        '<tr><td>Wrong-tier failure mode</td><td>Easy req over-served ($) or hard req under-served (quality)</td><td>None on quality — failures escalate by construction (if the verifier catches them)</td></tr>' +
        '<tr><td>Needs training/tuning</td><td>Classifier + threshold</td><td>Verifier + its eval</td></tr>' +
        '<tr><td>Best for</td><td>Interactive, latency-sensitive</td><td>Async/batch, verifiable outputs</td></tr></table>' +
        '<p>The two also compose cleanly: route the obviously-easy and obviously-hard tails by rule, and run the ambiguous middle through a cascade — the router keeps latency sane where prediction is confident, and the cascade guarantees quality where it is not.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team built a summarization cascade with an LLM judge asking "is this summary high quality?" Escalation rate: 2%. Sounds great — except a manual audit found 20% of accepted drafts had factual errors the judge waved through, because "high quality" scored fluency. Rewriting the rubric to three binary checks ("every claim entailed by source? all key figures present? no invented numbers?") raised escalation to 18% and cut audited error rate 6×. Vague judge rubrics fail silent; binary rubrics fail loud. The verifier is a product surface — eval it like one.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Expect "design a system that keeps quality but cuts cost 70%." The strong answer composes: route the obviously-easy, cascade the verifiable middle with a rubric-based judge, reserve frontier for the hard tail, and show the escalation-rate math. Naming the verification-is-easier-than-generation asymmetry is the senior signal.</div>'
    },
    {
      id: 'token-dieting',
      title: 'Token dieting: the 8× bloat audit',
      blurb: 'Prompt compression, history caps, output control, and tool-output trimming — the cheapest optimization you are not doing.',
      html: '<h2>Where the bloat lives</h2>' +
        '<p>Before any clever architecture, run the boring audit: log full request payloads for a day, then read twenty of them token by token. Nearly every team finds the same offenders, and the composite is routinely a prompt <b>5–10× larger than the information it carries</b> (the "8× bloat audit" — the number is anecdotal but the order of magnitude is not):</p>' +
        '<ul>' +
        '<li><b>Tool outputs dumped raw.</b> The #1 offender in agents. A "list files" tool returns 400 entries with timestamps and permissions when the model needed 12 names. A SQL tool returns 200 rows when the answer needed 5 plus a count. An HTTP tool returns full HTML — headers, nav bars, cookie banners — for one paragraph of content. Fix at the tool boundary: every tool should return the <em>minimum sufficient</em> representation (truncate + summarize + "call again with page=2 for more"), because a token entering history is paid for on <em>every subsequent turn</em>.</li>' +
        '<li><b>Unbounded chat history.</b> Resending 40 turns verbatim when the last 6 plus a summary would do. Cap history by token budget, not turn count; compact older turns into a rolling summary (module 8); drop stale tool results entirely (a file listing from 20 turns ago is dead weight — the model can re-list if needed).</li>' +
        '<li><b>System-prompt sprawl.</b> Prompts accrete: every incident adds a paragraph, nobody deletes. 3,000-token system prompts with duplicated rules, dead examples for removed features, and few-shot examples where two would do. Prompts need refactoring sprints like code does — and an eval suite so deletions are safe (module 11).</li>' +
        '<li><b>Over-retrieval.</b> Top-10 chunks stuffed into context when reranked top-3 scores identically on your eval. Retrieval k is a cost dial most teams have never turned.</li>' +
        '<li><b>Uncontrolled output.</b> Output tokens cost 3–5× input. Models pad: preambles ("Certainly! Here is…"), restated questions, apologetic codas. Fixes: "answer only, no preamble" instructions, structured outputs with tight schemas (an enum field cannot ramble), <code>max_tokens</code> as a hard stop, and length hints ("in ≤3 sentences") which models follow imperfectly but meaningfully.</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Every token must pay rent, and history tokens pay rent <em>every turn</em>. The audit question for each span of the payload: "would removing this change the output?" If you cannot answer, your eval suite is the gap — fix that first, then diet aggressively behind it.</div>' +
        '<h2>Compression techniques, honestly ranked</h2>' +
        '<p>In descending ROI, as of early 2026:</p>' +
        '<ol>' +
        '<li><b>Deletion</b> (free, biggest win): trim tool outputs, cap history, cut dead prompt text, lower retrieval k. Typically 3–6× on agent workloads.</li>' +
        '<li><b>Provider prompt caching</b> (up to 90% off cached prefix reads): order your prompt static-first (system → tools → few-shot → variable user content) so the prefix caches across requests. Free money for high-QPS features; covered in module 3 but it belongs in every diet plan.</li>' +
        '<li><b>Summarize-then-process:</b> a cheap model compresses long inputs (transcripts, logs, threads) before the expensive model reasons over them. Two-stage, but 10:1 compression at 1/30th the token price nets out hugely positive for long-input workloads.</li>' +
        '<li><b>LLMLingua-style learned compression</b> (drop low-information tokens via a small LM; 2–5× claimed with modest quality loss): real, but adds a component, garbles prompts with exact strings (code, IDs, legal text), and deletion usually gets there first. Reach for it only after 1–3 are exhausted.</li>' +
        '</ol>' +
        '<h2>Output control is latency control</h2>' +
        '<p>Decode speed is roughly constant per token (module 15), so <b>output length ≈ latency</b>: a 600-token answer takes ~2× the wall clock of a 300-token answer on the same stack. Cutting flab from outputs is the rare optimization that improves cost, latency, <em>and</em> UX simultaneously (users hate scrolling through preamble). Concrete moves: schema-constrained outputs for anything machine-consumed; "no preamble/no recap" system rules; per-feature <code>max_tokens</code> budgets set from the P95 of <em>useful</em> output length, not the default 4k; and for reasoning models, cap or tune the thinking budget per task tier — unbounded reasoning tokens on trivial requests is the new silent budget leak (module 21).</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> An agent team\'s P95 request hit 60k tokens and $0.45/session. The audit found one tool — a log-search returning 30k tokens of raw JSON per call — responsible for 70% of spend. The fix was twelve lines: return top-20 matches, truncate each to 200 chars, append "1,847 more matches; refine query to narrow". Session cost fell to $0.09, and task success <em>rose</em> — the model had been losing the needle in its own haystack (lost-in-the-middle, module 8). Bloat is a quality problem wearing a cost costume.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Diet targets worth pinning to the wall, as of early 2026: chat turn ≤4k input tokens for simple assistants; agent tool outputs ≤1–2k tokens each; system prompts ≤1.5k unless evals justify more; retrieval k ≤5 post-rerank; output budgets per feature, enforced by <code>max_tokens</code>. Teams that publish these as SLO-style budgets keep them; teams that rely on vigilance regress within a quarter.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your agent costs 10× the estimate — first hour of investigation?" The expected answer is an audit, not an architecture: log payloads, rank spans by tokens, find the raw tool dump or unbounded history, fix at the source. Jumping to "switch providers" or "add caching" before measuring is the anti-pattern being screened for.</div>'
    },
    {
      id: 'streaming-ux',
      title: 'Streaming UX: engineering perceived latency',
      blurb: 'TTFT vs total time, optimistic UI, and the cases where streaming makes things worse.',
      html: '<h2>Two latencies, one that matters per surface</h2>' +
        '<p>Every LLM response has two numbers: <b>TTFT</b> (time to first token) and <b>total generation time</b>. Users experience them completely differently. For conversational surfaces, perceived responsiveness is dominated by TTFT: a response that starts in 400 ms and streams for 8 s <em>feels faster</em> than one that appears complete at 4 s, because feedback arrived 10× sooner and reading overlaps generation — the user is consuming tokens while you produce them. Streaming converts dead wait into useful time. That is the entire psychology, and it is worth roughly a 2–5× perceived-latency improvement for zero model cost.</p>' +
        '<p>TTFT engineering, in rough order of leverage as of early 2026:</p>' +
        '<ul>' +
        '<li><b>Prompt caching:</b> prefill dominates TTFT on long prompts; a cached prefix skips most of it. A 20k-token cached system+tools prefix can cut TTFT from ~2 s to a few hundred ms.</li>' +
        '<li><b>Shorter prompts</b> (the diet from the previous lesson) — prefill is O(prompt length).</li>' +
        '<li><b>Smaller/faster models for the first response</b> — routing and TTFT goals align.</li>' +
        '<li><b>Kill pre-LLM serial steps:</b> auth, retrieval, moderation queued serially before the call each add their latency to TTFT. Parallelize moderation with generation (cancel on flag), overlap retrieval with a "thinking" state, precompute what you can.</li>' +
        '<li><b>Provider/deployment choice:</b> TTFT varies 200 ms–2 s+ across providers and regions for comparable models; measure with your own prompts, at your own P95, in your own region — published medians are marketing.</li>' +
        '</ul>' +
        '<h2>Optimistic UI and the theater of progress</h2>' +
        '<p>Perceived latency is a UX budget you can spend anywhere in the flow, not just at the token layer:</p>' +
        '<ul>' +
        '<li><b>Acknowledge instantly:</b> echo the user\'s message into the transcript and show a state change (&lt;100 ms) before any backend work. The spinner starts the clock in the user\'s head; a state change resets it.</li>' +
        '<li><b>Stage the wait with real states:</b> "Searching your documents… reading 3 files… drafting" — honest pipeline states (not fake progress bars) make a 6 s agent feel legible instead of hung. Agents and tool-use flows especially: stream <em>activity</em>, even when you cannot yet stream tokens.</li>' +
        '<li><b>Skeleton the answer shape:</b> render the response scaffold (title, sections, citation slots) as structure becomes known, filling in as tokens land.</li>' +
        '<li><b>Speculate cheaply:</b> for high-probability next actions (the user will likely click "summarize"), prefetch on hover or precompute in idle time. Wasted speculative calls at small-model prices are often cheaper than the latency they save is valuable.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Streaming is server-sent events / chunked HTTP under the hood, and the plumbing is where it breaks: proxies and load balancers buffer responses unless told not to (nginx <code>proxy_buffering off</code>, no gzip on the stream path), serverless platforms historically buffered whole responses (mostly fixed as of early 2026, but verify yours), and mobile clients need reconnect-and-resume logic for dropped streams mid-generation. Test streaming through your <em>full</em> production path — it works on localhost for everyone.</div>' +
        '<h2>When NOT to stream</h2>' +
        '<p>Streaming is a default, not a law. Cases where it actively hurts:</p>' +
        '<ul>' +
        '<li><b>Post-processed outputs:</b> if you validate, moderate, or transform the full response before display (structured JSON rendered into UI components, guardrail checks on completed text, code that must parse), streaming raw tokens shows users content you have not vetted — including the sentence your moderation layer would have blocked. Stream to your server, deliver atomically to the client, or stream with a re-render-on-final pass.</li>' +
        '<li><b>Machine consumers:</b> API responses feeding downstream systems gain nothing from partial JSON; they gain parse errors. Batch-shaped work wants complete responses.</li>' +
        '<li><b>Flickery structured UX:</b> streaming into tables/cards that reflow on every token reads as glitchy. Stream per-cell or per-section, or do not stream.</li>' +
        '<li><b>Retry-heavy pipelines:</b> if 20% of outputs fail validation and regenerate, users watching attempt #1 stream and then vanish is worse than a 2 s silent wait for a clean attempt #2.</li>' +
        '<li><b>Very short outputs:</b> for a 15-token classification, TTFT ≈ total time; streaming adds plumbing for nothing.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team streamed answers and ran moderation on the completed text, retroactively deleting violating messages. Users screenshot fast. A flagged response lived on screen for 4 s before deletion — long enough to become a social-media thread. The fix: hold-and-release streaming (server buffers a 1–2 sentence sliding window through the moderation classifier, releases with ~300 ms added latency). Guardrails must sit <em>upstream</em> of pixels, even when streaming.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Latency is 6 s and users are churning — go." Structure the answer: measure TTFT vs generation split first; if TTFT-heavy → caching/prompt diet/parallelize pre-steps; if generation-heavy → shorter outputs, faster model, streaming + staged UX for perception. Knowing the when-not-to-stream list separates product-minded seniors from demo builders.</div>'
    },
    {
      id: 'batch-and-cost-culture',
      title: 'Batch APIs and the cost-review culture',
      blurb: 'The 50% async discount, unit economics per feature, and cost gates in CI.',
      html: '<h2>Batch APIs: half price for patience</h2>' +
        '<p>Every major provider ships a batch tier as of early 2026: submit a file of requests, get results within a window (commonly 24 h, often much faster in practice — minutes to hours at off-peak), pay <b>~50% of interactive price</b>, with separate (and more generous) rate limits. The discount exists because batch traffic lets providers fill scheduling valleys and run high-utilization inference; you are being paid to be flexible. Batch also composes with everything else: batched requests to a routed small model with dieted prompts stack all three discounts.</p>' +
        '<p>The engineering question is not "is batch cheaper" — it is <b>"which of my workloads are secretly async?"</b> More than most teams think: nightly document ingestion and re-embedding, eval suite runs, LLM-judge scoring, dataset labeling and synthetic-data generation, content pre-generation (SEO pages, product descriptions, email drafts for tomorrow\'s send), re-processing after a prompt fix, backfills after schema changes. A useful forcing question in design review: "does a human wait on this response within 60 seconds?" If no, it defaults to batch unless argued otherwise.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Batch job patterns that save pain: make every request idempotent with your own <code>custom_id</code> (results return unordered and jobs partially fail — you will re-submit subsets); shard giant jobs into multiple files so one poison request cannot fail a whole night\'s work; poll with backoff or use completion webhooks; and build the "collect results → validate → re-batch failures" loop as a first-class pipeline, because at 1M requests, a 0.5% failure rate is 5,000 retries — a script, not a shrug.</div>' +
        '<h2>Unit economics: cost per feature, per outcome</h2>' +
        '<p>The most important cultural artifact in this module is a boring spreadsheet: <b>per-feature unit economics</b>. For each AI feature: cost per request (P50 and P95 — the tail is where agents live), requests per active user, therefore cost per user per month, set against the revenue or value per user. The number of teams that discover their $12/seat product spends $19/seat on inference for its power users — after launch — is not small. The math takes an afternoon; run it at design time, and re-run it from production telemetry, because prompt growth and history creep move it monthly.</p>' +
        '<p>To make it possible, <b>tag every LLM call</b> with feature, tenant, model, and prompt-version metadata at the gateway (module 19 covers gateway patterns). Untagged spend is unmanageable spend: when the bill doubles, "which feature did that?" must be a dashboard filter, not an investigation. Per-tenant attribution doubles as your noisy-neighbor and pricing-tier instrumentation.</p>' +
        '<table><tr><th>Metric</th><th>Definition</th><th>Who watches it</th></tr>' +
        '<tr><td>$/request (P50, P95)</td><td>Per feature, all retries and tool calls included</td><td>Eng, weekly</td></tr>' +
        '<tr><td>$/active user/month</td><td>Feature cost × usage distribution</td><td>PM + finance, monthly</td></tr>' +
        '<tr><td>$/successful outcome</td><td>Cost ÷ tasks actually completed (failures included in numerator)</td><td>The metric that matters — quality regressions show up here as cost spikes</td></tr>' +
        '<tr><td>Tokens/request trend</td><td>Bloat creep detector</td><td>Eng, per deploy</td></tr></table>' +
        '<h2>Cost regression gates: treat spend like latency</h2>' +
        '<p>Mature teams stopped treating cost as a monthly finance surprise and moved it into the engineering loop, exactly like latency budgets:</p>' +
        '<ul>' +
        '<li><b>CI gate on token counts:</b> your eval suite (module 11) already replays a fixed request set per PR. Record tokens in/out per scenario; fail (or flag for review) any PR that moves total expected cost beyond a threshold, e.g. +15%. This catches the innocent prompt paragraph, the accidental top_k 5→20, the tool that started returning raw JSON — <em>before</em> deploy, on a diff, with a culprit attached.</li>' +
        '<li><b>Production budget alerts</b> per feature per day, plus anomaly alerts on $/request (a retry loop turning 1 call into 6 shows up here within an hour, not on the invoice).</li>' +
        '<li><b>Hard spend caps</b> per API key/environment at the provider or gateway level — the last line against runaway loops. An agent stuck in a retry cycle over a weekend is a five-figure invoice; a $200/day cap on the staging key is a config line. Set caps before you need them; nobody sets them after calmly.</li>' +
        '<li><b>A quarterly re-price review:</b> model prices fall and capabilities shift quarter over quarter as of early 2026 — the routing split, the "too hard for the small model" list, and the batch/interactive boundary all deserve scheduled re-examination. Last year\'s optimal architecture is this year\'s overspend.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A growth team added "one more example" to a high-traffic prompt to fix an edge case — +900 tokens on a call made 4M times/month. Nobody noticed for six weeks: it sailed through review (correctness fine), through evals (quality fine), and appeared only as a smear across the monthly invoice. The token-count CI gate the team then built flagged its very next occurrence in the PR diff, attributed to the line that caused it. Cost regressions are the easiest regressions to catch mechanically and the hardest to catch by eyeball — automate them first.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How do you keep LLM costs from creeping?" is a process question, not a trick: tagged spend, per-feature unit economics including $/successful outcome, token-count gates in CI, budget alerts, spend caps, quarterly re-pricing. Naming $/successful outcome — cost divided by outcomes, not requests — is the answer that shows you connect cost to quality.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your support bot runs everything on a frontier model at $13k/month. Analysis shows 70% of queries are simple FAQ-style questions. Leadership wants savings without a quality dip. What is the strongest first move?',
      options: [
        'Switch all traffic to a small model and monitor complaints',
        'Run the per-feature eval against a small model, then route the traffic classes where it scores at parity, keeping frontier for the rest — with routing decisions logged',
        'Negotiate an enterprise discount with the provider',
        'Add a semantic cache in front of the frontier model'
      ],
      answer: [1],
      explanation: 'Eval-gated routing captures the bimodal-traffic win (easy majority to a 30–100× cheaper model) while protecting quality with measurement instead of hope, and logged decisions make regressions debuggable. (A) is the same idea without the safety mechanism — quality on the hard 30% craters and you find out from users. (C) yields maybe 10–20%, not the 60%+ routing offers, and delays the engineering fix. (D) helps but is capped by FAQ hit rates (20–40%) and carries near-miss risk; routing is the bigger, safer first lever.'
    },
    {
      text: 'Two weeks after shipping a learned complexity router, CSAT drops. Investigation shows terse-but-hard questions ("refund edge case, annual plan, EU?") going to the small model. What failure does this illustrate, and what is the robust fix?',
      options: [
        'The small model is defective; swap it for a different small model',
        'The router learned a spurious proxy (short = easy); add an outcome-based escalation check (e.g. groundedness or judge score) behind the router so mispredictions get caught and re-served',
        'Raise the routing threshold until CSAT recovers, then stop',
        'Remove routing — learned routers cannot work in production'
      ],
      answer: [1],
      explanation: 'Predictive routers fail on the margin because difficulty proxies (length, keywords) are imperfect; pairing prediction with escalation-on-measured-failure makes wrong routes self-correcting while preserving most savings. (A) misdiagnoses — the model was never supposed to get those queries. (C) is a blunt dial: it recovers quality by surrendering savings across the board rather than on the mispredicted slice, and leaves the proxy failure in place. (D) overcorrects; the pattern works with a safety net, as the recovered-45%-savings outcome shows.'
    },
    {
      text: 'You are evaluating a vendor claiming their router "cuts costs 85% with no quality loss." Which question most directly tests whether that number transfers to your workload?',
      options: [
        'Which cloud regions is the router deployed in?',
        'What was the benchmark traffic mix, and what happens to the savings figure when the easy/hard ratio shifts toward our measured distribution?',
        'Does the router support streaming responses?',
        'How many parameters does the routing classifier have?'
      ],
      answer: [1],
      explanation: 'Routing savings are a direct function of how much traffic is safely routable downward — a benchmark mix heavy on easy queries produces the 85% headline; a harder real distribution can halve it. Asking for savings as a function of traffic mix exposes this immediately. (A) and (C) are operational details that do not validate the claim. (D) is a proxy for nothing — classifier size says nothing about savings transferability.'
    },
    {
      text: 'Your semantic cache (threshold 0.93) serves a generic "transfer limits" answer to a user asking about their account-specific limits. Which TWO changes address the root cause rather than the symptom?',
      options: [
        'Raise the similarity threshold to 0.98 globally',
        'Classify features by cacheability: any query whose answer depends on caller identity is uncacheable or keyed per user/entitlement',
        'Add entity/negation/identity guards that block hits when the query pair differs in extracted entities or refers to caller-specific state',
        'Shorten the cache TTL to one hour',
        'Switch to a better embedding model'
      ],
      answer: [1, 2],
      multi: true,
      explanation: 'The root cause is that embedding similarity measures topical closeness, not answer equivalence — and this pair differs on caller identity, which no threshold reliably separates. Cacheability classification (B) removes identity-dependent answers from the cache entirely; guards (C) mechanically block the dangerous near-miss class. (A) trades most of your hit rate for partial risk reduction — 0.98 still passes some identity-differing pairs. (D) limits staleness duration, not wrongness. (E) — better embeddings still encode "transfer limits" questions as neighbors; the similarity-vs-equivalence gap is inherent.'
    },
    {
      text: 'A PM wants semantic caching added to a freeform writing-assistant feature to cut costs. Production data shows almost no repeated or paraphrased queries. What should you tell them?',
      options: [
        'Build it — semantic caches help all LLM traffic',
        'Hit rate is bounded by traffic redundancy; freeform generation typically sees under 5% hits, so infra plus false-hit risk likely exceeds savings — measure by clustering a week of real queries first, and spend the effort on dieting or routing instead',
        'Build an exact-match cache instead; it will hit more often',
        'Caching is impossible for generation tasks'
      ],
      answer: [1],
      explanation: 'Semantic cache ROI = hit_rate × avoided cost − (infra + false-hit damage); low-redundancy traffic caps the ceiling near zero, and clustering real queries measures that ceiling before you build. (A) ignores that the mechanism only pays on repetitive traffic. (C) is worse — exact match is a strict subset of semantic matching; if paraphrases do not repeat, identical strings certainly do not. (D) is too absolute: FAQ-style generation traffic caches fine; this specific traffic shape does not.'
    },
    {
      text: 'After a knowledge-base update changing your refund policy, the support bot keeps giving the old policy for cached queries — with no errors anywhere. Which design omission caused this?',
      options: [
        'The similarity threshold was too low',
        'The cache key did not include a knowledge-base snapshot/version id, so KB updates neither invalidated nor bypassed existing entries',
        'The embedding model was too small',
        'The TTL was set to zero'
      ],
      answer: [1],
      explanation: 'Cached LLM answers are functions of (model, prompt, knowledge, policy); if the key omits any input that changed, entries go silently stale — the classic invalidation failure, worse than a cold cache because it serves confident outdated answers. (A) threshold governs near-miss hits between queries, not staleness over time. (C) is unrelated to freshness. (D) a zero TTL would cause misses (cost), not stale hits — the observed symptom is the opposite.'
    },
    {
      text: 'Your summarization cascade escalates only 2% of drafts, but a manual audit finds 20% of accepted drafts contain factual errors. The judge prompt asks "is this summary high quality?" What is the correct fix?',
      options: [
        'Lower the judge temperature to 0 for consistency',
        'Replace the vague rubric with binary checks — every claim entailed by the source? key figures present? no invented numbers? — and accept the higher escalation rate as the true cost of quality',
        'Escalate a random 20% of drafts to match the audit error rate',
        'Remove the cascade; the small model is not viable for summarization'
      ],
      answer: [1],
      explanation: 'The verifier is the load-bearing component and "high quality" scores fluency, which errs exactly where small models err — fluent but wrong. Binary, checkable criteria make the judge fail loud, raising escalation to its honest level. (A) makes the wrong judgment deterministic. (C) escalates the wrong 20% — random selection is uncorrelated with which drafts are bad. (D) discards a working pattern: 80%+ of drafts were fine; the verifier, not the generator, was broken.'
    },
    {
      text: 'For which workload does draft-then-polish (small model drafts, frontier model edits) have the strongest structural cost advantage?',
      options: [
        'Real-time chat where every millisecond of latency matters',
        'Long-form report generation, because the frontier model mostly reads the draft (input tokens, 3–5× cheaper) and writes targeted edits instead of generating everything at output-token prices',
        'Single-word classification tasks',
        'Tasks where the small model usually gets the document structure wrong'
      ],
      answer: [1],
      explanation: 'The pattern arbitrages the input/output price asymmetry: editing shifts frontier-model work from expensive generation to cheap reading, which pays off most on long outputs. (A) is the pattern\'s weakness — two sequential calls add latency. (C) has outputs so short there is nothing to arbitrage; a router fits better. (D) is the known failure mode: polishing inherits a bad skeleton, so structurally-wrong drafts should be regenerated, not polished.'
    },
    {
      text: 'An agent costs $0.45/session at P95 with 60k-token requests. Which investigation-and-fix sequence reflects the token-dieting discipline?',
      options: [
        'Switch to a cheaper model immediately — same architecture, lower unit price',
        'Log full payloads, rank spans by token count, find the dominant contributor (commonly a raw tool output or unbounded history), and fix it at the source — e.g. truncate/summarize the tool return',
        'Enable provider prompt caching and consider it solved',
        'Compress the whole prompt with a learned compression model'
      ],
      answer: [1],
      explanation: 'Diet before you architect: the audit typically finds one offender (a 30k-token tool dump) responsible for most spend, fixed in a dozen lines at the tool boundary — often improving quality too, since bloat buries the needle. (A) cuts the multiplier but ships the same waste — and a cheaper model reading 60k junk tokens may also perform worse. (C) caching discounts the static prefix; a giant variable tool output is not cacheable prefix. (D) is the last resort applied first — learned compression risks garbling exact strings and adds a component while deletion is still free.'
    },
    {
      text: 'Which THREE changes reduce cost AND latency AND tend to improve output quality simultaneously?',
      options: [
        'Trimming raw tool outputs to the minimum sufficient representation before they enter context',
        'Suppressing preambles and capping output length to what the feature actually needs',
        'Capping conversation history by token budget with rolling summaries',
        'Raising max_tokens to give the model room to think',
        'Moving all traffic to the batch API'
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: 'All three cut tokens (cost), shrink prefill or decode time (latency), and combat lost-in-the-middle degradation — bloat is a quality problem wearing a cost costume. (D) raises the output ceiling: at best no effect, at worst longer, slower, pricier responses; "room to think" is a reasoning-budget question, not a max_tokens one. (E) halves cost but trades away latency entirely — batch is the opposite of a latency improvement and does nothing for quality.'
    },
    {
      text: 'Your assistant\'s responses complete in 4 s and users call it slow. TTFT is 2.8 s; the prompt carries a 15k-token static system+tools prefix. What is the highest-leverage fix?',
      options: [
        'Stream the response so users see tokens sooner, leaving TTFT as-is',
        'Enable provider prompt caching on the static prefix (cutting the prefill that dominates TTFT), then stream the remainder — attacking both real and perceived latency',
        'Switch to a model with faster decode speed',
        'Show a fake progress bar during the wait'
      ],
      answer: [1],
      explanation: 'The measurements localize the problem: TTFT (2.8 of 4 s) is prefill-dominated by the 15k static prefix — exactly what prompt caching eliminates (often 5–10× TTFT cuts), and streaming then covers the remaining generation time perceptually. (A) helps but leaves a 2.8 s dead wait before the first token — the actual complaint. (C) optimizes decode, which is only ~1.2 s of the problem. (D) is latency theater with no honest state behind it; staged real states are acceptable, fake progress is not a fix.'
    },
    {
      text: 'In which scenario is streaming the response to the end user actively the WRONG choice?',
      options: [
        'A chatbot answering open-ended questions with 400-token responses',
        'A structured JSON output that is validated and rendered into UI components, where 20% of generations fail validation and regenerate',
        'A coding assistant showing a long diff',
        'A voice assistant generating text for TTS sentence-by-sentence'
      ],
      answer: [1],
      explanation: 'Streaming unvetted partial output that has a 1-in-5 chance of being discarded gives users a glitchy view of content that then vanishes — worse than a short silent wait for a validated result; machine-consumed JSON also gains nothing from partial delivery. (A) is streaming\'s home turf: long freeform text, reading overlaps generation. (C) similar — with sensible section-level rendering. (D) streaming feeds the TTS pipeline earlier and is essential to hitting voice latency budgets (module 17).'
    },
    {
      text: 'A team streams tokens directly to the browser and runs moderation on the completed response, deleting violations retroactively. What is the flaw and the standard fix?',
      options: [
        'No flaw — moderation ran, requirements met',
        'Violating content is visible (and screenshotable) for seconds before deletion; fix with hold-and-release streaming — the server buffers a small sliding window through the moderation classifier and releases it with a few hundred ms of added delay',
        'Moderation should run only on user inputs, not model outputs',
        'Disable streaming for all traffic'
      ],
      answer: [1],
      explanation: 'Guardrails must sit upstream of pixels: retroactive deletion means the harm already rendered — users screenshot fast. Hold-and-release preserves streaming UX (a ~300 ms window is imperceptible) while ensuring nothing unvetted reaches the client. (A) confuses running moderation with moderation being effective. (C) is backwards — output moderation is precisely the concern here; input-only checking cannot see what the model produced. (D) sacrifices the UX benefit when a well-known pattern preserves both.'
    },
    {
      text: 'Your nightly pipeline re-embeds documents, runs LLM-judge scoring on eval outputs, and pre-generates tomorrow\'s email drafts — all on the interactive API. What does moving it to the batch API change, and what must the pipeline handle?',
      options: [
        'Nothing — batch APIs are for datasets over 1B tokens only',
        '~50% lower cost and separate, more generous rate limits, in exchange for async completion (up to ~24 h window); the pipeline needs idempotent custom_ids, sharded submissions, and a collect-validate-rebatch loop for partial failures',
        'Batch is cheaper but results become nondeterministic',
        '50% savings but batch jobs cannot use the newest models'
      ],
      answer: [1],
      explanation: 'All three workloads fail the "does a human wait on this within 60 seconds?" test — they are the canonical batch candidates, and the discount plus separate rate limits is the standard early-2026 deal. The operational tax is real: unordered results and partial failures mean idempotency and retry loops are first-class requirements, not afterthoughts. (A) invents a floor; batch tiers accept jobs of ordinary size. (C) — determinism is a sampling property, unchanged by the queue in front. (D) — mainstream batch tiers support current production models.'
    },
    {
      text: 'A PR adds one few-shot example (+900 tokens) to a prompt called 4M times/month. It passes code review and quality evals, and is discovered six weeks later on the invoice (~$10k+ of creep). Which mechanism catches this class of regression at the PR stage?',
      options: [
        'More careful human code review of prompt files',
        'A CI gate that replays the eval suite recording tokens in/out per scenario and fails or flags any PR moving expected cost beyond a set threshold',
        'A monthly finance review of the provider invoice',
        'A hard spend cap on the production API key'
      ],
      answer: [1],
      explanation: 'Cost regressions are mechanically detectable on a diff — the eval replay you already run per PR just needs to record token counts, giving pre-deploy detection with the culprit line attached. (A) demonstrably failed here: humans review correctness, not token deltas, and 900 tokens looks like a helpful example. (C) is the six-week lagging indicator this scenario describes. (D) caps catastrophes (runaway loops), but a 15% creep never trips a cap — it just quietly compounds.'
    }
  ],
  flashcards: [
    { id: 'fc-price-spread', front: 'The model price spread that makes routing worth building (early 2026)?', back: 'Small models $0.05–0.50/Mtok input vs frontier $3–15 in / $15–75 out — a <b>30–100× gap</b>. Serving easy traffic on frontier models is the biggest avoidable AI line item.' },
    { id: 'fc-router-families', front: 'Three router families and their signature trade?', back: '<b>Rule-based</b> (feature/endpoint → model): debuggable, zero latency. <b>Learned</b> (difficulty classifier + threshold dial): bigger coverage, mispredicts margins. <b>Escalate-on-failure</b>: never under-serves, but two sequential calls on escalations.' },
    { id: 'fc-route-vs-escalate', front: 'Routing vs escalation in one line?', back: 'Routing is a <b>prediction</b>; escalation is a <b>measurement</b>. Mature stacks: rules for the obvious, learned router for the middle, escalation as the safety net behind both.' },
    { id: 'fc-router-ops', front: 'Four operational requirements for a production router?', back: 'Per-route <b>evals before</b> traffic shifts · <b>log the routing decision</b> per request · per-model <b>prompt variants</b> (prompts don\'t port cleanly) · <b>sticky sessions</b> (don\'t downgrade mid-conversation).' },
    { id: 'fc-exact-vs-semantic', front: 'Exact-match vs semantic cache — risk profiles?', back: 'Exact (hash of model+prompt+params): zero correctness risk, hits only identical inputs. Semantic (embedding ≥ ~0.92–0.97 cosine): hits paraphrases, but <b>similar ≠ same answer</b> — the near-miss is the whole risk.' },
    { id: 'fc-near-miss', front: 'Where do the dangerous semantic-cache near-misses live?', back: 'Pairs at ~0.93–0.97 cosine differing by a <b>negation, entity, number, date, or caller identity</b> ("my limits" vs "the limits"). Mitigate: per-class thresholds, entity/negation guards, verification hits, identity-scoped keys.' },
    { id: 'fc-cache-hitrates', front: 'Realistic semantic-cache hit rates by traffic type (early 2026)?', back: 'FAQ-style support <b>20–40%</b> · lookup/search <b>10–25%</b> · freeform generation <b>&lt;5%</b> (usually negative ROI). Ceiling = cluster mass of a week of real queries above your threshold — measure before building.' },
    { id: 'fc-cache-invalidation', front: 'The semantic-cache invalidation non-negotiables?', back: 'Key includes <b>model id + prompt version + KB snapshot id</b> (deploys cold-start the cache) · TTL matched to content volatility · purge hook wired to knowledge-base updates. Stale beats cold as a failure — silently.' },
    { id: 'fc-cascade-econ', front: 'When does a cascade beat all-frontier economically?', back: 'When (cheap + verifier) + escalation_rate × frontier &lt; frontier. With small models at 1–3% of frontier price, even a <b>30% escalation rate saves ~65%</b>.' },
    { id: 'fc-verify-asym', front: 'Why do cascades work at all?', back: '<b>Verification is usually easier than generation</b> — schema checks, tests, entailment are cheaper than producing the output. When verifying is as hard as generating (open judgment calls), route to the big model directly instead.' },
    { id: 'fc-judge-rubric', front: 'The verifier rubric rule from the summarization war story?', back: 'Vague rubrics ("high quality?") score fluency and fail silent; <b>binary checks</b> ("every claim entailed? figures present? no invented numbers?") fail loud. 2% escalation with 20% audit errors → 18% escalation, 6× fewer errors.' },
    { id: 'fc-draft-polish', front: 'Why is draft-then-polish structurally cheap, and its weakness?', back: 'The frontier model mostly <em>reads</em> (input tokens, 3–5× cheaper) and writes targeted edits. Weakness: polishing inherits a bad skeleton — regenerate when the draft structure is wrong.' },
    { id: 'fc-bloat-audit', front: 'The 8× bloat audit — what and how?', back: 'Log full payloads for a day, read twenty token-by-token, rank spans by size. Typical finding: prompts 5–10× larger than their information content. Top offenders: raw tool outputs, unbounded history, system-prompt sprawl, over-retrieval, padded outputs.' },
    { id: 'fc-tool-trim', front: 'The #1 token-diet rule for agent tools?', back: 'Tools return the <b>minimum sufficient representation</b> (truncate + summarize + "refine to see more") — because a token entering history is re-billed <em>every subsequent turn</em>. Also a quality fix: bloat buries the needle.' },
    { id: 'fc-output-latency', front: 'Why is output length a latency lever?', back: 'Decode speed is ~constant per token, so <b>output length ≈ wall-clock time</b>. Cutting preamble/padding improves cost, latency, and UX at once — the rare triple win.' },
    { id: 'fc-ttft', front: 'TTFT vs total time — which matters and the top fixes?', back: 'Conversational surfaces live on <b>TTFT</b>: streaming makes a 400ms-start/8s-total answer feel faster than 4s-complete. Fixes: prompt caching (prefill dominates), shorter prompts, faster first-model, parallelize pre-LLM steps.' },
    { id: 'fc-no-stream', front: 'Five cases where you should NOT stream?', back: 'Post-processed/moderated outputs · machine-consumed JSON · flickery structured UIs · retry-heavy pipelines (20% regenerations) · very short outputs where TTFT ≈ total. Streaming is a default, not a law.' },
    { id: 'fc-hold-release', front: 'How do you moderate a streamed response without showing violations?', back: '<b>Hold-and-release:</b> the server buffers a 1–2 sentence sliding window through the moderation classifier and releases with ~300 ms delay. Guardrails sit upstream of pixels — users screenshot fast.' },
    { id: 'fc-batch-deal', front: 'The batch API deal and the qualifying question?', back: '<b>~50% off</b>, separate generous rate limits, results within ~24 h (often faster). Qualifier: "does a human wait on this within 60 s?" No → batch by default: ingestion, evals, judging, labeling, pre-generation, backfills.' },
    { id: 'fc-cost-gates', front: 'The four layers of cost-review culture?', back: '<b>Tagged spend</b> (feature/tenant/model/version at the gateway) · <b>unit economics</b> incl. $/successful outcome · <b>CI token-count gates</b> (fail PRs moving cost &gt;~15%) · <b>budget alerts + hard spend caps</b> per key. Plus quarterly re-pricing — last year\'s optimum is this year\'s overspend.' }
  ],
  lab: {
    title: 'Build a router and a semantic cache — then measure what they actually save',
    intro: '<p>Three experiments with real APIs: audit token bloat on a simulated agent payload, build an escalation cascade and measure its economics, and build a minimal semantic cache to catch a false hit in the act.</p><p><b>Needs:</b> <code>python3</code>, an OpenAI-compatible API key (any provider with a small and a large model; a local model via Ollama works for the small tier). Worst case ~$0.50.</p>',
    steps: [
      {
        title: 'The bloat audit on a realistic agent payload',
        html: '<pre><code>pip install openai tiktoken\n\npython3 - &lt;&lt;\'EOF\'\nimport json, tiktoken\nenc = tiktoken.get_encoding(\'o200k_base\')\n\n# Simulate a typical agent request: system prompt, history, one raw tool dump\nsystem = \'You are a helpful assistant. \' * 60           # sprawling system prompt\nhistory = [\'user asks something \' * 40] * 12             # 12 unbounded turns\ntool_dump = json.dumps([{\'file\': \'f%d.log\' % i, \'size\': i * 100,\n    \'perms\': \'rw-r--r--\', \'mtime\': \'2026-01-0%d\' % (i % 9 + 1)} for i in range(400)])\nquestion = \'Which log file is largest?\'\n\nspans = {\'system\': system, \'history\': \'\\n\'.join(history),\n         \'tool_dump\': tool_dump, \'question\': question}\ntotal = 0\nfor name, text in spans.items():\n    n = len(enc.encode(text)); total += n\n    print(\'%10s %7d tokens\' % (name, n))\nprint(\'%10s %7d tokens\' % (\'TOTAL\', total))\n\n# The information actually needed: 12 filenames + sizes, 3 recent turns\nlean_tool = json.dumps([{\'file\': \'f%d.log\' % i, \'size\': i * 100} for i in range(388, 400)])\nlean = len(enc.encode(system[:300])) + len(enc.encode(\'\\n\'.join(history[-3:]))) \\\n     + len(enc.encode(lean_tool)) + len(enc.encode(question))\nprint(\'lean version: %d tokens → bloat factor %.1fx\' % (lean, total / lean))\nEOF</code></pre>' +
          '<p>You just ran the audit from lesson 4 on synthetic data. Now do it for real: dump one actual request payload from any LLM feature you have built and rank its spans the same way. Finding the 5–10× factor in your own payload is the point of this step.</p>'
      },
      {
        title: 'Build an escalation cascade and price it',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json\nfrom openai import OpenAI\nclient = OpenAI()\nSMALL, LARGE = \'gpt-4o-mini\', \'gpt-4o\'   # any cheap/frontier pair\n# early-2026-style $/Mtok (in, out) — update from your provider\'s price page\nPRICE = {SMALL: (0.15, 0.60), LARGE: (2.50, 10.00)}\n\ntasks = [\n  \'Extract the ISO date: "The incident occurred on March 3rd, 2026 at 4pm."\',\n  \'Extract the ISO date: "logs rotated two days before the fifth of last month (it is now 2026-07-23)"\',\n  \'Extract the ISO date: "Deployed on 2026-01-15."\',\n  \'Extract the ISO date: "the Friday after next Thursday, today being Tue 2026-07-21"\',\n]\nSCHEMA = \'Reply with JSON only: {"date": "YYYY-MM-DD"} or {"date": null} if truly ambiguous.\'\n\ndef ask(model, task):\n    r = client.chat.completions.create(model=model, temperature=0,\n        messages=[{\'role\': \'user\', \'content\': task + \'\\n\' + SCHEMA}], max_tokens=40)\n    u = r.usage\n    cost = u.prompt_tokens * PRICE[model][0] / 1e6 + u.completion_tokens * PRICE[model][1] / 1e6\n    return r.choices[0].message.content.strip(), cost\n\ntotal, escalations = 0.0, 0\nfor t in tasks:\n    out, c = ask(SMALL, t); total += c\n    ok = False\n    try:\n        d = json.loads(out.strip(\'`json \\n\'))   # deterministic verifier: schema + shape\n        ok = d.get(\'date\') is None or (isinstance(d[\'date\'], str) and len(d[\'date\']) == 10)\n    except Exception:\n        pass\n    if not ok:\n        escalations += 1\n        out, c = ask(LARGE, t); total += c\n    print(\'%-30s → %s\' % (t[:30], out))\nall_large = sum(ask(LARGE, t)[1] for t in tasks)\nprint(\'cascade: $%.6f (%d escalated) vs all-frontier: $%.6f\' % (total, escalations, all_large))\nEOF</code></pre>' +
          '<p>Note what the verifier is: a pure schema/shape check — free and deterministic. Try breaking it: which of the ambiguous date tasks produce <em>valid JSON with a wrong date</em>? That is the verifier blind spot from lesson 3 — a schema check cannot catch a semantically wrong value, which is when you graduate to a judge model. Compare the printed cascade vs all-frontier cost.</p>'
      },
      {
        title: 'Build a semantic cache and catch a false hit',
        html: '<pre><code>pip install numpy\n\npython3 - &lt;&lt;\'EOF\'\nimport numpy as np\nfrom openai import OpenAI\nclient = OpenAI()\n\ndef embed(texts):\n    r = client.embeddings.create(model=\'text-embedding-3-small\', input=texts)\n    return [np.array(d.embedding) for d in r.data]\n\ncache = {}  # query -> (embedding, answer)\ndef cached_ask(q, threshold):\n    qv = embed([q])[0]\n    for prev, (pv, ans) in cache.items():\n        sim = float(qv @ pv / (np.linalg.norm(qv) * np.linalg.norm(pv)))\n        if sim &gt;= threshold:\n            return ans, \'HIT on %r (sim %.3f)\' % (prev, sim)\n    r = client.chat.completions.create(model=\'gpt-4o-mini\',\n        messages=[{\'role\': \'user\', \'content\': q}], max_tokens=80)\n    ans = r.choices[0].message.content\n    cache[q] = (qv, ans)\n    return ans, \'MISS\'\n\npairs = [\n  \'How do I cancel my subscription?\',\n  \'Can I cancel my subscription?\',          # benign paraphrase — should hit\n  \'How do I cancel my colleague\\\'s subscription?\',  # entity swap — dangerous\n  \'How do I avoid cancelling my subscription by accident?\',  # negation — dangerous\n]\nfor threshold in (0.90, 0.95):\n    cache.clear()\n    print(\'--- threshold\', threshold)\n    for q in pairs:\n        ans, status = cached_ask(q, threshold)\n        print(\'%-55s %s\' % (q[:55], status))\nEOF</code></pre>' +
          '<p>At 0.90 you will almost certainly see the entity-swap or negation query HIT on the original — a false hit serving the wrong answer instantly. At 0.95 some benign paraphrases start missing. There is no threshold that separates these pairs cleanly: that is the lesson-2 argument made empirical, and why production caches add entity/negation guards on top. Print the similarity of each dangerous pair and keep the numbers for your next design review.</p>'
      }
    ],
    costNote: 'Worst case across all steps ~$0.50 (dominated by the handful of frontier-model calls in step 2; steps 1 and 3 are pennies). Using a local model for the small tier (Ollama, base_url http://localhost:11434/v1) cuts it further. Nothing persistent is created — the "cache" lives in process memory and dies with the script.'
  }
});
