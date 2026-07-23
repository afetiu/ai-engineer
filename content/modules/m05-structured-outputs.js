COURSE.register({
  id: 'm05-structured-outputs',
  track: 'core',
  order: 5,
  title: 'Structured outputs & tool calling',
  short: 'Structured outputs',
  tagline: 'How grammars constrain sampling, how to design schemas a model can fill, the tool-call round trip, and the repair loops that make it reliable.',
  minutes: 105,
  lessons: [
    {
      id: 'three-mechanisms',
      title: 'JSON mode vs constrained decoding vs schema-guided',
      blurb: 'Three things that all "return JSON" — with wildly different guarantees, because only some of them touch the sampler.',
      html: '<h2>The distinction that determines whether you need a parser fallback</h2>' +
        '<p>"Get the model to output JSON" hides three mechanisms with fundamentally different guarantees. Confusing them is why teams ship a JSON-mode integration and then spend a quarter debugging parse failures they thought were impossible.</p>' +
        '<ul>' +
        '<li><b>Prompted JSON (no enforcement).</b> You ask nicely — "respond with a JSON object" — and hope. The sampler is unconstrained; the model usually complies but periodically emits prose preambles ("Here is the JSON:"), markdown code fences, trailing commentary, or subtly invalid JSON. Guarantee: none. You <em>must</em> parse defensively and retry.</li>' +
        '<li><b>JSON mode (syntactic validity only).</b> A provider flag (OpenAI\'s <code>response_format: {type: "json_object"}</code>) that guarantees the output <em>parses</em> as JSON — no fences, no preamble, balanced braces. It does <b>not</b> guarantee your schema: fields can be missing, extra, wrong-typed, or an enum can hold a value that isn\'t in your set. It solves "is it JSON", not "is it MY JSON".</li>' +
        '<li><b>Schema-guided / constrained decoding (structural guarantee).</b> Strict function calling and structured outputs (OpenAI <code>strict: true</code> + <code>json_schema</code>, Anthropic tool <code>strict</code>, Gemini <code>responseSchema</code>, and open-source engines via grammars/Outlines/XGrammar/llama.cpp GBNF). Here the schema is compiled into a grammar that <b>constrains the sampler at every token</b> — the model literally cannot emit a token that would violate the structure. Output is guaranteed to validate against the schema (types, required fields, enum membership, no extra keys). This is a different class of guarantee, and it is the one you want for anything a parser depends on.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Constrained decoding works at the logit level (module 2). At each step, a state machine derived from your schema/grammar knows which tokens are legal next (after <code>{"age":</code> only digits are legal; after a complete string value only <code>,</code> or <code>}</code> is). The engine masks every illegal token to −∞ probability before sampling, so an invalid token is impossible, not merely unlikely. Providers precompile the schema into this automaton (hence the one-time compile latency on a new schema, then it\'s cached). The model still <em>chooses</em> among legal tokens by probability — structure is forced, content is not.</div>' +
        '<h2>What each mechanism does and does NOT buy you</h2>' +
        '<table><tr><th>Mechanism</th><th>Valid JSON?</th><th>Matches schema?</th><th>Correct values?</th><th>Parser fallback needed?</th></tr>' +
        '<tr><td>Prompted JSON</td><td>usually</td><td>no</td><td>no</td><td>always</td></tr>' +
        '<tr><td>JSON mode</td><td>yes</td><td>no</td><td>no</td><td>for schema violations</td></tr>' +
        '<tr><td>Constrained (strict/grammar)</td><td>yes</td><td>yes</td><td>no</td><td>only for semantic errors</td></tr></table>' +
        '<p><b>The column nobody internalizes is the last content one.</b> Constrained decoding guarantees the model <em>can\'t</em> produce a wrong <em>shape</em> — it says nothing about whether the values are <em>right</em>. A strict schema will happily let the model put a hallucinated date in a <code>date</code> field, a plausible-but-wrong amount in an <code>integer</code> field, or pick the wrong-but-valid enum member. Structure is not correctness. Constrained decoding eliminates a class of parse/format failures entirely; it does not eliminate the need for validation and evals on the values.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team enabled JSON mode, saw parse failures drop, declared victory, and removed their schema validation "since the output is JSON now". Two weeks later a prompt tweak caused the model to start returning <code>{"result": {...}}</code> wrapped one level deeper; every consumer read <code>.amount</code> off the wrapper (undefined), and defaulted to 0. JSON mode guaranteed valid JSON, not their shape. Constrained decoding with a strict schema would have made the extra wrapper impossible — or, keeping JSON mode, the validation they deleted would have caught it. Never conflate "parses" with "conforms".</div>' +
        '<h2>Costs and constraints of constrained decoding</h2>' +
        '<ul>' +
        '<li><b>Schema feature limits.</b> Strict modes support a JSON-Schema subset: objects with <code>additionalProperties: false</code> and all keys <code>required</code>, enums, <code>anyOf</code>, nesting, arrays — but commonly NOT <code>minLength</code>/<code>maximum</code> numeric or string constraints, patterns, or recursion (limited/unsupported per vendor). "Optional" fields are usually expressed as <code>required</code> + nullable type, not by omission. Read your provider\'s subset; a rejected schema is a 400, not a silent degrade.</li>' +
        '<li><b>First-call compile latency.</b> A new schema pays a one-time grammar-compilation cost (hundreds of ms to seconds), then caches ~24h. Rotating schemas per request defeats the cache — keep them stable, like prompts (module 3).</li>' +
        '<li><b>Constraint can distort quality.</b> Forcing structure occasionally pushes probability mass into worse content — the model wanted to explain and couldn\'t, so it commits to a lower-quality legal token. For reasoning-heavy extraction, let the model reason in free text FIRST (or in a reasoning field) and constrain only the final answer; don\'t straitjacket the thinking.</li>' +
        '<li><b>Not universal.</b> Constrained decoding requires provider support or a self-hosted engine that exposes it. Aggregators and some endpoints only offer prompted JSON or JSON mode — know which guarantee you actually have on the model you\'re calling before you delete your fallback.</li>' +
        '</ul>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "You enabled JSON mode but still get bad data — why?" The senior answer names the guarantee gap: JSON mode ensures syntactic validity, not schema conformance, and neither JSON mode nor strict decoding ensures value correctness. Then: use constrained/strict decoding for shape, keep validation for values, and add evals for correctness. Explaining the logit-masking mechanism earns bonus points.</div>'
    },
    {
      id: 'schema-design',
      title: 'Designing schemas a model can actually fill',
      blurb: 'The schema is a prompt. Field order, enums, and descriptions steer the model more than your instructions do.',
      html: '<h2>Your schema is prompt engineering by other means</h2>' +
        '<p>Constrained decoding guarantees the model fills your schema; it does nothing to make the model fill it <em>well</em>. And the schema itself is one of the strongest prompts you have — the model reads field names, order, types, enum values, and descriptions and conditions on all of them. A well-designed schema routinely outperforms a poorly-designed schema plus three paragraphs of instructions. The levers:</p>' +
        '<h3>Field order = reasoning order</h3>' +
        '<p>Generation is sequential (module 1): fields are emitted top to bottom, and each field conditions the next. So <b>put fields the model should reason about before fields that depend on that reasoning.</b> The canonical mistake is verdict-first:</p>' +
        '<pre><code># Bad: the verdict is committed with zero written analysis\n{"approved": bool, "reason": str, "risk_factors": [str]}\n\n# Good: evidence accrues, THEN the conclusion conditions on it\n{"risk_factors": [str], "reasoning": str, "approved": bool}</code></pre>' +
        '<p>This is chain-of-thought embedded in structure. Reordering fields is often the single highest-ROI change to an extraction prompt, and it costs nothing. If you want an explicit scratchpad, add a <code>reasoning</code> string field early — the model uses it as working memory and downstream you just ignore it (or log it for debugging).</p>' +
        '<h3>Enums over free strings, everywhere you can</h3>' +
        '<p>Every field that has a known set of values should be an <code>enum</code>, not a <code>string</code>. Benefits compound: constrained decoding makes an out-of-set value impossible; you get canonicalization for free (no "High"/"high"/"HIGH"/"H" drift); downstream code can switch on the value without normalization; and the enum list itself teaches the model the taxonomy. A free-string "priority" field is a normalization bug generator; a <code>["low","medium","high","urgent"]</code> enum is a closed contract.</p>' +
        '<h3>Descriptions are inline instructions</h3>' +
        '<p>JSON-Schema <code>description</code> fields are sent to the model and function as per-field prompts — use them for exactly the guidance that would otherwise bloat the system prompt: units ("amount in cents, integer"), boundary rules ("category \'other\' only if none of the above clearly apply"), and format expectations ("ISO-8601 date, or null if not stated"). This co-locates the instruction with the field it governs, which the model follows more reliably than a distant system-prompt clause, and keeps your prompt lean (module 3\'s mega-prompt anti-pattern).</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Treat schema authoring as prompt authoring: order fields as reasoning steps, close every finite field with an enum, and write descriptions as the instructions you\'d otherwise scatter through the system prompt. A model fills a self-documenting schema far better than a bag of loosely-typed fields with rules living elsewhere.</div>' +
        '<h2>Design rules that prevent the common failures</h2>' +
        '<ul>' +
        '<li><b>Model uncertainty explicitly.</b> If a field might not be extractable, give it a nullable type and say so in the description — "null if not present in the text". Otherwise the model, unable to leave a required field empty, invents a plausible value. Forced completion is a top hallucination source in extraction. An explicit "not found" path is an abstention channel (module 1).</li>' +
        '<li><b>Prefer flat and shallow.</b> Deeply nested schemas are harder for the model to fill consistently and harder for you to validate and repair. Flatten where you can; a wall of nesting is a smell.</li>' +
        '<li><b>Constrain arrays with intent, not just type.</b> "list of risk factors" invites either one vague blob or fifteen redundant ones. Say how many and how granular in the description ("2–5 distinct, specific risk factors").</li>' +
        '<li><b>Name fields for humans and models.</b> <code>customer_sentiment</code> beats <code>cs</code>; <code>refund_amount_cents</code> beats <code>amt</code>. The field name is a prompt token — clarity there is free accuracy.</li>' +
        '<li><b>Separate extraction from decision.</b> One schema that both pulls facts and renders a judgment couples two error sources. Often better: extract to a facts schema, then decide in a second call (or in code) over the extracted facts — each stage is independently evaluable and cacheable.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> An invoice extractor had a required <code>due_date</code> string field with no null path. On invoices that stated no due date, the model — forbidden from omitting a required field — confidently emitted plausible dates (usually "30 days after invoice date", which it inferred). Nothing errored: valid schema, valid-looking date, all wrong. Downstream dunning emails went out on fabricated deadlines. The fix was one line: make <code>due_date</code> nullable and add "null if the invoice does not state a due date" to its description. Required-without-null is a fabrication trap.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Strict-mode schema subsets bite here: you often cannot express "string of length 10", "integer ≥ 0", or a regex pattern in the constrained grammar. Those value constraints move to post-hoc validation (lesson 4). Design the schema for what the grammar can enforce (shape, enums, nullability) and validate the rest — don\'t assume <code>"minimum": 0</code> is doing anything.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Design the schema for extracting structured data from support tickets." Strong answers: enums for category/priority/sentiment; nullable fields with explicit "not found" semantics; a reasoning/evidence field before any classification field; descriptions carrying units and boundary rules; flat structure; and a note that value constraints (ranges, formats) go to validation because strict mode can\'t enforce them. Verdict-first field order is the tell of someone who hasn\'t done this.</div>'
    },
    {
      id: 'tool-round-trip',
      title: 'The tool-calling round trip',
      blurb: 'assistant tool_call → you execute → tool result → continuation. The loop that turns a text model into an agent.',
      html: '<h2>The core loop, precisely</h2>' +
        '<p>Tool calling (a.k.a. function calling) is structured outputs pointed at <em>your code</em> instead of a parser. The model doesn\'t run anything — it emits a structured request to run something, you run it, you feed the result back, it continues. The round trip, step by step:</p>' +
        '<ol>' +
        '<li><b>You send</b> the messages plus a list of <b>tool definitions</b> — each a name, a description (when to use it), and a JSON-Schema for its arguments. Same schema machinery as lesson 1–2; the argument schema can be <code>strict</code>.</li>' +
        '<li><b>The model responds with a tool call</b> — an assistant message whose content includes a <code>tool_call</code>/<code>tool_use</code> block: a call id, the tool name, and arguments as JSON. The <code>finish_reason</code>/<code>stop_reason</code> is <code>tool_calls</code>/<code>tool_use</code> (module 4). The model has NOT answered the user; it has asked you to do something.</li>' +
        '<li><b>You execute the tool</b> in your code — call the API, run the query, do the math — using the model\'s arguments (which you validate first, see lesson 4).</li>' +
        '<li><b>You append two messages</b>: the assistant\'s tool-call message (echoed back verbatim — it\'s part of history), then a <b>tool result message</b> carrying the same call id and the result payload (a string or JSON). The id is how the model matches result to call — critical when there are several.</li>' +
        '<li><b>You call the model again</b> with the extended history. It now either answers the user (using the tool result) or issues another tool call. Loop until it stops calling tools (<code>end_turn</code>) or you hit a step cap.</li>' +
        '</ol>' +
        '<div class="callout note"><span class="co-title">Key idea</span> The model is a planner that emits typed intents; your harness is the executor and the source of truth. Every tool result re-enters the context as plain tokens the model reads — so tool outputs are ALSO prompt engineering (lesson 6: write them for the model). The loop is just: generate → execute → observe → repeat, with the conversation as the shared state.</div>' +
        '<h2>Vendor shapes and the details that trip people</h2>' +
        '<ul>' +
        '<li><b>Message roles differ.</b> OpenAI: the tool result goes in a message with <code>role: "tool"</code> and a <code>tool_call_id</code>. Anthropic: the result is a <code>tool_result</code> content block inside a <code>user</code>-role message, referencing <code>tool_use_id</code>. Gemini: a <code>functionResponse</code> part. Same concept, three envelopes — your adapter (module 4) absorbs it.</li>' +
        '<li><b>Echo the tool-call message back unchanged.</b> Dropping or editing the assistant\'s tool-call turn before appending the result breaks the id linkage and confuses the model about what it asked. History is append-only here.</li>' +
        '<li><b>Every tool call needs a matching result before the next model turn</b> — including failures. A call left unanswered is a protocol violation (often a 400); see the parallel-call rule below.</li>' +
        '<li><b>Return errors as tool results, not exceptions.</b> If the tool fails, send a tool-result message describing the failure (an <code>is_error</code> flag where supported). The model can then apologize, retry with different arguments, or pick another tool — you\'ve handed the failure back into the loop instead of crashing it (lesson 6).</li>' +
        '<li><b><code>tool_choice</code> controls the decision.</b> <code>auto</code> (model decides), <code>required</code>/<code>any</code> (must call some tool), <code>{name}</code> (must call this one), <code>none</code> (no tools this turn). Forcing a specific tool is how you use "tool calling" purely to get a guaranteed structured extraction — define one tool matching your schema and force it.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> There is no separate "function-calling model". Tool definitions are serialized into the prompt (a system-level description of available tools and their schemas), the model was post-trained to emit tool-call-formatted tokens when appropriate, and constrained decoding (lesson 1) ensures the emitted arguments match the schema. "The model called a function" means "the model generated tokens your SDK parsed into a call and your code chose to execute". The agency is entirely yours — which is exactly why tool execution is where security and idempotency live (module 4, module 13).</div>' +
        '<h2>Parallel tool calls</h2>' +
        '<p>Modern models can request several tools in ONE assistant turn (three lookups the model knows are independent). Rules:</p>' +
        '<ul>' +
        '<li><b>Execute them concurrently</b> — that\'s the latency win the feature exists for.</li>' +
        '<li><b>Return ALL results in a single following turn</b>, each keyed to its call id, before the next model call. Splitting results across multiple turns, or omitting one, silently degrades the model\'s parallel-calling behavior over the conversation (some models learn to stop parallelizing) and can 400.</li>' +
        '<li><b>You can disable it</b> (<code>parallel_tool_calls: false</code> / provider equivalent) when your tools have ordering dependencies or shared-state hazards and you\'d rather serialize.</li>' +
        '<li><b>Mind side-effect concurrency:</b> parallel calls to a stateful tool need the same isolation any concurrent code does (module 4\'s idempotency applies).</li>' +
        '</ul>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Walk me through the tool-calling loop." Nail the five steps (send tools → model emits tool_call → you execute → append tool-call + tool-result with matching id → re-call), the roles-differ-per-vendor point, returning errors as tool results, parallel calls returned together, and that the model plans while your harness executes. "The model runs the function" is the misconception to avoid — it never runs anything.</div>'
    },
    {
      id: 'validation-repair',
      title: 'Validation and repair loops',
      blurb: 'Pydantic/Zod at the boundary, retry-with-error when it fails, and the value checks no grammar can do.',
      html: '<h2>Why you validate even with strict decoding</h2>' +
        '<p>Constrained decoding guarantees shape; it guarantees nothing about values (lesson 1). And plenty of your traffic runs on models/endpoints WITHOUT strict decoding (aggregators, JSON mode, older models), where even the shape isn\'t guaranteed. So the boundary between the model and your system needs a validation gate — the same discipline you\'d apply to any untrusted input, because model output IS untrusted input.</p>' +
        '<p>The tool of choice is a typed-model validator: <b>Pydantic</b> (Python) or <b>Zod</b> (TypeScript), also the schema source many SDKs compile the strict grammar FROM. One definition gives you: the JSON-Schema you send the model, parsing + type coercion of the response, and value constraints the grammar can\'t express. Layered checks, cheapest first:</p>' +
        '<ol>' +
        '<li><b>Parse:</b> is it JSON at all? (Only skippable under guaranteed JSON mode/strict.)</li>' +
        '<li><b>Structure:</b> right fields, right types, enum membership. (Guaranteed under strict; must-check otherwise.)</li>' +
        '<li><b>Value constraints:</b> ranges, formats, cross-field invariants (<code>end_date &gt;= start_date</code>, amount within policy, referenced id exists). <b>No grammar enforces these</b> — this is validation\'s core job even with strict decoding.</li>' +
        '<li><b>Semantic/business checks:</b> is the extracted total consistent with the line items? Does the classification make sense given the text? Often needs a second model call or a rule engine — shades into evals (module 11).</li>' +
        '</ol>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Strict decoding removes layers 1–2 as failure modes; layers 3–4 remain entirely yours. "We use structured outputs so we don\'t need validation" is the sentence that precedes the incident — structure and correctness are orthogonal.</div>' +
        '<h2>The repair loop: retry-with-error</h2>' +
        '<p>When validation fails (or JSON won\'t parse on a non-strict path), the reliable recovery is to <b>hand the model its own error and ask it to fix it</b> — the pattern popularized by Instructor and every serious extraction library:</p>' +
        '<pre><code>for attempt in range(MAX_RETRIES):      # e.g. 2\n    raw = call_model(messages)\n    try:\n        return Schema.model_validate_json(raw)   # pydantic\n    except ValidationError as e:\n        messages += [\n            {"role": "assistant", "content": raw},\n            {"role": "user", "content":\n                f"That response failed validation:\\n{e}\\n"\n                f"Return corrected JSON matching the schema. No other text."},\n        ]\nraise ExtractionFailed()                 # fall through: dead-letter / human / default</code></pre>' +
        '<p>Why it works: the error message is precise, localized feedback ("field \'amount\' must be ≥ 0; got -50"), and models are good at applying a specific correction to their own draft — better than at getting it right in one shot under a hard schema. Discipline that keeps it from becoming a cost/latency sink:</p>' +
        '<ul>' +
        '<li><b>Cap retries hard</b> (1–2). Repair converges fast or not at all; a 5-retry loop on a fundamentally confused input just multiplies cost and latency for the same failure.</li>' +
        '<li><b>Feed the SPECIFIC error</b>, not "that was wrong". Pydantic/Zod error strings are already model-readable — pass them through. Vague feedback yields vague re-attempts.</li>' +
        '<li><b>Have a terminal fallback</b>: after max retries, route to a dead-letter queue, a human, or a safe default — never loop forever, never silently drop.</li>' +
        '<li><b>Log every repair.</b> A route with a rising repair rate is telling you the prompt or schema is wrong (or the model regressed); repairs are a metric, not just a mechanism. If a route repairs 30% of the time, fix the schema — don\'t pay the retry tax forever.</li>' +
        '<li><b>Strict decoding shrinks the loop, doesn\'t delete it.</b> With strict shape, repairs only trigger on value/semantic failures — but those still happen, so keep the loop for layers 3–4.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team\'s repair loop had no cap and fed back only "invalid, try again". On a class of ambiguous inputs the model was <em>structurally</em> fine but kept failing a cross-field business rule it couldn\'t satisfy from the given data; each retry produced another plausible-but-noncompliant object. The loop ran until a request timeout — 20+ model calls per bad input, at full price, during a traffic spike that made the ambiguous inputs common. Two fixes: cap at 2 retries with a dead-letter fallback, and feed the exact rule that failed so the model could recognize the data simply couldn\'t satisfy it (and return the nullable "insufficient data" path the schema should have had). Repair loops without caps and specific feedback are cost incidents waiting for the right input distribution.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How do you make LLM JSON output production-reliable?" The layered answer: constrained/strict decoding for shape where available, a typed validator (Pydantic/Zod) at the boundary for values and cross-field rules, a capped retry-with-specific-error repair loop, a terminal fallback (dead-letter/human/default), and repair-rate as a monitored metric. Saying "just use structured outputs" misses that values and business rules are never guaranteed.</div>'
    },
    {
      id: 'failure-modes',
      title: 'Failure modes of tool-using models',
      blurb: 'Hallucinated tools and args, over-eager and under-eager calling, and the empty-schema trap.',
      html: '<h2>The recurring ways tool use goes wrong</h2>' +
        '<p>Tool calling adds a new surface of failure on top of generation. The catalog, with the fix for each — because each has a specific cause, and "prompt harder" is rarely it:</p>' +
        '<h3>Hallucinated tool names and arguments</h3>' +
        '<p>The model calls a tool that doesn\'t exist (<code>get_weather</code> when you defined <code>weather_lookup</code>), or invents arguments the schema didn\'t define, or fills a valid argument with a fabricated value (a made-up account id, a plausible-but-wrong date). Constrained decoding kills the <em>name</em> and <em>schema</em> variants — the sampler can only emit defined tool names and schema-valid arguments. It does NOT kill fabricated <em>values</em> in valid fields (module 1: structure ≠ truth). Defenses: strict decoding for name/shape; validate argument <em>semantics</em> before executing (does this account id exist? is this amount within bounds?); return "not found / invalid" as a tool result so the model corrects rather than acting on a fabrication.</p>' +
        '<h3>Over-eager calling</h3>' +
        '<p>The model calls a tool when it shouldn\'t — searches the web to answer "what is 2+2", calls an expensive API for something in context, or fires a side-effectful tool speculatively. Causes: aggressive tool descriptions ("ALWAYS use this tool"), too many tools crowding the decision, or (module 3) inherited "CRITICAL: use X" scaffolding on a modern literal-following model. Fixes: neutral description wording ("Use when the answer requires live data not in the conversation"), fewer tools, and gating side-effectful tools behind confirmation (module 4/13). Over-eager calling is often a prompt/description smell, not a model defect.</p>' +
        '<h3>Under-eager calling (ignoring tools)</h3>' +
        '<p>The opposite: the model answers from parametric memory instead of using the authoritative tool — quoting a stale price it "knows" rather than calling <code>get_price</code>. Causes: weak/absent "when to use" guidance, the answer feeling in-distribution so the model is overconfident, or the tool buried among many. Fixes: descriptions that state the trigger condition crisply; for must-use paths, <code>tool_choice: required</code> or forcing the specific tool; and evals that specifically catch "should have called the tool but didn\'t", which no generic accuracy metric surfaces.</p>' +
        '<h3>The empty-schema trap</h3>' +
        '<p>A subtle, common one: a tool defined with an empty or trivial argument schema (<code>{}</code>, or all-optional fields) gives the model no structure to reason into, and models call under-specified tools erratically — calling with no arguments when arguments were needed, or not calling because the tool looks like it does nothing. Symptom: a tool that "sometimes just doesn\'t get called right". Fix: give even simple tools a meaningful, well-described argument (a <code>query</code>, a <code>reason</code>), which both improves calling reliability and gives you a log of the model\'s intent. Empty schemas are also a prompt-caching and debuggability loss.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A support agent had 24 tools, several with overlapping descriptions and three with empty argument schemas ("escalate", "log", "acknowledge"). Behavior was chaotic: it escalated tickets it should have answered, ignored the search tool for questions that needed it, and called the empty-schema "log" tool at random moments. Nothing was individually broken. The fix was structural (module 3\'s decomposition applied to tools): cut to 6 orthogonal tools, gave each a typed argument and a crisp when-to-use description, and forced the search tool on the retrieval route. Tool-selection reliability collapses with too many overlapping, under-specified tools long before any single tool is wrong.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Tool-selection accuracy degrades as the tool count climbs — well before the context limit, because it\'s an attention/decision problem (module 1), not a capacity one. As of early 2026, keep the active tool set small (single digits to low tens); past that, use tool-search/dynamic tool loading (RAG for tools) so only relevant tools are in context per request, or route to sub-agents each holding a focused toolset (module 12). Also: side-effectful tools need human-in-the-loop gates regardless of model quality — a confident wrong call that sends money is not a prompting problem.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your agent calls the wrong tools — how do you debug?" Enumerate the modes (hallucinated name/args vs values, over- vs under-eager, empty-schema), map each to a cause (aggressive descriptions, too many tools, weak triggers, under-specified schemas) and a fix (strict decoding, description wording, tool_choice, argument design, decomposition). Reaching for "add more instructions" first is the junior tell; the seniors reduce and restructure the tool set.</div>'
    },
    {
      id: 'tool-design-principles',
      title: 'Tool design principles',
      blurb: 'Few, orthogonal, typed, described — and error messages written for the model to read.',
      html: '<h2>Design the tool surface like an API for a smart, literal consumer</h2>' +
        '<p>Everything in lesson 5 has a preventive dual: most tool-use failures are designed in. The tool surface is an interface whose consumer is a model — apply API-design discipline, tuned for that consumer. Five principles that carry most of the reliability:</p>' +
        '<h3>Few</h3>' +
        '<p>Fewer tools = better selection. Each added tool dilutes attention over the decision and adds overlap risk. Prefer a handful of capable tools over dozens of narrow ones. When the surface genuinely needs to be large, don\'t put it all in context — use tool search / dynamic loading (relevant tools retrieved per request) or sub-agents with focused toolsets (module 12). "One tool per API endpoint" is how you get 40 tools and chaotic selection; group by capability instead.</p>' +
        '<h3>Orthogonal</h3>' +
        '<p>Tools should have clear, non-overlapping responsibilities. If two tools could plausibly handle the same request, the model will pick inconsistently and you\'ll debug a coin flip. Overlapping tools (<code>search_docs</code>, <code>find_document</code>, <code>lookup_reference</code>) are the classic mess — collapse them. Each tool should answer "when EXACTLY would I use this and not the others?" in one sentence; if it can\'t, redesign.</p>' +
        '<h3>Typed</h3>' +
        '<p>Give every tool a meaningful, strict-schema argument set (lesson 2\'s schema design applies wholesale): enums for finite choices, descriptions carrying units and rules, nullable for genuinely optional, and never the empty-schema trap (lesson 5). Typed arguments improve calling reliability, enable constrained decoding to eliminate malformed calls, and give you a structured log of intent. A tool\'s argument schema is as load-bearing as an output schema.</p>' +
        '<h3>Described (for the model, at the decision point)</h3>' +
        '<p>The tool description is a prompt read at selection time. State the TRIGGER, not just the capability: "Use when the user asks about current order status; requires an order_id" beats "Gets order info". Put the when-to-use decision, the required inputs, and any important caveats right in the description — that\'s where the model is looking when it decides. Neutral, specific wording avoids the over-eager trap (lesson 5); crisp triggers avoid the under-eager one.</p>' +
        '<h3>Error messages written for the model</h3>' +
        '<p>This is the principle people skip and it pays the most. When a tool fails, the tool-result message re-enters the model\'s context (lesson 3) — so <b>write the error for a model that will read it and decide what to do next</b>, not for a log file. Compare:</p>' +
        '<pre><code># Useless to the model\n"Error: 404"\n"Exception: NullPointerException at line 42"\n\n# Actionable — tells the model what happened and what to do\n"No order found with id \'AB-12\'. Order ids look like \'ORD-00123\'. \n Ask the user to confirm the id, or use search_orders by customer email."</code></pre>' +
        '<p>A good tool error turns a dead end into a recovery: the model re-prompts the user, fixes the argument, or switches tools. This is the same idea as the repair loop (lesson 4) — specific, actionable feedback fed back into the model\'s decision — applied to tool execution. Include what failed, why, the expected format, and the suggested next action.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Tool reliability is designed in, not prompted in: few and orthogonal tools so selection is easy; typed, well-described arguments so calls are well-formed and correctly triggered; and errors written as instructions to the model so failures become recoveries. A clean tool surface needs far less system-prompt babysitting than a sprawling one.</div>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Tool definitions live in the prompt prefix, so they interact with caching (module 3): a stable, deterministically-serialized tool list caches; a per-request-generated or reordered one invalidates the whole prefix every call. Design the tool set once, serialize it with sorted keys, and keep it fixed across a session — reliability AND cost both reward a stable, well-designed surface.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A payments agent returned raw exceptions as tool results (<code>"HTTPError: 402"</code>). The model, given an opaque error, would either retry the identical failing call in a loop or apologize vaguely to the user without resolving anything. Rewriting tool errors to be model-directed — <code>"Payment declined: insufficient funds. Do not retry the same card. Ask the user for an alternative payment method or a smaller amount."</code> — changed behavior overnight: the model started handling declines gracefully, retries dropped, and resolution rate climbed. The model was always capable; it had just been handed errors written for a stack trace, not a decision.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "What makes a good tool for an LLM agent?" The five principles: few, orthogonal, typed (meaningful strict schemas, no empty-schema trap), described with when-to-use triggers, and — the differentiator — error messages written for the model to read and act on. Tie it back: most lesson-5 failure modes are prevented by these, and a clean tool surface needs far less prompt scaffolding. Mentioning tool-list stability for caching shows end-to-end thinking.</div>'
    }
  ],
  quiz: [
    {
      text: 'You enable OpenAI JSON mode (response_format json_object) and parse failures drop to zero. A teammate proposes deleting the schema validation layer "since output is always valid JSON now". What is wrong with this?',
      options: [
        'Nothing — JSON mode guarantees the output matches your schema',
        'JSON mode guarantees only syntactic validity (it parses); it does NOT guarantee your fields, types, enum membership, or nesting. Schema validation catches conformance failures JSON mode allows',
        'JSON mode is slower, so validation is needed for performance',
        'Validation is only needed for streaming responses'
      ],
      answer: [1],
      explanation: 'JSON mode ensures the bytes parse as JSON — no fences, no preamble, balanced braces — and nothing about your schema. Missing/extra fields, wrong types, out-of-set enums, and unexpected nesting all still occur. Only constrained/strict decoding guarantees the SHAPE (and even that never guarantees correct VALUES). (A) is the exact misconception. (C) performance is unrelated to the guarantee gap. (D) validation applies to all response modes.'
    },
    {
      text: 'You switch from JSON mode to strict/constrained decoding with a full json_schema. Which failure classes does this eliminate, and which remain? Choose the accurate statement.',
      options: [
        'It eliminates all failures — output is now guaranteed correct',
        'It eliminates syntactic invalidity and schema-shape violations (wrong fields/types, out-of-set enums, extra keys); it does NOT eliminate wrong VALUES (a fabricated date in a date field, a hallucinated-but-valid amount)',
        'It eliminates wrong values but not structural errors',
        'It only helps with streaming; non-streaming still needs a parser fallback'
      ],
      answer: [1],
      explanation: 'Constrained decoding masks illegal tokens at the sampler, so the output cannot violate the schema\'s structure — shape failures vanish. But the model still chooses among legal tokens by probability, so it can place a plausible wrong value in a correctly-typed field. Structure is not correctness. (A) overclaims. (C) inverts the guarantee. (D) the guarantee is independent of streaming.'
    },
    {
      text: 'An extraction schema is {"approved": bool, "reasoning": str, "risk_factors": [str]}. Accuracy on borderline cases is poor. What is the mechanistically-grounded first fix?',
      options: [
        'Add "think carefully" to the field descriptions',
        'Reorder to {"risk_factors": [str], "reasoning": str, "approved": bool} so the evidence and reasoning are generated BEFORE the verdict conditions on them',
        'Change bool to an enum of "yes"/"no"',
        'Raise max_tokens so the model has more room'
      ],
      answer: [1],
      explanation: 'Fields generate top-to-bottom and each conditions the next; emitting "approved" first commits the verdict with zero written analysis, making the trailing reasoning post-hoc. Evidence/reasoning-first field order is chain-of-thought embedded in the schema — free accuracy at no token cost. (A) prompt-begging in a description doesn\'t change generation order. (C) enum-vs-bool doesn\'t address the ordering problem. (D) max_tokens caps length, not reasoning-before-verdict.'
    },
    {
      text: 'An invoice extractor has a required (non-nullable) due_date string field. On invoices with no stated due date, it confidently outputs plausible fabricated dates. Why, and what is the fix?',
      options: [
        'The model is broken; switch providers',
        'A required field cannot be omitted, so the model — forbidden from leaving it empty — invents a plausible value. Make due_date nullable and describe "null if the invoice states no due date," giving the model an abstention path',
        'Raise temperature so the model is less confident',
        'Add "do not hallucinate" to the system prompt'
      ],
      answer: [1],
      explanation: 'Forced completion of required fields is a top hallucination source in extraction: the schema forbids emptiness, so the model fills the gap with a plausible guess. An explicit nullable "not found" path is the abstention channel. (A) it\'s a schema-design issue, not a model defect. (C) temperature changes variance, not the requiredness constraint. (D) a vague instruction can\'t override a structural must-fill.'
    },
    {
      text: 'Put the tool-calling round trip in order. The correct sequence of your actions after sending tools + messages is:',
      options: [
        'Model emits tool_call → you execute the tool → you append the assistant tool-call message AND a tool-result message with the matching call id → you call the model again with the extended history',
        'Model emits tool_call → you call the model again immediately → it executes the tool itself → returns the answer',
        'You execute the tool first → then send it to the model → the model decides whether it was needed',
        'Model returns the final answer with the tool result already applied; no second call needed'
      ],
      answer: [0],
      explanation: 'The model plans (emits a typed tool_call) but never executes; your harness runs the tool, appends BOTH the assistant tool-call turn (echoed verbatim) and a tool-result turn carrying the same call id, then re-invokes the model, which now answers or calls again. (B) the model cannot execute anything. (C) you execute in response to a call, not preemptively. (D) tool calling is inherently multi-turn — the result must go back for the model to use it.'
    },
    {
      text: 'Your agent makes three parallel tool calls in one assistant turn. You execute all three but return the results one at a time across three separate user turns. What are the likely consequences? Choose TWO.',
      options: [
        'A protocol/400 error, or the provider rejecting the malformed turn structure',
        'The model may learn to stop making parallel calls over the conversation, hurting latency',
        'The results are automatically merged, so nothing happens',
        'Token cost drops because results are spread out',
        'The tool ids become irrelevant once execution completes'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'The protocol expects all results for a parallel batch returned together (each keyed to its call id) before the next model turn; splitting them can 400 and, where tolerated, degrades the model\'s parallel-calling behavior — some models learn to serialize. (C) there is no auto-merge; you control the turn structure. (D) spreading results doesn\'t reduce tokens. (E) ids are exactly how results match calls — never irrelevant.'
    },
    {
      text: 'A tool fails (the downstream API returns 404). What should your code send back to the model, and why?',
      options: [
        'Raise an exception and crash the request — the model can\'t help with a 404',
        'A tool-result message (with is_error where supported) describing the failure in model-actionable terms — e.g. "No order found for id X; ids look like ORD-00123; confirm the id or use search_orders" — so the model can recover',
        'An empty tool result, so the model tries again',
        'Silently substitute a default value and continue'
      ],
      answer: [1],
      explanation: 'Tool errors re-enter the context as tokens the model reads, so a well-written error turns a dead end into a recovery: the model re-prompts the user, fixes the argument, or switches tools. Write it for the model, not the log. (A) crashing throws away the model\'s ability to handle the failure gracefully. (C) an empty result gives the model nothing to act on — it retries blindly. (D) silent defaults corrupt data and hide the failure (the fabrication/JSON-mode-deletion family of bug).'
    },
    {
      text: 'You want to use "tool calling" purely to force a guaranteed structured extraction (no actual tools to run). What is the idiomatic way?',
      options: [
        'Set temperature to 0 and ask nicely in the prompt',
        'Define one tool whose argument schema is your target schema (strict), set tool_choice to force that specific tool, and read the extraction from the tool-call arguments',
        'Use JSON mode, which guarantees the schema',
        'It is impossible; tool calling always requires executing something'
      ],
      answer: [1],
      explanation: 'Forcing a single strict-schema tool via tool_choice is the standard way to get constrained-decoding structural guarantees for extraction — the "tool" is never executed; you just read its arguments. (A) temperature 0 doesn\'t constrain structure. (C) JSON mode guarantees validity, not your schema. (D) tool CALLS need not be executed — forcing one is a common structured-output pattern (many libraries, e.g. Instructor, are built on it).'
    },
    {
      text: 'Which value/consistency checks must live in your validation layer because constrained decoding cannot enforce them? Choose TWO.',
      options: [
        'end_date must be greater than or equal to start_date (cross-field invariant)',
        'refund_amount must be an integer (a type constraint)',
        'refund_amount must be within the customer\'s eligible balance (a business rule)',
        'the priority field must be one of a fixed enum set',
        'the output must be syntactically valid JSON'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'Cross-field invariants and business rules depend on values and external state — no grammar can enforce them, so they belong in Pydantic/Zod validators (and sometimes a second model call). (B) type and (D) enum membership ARE enforceable by strict decoding. (E) syntactic validity is guaranteed by JSON mode and strict decoding. The lesson: strict decoding removes shape failures; values and invariants remain your job.'
    },
    {
      text: 'Your retry-with-error repair loop has no cap and feeds back only "invalid, try again". On ambiguous inputs it runs 20+ model calls until a timeout. What are the correct fixes? Choose TWO.',
      options: [
        'Cap retries at 1–2 with a terminal fallback (dead-letter queue, human, or safe default)',
        'Feed the SPECIFIC validation error (e.g. the Pydantic message) so the model applies a targeted correction',
        'Remove the retry loop entirely and accept all failures',
        'Increase the retry cap to 10 so it always eventually succeeds',
        'Switch to a larger model for every request'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'Repair converges fast or not at all: cap at 1–2 with a terminal fallback (never loop to timeout), and feed the exact error since models apply specific corrections well and vague feedback yields vague retries. (C) throws away a genuinely useful recovery mechanism. (D) more retries on a fundamentally unsatisfiable input just multiplies cost — the war-story failure. (E) a bigger model doesn\'t fix an unbounded loop or vague feedback, and overpays every request.'
    },
    {
      text: 'Your agent has 24 tools, several with overlapping descriptions and three with empty ({}) argument schemas. It escalates tickets it should answer, ignores the search tool, and calls the empty-schema "log" tool randomly. What is the primary fix?',
      options: [
        'Add "CRITICAL: choose the right tool" to the system prompt',
        'Restructure the tool surface: cut to a few orthogonal tools, give each a meaningful typed argument and a crisp when-to-use description, and force the search tool on the retrieval route',
        'Increase the context window so all 24 tools fit more comfortably',
        'Raise temperature so the model explores tools more'
      ],
      answer: [1],
      explanation: 'Tool-selection reliability collapses with many overlapping, under-specified tools — an attention/decision problem, not a capacity one. The fix is structural: fewer, orthogonal, typed, well-described tools (and tool_choice for must-use paths). (A) aggressive prompting fights a design problem and over-triggers on modern models. (C) the tools already fit; the window isn\'t the limit. (D) more exploration makes erratic selection worse.'
    },
    {
      text: 'What is the "empty-schema trap" and why does it hurt tool reliability?',
      options: [
        'A tool with no return value, which crashes the loop',
        'A tool defined with an empty or all-optional argument schema gives the model no structure to reason into, so it calls the tool erratically (no args when args were needed, or not at all). Fix: give even simple tools a meaningful, described argument',
        'A schema that is too large to fit in context',
        'A validation error caused by additionalProperties: false'
      ],
      answer: [1],
      explanation: 'Empty/trivial argument schemas leave the model nothing to condition on, producing inconsistent calling — the classic "this tool sometimes just doesn\'t get called right". Adding a meaningful argument (a query, a reason) improves calling reliability AND logs the model\'s intent. (A) return values aren\'t the issue. (C) empty schemas are small, not large. (D) additionalProperties:false is a strictness setting, unrelated.'
    },
    {
      text: 'Your tool returns raw errors like "HTTPError: 402" as tool results. The model loops retrying the same failing call or apologizes vaguely. What single change most improves behavior?',
      options: [
        'Retry the tool automatically in your code before returning to the model',
        'Rewrite tool errors as model-directed instructions: "Payment declined: insufficient funds. Do not retry the same card. Ask the user for another payment method or a smaller amount." — turning the failure into a recovery path',
        'Return the error as a system prompt update instead',
        'Suppress the error and return an empty result'
      ],
      answer: [1],
      explanation: 'Tool results re-enter the context as tokens the model reads and acts on; an opaque code gives it nothing to reason with, while a model-directed error (what failed, why, what NOT to do, what to do next) converts dead ends into graceful handling. (A) blind auto-retry doesn\'t fix a 402 (insufficient funds won\'t resolve by retrying) and hides the real recovery. (C) errors belong in the tool-result channel tied to the call, not the system prompt. (D) suppression is the silent-failure anti-pattern.'
    },
    {
      text: 'Which set best captures the tool-design principles that prevent most tool-use failure modes?',
      options: [
        'Many specialized tools, loose schemas, brief names, and terse error codes for efficiency',
        'Few and orthogonal tools; typed arguments with meaningful strict schemas (no empty-schema trap); descriptions stating the when-to-use trigger; and error messages written for the model to read and act on',
        'One giant do-everything tool with a free-form string argument',
        'As many tools as possible so the model always has an option, with automatic selection left entirely to the model'
      ],
      answer: [1],
      explanation: 'The five principles — few, orthogonal, typed, described-with-triggers, model-directed errors — are the preventive duals of lesson 5\'s failure modes: they make selection easy, calls well-formed and correctly triggered, and failures recoverable, so the surface needs far less prompt babysitting. (A) inverts every principle. (C) a free-form mega-tool loses all the structural guarantees. (D) more tools degrade selection accuracy well before the context limit.'
    }
  ],
  flashcards: [
    { id: 'fc-three-mech', front: 'The three "return JSON" mechanisms and their guarantees?', back: 'Prompted JSON: no guarantee (parse defensively). JSON mode: syntactically valid JSON only, NOT your schema. Constrained/strict decoding (grammar-masked sampler): guaranteed to match the schema SHAPE — but never guarantees correct VALUES.' },
    { id: 'fc-constrained-mech', front: 'How does constrained decoding work mechanically?', back: 'The schema compiles to a state machine; at each token the engine masks every schema-illegal token to −∞ before sampling, so an invalid token is impossible. Structure is forced; the model still picks legal content by probability.' },
    { id: 'fc-structure-not-truth', front: 'Structure vs correctness — the load-bearing distinction?', back: 'Constrained decoding guarantees the OUTPUT SHAPE is valid; it says nothing about whether the values are RIGHT. A strict schema happily accepts a hallucinated date in a date field. Values still need validation and evals.' },
    { id: 'fc-strict-limits', front: 'What can strict-mode schemas usually NOT enforce?', back: 'Numeric/string constraints (minimum, maxLength), regex patterns, recursion — commonly unsupported. Optional is usually required+nullable, not omission. Value constraints move to post-hoc validation. A rejected schema is a 400.' },
    { id: 'fc-field-order', front: 'Why does schema field order matter?', back: 'Fields generate top-to-bottom, each conditioning the next. Put reasoning/evidence fields BEFORE the fields that depend on them (verdict last). Verdict-first commits with zero analysis — reordering is free accuracy.' },
    { id: 'fc-enums', front: 'Why prefer enums over free-string fields?', back: 'Constrained decoding makes out-of-set values impossible; you get canonicalization free (no High/high/HIGH drift); downstream can switch without normalizing; and the enum list teaches the model the taxonomy. Close every finite field.' },
    { id: 'fc-descriptions', front: 'What role do JSON-Schema descriptions play?', back: 'They are sent to the model as per-field prompts. Use them for units, boundary rules, and format expectations, co-located with the field they govern — followed more reliably than distant system-prompt clauses, and they keep the prompt lean.' },
    { id: 'fc-nullable', front: 'Why must "not extractable" fields be nullable?', back: 'A required field cannot be omitted, so the model invents a plausible value rather than leave it empty — a top extraction-hallucination source. A nullable type + "null if not present" description is the abstention path.' },
    { id: 'fc-round-trip', front: 'The tool-calling round trip in five steps?', back: '1) Send messages + tool definitions. 2) Model emits a tool_call (stop_reason tool_use). 3) You execute the tool. 4) Append the assistant tool-call turn + a tool-result turn with the matching call id. 5) Re-call the model; loop until end_turn.' },
    { id: 'fc-model-plans', front: 'Who executes tools in tool calling?', back: 'You do. The model only emits a typed request; your harness runs the tool and feeds the result back. "The model called a function" = it generated tokens your SDK parsed and your code chose to execute. Agency (and security) is yours.' },
    { id: 'fc-tool-errors-back', front: 'How should tool failures be returned to the model?', back: 'As a tool-result message (is_error where supported) describing the failure in model-actionable terms — never as an exception that crashes the loop. This hands the failure back so the model can retry, re-prompt, or switch tools.' },
    { id: 'fc-parallel', front: 'Rules for parallel tool calls?', back: 'Execute concurrently (the latency win); return ALL results in ONE following turn, each keyed to its call id, before the next model call. Splitting them can 400 and trains the model to stop parallelizing. Disable it for ordering-dependent tools.' },
    { id: 'fc-tool-choice', front: 'What does tool_choice control?', back: 'auto (model decides), required/any (must call some tool), {name} (must call this one), none (no tools). Forcing one strict-schema tool is the idiomatic way to get guaranteed structured extraction with no execution.' },
    { id: 'fc-validate-layers', front: 'The four validation layers, and which strict decoding removes?', back: 'Parse (JSON?), structure (fields/types/enums), value constraints (ranges, formats, cross-field), semantic/business rules. Strict decoding removes 1–2; layers 3–4 (values, invariants, business logic) are always yours.' },
    { id: 'fc-repair-loop', front: 'The retry-with-error repair loop — and its guardrails?', back: 'On validation failure, feed the model its SPECIFIC error and ask for corrected output. Guardrails: cap at 1–2 retries, pass the exact error (not "try again"), terminal fallback (dead-letter/human/default), and monitor repair rate as a signal.' },
    { id: 'fc-hallucinated-tools', front: 'Hallucinated tool names/args vs values — what does strict decoding fix?', back: 'Strict decoding kills invented tool NAMES and schema-invalid ARGS (sampler can only emit defined names/valid shapes). It does NOT fix fabricated VALUES in valid fields — validate argument semantics (does this id exist?) before executing.' },
    { id: 'fc-over-under-eager', front: 'Over-eager vs under-eager tool calling — causes and fixes?', back: 'Over-eager (calls when it shouldn\'t): aggressive descriptions, too many tools → neutral wording, fewer tools, confirmation gates. Under-eager (ignores tools, answers from memory): weak triggers → crisp when-to-use, tool_choice required, targeted evals.' },
    { id: 'fc-empty-schema', front: 'What is the empty-schema trap?', back: 'A tool with an empty/all-optional argument schema gives the model no structure to reason into, so it calls erratically. Fix: give even simple tools a meaningful, well-described argument (a query, a reason) — improves reliability and logs intent.' },
    { id: 'fc-tool-count', front: 'How does tool count affect reliability?', back: 'Selection accuracy degrades as tools grow — an attention/decision problem, not a capacity one, so it hits well before the context limit. Keep the active set small; use tool-search/dynamic loading or sub-agents for large surfaces.' },
    { id: 'fc-tool-principles', front: 'The five tool-design principles?', back: 'Few (easy selection), orthogonal (no overlap → no coin-flip choice), typed (meaningful strict schemas, no empty-schema trap), described (state the when-to-use trigger at the decision point), and error messages written for the model to read and act on.' }
  ],
  lab: {
    title: 'Constrain, break, and repair: structured outputs end to end',
    intro: '<p>Four short experiments that make the guarantees concrete: watch strict decoding forbid a shape violation, prove JSON mode does NOT enforce your schema, run a capped repair loop with real Pydantic errors, and drive a full tool-call round trip. OpenAI shown (strict + tools); notes for Anthropic and local engines.</p><p><b>Needs:</b> <code>python3</code>, <code>pip install openai pydantic</code>, an API key. Worst case ~$0.10.</p>',
    steps: [
      {
        title: 'Strict decoding vs JSON mode: the guarantee gap',
        html: '<pre><code>pip install openai pydantic\n\npython3 - &lt;&lt;\'EOF\'\nfrom openai import OpenAI\nimport json\nc = OpenAI()\n\nSCHEMA = {"type":"object","additionalProperties":False,\n  "required":["sentiment","score"],\n  "properties":{\n    "sentiment":{"type":"string","enum":["positive","negative","neutral"]},\n    "score":{"type":"integer"}}}\n\ntext = "The product is fine, nothing special."\n\n# JSON mode: valid JSON, but schema NOT enforced\nr1 = c.chat.completions.create(model="gpt-4o-mini",\n  response_format={"type":"json_object"},\n  messages=[{"role":"user","content":\n    f"Return JSON with sentiment and score for: {text}"}])\nprint("json_mode:", r1.choices[0].message.content)\n\n# Strict: schema enforced at the sampler\nr2 = c.chat.completions.create(model="gpt-4o-mini",\n  response_format={"type":"json_schema","json_schema":\n    {"name":"s","strict":True,"schema":SCHEMA}},\n  messages=[{"role":"user","content":f"Classify: {text}"}])\nprint("strict   :", r2.choices[0].message.content)\nprint("enum honored:", json.loads(r2.choices[0].message.content)["sentiment"] in\n      ["positive","negative","neutral"])\nEOF</code></pre>' +
          '<p>Run several times. JSON-mode output is valid JSON but its field names/shape can wander (extra keys, a nested wrapper, a string score); the strict output always matches the schema exactly and the enum is always in-set. You have just observed the difference between "parses" and "conforms". (Anthropic: define a tool with this schema + <code>tool_choice</code> forcing it. Local: llama.cpp GBNF / Outlines.)</p>'
      },
      {
        title: 'Field order changes the answer',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nfrom openai import OpenAI\nc = OpenAI()\n\nCASE = ("Loan: applicant income $30k, requested $200k, credit score 610, "\n        "existing debt $85k. Approve?")\n\ndef schema(order):\n    props = {\n      "verdict":{"type":"string","enum":["approve","deny"]},\n      "risk_factors":{"type":"array","items":{"type":"string"}},\n      "reasoning":{"type":"string"}}\n    return {"type":"object","additionalProperties":False,\n            "required":order,\n            "properties":{k:props[k] for k in order}}\n\nfor order in (["verdict","risk_factors","reasoning"],\n              ["risk_factors","reasoning","verdict"]):\n    r = c.chat.completions.create(model="gpt-4o-mini",\n      response_format={"type":"json_schema","json_schema":\n        {"name":"s","strict":True,"schema":schema(order)}},\n      messages=[{"role":"user","content":CASE}])\n    print(order[0], "first ->", r.choices[0].message.content[:120])\nEOF</code></pre>' +
          '<p>Run each 5×. Verdict-first tends to commit before listing risks (and defends whatever it committed to); evidence-first surfaces the risk factors and lets the verdict condition on them. Same schema fields, different reasoning quality — decided entirely by order.</p>'
      },
      {
        title: 'A capped repair loop with real validation errors',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nfrom openai import OpenAI\nfrom pydantic import BaseModel, field_validator, ValidationError\nc = OpenAI()\n\nclass Refund(BaseModel):\n    amount_cents: int\n    reason: str\n    @field_validator("amount_cents")\n    @classmethod\n    def non_negative(cls, v):\n        if v &lt; 0: raise ValueError("amount_cents must be &gt;= 0")\n        if v &gt; 50000: raise ValueError("amount_cents must be &lt;= 50000 (policy cap)")\n        return v\n\nmsgs = [{"role":"user","content":\n  "Extract a refund of MINUS 300 dollars for a late shipment as JSON "\n  "{amount_cents:int, reason:str}."}]  # deliberately provokes a value error\n\nfor attempt in range(2):\n    raw = c.chat.completions.create(model="gpt-4o-mini",\n      response_format={"type":"json_object"}, messages=msgs\n      ).choices[0].message.content\n    try:\n        print("OK:", Refund.model_validate_json(raw)); break\n    except ValidationError as e:\n        print(f"attempt {attempt+1} failed; feeding error back")\n        msgs += [{"role":"assistant","content":raw},\n                 {"role":"user","content":\n                  f"That failed validation:\\n{e}\\nReturn corrected JSON only."}]\nelse:\n    print("gave up after 2 tries -> dead-letter")\nEOF</code></pre>' +
          '<p>Watch the model correct itself once you hand it the exact Pydantic error (it usually flips the sign or clamps to the cap on retry). Change the max from 2 to a high number and give it a genuinely unsatisfiable rule to see why an uncapped loop is a cost incident — then put the cap back.</p>'
      },
      {
        title: 'A full tool-call round trip',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json\nfrom openai import OpenAI\nc = OpenAI()\n\nTOOLS = [{"type":"function","function":{\n  "name":"get_order_status","description":\n    "Look up an order\'s status. Use when the user asks about an order; needs order_id like ORD-00123.",\n  "parameters":{"type":"object","additionalProperties":False,\n    "required":["order_id"],\n    "properties":{"order_id":{"type":"string"}}},"strict":True}}]\n\ndef get_order_status(order_id):        # your executor + model-directed errors\n    db = {"ORD-00123":"shipped"}\n    if order_id in db: return {"status": db[order_id]}\n    return {"error": f"No order {order_id}. Ids look like ORD-00123. Ask the user to confirm."}\n\nmsgs = [{"role":"user","content":"Where is my order ORD-00123?"}]\nr = c.chat.completions.create(model="gpt-4o-mini", tools=TOOLS, messages=msgs)\nm = r.choices[0].message\nif m.tool_calls:\n    call = m.tool_calls[0]\n    args = json.loads(call.function.arguments)\n    result = get_order_status(**args)\n    msgs += [m,                                   # echo the assistant tool-call turn\n             {"role":"tool","tool_call_id":call.id,\n              "content":json.dumps(result)}]      # result keyed to the call id\n    final = c.chat.completions.create(model="gpt-4o-mini", tools=TOOLS, messages=msgs)\n    print(final.choices[0].message.content)\nEOF</code></pre>' +
          '<p>Trace the five steps live. Then feed a bad id ("ORD-999") and watch the model-directed error let the model recover instead of dead-ending. Swap the error for a bare <code>{"error":"404"}</code> and compare — the difference IS lesson 6.</p>'
      }
    ],
    costNote: 'Worst case ≈ $0.10 across all four steps on gpt-4o-mini-class pricing (a few dozen short calls; the repair step is capped at 2 retries). Nothing persistent is created — no cleanup. Free variant: run steps 2–4 against a local Ollama/llama.cpp server; step 1\'s strict guarantee needs an engine exposing grammar-constrained decoding (llama.cpp GBNF, Outlines, or vLLM guided decoding).'
  }
});
