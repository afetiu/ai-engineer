COURSE.register({
  id: 'm21-frontier',
  track: 'advanced',
  order: 21,
  title: 'The frontier',
  short: 'The frontier',
  tagline: 'Reasoning models, agent swarms, on-device inference — and how to tell the durable principles from the churn that will be stale in a year.',
  minutes: 120,
  lessons: [
    {
      id: 'reasoning-models',
      title: 'Reasoning models and test-time compute',
      blurb: 'RL on verifiable rewards, thinking tokens as a third scaling axis, and what the knob actually controls.',
      html: '<h2>The third scaling axis</h2>' +
        '<p>Module 1 established that per-token compute is fixed and chain-of-thought works because emitted tokens are external working memory. Reasoning models industrialize that observation. Instead of hoping a prompt elicits useful intermediate steps, the model is <em>trained</em> — with reinforcement learning — to produce a long private deliberation ("thinking" tokens) before its visible answer. The result is a third axis for buying capability, alongside pretraining compute and data: <b>test-time compute</b>. Same weights, more thinking tokens, better answers on a specific class of problems.</p>' +
        '<p>The training recipe that made this work is <b>RL on verifiable rewards (RLVR)</b>. Take problems where correctness is checkable by a program — math with known answers, code against unit tests, formal logic — sample many long solution attempts, reward the ones that verify, and update. No human raters in the loop for the core signal, which is exactly why it scaled: verification is cheap and incorruptible where human preference is expensive and gameable. The models that popularized the pattern (OpenAI\'s o-series from late 2024, DeepSeek-R1\'s openly published recipe in early 2025, Anthropic\'s extended thinking, Gemini\'s thinking variants — as of early 2026 every major vendor ships a reasoning tier) all lean on some version of this loop.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> The learned behaviors are visible in thinking traces: decomposition, self-checking ("wait, that\'s wrong — let me redo this"), backtracking, trying alternative approaches. Nothing architectural changed — it is still next-token prediction over a transformer. What changed is that RL made "emit a long, self-correcting scratchpad" a high-probability behavior, because scratchpads that verified got rewarded. Backtracking text patterns emerge because they were instrumentally useful during training, not because a planner module was bolted on.</div>' +
        '<h2>What the API actually gives you</h2>' +
        '<p>Operationally, a reasoning tier means: you send a normal request, the model emits thinking tokens (hidden, summarized, or fully visible depending on vendor), then the answer. Three properties dominate the engineering:</p>' +
        '<ul>' +
        '<li><b>You pay for thinking as output tokens.</b> Output is the expensive direction (3–5× input), and reasoning models routinely emit 2,000–50,000 thinking tokens for a hard problem. A task that cost $0.01 on a standard tier can cost $0.20–1.00 with heavy thinking — a 20–100× multiplier on output spend.</li>' +
        '<li><b>Thinking budgets are a knob.</b> Most vendors expose effort/budget controls (low/medium/high, or an explicit max-thinking-tokens number, as of early 2026). Accuracy typically rises steeply with the first chunk of thinking budget then flattens — measure the curve on <em>your</em> task; the flat region is pure waste.</li>' +
        '<li><b>Latency moves from seconds to potentially minutes.</b> Thinking happens before the first visible answer token, so time-to-first-answer-token balloons. Interactive UX needs streamed progress, thinking summaries, or a different tier entirely.</li>' +
        '</ul>' +
        '<h2>Where the gains are real — and where they aren\'t</h2>' +
        '<p>The gains concentrate exactly where the training signal lived: <b>verifiable, multi-step problems</b>. Competition math, algorithmic coding, debugging with a failing test, logic puzzles, constraint satisfaction, careful schema transformations. The benchmark jumps were dramatic (roughly: low-single-digit percent on the hardest math benchmarks pre-reasoning to strong majorities post — as of early 2026, frontier reasoning models saturate many former "impossible" sets).</p>' +
        '<p>Where gains are weak or negative: recall-bound questions (thinking cannot conjure facts that aren\'t in the weights or context — it can talk itself <em>out</em> of a correct first instinct), style and creative writing (deliberation adds little and sometimes flattens voice), simple classification/extraction (you pay 50× for the same answer), and anything latency-critical. A useful mental model: <b>reasoning buys serial computation, not knowledge</b>. If the failure mode of your task is "didn\'t know," retrieval fixes it; if it is "knew the pieces but combined them wrong," reasoning fixes it.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team switched their extraction pipeline to a reasoning tier "for quality," saw a 30× cost increase and a p95 latency of 90 seconds, and measured a quality gain of 0.4 points — within eval noise. The failure mode of their task was ambiguous source documents, not multi-step inference; no amount of thinking disambiguates a blurry scan. Post-mortem conclusion, now taped to the wall: <em>name the failure mode before buying compute for it.</em></div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Thinking traces are not faithful explanations. The visible reasoning is still sampled text — models sometimes reach correct answers via traces containing wrong steps, and vice versa (documented repeatedly since 2024, still true as of early 2026). Treat traces as a debugging <em>signal</em>, never as an audit log — and remember module 1: self-reports of internal state are generated, not introspected.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Expect "when would you use a reasoning model?" The strong answer names the mechanism (RL on verifiable rewards → gains on verifiable multi-step tasks), the costs (thinking billed as output; latency to first token), and the discipline (measure the accuracy-vs-thinking-budget curve on your own eval). The weak answer is "when the problem is hard."</div>'
    },
    {
      id: 'reasoning-economics',
      title: 'When reasoning tiers pay — and when they burn money',
      blurb: 'A routing decision, not a fashion statement: task taxonomy, budget curves, and the latency bill.',
      html: '<h2>The decision is economic, not aesthetic</h2>' +
        '<p>By early 2026 every serious provider sells at least three rungs: small, standard/frontier, and reasoning (often the same frontier weights with thinking enabled). The design question from module 20 applies unchanged: <b>cheapest tier that clears the quality bar, with routing for the exceptions</b>. What is new is the size of the mistake you can make. Picking mid vs frontier is a 5–10× cost decision; enabling heavy thinking is potentially a further 10–50× on output tokens. Getting routing wrong at the reasoning rung is the most expensive prompt-era mistake available.</p>' +
        '<p>Work the math on a concrete task. Suppose classification-with-rationale: 2k input, 300 output on a standard tier at $3/$15 per Mtok → <b>$0.0105 per call</b>. Same task on the reasoning tier with a moderate 8k-token thinking budget: 2k in, 8.3k out → <b>$0.131 per call</b> — 12.5×. At 100k calls/month that is $1,050 vs $13,100. The reasoning tier must deliver an accuracy gain worth ~$12k/month <em>on this task</em> to justify itself — sometimes it absolutely does (one prevented bad trade, one caught contract clause), usually it does not.</p>' +
        '<h2>A routing taxonomy that survives model churn</h2>' +
        '<table><tr><th>Task shape</th><th>Failure mode</th><th>Right buy</th></tr>' +
        '<tr><td>Recall/lookup ("what is our refund policy")</td><td>Missing knowledge</td><td>Retrieval + small/mid tier; thinking adds ~nothing</td></tr>' +
        '<tr><td>Formatting, extraction, classification</td><td>Sloppiness, edge cases</td><td>Small tier + structured outputs + validation; escalate failures</td></tr>' +
        '<tr><td>Multi-step with checkable answer (code vs tests, math, planning against constraints)</td><td>Combined pieces wrong</td><td>Reasoning tier earns its keep; or standard tier + your own verifier loop</td></tr>' +
        '<tr><td>Open-ended judgment (strategy memo, nuanced review)</td><td>Shallow analysis</td><td>Frontier standard tier, maybe light thinking; gains flatten fast</td></tr>' +
        '<tr><td>Latency-critical interactive (autocomplete, live chat)</td><td>User walks away</td><td>Small/mid tier; reasoning is disqualified by TTFT regardless of quality</td></tr></table>' +
        '<p>Two patterns make routing concrete. <b>Escalation routing:</b> run the standard tier; escalate to reasoning only when a verifier fails (tests don\'t pass, schema invalid, judge flags low confidence) — you pay the multiplier on the 10–20% of traffic that needs it. <b>Budget-curve tuning:</b> for tasks that do route to reasoning, sweep the thinking budget (e.g. 1k/4k/16k/64k) on your eval set and plot accuracy vs cost; nearly every task shows a knee, and running past the knee is a donation to your provider.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why the knee exists: extra thinking helps while the model is still finding and checking a solution path; once found, more tokens are re-verification theater. On some tasks accuracy even <em>dips</em> at extreme budgets — long traces give more chances to talk itself out of a correct answer ("overthinking" is measurable in published evals as of 2025). The curve is task-specific, which is why vendor defaults can\'t be trusted for your workload.</div>' +
        '<h2>The latency bill nobody prices in</h2>' +
        '<p>Cost has a second axis: time. A 16k-token thinking pass at ~80–150 tok/s adds <b>2–4 minutes before the first answer token</b>. Consequences: interactive products need thinking summaries streamed as progress UI (or they feel dead), agent loops that call a reasoning model per step multiply the wait by step count, and timeout/retry policies tuned for 10-second calls will kill and re-bill 3-minute calls (a real and embarrassing double-spend incident pattern: retries on slow-but-healthy reasoning calls burning 2× tokens for zero extra answers). Batch and offline workloads, by contrast, absorb thinking latency for free — which is why reasoning tiers pair beautifully with batch APIs at 50% off.</p>' +
        '<p>Also budget the <b>context interaction</b>: thinking tokens typically don\'t persist between turns (they\'re dropped from history on most APIs as of early 2026), but the answer they produce does. A chatty agent that keeps full reasoning answers in history pays input-token freight on them forever after. Summarize or truncate agent step outputs; keep the conclusions, drop the deliberation.</p>' +
        '<h2>A worked routing decision</h2>' +
        '<p>Code-review assistant, 20k reviews/month. Eval says: standard tier catches 71% of seeded bugs at ~$0.03/review; reasoning tier at a 16k budget catches 84% at ~$0.45/review. Naive comparison: +13 points for 15× cost. Routed design: standard tier on all reviews, reasoning pass only on diffs touching auth, payments, or concurrency-tagged paths (~15% of traffic) → catch rate ~79% overall at ~$0.09 average. Then check value: a shipped auth bug costs days of incident response — so for the sensitive 15%, even $0.45 is obviously cheap, and for README typo diffs even $0.03 is arguably rich. The router encodes exactly that judgment. This is the whole discipline in one paragraph: <b>price the failure, not the tokens.</b></p>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Would you use a reasoning model for X?" wants the routing answer: name the failure mode, propose escalation routing with a verifier, mention the thinking-budget knee and the latency bill. Bonus credit for the retry-double-spend gotcha — it signals you have actually operated one.</div>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Reasoning tiers turned "how smart a model do I need?" into a continuous dial priced in output tokens. The senior skill is not knowing which model is smartest — it is knowing where your task\'s accuracy-vs-compute curve flattens, and refusing to pay for the flat part.</div>'
    },
    {
      id: 'agent-swarms',
      title: 'Agent swarms and parallel inference',
      blurb: 'Best-of-N, verifier bottlenecks, subagent orchestration — and honest math about the cost explosion.',
      html: '<h2>Parallelism is the other way to spend test-time compute</h2>' +
        '<p>Thinking budgets spend compute <em>serially</em> — one long careful attempt. The alternative is spending it in <em>parallel</em>: sample N independent attempts and pick the best. This is <b>best-of-N</b>, and it works exactly as well as your ability to pick. With a <b>programmatic verifier</b> — unit tests, a compiler, a schema check, a simulator — best-of-N is close to free lunch: sampling 10 candidate patches and keeping the one that passes tests reliably beats one careful attempt on many coding tasks, and the failed samples cost only money, not correctness. Without a verifier you are reduced to majority voting (works when errors are uncorrelated — arithmetic, classification) or an LLM judge picking the winner (works partially; the judge shares blind spots with the generators and is itself fallible).</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> The entire value of parallel sampling is concentrated in the selector. N samples with a perfect verifier approaches the model\'s pass@N ceiling; N samples with a mediocre judge approaches... the judge. Before scaling N, invest in verification — it is also exactly what makes RL-on-verifiable-rewards work, which is not a coincidence: <b>generation is cheap, verification is the scarce asset</b> across the whole frontier.</div>' +
        '<h2>Subagent orchestration: parallelism for structure, not just quality</h2>' +
        '<p>The second swarm pattern is decomposition: an orchestrator model splits work across <b>subagents with fresh, focused contexts</b> — module 20\'s research agent fanning sub-questions to parallel workers is the canonical case. The wins are real and mostly about <em>context hygiene</em>, not raw intelligence: each worker gets a small, clean window (no lost-in-the-middle degradation, no O(n²) history costs), workers can use cheap models for cheap subtasks, and wall-clock time drops because the fan-out runs concurrently. As of early 2026 this pattern is productized everywhere: coding agents that spawn explorer/tester/fixer workers, deep-research products fanning out dozens of parallel searches.</p>' +
        '<p>The costs are equally real. <b>Coordination overhead:</b> the orchestrator must specify each subtask in writing — vague task specs produce workers that confidently solve the wrong problem, and the orchestrator can\'t see what they saw, only what they report. <b>No shared memory:</b> two workers independently "fix" the same file, or make contradictory assumptions; results need a merge/reconciliation step. <b>Error amplification:</b> a wrong orchestrator decomposition is faithfully executed N times. Practical guardrails: structured task specs and structured reports (schemas, not prose), read-only workers with a single writer/merger, per-worker step and dollar budgets, and idempotent subtasks so a failed worker can be re-run.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team\'s "swarm" coding agent looked brilliant in demos and then produced a week where 8 parallel workers each independently re-derived the same project setup — 8× the tokens for 1× the exploration — because the orchestrator prompt didn\'t deduplicate the shared preamble work. Fix: a shared read-only briefing document prepared once and injected into every worker (prompt-cached, naturally), plus explicit "do not re-verify the environment" instructions. Swarms fail the way distributed systems fail: duplicated work, split brain, no idempotency. Every lesson from that literature applies.</div>' +
        '<h2>The cost explosion, honestly</h2>' +
        '<p>Do the multiplication before you fall in love. Baseline agent task: 15 steps × ~20k avg input × 800 output on a frontier tier ≈ 300k in / 12k out ≈ <b>$1.08</b> (at $3/$15). Now: best-of-4 on the final patch (+3 generation runs) ≈ +$1.5; a verifier/judge pass ≈ +$0.15; fan out exploration to 5 subagents ≈ +$2–4. The "swarm" version of a $1 task lands at <b>$5–8</b> — a 5–8× multiplier, before retries. At 1,000 tasks/day that is the difference between $30k and $200k+ per month. Sometimes worth it: if the task is "fix the bug blocking the release," an extra $7 is noise. As an always-on default for every ticket: a budget catastrophe. The honest framing — parallelism buys <em>reliability and wall-clock speed</em>, at near-linear token cost; it is a premium you route to, not an architecture you default to.</p>' +
        '<p>Cost controls that keep swarms sane: adaptive N (sample 2, only go to 8 if the verifier rejects both — cuts cost 3–4× vs fixed-N at similar quality), cheap-model workers for exploration with frontier synthesis, prompt-cached shared prefixes across siblings (the briefing doc pattern — cached input at 10–25% of list makes fan-out dramatically cheaper), and a per-task dollar cap that degrades to the single-agent path rather than erroring.</p>' +
        '<h2>Where swarms genuinely win today</h2>' +
        '<p>As of early 2026 the defensible use cases are: <b>coding with tests</b> (verifier = CI; best-of-N on patches is the cleanest win in the field), <b>research/synthesis fan-out</b> (parallel gathering with note-ledger merge), <b>high-stakes one-shots</b> (migration plan, incident RCA — sample 5 analyses, human picks with judge assist), and <b>throughput-bound batch work</b> (parallelism for wall-clock, not quality). The pattern that keeps <em>not</em> working: swarms of agents "discussing" open-ended questions with no verifier — multi-agent debate without ground truth mostly produces consensus around the most confident wrong voice, at N× the price.</p>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Swarm questions probe for the verifier instinct and the cost honesty. Strong: "parallel sampling is only as good as selection; with tests it\'s a clean win, without them it\'s expensive vibes — and here\'s the 5× cost math." Weak: "more agents means more perspectives." If you say the second thing, the interviewer hears "has never paid the bill."</div>'
    },
    {
      id: 'on-device',
      title: 'On-device models and hybrid architectures',
      blurb: 'What 1–4B models on NPUs can actually do, why privacy and latency push work to the edge, and how hybrid routing works.',
      html: '<h2>The hardware finally showed up</h2>' +
        '<p>As of early 2026, the consumer install base ships real inference silicon: phone and laptop NPUs in the ~40–80 TOPS class (Apple\'s Neural Engine line, Qualcomm Hexagon in Snapdragon X-class laptops, Intel/AMD equivalents under the "AI PC" banner), plus perfectly capable GPU/CPU paths via llama.cpp-style runtimes. The practical envelope: a <b>1–4B parameter model, quantized to 4-bit, fits in 1–3 GB of memory and decodes at usable speeds (tens of tokens/s on phones, faster on laptops)</b>. Memory bandwidth, not TOPS, is the binding constraint for decode — the same prefill/decode asymmetry from module 1, now on a device where bandwidth is a tenth of a datacenter GPU\'s.</p>' +
        '<p>What a well-tuned 1–4B model can genuinely do (early 2026, and this line moves up every quarter): summarization of moderate documents, classification and intent routing, short-form drafting (replies, notifications), extraction into simple schemas, autocomplete, grammar/tone rewriting, basic RAG over local files with a small embedding model, and function-calling against a constrained tool set. What it cannot do: long multi-step reasoning, broad factual recall (small weights = aggressive compression = confident interpolation), complex code generation, or anything needing a large context — device memory caps practical windows well below cloud tiers, and long-context KV cache eats the same RAM the weights need.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why 4-bit: weights dominate memory, and 4-bit quantization cuts a 3B model from ~6 GB (fp16) to ~1.7 GB with small, usually-acceptable quality loss (module 15\'s quantization math, at the edge). Distillation is the other half — today\'s 3B models are trained on frontier-model-generated data, which is why they punch far above 2023-era models of the same size. The capability floor rises without any hardware change.</div>' +
        '<h2>Why bother: the three drivers</h2>' +
        '<ul>' +
        '<li><b>Privacy.</b> Data that never leaves the device is data you never have to secure in transit, store, disclose in a breach, or explain to a regulator. For health data, keyboards, photos, on-screen content, and enterprise endpoints with data-residency constraints, "local-only" is not a nice-to-have — it is what makes the feature shippable at all. It is also a clean answer to the vendor-training-data anxiety that stalls enterprise deals.</li>' +
        '<li><b>Latency.</b> No network round trip means no 100–300ms floor and no tail: local first-token latency can sit under 100ms consistently, offline included. For keystroke-level features (autocomplete, live transcription, translation) the cloud can\'t compete on p99 no matter how fast the model.</li>' +
        '<li><b>Cost.</b> Inference on the user\'s silicon is free to you at the margin. A feature invoked 50 times/day per user across 10M users is billions of daily calls — even at small-tier cloud prices that is real money ($0.0002/call × 500M calls/day ≈ $100k/day); on-device it rounds to zero, paid for in engineering effort instead.</li>' +
        '</ul>' +
        '<h2>Hybrid: the architecture that actually ships</h2>' +
        '<p>Almost nobody ships pure-local for a serious product; they ship <b>local-first with cloud escalation</b>. The local model handles the high-frequency, low-difficulty traffic and acts as a router; hard requests escalate to a cloud tier — with consent and visible indication where privacy was the promise. This is module 20\'s tiered routing with the small tier moved onto the device. Design decisions that make or break it:</p>' +
        '<table><tr><th>Decision</th><th>Pragmatic answer (early 2026)</th></tr>' +
        '<tr><td>Escalation trigger</td><td>Local confidence signals + task-type rules (long inputs, tool-heavy, user explicitly asks for depth) — same escalation-routing logic as cloud tiering</td></tr>' +
        '<tr><td>Consistency of behavior</td><td>Shared prompt/format conventions and a shared eval set run against BOTH paths; users forgive a quality gap, not a personality change</td></tr>' +
        '<tr><td>Model updates</td><td>Ship models like app assets (staged rollout, A/B, rollback); a bad local model can\'t be hotfixed server-side, so eval gates matter MORE than in cloud</td></tr>' +
        '<tr><td>Fleet heterogeneity</td><td>Capability detection with graceful degradation: newest NPU gets the 3B, old devices get the 1B or cloud-only — your eval matrix now has a hardware axis</td></tr>' +
        '<tr><td>Privacy accounting</td><td>Explicit data-flow spec: what stays local, what escalates, what the user sees when it does. Auditors and app-store reviews will ask</td></tr></table>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team benchmarked their on-device summarizer on flagship phones and shipped. Support tickets rolled in from mid-range devices: 4-minute summaries and hot phones — thermal throttling cut decode speed 3–5× on sustained loads, something no lab bench with a fan showed. Edge inference has a hardware-distribution axis cloud engineers have never had to think about: your p95 lives on a three-year-old device at 15% battery in a warm pocket.</div>' +
        '<h2>What this means for your designs</h2>' +
        '<p>Treat "on-device" as a fourth model tier with unusual properties: zero marginal cost, excellent p99 latency, hard capability ceiling, painful update cycle, heterogeneous performance. It slots into the same seven-question method: it wins when requirements say privacy-sensitive, latency-critical, high-frequency, and tolerable-quality — and loses when the task needs knowledge breadth or deep reasoning. The strategic bet worth tracking: every year the distilled small-model floor rises, so re-run the "too hard for local" eval annually — decisions made against 2024-era small models are already wrong as of early 2026.</p>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Design an AI keyboard feature" or "summarize notifications privately" is increasingly a hybrid-architecture probe. Strong answers name the three drivers (privacy/latency/cost), the 1–4B-at-4-bit envelope, escalation with consent, and the fleet-heterogeneity eval problem. Weak answers treat on-device as "the cloud, but smaller."</div>'
    },
    {
      id: 'durable-vs-churn',
      title: 'Durable principles vs churn',
      blurb: 'An explicit inventory: what you learned in this course that survives, and what will be stale within a year.',
      html: '<h2>Two shelves in your head</h2>' +
        '<p>This course has fed you two very different kinds of knowledge, and filing them on the same shelf is a career mistake. One shelf holds <b>durable principles</b> — things true because of economics, architecture, or statistics, which have held since 2022–2023 and will very likely hold in 2028. The other holds <b>situational facts</b> — model names, price points, context-window sizes, benchmark rankings — with a half-life of months. Everything on the second shelf in this course was date-stamped "as of early 2026" precisely so you would treat it as perishable inventory, not truth. The skill is not memorizing the inventory; it is knowing which shelf a new claim belongs on the moment you hear it.</p>' +
        '<h2>The durable shelf</h2>' +
        '<ul>' +
        '<li><b>Token economics.</b> Attention makes context expensive; output costs more than input (decode is memory-bandwidth-bound); history resend makes naive conversations quadratic; caching, summarization, and routing exist because of these physics. Prices fall constantly (roughly 10× per year for constant capability through 2023–2025), but the <em>relative structure</em> — output &gt; input, long context costs more, small models are cheaper than big ones — persists, and every cost design in module 20 was built on the structure, not the prices.</li>' +
        '<li><b>Context as a budget.</b> Whatever the advertised window (128k today, more tomorrow), attention is finite, retrieval quality degrades with stuffing, latency and cost grow with tokens, and context assembly — deciding what deserves the window — remains the core applied skill. Bigger windows moved the ceiling, never repealed the budget.</li>' +
        '<li><b>Eval discipline.</b> Models are probabilistic dependencies that change under you; the only defensible truth about your system is your own eval on your own distribution. This was true with GPT-3.5 and is true with every reasoning tier since. Golden sets, regression gates on model swaps, LLM-judges with human audit — the practice outlives every model it evaluates.</li>' +
        '<li><b>The security model.</b> Instructions and data share one token stream; anything the model reads can influence it; therefore untrusted input + capable tools + secrets is a standing hazard, and containment (least-privilege tools, confirmation gates, output verification) beats prompt-level pleading. No architecture shipped through early 2026 has repealed this — treat claims of "injection-proof" models as claims that the sun rises in the west.</li>' +
        '<li><b>Verification as the scarce asset.</b> Generation gets cheaper every quarter; knowing whether a generation is <em>right</em> does not. Verifiable rewards trained the reasoning models; verifiers power best-of-N; validation rules power the doc pipeline; evals power everything. Systems and careers built on verification compound.</li>' +
        '<li><b>Stage attribution and failure taxonomy.</b> Knowledge from pretraining, format from SFT, behavior from preference tuning; hallucination as objective-working-as-designed; retrieval for missing knowledge, reasoning for miscombination. These causal models keep predicting the behavior of each new release.</li>' +
        '</ul>' +
        '<h2>The churn shelf</h2>' +
        '<ul>' +
        '<li><b>Model rankings.</b> "Which model is best at X" has flipped multiple times per year, every year. Any decision hard-coded to a model name has a built-in expiry date; the durable version is the routing framework plus a re-runnable eval.</li>' +
        '<li><b>Specific prices and parameters.</b> $3/$15 per Mtok, 200k windows, "1–4B fits on-device," batch at 50% off — all early-2026 snapshots. The arithmetic method survives; the constants do not. Re-quote before every design review.</li>' +
        '<li><b>API surfaces and product names.</b> Parameter names, tool-calling formats, "thinking budget" knobs, agent frameworks — vendor-specific and version-specific. Wrap them behind thin abstractions in code and in your head.</li>' +
        '<li><b>Capability boundaries.</b> "Small models can\'t do X," "you need a reasoning tier for Y" — these are the fastest-rotting claims in the field, because distillation moves capability down-tier every quarter. Every such claim in this course deserves annual re-testing against your own tasks.</li>' +
        '<li><b>Benchmark numbers and leaderboards.</b> Saturation, contamination, and teaching-to-the-test degrade every public benchmark within a year or two of prominence. Directionally useful for triage, never load-bearing.</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> The sorting test for any new claim: <em>would this still be true if every model were 10× cheaper and 2× smarter next year?</em> "Verification is scarce" — yes, durable. "Model Z is the best coder" — no, churn. "Output tokens cost more than input" — yes (architecture). "Reasoning tiers cost 12× on this task" — the ratio churns, the need to measure it does not.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> The expensive version of filing errors: a team spent a quarter building elaborate workarounds for a specific model\'s 8k context window — custom chunking, multi-call merging, the works — treating a churn fact as a durable constraint. The next model generation shipped 128k and the workaround became dead weight nobody dared delete. The inverse error is worse: teams that skipped evals "because the new model is so good" — treating a durable requirement as churn — and shipped regressions with every upgrade. Misfiling in either direction costs a quarter.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Senior interviews increasingly probe exactly this: "what would you build differently if the model got 10× better?" The strong answer identifies which parts of the design are model-independent (evals, data plumbing, verification, escalation, unit-economics framework) and which parts are disposable adapters around the current model. That decomposition — durable core, replaceable edge — is the architecture answer AND the career answer.</div>'
    },
    {
      id: 'staying-current',
      title: 'Staying current without drowning',
      blurb: 'A sustainable information diet, a vendor-claim filter, and your own evals as the only ground truth.',
      html: '<h2>The firehose is the trap</h2>' +
        '<p>The AI feed is engineered for anxiety: daily "everything changed" launches, benchmark charts with truncated axes, threads announcing the death of whatever you learned last month. Engineers respond in two failure modes — <b>drowning</b> (hours a day triaging noise, no depth anywhere) or <b>checking out</b> (ignoring it all and calcifying). The sustainable position is a deliberately small, high-signal diet plus a personal testing practice — because the previous lesson\'s filter only works if you have inputs worth filtering and a bench to test them on.</p>' +
        '<p>A concrete weekly budget that works: <b>3–4 hours</b>. One hour scanning curated summaries, one hour reading a single primary source deeply (a model card, a paper, a post-mortem), one to two hours of hands-on testing against your own tasks. That last allocation is the one people skip and the only one that produces knowledge you can act on.</p>' +
        '<h2>Which sources matter (a hierarchy, not a list)</h2>' +
        '<p>Specific outlets churn, so anchor on source <em>types</em>, ranked by signal:</p>' +
        '<ol>' +
        '<li><b>Primary technical artifacts:</b> model cards, system cards, API changelogs, and the occasional landmark paper. Vendors state capabilities carefully in these (lawyers read them); the changelog tells you about the deprecation that will break you in 90 days, which no influencer will cover.</li>' +
        '<li><b>Practitioner write-ups with numbers:</b> engineering-blog posts and talks where someone shipped something and reports costs, failure rates, and what didn\'t work. One honest post-mortem is worth fifty launch threads.</li>' +
        '<li><b>Curated aggregation:</b> one or two weekly newsletters/digests you actually trust, as an index — you follow the pointer only when it intersects your problems.</li>' +
        '<li><b>Independent evaluations:</b> third-party eval suites and head-to-head comparisons, useful for triage (what to shortlist), never for decisions (your task isn\'t in their harness).</li>' +
        '<li><b>Social feeds:</b> discovery of the other four tiers, at unbeatable speed and unbeatable noise. Timebox ruthlessly; if it isn\'t worth following the link to a primary source, it wasn\'t information.</li>' +
        '</ol>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Depth beats coverage. You cannot know everything happening in AI, and you do not need to: you need to know what changed <em>for your systems and your decisions</em>. A pipeline you own plus a golden set you trust converts industry news from ambient anxiety into a concrete, testable question: "does this change my routing table?"</div>' +
        '<h2>Reading vendor claims without getting played</h2>' +
        '<p>Every launch post is marketing collateral containing some technical truth. The extraction checklist:</p>' +
        '<ul>' +
        '<li><b>Find the axis and the baseline.</b> "40% better" — than their own last model, on which benchmark, at what thinking budget? Bar charts that omit the strongest competitor, truncate the y-axis, or compare their reasoning tier against rivals\' standard tiers (a chronic early-2026 move) tell you what the honest number would have been: unflattering.</li>' +
        '<li><b>Check benchmark hygiene.</b> Is the benchmark saturated (everyone above 90%), likely contaminated (public test sets scraped into training data), or self-graded? Treat public benchmark deltas under ~5 points as noise by default. Look for held-out or third-party-run evals.</li>' +
        '<li><b>Separate priced claims from vibes.</b> Latency, price per Mtok, context window, rate limits are contractual facts you can plan on. "More natural," "PhD-level," "solves reasoning" are vibes. Extract the facts, discard the adjectives.</li>' +
        '<li><b>Watch for the missing denominator.</b> Agent demos that show the win but not the attempt count (best-of-how-many?), cost per task, or failure rate are showing you the numerator of a fraction they declined to finish.</li>' +
        '<li><b>Assume the demo is the ceiling.</b> A launch demo is the best cherry-picked run of the best configuration. Your production median will be worse; the only question is by how much — which is what your eval is for.</li>' +
        '</ul>' +
        '<h2>Your own eval is the truth</h2>' +
        '<p>The endgame of staying current is owning a <b>personal/team benchmark harness</b>: 30–100 real tasks from your actual work (support answers, extraction docs, code reviews, whatever your systems do), scripted graders where possible, spend and latency tracked per run. New model drops? Two hours and a few dollars later you have the only number that matters: performance on your distribution, at your price point, with your prompts. Everything else — leaderboards, launch threads, this course\'s own date-stamped numbers — is a hypothesis your harness confirms or kills. This is also, not coincidentally, this module\'s lab.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team migrated to a newly-launched model the week of release on benchmark strength — it topped the public coding leaderboards. Their own eval, run belatedly, showed a 9-point regression on their internal task: the new model was more verbose, blowing their downstream token-length assumptions and their structured-output parser. Leaderboard: up. Their product: down. They now run the harness <em>before</em> the migration ticket gets opened, a policy that costs about $4 in tokens per model launch.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How do you keep up with the field?" is not small talk — it is a probe for judgment. The weak answer lists ten newsletters. The strong answer describes a filter (primary sources over hype), a budget (hours/week), and a bench (own eval harness as the decision-maker), with one recent example of a claim you tested and rejected. That last detail lands harder than any credential.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your extraction pipeline (clear digital PDFs, simple schema) has a 4% error rate. A teammate proposes switching to the reasoning tier "since it\'s smarter." Based on how reasoning models are trained, what result should you predict?',
      options: [
        'Large accuracy gains — reasoning models are better at everything',
        'Minimal gains at 10–50× output cost: extraction from clear sources fails on ambiguity and sloppiness, not multi-step inference, which is the specific capability RL on verifiable rewards buys',
        'Worse accuracy, because reasoning models cannot produce structured outputs',
        'Identical results, because thinking tokens are discarded before the answer'
      ],
      answer: [1],
      explanation: 'RLVR concentrates gains where verification-trained deliberation helps: multi-step, checkable problems. Simple extraction errors come from edge cases and ambiguity — better handled by validation rules and escalation. The cost multiplier is real because thinking bills as output tokens. (A) is the marketing model of "smarter." (C) is false — reasoning tiers support structured outputs fine. (D) misunderstands the mechanism: thinking tokens condition the answer before being discarded from history; they absolutely change results — on tasks shaped like the training signal.'
    },
    {
      text: 'You sweep thinking budgets (1k/4k/16k/64k tokens) on your eval set and see accuracy 71% → 78% → 79% → 78.5%. What is the correct configuration decision?',
      options: [
        'Use 64k — maximum thinking gives maximum robustness on unseen inputs',
        'Use 4k — the knee of the curve; beyond it you pay linearly more output tokens for noise-level or negative accuracy change',
        'Use 1k — the cheapest option is always correct',
        'Average the budgets and use 20k'
      ],
      answer: [1],
      explanation: 'Accuracy-vs-budget curves flatten at a task-specific knee; past it, extra tokens are re-verification theater and can even dip accuracy (measurable "overthinking"). 4k captures ~7 of the ~8 available points at a fraction of 64k\'s cost. (A) buys nothing measurable at 16× the thinking spend and worse latency — "robustness on unseen inputs" is a hope, not a number, and your eval is the instrument you trusted enough to run. (C) leaves 7 real points on the table when the requirement presumably wants them. (D) is numerology.'
    },
    {
      text: 'A reasoning-tier call in your agent takes 2–4 minutes. Your gateway retries any request that hasn\'t completed in 60 seconds. What failure pattern does this create?',
      options: [
        'No issue — retries are idempotent for LLM calls',
        'Double-spend: healthy-but-slow thinking calls get killed and re-billed, multiplying token cost for zero additional answers; timeout policy must be tier-aware',
        'The retries will get progressively faster due to prompt caching',
        'The provider automatically merges duplicate requests'
      ],
      answer: [1],
      explanation: 'Thinking happens before the first visible answer token, so long silence is normal for a reasoning call — a 60s timeout tuned for standard tiers systematically kills healthy calls mid-thought, and each retry re-bills the thinking. (A) — retries are cost-idempotent nowhere: you pay for tokens generated before the kill. (C) — caching discounts input, not the thinking-output that dominates here, and doesn\'t stop the kill/retry loop. (D) — no provider dedupes your retries; that\'s your gateway\'s job.'
    },
    {
      text: 'Your code-fixing agent samples one careful patch per bug. You could instead sample 8 patches in parallel. Under which condition does best-of-8 deliver most of its theoretical gain?',
      options: [
        'When an LLM judge picks the most convincing patch',
        'When the repo has a solid test suite that programmatically verifies each candidate — selection quality, not sample count, is what converts pass@8 into pass rate',
        'When all 8 samples use temperature 0 for consistency',
        'When the 8 samples come from 8 different vendors'
      ],
      answer: [1],
      explanation: 'Best-of-N approaches the model\'s pass@N ceiling only when the selector reliably identifies winners — and programmatic verifiers (tests) are the one selector that does. (A) partially works but the judge shares blind spots with the generator and caps the gain well below the ceiling. (C) is self-defeating: temperature 0 makes the 8 samples (nearly) identical, destroying the diversity best-of-N depends on. (D) adds diversity but not selection — with no verifier you still can\'t tell which vendor\'s patch is right.'
    },
    {
      text: 'Your orchestrator fans a research task to 6 parallel subagents. Results come back with two workers having fetched the same sources and two making contradictory assumptions about scope. Which TWO design changes attack these failures directly?',
      options: [
        'Structured written task specs per worker with explicit scope boundaries, plus a shared read-only briefing document injected (and prompt-cached) into every worker',
        'Increase to 12 subagents so good results outvote bad ones',
        'A merge/reconciliation step with a single writer that deduplicates findings and surfaces conflicts rather than silently averaging them',
        'Switch all workers to the reasoning tier',
        'Let workers message each other freely to coordinate'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'Duplicated work and split-brain assumptions are distributed-systems failures: fix them with explicit task partitioning + shared context (A) and a reconciliation point that makes conflicts visible (C). (B) scales the failure along with the cost. (D) buys per-worker depth, not coordination — smart workers still duplicate work nobody partitioned. (E) sounds appealing but explodes token cost and coupling; structured specs and merge points are the tractable version of coordination.'
    },
    {
      text: 'A $1.08 agent task becomes $5–8 with best-of-4 + judge + 5-way exploration fan-out. The swarm version succeeds 91% vs 76% single-agent. Product wants it as the default for all 1,000 daily tasks. What is the senior counter-proposal?',
      options: [
        'Approve — 15 points of success rate justifies any cost',
        'Reject — swarms are never worth 5–8×',
        'Route: single-agent by default, auto-escalate to the swarm path on verifier failure or for tasks flagged high-stakes; adaptive N (start 2, widen on rejection) — capturing most of the reliability gain at a fraction of the blended cost',
        'Run the swarm nightly in batch mode to halve the cost'
      ],
      answer: [2],
      explanation: 'Escalation routing is the standing answer to expensive-but-better tiers: pay the multiplier only on traffic that needs it. Most of the 15-point gap comes from retrying the 24% of failures, so escalate-on-failure captures the bulk of the gain; adaptive N compresses cost further. (A) turns $30k/month into $150-240k without asking which tasks needed it. (B) is dogma — for the subset where failure is expensive, 5× is cheap. (D) misapplies batch: it discounts tokens ~50%, doesn\'t fix the 5–8× multiplier, and adds a day of latency to interactive work.'
    },
    {
      text: 'Which product requirement most strongly forces an on-device model rather than a cloud small-tier model?',
      options: [
        'The feature needs the highest possible answer quality',
        'Keystroke-latency interaction (sub-100ms feel) plus a hard privacy promise that input text never leaves the device',
        'The feature needs a 200k-token context window',
        'The team wants to avoid running evals on multiple hardware targets'
      ],
      answer: [1],
      explanation: 'The drivers that cloud cannot match are network-floor latency (no round trip beats a round trip, especially at p99) and local-only data flow (privacy by architecture rather than policy). (A) points the opposite way — quality ceilings favor cloud tiers. (C) also points cloud-ward: device RAM caps practical context far below cloud windows. (D) is backwards: on-device ADDS a hardware axis to your eval matrix (fleet heterogeneity, thermal throttling); it\'s a cost you accept for the drivers in (B), not a simplification.'
    },
    {
      text: 'Your on-device summarizer benchmarked beautifully on flagship devices but field reports show multi-minute latency on mid-range phones. What did the eval process miss?',
      options: [
        'The model was not quantized correctly for smaller devices',
        'Fleet heterogeneity and sustained-load thermal throttling: the install base\'s p95 device is older, bandwidth-starved, and throttles under continuous decode — the eval matrix needed a hardware axis, not just a task axis',
        'Mid-range phones lack NPUs entirely, so the model fell back to cloud',
        'The context window was configured too large'
      ],
      answer: [1],
      explanation: 'Edge inference has a distribution of hardware, and your latency SLO lives at the bad end of it — including thermal throttling that lab benches with active cooling never exhibit (3–5× decode slowdowns on sustained load). (A) is possible but wouldn\'t explain the flagship/mid-range split by itself — the same quantized artifact typically ships fleet-wide. (C) contradicts the symptom: cloud fallback would show network-shaped latency, not thermal-shaped multi-minute local decode. (D) would slow all devices, not specifically mid-range ones.'
    },
    {
      text: 'Sort onto the durable shelf: which TWO of these claims would still be true if every model were 10× cheaper and 2× more capable next year?',
      options: [
        'Model Z is the best model for code generation',
        'Output tokens cost more than input tokens because decode is memory-bandwidth-bound while prefill parallelizes',
        'A 4B model cannot do useful summarization',
        'Untrusted text reaching a model with capable tools and secrets is a standing security hazard requiring containment, not just prompting',
        'The best available context window is 200k tokens'
      ],
      answer: [1, 3],
      multi: true,
      explanation: 'The sorting test is whether the claim rests on architecture/economics/statistics or on a current snapshot. (B) follows from transformer serving physics — the ratio may shift, the asymmetry persists. (D) follows from instructions and data sharing one token stream — no shipped architecture has repealed it. (A) is a leaderboard fact with a half-life of months. (C) is a capability boundary — the fastest-rotting claim type; it was already false by early 2026. (E) is a spec-sheet snapshot, obsolete on someone\'s next launch day.'
    },
    {
      text: 'A team hard-codes elaborate multi-call chunking workarounds for a current model\'s small context window into their core architecture. What is the durable-vs-churn diagnosis?',
      options: [
        'Good engineering — context limits are a durable constraint of transformers',
        'They treated a churn fact (this model\'s window size) as durable and welded it into the core; window sizes rotate quarterly, while the durable principle — context as a budget to allocate — should shape the design without hard-coding today\'s constant',
        'The mistake is not going far enough — they should also fine-tune around the limit',
        'No diagnosis needed; all code is temporary anyway'
      ],
      answer: [1],
      explanation: 'The specific window size is churn (the war story: next generation shipped 16× the window and the workaround became undeletable dead weight). The durable version is context-as-budget: assemble, summarize, cache — mechanisms that stay useful at any window size — while isolating today\'s constants behind config. (A) confuses "context is finite" (durable) with "context is 8k" (churn). (C) compounds the error with an even heavier model-specific investment. (D) is nihilism, and the inverse error — skipping evals because models improve — costs even more.'
    },
    {
      text: 'A vendor launch chart shows their new model beating competitors by 12 points on a coding benchmark. Applying the vendor-claim checklist, which detail would MOST reduce the claim\'s decision value?',
      options: [
        'The chart uses the vendor\'s brand colors',
        'The vendor\'s bar is their reasoning tier at a high thinking budget while competitor bars are standard tiers at default settings',
        'The benchmark was run three weeks ago',
        'The model is only available in limited preview'
      ],
      answer: [1],
      explanation: 'Mismatched configurations is the classic asymmetric-comparison move (chronic as of early 2026): it converts a tier-and-budget difference into an implied model-quality difference, and the honest same-tier number is the one they chose not to show. (A) is cosmetic. (C) is fine — three weeks is fresh. (D) affects when you can adopt, not whether the claim is sound. The checklist items that kill claims are axis/baseline games, contamination, and missing denominators — this is the first one in the wild.'
    },
    {
      text: 'A new model tops public leaderboards. Your own 60-task harness shows it regressing 9 points on your workload. What is the correct interpretation and action?',
      options: [
        'Your harness must be broken — public benchmarks aggregate far more data',
        'Both results are real: leaderboards measure their distribution, your harness measures yours; your distribution is the one you ship on, so hold the migration and investigate the regression (e.g. verbosity breaking parsers, format drift)',
        'Adopt anyway — newer models always win within a few weeks of prompt tuning',
        'Split traffic 50/50 in production and let user complaints decide'
      ],
      answer: [1],
      explanation: 'This is the entire point of owning an eval: public benchmarks are triage on someone else\'s distribution; your golden set is ground truth for your decision. Regressions like added verbosity breaking downstream parsers are exactly what leaderboards can\'t see. (A) has it backwards — more data on the wrong distribution is still the wrong distribution. (C) is hope-driven engineering; maybe prompt tuning recovers the 9 points, but you verify that on the harness BEFORE migrating. (D) uses paying users as your eval harness and complaint volume as your grader — expensive, slow, and reputationally corrosive.'
    },
    {
      text: 'An engineer spends ~90 minutes daily reading AI social feeds, feels perpetually behind, and hasn\'t run a hands-on test in months. Which restructuring best converts this time into decision-grade knowledge?',
      options: [
        'Double the reading time to achieve full coverage of the field',
        'Cut to a weekly budget: one hour of curated digests, one deep primary source (model card, changelog, post-mortem), and 1–2 hours running new claims against a personal eval harness of real tasks — letting the harness, not the feed, decide what matters',
        'Stop following AI news entirely and re-skill only when forced by a migration',
        'Only read content about the single vendor the company currently uses'
      ],
      answer: [1],
      explanation: 'The failure mode is coverage-without-depth: feeds produce anxiety, not decisions. The fix is a bounded diet weighted toward primary sources plus hands-on testing — the only activity that produces knowledge you can act on ("does this change my routing table?"). (A) scales the problem. (C) is the opposite failure — calcifying until a deprecation or a missed 10× improvement forces a panic migration. (D) creates vendor tunnel-vision precisely when routing across vendors and tiers is a core design skill; changelogs of your current vendor matter, but so does knowing when a competitor moved the frontier your evals should test.'
    },
    {
      text: 'Which claims from a model launch post can you treat as plannable facts rather than vibes? Choose TWO.',
      options: [
        '"The model feels dramatically more natural in conversation"',
        'Published price per Mtok and the documented context window limit',
        '"Approaches PhD-level reasoning across domains"',
        'The API changelog entry deprecating the previous model version in 90 days',
        '"Developers report 3× productivity gains"'
      ],
      answer: [1, 3],
      multi: true,
      explanation: 'Prices, window limits, and deprecation timelines are contractual/spec facts you can build plans on — the vendor is accountable for them. (B) feeds directly into unit-economics math; (D) is the item that will break you if unread — no influencer covers deprecations. (A) and (C) are unfalsifiable vibes until your harness scores them. (E) is a missing-denominator claim: which developers, which tasks, measured how, best-of-how-many? Extract the facts, discard the adjectives, test the rest.'
    }
  ],
  flashcards: [
    { id: 'fc-rlvr', front: 'What is RL on verifiable rewards (RLVR) and why did it scale?', back: 'Train with RL on problems where correctness is checkable by a program (math answers, code vs tests): sample long solutions, reward the ones that verify. Scaled because verification is cheap and incorruptible, unlike human preference ratings.' },
    { id: 'fc-test-time', front: 'What is test-time compute?', back: 'The third scaling axis (after pretraining compute and data): buy accuracy at inference by spending more tokens — serially (thinking budgets) or in parallel (best-of-N). Same weights, more inference spend, better answers on verifiable multi-step tasks.' },
    { id: 'fc-thinking-billing', front: 'How are thinking tokens billed and what is the cost multiplier?', back: 'As output tokens — the expensive direction. Hard problems emit 2k–50k thinking tokens, so a $0.01 task can become $0.20–1.00: a 10–50× multiplier. Thinking budgets are the control knob.' },
    { id: 'fc-reasoning-buys', front: 'One-line rule: what does reasoning buy, and what does it NOT buy?', back: 'Reasoning buys serial computation, not knowledge. Failure mode "didn\'t know" → retrieval. Failure mode "knew the pieces, combined them wrong" → reasoning tier (or your own verifier loop).' },
    { id: 'fc-budget-knee', front: 'What does the accuracy-vs-thinking-budget curve look like?', back: 'Steep rise, then a task-specific knee, then flat (sometimes a dip — measurable "overthinking"). Sweep budgets on your own eval; running past the knee is pure waste.' },
    { id: 'fc-trace-faith', front: 'Are thinking traces faithful explanations?', back: 'No — traces are sampled text; correct answers arrive via wrong-step traces and vice versa. Use as a debugging signal, never as an audit log.' },
    { id: 'fc-reasoning-latency', front: 'The latency consequences of reasoning tiers?', back: 'Thinking precedes the first visible token → time-to-first-answer balloons to minutes. Needs progress UI/thinking summaries; tier-aware timeouts (60s retry policies double-bill healthy slow calls); pairs well with batch APIs.' },
    { id: 'fc-best-of-n', front: 'When does best-of-N sampling actually work?', back: 'When selection is strong: programmatic verifiers (tests, compilers, schemas) → near pass@N ceiling. Majority vote works for uncorrelated errors; LLM judges only partially (shared blind spots). Selection quality IS the gain.' },
    { id: 'fc-verification-scarce', front: 'Why is verification "the scarce asset" at the frontier?', back: 'Generation gets cheaper every quarter; knowing whether output is RIGHT does not. Verifiers power RLVR training, best-of-N, agent escalation, and evals — invest there for compounding returns.' },
    { id: 'fc-swarm-wins', front: 'Where do agent swarms genuinely win (early 2026)?', back: 'Coding with tests (CI as verifier), research fan-out with note-ledger merge, high-stakes one-shots (sample 5 analyses, human picks), throughput-bound batch. Standing failure: verifier-free multi-agent "debate."' },
    { id: 'fc-swarm-cost', front: 'Honest swarm cost math?', back: 'Best-of-4 + judge + 5-way fan-out turns a ~$1 agent task into $5–8 (near-linear in samples). Controls: adaptive N, cheap-model workers, prompt-cached shared briefings, per-task dollar caps degrading to single-agent.' },
    { id: 'fc-swarm-failures', front: 'How do swarms fail?', back: 'Like distributed systems: duplicated work, split-brain assumptions, no idempotency, error-amplifying decompositions. Fixes: structured task specs, shared read-only briefing, single-writer merge step, per-worker budgets.' },
    { id: 'fc-ondevice-envelope', front: 'The on-device capability envelope, early 2026?', back: '1–4B params at 4-bit ≈ 1–3 GB, tens of tok/s on 40–80 TOPS NPU-class hardware. Good: summarization, classification, short drafting, extraction, autocomplete, small-scale local RAG. Not: deep reasoning, broad recall, big contexts.' },
    { id: 'fc-ondevice-drivers', front: 'The three drivers pushing inference on-device?', back: 'Privacy (data never leaves → shippable features + regulatory ease), latency (no network floor; sub-100ms consistent, offline-capable), cost (user\'s silicon = zero marginal inference cost at huge call volumes).' },
    { id: 'fc-hybrid', front: 'What is the hybrid local+cloud pattern?', back: 'Local-first with cloud escalation: on-device model handles high-frequency easy traffic and routes; hard requests escalate (with consent where privacy was promised). Same tiered-routing method with the small tier moved onto the device.' },
    { id: 'fc-fleet', front: 'What eval axis does on-device add?', back: 'Hardware heterogeneity: old devices, memory pressure, thermal throttling (3–5× decode slowdowns on sustained load). Your p95 lives on a 3-year-old phone in a warm pocket — bench with a hardware matrix, and ship models like app assets with rollback.' },
    { id: 'fc-durable-list', front: 'Name five durable principles that survive model churn.', back: 'Token economics structure (output &gt; input, context costs), context as a budget, eval discipline on your own distribution, the injection security model (containment over prompting), verification as the scarce asset. Plus stage attribution of behaviors.' },
    { id: 'fc-churn-list', front: 'Name the fast-rotting claim types.', back: 'Model rankings, specific prices/window sizes/param counts, API surfaces and framework names, capability boundaries ("small models can\'t X"), benchmark numbers. Date-stamp, wrap behind adapters, re-test annually.' },
    { id: 'fc-sorting-test', front: 'The one-question durable-vs-churn sorting test?', back: '"Would this still be true if every model were 10× cheaper and 2× smarter next year?" Yes → principle (build on it). No → snapshot (config, adapters, re-quote before design reviews).' },
    { id: 'fc-vendor-checklist', front: 'Vendor-claim reading checklist?', back: 'Find axis+baseline (compared to what, at what settings?); check benchmark hygiene (saturation/contamination); separate priced facts (latency, $/Mtok, windows, deprecations) from vibes; demand denominators (best-of-N? cost? failure rate?); assume demos are the ceiling.' }
  ],
  lab: {
    title: 'Benchmark a reasoning tier against a standard tier on YOUR task',
    intro: '<p>You will build the miniature eval harness this module keeps insisting on: 20+ real tasks, run against a standard tier and a reasoning tier (two thinking budgets), with accuracy, latency, tokens, and dollars tracked — ending in a routing decision you can defend with numbers. Works with any provider exposing both tiers (OpenAI o-series vs 4o-class, Anthropic extended thinking on/off, DeepSeek R1 vs V3, or local variants).</p><p><b>Needs:</b> <code>python3</code>, an API key for one provider with a reasoning tier, ~1.5 hours.</p>',
    steps: [
      {
        title: 'Build a 20-item task set with checkable answers',
        html: '<p>Pick ONE task from your actual work where correctness is verifiable — e.g. bug-finding in code snippets (you know the seeded bug), multi-constraint scheduling questions, data-transformation with known output, or tricky extraction with a gold answer. Write <code>tasks.jsonl</code>: one JSON object per line with <code>{"id", "prompt", "expected"}</code>. Make at least 5 items easy and 5 genuinely multi-step — the split is what reveals where reasoning pays.</p>' +
          '<p>Resist the urge to use puzzle-book questions: the whole point is measuring YOUR distribution, not the benchmark distribution the models were tuned to impress.</p>'
      },
      {
        title: 'Write the harness',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json, time\nfrom openai import OpenAI\nc = OpenAI()\n\nCONFIGS = [\n  {\'name\': \'standard\', \'model\': \'gpt-4o\', \'kw\': {}},\n  {\'name\': \'reason-low\', \'model\': \'o4-mini\', \'kw\': {\'reasoning_effort\': \'low\'}},\n  {\'name\': \'reason-high\', \'model\': \'o4-mini\', \'kw\': {\'reasoning_effort\': \'high\'}},\n]  # swap in your provider\'s tier names / thinking-budget params\n\n# fill with your provider\'s real prices, $/Mtok, as of today\nPRICE = {\'gpt-4o\': (2.5, 10.0), \'o4-mini\': (1.1, 4.4)}\n\nresults = []\nfor line in open(\'tasks.jsonl\'):\n    t = json.loads(line)\n    for cfg in CONFIGS:\n        t0 = time.time()\n        r = c.chat.completions.create(model=cfg[\'model\'],\n            messages=[{\'role\':\'user\',\'content\': t[\'prompt\'] +\n              \'\\n\\nEnd your reply with FINAL: &lt;answer&gt;\'}], **cfg[\'kw\'])\n        dt = time.time() - t0\n        u = r.usage\n        pin, pout = PRICE[cfg[\'model\']]\n        cost = u.prompt_tokens*pin/1e6 + u.completion_tokens*pout/1e6\n        text = r.choices[0].message.content or \'\'\n        got = text.rsplit(\'FINAL:\', 1)[-1].strip() if \'FINAL:\' in text else text.strip()\n        ok = t[\'expected\'].strip().lower() in got.lower()\n        results.append({\'id\': t[\'id\'], \'cfg\': cfg[\'name\'], \'ok\': ok,\n                        \'sec\': round(dt,1), \'out_tok\': u.completion_tokens,\n                        \'cost\': round(cost,5)})\n        print(results[-1])\njson.dump(results, open(\'results.json\',\'w\'), indent=1)\nEOF</code></pre>' +
          '<p>Note <code>completion_tokens</code> on reasoning configs includes hidden thinking tokens on most providers — that IS the cost story, so don\'t "correct" it away. If your grader is fuzzier than substring match, add an LLM-judge grading call with a cheap model — and spot-check 10 of its verdicts by hand.</p>'
      },
      {
        title: 'Compute the three tables',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json\nfrom collections import defaultdict\nrs = json.load(open(\'results.json\'))\nagg = defaultdict(lambda: {\'n\':0,\'ok\':0,\'cost\':0.0,\'sec\':0.0,\'tok\':0})\nfor r in rs:\n    a = agg[r[\'cfg\']]\n    a[\'n\'] += 1; a[\'ok\'] += r[\'ok\']; a[\'cost\'] += r[\'cost\']\n    a[\'sec\'] += r[\'sec\']; a[\'tok\'] += r[\'out_tok\']\nprint(f"{\'config\':&gt;12} {\'acc\':&gt;6} {\'$/task\':&gt;8} {\'$/correct\':&gt;10} {\'p_sec\':&gt;6} {\'out_tok\':&gt;8}")\nfor k, a in agg.items():\n    acc = a[\'ok\']/a[\'n\']\n    cpc = a[\'cost\']/max(a[\'ok\'],1)\n    print(f"{k:&gt;12} {acc:6.0%} {a[\'cost\']/a[\'n\']:8.4f} {cpc:10.4f} {a[\'sec\']/a[\'n\']:6.1f} {a[\'tok\']//a[\'n\']:8}")\nEOF</code></pre>' +
          '<p>The load-bearing column is <b>$/correct answer</b> — it fuses accuracy and cost into the number a routing decision needs. Then split the same table by your easy/hard item tag: the classic result is reasoning tiers roughly tying on easy items (at 5–20× the cost) and winning clearly on hard ones. Also eyeball per-item latency — note the time-to-answer difference you\'d be signing your users up for.</p>'
      },
      {
        title: 'Make and record the routing decision',
        html: '<p>Write five lines at the bottom of <code>results.json</code>\'s folder in a <code>DECISION.md</code>-style note (or your team wiki):</p>' +
          '<ul><li>Task and date (numbers rot — the date IS data)</li>' +
          '<li>Accuracy / $-per-correct / latency per config, easy vs hard split</li>' +
          '<li>The decision: which tier by default, what triggers escalation (e.g. "standard tier; escalate to reason-low when the validator rejects")</li>' +
          '<li>The thinking-budget knee if you swept one (where did accuracy flatten?)</li>' +
          '<li>Re-test trigger: "re-run this harness on the next model launch or in 6 months, whichever first"</li></ul>' +
          '<p>You now own the artifact this module claims is the only truth: a harness that converts any future launch-day hype into a 20-minute, few-dollar question. Re-running it beats reading a hundred threads.</p>'
      }
    ],
    costNote: 'Worst case: 20 tasks × 3 configs, with high-effort reasoning runs emitting ~5–15k thinking tokens each ≈ $2–5 total on mini-class reasoning tiers (as of early 2026); using flagship reasoning models instead can reach $10–15 — start with the mini tier. Nothing persistent is created; delete tasks.jsonl and results.json if they contain work data.'
  }
});
