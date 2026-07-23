COURSE.register({
  id: 'm12-observability',
  track: 'core',
  order: 12,
  title: 'Observability & tracing',
  short: 'Observability',
  tagline: 'When a print statement can no longer explain why your LLM app misbehaved — spans, trace trees, cost attribution, drift, and feedback loops.',
  minutes: 100,
  lessons: [
    {
      id: 'why-printf-dies',
      title: 'Why printf debugging dies with LLM apps',
      blurb: 'The three properties that break the debugging habits you have relied on for a decade.',
      html: '<h2>The tools that stopped working</h2>' +
        '<p>For a decade your debugging loop was: reproduce, add a <code>print</code> or a breakpoint, read the deterministic state, fix, confirm. That loop assumes three things that LLM applications quietly violate — and the violation is total, not partial. Understanding <em>why</em> your instincts fail is the whole reason observability is a distinct discipline here rather than "logging, but for AI."</p>' +
        '<p><b>1. Nondeterminism.</b> Run the same input twice and you get two different outputs. At temperature 0 you get closer, but not identical — floating-point non-associativity across GPU kernels, batch-dependent numerics, MoE routing, and silent provider-side model swaps all inject variance. "Reproduce the bug" is the first step of your old loop, and it is often impossible. A failure that happened once, on one user, at 3am, may never recur on demand. Your only durable record is the trace you captured <em>at the time</em>. If you did not record it, it is gone.</p>' +
        '<p><b>2. The failure is semantic, not a crash.</b> The program did not throw. It returned a fluent, well-formed, 200-OK answer that happens to be wrong, subtly unfaithful to the retrieved context, or three sentences longer than it should be. There is no stack trace because nothing stacked. The "bug" lives in the content of a string, judged against an intent that exists only in a human head. You cannot <code>grep</code> for it, and an exception tracker like Sentry will show you a clean green board while users churn.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team spent two days hunting a "latency regression" their APM flagged. The p95 on their own service was flat. The real change: a prompt edit added a sentence that made the model ramble, doubling output tokens — and decode time is roughly linear in output tokens. The latency lived <em>inside</em> the model call, invisible to infra dashboards that only see request start and end. Without token-level instrumentation the true cause is unobservable.</div>' +
        '<h2>Multi-step traces: the single call is the atom, not the unit</h2>' +
        '<p>Even in 2023, most "LLM apps" were one prompt in, one completion out. That world is gone. A single user turn now fans out into a tree: a router classifies intent, a retriever runs an embedding query and a rerank, three tool calls fire (one of which retries), a sub-agent spins up its own loop, and a final synthesis call stitches it together. Nine model calls and four non-model steps to answer "what did I spend on travel last quarter." When the answer is wrong, <em>which</em> of those thirteen steps was wrong? A flat log gives you thirteen disconnected lines with no parent-child structure. You need the tree, with each node showing its own inputs, outputs, latency, and cost, or you are debugging blind.</p>' +
        '<p>This is why the tracing vocabulary from distributed systems — spans, traces, parent spans — was adopted wholesale. An LLM agent loop <em>is</em> a distributed trace, just one where the "services" are model calls and tools. The difference is what you record on each span: not just timing, but the full prompt and completion, because in an LLM app the payload <em>is</em> the state.</p>' +
        '<h2>The prompt and version explosion</h2>' +
        '<p>The third thing that breaks: there is no single artifact called "the code" that produced a behavior. The output is a function of the prompt template, the exact interpolated values, the model snapshot, the sampling params, the retrieved documents, the tool schemas, and the conversation history — any of which can change independently. A prompt lives in a template file, a database row, or a prompt-management SaaS; it gets edited by a PM without a code review; the model provider ships <code>gpt-4o-2024-11-20</code> in place of the May snapshot; someone bumps temperature in a config. Each is a "deploy" that your version control may never see.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> To explain any LLM output you must be able to reconstruct its <em>full</em> generating context: prompt version, model snapshot id, params, retrieved chunks, and inputs — captured together on one span. Observability for LLMs is fundamentally about recording the exact conditions of a nondeterministic event, because you cannot re-run it to find out.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your LLM feature got worse this week and nothing was deployed. How do you investigate?" Strong answer names the invisible deploys — model snapshot rotation, a prompt edited outside code review, a retrieval index rebuilt, upstream data drift — and says the first move is to pull traces from before and after the regression and diff the generating context, which presupposes you were recording it. Weak answer reaches for a debugger.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Tracing is not free: capturing full prompts and completions on every request is meaningful storage and, if synchronous, added latency. As of early 2026, teams sample high-volume traffic (e.g. 100% of errors and thumbs-down, 1-10% of the rest) and flush spans asynchronously so instrumentation never sits in the user\'s critical path. Budget the storage — a chatty agent can emit 50KB+ of trace per turn.</div>'
    },
    {
      id: 'spans-and-traces',
      title: 'Spans, trace trees, and the OpenTelemetry GenAI conventions',
      blurb: 'What to actually record on an LLM span, how agent loops become trees, and the tool landscape.',
      html: '<h2>Anatomy of an LLM span</h2>' +
        '<p>A span is one timed unit of work with attributes attached. For an LLM call, the attributes are the entire debugging surface. Record all of these or you will wish you had:</p>' +
        '<ul>' +
        '<li><b>The full prompt</b> — every message, system + user + assistant + tool, exactly as sent after all templating and interpolation. Not the template; the rendered result. This is the single most valuable field and the one people truncate to save space, then regret.</li>' +
        '<li><b>The full completion</b> — including tool-call arguments and any reasoning/thinking tokens the provider exposes.</li>' +
        '<li><b>Model snapshot id</b> — <code>claude-sonnet-4-5-20250929</code>, not "claude". The dated snapshot, because "claude" rotates under you.</li>' +
        '<li><b>Sampling params</b> — temperature, top_p, max_tokens, stop sequences, seed if set, response_format.</li>' +
        '<li><b>Token counts</b> — input, output, and <em>cached</em> input separately (cached tokens are billed at ~10% of the input rate, so lumping them together corrupts every cost number downstream).</li>' +
        '<li><b>Latency, split</b> — time to first token (TTFT) vs total, because they are governed by different bottlenecks (lesson 3).</li>' +
        '<li><b>Computed cost</b> — dollars, derived from tokens and the snapshot\'s price card, stored on the span so you never have to recompute across price changes.</li>' +
        '<li><b>Linkage</b> — trace id, parent span id, and your own ids (user, session, feature, prompt-version) so you can slice later.</li>' +
        '</ul>' +
        '<h2>Trace trees for agent loops</h2>' +
        '<p>A trace is the whole tree for one logical operation; spans nest by parent id. An agent that reasons, calls two tools, and synthesizes produces a root span (the turn) with child spans for each model call and each tool call, and grandchildren if a tool itself calls a model. The tree is what lets you answer "the final answer was wrong — was it a bad retrieval, a bad tool result, or a bad synthesis?" You expand the tree, read each node\'s output, and find the first step where reality diverged from intent. Without the parent-child structure you have a pile of spans and no way to know which turn they belonged to or in what order they ran.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Most SDKs implement this with a context-propagated "current span" — you open a span, it becomes the parent for anything opened inside it, and closing it records the duration. Decorators/wrappers (<code>@observe</code>, <code>traceable</code>, auto-instrumentation that monkey-patches the OpenAI/Anthropic client) hide the plumbing so a nested function call automatically becomes a nested span. The cost of magic: auto-instrumentation captures the HTTP call but often misses your business logic between calls, which is exactly where routing bugs hide.</div>' +
        '<h2>OpenTelemetry GenAI semantic conventions</h2>' +
        '<p>The one standard worth knowing is OpenTelemetry\'s GenAI semantic conventions — a vendor-neutral naming scheme so a span emitted by any instrumented library carries the same attribute keys: <code>gen_ai.system</code> (openai, anthropic), <code>gen_ai.request.model</code>, <code>gen_ai.request.temperature</code>, <code>gen_ai.usage.input_tokens</code>, <code>gen_ai.usage.output_tokens</code>, and events for the prompt and completion content. As of early 2026 the spec is still stabilizing (some fields marked experimental, prompt-content capture is opt-in and evolving), but adopting it buys you real portability: emit OTel-compliant spans and you can point them at Jaeger, Grafana Tempo, Honeycomb, Datadog, <em>or</em> an LLM-native tool without re-instrumenting. That is the whole pitch — one instrumentation, many backends.</p>' +
        '<h2>The tool landscape (vendor-neutral)</h2>' +
        '<table><tr><th>Tool</th><th>Shape</th><th>Strong at</th><th>Watch for</th></tr>' +
        '<tr><td>LangSmith</td><td>Hosted SaaS (LangChain, but framework-agnostic SDK)</td><td>Deep trace UI, eval + dataset workflows, prompt hub</td><td>Best DX inside LangChain; self-host is enterprise-tier</td></tr>' +
        '<tr><td>Langfuse</td><td>Open-source, self-host or cloud</td><td>OTel-friendly, prompt management, cost tracking, no lock-in</td><td>You run the infra if self-hosting</td></tr>' +
        '<tr><td>Braintrust</td><td>Hosted, eval-first</td><td>Tight loop between traces, evals, and playground; scoring</td><td>Opinionated toward its eval model</td></tr>' +
        '<tr><td>Arize Phoenix</td><td>Open-source (OTel-native)</td><td>Standards-based tracing, drift/embedding analysis heritage</td><td>Ties into Arize\'s paid platform for scale</td></tr>' +
        '<tr><td>W&amp;B Weave</td><td>Hosted (Weights &amp; Biases)</td><td>Familiar to ML teams already on W&amp;B, experiment lineage</td><td>Heavier if you only want app tracing</td></tr>' +
        '<tr><td>Homegrown on OTel</td><td>DIY spans → Tempo/Honeycomb/ClickHouse</td><td>Full control, no per-seat cost, unified with existing APM</td><td>You build the LLM-specific UI and eval glue yourself</td></tr></table>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> The lock-in that bites is not the tracing SDK — it is the accumulated eval datasets, annotations, and human-labeled failure sets living inside a vendor. Traces are cheap to re-emit; six months of labeled thumbs-down examples are not. If portability matters, export annotations on a schedule from day one, whatever tool you pick.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How would you add observability to an existing agent?" Good answers: wrap the LLM client with auto-instrumentation for immediate coverage, add manual spans around retrieval and business logic, record full prompt/completion/model-snapshot/tokens/cost per span, propagate trace context through the agent loop so it forms a tree, and standardize on OTel GenAI attributes so the backend stays swappable.</div>'
    },
    {
      id: 'cost-latency-metrics',
      title: 'Token, cost, and latency as first-class product metrics',
      blurb: 'Per-feature cost attribution, unit economics, and why TTFT and tokens/sec are different SLOs.',
      html: '<h2>Cost is a product metric, not a finance footnote</h2>' +
        '<p>In a traditional SaaS, marginal cost per request is a rounding error and nobody instruments it per feature. In an LLM product, a single "summarize this thread" can cost 2 cents and a runaway agent turn can cost 80 cents, and you are often charging a flat monthly fee. Gross margin now depends on <em>usage patterns you did not design for</em>. That makes per-request cost a first-class metric you record on every span and roll up along the dimensions that matter: per feature, per customer, per user, per model, per prompt version.</p>' +
        '<p><b>Per-feature cost attribution</b> is the workhorse. Tag every trace with the feature that triggered it (<code>feature=email_summary</code>) and the cost aggregation tells you that your flashy "AI insights" panel costs 6x what it earns in engagement, while the boring autocomplete pays for itself ten times over. Without attribution you have one undifferentiated cloud bill and no idea which knob to turn.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> The classic blow-up: a single enterprise customer wires your agent into an automation that fires 40,000 times a night. On a flat-rate plan you are now paying them to use you. The only reason anyone caught it before the monthly invoice was a per-customer cost dashboard with an anomaly alert. Cost attribution is not accounting hygiene — it is how you find the account that is silently torching your margin.</div>' +
        '<h2>Unit economics dashboards</h2>' +
        '<p>The number executives actually need is cost-per-successful-outcome, not cost-per-token. A support bot that resolves a ticket for 8 cents versus a $6 human agent is a triumph; the same bot at 8 cents that resolves nothing and escalates everything is pure loss <em>plus</em> a frustrated customer. So the dashboard that matters ties three things together: cost (from your spans), a success signal (deflection, task completion, thumbs-up — lesson 5), and volume. Cost per resolved ticket, cost per accepted suggestion, cost per active user. When you can put "each generated PR description costs $0.011 and 71% get accepted unedited" on a slide, you can reason about margin, price the feature, and decide whether a cheaper model would hold quality (module 18).</p>' +
        '<ul>' +
        '<li><b>Track cached vs uncached input separately</b> — prompt caching can cut input cost 90% (module 3). If your dashboard lumps them, a caching regression (a prompt edit that busts the cache prefix) shows up as a mysterious 3x cost jump with no code change.</li>' +
        '<li><b>Attribute retries and fallbacks</b> — a call that fails schema validation and retries twice costs 3x. Failed-and-retried spend is often 5-15% of the bill and hides until you break it out.</li>' +
        '<li><b>Watch output tokens hardest</b> — output is 3-5x the price of input and grows with verbosity. A prompt that makes the model chattier is a cost regression even if quality is unchanged.</li>' +
        '</ul>' +
        '<h2>Latency: TTFT vs tokens/sec are different SLOs</h2>' +
        '<p>"Latency" is two numbers with different physics, and conflating them produces the wrong fix. <b>Time to first token (TTFT)</b> is dominated by prefill — processing your prompt — plus queueing at the provider. It is what the user feels as "did it hang?" and it grows with prompt length and load. <b>Tokens per second (inter-token latency, throughput)</b> is decode speed, governed by memory bandwidth and model size; it determines how fast the answer streams once it starts. Total latency ≈ TTFT + (output_tokens / throughput).</p>' +
        '<p>These fail and get fixed differently. Slow TTFT? Shrink the prompt, cache the prefix, route to a less-loaded region, or pick a provider with better queueing. Slow tokens/sec? Use a smaller/faster model, a provider with better serving, or reduce how much output you demand. A chat UI lives or dies on TTFT (streaming hides throughput); a batch summarization job cares only about throughput and total cost. Set SLOs on both — e.g. "p95 TTFT &lt; 800ms, p50 throughput &gt; 40 tok/s" — and alert on each separately.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Streaming makes TTFT and throughput independently observable from the client: timestamp the first streamed chunk (TTFT) and divide the rest of the tokens by the remaining wall-clock (throughput). If you only measure total request time you cannot tell a slow-to-start-but-fast-stream call from a fast-start-but-crawling one — and those need opposite fixes. Record both timestamps on the span.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> As of early 2026, provider throughput varies wildly by tier and load — the same model can stream at 25 tok/s on one endpoint and 120 tok/s on a specialized inference provider. Latency is not a fixed property of "the model"; it is a property of the model on a specific endpoint under specific load, and it drifts hourly. Measure it continuously from where your users are, not once in a benchmark.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Users say the assistant feels slow. Where do you look?" Separate TTFT from throughput first, then localize with the trace tree — is the delay in prefill, in a retrieval step, in a tool call, or in decode? A junior answer treats latency as one number and reaches for a bigger timeout.</div>'
    },
    {
      id: 'drift-detection',
      title: 'Drift detection: when the world moves under a frozen model',
      blurb: 'Model updates, traffic shifts, prompt drift, embedding drift — and detecting them before users do.',
      html: '<h2>Four kinds of drift</h2>' +
        '<p>Drift is when the statistical relationship your system relied on changes while your code stands still. In classic ML it is data drift and concept drift. LLM apps add their own flavors, and each has a different signature:</p>' +
        '<ul>' +
        '<li><b>Model drift.</b> The provider updates the model behind an unpinned alias, or ships a new snapshot you upgrade to. Same prompt, different behavior — often better on average and worse on your specific edge cases. This is the one people forget because <em>you</em> did nothing.</li>' +
        '<li><b>Traffic / input drift.</b> Your users start asking different things. A new customer segment onboards, a viral use case emerges, a product launch changes the question mix. The model is fine; it is now being asked questions your prompt and retrieval were never tuned for.</li>' +
        '<li><b>Prompt drift.</b> The prompt accretes edits over months — a PM adds a rule here, an engineer a few-shot example there — and the aggregate quietly degrades, or a change interacts badly with a model update. Nobody owns the whole prompt anymore.</li>' +
        '<li><b>Embedding / retrieval drift.</b> The corpus grows and shifts; the distribution of what gets retrieved changes; an index rebuild with a re-embedded model moves everything. Retrieval quality erodes without a single error.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team pinned their model snapshot precisely to avoid model drift, felt safe, and still saw quality fall over six weeks. The cause was traffic drift: a marketing push brought in non-English users, and their English-tuned prompt and retrieval quietly failed for them. Pinning the model protects against one drift and blinds you to the other three. You must watch the inputs and outputs, not just the version string.</div>' +
        '<h2>Detecting drift via score distributions</h2>' +
        '<p>You cannot eyeball drift across millions of requests; you watch <em>distributions</em> and alert when they move. The instrumentation you already have from lessons 2-3 gives you the raw signals; drift detection is watching their shape over time:</p>' +
        '<ul>' +
        '<li><b>Output-property distributions</b> — mean response length, refusal rate, tool-call rate, JSON-parse-failure rate, language mix, latency percentiles. A refusal rate that jumps from 2% to 9% overnight is a model update or an input shift, and it is visible days before the support tickets.</li>' +
        '<li><b>Automated score distributions</b> — run a cheap LLM-judge or heuristic scorer on a sample of production traffic (module 11) and track the mean and spread of quality scores over time. A drop in the p50 score is drift, whatever the cause.</li>' +
        '<li><b>Input embedding distributions</b> — embed a sample of incoming queries and watch for clusters that were not there last month (new topics) or a shift in the centroid. This catches traffic drift geometrically, before it shows up as bad answers.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> The math is standard distribution-distance: population stability index (PSI) or KL-divergence between last week\'s and this week\'s histogram for scalar metrics; for embeddings, track the drift of cluster centroids or the share of points falling outside last month\'s density. You do not need anything exotic — a nightly job that computes PSI on ten metrics and alerts past a threshold catches most real drift. The hard part is having clean, labeled dimensions to slice by, which loops back to good span instrumentation.</div>' +
        '<h2>Canary sets: the drift tripwire</h2>' +
        '<p>Distributions tell you <em>something</em> moved; a <b>canary set</b> tells you <em>quality</em> moved and pins the blame. A canary (or golden) set is a small fixed collection of representative inputs with known-good expected outputs or scoring rubrics — a few dozen to a few hundred cases. You run it on a schedule and before every model or prompt change, and score it the same way each time. Because the inputs are frozen, any score change is attributable to what <em>you</em> changed (or what the provider changed under you), cleanly separating model/prompt drift from traffic drift.</p>' +
        '<p>The discipline that makes canaries work: mine them from real production failures (lesson 5), keep them small enough to run cheaply on every change (a few dollars), and freeze them — the moment you edit a canary to make a failing test pass, you have lost the baseline. Run the canary set as a pre-deploy gate on prompt edits and as a scheduled probe against the live model to catch silent provider updates. When the canary score drops and traffic is unchanged, you caught model drift before your users did.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Distributions detect that <em>something</em> drifted across live traffic; a frozen canary set localizes <em>what</em> and gives you a pre-deploy gate. You need both — distributions for coverage of the unknown, canaries for a stable, attributable baseline.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How do you catch it when a provider silently updates a model you use?" Strong answer: pin the dated snapshot where possible; run a frozen canary eval on a schedule against the live endpoint so a behavior change trips it; and watch output-property distributions (refusal rate, length, score) for shifts that correlate with the provider\'s release notes. Weak answer: "read their changelog."</div>'
    },
    {
      id: 'feedback-loops',
      title: 'Feedback loops: turning production into your eval set',
      blurb: 'Explicit vs implicit signals, and mining real failures into the datasets that improve the system.',
      html: '<h2>Explicit feedback: honest but sparse</h2>' +
        '<p>The thumbs up/down button is the obvious signal, and you should have it — but respect its limits. Explicit feedback is <b>sparse</b> (well under 1% of users click anything, often far less), <b>biased</b> (angry users click thumbs-down far more than happy users click thumbs-up, so raw ratios read worse than reality), and <b>shallow</b> (a thumbs-down tells you <em>that</em> something was wrong, rarely <em>what</em>). Its virtue is that it is unambiguous and human-authored, which makes each one gold for building eval sets. Capture the full trace alongside every rating — a thumbs-down with no attached prompt/context/output is a complaint you can never reproduce or learn from.</p>' +
        '<p>You can make explicit feedback richer without much friction: an optional "what went wrong?" with a few tags (wrong, incomplete, too long, made something up), or a lightweight edit-the-answer affordance that captures the corrected text. An edited answer is enormously valuable — it is a labeled (bad, good) pair straight from a real user on real input.</p>' +
        '<h2>Implicit signals: dense but ambiguous</h2>' +
        '<p>The behavioral exhaust of your users is orders of magnitude denser than explicit feedback, and once you learn to read it, it is where most of your quality signal lives:</p>' +
        '<ul>' +
        '<li><b>Regeneration / retry</b> — the user clicked "try again." Strong dissatisfaction signal; the first answer failed them. Log which answer got regenerated and how often per feature.</li>' +
        '<li><b>Copy events</b> — the user copied the output. In a coding or writing assistant this is a strong <em>positive</em>: they found it useful enough to take. Cheap to instrument, high signal.</li>' +
        '<li><b>Edit-after-accept</b> — they took the suggestion but immediately rewrote half of it. Partial success; the diff between suggested and kept text is a precise quality signal.</li>' +
        '<li><b>Abandonment</b> — the user left mid-stream, or did not act on the answer, or rephrased and asked again. Weak per-event but powerful in aggregate.</li>' +
        '<li><b>Conversation continuation</b> — "no, I meant..." or an immediate correction is a negative signal buried in the next turn; a satisfied "thanks, that worked" is a positive one. Mine the following turn.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> Implicit signals are correlational and easy to over-read. Copy events crashed to near zero on one product after a UI change that auto-inserted the answer — the users still loved it, they just no longer needed to copy. If you had wired copy-rate straight into an automated quality alarm, you would have paged yourself over a button move. Treat implicit signals as noisy evidence to be triangulated, never as ground truth on their own.</div>' +
        '<h2>Mining production failures into eval sets</h2>' +
        '<p>The highest-leverage thing observability enables is a flywheel: production failures become permanent regression tests. The loop:</p>' +
        '<ol>' +
        '<li><b>Surface candidates</b> — every thumbs-down, every regeneration, every low automated-judge score, every abandoned session becomes a candidate failure with its full trace attached.</li>' +
        '<li><b>Triage and label</b> — a human (you, at first) reviews a sample, confirms it is a real failure, and categorizes it: retrieval miss, unfaithful synthesis, format break, refusal, hallucinated fact. The category tells you which subsystem to fix.</li>' +
        '<li><b>Promote to the eval set</b> — the confirmed failure, with its input and a corrected expected output, joins your eval/canary datasets (module 11). Now it is a test that fails until you fix it and can never silently regress again.</li>' +
        '<li><b>Fix, and let the gate hold the line</b> — improve the prompt, retrieval, or model; the enlarged eval set confirms the fix and guards against reintroducing the bug.</li>' +
        '</ol>' +
        '<p>This is what turns an LLM app from a demo into a system that improves. Every real failure you capture makes the next release measurably safer. Teams without this loop keep re-shipping the same bugs; teams with it accumulate a moat of hard, real-world test cases that no competitor can copy.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Observability closes the loop: traces + feedback signals feed a triage queue, the queue feeds your eval set, and the eval set gates your next change. Production is not just where you serve — it is your richest, cheapest source of evaluation data, but only if you instrumented it to capture the trace behind every signal.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "You have thumbs-down data but users rarely click. How do you improve quality anyway?" Strong answer leans on implicit signals (regeneration, copy, edit-after-accept, abandonment, next-turn corrections) as dense supplements, plus an automated judge over a traffic sample, and describes the mining-into-eval-sets flywheel. Naming the bias in explicit feedback shows maturity.</div>'
    },
    {
      id: 'privacy-in-traces',
      title: 'Privacy in traces: the observability data is a liability too',
      blurb: 'PII in prompts, retention, redaction, and the compliance surface your traces create.',
      html: '<h2>Your trace store is now a copy of everything users typed</h2>' +
        '<p>Here is the uncomfortable symmetry: the same full-prompt capture that makes debugging possible also means your observability system holds a verbatim copy of every message every user sent — including the ones with social security numbers, health details, private keys pasted by mistake, and confidential business data. You built a debugging tool and accidentally built a second, less-guarded database of your most sensitive data. Regulators (GDPR, HIPAA, CCPA) do not care that you called it "telemetry"; PII in a trace is PII, subject to the same access controls, retention limits, deletion rights, and breach liability as your primary store — often with weaker protections because "it\'s just logs."</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A GDPR "right to erasure" request is trivial against your primary database and a nightmare against six months of traces scattered across a third-party observability SaaS, if you never designed for it. When a user asks to be forgotten, can you actually find and delete every span containing their data? If the honest answer is no, you have a compliance gap that predates any breach. Design deletion in from the start — tag spans with a user id and support targeted purge.</div>' +
        '<h2>Redaction before context, and before storage</h2>' +
        '<p>The defense is to strip sensitive data early and in the right places. There are two distinct redaction points and they serve different masters:</p>' +
        '<ul>' +
        '<li><b>Before the model</b> — redact PII out of prompts before they leave your trust boundary for a third-party API, so the provider never sees it (module 13). This protects against the provider\'s retention and any training use.</li>' +
        '<li><b>Before the trace store</b> — redact (or hash, or tokenize) sensitive fields before they are written to telemetry, so your observability system holds masked data. Many tracing SDKs support a masking hook or a field allowlist for exactly this.</li>' +
        '</ul>' +
        '<p>Redaction is itself imperfect: regex and NER-based PII detectors miss novel formats and over-redact useful context, and the redaction can destroy the very content you needed to debug the failure. A common compromise is tiered — full capture in a short-retention, tightly-access-controlled store for active debugging, and aggressively redacted long-retention copies for trend analysis. Match the protection to how long you keep it and who can read it.</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> No automated redactor catches everything. As of early 2026, PII detection on free-form text runs maybe 90-98% recall depending on the class — good for reducing exposure, useless as a guarantee. Never tell users or auditors that traces are "PII-free" because you run a redactor; say you "reduce PII exposure," keep retention short, lock down access, and encrypt. Defense in depth, not a single filter you trust absolutely.</div>' +
        '<h2>Retention, access, and vendor posture</h2>' +
        '<p>Three policies turn a liability back into a manageable tool:</p>' +
        '<ul>' +
        '<li><b>Retention</b> — the cheapest privacy control is not keeping data. Traces have a sharp value half-life: you debug last week\'s incident, not last year\'s. Set aggressive TTLs (e.g. 7-30 days for full-payload spans, longer only for aggregated/redacted metrics). Short retention shrinks both your storage bill and your breach blast radius.</li>' +
        '<li><b>Access control</b> — full prompts are among the most sensitive data you hold; treat trace access like production-database access, with roles, audit logs of who read what, and no "everyone in eng can browse all conversations." An engineer casually reading real user chats is itself a privacy incident.</li>' +
        '<li><b>Vendor posture</b> — if you send traces to a third-party observability SaaS, you have added another processor holding your users\' data. Check their retention, sub-processors, data residency, and whether your DPA covers it. Self-hosting (Langfuse, Phoenix) keeps the data in your boundary at the cost of running the infra — a real tradeoff when the payloads are this sensitive.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Regional routing and data residency apply to traces too: an EU user\'s conversation redacted or not should often stay in an EU trace store, not flow to a US observability region. If your app already routes inference regionally for compliance (module 13), your telemetry pipeline needs the same partitioning, or you have re-created the exact cross-border transfer you were avoiding — one layer down where nobody was looking.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "You capture full prompts for debugging. What are the privacy implications?" A strong answer immediately reframes the trace store as a sensitive data store: PII subject to the same law, needing redaction (before both model and storage), short retention, strict access control with audit, deletion support for erasure requests, and scrutiny of any third-party observability vendor. Treating traces as harmless logs is the junior tell.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your exception tracker shows a clean board and your APM says p95 latency is flat, yet users report the assistant "got worse and slower" this week. No deploy went out. Where do you look first?',
      options: [
        'Nowhere — with no deploy and green dashboards, the reports are likely subjective',
        'Pull LLM traces from before and after the reported change and diff the generating context: model snapshot, prompt version, retrieved chunks, output length',
        'Restart the inference servers to clear any memory leak',
        'Increase the request timeout to reduce perceived slowness'
      ],
      answer: [1],
      explanation: 'LLM failures are semantic (fluent-but-wrong, so no exception) and often internal to the model call (longer output raising decode time, invisible to infra APM that only sees request start/end). The invisible "deploys" — a rotated provider snapshot, a prompt edited outside code review, an index rebuild — are exactly what a trace diff surfaces. (A) dismisses a real, well-known failure class. (C) treats a semantic/behavioral change as an infra fault. (D) hides a symptom without diagnosing the doubled output tokens or degraded answers.'
    },
    {
      text: 'You are deciding what to record on each LLM span. Which TWO fields are most often truncated to save space and most regretted later?',
      options: [
        'The fully-rendered prompt (all messages after interpolation)',
        'The full completion including tool-call arguments',
        'The HTTP status code of the API call',
        'The region the request was served from',
        'The name of the calling function'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'In an LLM app the payload IS the state — you cannot reconstruct or reproduce a nondeterministic failure without the exact rendered prompt and the exact completion, and these are the large fields people trim first. (C) status code is tiny and rarely explains a semantic failure. (D) region is a small useful tag but not where debugging lives. (E) function name is cheap metadata. The load-bearing, expensive-to-store, painful-to-lose fields are the prompt and completion content.'
    },
    {
      text: 'An agent turn fans out into a router call, a retrieval step, three tool calls, and a synthesis call. The final answer is wrong. Why is a flat log of these steps inadequate compared to a trace tree?',
      options: [
        'Flat logs cannot store token counts',
        'Without parent-child structure you cannot tell which steps belonged to this turn or their order, so you cannot localize which step first diverged from intent',
        'Trace trees are required by the OpenTelemetry spec',
        'Flat logs are always sampled and traces are not'
      ],
      answer: [1],
      explanation: 'The value of the tree is localization: you expand it, read each node output, and find the first step where reality diverged (bad retrieval vs bad tool result vs bad synthesis). A flat log gives disconnected lines with no linkage. (A) is false — logs can hold token counts; the missing thing is structure. (C) inverts causality — the spec exists because the tree is useful, not vice versa. (D) is unrelated; sampling is a separate policy choice for either shape.'
    },
    {
      text: 'What is the main portability argument for emitting spans that follow the OpenTelemetry GenAI semantic conventions?',
      options: [
        'OTel spans are automatically PII-redacted',
        'One instrumentation using standard attribute keys can be pointed at many backends (Jaeger, Tempo, Datadog, or an LLM-native tool) without re-instrumenting',
        'OTel spans are cheaper to store than custom spans',
        'The conventions guarantee your traces are compliant with GDPR'
      ],
      answer: [1],
      explanation: 'The whole pitch is decoupling instrumentation from backend: standardized keys (gen_ai.request.model, gen_ai.usage.input_tokens, etc.) mean any compliant collector can ingest your spans, so you can swap or fan-out backends without touching app code. (A) is false — OTel does not redact; content capture is opt-in and it is your job to mask. (C) storage cost is about volume, not naming. (D) a naming convention is not a legal compliance guarantee; conflating the two is dangerous.'
    },
    {
      text: 'Your monthly model bill tripled with no code change and no traffic increase. Cached and uncached input tokens are lumped into one metric on your dashboard. What is the most likely explanation?',
      options: [
        'The provider raised prices without notice',
        'A prompt edit changed the cache-prefix, busting prompt caching — formerly-cached tokens are now billed at full input rate, invisible because the dashboard does not separate cached from uncached',
        'Output token prices increased',
        'The vector database started charging per query'
      ],
      answer: [1],
      explanation: 'Cached input is billed ~10% of the input rate; a prompt change that alters the stable prefix invalidates the cache and reprices those tokens at 1x — a silent 3x-ish jump on the input line. Because cached and uncached are merged on the dashboard, the regression is invisible. This is exactly why you record them separately. (A) is possible but rarer and announced; the merged-metric clue points at caching. (C) output prices would not triple input-driven cost silently. (D) is unrelated to model billing.'
    },
    {
      text: 'An executive asks for the one cost metric that matters for the AI support bot. Which is the right north-star, and why?',
      options: [
        'Cost per token, because it is the rawest unit of spend',
        'Cost per successfully resolved ticket, because it ties spend to a business outcome and reveals whether the bot creates or destroys value',
        'Total monthly spend, because it is what appears on the invoice',
        'Cost per API call, because it normalizes across features'
      ],
      answer: [1],
      explanation: 'Unit economics require joining cost to a success signal: an 8-cent bot that resolves tickets beats a $6 human, but the same 8-cent bot that escalates everything is pure loss. Cost-per-outcome is the metric you can price and reason about. (A) cost per token is an input, meaningless without outcome. (C) total spend hides efficiency and per-feature attribution. (D) cost per call ignores whether calls accomplish anything and is gamed by chatty multi-call flows.'
    },
    {
      text: 'Users say a streaming chat assistant "feels laggy." You measure only total request time. Why is that insufficient, and what should you separate?',
      options: [
        'Total time is fine; just set a lower timeout',
        'Separate TTFT (prefill/queueing — the "did it hang?" feeling) from tokens/sec (decode throughput); they have different causes and opposite fixes, and streaming makes them independently measurable',
        'Separate CPU time from GPU time on your own servers',
        'Separate successful from failed requests only'
      ],
      answer: [1],
      explanation: 'Latency is two numbers: TTFT is dominated by prefill and provider queueing (fix by shrinking/caching the prompt or rerouting); throughput is decode-bound (fix with a smaller/faster model or better serving endpoint). A slow-start/fast-stream call and a fast-start/slow-crawl call feel different and need opposite fixes, and total time cannot distinguish them. (A) hides the problem. (C) misplaces the bottleneck onto your infra when it is inside the provider call. (D) is a useful cut but unrelated to the latency decomposition.'
    },
    {
      text: 'You carefully pinned your model to a dated snapshot to avoid surprises, but quality still degraded over six weeks. Which drift did pinning fail to protect against?',
      options: [
        'Model drift — the snapshot changed anyway',
        'Traffic/input drift — the mix of user questions shifted (e.g. a new segment onboarded), and your prompt and retrieval were never tuned for it',
        'Prompt drift caused by the pin',
        'Pinning always degrades quality over time'
      ],
      answer: [1],
      explanation: 'Pinning the snapshot freezes the model, protecting against model drift only — it does nothing about the world changing around a static system. If the input distribution shifts (new languages, new topics, a viral use case), a frozen prompt and retrieval quietly fail on it. (A) contradicts the premise — you pinned it. (C) a pin does not edit your prompt. (D) is false; pinning is neutral to quality, the drift came from inputs. The lesson: watch inputs and outputs, not just the version string.'
    },
    {
      text: 'What is the specific advantage of a frozen canary set over watching production score distributions for drift?',
      options: [
        'Canary sets are cheaper to store',
        'Because the inputs are frozen, any score change is attributable to what you (or the provider) changed, cleanly separating model/prompt drift from traffic drift — and it works as a pre-deploy gate',
        'Score distributions cannot detect drift at all',
        'Canary sets do not require any scoring function'
      ],
      answer: [1],
      explanation: 'Distributions over live traffic detect that SOMETHING moved but confound the cause (was it the model, the prompt, or a change in what users asked?). A canary holds inputs constant, so a score delta isolates model/prompt changes and gives a stable pre-deploy baseline. (A) storage is trivial for both and not the point. (C) is false — distributions are exactly how you get coverage of the unknown; canaries and distributions are complementary. (D) is false — a frozen canary still needs consistent scoring; freezing the inputs is what makes the score comparable.'
    },
    {
      text: 'You want to catch it when a provider silently updates a model behind an alias you use. Which combination is the strongest detection strategy?',
      options: [
        'Read the provider changelog every morning',
        'Pin the dated snapshot where possible, run a frozen canary eval on a schedule against the live endpoint, and watch output-property distributions (refusal rate, length, score) for shifts',
        'Set temperature to 0 so outputs never change',
        'Increase max_tokens so the model has room to be consistent'
      ],
      answer: [1],
      explanation: 'Detection is layered: pinning removes the surprise where the vendor allows it; a scheduled frozen-canary probe against the live model trips on any behavior change; and distribution monitors (refusal rate, length, judge score) catch shifts you did not anticipate. (A) changelogs are incomplete and lag reality. (C) temperature 0 reduces sampling variance but does nothing about a changed underlying model. (D) max_tokens is a length cap, irrelevant to detecting a model swap.'
    },
    {
      text: 'Explicit thumbs-down feedback on your assistant is very sparse. Which THREE implicit signals give dense, useful (if noisy) quality evidence?',
      options: [
        'The user clicked "regenerate" on the answer',
        'The user copied the output text',
        'The exact server timestamp the request arrived',
        'The user rephrased and immediately asked again (or said "no, I meant...")',
        'The TLS cipher suite negotiated for the request'
      ],
      answer: [0, 1, 3],
      multi: true,
      explanation: 'Regeneration (dissatisfaction), copy events (a positive "I took this"), and next-turn corrections/rephrasings (buried negatives) are all behavioral signals available at far higher volume than explicit clicks. (C) arrival timestamp is metadata with no bearing on answer quality. (E) TLS cipher is transport trivia. Implicit signals are noisy and must be triangulated, but they are where most of the quality signal lives when explicit feedback is under 1%.'
    },
    {
      text: 'A UI change auto-inserts the assistant\'s answer instead of requiring a copy click, and your copy-rate quality metric crashes to near zero. What is the correct interpretation?',
      options: [
        'Quality genuinely collapsed; roll back the model',
        'The implicit signal was invalidated by the UI change, not by any quality drop — implicit signals are correlational and must be triangulated, never wired directly into an automated alarm',
        'Copy-rate is always a perfect quality proxy',
        'The model started refusing to produce copyable output'
      ],
      answer: [1],
      explanation: 'Copy-rate is a proxy that depends on the UI making copying necessary; remove the need and the signal vanishes while satisfaction is unchanged. This is the canonical over-reading of implicit signals — powerful in aggregate, but noisy and context-dependent. (A) confuses a signal artifact for a quality event and would trigger a needless rollback. (C) is exactly the false belief the scenario refutes. (D) invents a mechanism; the answers are the same, only the copy affordance changed.'
    },
    {
      text: 'Which sequence correctly describes mining production failures into a durable quality improvement?',
      options: [
        'Delete failing traces so they do not skew metrics, then retrain',
        'Surface candidates (thumbs-down, regenerations, low judge scores) with full traces → triage and categorize real failures → promote confirmed cases with corrected expected outputs into the eval/canary set → fix and let the gate prevent regression',
        'Wait for enough thumbs-down to fine-tune the base model directly',
        'Edit the canary set so the current failing cases pass, then ship'
      ],
      answer: [1],
      explanation: 'The flywheel turns real failures into permanent regression tests: capture with trace, human-triage into categories that point at the failing subsystem, promote to the frozen eval set with a corrected expectation, fix, and the enlarged gate holds the line. (A) destroys your richest, cheapest eval data. (C) jumps to fine-tuning — usually the wrong, heaviest tool and it skips the eval/gate that proves the fix. (D) is corruption of the baseline: editing a canary to make failures pass destroys the very signal that makes it useful.'
    },
    {
      text: 'You capture full prompts and completions for debugging. A user files a GDPR erasure request. What does this reveal about your trace store?',
      options: [
        'Nothing — telemetry is exempt from erasure requests',
        'The trace store is a second copy of sensitive user data subject to the same law; you must be able to find and delete every span containing that user\'s data, which requires designing deletion (e.g. per-user tagging + targeted purge) in from the start',
        'You only need to delete the primary database record',
        'Redaction at capture time makes erasure unnecessary'
      ],
      answer: [1],
      explanation: 'Full-prompt capture means your observability system holds verbatim user data — PII with the same legal weight as your primary store, including erasure rights. If traces are scattered across a third-party SaaS with no per-user tagging, honoring "right to be forgotten" is impossible, a compliance gap that predates any breach. (A) is false — "it\'s just logs" is not a legal exemption. (C) ignores the trace copy entirely. (D) redaction reduces but never guarantees zero PII (90-98% recall), so it cannot substitute for deletion capability.'
    },
    {
      text: 'Your team wants to keep full-payload traces for a year "just in case." What is the strongest privacy-and-cost argument against long retention, and the better design?',
      options: [
        'Long retention improves model accuracy, so keep everything',
        'Traces have a sharp value half-life (you debug last week, not last year); short TTLs on full payloads (e.g. 7-30 days) shrink both storage cost and breach blast radius, while aggregated/redacted metrics can be kept longer',
        'Storage is free, so retention length is irrelevant',
        'You must keep all traces indefinitely for audit compliance'
      ],
      answer: [1],
      explanation: 'The cheapest privacy control is not keeping data. Full prompts lose debugging value fast, so a short TTL on payloads cuts both cost and the amount of sensitive data exposed in a breach, while you retain long-lived aggregates that carry trend value without raw PII. (A) inverts the tradeoff and ignores privacy. (C) is false at LLM trace volumes (50KB+ per turn adds up fast) and ignores liability entirely. (D) most regimes require the opposite — data minimization — not indefinite retention of raw user content.'
    }
  ],
  flashcards: [
    { id: 'fc-printf-dies', front: 'Why does printf/breakpoint debugging fail for LLM apps?', back: 'Nondeterminism (can\'t reliably reproduce), semantic failures (fluent-but-wrong, no crash/stack trace), and no single "code" artifact (output depends on prompt version + model snapshot + params + retrieved docs). The captured trace is your only durable record.' },
    { id: 'fc-payload-is-state', front: 'In an LLM app, what is the "state" you must record on a span?', back: 'The payload IS the state. You cannot reconstruct a nondeterministic failure without the fully-rendered prompt and the full completion — these are the load-bearing fields people wrongly truncate.' },
    { id: 'fc-span-fields', front: 'What should an LLM span record?', back: 'Fully-rendered prompt, full completion (incl. tool args), model snapshot id, sampling params, tokens in/out/cached separately, TTFT + total latency, computed cost, and linkage (trace/parent/user/session/feature/prompt-version ids).' },
    { id: 'fc-trace-tree', front: 'What is a trace tree and why do agent loops need one?', back: 'Spans nested by parent id forming the whole tree for one operation. An agent turn fans out into router/retrieval/tool/synthesis spans; the tree lets you localize which step first diverged from intent. A flat log loses the structure.' },
    { id: 'fc-otel-genai', front: 'What do the OpenTelemetry GenAI semantic conventions buy you?', back: 'Vendor-neutral attribute keys (gen_ai.request.model, gen_ai.usage.input_tokens, etc.) so one instrumentation can target many backends (Jaeger/Tempo/Datadog/LLM-native) without re-instrumenting. Portability, not redaction or compliance.' },
    { id: 'fc-cached-tokens', front: 'Why record cached input tokens separately from uncached?', back: 'Cached input is billed ~10% of the input rate. Lumping them corrupts every cost number and hides caching regressions — a busted cache prefix reads as a mysterious ~3x cost jump with no code change.' },
    { id: 'fc-cost-attribution', front: 'What is per-feature cost attribution and why does it matter?', back: 'Tagging every trace with the feature that triggered it and rolling up cost by feature/customer/user/model/prompt. Without it you have one undifferentiated bill and cannot find the feature (or account) torching your margin.' },
    { id: 'fc-unit-economics', front: 'What is the north-star cost metric for an LLM product?', back: 'Cost per successful outcome (resolved ticket, accepted suggestion), joining span cost to a success signal + volume. Cost per token is a meaningless input without an outcome attached.' },
    { id: 'fc-ttft-vs-throughput', front: 'TTFT vs tokens/sec — different physics, different fixes?', back: 'TTFT = prefill + queueing (fix: shrink/cache prompt, reroute region). Throughput = decode, memory-bandwidth-bound (fix: smaller/faster model, better serving). Total ≈ TTFT + output/throughput. Set separate SLOs; streaming makes both independently measurable.' },
    { id: 'fc-four-drifts', front: 'The four kinds of drift in LLM apps?', back: 'Model drift (provider updates the snapshot), traffic/input drift (users ask different things), prompt drift (accreted edits degrade), embedding/retrieval drift (corpus shifts, index rebuilds). Pinning the model stops only the first.' },
    { id: 'fc-drift-detect', front: 'How do you detect drift at scale?', back: 'Watch distributions over time — output properties (length, refusal rate, parse-failure rate), automated judge-score distributions, and input-embedding clusters — with distance metrics (PSI/KL) and alert on shifts.' },
    { id: 'fc-canary-set', front: 'Canary/golden set — what is it and its unique advantage?', back: 'A small frozen set of representative inputs with known-good expectations, run on a schedule and before every change. Because inputs are frozen, any score change is attributable to what changed — separating model/prompt drift from traffic drift. Never edit it to pass.' },
    { id: 'fc-explicit-feedback', front: 'Strengths and weaknesses of explicit (thumbs) feedback?', back: 'Unambiguous and human-authored (gold for eval sets) but sparse (<1% engage), biased (angry users click more), and shallow (says that, not what). Always capture the full trace beside each rating.' },
    { id: 'fc-implicit-signals', front: 'Name implicit feedback signals and their nature.', back: 'Regeneration (negative), copy events (positive), edit-after-accept (partial), abandonment (weak negative), next-turn corrections (buried negative). Dense but correlational — triangulate, never wire a single one straight into an automated alarm.' },
    { id: 'fc-failure-flywheel', front: 'The mine-failures-into-evals flywheel?', back: 'Surface candidates (thumbs-down/regenerations/low judge scores) with traces → triage into categories that point at the failing subsystem → promote confirmed cases with corrected expectations into the eval/canary set → fix, and the gate prevents regression.' },
    { id: 'fc-trace-liability', front: 'Why is your trace store a privacy liability?', back: 'Full-prompt capture makes it a verbatim second copy of everything users typed — PII with the same legal weight (GDPR/HIPAA/CCPA), including erasure rights, often with weaker protection because "it\'s just logs."' },
    { id: 'fc-two-redaction-points', front: 'The two redaction points and what each protects?', back: 'Before the model: strip PII from prompts before they hit a third-party API (protects against provider retention/training). Before the trace store: mask/hash sensitive fields before writing telemetry (protects your observability copy).' },
    { id: 'fc-redaction-limits', front: 'Can you call traces "PII-free" because you run a redactor?', back: 'No. PII detection on free-form text runs ~90-98% recall as of early 2026 — good for reducing exposure, useless as a guarantee. Say you "reduce PII exposure"; add short retention, strict audited access, and encryption. Defense in depth.' },
    { id: 'fc-retention', front: 'Why short retention on full-payload traces?', back: 'Traces have a sharp value half-life — you debug last week, not last year. Short TTLs (7-30 days for payloads) cut both storage cost and breach blast radius; keep only aggregated/redacted metrics longer.' },
    { id: 'fc-trace-residency', front: 'How does data residency apply to traces?', back: 'An EU user\'s conversation should stay in an EU trace store, not flow to a US observability region. If inference routes regionally for compliance, the telemetry pipeline needs the same partitioning or you re-create the cross-border transfer one layer down.' }
  ],
  lab: {
    title: 'Instrument an agent: spans, cost, and a drift canary',
    intro: '<p>You will wrap a small two-step LLM flow in manual spans, record the fields that matter (prompt, completion, model snapshot, tokens in/out, latency, computed cost), print the trace tree, and run a tiny frozen canary to see drift detection in miniature. No tracing SaaS required — you build the span object yourself so the mechanics are transparent; the same shape maps directly onto OTel/Langfuse/LangSmith.</p><p><b>Needs:</b> <code>python3</code>, an OpenAI-compatible API key (or a local Ollama endpoint for $0), ~$0.05 worst case.</p>',
    steps: [
      {
        title: 'A minimal span recorder',
        html: '<p>Build a span as a plain dict and a helper that times an LLM call and records the load-bearing fields. This is exactly what an SDK does under the hood.</p>' +
          '<pre><code>pip install openai\n\npython3 - &lt;&lt;\'EOF\'\nimport time, json, uuid\nfrom openai import OpenAI\nclient = OpenAI()  # or OpenAI(base_url="http://localhost:11434/v1", api_key="x")\n\n# price card (USD per 1M tokens) — edit to your model/snapshot\nPRICE = {"gpt-4o-mini": {"in": 0.15, "out": 0.60}}\nMODEL = "gpt-4o-mini"\nSPANS = []\n\ndef llm_span(name, messages, trace_id, parent=None, **kw):\n    t0 = time.time()\n    r = client.chat.completions.create(model=MODEL, messages=messages, **kw)\n    dt = time.time() - t0\n    u = r.usage\n    p = PRICE[MODEL]\n    cost = (u.prompt_tokens * p["in"] + u.completion_tokens * p["out"]) / 1e6\n    span = {\n        "span_id": str(uuid.uuid4())[:8], "parent": parent, "trace_id": trace_id,\n        "name": name, "model_snapshot": r.model,   # note: server returns the DATED snapshot\n        "prompt": messages, "completion": r.choices[0].message.content,\n        "in_tokens": u.prompt_tokens, "out_tokens": u.completion_tokens,\n        "latency_s": round(dt, 3), "cost_usd": round(cost, 6),\n    }\n    SPANS.append(span)\n    return span\nEOF</code></pre>' +
          '<p>Notice <code>r.model</code> returns the exact dated snapshot the provider served — record that, not "gpt-4o-mini", so you can catch silent model drift later.</p>'
      },
      {
        title: 'A two-step flow that forms a trace tree',
        html: '<p>Run a router step then a synthesis step under one trace id so the spans nest into a tree, then print it. Append this to the same script (keep the functions above in scope).</p>' +
          '<pre><code>trace = str(uuid.uuid4())[:8]\nq = "Summarize the risks of prompt injection in two sentences."\n\nroot = llm_span("route", [\n  {"role":"system","content":"Reply with one word: SIMPLE or COMPLEX."},\n  {"role":"user","content": q}], trace, max_tokens=3)\n\nfinal = llm_span("synthesize", [\n  {"role":"user","content": q}], trace, parent=root["span_id"])\n\ndef show(trace_id):\n    print("TRACE", trace_id)\n    total = 0.0\n    for s in [x for x in SPANS if x["trace_id"] == trace_id]:\n        indent = "  " if s["parent"] else ""\n        total += s["cost_usd"]\n        print(f"{indent}{s[\'name\']:<12} {s[\'model_snapshot\']:<24} "\n              f"in={s[\'in_tokens\']:<4} out={s[\'out_tokens\']:<4} "\n              f"{s[\'latency_s\']}s  ${s[\'cost_usd\']:.6f}")\n    print(f"trace total: ${total:.6f}")\nshow(trace)</code></pre>' +
          '<p>You now have a trace tree with per-step tokens, latency, and cost, and a rolled-up trace total — the atomic unit of cost attribution. Tag the trace with a <code>feature</code> field and you can aggregate spend per feature exactly as production dashboards do.</p>'
      },
      {
        title: 'A frozen canary to catch drift',
        html: '<p>A tiny canary set with expected substrings. Freeze it, score it, and re-run it later (or after changing MODEL) — any score change is attributable to what changed, not to shifting traffic.</p>' +
          '<pre><code>CANARY = [\n  {"q": "What is 2+2? Reply with only the number.", "expect": "4"},\n  {"q": "Capital of Japan? One word.", "expect": "Tokyo"},\n  {"q": "Is water wet? Answer yes or no.", "expect": "es"},  # matches Yes/yes\n]\n\ndef run_canary():\n    passed = 0\n    for c in CANARY:\n        sp = llm_span("canary", [{"role":"user","content": c["q"]}],\n                      "canary-"+str(uuid.uuid4())[:4], max_tokens=10)\n        ok = c["expect"].lower() in sp["completion"].lower()\n        passed += ok\n        print(("PASS" if ok else "FAIL"), sp["model_snapshot"], repr(sp["completion"][:40]))\n    print(f"canary score: {passed}/{len(CANARY)}")\n\nrun_canary()</code></pre>' +
          '<p>Record the snapshot id printed beside each result. Re-run this on a schedule against the live endpoint: if the score drops while the canary inputs are unchanged, you have caught model or prompt drift before your users did. Swap <code>MODEL</code> to a different snapshot and watch the score potentially move — that is the drift signal in miniature.</p>'
      }
    ],
    costNote: 'Worst-case spend for all three steps on a gpt-4o-mini-class model: under $0.05 (a handful of tiny calls). On a local model (Ollama: <code>ollama run llama3.2</code>, base_url http://localhost:11434/v1): $0. No persistent cloud resources are created — nothing to delete; if you logged spans to a file, remove it with <code>rm spans.json</code>.'
  }
});
