COURSE.register({
  id: 'm19-production-patterns',
  track: 'advanced',
  order: 19,
  title: 'Production patterns',
  short: 'Production patterns',
  tagline: 'Failover, guarded rollouts, versioning, abuse defense, queues, and multi-tenancy — the difference between a demo and a system.',
  minutes: 120,
  lessons: [
    {
      id: 'fallbacks-degradation',
      title: 'Fallbacks and degradation: AI down ≠ product down',
      blurb: 'Multi-provider failover, timeout ladders, and designing the degraded modes before you need them.',
      html: '<h2>The dependency you do not control</h2>' +
        '<p>Your LLM provider is a third-party dependency with the failure profile of a busy distributed system: elevated-latency incidents, error-rate spikes, regional brownouts, and the occasional full outage. Every major provider has had multi-hour incidents; as of early 2026 the observed pattern is a few significant degradations per provider per year, plus routine 429s (rate limiting) and P99 latency excursions weekly. If your product\'s core loop dies when the API does, you have shipped someone else\'s pager as your uptime. The design principle: <b>AI down ≠ product down.</b> The AI feature degrades; the product survives.</p>' +
        '<p>Build the failure hierarchy explicitly — each rung cheaper in capability, higher in availability:</p>' +
        '<ol>' +
        '<li><b>Retry same model</b> — for transient 429/5xx/timeouts: exponential backoff with jitter, honor <code>Retry-After</code>, cap attempts at 2–3. Never retry on 4xx validation errors (you will get the same answer, slower) and never retry non-idempotent tool-executing calls blindly (module 9).</li>' +
        '<li><b>Failover to a second provider/model</b> — same capability class, different infrastructure. Requires prompt portability work in advance: your prompts, tool schemas, and evals must already run there. A failover target you have never evaled is not a fallback, it is a different product with the same button.</li>' +
        '<li><b>Degrade capability</b> — smaller/faster model with a simplified prompt, or a reduced feature: retrieval-only answers ("here are the 3 most relevant docs") instead of synthesis, cached/canned responses for the top intents, shorter outputs.</li>' +
        '<li><b>Degrade honestly to non-AI</b> — the search box, the form, the human queue, the "AI suggestions unavailable" banner. The product keeps working because you built it as a product, not a wrapper.</li>' +
        '</ol>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Fallbacks are a product decision wearing an infrastructure costume. "What does the user see when the model is down?" must be answered by design, per feature, before launch — because the alternative is that an outage answers it for you, in production, at 2 a.m.</div>' +
        '<h2>Timeout ladders and hedging</h2>' +
        '<p>Naive timeout settings cause more self-inflicted outages than provider incidents do. LLM latency is long-tailed — P50 2 s, P99 20 s is a normal shape for generation with tools — so a single flat timeout either kills legitimate slow requests (too tight) or lets one hung call pin a worker for a minute (too loose). The pattern that works is a <b>ladder</b>:</p>' +
        '<ul>' +
        '<li><b>Connect timeout</b> tight (1–2 s): failure to establish a connection is a fast, reliable signal — fail over immediately.</li>' +
        '<li><b>Time-to-first-token timeout</b> moderate (5–10 s for interactive): if streaming has not started, the request is probably queued behind an incident; abandon and fail over. TTFT is your best early-warning signal — track it per provider.</li>' +
        '<li><b>Inter-token / total deadline</b> generous but real (30–120 s by feature): protects against mid-stream stalls without murdering long generations. Propagate the user-facing deadline down through every layer — a 60 s internal retry budget behind a 10 s UI timeout burns money answering questions nobody is waiting for.</li>' +
        '<li><b>Hedging</b> for latency-critical paths: if no first token by P90-expected time, fire a second request (same or different provider) and take whichever responds first, cancelling the loser. Costs a few percent extra tokens; buys a dramatically better tail. Only for idempotent, non-tool-executing calls.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Wrap all of it behind one internal gateway interface — a single <code>complete()</code> seam that owns provider selection, retries, timeouts, circuit breaking, and logging. A <b>circuit breaker</b> per provider (open after N failures in a window, half-open probes, close on success) is what prevents the retry storm: without it, an incident at your provider triggers synchronized retries from your entire fleet, which is a DDoS you are paying for by the token. Libraries and LLM gateways ship this; the concept matters more than the vendor.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team wired up provider-B failover and slept well — until provider A actually went down and B\'s responses broke their JSON parser: subtly different tool-call formatting and a habit of markdown-fencing outputs. Nobody had run the eval suite against B in four months of prompt changes. Failover paths rot exactly like disaster-recovery runbooks. The fix that sticks: send 1–5% of live traffic (or a nightly eval run) through the fallback path <em>permanently</em>, so drift is a dashboard alert, not an incident surprise.</div>' +
        '<h2>What good degradation looks like</h2>' +
        '<p>Walk a concrete example — an AI support assistant during a full provider outage: the chat input stays live but routes to retrieval-only mode, answering with top-3 KB articles and an honest banner ("AI answers are temporarily unavailable — here are matching articles"); ticket deflection drops from 60% to 25% instead of to zero; the escalate-to-human button gets promoted; and an incident metric distinguishes "AI-degraded sessions" so product can quantify the cost. Compare the alternative: a spinner, a timeout, a blank error, and a Twitter thread. Degraded modes must be <b>designed, built, and chaos-tested</b> — a fallback that has never fired in anger does not exist. The lab for this module makes you fire yours on purpose.</p>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your LLM provider is down — walk me through what your product does" is the production-maturity screen. Strong answers have the ladder (retry → failover → degrade → non-AI), the eval-parity caveat on failover targets, circuit breakers against retry storms, and a designed user-facing degraded state. "We\'d switch providers" with no eval story is the junior tell.</div>'
    },
    {
      id: 'canary-rollouts',
      title: 'Canary prompts and guarded rollouts',
      blurb: 'Shadow traffic, percentage rollouts, and auto-rollback — because prompt changes are deploys.',
      html: '<h2>Prompt changes are deploys</h2>' +
        '<p>A one-line prompt edit can change behavior across 100% of traffic instantly — a blast radius most teams would never accept for code without CI, staging, and a rollout plan, yet routinely accept for prompts edited in a dashboard textbox. The discipline transfers directly: <b>every behavior-affecting change (prompt, model version, temperature, tool schema, retrieval config) rides the same guarded pipeline as code.</b> Offline evals are the unit tests; rollouts are how you catch what evals missed — and evals always miss things, because your eval set is a sample and production is the distribution.</p>' +
        '<p>The rollout toolkit, in escalating exposure:</p>' +
        '<ul>' +
        '<li><b>Offline eval gate:</b> the candidate change must clear the regression suite (module 11) before touching traffic. Non-negotiable, and also insufficient.</li>' +
        '<li><b>Shadow traffic:</b> run the candidate <em>alongside</em> production on a sample of real requests; users see only the incumbent\'s answer. Compare outputs: judge scores, diff rates, format validity, refusal rates, latency, token cost. Shadow is the highest-information zero-risk step — it sees the real distribution without exposing users — at the price of 2× inference on sampled traffic and no user-behavior signal (you cannot shadow a click).</li>' +
        '<li><b>Percentage canary:</b> 1% → 5% → 25% → 100%, gated on metrics at each stage, with sticky assignment (a user stays in one arm — mid-conversation behavior flips are their own incident class). For subjective quality changes, this is also your A/B test: thumbs, regeneration rate, task completion, escalation rate.</li>' +
        '<li><b>Auto-rollback:</b> pre-registered guardrail metrics with thresholds and a minimum sample size; breach → automatic revert to the last good config, page the owner, attach the diff. Rollback must be config-flip fast (seconds), which the versioning lesson makes possible.</li>' +
        '</ul>' +
        '<h2>Canary metrics for LLM features</h2>' +
        '<p>Classic canaries watch error rate and latency. LLM canaries need behavioral metrics on top, because the failure mode is not 500s — it is <em>confidently different answers</em>:</p>' +
        '<table><tr><th>Metric</th><th>Catches</th><th>Signal speed</th></tr>' +
        '<tr><td>Format validity (JSON parse rate, schema pass rate)</td><td>Model/prompt changes breaking structured outputs</td><td>Minutes</td></tr>' +
        '<tr><td>Refusal / safety-trigger rate</td><td>New model being touchier or looser than the old one</td><td>Minutes–hours</td></tr>' +
        '<tr><td>Output length and token cost per request</td><td>Verbosity shifts, cost regressions</td><td>Minutes</td></tr>' +
        '<tr><td>Online judge score on sampled outputs</td><td>Quality dips evals missed (a small judge model scoring 1–5% of live outputs against a rubric)</td><td>Hours</td></tr>' +
        '<tr><td>User behavior: regeneration rate, thumbs, abandonment, escalation-to-human</td><td>What actually matters</td><td>Hours–days</td></tr></table>' +
        '<p>Set thresholds relative to the control arm, not absolute values ("canary refusal rate &gt; control + 2σ"), and hold canaries long enough for slow metrics — a quality dip that shows up as churn takes days, which is an argument for keeping 5% canaries running longer than feels necessary, not for skipping ahead.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team upgraded to a new model version after it beat the old one on their eval suite by 4 points. At 100% rollout (no canary — "the evals passed"), support tickets spiked: the new model formatted refund amounts differently ("$1,234.56" vs "1234.56 USD"), breaking a downstream regex that fed the billing display. No eval covered the regex because nobody knew it existed. A 5% canary watching format-validity and downstream error rates would have caught it in an hour at 5% of the blast radius. Evals test what you thought to test; canaries test what you forgot existed.</div>' +
        '<h2>Shadow mode as a permanent fixture</h2>' +
        '<p>Shadowing is not just a rollout stage — mature teams keep permanent shadow lanes: the fallback provider (keeping failover evals honest, per the previous lesson), next quarter\'s candidate model (building a longitudinal comparison before the migration decision), and a cheaper model on sampled traffic (continuously answering "could we route more traffic down yet?" — module 18). The cost is bounded by the sampling rate; the payoff is that model migrations stop being leaps of faith and become merges of an already-green branch. One discipline note: shadow outputs must never leak into user-visible surfaces, logs that feed training data, or caches — tag them at the gateway and drop them from every downstream pipeline by default.</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Guarded rollouts need traffic to gate on. At 1% canary you need enough requests for statistical signal — for a feature doing 1k requests/day, a 1% canary sees 10/day, and your "auto-rollback on 2σ" fires on noise or never. Low-traffic features should canary at 25–50%, lean harder on shadow comparisons and offline evals, and accept slower certainty. The machinery scales down; the math does not.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How do you ship a prompt change safely?" Full-credit answer: eval gate → shadow on real traffic → sticky percentage canary with behavioral metrics (format validity, refusal rate, judge scores, regen rate) → auto-rollback on pre-registered thresholds → config-flip revert. Mentioning that evals are a sample and canaries catch the unknown-unknowns is the senior framing.</div>'
    },
    {
      id: 'versioning-everything',
      title: 'Versioning everything: reproduce yesterday\'s behavior',
      blurb: 'Prompt + model + params + tools as one deployable unit — config-as-code, not dashboard archaeology.',
      html: '<h2>The reproducibility question</h2>' +
        '<p>A user reports: "yesterday the assistant told me I could get a refund; today it says I can\'t." Compliance wants to know which is right and why the answer changed. Can you reproduce yesterday\'s behavior — exactly? For most teams the honest answer is no: the prompt lives in a dashboard someone edited since, the model alias silently moved to a new snapshot, someone tweaked temperature, and a tool description changed in a different repo. Four unversioned dimensions, any of which changes behavior; their cross product is untraceable by archaeology.</p>' +
        '<p>The fix is to define the deployable unit correctly. What users experience is not "the prompt" — it is a <b>generation config</b>: the full tuple that determines behavior:</p>' +
        '<pre><code># generation config: one versioned, deployable, diffable unit\nfeature: support-assistant\nversion: 2026-07-18.3\nmodel: provider-x/model-y-2026-05-01      # pinned snapshot, never a floating alias\nparams: { temperature: 0.2, max_tokens: 800 }\nprompt_ref: prompts/support-v41.md         # content-hashed\ntools: [kb_search@v7, ticket_create@v3]    # schemas versioned too\nretrieval: { index: kb-2026-07-17, k: 4, reranker: rr-v2 }\nguardrails: { input: v5, output: v9 }</code></pre>' +
        '<p>This unit lives in git (config-as-code), deploys through the same pipeline as code, canaries as a unit (previous lesson), and rolls back as a unit. Every LLM request logs the config version it ran under. Now "reproduce yesterday" is: check out the config active yesterday (your deploy log knows), replay the request, diff. And "what changed?" is <code>git diff</code>, not an interview of everyone with dashboard access.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Version the tuple, not the text. Prompt v41 with model snapshot A and prompt v41 with snapshot B are <em>different behaviors</em> — treating the prompt as the unit of versioning is the mistake that makes incidents unreproducible. The config version is the behavior version.</div>' +
        '<h2>Pinning, aliases, and silent drift</h2>' +
        '<p>Providers ship floating aliases (a name that tracks their latest snapshot) and pinned snapshots (dated versions). Production traffic belongs on <b>pins</b>, as of early 2026 and forever: floating aliases mean a vendor deploy is <em>your</em> unreviewed behavior change — teams have watched refusal rates, output formats, and even language choice shift overnight with zero diff on their side. Pins have a lifecycle (providers deprecate old snapshots on published schedules, typically 6–12 months), so model upgrades become planned migrations — eval, shadow, canary — on your calendar instead of surprises on theirs. Two subtler drift sources worth pinning or at least logging: <b>tool schemas</b> (a "clarified" tool description changes call rates — it is prompt text by another name) and <b>retrieval indexes</b> (yesterday\'s answer came from yesterday\'s index; log a snapshot id or accept that RAG answers are only approximately reproducible).</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A fintech assistant\'s compliance review asked why it had approved a fee-waiver phrasing in March. The team could produce the March prompt — but not the March model snapshot (floating alias since upgraded twice) or the March KB index. The behavior was unreproducible; the review escalated; the remediation project to build versioned configs cost 20× what building it up front would have. In regulated domains, "reproduce the exact config that produced this output" is increasingly a hard requirement (the EU AI Act\'s logging provisions point the same direction as of early 2026) — build for it before you are asked.</div>' +
        '<h2>Prompt management without a dashboard religion</h2>' +
        '<p>Where should prompts live? The failure modes bracket the answer. Prompts-in-code (string literals) get full git rigor but couple prompt iteration to app deploys and lock out non-engineer prompt contributors. Prompts-in-a-dashboard decouple iteration but drift from evals and code review unless the tool enforces them. The pattern that works: <b>prompts as files in the repo</b> (reviewable, diffable, eval-gated in CI), referenced by the generation config, <em>deployed</em> as config so a prompt rollout does not require an app deploy — with or without a prompt-management product on top. The requirements are invariant even if the tooling varies: reviewed changes, eval gates, versioned deploys, instant rollback, and an audit log of who changed what when.</p>' +
        '<ul>' +
        '<li><b>Log per request:</b> config version, model snapshot actually served (some gateways report it), input/output token counts, latency, and ids linking to the full payload (retention-policy permitting). This is simultaneously your debugging, cost-attribution, and compliance substrate.</li>' +
        '<li><b>Keep an environments story:</b> dev/staging/prod configs differ (staging points at cheaper models, test indexes); the config schema should make the diff explicit rather than implicit in env vars scattered across services.</li>' +
        '<li><b>Delete old configs never; archive always.</b> Storage is free; the compliance question arrives 11 months later.</li>' +
        '</ul>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "A customer disputes something your assistant said last month — what happens next?" is the versioning question in disguise. Strong answer: request log → config version → replay under the archived tuple (pinned model, prompt hash, tool versions, index snapshot) → diff against today → root-cause the changed dimension. If your answer contains the phrase "check what the prompt probably was," you have already failed the audit.</div>'
    },
    {
      id: 'abuse-prevention',
      title: 'Abuse prevention: rate limits, budgets, and the economics of freeloading',
      blurb: 'Per-user token budgets, jailbreak economics, and the free-tier resale problem.',
      html: '<h2>Your product is an API with extra steps</h2>' +
        '<p>The moment you put an LLM behind a free or flat-priced product surface, you have created an arbitrage: frontier tokens have market value, and anyone who can extract them below that value will. The canonical abuse, seen by essentially every AI product with a free tier as of early 2026: scripted clients driving your chat endpoint as a general-purpose LLM API — <b>resale of your API through your product</b>. Wrappers appear on gray-market "free GPT" aggregators, usage looks like an inexplicably chatty user, and your unit economics quietly invert. Related species: scraping via your summarize endpoint, SEO-spam generation through your writing feature, and using your agent\'s browsing tool as a free proxy network.</p>' +
        '<p>The defense stack, from cheapest to most involved:</p>' +
        '<ul>' +
        '<li><b>Rate limiting per user/key/IP</b> — requests per minute <em>and per day</em> (bursty humans are spiky but bounded; scripts are steady and relentless — the daily cap catches what the per-minute limit misses). Sliding-window or token-bucket, enforced at the gateway.</li>' +
        '<li><b>Token budgets per user/tenant per period</b> — the LLM-specific control most teams forget. Requests are the wrong unit: one request can be 200 or 200,000 tokens. Budget what costs money: tokens in + out, weighted by model tier, with per-day and per-month ceilings tied to plan level. Soft-warn at 80%, degrade to a cheaper model or queue at 100%, hard-stop only past an abuse threshold.</li>' +
        '<li><b>Shape validation:</b> your chat feature has a natural input distribution — message lengths, request cadence, conversation shapes. Traffic that looks like API calls (max-length inputs, zero think-time between turns, no UI events, identical formatting) gets challenged (CAPTCHA, auth step-up) or deprioritized. Cheap heuristics catch most resale wrappers because wrappers optimize for throughput, not for looking human.</li>' +
        '<li><b>Output constraints as economics:</b> capping free-tier <code>max_tokens</code>, limiting conversation length, and restricting system-prompt-visible capabilities lowers the arbitrage value of your endpoint below the effort of extracting it. Abuse prevention is not about making extraction impossible — it is about making it uneconomical.</li>' +
        '</ul>' +
        '<h2>Jailbreaks: model the economics, not just the prompt</h2>' +
        '<p>Prompt-injection defenses are module 13; here the production framing: jailbreaking your product is an <em>economic</em> activity with attacker cost (time to find a working bypass, burner accounts) and attacker value (free capable tokens, "make the brand say something screenshot-worthy", policy-violating content generation at your expense and under your name). Your levers move the ratio: per-account budgets cap the value of any single bypass; output moderation raises detection probability; velocity limits on new/free accounts raise the cost of scale (one bypassed account generating 50 spam posts is a nuisance; 5,000 burner accounts is a pipeline — the defense is account-creation friction and cohort anomaly detection, not a better system prompt); and <b>terminate-don\'t-argue</b>: when moderation flags a session repeatedly, end it and flag the account — continuing to serve a determined attacker while your guardrails debate them is paying for your own red team.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A startup\'s $29/month "unlimited" writing assistant found 40 accounts responsible for 38% of total token spend — resellers driving it through scripts as a bulk-content API, some individual accounts burning $2,000+/month in tokens. The giveaways in retrospect: 24/7 flat usage curves (humans sleep), max-length prompts on every call, and zero UI telemetry events. Fixes: fair-use token budget with published thresholds, silent degradation to a small model past it, bot-shaped-traffic challenges. Churn from the change: seven accounts — the forty were never customers. "Unlimited" plus tokens-cost-money is not a pricing plan; it is a bounty.</div>' +
        '<h2>Budgets as blast-radius control</h2>' +
        '<p>Per-tenant budgets are not only revenue protection — they are your safety container for everything else in this course: a prompt-injected agent stuck in a tool loop (module 9) burns until <em>something</em> stops it, and the per-tenant budget is that something; a compromised API key\'s damage is its budget, not your credit limit; a runaway retry storm (lesson 1) hits the budget alarm before the invoice. Implement budgets as a first-class gateway concern with tiered responses — warn, degrade, queue, stop — and per-tenant dashboards. The same metering is your cost-attribution substrate (module 18) and your noisy-neighbor defense (lesson 6). One metering system, four jobs; build it early because everything else leans on it.</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Set budget numbers from data, not vibes: P99 of legitimate per-user daily tokens × 3–5 is a defensible free-tier ceiling; paid tiers scale with price. Publish fair-use thresholds (silent limits generate support fires); log every enforcement action (the appeal will come); and revisit quarterly — model price drops change the arbitrage math on both sides.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your free tier is being abused — design the defense" is a favorite because it tests economics thinking over pattern-matching. Strong shape: identify the arbitrage (your tokens have resale value), then layer rate limits + token budgets (the LLM-specific unit) + traffic-shape heuristics + value-lowering caps, with the punchline that the goal is making abuse uneconomical, not impossible.</div>'
    },
    {
      id: 'queues-vs-sync',
      title: 'Queues vs sync: when the answer takes a while',
      blurb: 'Async job patterns, status UX, webhooks, and surviving long-running agent work.',
      html: '<h2>The synchronous ceiling</h2>' +
        '<p>Request/response works until the work outgrows the connection. LLM systems outgrow it fast: a chat turn is 2–10 s (fine synchronously, streamed), but a document batch is minutes, a research agent is 5–30 minutes, and a "migrate my codebase" job is hours. Holding HTTP connections for minutes fails on every layer — load-balancer idle timeouts (often 60 s), mobile network churn, browser tab lifecycle, worker-pool exhaustion on your side — and retrying a half-finished 20-minute agent job because a connection dropped is both expensive and, if the agent executed tools, dangerous (module 9: side effects are not idempotent).</p>' +
        '<p>The decision rule as of early 2026 practice: <b>under ~30 s expected P95, stay synchronous and stream; past it, go async</b> — enqueue a job, return a job id immediately, deliver results out-of-band. In between (30–120 s) is judgment territory: streaming progress can hold a user\'s attention for a single foreground task, but anything the user might reasonably tab away from belongs in a queue.</p>' +
        '<h2>The async LLM job, done properly</h2>' +
        '<ul>' +
        '<li><b>Job record as the source of truth:</b> id, tenant, status (queued → running → succeeded/failed/cancelled), progress payload, cost-so-far, timestamps, and the generation-config version it runs under (lesson 3). The connection is ephemeral; the record is not.</li>' +
        '<li><b>Status delivery:</b> polling (simple, fine at low volume), SSE/WebSocket subscriptions for live progress, and <b>webhooks for machine consumers</b> — signed (HMAC), retried with backoff, idempotency keys on delivery, and a dead-letter path. If you only build polling, your biggest customers will build fragile pollers against you and file tickets about them.</li>' +
        '<li><b>Progress that means something:</b> LLM jobs have no honest percentage — an agent does not know it is "60% done." Report <em>stages and evidence</em> instead: "processed 34/120 documents", "step 4: running tests — 2 failures to fix", current-action strings. Users tolerate long waits with legible progress and abandon opaque ones; a live activity feed of an agent\'s steps is both the progress UX and your debugging trace.</li>' +
        '<li><b>Checkpointing for long agent jobs:</b> persist state after each completed step (conversation state, tool results, artifacts) so a worker death resumes from step 12, not step 0. Resumability changes the economics of retries — a 30-minute job that can only restart from zero has a nasty expected-cost curve as job length grows, because the probability of <em>some</em> interruption grows with duration.</li>' +
        '<li><b>Cancellation and TTLs:</b> users close tabs; abandoned jobs must die. Propagate cancellation to in-flight LLM calls and tool executions, cap every job with a wall-clock TTL and a token budget (lesson 4 — the runaway agent\'s backstop), and reconcile orphaned jobs on a sweep.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Queue mechanics that bite LLM workloads specifically: set <b>visibility timeouts</b> longer than your longest LLM call or jobs get double-delivered mid-generation (and a non-idempotent agent step runs twice — see module 9\'s payment story); make every step idempotent or guarded by an execution ledger; use <b>per-tenant fair queuing</b> rather than one FIFO (next lesson\'s noisy neighbor otherwise ships one 10k-document job and starves everyone); and put LLM rate-limit awareness in the <em>workers</em> — a queue that drains at full parallelism into a rate-limited API just converts queue depth into 429 storms.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team shipped "analyze your contract portfolio" as a synchronous endpoint. It worked in the demo (3 contracts). A customer uploaded 400; the request ran 11 minutes, the ALB cut it at 60 s, the frontend retried automatically — three times — and the customer got four concurrent 400-contract jobs billing in parallel, no results, and a five-figure token bill for the day. Every part of that incident is a lesson in this module: sync past the ceiling, no idempotency key, retry-on-timeout without a job record, no per-tenant budget cap. The rebuilt version: upload → job id in 200 ms → progress feed → email + webhook on completion. Same model, same prompts — the difference between an incident and a feature was entirely the delivery architecture.</div>' +
        '<h2>Designing the waiting experience</h2>' +
        '<p>Async is a UX surface, not just plumbing. Patterns that separate polished products: set expectations at submit time ("usually 5–10 minutes — we will email you"), deliver partial results as they materialize (per-document as each finishes, not all-or-nothing at the end), make results durable and shareable (a link that works tomorrow, not a transient socket), and channel-match the notification (in-app for minutes-scale, email/Slack/webhook for longer). And keep a fast preview path where possible — kick off the full job <em>and</em> return a quick cheap-model sketch of the first item so users can confirm the job is aimed correctly before 30 minutes of tokens burn in the wrong direction. That preview is a cascade (module 18) wearing a UX hat.</p>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Design the backend for an agent that takes 20 minutes" is a systems question wearing an AI costume: job records, checkpoint/resume, idempotent steps, signed webhooks, cancellation, per-tenant fairness, token-budget TTLs. Interviewers listen for the LLM-specific twists — no honest percentages (report stages), visibility timeout vs generation length, and resumability as cost control, not just reliability.</div>'
    },
    {
      id: 'multi-tenancy',
      title: 'Multi-tenancy: noisy neighbors, cost attribution, and data isolation',
      blurb: 'Fair-share rate limits, per-tenant economics, and why RAG isolation failures are breaches.',
      html: '<h2>One pool, many tenants, three problems</h2>' +
        '<p>B2B AI products share three expensive pools across tenants: provider rate limits, your serving capacity, and your retrieval infrastructure. Sharing is the business model; unmanaged sharing is the incident generator. The three recurring problems: <b>noisy neighbors</b> (one tenant\'s burst starves everyone), <b>unattributed cost</b> (you cannot price or defend plans without per-tenant economics), and <b>data isolation</b> (the one where failure means a breach disclosure, not an apology email).</p>' +
        '<h2>Noisy neighbors on rate limits</h2>' +
        '<p>Your provider gives you an org-wide budget — say 500k tokens/minute as a representative early-2026 tier. That budget is a commons: tenant A\'s bulk ingestion can consume it entirely, and tenant B\'s single chat request eats a 429 — B churns over an incident A caused and you architected. The defenses:</p>' +
        '<ul>' +
        '<li><b>Fair-share admission at your gateway:</b> per-tenant concurrency caps and token-rate allocations (weighted by plan tier) enforced <em>before</em> requests hit the provider. Fixed reservations waste capacity; weighted fair queuing borrows idle share and reclaims it under contention.</li>' +
        '<li><b>Two queues, minimum:</b> interactive traffic (chat — latency-sensitive) never waits behind batch traffic (ingestion, backfills — throughput-sensitive). Batch drains at low priority into leftover capacity, or onto the provider\'s batch API where it belongs (module 18).</li>' +
        '<li><b>Degrade unfairly on purpose:</b> under provider-side capacity incidents, shed load by policy — free tiers to cached/degraded modes first, enterprise SLAs last. Write the policy down <em>before</em> the incident; discovering your shedding order live, with your biggest customer in the shed group, is a resume-generating event.</li>' +
        '</ul>' +
        '<h2>Per-tenant cost attribution</h2>' +
        '<p>Flat-priced plans meet power-law usage: the P99 tenant routinely costs 50–100× the median, and without metering you learn this from the invoice, not the dashboard. Tag every LLM call, embedding call, and retrieval query with tenant id at the gateway (the same metering built for budgets in lesson 4), and roll up per-tenant: tokens by model tier, $/month, margin against plan price. What it unlocks: pricing decisions backed by a cost distribution instead of an average; fair-use enforcement with evidence; sales conversations ("your usage is 40× plan median — here is the enterprise tier") that turn losses into upsells; and anomaly detection per tenant (a tenant whose $/request doubles overnight has a bug, a new integration, or an abuser — all worth knowing today). Teams that skip this run blind subsidy programs for their heaviest tenants and call it a pricing strategy.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> One gateway-level metering system serves four masters: abuse budgets (lesson 4), cost attribution and unit economics (module 18), noisy-neighbor fairness, and incident forensics. It is the highest-leverage single component in a multi-tenant AI stack — build it before the second tenant, not after the first pricing crisis.</div>' +
        '<h2>Data isolation in RAG: where leaks actually happen</h2>' +
        '<p>Multi-tenant RAG is where isolation failures stop being theoretical. The failure surfaces, ranked by observed frequency:</p>' +
        '<ol>' +
        '<li><b>Filter-based isolation bugs:</b> one shared vector index with a <code>tenant_id</code> metadata filter is the common, economical design — and one code path that forgets the filter (a new endpoint, an admin tool, a background summarizer) is a cross-tenant leak. If you use shared indexes, the filter must be non-optional at the retrieval-client layer (a wrapper that <em>cannot</em> be called without a tenant context — make the leak unrepresentable, not discouraged), plus a canary test that plants a marked document per tenant and continuously queries for it from other tenants.</li>' +
        '<li><b>Caches keyed without tenant:</b> semantic caches (module 18), rendered-answer caches, embedding caches — any cache whose key omits tenant id serves tenant A\'s answer, containing tenant A\'s data, to tenant B. Same rule as retrieval: tenant id in every key, mechanically.</li>' +
        '<li><b>The context window as a leak channel:</b> whatever enters the prompt can exit in an answer. Cross-tenant "global" examples, shared few-shots harvested from real conversations, or a support-team debugging prompt that pastes another customer\'s ticket — all reproducible verbatim by a curious user. Prompt-assembly code needs tenant-scoping review like query code does.</li>' +
        '<li><b>Logs and traces:</b> full-payload logging is your debugging substrate (lesson 3) and also a tenant-data store — scope access, redact, and set retention per your DPAs.</li>' +
        '</ol>' +
        '<p>Physical isolation (index-per-tenant, or database-per-tenant) removes the filter-bug class entirely at the cost of operational sprawl (thousands of indexes, migration fan-out, cold-start cost per tenant). The pragmatic pattern as of early 2026: shared-with-mandatory-filters for the long tail of small tenants, physical isolation as an enterprise-tier feature — which customers in regulated industries will ask about in the security questionnaire anyway, usually on page two.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A CS-tooling company added an "AI weekly digest" background job — a new code path that queried the shared index by date, without the tenant filter that every interactive path dutifully applied. For six weeks, digests occasionally summarized other companies\' tickets; a customer noticed a competitor\'s name. Disclosure, churn, a security review of every retrieval call site. The postmortem\'s lasting fix was structural: retrieval moved behind a client that takes tenant identity in its constructor — untenanted queries became a compile error. Policies decay; type systems do not.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Design multi-tenant RAG" is a staple. Cover the isolation decision (shared+mandatory filter vs physical, and who gets which tier), the make-it-unrepresentable retrieval client, tenant-keyed caches, cross-tenant canary tests, noisy-neighbor fair-share at the gateway, and per-tenant metering. The gotcha they are fishing for: the background job or cache that skips the filter — name it before they do.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your LLM provider starts returning elevated 429s and 8× normal TTFT. Your service retries each failure up to 5 times immediately, and the whole fleet does the same. What have you built, and what is the missing component?',
      options: [
        'Proper resilience — retries are the standard remedy for 429s',
        'A synchronized retry storm that amplifies load against a degraded dependency (and your bill); the fix is per-provider circuit breakers plus exponential backoff with jitter, honoring Retry-After',
        'A latency problem solvable by raising timeouts',
        'A provider defect; open a support ticket and wait'
      ],
      answer: [1],
      explanation: 'Immediate uniform retries from a whole fleet multiply traffic exactly when the dependency is least able to serve it — a self-inflicted DDoS billed by the token. Circuit breakers convert repeated failure into fast local failure (and trigger failover/degradation), while jittered backoff desynchronizes the fleet. (A) — retries without backoff/jitter/breakers are the anti-pattern, not the standard. (C) — longer timeouts hold connections open against a degraded provider, worsening worker exhaustion. (D) abdicates the half of the incident that is your architecture.'
    },
    {
      text: 'You configured provider-B failover a quarter ago and it has never fired. Provider A just went down; B is now serving — and your JSON parser is failing on B\'s differently-formatted tool calls. Which practice prevents this failure class?',
      options: [
        'Only fail over manually after an engineer verifies provider B\'s output format',
        'Keep the fallback path permanently warm: run 1–5% of live traffic (or nightly evals) through provider B so format and quality drift surface as alerts, not mid-incident surprises',
        'Standardize on one provider — multi-provider failover is inherently unworkable',
        'Add a JSON repair step and consider the problem solved'
      ],
      answer: [1],
      explanation: 'Failover paths rot like DR runbooks: four months of prompt changes were never tested against B. Continuous trickle traffic (or scheduled evals) makes the fallback a maintained, monitored path. (A) inserts a human bottleneck into an availability mechanism — outages happen at 2 a.m. (C) surrenders the availability goal because of a maintenance gap. (D) patches this one symptom; the next drift (refusal behavior, tone, tool-call rates) will not be JSON-shaped.'
    },
    {
      text: 'For an interactive feature, which timeout ladder reflects LLM-appropriate design?',
      options: [
        'One flat 60 s timeout on the whole request — simple and safe',
        'Connect 1–2 s; time-to-first-token 5–10 s (abandon and fail over if streaming has not started); generous total deadline per feature; optional hedged second request when TTFT exceeds ~P90',
        'No timeouts — LLM latency is long-tailed, so any timeout kills legitimate requests',
        '500 ms everywhere, because users deserve speed'
      ],
      answer: [1],
      explanation: 'The ladder exploits the different information in each phase: connection failure is a fast reliable signal; missing first token indicates queuing behind an incident (fail over early); total deadline protects workers without killing legitimate long generations; hedging buys tail latency for a few percent extra tokens on idempotent calls. (A) lets a hung call pin a worker for a minute and gives no early failover signal. (C) confuses accommodating the tail with being hostage to it. (D) would time out nearly every LLM generation ever made.'
    },
    {
      text: 'A new model version beats the old one by 4 points on your eval suite. The team wants to skip canarying ("evals passed"). Immediately after a 100% rollout, a downstream regex breaks on the new model\'s currency formatting. What is the accurate post-mortem framing?',
      options: [
        'The eval suite was bad and should have covered the regex',
        'Evals test the failure modes you thought of; production contains dependencies nobody remembers. Canaries with format-validity and downstream-error metrics exist to catch these unknown-unknowns at 5% blast radius instead of 100%',
        'Model upgrades should be avoided since behavior always changes',
        'The regex was bad code; fixing it closes the incident'
      ],
      answer: [1],
      explanation: 'The eval suite could not have covered a regex nobody knew existed — that is precisely why staged exposure with behavioral canary metrics complements offline evals rather than duplicating them. (A) demands omniscience from a sample; eval sets are always incomplete. (C) freezes you on deprecating snapshots and forfeits improvements — the process, not the upgrade, was the failure. (D) fixes one symptom while keeping the ship-at-100%-on-green-evals process that will produce the next incident.'
    },
    {
      text: 'You want maximum information about a new prompt\'s behavior on real traffic with zero user exposure. Which rollout stage provides this, and what is its inherent blind spot?',
      options: [
        'A 1% canary — minimal exposure is effectively zero',
        'Shadow traffic: run the candidate alongside production on sampled requests while users see only the incumbent; blind spot — no user-behavior signal (clicks, regenerations, satisfaction), since nobody sees candidate outputs',
        'Offline evals on the golden set — they cover the real distribution already',
        'Staging environment testing with synthetic traffic'
      ],
      answer: [1],
      explanation: 'Shadow mode sees the true production distribution at zero user risk (cost: 2× inference on the sample), catching format breaks, refusal shifts, latency and cost changes before any exposure — but reactions to unseen outputs cannot be measured, which is why percentage canaries follow. (A) is small but real exposure — 1% of users get the new behavior. (C) golden sets are samples, definitionally not the live distribution. (D) synthetic traffic has synthetic blind spots — the value of shadow is precisely the real requests.'
    },
    {
      text: 'Your auto-rollback fires when the canary\'s refusal rate exceeds an absolute 3%. It keeps triggering falsely during a weekly traffic pattern where sensitive-topic questions spike for all arms. What is the fix?',
      options: [
        'Raise the absolute threshold to 6%',
        'Define guardrail thresholds relative to the concurrent control arm (e.g. canary refusal &gt; control + 2σ with a minimum sample size), so shared traffic shifts cancel out',
        'Disable auto-rollback during weekends',
        'Remove refusal rate from the guardrail metrics'
      ],
      answer: [1],
      explanation: 'The refusal spike is a property of the traffic, not the candidate — both arms move together, so control-relative thresholds cancel the confound while still catching genuine candidate-caused shifts; the minimum sample size guards against noise-triggered reverts. (A) trades false positives for missed real regressions and still breaks on the next traffic shift. (C) hard-codes one known pattern and leaves every unknown one. (D) deletes a metric that catches real model-change regressions — the metric was right, the baseline was wrong.'
    },
    {
      text: 'Compliance asks you to reproduce exactly what your assistant told a customer 6 weeks ago. Your prompt is in git, but you used a floating model alias, tool descriptions changed twice, and the KB index has been re-embedded. What is the honest status, and the structural fix?',
      options: [
        'Reproducible — the prompt is the behavior, and it is versioned',
        'Not reproducible — behavior is the tuple (prompt, pinned model snapshot, params, tool versions, index snapshot), three of which are unrecoverable; the fix is a versioned generation config logged per request, on pinned model snapshots',
        'Reproducible if you set temperature to 0 during the replay',
        'Not a real requirement — LLMs are nondeterministic, so no one can reproduce past behavior'
      ],
      answer: [1],
      explanation: 'The prompt is one of at least five behavior-determining dimensions; with a floating alias you cannot even name the model that served the request. Config-as-code with per-request version logging makes replay a checkout. (A) is the exact mistake — prompt v41 on two different snapshots is two different behaviors. (C) temperature-0 replay of the wrong tuple deterministically reproduces the wrong behavior. (D) confuses sampling variance with config reproducibility; regulated reviews ask for the config and a faithful replay distribution, and logging provisions increasingly require it.'
    },
    {
      text: 'Why do production teams pin model snapshots instead of using the provider\'s floating "latest" alias, given that latest is usually better?',
      options: [
        'Pinned snapshots are cheaper per token',
        'A floating alias makes vendor deploys your unreviewed behavior changes — format, refusal, and tone shifts arrive with zero diff on your side; pinning converts upgrades into planned migrations through eval, shadow, and canary',
        'Floating aliases have higher latency due to routing overhead',
        'Pinning is required by all provider terms of service'
      ],
      answer: [1],
      explanation: 'The issue is change control, not quality: "better on average" can still break your regex, shift your refusal rate, or change output language for your traffic — and with an alias, the change ships on the vendor\'s calendar, unreviewed, untested, and un-diffable. Pins put migrations on your calendar (mind published deprecation windows, typically 6–12 months). (A) pricing does not work that way. (C) invents a mechanism. (D) — it is your discipline, not their requirement.'
    },
    {
      text: 'Analysis of your $29/month "unlimited" AI writing product finds 40 accounts driving 38% of token spend: 24/7 flat usage, max-length prompts every call, zero UI telemetry. What are they, and which TWO responses fit best?',
      options: [
        'Power users to be celebrated — increase their limits',
        'Likely resellers scripting your product as a bulk LLM API; introduce per-account token budgets with published fair-use thresholds and tiered enforcement (warn → degrade to a cheaper model → stop)',
        'Add traffic-shape defenses: challenge or deprioritize bot-shaped sessions (no think-time, no UI events, max-length inputs)',
        'Ban the accounts and consider the problem solved permanently',
        'Raise everyone\'s subscription price to cover the losses'
      ],
      answer: [1, 2],
      multi: true,
      explanation: 'The signature (machines don\'t sleep, humans don\'t send max-length prompts every message, real clients emit UI events) is API resale through your product. Token budgets cap the arbitrage value per account; shape-based challenges catch replacement accounts — together they make abuse uneconomical, which is the actual goal. (A) misreads extraction as engagement. (D) removes 40 accounts; the wrappers register 40 more — without structural limits you are playing whack-a-mole. (E) taxes legitimate customers to subsidize abusers, worsening the product\'s competitiveness.'
    },
    {
      text: 'Why are per-tenant token budgets described as blast-radius control rather than just revenue protection?',
      options: [
        'Because budgets increase revenue directly',
        'Because they are the backstop for multiple failure classes: a prompt-injected agent looping on tools, a leaked API key, a runaway retry storm — each burns until something stops it, and the budget is the something',
        'Because providers require customer-level budgets contractually',
        'Because budgets improve model output quality'
      ],
      answer: [1],
      explanation: 'The budget is a generic circuit breaker on spend: whatever the root cause — attack, bug, incident — the damage is capped at the budget, not the credit limit, and the alarm fires hours before the invoice. That is why it belongs at the gateway as a first-class concern shared with cost attribution and fairness. (A) budgets protect margin; they do not create revenue. (C) is not a thing. (D) budgets bound spend, not quality.'
    },
    {
      text: 'Your "analyze contract portfolio" endpoint is synchronous. A customer uploads 400 contracts; the request takes 11 minutes, the load balancer cuts it at 60 s, and the client auto-retries three times. Which THREE design changes address the root causes?',
      options: [
        'Async job pattern: enqueue on upload, return a job id in milliseconds, deliver results via progress feed plus webhook/email on completion',
        'Idempotency keys on submission so retries attach to the existing job instead of spawning duplicates',
        'Per-tenant token budgets and job TTLs so a duplicated or runaway job cannot bill unbounded',
        'Raise the load balancer timeout to 15 minutes',
        'Tell customers to upload at most 10 contracts at a time'
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: 'The incident stacked three absences: work past the sync ceiling (job pattern fixes), retries spawning parallel duplicate work (idempotency keys fix), and nothing bounding the spend (budgets/TTLs fix). (D) treats one symptom while keeping minutes-long connections hostage to mobile churn, tab closes, and worker exhaustion — and 15 minutes still fails on contract #401. (E) makes the product worse to accommodate an architectural gap the customer does not care about.'
    },
    {
      text: 'For a 20-minute agent job, why is checkpointing after each completed step more than a reliability nicety?',
      options: [
        'It makes the progress bar accurate',
        'The probability of some interruption grows with job duration; without resumability every interruption restarts from zero, so expected token cost per completed job grows nastily with length — checkpointing turns interruptions into a resume-from-step-12, bounding both cost and side-effect replay risk',
        'Checkpointing is required by queue brokers',
        'It reduces the model\'s hallucination rate on long tasks'
      ],
      answer: [1],
      explanation: 'Long jobs meet interruptions (deploys, worker deaths, provider blips) with probability rising in duration; restart-from-zero makes the cost curve superlinear and re-executes non-idempotent tool steps — the dangerous part. Checkpoints bound retry cost and pair with an execution ledger to prevent double side effects. (A) — LLM jobs have no honest percentage anyway; report stages. (C) brokers redeliver; they do not checkpoint your application state. (D) unrelated mechanism.'
    },
    {
      text: 'Tenant A starts a bulk ingestion that consumes your entire org-level provider rate limit; tenant B\'s chat requests start eating 429s. Which design prevents this class of incident?',
      options: [
        'Ask the provider for a higher org-level limit',
        'Fair-share admission control at your gateway — per-tenant concurrency and token-rate allocations — plus separate queues so interactive traffic never waits behind batch, with batch draining at low priority or via the provider\'s batch API',
        'Have tenant B retry with exponential backoff',
        'Move tenant A to a different cloud region'
      ],
      answer: [1],
      explanation: 'The org limit is a commons; without gateway-level fairness, any tenant can consume it and externalize the cost to others. Fair-share admission plus interactive/batch queue separation fixes the structure — and bulk ingestion belongs on the batch tier anyway. (A) raises the ceiling; the next bigger ingestion still hits it — no isolation was added. (C) makes the victim absorb the incident politely. (D) provider rate limits are org/account-scoped; regions do not partition them, and you have added latency and ops complexity for nothing.'
    },
    {
      text: 'A background "weekly digest" job queries your shared multi-tenant vector index by date and skips the tenant_id filter that all interactive paths apply. What is the correct structural fix after the leak is contained?',
      options: [
        'Add the missing filter to the digest job and close the incident',
        'Move retrieval behind a client that requires tenant identity at construction so untenanted queries are unrepresentable, and add continuous cross-tenant canary probes (planted marker docs queried from other tenants)',
        'Re-embed all documents with per-tenant encryption keys',
        'Delete the digest feature'
      ],
      answer: [1],
      explanation: 'The root cause is that the filter was optional — policy, not structure. A tenant-scoped client makes the whole bug class a compile error for every future code path, and canary probes verify isolation continuously instead of assuming it. (A) fixes one call site; the next new endpoint or admin tool reintroduces the class. (C) — encrypted vectors break similarity search as typically deployed and do not address the query-path bug. (D) removes one instance of a class the next feature will recreate.'
    },
    {
      text: 'Your semantic cache is shared across tenants to maximize hit rate. Why is this a data-isolation incident waiting to happen, even with perfect similarity thresholds?',
      options: [
        'It is not — cached answers are generic by nature',
        'Cached responses can embed tenant-specific data from the originating context (retrieved docs, account details); a cross-tenant hit then serves tenant A\'s data to tenant B verbatim. Tenant id belongs in every cache key, accepting the hit-rate cost',
        'Shared caches are fine if TTLs are under one hour',
        'The risk only exists if tenants share an embedding model'
      ],
      answer: [1],
      explanation: 'The cache stores generated answers, and answers are functions of tenant-scoped context — RAG chunks, entitlements, account facts. Similarity thresholds measure query closeness and know nothing about whose data produced the stored response, so no threshold prevents the leak. (A) assumes answers contain no context-derived content, false for any RAG or personalized feature. (C) shortens the exposure window; a one-minute leak is still a breach. (D) embedding-model sharing is irrelevant — the leaked payload is the cached response text itself.'
    }
  ],
  flashcards: [
    { id: 'fc-ai-down', front: 'The "AI down ≠ product down" principle?', back: 'The LLM provider is a third-party dependency that WILL fail; per feature, design what users see when it does. Ladder: <b>retry → failover → degrade capability → degrade honestly to non-AI</b> (search box, human queue, banner).' },
    { id: 'fc-failover-eval', front: 'What makes a failover provider a real fallback rather than a different product?', back: 'Prompts, tool schemas, and <b>evals already passing</b> on it — kept honest by permanent 1–5% trickle traffic or nightly eval runs, because failover paths rot like DR runbooks.' },
    { id: 'fc-timeout-ladder', front: 'The LLM timeout ladder?', back: '<b>Connect</b> 1–2 s (fail over fast) · <b>TTFT</b> 5–10 s interactive (no first token = queued behind an incident) · <b>total deadline</b> per feature (30–120 s) · optional <b>hedged request</b> at ~P90 TTFT for idempotent calls.' },
    { id: 'fc-circuit-breaker', front: 'Why circuit breakers per provider?', back: 'Without them, an incident triggers synchronized fleet-wide retries — a retry storm you pay for by the token. Open after N failures, half-open probes, close on success; pair with jittered exponential backoff honoring Retry-After.' },
    { id: 'fc-prompt-deploy', front: 'Why treat a prompt edit like a code deploy?', back: 'One line changes behavior on 100% of traffic instantly. Same pipeline as code: <b>eval gate → shadow → sticky percentage canary → auto-rollback</b> on pre-registered, control-relative thresholds.' },
    { id: 'fc-shadow', front: 'Shadow traffic — value and blind spot?', back: 'Candidate runs beside production on real requests; users see only the incumbent. Highest-information zero-risk stage (real distribution!). Blind spot: no user-behavior signal — you cannot shadow a click. Cost: 2× inference on the sample.' },
    { id: 'fc-canary-metrics', front: 'LLM-specific canary metrics beyond errors/latency?', back: '<b>Format validity</b> (JSON/schema pass rate) · <b>refusal rate</b> · <b>output length & $/request</b> · <b>online judge scores</b> on sampled outputs · user behavior (regen rate, thumbs, escalations). Thresholds relative to control, not absolute.' },
    { id: 'fc-evals-vs-canary', front: 'Evals vs canaries — the division of labor?', back: 'Evals test the failure modes you thought of (a sample); canaries catch what you forgot existed (the distribution + downstream dependencies like that currency regex). Both, always — passing evals justifies a canary, not a 100% rollout.' },
    { id: 'fc-gen-config', front: 'What is the correct unit of versioning for LLM behavior?', back: 'The <b>generation config tuple</b>: pinned model snapshot + prompt (content-hashed) + params + tool versions + retrieval index snapshot + guardrail versions. One git-versioned unit, deployed, canaried, rolled back, and logged per request as a whole.' },
    { id: 'fc-pin-models', front: 'Floating model alias vs pinned snapshot in production?', back: '<b>Pin.</b> A floating alias makes vendor deploys your unreviewed behavior changes. Pins turn upgrades into planned migrations (eval → shadow → canary) on your calendar; watch published deprecation windows (~6–12 months).' },
    { id: 'fc-reproduce', front: 'The "reproduce yesterday\'s answer" workflow?', back: 'Request log → config version it ran under → replay under the archived tuple (pinned model, prompt hash, tools, index snapshot) → diff vs today → root-cause the changed dimension. If the answer starts "check what the prompt probably was," you failed the audit.' },
    { id: 'fc-resale', front: 'The canonical free-tier abuse pattern for AI products?', back: '<b>Resale of your API through your product:</b> scripted clients drive your chat endpoint as a general LLM API. Signatures: 24/7 flat usage, max-length prompts, zero think-time, no UI telemetry events.' },
    { id: 'fc-token-budgets', front: 'Why budget tokens per user/tenant instead of requests?', back: 'Requests are the wrong unit — one request spans 200 to 200k tokens. Budget what costs money: tokens in+out weighted by model tier, per day/month by plan. Tiered enforcement: warn at 80% → degrade/queue at 100% → stop past abuse threshold.' },
    { id: 'fc-abuse-econ', front: 'The goal of abuse prevention, in economic terms?', back: 'Make extraction <b>uneconomical</b>, not impossible: budgets cap per-bypass value, output caps lower endpoint arbitrage value, account-creation friction and cohort anomaly detection raise the cost of scale, terminate-don\'t-argue stops funding the attacker\'s red team.' },
    { id: 'fc-sync-ceiling', front: 'The sync-vs-async decision rule for LLM work?', back: 'P95 under ~30 s: synchronous + streaming. Past it: enqueue, return a job id immediately, deliver out-of-band (SSE/polling for humans, signed retried webhooks for machines). 30–120 s: judgment — anything users tab away from goes async.' },
    { id: 'fc-job-progress', front: 'How do you report progress on an LLM job with no honest percentage?', back: '<b>Stages and evidence</b>, not percentages: "processed 34/120 docs", "step 4: running tests". An agent\'s live activity feed doubles as the progress UX and the debugging trace. Opaque waits get abandoned; legible ones get tolerated.' },
    { id: 'fc-checkpoint', front: 'Why checkpoint long agent jobs after every step?', back: 'Interruption probability grows with duration; restart-from-zero makes expected cost superlinear and replays non-idempotent side effects. Checkpoints = resume from step 12 + bounded retry cost. Also: visibility timeout &gt; longest LLM call, or jobs double-deliver mid-generation.' },
    { id: 'fc-noisy-neighbor', front: 'Noisy-neighbor defense for shared provider rate limits?', back: '<b>Fair-share admission at your gateway</b> (per-tenant concurrency + token-rate, weighted by tier) enforced before the provider · separate interactive vs batch queues · pre-written load-shedding policy (free tiers degrade first, enterprise SLAs last).' },
    { id: 'fc-rag-isolation', front: 'The four multi-tenant RAG leak surfaces?', back: '1) Shared index with an <b>optional</b> tenant filter (the background job forgets it) 2) caches keyed without tenant 3) cross-tenant content entering prompts (shared few-shots, pasted tickets) 4) full-payload logs. Fix #1 structurally: retrieval client that requires tenant identity — make leaks unrepresentable. Verify continuously: plant a marked canary doc per tenant and query for it from <em>other</em> tenants; any hit pages security.' },
    { id: 'fc-one-meter', front: 'The one metering system and its four jobs?', back: 'Gateway-level tagging of every call (tenant, feature, model, config version) powers: <b>abuse budgets · per-tenant cost attribution/pricing · noisy-neighbor fairness · incident forensics</b>. Highest-leverage component in a multi-tenant AI stack — build it before the second tenant.' }
  ],
  lab: {
    title: 'Build a provider-failover wrapper — then chaos-test it',
    intro: '<p>You will build the gateway seam from lesson 1: a <code>complete()</code> wrapper with a timeout ladder, jittered retries, circuit breaking, and provider failover — then prove it works by injecting failures on purpose. Chaos testing an LLM stack on your laptop is the point: a fallback that has never fired does not exist.</p><p><b>Needs:</b> <code>python3</code>, one real OpenAI-compatible API key; the "flaky provider" is simulated locally so you control the weather. Optionally a second real provider (or local Ollama) as the fallback. Worst case ~$0.20.</p>',
    steps: [
      {
        title: 'Write the failover wrapper',
        html: '<p>Save as <code>gateway.py</code> — a deliberately small version of the production pattern: providers in priority order, per-provider timeouts and retry budgets, a circuit breaker, and a last-resort degraded response.</p>' +
          '<pre><code>import random, time\n\nclass Breaker:\n    def __init__(self, fail_threshold=3, cooldown=10):\n        self.fails, self.threshold, self.cooldown = 0, fail_threshold, cooldown\n        self.opened_at = None\n    def allow(self):\n        if self.opened_at is None: return True\n        if time.time() - self.opened_at &gt; self.cooldown:\n            return True                      # half-open: allow one probe\n        return False\n    def record(self, ok):\n        if ok: self.fails, self.opened_at = 0, None\n        else:\n            self.fails += 1\n            if self.fails &gt;= self.threshold: self.opened_at = time.time()\n\nclass Gateway:\n    def __init__(self, providers):\n        self.providers = providers           # [(name, fn, timeout_s)]\n        self.breakers = {name: Breaker() for name, _, _ in providers}\n        self.log = []\n    def complete(self, prompt, retries=2):\n        for name, fn, timeout in self.providers:\n            br = self.breakers[name]\n            if not br.allow():\n                self.log.append((name, \'circuit-open\')); continue\n            for attempt in range(retries + 1):\n                try:\n                    t0 = time.time()\n                    out = fn(prompt, timeout)\n                    br.record(True)\n                    self.log.append((name, \'ok %.2fs\' % (time.time() - t0)))\n                    return {\'text\': out, \'provider\': name, \'degraded\': False}\n                except Exception as e:\n                    br.record(False)\n                    self.log.append((name, \'fail: %s\' % e))\n                    time.sleep(min(2 ** attempt * 0.2 + random.random() * 0.2, 2))\n        return {\'text\': \'AI temporarily unavailable — here is a search link instead.\',\n                \'provider\': None, \'degraded\': True}   # AI down != product down\n</code></pre>' +
          '<p>Read the shape before moving on: retries live <em>inside</em> a provider, failover moves <em>between</em> providers, the breaker short-circuits known-bad ones without waiting out timeouts, and the function never raises — the worst case is a designed degraded answer, not an exception in your product code.</p>'
      },
      {
        title: 'Wire a real provider and a chaos provider',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport random, time\nfrom openai import OpenAI\nfrom gateway import Gateway\nclient = OpenAI()   # set OPENAI_API_KEY\n\nCHAOS = {\'fail_rate\': 0.0, \'hang\': False}\n\ndef flaky(prompt, timeout):        # stands in for "provider A during an incident"\n    if CHAOS[\'hang\']:\n        time.sleep(timeout + 1); raise TimeoutError(\'TTFT timeout %ss\' % timeout)\n    if random.random() &lt; CHAOS[\'fail_rate\']:\n        raise ConnectionError(\'429 rate limited\')\n    r = client.chat.completions.create(model=\'gpt-4o-mini\', timeout=timeout,\n        messages=[{\'role\': \'user\', \'content\': prompt}], max_tokens=60)\n    return r.choices[0].message.content\n\ndef backup(prompt, timeout):       # second provider: another vendor, or Ollama, or\n    r = client.chat.completions.create(model=\'gpt-4o-mini\', timeout=timeout,   # same model, separate key/region in real life\n        messages=[{\'role\': \'user\', \'content\': \'[backup] \' + prompt}], max_tokens=60)\n    return r.choices[0].message.content\n\ngw = Gateway([(\'primary\', flaky, 8), (\'backup\', backup, 8)])\n\nprint(\'--- healthy\')\nprint(gw.complete(\'Say OK and nothing else.\'))\nEOF</code></pre>' +
          '<p>If you have a second real provider (or <code>ollama run llama3.2</code> with a second client at base_url http://localhost:11434/v1), use it for <code>backup</code> — you will immediately notice the format drift the lesson warned about: different tone, different markdown habits. That observation IS the "keep the fallback path warm" argument, live on your screen.</p>'
      },
      {
        title: 'Inject failures and watch each defense fire',
        html: '<p>Extend the script (same session) with three chaos scenarios:</p>' +
          '<pre><code># scenario 1: primary starts throwing 429s on most calls\nCHAOS[\'fail_rate\'] = 0.9\nfor i in range(5):\n    r = gw.complete(\'Reply with the number %d only.\' % i)\n    print(i, \'via\', r[\'provider\'], \'degraded:\', r[\'degraded\'])\n\n# scenario 2: primary hangs — the TTFT-style timeout must cut it\nCHAOS[\'fail_rate\'] = 0.0; CHAOS[\'hang\'] = True\nt0 = __import__(\'time\').time()\nr = gw.complete(\'Say OK.\')\nprint(\'hung primary handled in %.1fs via %s\' % (__import__(\'time\').time() - t0, r[\'provider\']))\n\n# scenario 3: total outage — every provider down, degraded answer returned\ndef down(prompt, timeout): raise ConnectionError(\'503\')\ngw2 = __import__(\'gateway\').Gateway([(\'primary\', down, 2), (\'backup\', down, 2)])\nfor i in range(4):\n    r = gw2.complete(\'anything\')\nprint(\'total outage →\', r[\'text\'], \'| degraded:\', r[\'degraded\'])\nprint(\'breaker log tail:\', gw2.log[-6:])</code></pre>' +
          '<p>Verify against the log: scenario 1 should show retries then failover with <code>backup</code> serving; scenario 2 should complete in roughly the timeout budget, not hang forever — if it takes 9+ seconds, your ladder works; if it takes 60, find the missing timeout. Scenario 3 should show the circuit going <code>circuit-open</code> on later calls (no more waiting out timeouts on a known-dead provider) and the degraded response returned without any exception. Then the graduation exercise: re-run scenario 1 and count how many <em>total</em> requests hit the primary across all 5 calls — that number × your fleet size is the retry-storm multiplier the breaker exists to contain. Tune <code>fail_threshold</code> and <code>cooldown</code> and watch the multiplier change.</p>'
      }
    ],
    costNote: 'Worst case ~$0.20 on gpt-4o-mini-class pricing (the chaos scenarios mostly fail before spending tokens; the healthy calls are pennies). Using Ollama for the backup provider cuts it further. Cleanup: delete <code>gateway.py</code> and the test script; no persistent resources, keys, or jobs are created. If you set a low spend cap on the test API key before starting — good instinct, that is lesson 4 — remember to reset it.'
  }
});
