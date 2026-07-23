/* Speed drill: scenario phrase → the technique/tool to reach for.
   Keep answers short & canonical — they double as the distractor pool. */
COURSE.registerDrills({
  id: 'main',
  items: [
    { prompt: 'need grounded answers over private docs', answer: 'RAG', why: 'Private + factual + frequently changing = retrieval into context, not fine-tuning.' },
    { prompt: 'model invents API parameters that don\'t exist', answer: 'structured outputs / schema validation', why: 'Constrain generation to a JSON schema and validate — don\'t prompt-beg for correctness.' },
    { prompt: 'reduce cost 10× on simple queries', answer: 'model routing', why: 'Route easy traffic to a small model, escalate hard cases to the frontier tier.' },
    { prompt: 'agent loops forever retrying the same failing tool', answer: 'step budgets / stop conditions', why: 'Cap iterations and define failure exits — loops don\'t self-terminate reliably.' },
    { prompt: 'answers cite facts from the middle of a long context poorly', answer: 'context engineering', why: '“Lost in the middle”: reorder, trim, or summarize — position matters, size isn\'t free.' },
    { prompt: 'same system prompt re-sent 100k times a day', answer: 'prompt caching', why: 'Stable prefixes get cached-input pricing — often a 90% discount on that slice.' },
    { prompt: 'need to know if the new prompt is actually better', answer: 'evals / golden set', why: 'Vibes don\'t survive contact with traffic; regression-test prompts like code.' },
    { prompt: 'exact part numbers never match in vector search', answer: 'hybrid search (BM25 + dense)', why: 'Embeddings compress away rare identifiers; lexical search catches exact strings.' },
    { prompt: 'retrieved chunks are topically right but rank badly', answer: 'reranker', why: 'A cross-encoder rescoring the top-50 fixes ordering that bi-encoders get wrong.' },
    { prompt: 'user pastes a webpage that hijacks your bot\'s instructions', answer: 'prompt injection defenses', why: 'Untrusted content in context = injection surface; isolate, mark, and constrain tool access.' },

    /* --- tokens & sampling --- */
    { prompt: 'same input classifies differently on every run', answer: 'temperature ≈ 0', why: 'Run-to-run variance is sampling randomness — greedy decoding removes it, prompt tweaks don\'t.' },
    { prompt: 'eval scores wobble between identical eval runs', answer: 'temperature ≈ 0', why: 'You can\'t compare prompts through sampling noise; make decoding deterministic first.' },
    { prompt: 'extraction job needs repeatability, not creativity', answer: 'temperature ≈ 0', why: 'Deterministic tasks get greedy decoding; save temperature for ideation and brainstorming.' },
    { prompt: 'auto-accept only labels the model is sure about', answer: 'logprobs / confidence routing', why: 'Token logprobs are a free confidence signal — threshold them and escalate the rest.' },
    { prompt: 'moderation pipeline needs a tunable precision/recall knob', answer: 'logprobs / confidence routing', why: 'A logprob threshold is a dial you can turn; re-prompting gives you no dial at all.' },
    { prompt: 'cheap model should hand off only when unsure', answer: 'logprobs / confidence routing', why: 'Routing on the model\'s own uncertainty beats guessing difficulty from the input upfront.' },

    /* --- prompting --- */
    { prompt: 'zero-shot labels drift from your quirky category boundaries', answer: 'few-shot examples', why: 'Three to five in-prompt demonstrations transfer boundaries instantly — no training run needed.' },
    { prompt: 'citation format stays wrong until the model sees one', answer: 'few-shot examples', why: 'For format quirks, one worked demonstration beats a paragraph of description.' },
    { prompt: 'odd house labeling conventions, zero training data budget', answer: 'few-shot examples', why: 'In-context examples teach conventions at inference time for zero training cost.' },
    { prompt: 'multi-step word problems answered in one wrong leap', answer: 'chain-of-thought', why: 'Forcing intermediate steps into the output is where math/logic accuracy comes from.' },
    { prompt: 'model knows every sub-fact yet flubs the conclusion', answer: 'chain-of-thought', why: 'The failure is skipped reasoning, not missing knowledge — make the steps explicit.' },
    { prompt: 'complex eligibility rules misapplied in snap answers', answer: 'chain-of-thought', why: 'Decompose rule application into visible steps before the verdict is allowed.' },
    { prompt: 'worked-steps prompting plateaus on olympiad-hard problems', answer: 'reasoning model tier', why: 'Prompted CoT has a ceiling; models trained to think in reasoning tokens go past it.' },
    { prompt: 'gnarly race condition, model pattern-matches shallow fixes', answer: 'reasoning model tier', why: 'Novel hard problems justify paying for extended thinking, not another prompt rewrite.' },
    { prompt: 'multi-constraint planning fails no matter the prompt', answer: 'reasoning model tier', why: 'When prompt engineering saturates, the lever is a tier that searches and self-checks.' },
    { prompt: 'stuffing all 20 docs in beats picking the best 5, right?', answer: 'context engineering', why: 'No — irrelevant chunks actively distract attention; curate for relevance and position.' },
    { prompt: 'critical instruction ignored when buried mid-prompt', answer: 'context engineering', why: 'Attention favors the edges; put load-bearing instructions first or last.' },

    /* --- model APIs --- */
    { prompt: 'intermittent 529 overloaded errors a few times hourly', answer: 'retries with backoff + jitter', why: 'Transient server errors clear on their own — retry with backoff instead of failing the request.' },
    { prompt: 'every client retries instantly and the spike repeats', answer: 'retries with backoff + jitter', why: 'Jitter desynchronizes the thundering herd that synchronized retries create.' },
    { prompt: 'one random timeout ruins an otherwise fine nightly job', answer: 'retries with backoff + jitter', why: 'Sporadic failures are transient, systemic ones aren\'t — retry the former, page on the latter.' },
    { prompt: '429 storm at peak as clients hammer the endpoint', answer: 'retries with backoff + jitter', why: 'Backoff spreads the retry load; hammering a rate-limited endpoint extends the outage.' },
    { prompt: 'users abandon before the 20-second answer completes', answer: 'streaming', why: 'Perceived latency is time-to-first-token — stream it; total generation time barely matters.' },
    { prompt: 'long report generation looks frozen in the UI', answer: 'streaming', why: 'Partial tokens on screen buy patience; the fix is presentation, not model speed.' },
    { prompt: 'voice agent must start speaking almost instantly', answer: 'streaming', why: 'Pipe tokens to TTS as they arrive instead of waiting for the full completion.' },
    { prompt: 'agent works for a minute with zero user feedback', answer: 'streaming', why: 'Stream intermediate tokens and tool events — silence reads as failure to users.' },
    { prompt: 'classify 2M rows nightly, nobody waiting online', answer: 'batch API', why: 'Async jobs with a 24h SLA get ~50% off — never pay realtime prices offline.' },
    { prompt: 'one-time summarization pass over the entire archive', answer: 'batch API', why: 'Throughput without latency pressure is exactly what the discounted async endpoint is for.' },
    { prompt: 'offline eval runs are burning realtime-priced tokens', answer: 'batch API', why: 'Evals don\'t need low latency — batch them at half price.' },
    { prompt: 'one power user consumes half the monthly token spend', answer: 'rate limiting / token budgets', why: 'Per-user quotas cap abuse; provider limits protect the provider, not your bill.' },
    { prompt: 'client bug looped requests and burned $2k overnight', answer: 'rate limiting / token budgets', why: 'Hard spend caps and alerts stop runaways — an agent step cap can\'t catch a client-side loop.' },
    { prompt: 'answers ramble and output tokens cost 5× input', answer: 'rate limiting / token budgets', why: 'Budget output length per request — the expensive tokens are the ones you can cap.' },

    /* --- structured outputs & tools --- */
    { prompt: 'downstream parser crashes on chatty preamble around the JSON', answer: 'structured outputs / schema validation', why: 'Constrain decoding to a schema; asking nicely for “JSON only” still drifts.' },
    { prompt: 'dates come back in five different formats', answer: 'structured outputs / schema validation', why: 'A schema pins formats mechanically; prompt pleading decays with every model update.' },
    { prompt: 'pipeline needs exactly six fields present every time', answer: 'structured outputs / schema validation', why: 'Guaranteed shape comes from constrained decoding plus validation — temperature 0 doesn\'t guarantee it.' },
    { prompt: 'receipt screenshots need line-item extraction into your DB', answer: 'structured outputs / schema validation', why: 'Vision input changes nothing — the output side still needs schema enforcement.' },
    { prompt: 'chatbot should book the meeting, not describe booking it', answer: 'tool / function calling', why: 'Acting on the world requires declared tools; text about actions is not an action.' },
    { prompt: 'nine-digit invoice arithmetic comes out slightly wrong', answer: 'tool / function calling', why: 'LLMs approximate arithmetic; a calculator tool is exact — delegate, don\'t prompt harder.' },
    { prompt: 'model guesses today\'s date and current prices', answer: 'tool / function calling', why: 'Anything real-time lives outside the weights; fetch it with a call.' },
    { prompt: 'answers need live stock counts from your database', answer: 'tool / function calling', why: 'Volatile per-query data is a tool lookup; a RAG index is stale the moment it\'s built.' },
    { prompt: 'vision model misreads totals on low-res scans', answer: 'tool / function calling', why: 'For exact digits, route to a dedicated OCR tool — VLMs read approximately.' },

    /* --- embeddings & retrieval --- */
    { prompt: 'upgraded the embedding model and recall cratered', answer: 're-embedding migration', why: 'Old document vectors and new query vectors live in different spaces — re-embed everything.' },
    { prompt: 'two embedding models\' vectors share one index', answer: 're-embedding migration', why: 'Cosine similarity across model spaces is meaningless; migrate the whole corpus to one.' },
    { prompt: 'searching "ERR_CONN_RESET" surfaces vague networking prose', answer: 'hybrid search (BM25 + dense)', why: 'Error codes are exact strings; dense vectors blur them — add BM25 alongside.' },
    { prompt: 'internal acronyms never match in vector search', answer: 'hybrid search (BM25 + dense)', why: 'Rare tokens embed poorly; lexical scoring catches what embeddings compress away.' },
    { prompt: 'support bot must reflect this morning\'s policy change', answer: 'RAG', why: 'Knowledge that changes daily belongs in retrieval, not in weights you\'d have to retrain.' },
    { prompt: 'model confidently pitches products you discontinued', answer: 'RAG', why: 'Stale parametric memory — ground generation in a maintained corpus instead.' },
    { prompt: 'compliance demands every answer link its source', answer: 'RAG', why: 'Citations require retrieved passages — weights can\'t point at documents.' },
    { prompt: 'right doc reliably in the top 50, rarely top 5', answer: 'reranker', why: 'Recall is solved, precision isn\'t: cross-encode the candidates instead of retrieving more.' },
    { prompt: 'raising k adds noise faster than it adds answers', answer: 'reranker', why: 'Retrieve wide then rescore narrow — a bigger k without reordering just dilutes context.' },
    { prompt: 'retrieval whiffs on "what about the second one?"', answer: 'query rewriting', why: 'Follow-ups have no standalone meaning — rewrite with dialog context before searching.' },
    { prompt: 'user keyword soup never matches prose-style docs', answer: 'query rewriting', why: 'Reformulate the query toward corpus phrasing; the index isn\'t the problem.' },
    { prompt: 'one question secretly contains three questions', answer: 'query rewriting', why: 'Decompose into sub-queries and retrieve each — single-shot retrieval averages them away.' },

    /* --- context management --- */
    { prompt: 'agent chat blows the window after 40 turns', answer: 'context compaction / summarization', why: 'Summarize old turns, keep recent verbatim — within a session, compress rather than store.' },
    { prompt: 'every turn re-sends the entire growing transcript', answer: 'context compaction / summarization', why: 'Rolling summaries cap per-turn cost; the window resets nothing by itself.' },
    { prompt: 'tool results dump 30k-token JSON blobs into context', answer: 'context compaction / summarization', why: 'Digest tool output before reinsertion; raw payloads crowd out reasoning room.' },
    { prompt: 'sub-agent reports bloat the orchestrator\'s context', answer: 'context compaction / summarization', why: 'Have workers return summaries, not transcripts — the orchestrator needs conclusions.' },
    { prompt: 'three-hour meeting recordings overflow any context window', answer: 'context compaction / summarization', why: 'Transcribe then summarize hierarchically — no window fits raw hours of speech.' },
    { prompt: 'bot re-asks user preferences every single session', answer: 'long-term memory store', why: 'Context dies with the session; durable facts need an external store plus retrieval.' },
    { prompt: 'assistant should recall decisions from last month', answer: 'long-term memory store', why: 'Cross-session recall is storage, not window size — write facts down when they happen.' },
    { prompt: 'personalization resets whenever a new chat starts', answer: 'long-term memory store', why: 'Persist user facts outside the conversation; compaction only helps within one.' },

    /* --- agents & multi-agent --- */
    { prompt: 'research agent burns $40 wandering down tangents', answer: 'step budgets / stop conditions', why: 'Cap steps and spend per task — agents don\'t notice diminishing returns on their own.' },
    { prompt: 'agent keeps "double-checking" long after the task is done', answer: 'step budgets / stop conditions', why: 'Define explicit completion conditions; without a stop rule, loops rationalize continuing.' },
    { prompt: 'two sub-agents ping-pong the same subtask forever', answer: 'step budgets / stop conditions', why: 'Inter-agent handoffs need iteration caps too — no single agent can see the loop.' },
    { prompt: 'agent about to email 2,000 customers a refund offer', answer: 'human-in-the-loop gate', why: 'Irreversible, high-blast-radius actions need approval — a step cap wouldn\'t stop one bad send.' },
    { prompt: 'agent can trigger five-figure wire transfers alone', answer: 'human-in-the-loop gate', why: 'Consequential-but-legitimate actions want sign-off; sandboxing would just remove the capability.' },
    { prompt: 'auto-generated legal advice ships without review', answer: 'human-in-the-loop gate', why: 'High-stakes output needs a human check — guardrail filters can\'t judge legal correctness.' },
    { prompt: 'code-interpreter agent could rm -rf the host', answer: 'sandboxing / least privilege', why: 'Run generated code in a throwaway container with minimal mounts — assume it will misbehave.' },
    { prompt: 'support bot\'s API key can also delete production data', answer: 'sandboxing / least privilege', why: 'Scope credentials to the fewest verbs the task needs; prompts are not a permission system.' },
    { prompt: 'browsing agent can POST to internal admin panels', answer: 'sandboxing / least privilege', why: 'Egress allowlists and read-only access shrink what an exploited agent can touch.' },
    { prompt: 'connected MCP server exposes a delete-repo tool', answer: 'sandboxing / least privilege', why: 'Mount only the tools the task needs — every exposed tool is attack surface.' },
    { prompt: 'multi-agent run failed, which agent went off the rails?', answer: 'observability / tracing', why: 'Trace spans across agents reconstruct the handoff where things broke.' },

    /* --- security --- */
    { prompt: 'retrieved wiki page tells the model to ignore instructions', answer: 'prompt injection defenses', why: 'RAG content is untrusted input — delimit it as data and strip imperative text.' },
    { prompt: 'email assistant obeys commands hidden inside emails', answer: 'prompt injection defenses', why: 'Third-party content must never be promoted to instructions, whatever it claims.' },
    { prompt: 'third-party MCP tool descriptions smuggle sneaky directives', answer: 'prompt injection defenses', why: 'Tool metadata enters the prompt too — vet and pin descriptions like any untrusted input.' },
    { prompt: 'bot occasionally echoes customer SSNs in replies', answer: 'output guardrails / PII filter', why: 'Scan the output side; injection defenses watch what comes in, not what leaks out.' },
    { prompt: 'model sometimes volunteers medical dosage advice', answer: 'output guardrails / PII filter', why: 'Policy filters on generated text catch what system-prompt promises miss.' },
    { prompt: 'competitor names must never appear in generated copy', answer: 'output guardrails / PII filter', why: 'Deterministic post-generation checks enforce hard bans; prompts only lower the odds.' },

    /* --- evals --- */
    { prompt: 'prompt debates settled by whoever argues loudest', answer: 'evals / golden set', why: 'A labeled test set turns opinions into a score.' },
    { prompt: 'provider deprecates your model — is the replacement safe?', answer: 'evals / golden set', why: 'Model swaps become measurable diffs once a golden set exists.' },
    { prompt: 'shiny benchmark scores don\'t transfer to your workload', answer: 'evals / golden set', why: 'Public leaderboards measure their distribution, not yours — build a set from real traffic.' },
    { prompt: 'want to compare two agents\' end-to-end task success', answer: 'evals / golden set', why: 'Task-level golden scenarios measure agents; per-token metrics miss the point.' },
    { prompt: 'grade 5,000 free-form summaries every night', answer: 'LLM-as-judge', why: 'Open-ended quality at scale = rubric-driven model grading, spot-calibrated against humans.' },
    { prompt: 'exact-match scoring marks correct paraphrases wrong', answer: 'LLM-as-judge', why: 'Semantic equivalence needs a judging model with a rubric, not string equality.' },
    { prompt: 'human eval review takes three weeks per run', answer: 'LLM-as-judge', why: 'Calibrate a judge on a human-labeled sample, then let it scale the rest.' },
    { prompt: 'Friday prompt tweak silently broke refund flows', answer: 'regression gate in CI', why: 'Run the eval suite on every change and block merges — discipline doesn\'t scale, CI does.' },
    { prompt: 'each prompt fix quietly breaks two old behaviors', answer: 'regression gate in CI', why: 'Pre-merge eval runs catch cross-behavior regressions the author never thinks to test.' },
    { prompt: 'nobody reruns evals before merging prompt edits', answer: 'regression gate in CI', why: 'Wire the golden set into CI — a test suite that\'s optional is decorative.' },
    { prompt: 'evals passed but real traffic behaves differently', answer: 'canary rollout', why: 'Golden sets can\'t cover the live distribution — expose 5% first and watch metrics.' },
    { prompt: 'nervous about flipping 100% of traffic to the new prompt', answer: 'canary rollout', why: 'Ramp gradually with metrics and a rollback lever — blast radius is a choice.' },
    { prompt: 'model upgrade looks fine offline; users are the real test', answer: 'canary rollout', why: 'Offline evals gate the merge; staged rollout gates the deploy.' },

    /* --- observability --- */
    { prompt: 'user reports a bad answer you can\'t reconstruct', answer: 'observability / tracing', why: 'Log prompt, retrieval, and tool calls per request — unreplayable failures are unfixable.' },
    { prompt: 'no idea which pipeline step eats the latency', answer: 'observability / tracing', why: 'Per-step spans show where time and tokens go; guessing optimizes the wrong stage.' },
    { prompt: 'spend doubled and nobody knows which feature did it', answer: 'observability / tracing', why: 'Per-request token attribution turns a scary bill into a named culprit.' },

    /* --- fine-tuning --- */
    { prompt: 'need the house writing style on a small model', answer: 'fine-tuning (LoRA)', why: 'Style is learned behavior — low-rank adapters teach it for dollars, no full retrain.' },
    { prompt: 'format prompt with 30 examples outweighs the task itself', answer: 'fine-tuning (LoRA)', why: 'Bake a recurring format into weights and reclaim the context window.' },
    { prompt: 'fine-tuned model forgot general skills', answer: 'fine-tuning (LoRA)', why: 'Full-weight updates cause catastrophic forgetting; adapters plus mixed data preserve the base.' },
    { prompt: '10k thumbs-up/down pairs but style still off', answer: 'DPO / preference tuning', why: 'Pairwise preference data trains chosen-over-rejected directly — no reward model needed.' },
    { prompt: 'SFT clone faithfully imitates your labelers\' mistakes', answer: 'DPO / preference tuning', why: 'SFT copies everything in the data; preference tuning teaches better-versus-worse.' },
    { prompt: 'answers are correct but users prefer the rival\'s tone', answer: 'DPO / preference tuning', why: 'Tone gaps are preference gaps — optimize on comparisons, not more facts.' },
    { prompt: 'GPU budget can\'t serve the model that aces the task', answer: 'distillation', why: 'Let the big teacher label data and train a small student — most of the quality, fraction of the cost.' },
    { prompt: 'want frontier-level outputs from a 3B deployment', answer: 'distillation', why: 'Teacher-generated training data transfers behavior downmarket; prompting a 3B won\'t.' },
    { prompt: 'edge devices need the cloud model\'s skills offline', answer: 'distillation', why: 'A distilled student runs where the teacher can\'t — quantization alone won\'t shrink 70B to phone size.' },

    /* --- inference & open models --- */
    { prompt: '70B model won\'t fit on a 24GB GPU', answer: 'quantization', why: '4-bit weights cut VRAM roughly 4× for a small quality haircut — same model, lower precision.' },
    { prompt: 'want yesterday\'s server model running on a laptop', answer: 'quantization', why: 'GGUF-style low-bit weights put big models on consumer hardware — no retraining involved.' },
    { prompt: 'VRAM cost dominates and quality can flex slightly', answer: 'quantization', why: 'Precision is the cheapest lever on memory; distillation costs a whole training run.' },
    { prompt: 'single-stream generation crawls while the GPU idles', answer: 'speculative decoding', why: 'Decoding is memory-bound — a draft model proposes tokens, the big one verifies in parallel.' },
    { prompt: 'need faster tokens with zero quality change', answer: 'speculative decoding', why: 'Verification accepts only what the target model would emit — identical outputs, fewer passes.' },
    { prompt: 'p99 spikes when short and long requests share batches', answer: 'continuous batching', why: 'Static batching makes short requests wait for the longest; admit and evict per token instead.' },
    { prompt: 'self-hosted GPU throughput collapses under mixed lengths', answer: 'continuous batching', why: 'Per-iteration scheduling keeps slots full as sequences finish — serving-side, unlike the provider batch endpoint.' },
    { prompt: 'own inference server handles one request at a time', answer: 'continuous batching', why: 'vLLM-style scheduling multiplies throughput on the same silicon.' },
    { prompt: 'long chats OOM the GPU though weights fit fine', answer: 'KV cache management', why: 'Attention state grows with every token — the cache, not the weights, eats the memory.' },
    { prompt: 'self-hosted chat re-prefills the whole history each turn', answer: 'KV cache management', why: 'Reuse attention state across turns — the self-hosted twin of provider prompt caching.' },
    { prompt: 'memory fragmentation kills concurrency on long conversations', answer: 'KV cache management', why: 'Paged allocation packs variable-length caches — that\'s the PagedAttention trick.' },

    /* --- cost & latency --- */
    { prompt: 'giant tool definitions re-billed on every agent step', answer: 'prompt caching', why: 'The stable prefix (system + tools) is cache-eligible — often a 90% discount on it.' },
    { prompt: '100k-token prompt makes prefill the latency bottleneck', answer: 'prompt caching', why: 'Cached prefixes skip recomputation — cost and time-to-first-token drop together.' },
    { prompt: 'cache hit rate is zero because a timestamp leads the prompt', answer: 'prompt caching', why: 'Caching needs byte-identical prefixes — dynamic content goes after the stable block.' },
    { prompt: 'thousands phrase the same refund question differently', answer: 'semantic caching', why: 'Paraphrases miss exact-match caches — match by embedding similarity and serve the stored answer.' },
    { prompt: 'near-duplicate queries keep paying full inference price', answer: 'semantic caching', why: 'Prompt caching discounts the prefix but still generates; a semantic cache skips the model.' },
    { prompt: 'want to skip generation entirely on repeat questions', answer: 'semantic caching', why: 'Serving a stored answer beats any discount — reserve it for stable, high-repeat intents.' },
    { prompt: '90% of tickets are trivial yet all hit the frontier model', answer: 'model routing', why: 'Classify difficulty upfront and send easy traffic down-tier; escalate the rest.' },
    { prompt: 'one model can\'t be cheap for chitchat and smart for analysis', answer: 'model routing', why: 'Nothing says one model — a router assigns the tier per request.' },
    { prompt: 'reasoning tier burns thinking tokens on trivial questions', answer: 'model routing', why: 'Reasoning spend should be earned by difficulty — route easy queries to a fast tier.' },
    { prompt: 'caption five million archival images, deadline next month', answer: 'batch API', why: 'Massive offline media jobs belong on the discounted async endpoint.' },

    /* --- production resilience --- */
    { prompt: 'primary provider\'s 3-hour outage took the product down', answer: 'fallback provider / degradation', why: 'Outages aren\'t transient — retries just delay errors; failover needs a second path.' },
    { prompt: 'feature must stay usable when the LLM is down', answer: 'fallback provider / degradation', why: 'Design a degraded mode — cached answers or simpler UX beat a spinner.' },
    { prompt: 'region-wide model outage; retries only postpone failure', answer: 'fallback provider / degradation', why: 'Backoff handles blips; sustained unavailability needs another provider or graceful degradation.' },
    { prompt: 'single-vendor dependency is now a board-level business risk', answer: 'fallback provider / degradation', why: 'Abstract the provider behind one interface so you can fail over — lock-in is an availability risk.' },

    /* --- more sampling & prompting --- */
    { prompt: 'prompt unit tests flake because output changes each run', answer: 'temperature ≈ 0', why: 'Make decoding deterministic before you assert on it — you can\'t test through sampling noise.' },
    { prompt: 'want the model to abstain when its top-token probability is low', answer: 'logprobs / confidence routing', why: 'Thresholding token probabilities gives a free abstain signal; re-prompting gives you no dial.' },
    { prompt: 'reply tone stays inconsistent until it sees two sample answers', answer: 'few-shot examples', why: 'Demonstrations pin tone at inference time — cheaper and faster than describing it in prose.' },
    { prompt: 'model leaps to a verdict on a logic puzzle and gets it wrong', answer: 'chain-of-thought', why: 'The gap is skipped reasoning — force the intermediate steps before the answer.' },
    { prompt: 'competitive-programming task stumps the standard chat model', answer: 'reasoning model tier', why: 'Search-and-verify problems justify a model trained to think in reasoning tokens.' },

    /* --- more retrieval --- */
    { prompt: 'switched to a larger embedding dimension; the old index is unusable', answer: 're-embedding migration', why: 'Vectors of different dimensions can\'t be compared — re-embed the whole corpus into the new space.' },
    { prompt: 'SKU codes and free-text descriptions both need to match a query', answer: 'hybrid search (BM25 + dense)', why: 'Lexical catches the exact codes, dense catches the semantics — fuse both scores.' },
    { prompt: 'recall is fine but precision@3 is weak on retrieved passages', answer: 'reranker', why: 'Cross-encode the shortlist to fix ordering — retrieving more only adds noise.' },
    { prompt: 'a vague one-word search needs expansion before it hits the index', answer: 'query rewriting', why: 'Reformulate the intent into a fuller query; the retriever isn\'t the weak link.' },

    /* --- more context & memory --- */
    { prompt: 'one load-bearing sentence is drowned by boilerplate in the prompt', answer: 'context engineering', why: 'Trim and reposition so the signal isn\'t diluted — more tokens is not more attention.' },
    { prompt: 'a coaching bot should recall goals the user set weeks ago', answer: 'long-term memory store', why: 'Cross-session recall is durable storage plus retrieval, not a bigger window.' },

    /* --- more evals & safety --- */
    { prompt: 'score tone and helpfulness across thousands of replies each night', answer: 'LLM-as-judge', why: 'Rubric-driven model grading scales subjective quality; spot-check it against humans.' },
    { prompt: 'generated marketing copy sometimes makes unverifiable claims', answer: 'output guardrails / PII filter', why: 'A deterministic post-generation check enforces the ban that prompting only nudges.' },
    { prompt: 'agent is one step from dropping a production database table', answer: 'human-in-the-loop gate', why: 'Irreversible high-blast-radius actions need explicit approval before they execute.' },

    /* --- more inference & serving --- */
    { prompt: 'interactive coding assistant feels sluggish token by token', answer: 'speculative decoding', why: 'A draft model proposes, the target verifies in parallel — same output, fewer serial passes.' },
    { prompt: 'fit a 13B model into 8GB of VRAM without retraining', answer: 'quantization', why: 'Low-bit weights shrink the memory footprint for a small quality haircut.' },
    { prompt: 'GPU sits at 30% utilization under bursty concurrent traffic', answer: 'continuous batching', why: 'Per-iteration scheduling admits and evicts requests to keep the device saturated.' },
    { prompt: 'batching long conversations exhausts GPU memory before compute does', answer: 'KV cache management', why: 'Attention state, not weights, is the bottleneck — page and reuse it.' },
    { prompt: 'an FAQ bot fields the same intent phrased fifty different ways', answer: 'semantic caching', why: 'Match by embedding similarity and serve the stored answer — skip generation entirely.' },
    { prompt: 'need the big model\'s quality at roughly 20x cheaper serving', answer: 'distillation', why: 'Train a small student on teacher outputs — most of the quality, a fraction of the cost.' },
    { prompt: 'have ranked A-over-B response pairs and want the model to prefer A', answer: 'DPO / preference tuning', why: 'Pairwise preferences train chosen-over-rejected directly, no reward model required.' },
    { prompt: 'deep domain jargon should feel native, not stapled on via prompt', answer: 'fine-tuning (LoRA)', why: 'Bake recurring domain phrasing into low-rank adapters instead of re-teaching it every call.' }
  ]
});
