COURSE.register({
  id: 'm09-agents-loop',
  track: 'core',
  order: 9,
  title: 'Agents I: the loop',
  short: 'Agents: the loop',
  tagline: 'An agent is a while-loop around an LLM and some tools — everything else is engineering the loop so it stops, recovers, and doesn\'t bankrupt you.',
  minutes: 115,
  lessons: [
    {
      id: 'the-loop',
      title: 'The loop, stripped bare',
      blurb: 'Perceive → plan → act → observe is ~30 lines of Python. See it before any framework obscures it.',
      html: '<h2>De-mystifying the word "agent"</h2>' +
        '<p>Strip the marketing and an agent is this: <b>an LLM called in a loop, where the model\'s output can trigger tool executions whose results are appended to the context before the next call.</b> The model perceives (reads the context), plans (emits reasoning and/or a tool call), acts (your code executes the tool), and observes (the result lands in the context). Repeat until the model emits a final answer instead of a tool call — or until <em>you</em> stop it. That\'s the whole thing. Chatbots are the loop with zero tool iterations; workflows are the loop with the branching decided by your code instead of the model.</p>' +
        '<p>The load-bearing shift versus everything in modules 1–8: <b>the model now chooses the control flow.</b> In a pipeline you decide "retrieve, then summarize, then format." In an agent the model decides what to do next, every step, based on what it just observed. That buys you flexibility on open-ended tasks and costs you predictability, bounded latency, and bounded spend. The rest of this module is about paying that cost deliberately instead of accidentally.</p>' +
        '<h2>The ~30-line no-framework agent</h2>' +
        '<p>Here is a complete, working agent — one tool, native tool-calling API, no framework. Read it until it\'s boring:</p>' +
        '<pre><code>import json, subprocess\nfrom openai import OpenAI\nclient = OpenAI()\n\ndef run_shell(cmd):\n    r = subprocess.run(cmd, shell=True, capture_output=True,\n                       text=True, timeout=30, cwd="./workdir")\n    return (r.stdout + r.stderr)[:4000] or "(no output)"\n\nTOOLS = [{"type": "function", "function": {\n    "name": "run_shell",\n    "description": "Run a shell command in ./workdir. Returns stdout+stderr, "\n                   "truncated to 4000 chars. Times out after 30s.",\n    "parameters": {"type": "object",\n        "properties": {"cmd": {"type": "string"}}, "required": ["cmd"]}}}]\n\nmessages = [\n  {"role": "system", "content": "Solve the task using run_shell. "\n     "When done, reply in plain text with a summary."},\n  {"role": "user", "content": "Find the 3 largest files under ./workdir"}]\n\nfor step in range(15):            # step budget — the loop will NOT stop itself\n    r = client.chat.completions.create(model="gpt-5.2", # any tool-calling model\n                                       messages=messages, tools=TOOLS)\n    msg = r.choices[0].message\n    messages.append(msg)\n    if not msg.tool_calls:        # plain text = the model says it\'s done\n        print(msg.content); break\n    for tc in msg.tool_calls:\n        try:\n            out = run_shell(**json.loads(tc.function.arguments))\n        except Exception as e:\n            out = "TOOL ERROR: " + repr(e)   # errors go BACK INTO CONTEXT\n        messages.append({"role": "tool", "tool_call_id": tc.id, "content": out})\nelse:\n    print("Stopped: step budget exhausted")</code></pre>' +
        '<p>Every production agent — coding assistants, browser agents, support triagers — is this skeleton plus hardening. When a framework hides the loop from you, you lose the ability to reason about the four places things go wrong: what goes <em>into</em> context, what the model may <em>do</em>, what comes <em>back</em>, and when it <em>ends</em>.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> The transcript (the <code>messages</code> array) is the agent\'s entire brain. There is no other state. Every decision the model makes on step <em>n</em> is a function of exactly what you allowed to accumulate in that array during steps 1…n−1. Debugging an agent = reading its transcript.</div>' +
        '<h2>Three properties of the loop you must internalize</h2>' +
        '<ul>' +
        '<li><b>Cost compounds.</b> The transcript grows every step, and each API call resends all of it. A 20-step run doesn\'t cost 20× one call — it costs roughly the sum 1+2+…+20 in input tokens. With verbose tool outputs, step 20 can carry 50k+ tokens of history. Prompt caching (module 3) makes this survivable; it does not make it free.</li>' +
        '<li><b>Errors compound too.</b> A wrong assumption at step 3 conditions every later step (autoregression at the trajectory level, not just the token level). Agents rarely fail loudly; they fail by confidently building on a bad observation.</li>' +
        '<li><b>The model never "sees" the world — only tool output text.</b> If your tool returns an empty string on failure, the model observes "the command succeeded with no output" and marches on. Perception quality is bounded by tool-output quality; that\'s lesson 4.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team shipped a file-organizing agent whose <code>move_file</code> tool returned nothing on success <em>and</em> nothing when the destination didn\'t exist (the exception was swallowed). The model interpreted silence as success, "moved" 300 files into the void, and cheerfully reported completion. First rule of agent tools: every execution returns an explicit, informative result string — success or failure.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Design an agent" questions are usually a test of whether you know it\'s a loop. Whiteboard the skeleton above, then spend your time on the hard parts interviewers actually score: stop conditions, budgets, error recovery, and why the transcript is the state. Naming a framework is worth nothing; explaining the loop is worth everything.</div>'
    },
    {
      id: 'react-and-descendants',
      title: 'ReAct and its descendants',
      blurb: 'Where the pattern came from, what survived, and what native tool calling plus reasoning models changed.',
      html: '<h2>ReAct: the paper that named the loop</h2>' +
        '<p>ReAct (Yao et al., 2022 — "Reasoning and Acting") formalized the interleaving: the model emits a <b>Thought</b> (free-text reasoning about what to do), then an <b>Action</b> (a tool invocation in a parseable format), then your harness supplies an <b>Observation</b>, and the cycle repeats. The insight wasn\'t the loop — it was that forcing an explicit reasoning step <em>before</em> each action measurably beat both act-only agents (which flail) and reason-only chain-of-thought (which hallucinates facts it could have looked up). Reasoning grounds acting; acting grounds reasoning.</p>' +
        '<p>Original ReAct was a prompt-parsing hack: you begged the model to follow a <code>Thought:/Action:/Action Input:</code> text format and regex-parsed the output. It broke constantly — malformed actions, invented tool names, the model narrating instead of acting. If you\'ve seen early LangChain traces full of "Could not parse LLM output," that was ReAct-by-regex failing.</p>' +
        '<h2>What replaced the text protocol</h2>' +
        '<ul>' +
        '<li><b>Native tool calling (2023→).</b> Providers fine-tuned models to emit tool invocations as structured JSON in a dedicated channel (<code>tool_calls</code>), with constrained decoding making arguments schema-valid. Parsing failures dropped from a top-3 failure mode to a rounding error. As of early 2026, every serious model does this; if you\'re regex-parsing actions out of prose, you\'re doing it wrong.</li>' +
        '<li><b>Parallel tool calls.</b> Models can emit several independent calls in one step (read three files at once). Free latency win when actions don\'t depend on each other — but your harness must execute them and return <em>all</em> results before the next model call.</li>' +
        '<li><b>Reasoning models absorbed the "Thought" step.</b> o-series, Claude with extended thinking, DeepSeek-R1-class models deliberate in a private token budget before each action. The Thought didn\'t disappear — it moved out of the visible transcript and got RL-trained instead of prompted. Practical effect: you no longer need "think step by step before choosing a tool" scaffolding; you pay for it in thinking tokens instead.</li>' +
        '<li><b>Interleaved thinking between tool results.</b> As of early 2026 the strongest agent configurations let the model reason privately after each observation ("that grep returned nothing — my hypothesis about the bug location is wrong") rather than only at the start. This is where much of the 2024→2026 jump in agentic benchmarks (SWE-bench Verified going from ~20% to 70%+ resolved) came from: better models, yes, but specifically models RL-trained on long tool-use trajectories.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Tool-calling models are trained with the tool schemas rendered into the context (a hidden system-prompt section) and the invocation emitted as tokens like any other text — there is no separate "function-calling engine." That\'s why tool descriptions behave like prompts (they are), why too many tools degrade selection (attention over a huge schema block), and why a model can still call a tool that doesn\'t exist under pressure: it\'s sampling, not dispatching.</div>' +
        '<h2>Descendants worth knowing by name</h2>' +
        '<table><tr><th>Pattern</th><th>Idea</th><th>Where it survives in 2026</th></tr>' +
        '<tr><td>ReAct</td><td>Interleave thought → action → observation</td><td>The default loop everywhere; "Thought" now native reasoning</td></tr>' +
        '<tr><td>Reflexion</td><td>After a failed episode, generate a self-critique and retry with it in context</td><td>Retry-with-lessons-learned in coding agents; eval-driven retries</td></tr>' +
        '<tr><td>Plan-and-Execute</td><td>Plan the whole task upfront, then execute steps</td><td>Todo-list scaffolds in coding agents; orchestrators (module 10)</td></tr>' +
        '<tr><td>Tree-of-Thoughts / MCTS agents</td><td>Branch and search over action sequences</td><td>Mostly research; too expensive for production loops</td></tr>' +
        '<tr><td>Code-as-action (CodeAct)</td><td>Emit executable code instead of JSON tool calls</td><td>Growing fast — module 10 covers it</td></tr></table>' +
        '<p>The pattern graveyard is instructive: anything that multiplied model calls per step (tree search, debate, N-way sampling per action) mostly lost to "one stronger model, one trajectory, better tools." Compute spent on a smarter base model beat compute spent on clever orchestration — a bitter-lesson rhyme that has held from 2023 through early 2026.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> Teams still ship ReAct-style prompt scaffolds ("You must respond in Thought/Action format...") on top of models with native tool calling. Result: the model sometimes emits the text format, sometimes the native format, and the harness handles only one. Symptom: intermittent "agent did nothing" runs that vanish when you delete the legacy scaffold and trust the API\'s tool-calling contract.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Expect "What is ReAct and is it still relevant?" Strong answer: the interleaving insight survives — reasoning grounds acting — but the text protocol is dead; native tool calling handles structure, and reasoning models internalized the Thought step via RL on agentic trajectories. Bonus: mention that observation quality now matters more than thought prompting.</div>'
    },
    {
      id: 'planning',
      title: 'Planning: upfront, interleaved, and the drift problem',
      blurb: 'When to make the model write a plan, when plans rot, and how to re-anchor a drifting agent.',
      html: '<h2>Two planning modes</h2>' +
        '<p><b>Upfront planning</b>: the model decomposes the task into steps before acting (as a numbered plan in the transcript, or a structured todo list the harness tracks). <b>Interleaved planning</b>: the model just decides the next action each step, with no explicit committed plan. Neither is "correct" — they trade off along a predictable axis:</p>' +
        '<table><tr><th></th><th>Upfront plan</th><th>Interleaved (plan-as-you-go)</th></tr>' +
        '<tr><td>Best for</td><td>Multi-part deliverables with known shape (migrate 12 files, write report with 5 sections)</td><td>Diagnosis/exploration where step 2 depends on what step 1 reveals</td></tr>' +
        '<tr><td>Failure mode</td><td>Plan rot: world diverges from plan, model follows the plan anyway</td><td>Wandering: local greediness, repeated work, lost track of the goal</td></tr>' +
        '<tr><td>Reviewability</td><td>High — a human can approve the plan before any action runs</td><td>Low — intent is only visible one action at a time</td></tr>' +
        '<tr><td>Token cost</td><td>Plan occupies context every step</td><td>Cheaper until wandering makes it dearer</td></tr></table>' +
        '<p>The production pattern that wins most often, as of early 2026: <b>plan upfront, replan on evidence.</b> The model writes a short plan, the harness keeps it pinned (re-injected near the end of context, where attention is strong), each step is marked done/failed, and specific triggers force a replan rather than trusting the model to notice.</p>' +
        '<h2>Plan drift — the signature agent failure</h2>' +
        '<p>Drift is the gap between the plan in the transcript and what the agent is actually doing. It comes in two mirrored forms:</p>' +
        '<ul>' +
        '<li><b>Stale-plan drift:</b> the plan said "fix the failing test in auth.py," step 4 revealed the real bug is in the session store, but the plan text is still sitting in context steering the model back toward auth.py. Old plans are anchors — literally, in the attention sense. The confident, well-formatted plan you asked for at step 1 keeps getting attended to at step 19.</li>' +
        '<li><b>Goal drift:</b> the model abandons the plan silently — fixes an unrelated lint error it noticed, refactors code it was told not to touch, or narrows "migrate all handlers" to the three it found first. Long transcripts make the original instruction a smaller and smaller fraction of the context, and recency wins.</li>' +
        '</ul>' +
        '<p>Concrete mitigations, in rough order of value per line of code:</p>' +
        '<ol>' +
        '<li><b>Re-inject the goal.</b> Append a system reminder ("Original task: … Current plan status: …") every N steps or every step. Cheap and disproportionately effective — you\'re fighting recency bias with recency.</li>' +
        '<li><b>Make the plan a live artifact, not prose.</b> A todo structure the model must update via a tool (mark item done, add item, remove item) forces reconciliation between plan and reality each step, and gives your harness a machine-readable progress signal — "no todo state change in 6 steps" is a beautiful stuck-detector.</li>' +
        '<li><b>Explicit replan triggers.</b> On tool failure ×2, on a surprising observation (the model says so), or every K steps, prompt: "Given what you\'ve learned, is the plan still valid? Rewrite it if not." Models are decent at replanning when asked and terrible at deciding to replan unprompted.</li>' +
        '<li><b>Checkpoint against the acceptance criteria.</b> Before allowing "done," require the model to check its work against the original criteria verbatim — not its own drifted restatement of them.</li>' +
        '</ol>' +
        '<div class="callout note"><span class="co-title">Key idea</span> A plan is cache, and caches go stale. Treat the plan as data with an invalidation policy (replan triggers), not as a promise the model made. The agents that feel "relentless" in a good way are the ones whose harness keeps reconciling plan against observed reality.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A data-migration agent was given a 40-item upfront plan. Item 7 failed; the model noted it, continued, and by item 30 the transcript was so long that the failure had scrolled out of effective attention. Final report: "All items migrated successfully." The fix wasn\'t a smarter model — it was harness-tracked plan state with a hard rule: items marked failed must appear in the final report. Don\'t store critical state only in prose.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Planning quality degrades with plan length faster than you\'d hope: models handle 5–10 step plans well, but 30+ step plans reliably develop skipped items and hallucinated completions. If the task genuinely needs 30+ steps, that\'s a signal to chunk it — run the loop per work-item with fresh context (see lesson 6), with an outer orchestrator (module 10) owning the item list instead of one heroic transcript.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your agent starts strong and goes off the rails after ~15 steps — diagnose." They want: transcript growth → original instructions lose attention share → recency dominates → drift; mitigations: goal re-injection, harness-owned plan state, replan triggers, chunking into fresh contexts. Saying "use a bigger context window" misses the point — attention dilution, not capacity, is the binding constraint.</div>'
    },
    {
      id: 'tool-design',
      title: 'Tool design: the API docs are the product',
      blurb: 'Names, descriptions, and error messages are prompts. Write them like the model\'s only onboarding doc — because they are.',
      html: '<h2>Your tool schema is a prompt</h2>' +
        '<p>The model chooses tools by reading their names, descriptions, and parameter schemas — rendered into context as text. There is no other channel. That means tool design is prompt engineering with a type system, and the quality bar is: <b>could a competent contractor, given only your tool descriptions and no source code, use these tools correctly on the first try?</b> If not, neither can the model.</p>' +
        '<p>Rules that hold up in production:</p>' +
        '<ul>' +
        '<li><b>Names encode intent, not implementation.</b> <code>search_customer_orders</code> beats <code>query_db_v2</code>. The model pattern-matches on names before it reads descriptions; a misleading name loses fights against a correct description.</li>' +
        '<li><b>Descriptions carry the contract:</b> what it does, what it returns (shape, units, truncation), when to use it <em>versus its neighbors</em>, and known sharp edges. "Search product docs. Prefer this over web_search for anything about our own product. Returns top 5 chunks with source URLs; returns \'NO_RESULTS\' if nothing scores above threshold." That last sentence prevents an entire class of loops.</li>' +
        '<li><b>Disambiguate overlapping tools explicitly, in both descriptions.</b> If you offer <code>search_docs</code> and <code>web_search</code>, each description should say when to use the other. Overlap without guidance is the #1 cause of "the model used the wrong tool" tickets.</li>' +
        '<li><b>Fewer, higher-level tools beat many primitives.</b> Every tool adds schema tokens and a decision branch. Selection accuracy degrades noticeably past a few dozen tools; as of early 2026 the practical guidance is to keep an agent\'s working set small (roughly 10–20), consolidating primitives into task-shaped operations (<code>reschedule_meeting</code>, not <code>get_event</code> + <code>check_conflicts</code> + <code>update_event</code> + <code>send_notification</code>).</li>' +
        '<li><b>Design parameters the model can actually supply.</b> An enum of valid values beats a free string; a required <code>reason</code> parameter is a free audit log and measurably improves call quality (the model must articulate why before acting — reasoning smuggled into the schema).</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Tool schemas are serialized into the system-side context on every call — 40 tools with fat descriptions can burn several thousand tokens before the conversation starts, and it\'s several thousand tokens of <em>attention competition</em>. This is also why providers cache the schema block aggressively: it must be byte-identical across calls to hit the prompt cache. Dynamically reordering or rewording tools per request silently kills your cache hit rate.</div>' +
        '<h2>Tool output: the model\'s only sensory organ</h2>' +
        '<p>Whatever your tool returns is the entirety of what the agent perceives about the action. Optimize outputs for a reader that (a) cannot ask you clarifying questions and (b) pays per token:</p>' +
        '<ul>' +
        '<li><b>Return signal, not dumps.</b> A 200-row JSON blob when 5 rows matter wastes budget and buries the answer mid-context (where recall is weakest). Summarize, truncate with an explicit marker ("…truncated, 195 more rows; refine your query"), and paginate.</li>' +
        '<li><b>Make success unambiguous.</b> "OK" is weak; "Moved 3 files to ./archive/ (report.pdf, a.csv, b.csv)" lets the model verify its own intent against the effect.</li>' +
        '<li><b>Stable formats.</b> The model learns your tool\'s output shape from earlier calls in the transcript; format churn mid-episode causes misreads.</li>' +
        '</ul>' +
        '<h2>Error messages the model can act on</h2>' +
        '<p>An agent\'s error handling is only as good as the error text you feed back. Compare:</p>' +
        '<pre><code># Useless — model will retry the identical call or give up\nERROR: request failed (500)\n\n# Actionable — names the cause, the fix, and the constraint\nERROR: date_range too large (got 370 days, max 90).\nSplit into multiple calls of &lt;= 90 days each.\n\n# Actionable — offers the recovery path\nERROR: file \'./data/reprot.csv\' not found.\nDid you mean \'./data/report.csv\'? Call list_files to see the directory.</code></pre>' +
        '<p>Pattern: <b>every error should tell the model what happened, why, and what to try instead.</b> This is exactly what a good HTTP 400 body does for human developers — agents just read it more literally. Distinguish retryable errors ("rate limited, wait and retry") from permanent ones ("permission denied — do not retry; report to the user"), because the model will otherwise hammer a permanent failure until the step budget dies.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A billing agent kept calling <code>refund_payment</code> with an amount in dollars; the API wanted cents. The error returned was a bare <code>{"error": "invalid_amount"}</code> — so the model "fixed" it by trying smaller dollar amounts, issuing three real refunds of the wrong size before the step budget hit. One sentence in the error ("amount must be an integer in cents; you sent 49.99") or one line in the parameter description would have prevented a money-losing incident. Error text is a safety control.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> A well-calibrated question: "What makes a good tool for an agent?" Weak answers list plumbing (JSON schema, HTTP). Strong answers treat descriptions as the real API docs, name the overlap/disambiguation problem, insist on actionable error strings, and mention consolidation — fewer task-shaped tools over many primitives.</div>'
    },
    {
      id: 'stop-and-recover',
      title: 'Stopping, budgets, and error recovery',
      blurb: 'Loops don\'t self-terminate. Fences, budgets, and the retry / replan / escalate decision tree.',
      html: '<h2>Why the loop won\'t stop itself</h2>' +
        '<p>Nothing in the architecture terminates an agent. The model stops when it emits plain text instead of a tool call — a <em>sampled</em> event, not a guaranteed one. Three canonical non-termination modes:</p>' +
        '<ul>' +
        '<li><b>The oscillator:</b> tool A\'s output convinces the model to try B, whose output convinces it to try A. Common with search agents reformulating the same failing query forever.</li>' +
        '<li><b>The perfectionist:</b> the task is done but underspecified ("improve the docs"), so there\'s always one more improvement. No observation ever says "done."</li>' +
        '<li><b>The optimist:</b> a tool fails identically every time, and the model retries with cosmetic variations because the error text gives it nothing to update on (lesson 4).</li>' +
        '</ul>' +
        '<p>So termination is a harness responsibility. Layer your fences, cheapest first:</p>' +
        '<ol>' +
        '<li><b>Step budget</b> — a hard cap on loop iterations (the <code>range(15)</code> in lesson 1). Size it from your eval traces: p95 successful-run length ×2 is a decent starting point. Typical values as of early 2026: 10–30 steps for tool-using assistants, 50–200 for coding agents on real issues.</li>' +
        '<li><b>Cost fence</b> — track cumulative tokens × price per run; abort at a dollar ceiling. Step budgets don\'t cap spend when context grows quadratically; a 30-step run over a fat transcript can cost 100× a 10-step run.</li>' +
        '<li><b>Wall-clock timeout</b> — for the run and per tool call. A hung tool call otherwise hangs the agent silently.</li>' +
        '<li><b>Progress detection</b> — abort or intervene on repeated identical tool calls (hash the last N calls), no plan-state change in K steps, or context about to overflow.</li>' +
        '<li><b>Verified completion</b> — don\'t trust "I\'m done." Where possible, gate completion on a check the model can\'t vibe past: tests pass, the file exists, the diff applies, the answer cites a retrieved source. Models under step pressure <em>will</em> declare victory; agents that must call a <code>finish(evidence=...)</code> tool that validates evidence terminate far more honestly.</li>' +
        '</ol>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Budget for the tail, not the mean. Agent run costs are heavy-tailed: in production traces it\'s routine to see p50 = 6 steps / $0.05 and p99 = 60 steps / $4. Per-run cost fences plus a per-user daily ceiling is the standard belt-and-suspenders. An unfenced agent behind a free-tier UI is a denial-of-wallet vulnerability, and yes, people will find it.</div>' +
        '<h2>Recovery: retry vs replan vs escalate</h2>' +
        '<p>When a step fails, there are exactly three moves, and choosing between them is most of agent reliability engineering:</p>' +
        '<table><tr><th>Move</th><th>When</th><th>Mechanics</th></tr>' +
        '<tr><td><b>Retry</b></td><td>Transient failure (timeout, rate limit, flaky network) or a malformed call with a clear fix in the error text</td><td>Same intent, corrected call. Cap at 2–3; exponential backoff for infra errors. Retrying an unchanged call against a deterministic error is pure budget burn.</td></tr>' +
        '<tr><td><b>Replan</b></td><td>The approach is wrong: repeated failures of the same intent, an observation contradicting a plan assumption, a dead end</td><td>Explicitly prompt for a revised plan given the failure evidence — or restart with fresh context carrying a failure summary (see below).</td></tr>' +
        '<tr><td><b>Escalate</b></td><td>Permanent failure (permissions, missing data), ambiguity only the user can resolve, or a fence tripped</td><td>Stop and surface: what was attempted, what failed, what\'s needed. A clean escalation is a <em>success mode</em> — instrument it as one, or your team will punish honest agents into bluffing.</td></tr></table>' +
        '<h2>Poisoned context: why replanning in place often fails</h2>' +
        '<p>After a long failure spiral, the transcript itself becomes the problem. It\'s now full of wrong hypotheses stated confidently, dead-end tool outputs, and error spam — and every future step conditions on all of it. Models anchor hard on their own prior statements (module 1: autoregression doesn\'t go back), so an agent that spent 15 steps convinced the bug is in the parser keeps gravitating there even after you tell it otherwise. This is <b>context poisoning</b>, and past a point, no in-place prompt fixes it.</p>' +
        '<p>The cure is brutal and effective: <b>throw the transcript away.</b> Summarize what was learned into a few structured lines — task, approaches tried, why each failed, verified facts discovered — and start a fresh episode seeded with that summary. You keep the lessons and lose the anchors. Production agent stacks increasingly automate this: after N consecutive failures, compact-and-restart rather than push on. It routinely rescues tasks that 30 more steps of in-place flailing would not.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> The subtle version: <em>partial</em> poisoning from one bad tool output. A scraper tool once returned a competitor\'s pricing page instead of the customer\'s (redirect); the agent built its whole analysis on it. Every subsequent step looked internally coherent — reviewers only caught it because the harness logged tool outputs separately and someone diffed. Log raw tool I/O out-of-band; the transcript alone can look perfectly sane while being wrong from step 2 onward.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your agent fails the same API call 12 times in a row — walk me through the fix." Layer it: actionable error text (does the model know <em>why</em> it failed?) → retry cap with backoff → replan trigger on repeated intent failure → fresh-context restart with failure summary → escalate with a report. Bonus: name denial-of-wallet and per-run cost fences unprompted.</div>'
    },
    {
      id: 'state-and-when-not',
      title: 'State, resumability — and when not to build an agent at all',
      blurb: 'What lives in context vs outside it, surviving a crash at step 37, and the workflow-vs-agent decision that should kill most agent projects.',
      html: '<h2>Two kinds of state</h2>' +
        '<p>Everything an agent knows lives in one of two places, and confusing them causes most architectural pain:</p>' +
        '<ul>' +
        '<li><b>In-context state</b> — the transcript: instructions, tool calls, observations, the model\'s own prose. It\'s what the model reasons over. It is expensive (resent every call), capped (window), lossy under pressure (attention), and ephemeral (gone when the process dies).</li>' +
        '<li><b>External state</b> — files the agent wrote, rows it inserted, the harness\'s own records: plan/todo status, spend counters, tool-call logs, checkpoints. Durable, cheap, unbounded — but the model only "knows" it when you inject it or the model reads it via a tool.</li>' +
        '</ul>' +
        '<p>The design rule: <b>context is a working set, not a database.</b> Keep in context: the goal, the live plan, recent observations, and hard-won verified facts. Push out: bulk data (write to files, give the model read tools), full history (summarize or drop old tool outputs — a 5k-token file listing from step 3 has near-zero value at step 30), and anything that must survive the run (decisions, artifacts, audit trail). The filesystem-as-memory pattern — agent writes <code>notes.md</code> / <code>plan.md</code> and re-reads them — works precisely because it moves state to the durable side while keeping it model-accessible on demand.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Long-running agents hit the window ceiling and must <b>compact</b>: replace older transcript spans with a model-written summary. Compaction is lossy in ways that matter — exact identifiers, error strings, and "we already tried X" facts are the usual casualties, and losing that last one causes eerie repeated mistakes after every compaction. Mitigation: before compacting, have the agent persist critical specifics to a file that survives; compact the prose, not the facts.</div>' +
        '<h2>Resumability: design for the crash at step 37</h2>' +
        '<p>A long agent run <em>will</em> die mid-flight — deploy, OOM, rate-limit storm, laptop lid. Whether that\'s an annoyance or a disaster is decided by three design choices made up front:</p>' +
        '<ol>' +
        '<li><b>Checkpoint the transcript + harness state</b> (messages array, plan status, spend counter) after every step. It\'s a JSON dump; there\'s no excuse not to. Resume = reload and continue the loop.</li>' +
        '<li><b>Make tools idempotent or guarded.</b> The crash happens <em>after</em> the tool executed but <em>before</em> the checkpoint — replaying the step re-executes it. <code>send_email</code> with an idempotency key, <code>create_ticket</code> that checks for an existing one. Anything with side effects needs this or resumption double-fires.</li>' +
        '<li><b>Prefer restartable decomposition over resumable marathons.</b> If the work chunks into independent items each done in a fresh short episode (next lesson\'s pipeline thinking), you get resumability for free: crash = redo at most one item. The 200-step single-transcript run that must be resumed exactly is a design smell.</li>' +
        '</ol>' +
        '<h2>When NOT to build an agent</h2>' +
        '<p>The most valuable sentence in this module: <b>most things shipped as "agents" should be workflows.</b> A workflow is LLM calls composed by <em>your</em> code — fixed steps, model inside each step, control flow outside the model. An agent hands the model the control flow. That handoff is only worth its cost when you genuinely cannot enumerate the steps in advance.</p>' +
        '<table><tr><th>Signal</th><th>Build a workflow</th><th>Build an agent</th></tr>' +
        '<tr><td>Steps knowable upfront?</td><td>Yes — same 4 steps every time (classify → extract → validate → file)</td><td>No — path depends on what each observation reveals (debugging, open-ended research)</td></tr>' +
        '<tr><td>Variance in inputs</td><td>Bounded, enumerable cases → branch in code</td><td>Long tail you can\'t enumerate</td></tr>' +
        '<tr><td>Failure tolerance</td><td>Low: need predictable latency/cost/behavior per run</td><td>Some: value of hard successes covers cost of wandering</td></tr>' +
        '<tr><td>Debuggability need</td><td>Per-step evals, deterministic replay</td><td>Trajectory-level evals only (module 11 — much harder)</td></tr></table>' +
        '<p>The honest heuristic: <b>start as a workflow; promote to an agent only where the workflow demonstrably can\'t decide.</b> Often the answer is a hybrid — a fixed pipeline where exactly one step ("figure out why this invoice doesn\'t reconcile") gets a bounded inner agent loop with its own budget. You keep predictability everywhere the problem allows and pay for autonomy only where it earns rent. Both Anthropic\'s and OpenAI\'s agent-building guidance land on this same recommendation: use the simplest composition that works, and add autonomy last, not first.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team replaced a boring 5-step document pipeline (99% success, $0.02/doc, 8s p95) with an agent because roadmap said "agentic." Six weeks later: 91% success, $0.30/doc average with a $4 p99, latency in the minutes, and un-unit-testable failures. They quietly reverted, keeping one agent sub-step for the genuinely open-ended 3% of documents. The resume-driven-development tax is real; make architecture decisions on variance, not vibes.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Would you use an agent for X?" is usually a trap where the correct answer is no. Score points by asking whether the steps are enumerable, quantifying the predictability you\'d give up, and proposing the hybrid (pipeline with one agentic step, fenced). Senior signal: "agents are a last resort for control flow, not a default" — with the workflow-first reasoning to back it.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your unattended research agent ran overnight and burned $310 in API credits without finishing. Logs show it alternating between two search queries, reformulating each slightly, for nine hours. Which failure is this, and what is the primary fix?',
      options: [
        'Hallucination — switch to a larger model with better factual recall',
        'Non-termination (oscillation) — the loop has no step budget, cost fence, or repeated-call detection; add hard fences in the harness',
        'Context overflow — the window filled up and the model forgot the task',
        'Rate limiting — the provider throttled requests, so each step took longer'
      ],
      answer: [1],
      explanation: 'Alternating between two queries indefinitely is the classic oscillator: nothing in the loop terminates it, and the harness supplied no fences. Step budgets, cost ceilings, and duplicate-call detection are harness responsibilities — the model emitting "done" is a sampled event you cannot rely on. (A) misdiagnoses: the model isn\'t fabricating facts, it\'s stuck in control flow; a larger model might loop more expensively. (C) would produce degraded, drifting behavior, but the immediate observed failure is the unbounded loop — and overflow would typically error or truncate, not run nine clean hours. (D) affects latency, not the decision to keep looping; throttling doesn\'t spend $310 on its own.'
    },
    {
      text: 'An agent has tools search_docs ("Search documentation") and web_search ("Search the web"). Users report it frequently web-searches for questions about your own product, getting stale third-party blog answers. What is the highest-leverage fix?',
      options: [
        'Remove web_search entirely so the model has no choice',
        'Fine-tune the model on examples of correct tool selection',
        'Rewrite both descriptions to disambiguate explicitly — e.g. search_docs: "…ALWAYS prefer this over web_search for anything about our product"; web_search: "…only for information NOT in our docs" — and re-test',
        'Lower the temperature so tool selection is more deterministic'
      ],
      answer: [2],
      explanation: 'Tool selection is driven by the schema text the model reads; overlapping tools with vague one-liners is the canonical cause of wrong-tool bugs, and cross-referencing descriptions is the canonical fix — cheap, immediate, testable. (A) throws away a needed capability to dodge a documentation problem; some questions genuinely need the web. (B) is the most expensive possible fix for something a sentence of prompt text usually solves, and it must be redone per model version. (D) makes selection more consistent, not more correct — a deterministic wrong choice is still wrong.'
    },
    {
      text: 'Your file-management agent\'s delete_file tool returns an empty string on success and raises an exception (swallowed by the harness, returning "") on failure. Why is this dangerous specifically for an agent, beyond being sloppy engineering?',
      options: [
        'Empty strings waste context window tokens',
        'The model\'s only perception of the action is the returned text; identical output for success and failure means the agent literally cannot distinguish them and will build subsequent steps on false beliefs',
        'The API will reject empty tool results with a 400 error',
        'Exceptions in tools crash the event loop in async harnesses'
      ],
      answer: [1],
      explanation: 'The tool result string is the agent\'s entire sensory channel for that action. If success and failure are byte-identical, the model\'s world-model diverges from reality and every later step compounds the error — the "moved 300 files into the void" failure class. (A) is backwards — empty strings cost nothing; the problem is they carry nothing. (C) is false: APIs accept empty tool results happily, which is exactly why this fails silently. (D) may be true in specific codebases but is an infrastructure concern, not the agent-specific danger being probed.'
    },
    {
      text: 'At step 4 of a 12-step upfront plan, the agent discovers the API it planned around was deprecated. It notes this, then continues executing the original plan steps against the dead API. Which mechanism best explains why, and which fix targets it?',
      options: [
        'The model lacks reasoning capability; upgrade to a reasoning model and the plan will self-correct',
        'The plan text sits in context acting as an attention anchor; without an explicit replan trigger, the model keeps following it. Fix: harness-triggered replanning on surprising observations, with the plan as live, updatable state',
        'The context window overflowed at step 4, truncating the discovery',
        'Temperature was too low, making the agent rigid; raise it to encourage exploration'
      ],
      answer: [1],
      explanation: 'This is stale-plan drift: the confident plan written at step 1 keeps receiving attention and steering behavior even after evidence invalidates it. Models are decent at replanning when asked and bad at deciding to replan unprompted — so the harness must trigger it and the plan must be reconciled against reality (todo-state updates, replan-on-surprise). (A) helps marginally but reasoning models also anchor on their own committed plans; the trigger still needs to exist. (C) invents a failure with no evidence — step 4 of 12 rarely overflows anything. (D) misunderstands temperature: it adds sampling variance, not strategic reconsideration.'
    },
    {
      text: 'A tool call fails with "ERROR: rate limit exceeded, retry after 30s". A different call fails with "ERROR: permission denied for table billing_events". What should a well-designed agent harness do differently for each, and why?',
      options: [
        'Retry both with exponential backoff up to 3 times — uniform retry policy is simpler to maintain',
        'Retry the rate limit after backoff (transient); do not retry the permission error (deterministic) — escalate it with a clear report, since no reformulation will ever succeed',
        'Replan on both — any failure means the approach is wrong',
        'Escalate both to a human immediately — failures are too risky to handle automatically'
      ],
      answer: [1],
      explanation: 'The retry/replan/escalate decision hinges on failure class. Rate limits are transient: identical retry after backoff succeeds. Permission errors are deterministic: retrying burns steps, and the model "fixing" it with creative variations is how agents flail past budgets — the correct move is escalation with what was attempted and what access is needed. (A) hammers a permanent failure three times for nothing and teaches the model nothing. (C) over-rotates: replanning is for wrong approaches, not transient infra blips — replanning on every timeout makes agents wildly unstable. (D) throws away automation value; transient errors are precisely what harnesses should absorb silently.'
    },
    {
      text: 'After 18 steps of failed debugging built on the wrong hypothesis, your agent keeps returning to that hypothesis despite contradicting evidence now in the transcript. Adding "your earlier hypothesis was wrong, ignore it" hasn\'t helped. What is the most effective intervention?',
      options: [
        'Repeat the correction more forcefully in the system prompt each step',
        'Increase the step budget so the agent has room to work through it',
        'Compact-and-restart: summarize verified facts and failed approaches into a short brief, then start a fresh episode seeded with that summary — discarding the poisoned transcript',
        'Switch models mid-conversation while keeping the same transcript'
      ],
      answer: [2],
      explanation: 'This is context poisoning: 18 steps of confidently-stated wrong hypotheses dominate the context, and autoregressive conditioning keeps pulling generation back to them — instructions to ignore in-context text fight a losing battle against attention over that text. The fix is removing the poison: fresh context, keeping only a distilled summary of lessons learned. (A) is already demonstrated not to work; you cannot out-prompt a poisoned transcript. (B) funds more anchored flailing. (D) keeps the poison — a different model conditioned on the same wrong transcript inherits the same anchors.'
    },
    {
      text: 'You\'re designing per-run limits for a customer-facing agent. Eval traces show successful runs at p50 = 5 steps, p95 = 11 steps; context grows ~4k tokens/step. Which TWO fences should you implement first?',
      options: [
        'A step budget around 20–25 (roughly 2× p95 of successful runs)',
        'A per-run dollar cost ceiling computed from cumulative token usage',
        'A rule that the agent must ask permission before every tool call',
        'Removing all limits until you observe an incident, to avoid constraining the model',
        'A ban on the model emitting more than 100 tokens per response'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'Step budgets sized from successful-run statistics (≈2× p95) catch runaway loops while rarely clipping legitimate work; a cost fence is the necessary complement because context grows every step, so cost is superlinear in steps — a long run can cost 100× a short one even within the step budget. (C) is an approval-fatigue machine that destroys the value of automation for low-risk calls; approvals belong on consequential actions only (module 10). (D) is how denial-of-wallet incidents happen — fences are designed from traces precisely so you don\'t need an incident first. (E) caps the wrong resource: response length isn\'t the cost driver, resent context is, and it would cripple legitimate reasoning.'
    },
    {
      text: 'A PM proposes an "agent" for invoice intake: every invoice needs the same steps — OCR, extract fields, validate against PO, post to ERP, flag mismatches. Volume is 10k/day and finance needs predictable per-invoice cost and latency. What should you build?',
      options: [
        'A single autonomous agent with OCR, extraction, validation and ERP tools, free to choose its own path per invoice',
        'A fixed workflow (pipeline) of LLM calls composed in code — the steps are fully enumerable; optionally route the small % of irreconcilable invoices to a bounded agent loop or a human',
        'A multi-agent system with a planner agent delegating to specialist agents per step',
        'No LLM at all — agents have made pipelines obsolete'
      ],
      answer: [1],
      explanation: 'Every workflow-vs-agent signal points one way: steps knowable upfront, high volume, hard predictability requirements. A pipeline gives per-step evals, deterministic control flow, and stable cost — and the genuinely open-ended residue (irreconcilable invoices) gets a fenced agent or human, which is the hybrid pattern. (A) pays the agent tax — variance in cost, latency, and behavior — for zero benefit, since the model would just re-derive the same 5 steps with occasional creative failures. (C) adds multi-agent coordination overhead on top of an unnecessary agent. (D) inverts reality: LLM calls inside the pipeline do the extraction; it\'s the model-driven control flow that\'s unnecessary.'
    },
    {
      text: 'Your agent framework hides the message array and exposes only agent.run(task). An agent misbehaves in production and you need to debug it. Why do experienced builders insist on owning or at least logging the raw transcript?',
      options: [
        'Frameworks are always slower at runtime than hand-written loops',
        'The transcript is the agent\'s complete state — every decision is a function of exactly what accumulated in it. Without it you cannot see what the model actually perceived at the failing step',
        'Raw transcripts are required by the API terms of service',
        'The messages array is needed to compute exact token counts for billing'
      ],
      answer: [1],
      explanation: 'An agent has no hidden brain: the transcript (plus tool schemas) is the entire input to every decision. Debugging means replaying what the model saw — which tool output was misleading, where the plan drifted, what got truncated. Abstractions that hide this turn every incident into archaeology. (A) is sometimes true but irrelevant to debuggability, which is the actual argument. (C) is fiction. (D) — billing data comes from API responses regardless; you don\'t need the transcript for that, you need it to understand behavior.'
    },
    {
      text: 'Which TWO changes to this tool error most improve the agent\'s ability to recover? Current: {"error": true}. The tool creates calendar events and fails when the requested slot conflicts with an existing event.',
      options: [
        'Include what failed and why: "Conflict: 14:00–15:00 overlaps \'Board sync\' (13:30–14:30)"',
        'Include the recovery path: "Nearest free slots: 15:00–16:00, 16:30–17:30. Retry with one of these or call list_free_slots"',
        'Return HTTP status code 409 in a numeric field for the model to interpret',
        'Log the full stack trace into the tool result so the model has maximum information',
        'Return the error in XML instead of JSON for better parsing'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'Actionable errors state what happened, why, and what to try instead — cause (A) plus recovery path (B) turns a dead end into a one-step fix and prevents blind retry loops. (C) gives the model a bare status code to guess about; 409 without the conflicting event\'s details still forces trial-and-error. (D) floods context with frames and file paths that carry no actionable signal for this failure — tokens spent burying the lede. (E) is format bikeshedding; models read both fine, and the problem is missing content, not serialization.'
    },
    {
      text: 'ReAct-style prompting ("emit Thought: then Action: as text") was standard in 2023. As of early 2026, what has changed about how you should implement the same insight?',
      options: [
        'Nothing — text-format ReAct remains the most reliable approach',
        'The interleave-reasoning-with-action insight survives, but structure now comes from native tool-calling APIs (schema-constrained JSON in a dedicated channel), and reasoning models internalize the Thought step via RL — so you drop the text protocol and the parse-by-regex layer',
        'ReAct is fully obsolete because modern models complete any task in a single call without tools',
        'ReAct now requires a vector database to store thoughts between steps'
      ],
      answer: [1],
      explanation: 'The durable contribution of ReAct is the loop structure — reasoning grounds acting, observations ground reasoning. Its 2022 implementation (prompted text formats parsed by regex) is dead weight on modern APIs: native tool calling eliminates parse failures, and reasoning models perform the deliberation step internally, trained rather than prompted. (A) ignores three years of API evolution and keeps a needless failure mode. (C) overcorrects — tool use is more central than ever; it\'s the text protocol that died, not the loop. (D) is word salad connecting unrelated components.'
    },
    {
      text: 'A coding agent declares "All tests pass, task complete" — but it never ran the test suite in the last 10 steps; the claim is confabulated. Which harness-level design most directly prevents this class of false completion?',
      options: [
        'Add "never lie about test results" to the system prompt',
        'Verified completion: the agent must finish via a completion path the harness validates — e.g. a finish tool whose handler actually runs the test suite (or checks the artifact) and rejects completion if the evidence fails',
        'Have a second LLM read the transcript and judge whether the claim seems truthful',
        'Increase the step budget so the agent is less pressured to finish early'
      ],
      answer: [1],
      explanation: 'Claims are sampled text; checks are ground truth. Gating completion on machine-verified evidence (run the tests in the handler, verify the file exists, apply the diff) makes false completion structurally impossible rather than merely discouraged. (A) is prompt-wishing — models under step pressure confabulate completion without "intending" to lie; instructions don\'t bind sampled claims to reality. (C) helps but the judge reads the same transcript and can be fooled by the same confident prose; it\'s a probabilistic patch where a deterministic check is available. (D) may reduce pressure slightly but leaves the core defect: nothing connects the claim to the world.'
    },
    {
      text: 'Your agent\'s runs last 100+ steps over hours and a deploy kills one at step 63. Restarting from scratch wastes $2 and an hour. Which THREE design changes give you robust resumability?',
      options: [
        'Checkpoint the messages array plus harness state (plan status, spend counters) to durable storage after every step',
        'Make side-effecting tools idempotent (idempotency keys, check-before-create) so replaying the boundary step is safe',
        'Where possible, decompose the marathon into independent work items each processed in a short fresh-context episode, so a crash costs at most one item',
        'Pin the sampling seed so the resumed run reproduces the identical token sequence',
        'Keep the full transcript exclusively in the model\'s context window, since it is the source of truth'
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: 'Resumability = durable state (A) + safe replay across the crash boundary (B) + a decomposition that bounds the blast radius of any crash (C) — the third is the strongest, since restartable beats resumable. (D) misunderstands the problem: you don\'t need to reproduce the exact tokens, you need to continue the work; seeds don\'t survive tool-output nondeterminism anyway. (E) is exactly backwards — context is ephemeral by nature; the whole point of checkpointing is that the transcript must also live outside the process to survive it.'
    },
    {
      text: 'You have 45 fine-grained tools registered (get_user, get_user_email, get_user_orders, get_order, get_order_items, …). The agent increasingly picks near-miss tools and occasionally invents nonexistent ones. What is the best structural fix?',
      options: [
        'Add few-shot examples of correct tool usage for all 45 tools to the system prompt',
        'Consolidate into a smaller set of task-shaped tools (e.g. lookup_customer(query, include=[orders,email,…])) — fewer, higher-level operations with clear boundaries reduce both schema token load and selection error',
        'Sort the tool list alphabetically so the model can find tools faster',
        'Raise max_tokens so the model has more room to consider the options'
      ],
      answer: [1],
      explanation: 'Selection accuracy degrades as the tool count grows: 45 overlapping schemas mean thousands of tokens of near-duplicate descriptions competing for attention, and sampling occasionally blends names into nonexistent ones. Consolidation into ~10–20 task-shaped tools attacks the cause — fewer decision branches, clearer contracts, smaller schema block (and better prompt-cache behavior). (A) adds even more tokens to an attention problem caused by too many tokens; 45 tools\' worth of examples is enormous. (C) — models don\'t scan alphabetically; position barely matters against 45-way semantic confusion. (D) is unrelated: max_tokens caps output length and has nothing to do with tool selection.'
    }
  ],
  flashcards: [
    { id: 'fc-agent-def', front: 'Define an agent in one sentence, structurally.', back: 'An LLM called in a <b>loop</b> where its outputs trigger tool executions whose results are appended to context before the next call — the model chooses the control flow; the harness supplies fences.' },
    { id: 'fc-transcript-state', front: 'Where does ALL of an agent\'s in-episode state live?', back: 'In the transcript (messages array). Every decision at step n is a function of exactly what accumulated during steps 1…n−1. Debugging an agent = reading its transcript.' },
    { id: 'fc-loop-cost', front: 'Why does a 20-step agent run cost far more than 20 single calls?', back: 'The transcript is resent every step, so input cost grows roughly with the sum 1+2+…+n. Prompt caching mitigates; cost fences are still mandatory because growth is superlinear.' },
    { id: 'fc-react', front: 'ReAct\'s durable insight vs its dead implementation?', back: 'Durable: interleave reasoning → action → observation (reasoning grounds acting, observations ground reasoning). Dead: the Thought:/Action: text protocol parsed by regex — replaced by native tool calling + RL-trained reasoning.' },
    { id: 'fc-native-tools', front: 'What did native tool-calling APIs fix versus prompt-format actions?', back: 'Tool invocations became schema-constrained JSON in a dedicated channel (<code>tool_calls</code>) — parse failures and invented formats dropped from a top failure mode to a rounding error. Also enabled parallel calls.' },
    { id: 'fc-plan-modes', front: 'Upfront vs interleaved planning — when does each win?', back: 'Upfront: multi-part deliverables with known shape; reviewable before acting; risk = plan rot. Interleaved: exploration/diagnosis where each step depends on the last observation; risk = wandering. Production default: plan upfront, replan on evidence.' },
    { id: 'fc-plan-drift', front: 'What is plan drift and the two forms it takes?', back: 'Gap between the plan in context and actual behavior. Stale-plan drift: world changed, model still follows the old plan (it\'s an attention anchor). Goal drift: model silently abandons/narrows the goal as the transcript grows and recency wins.' },
    { id: 'fc-drift-fixes', front: 'Four mitigations for plan drift, cheapest first?', back: '1) Re-inject goal/plan status every N steps. 2) Plan as live todo state updated via tool (machine-readable progress). 3) Harness-triggered replans (on failure ×2, surprises, every K steps). 4) Verify "done" against original criteria verbatim.' },
    { id: 'fc-tool-docs', front: 'The quality bar for tool descriptions?', back: 'Could a competent contractor use the tool correctly on the first try given ONLY the descriptions? They are the model\'s real API docs: what it does, what it returns, when to use it vs neighbors, sharp edges.' },
    { id: 'fc-tool-count', front: 'Why do many fine-grained tools hurt, and the fix?', back: 'Each tool adds schema tokens + a decision branch; selection degrades past a few dozen and models start picking near-misses or inventing names. Fix: consolidate into ~10–20 task-shaped tools with explicit disambiguation.' },
    { id: 'fc-error-msg', front: 'The three things every tool error string should tell the model?', back: 'What happened, why, and what to try instead — plus whether it\'s retryable or permanent. "ERROR: date_range too large (370d, max 90). Split into &lt;=90d calls." Error text is the agent\'s recovery plan.' },
    { id: 'fc-perception', front: 'What is an agent\'s only "sensory organ"?', back: 'Tool output text. The model never sees the world — only what your tools return. Empty/ambiguous returns create false beliefs the agent then builds on. Every execution must return an explicit, informative result.' },
    { id: 'fc-fences', front: 'Name the five termination fences, cheapest first.', back: 'Step budget (≈2× p95 of successful runs) → per-run cost ceiling → wall-clock timeouts (run + per tool) → progress detection (repeated calls, stalled plan state) → verified completion (finish gated on machine-checked evidence).' },
    { id: 'fc-rre', front: 'Retry vs replan vs escalate — the one-line decision rule?', back: 'Retry: transient or clearly-fixable failure (cap 2–3, backoff). Replan: the approach is wrong (repeated intent failure, contradicted assumption). Escalate: permanent blocker or user-only ambiguity — and treat clean escalation as a success mode.' },
    { id: 'fc-poisoned', front: 'What is context poisoning and the cure?', back: 'After a failure spiral, the transcript is full of confident wrong hypotheses that keep anchoring generation — in-place corrections lose to attention over the poison. Cure: compact-and-restart — distill verified facts + failed approaches into a brief, start a fresh episode.' },
    { id: 'fc-state-split', front: 'What belongs in context vs external state?', back: 'Context (working set): goal, live plan, recent observations, verified key facts. External (durable): bulk data as files with read tools, full logs, checkpoints, artifacts, audit trail. Context is a cache, not a database.' },
    { id: 'fc-resume', front: 'Three design moves for resumable agent runs?', back: '1) Checkpoint transcript + harness state after every step. 2) Idempotent/guarded side-effecting tools (safe boundary replay). 3) Prefer restartable decomposition — short fresh-context episodes per work item — over 200-step marathons.' },
    { id: 'fc-wf-vs-agent', front: 'Workflow vs agent — the deciding question?', back: 'Can you enumerate the steps in advance? Yes → workflow (your code owns control flow; predictable cost/latency, per-step evals). No → agent, fenced. Default hybrid: pipeline with one bounded agentic step where genuinely needed.' },
    { id: 'fc-denial-wallet', front: 'What is denial-of-wallet in agent systems?', back: 'An unfenced agent loop exposed to users (or attackers) burning unbounded API spend — heavy-tailed run costs (p50 $0.05, p99 $4+) with no per-run/per-user ceilings. Fences are a security control, not just cost hygiene.' }
  ],
  lab: {
    title: 'Build the loop from scratch: a no-framework file agent',
    intro: '<p>You will build a working agent in ~80 lines of plain Python — no framework — then harden it the way production demands: step budget, cost fence, actionable errors, and a poisoned-context rescue. Works with any OpenAI-compatible tool-calling endpoint (OpenAI, OpenRouter, or local via Ollama for $0).</p><p><b>Needs:</b> <code>python3</code>, <code>pip install openai</code>, an API key. Worst case ~$0.50 with a mini-class model.</p>',
    steps: [
      {
        title: 'Set up a sandbox directory and three tools',
        html: '<p>Never point a first agent at a real directory. Create a disposable workspace and define tools that are scoped to it:</p>' +
          '<pre><code>mkdir -p /tmp/agentlab &amp;&amp; cd /tmp/agentlab\nprintf \'alpha,7\\nbeta,3\\ngamma,9\\n\' &gt; data.csv\nprintf \'TODO: summarize data.csv into report.md\\n\' &gt; task.txt\npip install openai</code></pre>' +
          '<p>Now <code>agent.py</code> — tools first. Note every tool returns an explicit string, success or failure, and paths are jailed to the sandbox:</p>' +
          '<pre><code>import json, os\nfrom openai import OpenAI\n\nROOT = "/tmp/agentlab"\nclient = OpenAI()  # or OpenAI(base_url="http://localhost:11434/v1", api_key="x")\nMODEL = "gpt-5-mini"  # any tool-calling model id you have access to\n\ndef _safe(p):\n    full = os.path.realpath(os.path.join(ROOT, p))\n    if not full.startswith(ROOT):\n        raise ValueError("path escapes sandbox: " + p)\n    return full\n\ndef list_files():\n    return "\\n".join(sorted(os.listdir(ROOT))) or "(empty directory)"\n\ndef read_file(path):\n    try:\n        with open(_safe(path)) as f:\n            return f.read()[:6000]\n    except FileNotFoundError:\n        return ("ERROR: \'" + path + "\' not found. "\n                "Call list_files to see what exists.")\n\ndef write_file(path, content):\n    with open(_safe(path), "w") as f:\n        f.write(content)\n    return "Wrote " + str(len(content)) + " chars to " + path</code></pre>'
      },
      {
        title: 'Write the loop itself',
        html: '<p>The heart of the lab — the loop you should be able to rewrite from memory afterwards:</p>' +
          '<pre><code>FUNCS = {"list_files": list_files, "read_file": read_file,\n         "write_file": write_file}\nTOOLS = [\n  {"type":"function","function":{"name":"list_files",\n    "description":"List files in the working directory.",\n    "parameters":{"type":"object","properties":{}}}},\n  {"type":"function","function":{"name":"read_file",\n    "description":"Read a file (truncated to 6000 chars). "\n      "Returns an ERROR string with guidance if the file is missing.",\n    "parameters":{"type":"object","properties":{"path":{"type":"string"}},\n      "required":["path"]}}},\n  {"type":"function","function":{"name":"write_file",\n    "description":"Overwrite a file with content. Returns a confirmation "\n      "including byte count.",\n    "parameters":{"type":"object","properties":{"path":{"type":"string"},\n      "content":{"type":"string"}},"required":["path","content"]}}}]\n\ndef run(task, max_steps=10):\n    msgs = [{"role":"system","content":\n             "You are a careful file agent. Verify before you claim. "\n             "Finish with a plain-text summary of what you did."},\n            {"role":"user","content":task}]\n    for step in range(max_steps):\n        r = client.chat.completions.create(model=MODEL, messages=msgs,\n                                           tools=TOOLS)\n        m = r.choices[0].message\n        msgs.append(m)\n        if not m.tool_calls:\n            print("DONE step", step, "-&gt;", m.content); return msgs\n        for tc in m.tool_calls:\n            args = json.loads(tc.function.arguments or "{}")\n            print("  step", step, "call:", tc.function.name, args)\n            try:\n                out = FUNCS[tc.function.name](**args)\n            except Exception as e:\n                out = "TOOL ERROR: " + repr(e)\n            msgs.append({"role":"tool","tool_call_id":tc.id,\n                         "content":str(out)})\n    print("STOPPED: step budget exhausted"); return msgs\n\nif __name__ == "__main__":\n    run("Read task.txt and do what it says.")</code></pre>' +
          '<p>Run it: <code>python3 agent.py</code>. Watch the printed trajectory: it should list files, read <code>task.txt</code>, read <code>data.csv</code>, write <code>report.md</code>, then answer in plain text. You just built ReAct with native tool calling.</p>'
      },
      {
        title: 'Add the cost fence and watch spend compound',
        html: '<p>Track cumulative tokens and abort at a ceiling. Add inside the loop, after the API call:</p>' +
          '<pre><code>    # near the top of run():  spent = 0.0\n    u = r.usage\n    spent += u.prompt_tokens * IN_PRICE + u.completion_tokens * OUT_PRICE\n    print("    tokens in/out:", u.prompt_tokens, u.completion_tokens,\n          " cumulative $%.4f" % spent)\n    if spent &gt; 0.25:\n        print("STOPPED: cost fence tripped"); return msgs</code></pre>' +
          '<p>Set <code>IN_PRICE</code>/<code>OUT_PRICE</code> from your provider\'s per-token pricing. Now run a longer task ("summarize every file individually, then write a combined index") and watch <code>prompt_tokens</code> climb every step — that is the transcript being resent. This number is why cost fences exist independently of step budgets.</p>'
      },
      {
        title: 'Break it: bad errors vs actionable errors',
        html: '<p>Sabotage <code>read_file</code> to return a useless error, then ask for a file that doesn\'t exist:</p>' +
          '<pre><code>def read_file(path):\n    try:\n        with open(_safe(path)) as f: return f.read()[:6000]\n    except FileNotFoundError:\n        return "ERROR"          # useless version\n\n# then: run("Read notes.txt and summarize it.")</code></pre>' +
          '<p>Typical result: the model retries <code>notes.txt</code>, tries <code>Notes.txt</code>, maybe hallucinates a summary — and burns the budget. Restore the actionable version ("not found… call list_files") and rerun: the model recovers in one step, lists files, and reports that notes.txt doesn\'t exist. Same model, same loop — the error string was the difference. Save both trajectories and diff them.</p>'
      },
      {
        title: 'Rescue a poisoned run with compact-and-restart',
        html: '<p>Give it an impossible task to induce a failure spiral: <code>run("Open the database and delete duplicate customers", max_steps=8)</code> (there is no database tool). Watch it flail — re-reading files, inventing approaches. Now implement the rescue:</p>' +
          '<pre><code>def compact_restart(task, msgs):\n    trace = "\\n".join(str(getattr(m, "content", None) or\n                      (m.get("content") if isinstance(m, dict) else ""))\n                      for m in msgs[-12:])\n    s = client.chat.completions.create(model=MODEL, messages=[\n        {"role":"user","content":\n         "Summarize in &lt;=5 bullets: what was tried, what failed and why, "\n         "and any verified facts. Trajectory:\\n" + trace}])\n    brief = s.choices[0].message.content\n    print("BRIEF:\\n", brief)\n    return run(task + "\\n\\nPrior attempt summary:\\n" + brief +\n               "\\nIf the task is impossible with your tools, say so "\n               "explicitly and stop.")\n</code></pre>' +
          '<p>The fresh episode, seeded with the failure brief and an explicit escalation path, typically stops honestly within 1–2 steps: "no database tool exists; escalating." Compare against the poisoned transcript that never gave up. That contrast — plus the fences from step 3 — is the core of production agent reliability.</p>'
      }
    ],
    costNote: 'Worst case with a mini-class model (~$0.15–0.60/Mtok as of early 2026): about $0.50 across all steps; typical is under $0.10. On a local model via Ollama: $0. Cleanup: <code>rm -rf /tmp/agentlab</code> — no cloud resources are created, and no persistent API state exists to delete.'
  }
});
