COURSE.register({
  id: 'm03-prompt-engineering',
  track: 'core',
  order: 3,
  title: 'Prompt engineering that survives production',
  short: 'Prompt engineering',
  tagline: 'System prompts as API contracts, caching economics, versioning discipline — and the folklore you should stop paying for.',
  minutes: 100,
  lessons: [
    {
      id: 'system-prompts-contracts',
      title: 'System prompts are API contracts, not vibes',
      blurb: 'The load-bearing document your whole product depends on — treated with the rigor of an interface definition.',
      html: '<h2>The mental model: a contract with a probabilistic implementer</h2>' +
        '<p>A system prompt is the closest thing you have to an interface definition for a component that ships nondeterministic behavior. Everything downstream — your parsers, your UI, your safety posture, your cost profile — implicitly depends on the model honoring it. Yet most teams write system prompts the way they write commit messages at 6pm: prose, appended to over months, never reviewed, never tested. The shift that separates production prompt engineering from demo prompt engineering is treating the system prompt as a <em>specification with consumers</em>.</p>' +
        '<p>What a contract mindset changes in practice:</p>' +
        '<ul>' +
        '<li><b>Every clause must have an owner and a reason.</b> "Why is this sentence here?" should have an answer — usually a linked incident or eval failure. Clauses nobody can explain are dead code, and dead prompt code is worse than dead program code because it still consumes attention (and tokens) on every request.</li>' +
        '<li><b>Structure beats prose.</b> Models follow sectioned prompts (markdown headers, XML-style tags like <code>&lt;rules&gt;</code>, numbered constraints) more reliably than paragraphs. Sections also make diffs reviewable — a one-line change in a 3,000-token prose blob is unreviewable; the same change under a <code>## Refund policy</code> header is obvious.</li>' +
        '<li><b>Specify behavior at the boundaries.</b> Like any interface, the interesting part is edge cases: what to do when the user asks something out of scope, when a tool fails, when required information is missing, when instructions conflict. An unspecified edge case is not "the model will figure it out" — it is "the model will sample something plausible, differently each time."</li>' +
        '<li><b>Define the output surface precisely.</b> If downstream code parses the output, the format specification belongs in the contract with an example — or better, moves out of prose entirely into structured outputs (module 5).</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> The model cannot distinguish load-bearing instructions from wishful thinking — both are just tokens conditioning the next-token distribution. The discipline of contracts (explicit, minimal, tested, versioned) is how <em>you</em> keep track of which is which.</div>' +
        '<h2>Instruction hierarchy: who wins when instructions conflict</h2>' +
        '<p>Every major API separates a privileged instruction channel from user content: OpenAI has <code>system</code>/<code>developer</code> roles, Anthropic a top-level <code>system</code> parameter, Gemini a <code>systemInstruction</code> field. Models are trained (imperfectly) to weight these above user turns — OpenAI publishes this as an explicit "instruction hierarchy": platform &gt; developer &gt; user &gt; tool output. Two production consequences:</p>' +
        '<ul>' +
        '<li><b>Put policy in the system channel, data in user turns.</b> Teams that concatenate policy + user input into one user message throw away the trained privilege separation, making prompt injection strictly easier. The hierarchy is a probability shift, not a security boundary (module 13), but you should still collect the shift.</li>' +
        '<li><b>Late instructions fight early ones.</b> If turn 40 of a conversation contains a user demand that contradicts the system prompt, compliance depends on training, phrasing, and position. Contracts that matter (compliance text, tool restrictions) should also be enforced <em>outside</em> the model: output filters, tool allowlists, schema validation.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> There is no privileged execution mode for system tokens — they pass through the same transformer as everything else. The "hierarchy" exists because post-training data taught the model to prefer system-consistent continuations. That preference is strong for style and format, weaker for content restrictions under adversarial pressure. This is why "the system prompt says never reveal X" is a UX feature, not a security control.</div>' +
        '<h2>Writing contracts that models actually follow</h2>' +
        '<p>Patterns that survive contact with production, distilled from published vendor guidance and a few thousand postmortems:</p>' +
        '<ul>' +
        '<li><b>Positive instructions over negative ones.</b> "Respond in the user\'s language" beats "don\'t respond in English when the user writes German". Negations require the model to represent the forbidden behavior to avoid it — and under distribution shift it sometimes just... does it.</li>' +
        '<li><b>One concept per clause; examples for anything ambiguous.</b> If two engineers on your team disagree about what a clause requires, the model will too.</li>' +
        '<li><b>State priority explicitly for known conflicts.</b> "If brevity and completeness conflict, prefer completeness." Otherwise you get silent, per-request coin flips.</li>' +
        '<li><b>Keep it as short as the behavior allows.</b> Instruction-following degrades as instruction count grows — models reliably juggle dozens of constraints, not hundreds. Every marginal rule dilutes attention on the others (see the mega-prompt anti-pattern, lesson 6).</li>' +
        '<li><b>Calibrate intensity to the model generation.</b> Older models needed "CRITICAL: you MUST"; 2025-era models follow instructions much more literally, and aggressive language now causes over-triggering — tools called when they shouldn\'t be, refusals of benign requests. When you upgrade models, aggressive scaffolding is the first thing to re-review.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A fintech team shipped a support bot whose system prompt had accreted 14 months of patches: 6,200 tokens, three contradictory instructions about refund limits (added by different PMs), and a "never mention competitor names" clause that made the bot refuse to process complaints that quoted competitor ads. Nobody had read the prompt end-to-end in a year. The fix was not better prompting — it was deleting two-thirds of it and adding a regression eval so deletions were safe. Prompts rot exactly like code, but invisibly, because there is no compiler to complain.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How would you structure the system prompt for a customer-support agent?" Strong answers talk about sections (role, capabilities, hard constraints, output format, edge-case policy), the instruction hierarchy, keeping enforcement of real limits outside the model, and how the prompt gets tested and versioned. Reciting "be specific and give examples" without the engineering-process half is a junior answer.</div>'
    },
    {
      id: 'few-shot',
      title: 'Few-shot: when examples beat instructions',
      blurb: 'In-context learning as an API — and the selection and ordering effects that silently move your accuracy.',
      html: '<h2>Why examples work: you are programming the induction machinery</h2>' +
        '<p>Module 1 covered the mechanism: transformers learn induction behavior ("A→B ... A→?") because it pays rent across the entire pretraining corpus. Few-shot prompting is the API to that machinery. Instead of <em>describing</em> a transformation in natural language — which the model must interpret — you <em>demonstrate</em> it, and the model\'s pattern-completion does the rest.</p>' +
        '<p>The practical decision rule: <b>instructions communicate intent; examples communicate distribution.</b> Use instructions for things that are easy to say and hard to show (scope, tone boundaries, safety policy). Use examples for things that are easy to show and hard to say:</p>' +
        '<ul>' +
        '<li><b>Format with fiddly details</b> — exact label vocabulary, how to punctuate edge cases, what an empty result looks like. One example replaces a paragraph of format prose and outperforms it.</li>' +
        '<li><b>Judgment calls near the boundary</b> — "is this ticket a bug or a feature request?" Your taxonomy lives in the borderline cases; show them.</li>' +
        '<li><b>House style</b> — the difference between "concise" (instruction, interpreted 50 ways) and three examples of your actual desired tone.</li>' +
        '<li><b>Calibrating "how much"</b> — how aggressive to be with rewriting, how much detail in summaries. Quantity words are vague; examples are exact.</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> A classifier prompt with 5 well-chosen boundary examples routinely beats the same prompt with 500 words of taxonomy description. If you find yourself writing your third clarifying sentence about a distinction, stop and demonstrate it instead.</div>' +
        '<h2>Selection and ordering effects are real and measurable</h2>' +
        '<p>The uncomfortable research result (Lu et al. 2021, "Fantastically Ordered Prompts", and a long line of follow-ups): with identical example <em>sets</em>, merely reordering examples swung classification accuracy by tens of points on smaller models. Modern frontier models are far more robust, but the effects have not gone to zero — they show up as a few points of drift, which is exactly the size of the improvements you are usually chasing. What you need to know:</p>' +
        '<ul>' +
        '<li><b>Recency bias:</b> examples closest to the query exert the most pull. If your last example is a refusal, expect elevated refusal rates. Put a representative — not exotic — example last, or shuffle order per-request and accept the variance.</li>' +
        '<li><b>Majority-label bias:</b> if 4 of 5 examples are labeled "spam", the model\'s prior shifts toward "spam" regardless of the query. Balance label distribution in classification shots.</li>' +
        '<li><b>Similarity dominates:</b> the model leans hardest on examples that resemble the current input. This is why <b>dynamic few-shot</b> — retrieving the k nearest labeled examples from an example bank via embeddings, per request — beats any fixed example set. It is RAG applied to demonstrations, and it is one of the highest-ROI tricks in applied prompting.</li>' +
        '<li><b>Examples define the output distribution literally.</b> If every shot has a one-sentence answer, you have implicitly demanded one-sentence answers. Teams get bitten when they copy examples from docs whose length/style silently constrains production outputs.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team A/B-tested "prompt v2" against v1 and celebrated a 4-point accuracy win. V2 had reworded instructions AND reordered examples. A later ablation showed the rewording did nothing — the entire gain was example order, which meant it was fragile noise, and it evaporated on the next model upgrade. Change one variable at a time, and always re-run the eval across 3+ seeds/orderings before believing a small delta.</div>' +
        '<h2>Operational rules for few-shot in production</h2>' +
        '<ul>' +
        '<li><b>Diminishing returns arrive fast.</b> Gains typically plateau between 3 and 8 examples; past that you pay tokens for nothing. Long-context "many-shot" prompting (hundreds of examples) does help on some hard tasks — but evaluate whether a fine-tune (module 14) is cheaper at that point, because you are paying those example tokens on every single request, forever.</li>' +
        '<li><b>Examples are load-bearing config.</b> Store them versioned with the prompt (lesson 5), not inline in application code where a well-meaning refactor reorders them.</li>' +
        '<li><b>Keep shots inside the cached prefix.</b> A stable example block placed before the volatile user input is cache-friendly (lesson 4); dynamic few-shot trades cache hits for relevance — measure which wins on your traffic. With per-request retrieved shots you pay full input price on the example block every time; with fixed shots you pay ~10% after the first request. Relevance must buy more accuracy than the 10× token premium costs.</li>' +
        '<li><b>Mind the chat-format seams.</b> In chat APIs, few-shot examples go either inside one system/user message as a formatted block, or as synthetic user/assistant turn pairs. Synthetic turns look more natural to the model and often work better for conversational tasks — but some providers\' abuse filters and caching behave differently across the two layouts. Pick one, test it, standardize.</li>' +
        '<li><b>Never let examples contradict instructions.</b> When shots and rules disagree, models tend to follow the shots — demonstrations are stronger evidence than descriptions. Audit for drift every time either changes.</li>' +
        '</ul>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Few-shot cannot add knowledge (examples teach mapping, not facts), cannot reliably override safety training, and cannot fix a task the model fundamentally can\'t do — if zero-shot is at chance level, shots rarely rescue it. And each shot costs input tokens per request: 8 shots × 150 tokens × 10M requests/month at $3/Mtok is $36k/year of example tax — check the fine-tuning math past that scale.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "When would you use few-shot over instructions, and what can go wrong?" Cover: format/boundary/style tasks favor examples; selection and ordering biases (recency, majority-label); dynamic retrieval of examples; token cost at scale vs fine-tuning. Mentioning that examples beat instructions when they conflict signals real practice.</div>'
    },
    {
      id: 'chain-of-thought',
      title: 'Chain-of-thought — and when it became obsolete',
      blurb: 'Why "think step by step" worked, what reasoning models changed, and where explicit CoT still earns its tokens.',
      html: '<h2>The mechanism, one more time, because it decides everything</h2>' +
        '<p>Per-token compute is fixed (module 1). A transformer gets the same number of layers to predict token 12 of a hard answer as token 12 of an easy one. Chain-of-thought works because emitted tokens are <b>external working memory</b>: each intermediate step gets written into the context and later tokens condition on it. "Let\'s think step by step" (Kojima et al. 2022) and few-shot CoT (Wei et al. 2022) were the famous incantations, but the incantation was never the point — <em>any</em> structure that forces intermediate state into tokens before the conclusion buys serial computation depth.</p>' +
        '<p>That framing explains all the corollaries you\'ll actually use:</p>' +
        '<ul>' +
        '<li><b>Order output fields: reasoning before verdict.</b> A JSON schema with <code>"verdict"</code> first forces the model to commit with zero written analysis; the trailing "reasoning" field is post-hoc rationalization. Evidence-first field order is free accuracy (module 5).</li>' +
        '<li><b>CoT helps compositional tasks</b> (math, multi-hop logic, planning, code tracing) and does roughly nothing for pure recall or single-step pattern matching — sometimes it even hurts, by giving the model rope to talk itself out of a correct first instinct.</li>' +
        '<li><b>CoT text is not a faithful trace.</b> Models sometimes reach answers via computations the written chain doesn\'t reflect (Anthropic\'s faithfulness work showed models silently using hints they never mention). Treat CoT as a performance enhancer and a debugging <em>hint</em>, never as an audit log.</li>' +
        '</ul>' +
        '<h2>What reasoning models changed</h2>' +
        '<p>From late 2024 (OpenAI o1, then o3, DeepSeek-R1, Gemini thinking modes, Claude extended/adaptive thinking), vendors industrialized CoT: models are trained with reinforcement learning on verifiable outcomes to produce long <em>internal</em> reasoning traces before answering, with the trace hidden or summarized. As of early 2026 this is the default regime for frontier models — reasoning is a dial (effort/budget parameters), not a prompt trick. Consequences:</p>' +
        '<ul>' +
        '<li><b>Prompted CoT on a reasoning model is mostly redundant — and sometimes harmful.</b> Vendor guidance (OpenAI\'s o-series docs, Anthropic\'s and DeepSeek\'s prompting guides) explicitly says to stop instructing step-by-step thinking: the model already deliberates, and your scripted procedure can interfere with the trained one. DeepSeek-R1\'s docs went further, recommending against few-shot in general (it degraded R1\'s performance). Measure on your task, but the burden of proof flipped: explicit CoT is now the thing that must justify itself.</li>' +
        '<li><b>You buy reasoning with a parameter, not a phrase.</b> OpenAI <code>reasoning_effort</code>, Anthropic adaptive thinking + <code>effort</code>, Gemini <code>thinkingBudget</code>. This is better engineering: it is explicit, billable, tunable per-route, and doesn\'t pollute your prompt.</li>' +
        '<li><b>Reasoning tokens are billed as output — the meter runs on hidden text.</b> A "concise" answer can carry thousands of invisible reasoning tokens at output prices ($10–75/Mtok on frontier reasoning tiers as of early 2026). Latency scales with them too. Budget and monitor them like any other resource; watch the reasoning-token field in usage responses.</li>' +
        '<li><b>Where CoT survives:</b> non-reasoning/cheap models (a prompted CoT on a $0.25/Mtok mini model is often the cost-optimal way to hit a quality bar); tasks where you must <em>show</em> auditable working to a human; structured intermediate outputs you parse (extract-then-decide pipelines); and forcing domain-specific procedures ("check eligibility, then compute the amount, then verify against the cap") where the steps encode business logic the model wouldn\'t invent.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Reasoning models are trained with RL against verifiable rewards: generate many chains, reward the ones reaching checkable answers (unit tests pass, proof verifies, final number matches). The model learns search-like behaviors — backtracking, self-checking, trying alternatives — because those behaviors win reward. That is why test-time compute became a third scaling axis: more thinking tokens ≈ more search. It is also why gains concentrate in verifiable domains (math, code) and are weaker where no reward oracle exists (taste, strategy, open-ended writing).</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team migrated their pipeline from a classic model to a reasoning model and kept their elaborate 800-token "think step by step using this 9-part framework" scaffold. Quality went <em>down</em> and cost tripled: the model dutifully followed the inferior scripted procedure instead of its trained reasoning, and billed hidden thinking on top. Deleting the scaffold fixed both. When you change model class, re-derive the prompt from scratch — don\'t port it.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Reasoning effort is not free quality: on easy tasks, high effort mostly buys latency (10–60+ seconds) and overthinking. As of early 2026, sane defaults are low/medium effort for routine work and high effort only for genuinely hard, verifiable problems — several vendors\' own docs now say exactly this. Route by difficulty; don\'t set one global dial.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Classic probe: "Is chain-of-thought still relevant now that reasoning models exist?" Strong answer: the mechanism (tokens as working memory) is permanent and still governs schema field order and cheap-model prompting; the <em>incantation</em> is obsolete on reasoning models, replaced by effort parameters and RL-trained deliberation; and CoT text was never a faithful audit trail. Bonus: mention cost/latency of hidden reasoning tokens.</div>'
    },
    {
      id: 'prompt-caching',
      title: 'Prompt caching: mechanics and economics',
      blurb: 'The single biggest lever on inference cost — if you understand prefix stability.',
      html: '<h2>What is actually cached</h2>' +
        '<p>Prompt caching stores the computed KV cache (module 1: keys/values per token per layer) for a prompt <em>prefix</em>, so repeat requests skip re-running prefill over the shared part. This is the crucial fact: <b>it is a prefix match over exact bytes</b>. The provider hashes/matches your rendered request from position 0 forward; the first differing byte ends the match, and everything after it is recomputed at full price. There is no "diff detection", no semantic matching, no reordering tolerance.</p>' +
        '<p>Provider mechanics as of early 2026 (date-stamped — verify before relying):</p>' +
        '<table><tr><th>Provider</th><th>Activation</th><th>Cached-read price</th><th>Write cost</th><th>TTL</th></tr>' +
        '<tr><td>Anthropic</td><td>Explicit <code>cache_control</code> breakpoints (max 4)</td><td>~0.1× input (90% off)</td><td>1.25× (5-min) / 2× (1-h TTL)</td><td>5 min default, 1 h option; refreshed on hit</td></tr>' +
        '<tr><td>OpenAI</td><td>Automatic, prefixes ≥1024 tokens</td><td>~0.25–0.5× input (model-dependent; e.g. GPT-5.x cached input ~90% off)</td><td>free</td><td>minutes, best-effort (~5–60 min)</td></tr>' +
        '<tr><td>Google Gemini</td><td>Implicit (automatic) + explicit CachedContent API</td><td>~0.25× input</td><td>free implicit; explicit adds storage $/token/hour</td><td>implicit: minutes; explicit: you set it</td></tr></table>' +
        '<p>Minimum cacheable prefix sizes exist everywhere (1024 tokens on OpenAI; roughly 1–4k on Anthropic depending on model). Below the floor, nothing caches — silently.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Caching converts "tokens resent every request" from a linear cost into a ~90%-discounted one. For agents and chat apps — where each turn resends the entire system prompt, tool definitions, and history — cache reads routinely cover 70–95% of all input tokens. This is frequently a bigger cost lever than switching models down a tier.</div>' +
        '<h2>Ordering: stable → volatile, or you get nothing</h2>' +
        '<p>Requests render in a fixed order — for Anthropic: <code>tools</code> → <code>system</code> → <code>messages</code>. OpenAI/Gemini serialize similarly (instructions/system first, then history). Since matching is prefix-based, the architecture rule writes itself:</p>' +
        '<ol>' +
        '<li><b>Tool definitions</b> — most stable, rendered first. Never generate them per-request; serialize deterministically (sorted keys, sorted tool list). Adding/removing/reordering one tool invalidates the entire cache.</li>' +
        '<li><b>System prompt</b> — frozen bytes. No timestamps, no user names, no feature flags interpolated into it. Dynamic context goes later, in messages.</li>' +
        '<li><b>Conversation history</b> — append-only. Each turn extends the prefix, so the previous turns keep hitting cache. Editing or summarizing earlier turns invalidates everything after the edit point — schedule compaction thoughtfully, because each compaction pays one full-price prefill.</li>' +
        '<li><b>Volatile content last</b> — the current user input, retrieved documents, per-request metadata — after the final cache breakpoint, where its churn costs nothing extra.</li>' +
        '</ol>' +
        '<h2>The silent invalidators (grep for these)</h2>' +
        '<ul>' +
        '<li><code>datetime.now()</code> / "Current date: ..." interpolated into the system prompt — every request is a unique prefix. Fix: inject the date in the latest user message, or truncate to day granularity if it must be early.</li>' +
        '<li><b>Non-deterministic serialization</b> — <code>json.dumps</code> without <code>sort_keys=True</code>, iterating a set/dict for tool lists, Python hash randomization across workers. Bytes differ per process; cache hit rate mysteriously ~0.</li>' +
        '<li><b>Per-user/per-session IDs early in the prompt</b> — you get per-user caches at best (sometimes intentional; usually waste).</li>' +
        '<li><b>A/B tests or feature flags editing the system prompt</b> — every variant is a cold cache. Localize variants after the shared prefix, or accept the write costs knowingly.</li>' +
        '<li><b>Model or sampling-surface changes</b> — caches are model-scoped; a router that bounces traffic between models re-prefills on every bounce.</li>' +
        '</ul>' +
        '<p><b>Verify, don\'t assume:</b> every provider reports it in usage — Anthropic <code>cache_read_input_tokens</code> / <code>cache_creation_input_tokens</code>, OpenAI <code>prompt_tokens_details.cached_tokens</code>, Gemini <code>cachedContentTokenCount</code>. If cached reads are ~0 on repeat traffic, one of the invalidators above is at work; diff the raw rendered request bytes between two calls and find it.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team\'s agent bill dropped 60% in staging after adding cache breakpoints, then showed zero improvement in production. Cause: production ran 12 workers, and the prompt builder embedded <code>Session started: {iso_timestamp_with_microseconds}</code> in the system prompt. Every request from every worker was a unique prefix. One line moved the timestamp into the final user message; cache hit rate went from 0% to 91% overnight. The invoice, not the code review, found the bug — put cache hit rate on a dashboard next to spend.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Do the write-cost math on Anthropic-style explicit caching: 5-min writes cost 1.25×, so a prefix must be read at least once within the TTL to break even; the 1-h TTL writes at 2×, needing ~3 reads. Low-traffic routes (&lt; 1 request per TTL window) lose money on caching. Also: TTLs are short and best-effort everywhere — never architect around a guaranteed hit; treat it as a discount, not a datastore.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your LLM bill doubled after a refactor — what do you check?" The expected answer includes cache hit rate collapse: something started varying the prefix (timestamp, tool order, prompt A/B). Knowing the ordering rule (tools → system → history → volatile), the ~90% read discount, write premiums, and the usage-field names marks you as someone who has actually run this in production.</div>'
    },
    {
      id: 'prompts-as-code',
      title: 'Version prompts like code, ship them like config',
      blurb: 'Repos, reviews, canaries, regression evals — the deployment discipline nobody applies to their most fragile artifact.',
      html: '<h2>Prompts are hot code paths wearing a string costume</h2>' +
        '<p>A prompt change can alter product behavior as much as a code deploy — it can break parsing, change refusal behavior, blow up token spend, or quietly degrade accuracy on a customer segment. Yet in many orgs, prompts live in a Python string literal edited by whoever last had an idea, or worse, in a database column edited from an admin panel with no history. The failure mode is always the same: "the bot got worse last week and nobody knows what changed."</p>' +
        '<p>Minimum viable discipline:</p>' +
        '<ul>' +
        '<li><b>Prompts live in version control</b>, as files (with template variables), next to the code that consumes them. Every change is a diff with an author, a timestamp, and a revert path. A database or prompt-management tool is fine <em>if</em> it gives you the same properties: immutable versions, diffs, audit log, rollback.</li>' +
        '<li><b>Changes go through review</b> — and the review checklist differs from code review: Does this clause conflict with an existing one? Does it break the cached prefix (lesson 4)? Does it change the output contract that downstream parsers depend on? What eval covers the behavior it changes?</li>' +
        '<li><b>Prompts are pinned and identified.</b> Every request logs <code>prompt_id + version</code> (and model + version — a prompt is only meaningful relative to a model). When an incident happens, you can answer "which prompt produced this output?" in one query. Hash the rendered template if you need tamper-evidence.</li>' +
        '<li><b>Deploy decoupled from code</b> where iteration speed matters — prompts-as-config lets you roll a prompt forward or back without a full release train, but only if the config system has the versioning properties above. "Editable in prod without history" is how you get unexplainable Tuesdays.</li>' +
        '</ul>' +
        '<h2>Regression evals: the test suite for prose</h2>' +
        '<p>You cannot review a prompt change into safety — natural language is too underspecified. The only thing that makes prompt changes safe is an eval suite that runs on every change, exactly like tests run on every PR (full treatment in module 11; here is the prompt-specific core):</p>' +
        '<ul>' +
        '<li><b>Golden set:</b> 50–500 real, representative inputs with expected outputs or graded rubrics. Include the incidents: every production failure becomes a permanent eval case, the same way bugs become regression tests.</li>' +
        '<li><b>Cheap checks first:</b> schema validity, required fields, banned phrases, length bounds, refusal-rate deltas — these are fast, deterministic, and catch most breakage. LLM-as-judge grading (module 11) covers the subjective remainder.</li>' +
        '<li><b>Compare against baseline, gate on deltas:</b> the question is never "is v2 good?" but "is v2 worse than v1 anywhere that matters?" Segment the eval (by intent, language, customer tier) — aggregate scores hide localized regressions, and localized regressions are the ones that hit your biggest customer.</li>' +
        '<li><b>Run the eval on model updates too.</b> A vendor checkpoint change is a silent dependency bump for every prompt you own (module 1: model updates are behavior changes). Pin model versions where offered; re-run the suite before adopting new ones.</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> A prompt without an eval is a prompt you cannot safely change — which means it will not be changed, which means it rots. Evals are not QA overhead; they are what makes iteration possible at all.</div>' +
        '<h2>Canary rollout: because evals are necessary but not sufficient</h2>' +
        '<p>Offline evals sample yesterday\'s distribution; production serves today\'s. Ship prompt changes like risky code changes:</p>' +
        '<ol>' +
        '<li><b>Route a slice</b> (1–10%) of traffic to the new prompt version — by request hash, not by time window, so you can compare cohorts under identical traffic.</li>' +
        '<li><b>Watch the operational metrics</b> that move fastest: parse/validation failure rate, refusal rate, output length and token spend per request, latency, tool-call rates, thumbs-down/escalation rate. Task-quality metrics arrive slower — sample canary outputs into an async LLM-judge or human-review queue.</li>' +
        '<li><b>Promote or roll back</b> on predeclared thresholds. Rollback must be one action — this is why versions are immutable and pinned.</li>' +
        '</ol>' +
        '<p>Canarying prompts has one LLM-specific wrinkle: variance is high, so small cohorts need real statistics or you will ship noise and revert wins. For low-traffic routes, prefer longer canary windows or interleaved A/B with paired inputs.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A growth PM tweaked a live prompt in the admin panel on a Friday ("just made the tone friendlier"). The new wording pushed the model past a length threshold; outputs started ending mid-JSON at <code>max_tokens</code>; the parser\'s fallback path silently returned empty recommendations all weekend. Postmortem findings: no version pinned in logs (took a day to find the change), no schema-validity metric on a dashboard, and no canary. Every one of those is a process fix, not a prompting fix.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Eval suites cost real money and time at scale — 300 cases × judge-model grading can run $1–10 per full run on frontier judges (cheaper with a mini-model judge, ~$0.10). Budget for it; it is still orders of magnitude cheaper than one bad prompt reaching 100% of traffic. And keep eval sets out of the prompt repo\'s public history if they contain customer data.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Walk me through how a prompt change reaches production in your team." This question is a seniority X-ray. The strong answer has a lifecycle: branch → eval suite vs baseline → review (including cache and contract impact) → canary with predeclared rollback thresholds → pinned version in logs. If your honest answer is "we edit a string and deploy", say what you\'d build first: pinned versions + a golden-set eval.</div>'
    },
    {
      id: 'anti-patterns',
      title: 'Anti-patterns: begging, bribing, and the mega-prompt',
      blurb: 'The folklore that wastes your tokens and the failure mode that actually hurts you.',
      html: '<h2>Prompt-begging: emphasis inflation</h2>' +
        '<p>The pattern: an instruction gets ignored once, so someone adds "IMPORTANT:". Next month it is "CRITICAL!!! YOU MUST ALWAYS", in caps, repeated in three places. This is <b>emphasis inflation</b>, and it fails for a structural reason: emphasis is relative. When every clause is CRITICAL, the marker carries zero bits. Worse, on 2025-era instruction-tuned models — which follow instructions far more literally than their ancestors — inherited aggressive language causes <em>over</em>-compliance: tools fired when they should not be, hedging refusals on benign inputs, or the model anxiously restating the rule instead of doing the task. Vendor migration guides now explicitly tell you to dial this language back when upgrading.</p>' +
        '<p>What actually fixes "the model ignored my instruction":</p>' +
        '<ul>' +
        '<li><b>Diagnose position and dilution first</b> — is the instruction buried mid-prompt among 60 others? Move it, or delete competitors (see mega-prompts below).</li>' +
        '<li><b>Check for contradictions</b> — half of "ignored" instructions are actually <em>overridden</em> by a conflicting clause or a conflicting few-shot example elsewhere in the prompt.</li>' +
        '<li><b>Convert prose to structure</b> — an output rule that keeps slipping should become a schema constraint (module 5) or a post-hoc validator, not a louder sentence. Constrained decoding cannot be ignored; prose can.</li>' +
        '<li><b>Demonstrate instead of demand</b> — one example of the edge case handled correctly beats three paragraphs of insistence (lesson 2).</li>' +
        '</ul>' +
        '<h2>Threats, tips, and dead grandmas: the folklore economy</h2>' +
        '<p>You have seen the claims: "I\'ll tip $200", "my grandmother will die", "take a deep breath", threatening the model, telling it it\'s an expert with an IQ of 180. Some of these produced measurable effects on specific 2023-era models — "take a deep breath" genuinely emerged from Google\'s own optimization work (OPRO) as a high-scoring phrase for PaLM 2 on math benchmarks. Here is the engineering read:</p>' +
        '<ul>' +
        '<li><b>These are distribution artifacts, not levers.</b> A phrase shifts the conditioning distribution; occasionally that shift correlates with better completions on one model/benchmark pair. Effects are small, inconsistent across tasks, frequently vanish (or invert) on the next model generation, and none replicate reliably on 2025-era instruction-tuned and reasoning models. Follow-up studies (e.g. on politeness and threats) found effects statistically indistinguishable from prompt-rewording noise.</li>' +
        '<li><b>They are unmaintainable.</b> A tip bribe in a production prompt is a dependency on an undocumented quirk of a specific checkpoint. It will silently stop working, and no one will know if it ever worked, because it shipped without an eval.</li>' +
        '<li><b>Opportunity cost is the real damage.</b> An afternoon spent folklore-tuning is an afternoon not spent building the eval that would let you measure anything at all. If a magic phrase does survive your eval across seeds and model versions — fine, keep it, documented as "empirical, revisit on model bump". That has happened approximately never.</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> The reliable levers, in descending order of impact: right model for the task → structured output constraints → task decomposition → examples → clear instructions → wording micro-tweaks. Folklore lives entirely in the last tier while cosplaying as the first.</div>' +
        '<h2>The over-stuffed mega-prompt</h2>' +
        '<p>The most expensive anti-pattern because it compounds: one prompt accretes every team\'s requirements — support policy, sales tone, legal disclaimers, formatting for six output types, 40 few-shot examples, tool instructions for tools that were deprecated in Q2. Symptoms: 5k+ tokens of system prompt, nobody can predict behavior, every fix breaks something else, and instruction-following quality sags because attention over hundreds of constraints is finite (module 1: softmax attention sums to 1 — more clauses means thinner attention per clause; and real instruction-following benchmarks show accuracy dropping as constraint count climbs into the dozens).</p>' +
        '<p>The fixes are all decomposition:</p>' +
        '<ul>' +
        '<li><b>Route, then prompt.</b> A cheap classifier (or rules) picks the intent; each intent gets a small, focused prompt. Ten 600-token prompts beat one 6,000-token prompt on quality, cost, and debuggability — and each can be evaluated independently.</li>' +
        '<li><b>Move knowledge out of the prompt.</b> Policy documents belong in retrieval (module 7), fetched when relevant, not permanently resident in every request\'s context.</li>' +
        '<li><b>Move constraints out of prose.</b> Output shape → schemas. Hard limits → validators and tool allowlists. Each rule you enforce mechanically is a rule the prompt no longer has to carry.</li>' +
        '<li><b>Delete on a schedule.</b> Quarterly prompt review: every clause justifies itself against the eval, or dies. The eval suite (lesson 5) is what makes deletion safe — without it, prompts only ever grow, because removal risk is unbounded.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> An enterprise assistant\'s system prompt hit 11,000 tokens after a year of accretion. Cost aside (it was 70% of every request\'s input bill before caching), the killer was interaction effects: a legal-mandated disclaimer paragraph, added at the top, shifted the model\'s tone enough that the sales team\'s carefully tuned examples stopped landing, which sales "fixed" by adding more examples, which pushed a rarely-hit route past the context budget and truncated its retrieved documents. Three teams debugging each other\'s side effects inside one string. Decomposing into routed per-intent prompts took two weeks and ended the whack-a-mole permanently.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "What prompt engineering advice is overrated?" is increasingly asked to filter cargo-culting. A grounded answer: emotional manipulation and tip/threat folklore (distribution artifacts, don\'t survive model bumps, never shipped with evals), emphasis inflation, and giant do-everything prompts — then pivot to what replaces them: decomposition, schemas, and eval-gated iteration. Naming the OPRO "take a deep breath" origin shows you know where the folklore came from, not just that it\'s wrong.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your support bot\'s system prompt says "NEVER discuss competitor products — CRITICAL". Users pasting competitor ads into complaints get refusals instead of help. After a model upgrade to a 2025-era model, refusals got worse. What is the best fix?',
      options: [
        'Add stronger emphasis: repeat the rule at the top and bottom of the prompt in caps',
        'Replace the aggressive blanket ban with a scoped positive instruction (e.g. "help with the user\'s issue; don\'t volunteer comparisons to competitors") and add the complaint-with-ad case to the regression eval',
        'Lower the temperature so the model is less creative about refusing',
        'Move the rule from the system prompt into each user message'
      ],
      answer: [1],
      explanation: 'Newer instruction-tuned models follow aggressive language more literally, causing over-compliance — the documented fix is dialing back intensity and scoping the rule, plus an eval case so the regression is caught next time. (A) is emphasis inflation: it makes over-triggering worse, not better. (C) temperature changes sampling variance, not instruction interpretation. (D) moves the rule to a lower-privilege channel and repeats its cost every turn — backwards on both axes.'
    },
    {
      text: 'You\'re building a ticket classifier with 12 categories. Zero-shot accuracy is 78%; you have 2,000 labeled historical tickets. Which approach most likely gives the biggest immediate accuracy lift without fine-tuning?',
      options: [
        'Write longer, more detailed descriptions of all 12 categories in the system prompt',
        'Add the same 12 fixed examples (one per category) to every request',
        'Dynamic few-shot: embed the incoming ticket, retrieve the k most similar labeled tickets, and include those as examples',
        'Ask the model to think step by step before classifying'
      ],
      answer: [2],
      explanation: 'Similarity dominates in-context learning — retrieved near-neighbor examples give the model demonstrations of exactly the boundary the current input sits on, and dynamic few-shot consistently beats fixed sets. (A) more taxonomy prose hits the instructions-vs-examples wall: boundaries are easier to show than describe. (B) helps some, but one-per-category fixed shots can\'t cover the boundaries where errors live. (D) CoT helps multi-step reasoning; 12-way classification is usually single-step pattern matching, where CoT does little.'
    },
    {
      text: 'A teammate reorders the five few-shot examples in your extraction prompt while "cleaning up the file" and your eval score moves by 3 points. What does this tell you?',
      options: [
        'The eval is broken, since example order cannot affect a deterministic prompt',
        'Ordering effects (recency bias, position) are real; small deltas from reordering are expected, which is why example order must be version-controlled and why small eval deltas need multiple orderings/seeds before you trust them',
        'The examples must contain errors, otherwise order would not matter',
        'Temperature was set too high during the eval'
      ],
      answer: [1],
      explanation: 'Ordering effects are extensively documented (Lu et al. 2021 and successors) — modern models are more robust but effects persist at the few-point scale, exactly the size of most claimed prompt improvements. So: examples are load-bearing config under version control, and A/B deltas need multi-seed/multi-order runs. (A) the prompt is deterministic bytes, but the model\'s sensitivity to position is real behavior, not eval breakage. (C) correct examples still exert position-dependent pull. (D) even at temperature 0 the reordered prompt conditions a different distribution.'
    },
    {
      text: 'Your team migrates a pipeline from a non-reasoning model to a reasoning model (hidden thinking, effort parameter). Which TWO changes should you make to the prompt and config?',
      options: [
        'Remove the "think step by step using this framework" scaffolding and re-evaluate — scripted CoT can interfere with trained deliberation',
        'Keep the CoT scaffold but double it, since reasoning models reason better',
        'Set and monitor the reasoning-effort/budget parameter per route, and watch reasoning-token spend in usage',
        'Increase temperature to encourage deeper thinking',
        'Move all instructions from the system prompt into the first user message'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'Vendor guidance for reasoning models says stop prompting step-by-step procedures — the model already deliberates, and scripted frameworks can override the trained (better) process; effort becomes a billable, tunable parameter, and hidden reasoning tokens bill as output so they must be monitored. (B) doubles interference and cost. (D) temperature has nothing to do with reasoning depth — and several reasoning endpoints restrict sampling params anyway. (E) discards the privileged instruction channel for no benefit.'
    },
    {
      text: 'A JSON extraction schema has fields in the order {"confidence": ..., "verdict": ..., "evidence": ...}. Accuracy on hard cases is disappointing. What is the mechanistically-grounded first change?',
      options: [
        'Reorder to evidence → verdict → confidence, so generated evidence tokens condition the verdict and the confidence is judged against written analysis',
        'Rename the fields to more professional-sounding terms',
        'Add "be very careful and accurate" to the system prompt',
        'Raise max_tokens so the model has more room to think'
      ],
      answer: [0],
      explanation: 'Generation is sequential: emitting verdict (and confidence!) before any analysis means both are decided with zero written reasoning — the trailing evidence is rationalization. Evidence-first field order is chain-of-thought embedded in the schema, and it is free accuracy. (B) cosmetic. (C) prompt-begging — emphasis doesn\'t create computation. (D) max_tokens caps length; it doesn\'t cause reasoning to happen before the verdict token is emitted.'
    },
    {
      text: 'Your agent resends a 4,000-token system prompt + 2,500 tokens of tool definitions on every request, 2M requests/day. You add Anthropic-style cache breakpoints but the usage logs show cache_read_input_tokens ≈ 0. Which cause is MOST likely?',
      options: [
        'The cache only works for output tokens, not input tokens',
        'Something varies the prefix bytes per request — e.g. a timestamp interpolated into the system prompt or tool definitions serialized in nondeterministic order',
        'The prompt is too long to cache',
        '2M requests/day exceeds the cache\'s rate limit'
      ],
      answer: [1],
      explanation: 'Caching is an exact prefix-byte match; the classic silent invalidators are timestamps/UUIDs in the system prompt and unsorted JSON serialization of tools (which render first). Diff two rendered requests to find the differing byte. (A) backwards — prompt caching is precisely about input/prefill. (C) long prompts are the best candidates; minimums exist, not maximums of this scale. (D) high traffic makes hits MORE likely (TTL refresh), and no such rate limit semantics exist.'
    },
    {
      text: 'On a low-traffic route (~1 request every 20 minutes), you enable Anthropic prompt caching with the default 5-minute TTL on a 3k-token prefix. What is the economic result?',
      options: [
        'You save ~90% on that prefix\'s input cost',
        'You lose money: every request pays the 1.25× write premium and the entry expires unread before the next request arrives',
        'Nothing changes because caching is free',
        'The provider automatically extends the TTL until the next request'
      ],
      answer: [1],
      explanation: 'Write costs are real (1.25× for 5-min TTL, 2× for 1-hour): a cache entry must be read at least once within the TTL to break even. At one request per 20 minutes with a 5-minute TTL, every write expires unread — you pay 1.25× forever. Options: 1-hour TTL (needs ~3 reads to pay off — still not enough here), or skip caching on this route. (A) requires hits. (C) explicit caching bills write premiums. (D) TTLs refresh on HITS, not by provider generosity.'
    },
    {
      text: 'You want to add "Current date: 2026-07-23, user: alice@example.com, session: 8f3a..." to prompts for better answers, without destroying cache hit rate. Where does it go?',
      options: [
        'At the top of the system prompt so the model sees it first',
        'Interpolated into each tool description',
        'In the latest user message (or any position after the final cache breakpoint), keeping system prompt and tools byte-stable',
        'Nowhere — dynamic data can never be sent to a cached prompt'
      ],
      answer: [2],
      explanation: 'Prefix caching means volatile bytes belong after the stable prefix: system prompt and tools stay frozen, per-request context rides in the message section after the last breakpoint, costing nothing extra. (A) is the No. 1 silent invalidator — a unique prefix per request/user/second. (B) tools render first; even worse. (D) false — the whole point of the stable→volatile ordering is that dynamic data and caching coexist.'
    },
    {
      text: 'Which TWO properties must your prompt storage system have before "prompts as config, editable without a deploy" is safe?',
      options: [
        'Immutable versions with an audit log, and the prompt version pinned into every request\'s logs',
        'A regression eval + canary path that gates changes before they hit 100% of traffic',
        'A WYSIWYG editor so non-engineers can make changes quickly',
        'Automatic synonym expansion to make prompts more robust',
        'Encryption of prompts at rest'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'Decoupling prompt deploys from code deploys is fine ONLY with the same safety rails code has: immutable versioning + per-request pinning (so incidents are attributable and rollback is one action) and eval + canary gating (so changes are validated before full traffic). (C) an editor without those rails is exactly how unexplainable regressions ship — the Friday-admin-panel war story. (D) not a thing you want; uncontrolled rewording is the failure mode. (E) fine practice, irrelevant to change safety.'
    },
    {
      text: 'Your golden-set eval shows prompt v2 is +2% overall vs v1. The canary shows parse-failure rate flat, but refusal rate up 3× on non-English traffic. What should you conclude?',
      options: [
        'Ship it — overall accuracy improved',
        'The canary is misconfigured, since the eval showed improvement',
        'Aggregate metrics hid a segment regression; your eval set under-represents non-English inputs — block the rollout, add non-English cases to the golden set, and fix before promoting',
        'Refusals are a model-safety issue, unrelated to the prompt change'
      ],
      answer: [2],
      explanation: 'This is the canonical aggregate-vs-segment trap: offline evals sample a distribution, and a +2% average happily coexists with a 3× regression on a slice the eval barely covers. The canary did its job. (A) ships a localized regression to the users least able to complain in your dashboards. (B) production traffic is the ground truth; disagreement means the EVAL is incomplete, not the canary. (D) prompt wording measurably shifts refusal behavior — the correlation with the rollout makes the prompt the prime suspect.'
    },
    {
      text: 'A blog post claims adding "I will tip you $200" improves output quality, with benchmark screenshots from an older model. An engineer wants to add it to your production prompt. What is the correct engineering response?',
      options: [
        'Add it — the cost of a few extra tokens is trivial compared to potential gains',
        'Treat it as an unverified distribution artifact: such effects are small, model-specific, and rarely survive model updates; only adopt it if it wins your own eval across seeds, and document it as empirical-revisit-on-model-bump',
        'Reject it because sending fake payment promises to an API violates provider terms of service',
        'Add it but only for premium-tier customers'
      ],
      answer: [1],
      explanation: 'Folklore phrases are conditioning artifacts: occasionally measurable on one checkpoint/benchmark, inconsistent across tasks, and prone to vanish on the next model. The eval is the only arbiter — and in practice these effects don\'t replicate on modern instruction-tuned models. (A) the token cost is trivial; the maintenance cost of undocumented checkpoint-specific quirks is not. (C) it\'s not a ToS issue; that\'s a made-up objection. (D) is silly A/B-by-revenue with no measurement.'
    },
    {
      text: 'An 8,000-token do-everything system prompt handles support, sales, and onboarding. Fixes for one flow keep breaking another, and instruction-following feels flaky overall. What is the highest-leverage structural fix?',
      options: [
        'Rewrite the prompt more clearly, keeping it unified for consistency',
        'Split by intent: a cheap router selects among small, focused per-intent prompts, each with its own eval; move policy knowledge to retrieval and output rules into schemas/validators',
        'Switch to a model with a larger context window so the prompt fits more comfortably',
        'Add a table of contents at the top of the prompt so the model can navigate it'
      ],
      answer: [1],
      explanation: 'Mega-prompts fail structurally: attention over hundreds of constraints is finite, unrelated teams\' clauses interact, and one blob can\'t be safely evolved. Decomposition (route → focused prompts, knowledge → RAG, constraints → schemas) fixes quality, cost, and debuggability simultaneously. (A) clarity doesn\'t fix constraint dilution or cross-team interaction effects. (C) the window isn\'t the binding limit — instruction-following degrades with constraint COUNT well before context overflows. (D) models don\'t "navigate" prompts; every token conditions everything.'
    },
    {
      text: 'For which task is explicit prompted chain-of-thought still clearly the right call in early 2026?',
      options: [
        'A frontier reasoning model doing competition math with thinking enabled',
        'A $0.10-0.25/Mtok mini-model doing multi-step eligibility checks, where prompted CoT lifts it past the quality bar at a fraction of a reasoning model\'s cost',
        'Single-label sentiment classification on a frontier model',
        'Retrieving a fact the model already knows'
      ],
      answer: [1],
      explanation: 'Prompted CoT survives exactly where trained reasoning isn\'t present or isn\'t affordable: cheap non-reasoning models on compositional tasks — often the cost-optimal configuration. (A) redundant and potentially harmful: the model already deliberates; scripted CoT can interfere. (C) single-step pattern matching gains ~nothing from CoT and sometimes loses. (D) recall isn\'t compositional; no intermediate state helps.'
    },
    {
      text: 'Which THREE belong in a prompt-change review checklist that would NOT appear in a normal code review?',
      options: [
        'Does the change alter bytes in the cached prefix (system prompt, tool definitions), invalidating the cache fleet-wide?',
        'Does the new clause contradict an existing instruction or few-shot example elsewhere in the prompt?',
        'Does the diff have consistent indentation?',
        'Which golden-set eval cases cover the behavior being changed, and did the suite run against the pinned target model?',
        'Does the commit message follow the team convention?'
      ],
      answer: [0, 1, 3],
      multi: true,
      explanation: 'Prompt review has LLM-specific concerns: cache-prefix impact (a one-word system-prompt edit re-prefills every request at full price until the cache rewarms), intra-prompt contradictions (models resolve conflicts unpredictably, and examples override prose), and eval coverage against a pinned model (prompts are only meaningful relative to a model). (C) and (E) are generic hygiene that any review already covers — fine, but not the prompt-specific checklist.'
    }
  ],
  flashcards: [
    { id: 'fc-contract', front: 'What does "system prompt as API contract" require in practice?', back: 'Every clause has an owner + reason; structured sections not prose; edge-case behavior specified; output surface defined; the whole thing versioned, reviewed, and eval-gated like an interface with consumers.' },
    { id: 'fc-hierarchy', front: 'What is the instruction hierarchy, and what is it NOT?', back: 'Trained preference: platform > system/developer > user > tool output. It is a probability shift from post-training — useful, but NOT a security boundary. Real limits get enforced outside the model.' },
    { id: 'fc-pos-neg', front: 'Why do positive instructions beat negations?', back: 'Negations force the model to represent the forbidden behavior in order to avoid it; under distribution shift it sometimes produces it. "Respond in the user\'s language" > "don\'t respond in English".' },
    { id: 'fc-fewshot-when', front: 'Instructions vs examples — the decision rule?', back: 'Instructions communicate intent (scope, policy — easy to say, hard to show). Examples communicate distribution (format, boundary cases, tone, calibration — easy to show, hard to say). When they conflict, models tend to follow the examples.' },
    { id: 'fc-ordering-bias', front: 'Name the three main few-shot selection/ordering biases.', back: 'Recency (last examples pull hardest), majority-label (unbalanced shot labels shift the prior), similarity (examples resembling the input dominate — the basis of dynamic few-shot).' },
    { id: 'fc-dynamic-fewshot', front: 'What is dynamic few-shot?', back: 'Per-request retrieval of the k nearest labeled examples (via embeddings) from an example bank — RAG for demonstrations. Usually beats any fixed example set; costs cache hits since the prefix now varies.' },
    { id: 'fc-fewshot-plateau', front: 'How many few-shot examples before diminishing returns?', back: 'Typically 3–8; past that you pay per-request token tax for little gain. At many-shot scale, compare against fine-tuning: shots bill on every request forever.' },
    { id: 'fc-cot-mech', front: 'Why does chain-of-thought work, mechanistically?', back: 'Per-token compute is fixed; emitted intermediate tokens are external working memory that later tokens condition on — extending serial computation depth. The incantation never mattered; the written intermediate state does.' },
    { id: 'fc-cot-obsolete', front: 'When is prompted CoT obsolete, and what replaced it?', back: 'On reasoning models (o-series, R1, extended/adaptive thinking) — they deliberate via RL-trained hidden reasoning; scripted CoT is redundant and can interfere. Replaced by effort/budget parameters. CoT survives on cheap non-reasoning models and for auditable/business-logic steps.' },
    { id: 'fc-reasoning-cost', front: 'How do reasoning tokens hit your bill and latency?', back: 'Hidden thinking bills at OUTPUT-token prices ($10–75/Mtok frontier, early 2026) and adds seconds-to-minutes of latency. Monitor the reasoning-token usage field; route effort by task difficulty, not one global setting.' },
    { id: 'fc-cache-what', front: 'What does prompt caching actually store and match on?', back: 'The computed KV cache for a prompt prefix, matched on EXACT bytes from position 0. First differing byte ends the match; everything after is full price. No semantic or reordering tolerance.' },
    { id: 'fc-cache-order', front: 'The cache-friendly request ordering?', back: 'Most stable first: tool definitions → frozen system prompt → append-only history → volatile per-request content last (after the final breakpoint). Render order for Anthropic is tools → system → messages.' },
    { id: 'fc-cache-econ', front: 'Prompt caching economics (early 2026)?', back: 'Reads ~0.1× input (Anthropic; OpenAI/Gemini ~0.25–0.5×, GPT-5.x ~0.1×). Anthropic writes cost 1.25× (5-min TTL) or 2× (1-h). Break-even needs ≥1 read (5-min) / ~3 reads (1-h) within TTL — low-traffic routes can lose money.' },
    { id: 'fc-cache-invalidators', front: 'Name four silent cache invalidators.', back: 'Timestamps/UUIDs in the system prompt; nondeterministic serialization (unsorted JSON, set iteration); per-user IDs early in the prefix; A/B flags or tool-list changes editing prefix bytes. Verify via cache-read fields in usage.' },
    { id: 'fc-prompt-vc', front: 'Minimum viable prompt versioning discipline?', back: 'Prompts in version control (or equivalent immutable store), reviewed diffs, prompt_id+version+model pinned into every request log, one-action rollback. "Editable in prod without history" = unexplainable regressions.' },
    { id: 'fc-regression-eval', front: 'What makes a prompt change safe to ship?', back: 'A golden-set regression eval (real inputs incl. past incidents), cheap deterministic checks first (schema, refusal rate, length), delta-vs-baseline gating segmented by slice, re-run on model updates too. No eval = prompt you can\'t safely change.' },
    { id: 'fc-canary', front: 'Prompt canary: what do you watch and why not just trust the eval?', back: 'Offline evals sample yesterday\'s distribution. Canary 1–10% by request hash; watch parse-failure rate, refusal rate, token spend, latency, tool-call rate; promote/rollback on predeclared thresholds. High output variance → need real stats on small cohorts.' },
    { id: 'fc-begging', front: 'Why does emphasis inflation ("CRITICAL!! MUST") fail?', back: 'Emphasis is relative — when everything is critical, the marker carries zero bits. On modern literal-following models it causes OVER-compliance (over-triggering, over-refusal). Fix root causes: position, contradictions, structure, examples, mechanical enforcement.' },
    { id: 'fc-folklore', front: 'The engineering verdict on tips/threats/"take a deep breath"?', back: 'Distribution artifacts: occasionally measurable on one 2023-era checkpoint (OPRO found "take a deep breath" for PaLM 2), small, task-inconsistent, and they don\'t survive model updates. Only adopt what wins YOUR eval across seeds; document as empirical.' },
    { id: 'fc-megaprompt', front: 'Mega-prompt symptoms and the fix?', back: 'Symptoms: 5k+ token accreted prompt, cross-team interaction bugs, flaky instruction-following (attention dilution over dozens of constraints). Fix: route by intent to small prompts, knowledge → RAG, constraints → schemas/validators, scheduled deletion guarded by evals.' }
  ],
  lab: {
    title: 'Measure what you\'ve been guessing: caching, shots, and field order',
    intro: '<p>Three experiments that turn this module\'s claims into numbers you generated yourself: watch prompt caching appear and disappear in the usage fields, A/B few-shot against instructions on a real mini-eval, and measure the verdict-first vs evidence-last schema effect.</p><p><b>Needs:</b> <code>python3</code>, an OpenAI-compatible API key (OpenAI shown; any provider exposing cached-token usage works — or Ollama locally for $0, though it won\'t report cache fields).</p>',
    steps: [
      {
        title: 'Watch the cache work — then break it',
        html: '<pre><code>pip install openai\n\npython3 - &lt;&lt;\'EOF\'\nimport time\nfrom openai import OpenAI\nc = OpenAI()\n\n# A stable prefix comfortably over the 1024-token minimum\nSYSTEM = "You are a support assistant for AcmeDB. " + \\\n         "Policy clause %d: respond helpfully and cite the manual. " * 120\n\ndef ask(system, q):\n    r = c.chat.completions.create(model="gpt-4o-mini",\n        messages=[{"role":"system","content":system},\n                  {"role":"user","content":q}], max_tokens=20)\n    d = r.usage.prompt_tokens_details\n    print(f"prompt={r.usage.prompt_tokens:5d}  cached={d.cached_tokens:5d}")\n\nSYS = SYSTEM % tuple(range(120)) if "%d" in SYSTEM else SYSTEM\nask(SYS, "How do I rotate credentials?")   # cold: cached=0\ntime.sleep(2)\nask(SYS, "How do I export a backup?")      # warm: cached &gt; 0\n\n# Now the classic bug: a timestamp in the system prompt\nimport datetime\nfor i in range(2):\n    stamped = f"Now: {datetime.datetime.now().isoformat()}\\n" + SYS\n    ask(stamped, "How do I export a backup?")   # cached=0 every time\nEOF</code></pre>' +
          '<p>The second call should show a large <code>cached_tokens</code> value; the timestamped calls show ~0 forever. You have just reproduced (and can now recognize) the most common caching bug in production. If you have an Anthropic key, repeat with explicit <code>cache_control</code> breakpoints and inspect <code>cache_creation_input_tokens</code> / <code>cache_read_input_tokens</code>.</p>'
      },
      {
        title: 'Few-shot vs instructions, measured not vibed',
        html: '<p>Build a 20-case mini-eval for a boundary-heavy task and compare three prompts: instructions-only, instructions + 5 fixed shots, and shots-only.</p>' +
          '<pre><code>python3 - &lt;&lt;\'EOF\'\nfrom openai import OpenAI\nc = OpenAI()\n\n# Task: label feedback as bug / feature_request / praise\nCASES = [\n  ("App crashes when I tap export", "bug"),\n  ("Would love dark mode someday", "feature_request"),\n  ("Export is broken since the update", "bug"),\n  ("Great app, works perfectly!", "praise"),\n  ("It should remember my filters", "feature_request"),\n  ("Login loops forever on iOS 18", "bug"),\n  ("Five stars, the sync is instant", "praise"),\n  ("Why is there no CSV export??", "feature_request"),\n  ("CSV export produces empty files", "bug"),\n  ("Honestly better than I expected", "praise"),\n]  # extend to 20 with your own boundary cases\n\nSHOTS = ("Feedback: The search is useless since v2 -&gt; bug\\n"\n         "Feedback: search could support regex -&gt; feature_request\\n"\n         "Feedback: search is lightning fast now -&gt; praise\\n")\n\nPROMPTS = {\n  "instructions": "Label as bug, feature_request, or praise. A bug describes broken existing behavior; a feature_request asks for new behavior. Reply with the label only.",\n  "inst+shots": "Label as bug, feature_request, or praise. Reply with the label only.\\n" + SHOTS,\n  "shots_only": SHOTS + "Reply with the label only.",\n}\n\nfor name, sys in PROMPTS.items():\n    hits = 0\n    for text, gold in CASES:\n        r = c.chat.completions.create(model="gpt-4o-mini", temperature=0,\n            messages=[{"role":"system","content":sys},\n                      {"role":"user","content":"Feedback: "+text}], max_tokens=8)\n        hits += gold in r.choices[0].message.content.lower()\n    print(f"{name:14s} {hits}/{len(CASES)}")\nEOF</code></pre>' +
          '<p>Then reorder the shots and rerun — you will usually see the score wobble by a case or two, which is the ordering-effect lesson in miniature. Any conclusion you draw from a 20-case eval needs that wobble in mind.</p>'
      },
      {
        title: 'Schema field order as chain-of-thought',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json\nfrom openai import OpenAI\nc = OpenAI()\n\nCASE = ("Customer bought a $40 blender 100 days ago. Policy: refunds within 90 days, "\n        "store credit within 120 days for members. Customer is a member and wants a refund. "\n        "What do they qualify for?")\n\nfor order in ("verdict_first", "evidence_first"):\n    if order == "verdict_first":\n        fmt = \'{"verdict": "...", "evidence": "..."}\'\n    else:\n        fmt = \'{"evidence": "...", "verdict": "..."}\'\n    r = c.chat.completions.create(model="gpt-4o-mini", temperature=0,\n        messages=[{"role":"system","content":"Answer ONLY with JSON: " + fmt},\n                  {"role":"user","content":CASE}], max_tokens=200)\n    print(order, "-&gt;", r.choices[0].message.content, "\\n")\nEOF</code></pre>' +
          '<p>Run it 5× per order on a few tricky policy cases of your own. Evidence-first typically resolves the 90-vs-120-day trap more reliably because the constraint gets written down before the verdict token is committed. This is the cheapest accuracy improvement in this entire module.</p>'
      }
    ],
    costNote: 'Worst case across all three experiments on gpt-4o-mini: under $0.40 (the caching step sends a few ~2k-token prompts; the evals are ~70 short calls). Nothing persistent is created — no cleanup needed. On Ollama locally: $0, but skip step 1 (no cache-usage fields).'
  }
});
