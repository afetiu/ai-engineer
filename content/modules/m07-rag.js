COURSE.register({
  id: 'm07-rag',
  track: 'core',
  order: 7,
  title: 'RAG',
  short: 'RAG',
  tagline: 'The full retrieval-augmented pipeline, where each stage silently fails, how to measure it, and when RAG is the wrong tool entirely.',
  minutes: 115,
  lessons: [
    {
      id: 'pipeline',
      title: 'The pipeline end to end — and where each stage fails',
      blurb: 'Ingest → chunk → embed → index → retrieve → rerank → generate, with the failure ledger for every arrow.',
      html: '<h2>What RAG actually is</h2>' +
        '<p>Retrieval-Augmented Generation is a data pipeline bolted to a prompt template. Nothing more exotic: at ingest time you convert documents into indexed, embedded chunks; at query time you retrieve the most relevant chunks and paste them into the model\'s context with instructions to answer from them. The model contributes zero persistent knowledge storage — every fact it can be trusted with must survive the trip through your pipeline. That framing matters because it relocates the engineering: <b>RAG quality problems are overwhelmingly retrieval and data problems, not model problems</b>, and teams who start by swapping LLMs to fix a bad answer are debugging the wrong tier.</p>' +
        '<p>The canonical stages: <b>ingest</b> (fetch, parse, extract text) → <b>chunk</b> (split into retrieval units) → <b>embed</b> (vectors, module 6) → <b>index</b> (vector + keyword stores) → <b>retrieve</b> (hybrid top-k) → <b>rerank</b> (cross-encoder rescore) → <b>generate</b> (prompt assembly + LLM). Each arrow is a place where information dies quietly.</p>' +
        '<h2>The failure ledger</h2>' +
        '<table><tr><th>Stage</th><th>Classic failures</th><th>Symptom downstream</th></tr>' +
        '<tr><td>Ingest</td><td>PDF text extraction garbles tables/columns; OCR noise; HTML boilerplate (nav, cookie banners) ingested as content; permissions not captured</td><td>Model quotes navigation menus; numbers from tables are wrong; leaked docs</td></tr>' +
        '<tr><td>Chunk</td><td>Split mid-table/mid-function; fragments lose antecedents; chunks exceed embedder input limit and truncate silently</td><td>Retrieved text is unintelligible out of context; deep content unfindable</td></tr>' +
        '<tr><td>Embed</td><td>Wrong/missing query-vs-passage prefixes; mixed model versions; batch failures dropped silently</td><td>Systematically weak or random retrieval, no errors anywhere</td></tr>' +
        '<tr><td>Index</td><td>Tombstone decay; stale documents never re-ingested; filters interacting badly with ANN</td><td>Old policy quoted after update; empty results for filtered tenants</td></tr>' +
        '<tr><td>Retrieve</td><td>Vocabulary mismatch between queries and docs; k too small; exact identifiers whiffed by dense-only</td><td>"I could not find anything" while the doc sits in the corpus</td></tr>' +
        '<tr><td>Rerank</td><td>Candidate pool too narrow; latency blowout; reranker demotes the previously-good chunk</td><td>Quality flat or worse despite new spend</td></tr>' +
        '<tr><td>Generate</td><td>Model ignores or contradicts context; lost-in-the-middle; answers from parametric memory instead of retrieved text</td><td>Confident answers unsupported by the provided sources</td></tr></table>' +
        '<div class="callout note"><span class="co-title">Key idea</span> RAG is a chain of conditional probabilities: P(good answer) = P(parsed right) × P(chunked right) × P(retrieved right) × P(generated faithfully). Five stages at 90% each is 59% end to end. This is why mature teams instrument <em>per-stage</em> metrics (lesson 3) instead of one end-to-end thumbs-up rate — a single aggregate number cannot tell you which stage to fix.</div>' +
        '<h2>Ingestion in anger: the stage everyone underestimates</h2>' +
        '<p>Demos ingest clean Markdown. Production ingests: PDFs where a two-column layout interleaves sentences from both columns, scanned contracts needing OCR, PowerPoint decks where the argument lives in speaker notes, Confluence pages that are 60% macro boilerplate, and HTML where the answer is in a table but your extractor flattened it into word soup. As of early 2026 the tooling is genuinely better — layout-aware parsers (unstructured.io, LlamaParse, Docling, marker) and VLM-based extraction for gnarly scans — but every one of them still fails on some fraction of real documents, and the failures are silent: you get <em>text</em>, just wrong text.</p>' +
        '<p>Non-negotiables for a production ingest stage: content-hash-based change detection (re-ingest only what changed — protects your index and your embedding bill), a parse-quality sampling habit (eyeball N random parsed docs per source type; you will find horrors), provenance and ACL metadata captured at ingest (bolting permissions on later is a rewrite), and a dead-letter queue for parse failures instead of silent drops.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A financial-services team shipped a RAG assistant over their policy PDFs. Answers about numeric limits were confidently wrong. The culprit sat at ingest: their extractor read two-column PDFs left-to-right across both columns, splicing unrelated sentences into fluent-looking garbage. Retrieval was fine. Embeddings were fine. The model faithfully summarized nonsense — <em>faithful to garbage is still garbage</em>. Nobody had ever read a raw parsed document; the bug was found by finally printing one.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Sketch a RAG architecture" is the warm-up; the real question is the follow-up: "your users say answers are bad — walk me through your debugging." Strong answer: bisect the pipeline. Look at the actual retrieved chunks for failing queries (is the answer present? readable?); if retrieval is fine, it is a generation/faithfulness problem; if not, walk back through index freshness, embedding versions, chunking, and raw parses. Naming that order — data first, model last — is what separates people who have operated RAG from people who have read about it.</div>'
    },
    {
      id: 'chunking-in-anger',
      title: 'Chunking strategies in anger',
      blurb: 'Module 6 gave the theory; here is what real corpora do to it — and the patterns that survive contact.',
      html: '<h2>The chunk is your unit of everything</h2>' +
        '<p>It is worth re-stating from module 6 with RAG-specific force: the chunk is simultaneously the unit of <em>embedding</em> (what the vector represents), the unit of <em>retrieval</em> (what gets scored), and the unit of <em>evidence</em> (what the model reads). Those three roles want different sizes — sharp vectors want small chunks, evidence wants complete context — and every practical chunking pattern is a way of decoupling them.</p>' +
        '<p>The workhorse decoupling is <b>small-to-big / parent-document retrieval</b>: embed and search small precise units (say 250-token passages, or even single sentences), but hand the model the <em>parent</em> — the enclosing section or a windowed expansion around the hit. You search with a scalpel and read with a page. Every serious framework ships this (parent-document retrievers, sentence-window retrieval), it costs only bookkeeping (store parent ids in chunk metadata), and it is the single most reliable chunking upgrade for QA workloads.</p>' +
        '<h2>Per-format field notes</h2>' +
        '<ul>' +
        '<li><b>Markdown/wikis:</b> the happy path. Split on heading hierarchy, prepend the heading path, target 300–500 tokens. Watch for: giant unstructured pages (fallback splitter), and macro/boilerplate pollution at ingest.</li>' +
        '<li><b>PDFs:</b> chunking quality is capped by parse quality (lesson 1). After a layout-aware parse, treat detected sections as boundaries. Tables: extract to Markdown/HTML and keep each table whole with its caption — a split table is dead weight in every retrieval it appears in. If a table is huge, serialize per-row with headers repeated ("Region: EU; Tier: Pro; Limit: 500 req/s") so each row is independently retrievable.</li>' +
        '<li><b>Code:</b> split on syntactic boundaries (tree-sitter: functions, classes) never on line counts; prepend file path and signature context. Embed docstring + signature + body together — queries are usually natural language, and the docstring is your semantic bridge.</li>' +
        '<li><b>Transcripts/chat logs:</b> no headings, weak local structure. Speaker-turn windows with generous overlap, plus an LLM-written topical summary per window (contextual enrichment, module 6) — raw transcript fragments embed poorly because half the tokens are filler.</li>' +
        '<li><b>Spreadsheets/CSVs:</b> mostly do not chunk-and-embed at all. Route these to a tool call (SQL, dataframe) instead; RAG over serialized rows answers "what is the limit for EU Pro" acceptably but fails aggregations ("average across regions") structurally. Wrong tool.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why do overlong chunks hurt even when the fact is inside? Embedding models mean-pool (or CLS-pool) token representations into one vector; a 1,200-token chunk about four topics produces a vector near the centroid of those topics, and your pointed query vector matches none of them strongly. The fact is <em>in</em> the chunk but the vector does not advertise it. Precision of the vector is bought with focus of the text — that is the physics behind every "small chunks retrieve better" result.</div>' +
        '<h2>Choosing and validating a strategy</h2>' +
        '<p>Resist the urge to philosophize about chunking; it is empirically cheap to test. The loop: build the retrieval golden set first (lesson 3 — 50–100 queries with known relevant sources), then grid over 2–3 chunking configs (e.g. fixed-512/15% overlap, heading-structural, structural+parent-retrieval) and compare recall@k and answer quality. The whole experiment is an afternoon, because re-chunking and re-embedding a pilot corpus of a few thousand documents costs cents (module 6 pricing). Teams that skip this ship the framework default (often fixed-1000/200 overlap) and never learn it was costing them 10 points of recall.</p>' +
        '<p>Signals your chunking is the problem: retrieved chunks that start mid-sentence or reference invisible antecedents ("as shown above"); the correct document retrieved but the wrong section; recall@20 fine while recall@5 is poor (right neighborhood, blurry vectors); model answers that stitch two half-facts from adjacent fragments into one wrong fact.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A support-bot team used the framework-default 1,000-token chunks with 200 overlap over their help center. Recall looked fine, but answers about configuration steps kept merging steps from <em>adjacent procedures</em> — chunk boundaries fell mid-procedure, and overlap duplicated steps into neighboring chunks, so the model saw "step 4, step 5, step 4\', step 5\'" from two overlapping fragments and interleaved them. Structural chunking on the procedure headings eliminated the failure class in one deploy. The default was never evaluated; it was just never questioned.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How would you chunk X?" is really "do you know that chunking is measurable?" Give a concrete default (structural, 300–500 tokens, parent retrieval, tables intact), then immediately say how you would validate it against a golden set. Interviewers are listening for the eval reflex, not for a magic number.</div>'
    },
    {
      id: 'retrieval-eval',
      title: 'Retrieval evaluation: golden sets before generation',
      blurb: 'recall@k, MRR, nDCG — and why you build the retrieval eval before you write a single prompt.',
      html: '<h2>Why retrieval gets evaluated first, separately</h2>' +
        '<p>Generation cannot exceed retrieval: if the answer is not in the retrieved chunks, the best possible model output is a graceful "I don\'t know" and the worst is a confident hallucination. So the retrieval stage has a clean, cheap, deterministic evaluation — no LLM judge, no subjectivity, just set membership and rank positions — and it should exist <b>before you touch generation</b>. Teams that start by tweaking prompts against end-to-end vibes are tuning the last stage of a pipeline whose first stages are unmeasured; every conclusion they draw is confounded.</p>' +
        '<p>A <b>retrieval golden set</b> is 50–150 queries, each labeled with the chunk(s)/document(s) that answer it. Building one is unglamorous and takes a day or two. Sources, in order of value: (1) <b>real user queries</b> mined from logs, search history, or support tickets — these carry the actual vocabulary mismatch your system must survive; (2) <b>domain-expert-written</b> queries for coverage of what users <em>should</em> be able to ask; (3) <b>LLM-generated</b> queries from sampled chunks ("write 3 questions this passage answers") — cheapest, but beware: they inherit the passage\'s vocabulary, making retrieval look artificially easy. Use LLM generation for volume, then human-filter and always blend in real queries. Label at the document or section level if chunk-level is too fiddly — coarse labels beat no labels.</p>' +
        '<h2>The three metrics and what each one sees</h2>' +
        '<ul>' +
        '<li><b>recall@k</b> — fraction of queries where a relevant item appears in the top k. The metric that gates everything: if recall@10 is 0.6, four in ten answers are hopeless before generation begins. Track at the k you actually pass to the model (recall@5 if you prompt with 5 chunks) and at a larger k (recall@50) to see whether a reranker has anything to work with.</li>' +
        '<li><b>MRR (mean reciprocal rank)</b> — average of 1/rank of the <em>first</em> relevant result (1.0 if always first, 0.5 if typically second). Sensitive to ordering at the very top; the right lens when one good chunk suffices and position in the prompt matters (module 8).</li>' +
        '<li><b>nDCG@k</b> — discounted cumulative gain, normalized: rewards putting <em>more</em> relevant items <em>higher</em>, handles graded relevance (perfect/partial/irrelevant). The right lens for multi-evidence answers and for measuring reranker gains, which often show up as nDCG improvement while recall is flat.</li>' +
        '</ul>' +
        '<p>Worked micro-example: query with relevant chunks {A, B}; system returns [C, A, D, B, E]. recall@5 = 1.0 (both present), recall@1 = 0. MRR contribution = 1/2 (first relevant at rank 2). nDCG@5 ≈ 0.66 — relevant items present but poorly placed. Three metrics, three different diagnoses from one result list: coverage fine, top-of-list weak.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> recall@k tells you whether to fix <em>retrieval</em>; MRR/nDCG tell you whether to fix <em>ranking</em>. If recall@50 is high but recall@5 is low → add a reranker (candidates exist, ordering is bad). If recall@50 is low → no reranker can save you; fix chunking, hybrid search, or query handling. This one decision rule prevents the most common wasted month in RAG engineering.</div>' +
        '<h2>Operating the eval like an engineer</h2>' +
        '<p>Make it a script, not a ritual: <code>eval_retrieval.py</code> runs the golden set against the live retrieval config and prints the three metrics in under a minute and for ~$0 (retrieval-only — no generation calls). Run it in CI on every change to chunking, embedding model, k, fusion weights, or filters. Version the golden set alongside the index version (module 6): a new embedding model or re-chunk changes chunk ids, so labels at document/section level survive migrations better than chunk-id labels.</p>' +
        '<p>Two traps. First, <b>saturation</b>: once recall@10 hits ~0.95 on your set, the set is done teaching you — refresh it with recent real queries, failed queries from production, and adversarially hard cases (vocabulary mismatch, exact identifiers, multi-hop). Second, <b>distribution drift</b>: your golden set ages as users and documents change; a quarterly refresh from production logs keeps it honest. And only after retrieval metrics are stable do you layer on end-to-end generation evals (faithfulness, answer quality — module 11 territory) — at which point any regression can be attributed to the correct stage.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team generated their entire golden set with an LLM from sampled chunks and celebrated recall@5 of 0.97. Production users reported constant retrieval misses. The generated questions reused each passage\'s exact vocabulary ("What does the billing exporter do on webhook failure?" straight from a chunk about the billing exporter), so lexical and semantic match were both trivially easy. Real users typed "invoices not arriving" — different words, different frame. Synthetic evals measure an upper bound; real-query evals measure your product.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How do you know your RAG system is good?" Weak answer: "we look at the answers." Strong answer: layered evals — retrieval golden set with recall@k/MRR/nDCG run in CI, then generation-stage faithfulness evals on top, with the recall@50-vs-recall@5 decision rule for where to invest. Naming the LLM-generated-query vocabulary trap is a strong senior signal.</div>'
    },
    {
      id: 'failure-modes',
      title: 'The classic failure modes, catalogued',
      blurb: 'Retrieval miss, lost-in-the-middle, faithfulness failures, stale index, query-document mismatch — diagnosis and fix for each.',
      html: '<h2>Failures where the evidence never arrives</h2>' +
        '<p><b>1. Retrieval miss.</b> The answer exists in the corpus; the top-k does not contain it. Root causes in rough frequency order: vocabulary mismatch between query and document (users say "invoices not arriving", docs say "webhook delivery retry policy"), exact identifiers whiffed by dense-only retrieval (module 6), chunking that buried the fact in a blurry vector, and over-restrictive filters. Diagnosis is mechanical: for failing queries, dump the top-20 with scores and check whether the gold chunk appears at <em>any</em> k. Fixes, in order of cost-effectiveness: hybrid search, better chunking, query rewriting (lesson 5), reranking — chosen by the recall@50-vs-recall@5 rule from lesson 3.</p>' +
        '<p><b>2. Stale index.</b> The pricing page changed Tuesday; the bot quotes Monday\'s numbers on Friday. Not a model failure at all — a data-freshness SLA you never wrote down. Every ingest pipeline needs: change detection (webhooks/CDC where sources support it, scheduled re-crawls where they do not), <em>deletion propagation</em> (the most-forgotten half — a doc removed from the wiki must leave the index, or you will confidently cite deleted policy), and a freshness metric on the dashboard (age of oldest un-synced change). Decide the SLA per source: minutes for pricing, daily for engineering docs is often fine — but decide it, on purpose.</p>' +
        '<p><b>3. Query-document mismatch.</b> Deeper than vocabulary: queries and documents are different <em>kinds</em> of text. Queries are short, interrogative, colloquial; documents are long, declarative, formal. Embedding models trained for asymmetric retrieval bridge some of the gap (and models like e5/bge need their <code>query:</code>/<code>passage:</code> prefixes or silently underperform — module 6), but hard cases remain: a user asking "why did my deploy fail" needs a document that never contains the words why, my, deploy, or fail. This mismatch is the entire motivation for query rewriting and HyDE in lesson 5.</p>' +
        '<h2>Failures where the evidence arrives and is squandered</h2>' +
        '<p><b>4. Lost-in-the-middle.</b> Retrieval succeeded; the gold chunk sat at position 9 of 15 in the prompt; the model answered as if it never saw it. Models attend most reliably to the beginning and end of context (the full mechanics in module 8). RAG-specific mitigations: pass fewer, better chunks (5 good beats 15 mediocre — another reason rerankers pay), order by relevance with the best evidence first or last rather than shuffled, and do not pad the context "just in case" — every marginal chunk dilutes attention over the ones that matter.</p>' +
        '<p><b>5. Faithfulness failures.</b> The right text is in context and the model still: contradicts it (answers from parametric memory when training data disagrees with your docs — very common when your internal reality diverges from public reality, e.g. your fork\'s API vs the upstream project the model memorized), over-synthesizes (merges two passages into a claim neither makes), or cites sources it did not use. Mitigations that work as of early 2026: explicit restrict-to-context instructions with an offered abstention path ("if the context does not contain the answer, say so"), require citations with chunk ids and <em>verify them mechanically</em> (does cited chunk N actually contain the claimed content — checkable with string overlap or a cheap NLI/judge model), and measure faithfulness as a first-class eval metric rather than assuming grounding solved it. Grounding shrinks hallucination; it does not close it (module 1).</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why does a model contradict text sitting right in its context? Parametric knowledge (weights) and contextual knowledge (your chunks) compete during generation; when pretraining saw a fact ten thousand times and your document contradicts it once, attention to your chunk must outweigh a deeply-carved prior. Research calls this knowledge conflict; empirically models follow context <em>most</em> of the time, and the failure rate climbs exactly where RAG matters most — when your private truth diverges from public consensus. This is why "answer only from the context" instructions plus citation verification are load-bearing, not decorative.</div>' +
        '<h2>A debugging discipline</h2>' +
        '<p>The five modes above have disjoint fixes, so misdiagnosis is expensive: adding a reranker does nothing for a stale index; prompt-engineering faithfulness does nothing for a retrieval miss. The discipline: for every bad answer, first <b>look at the retrieved chunks</b> (was the evidence there? readable? current?), then classify — miss / stale / mismatch / squandered-position / squandered-faithfulness — and tally the classes weekly. The tally tells you where the next sprint goes. Teams that skip classification default to the most visible knob (the prompt) regardless of where the failures actually live.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> An internal-docs bot kept insisting a feature was configured via environment variable — matching the popular open-source project the company had forked — while their fork used a config file, plainly documented in the retrieved chunk. Retrieval: perfect. Generation: the model\'s prior, carved by thousands of public docs, beat one private paragraph. Fix that shipped: restrict-to-context instruction plus a citation-verification gate that flagged answers whose claims lacked chunk support. The failure class never fully disappeared; it became measured and rare instead of invisible and common.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your RAG bot gave a wrong answer — walk me through root-causing it." The expected shape is the classification tree: evidence retrieved? → no: miss/stale/mismatch (which one?); yes: position or faithfulness. Interviewers push until you name concrete fixes per class and a metric per class. Answering "improve the prompt" to every branch is an instant junior flag.</div>'
    },
    {
      id: 'advanced-patterns',
      title: 'Advanced patterns — with honest price tags',
      blurb: 'Query rewriting, HyDE, parent-document, multi-query, graph RAG, agentic retrieval: what each fixes and what each costs.',
      html: '<h2>Cheap, high-yield: fix the query side</h2>' +
        '<p><b>Query rewriting.</b> Raw user input is often a terrible search query: conversational follow-ups ("what about for the EU?") are unintelligible without history; rambling questions bury the information need. A cheap-model pass rewrites the query into standalone, search-friendly form — resolving pronouns from chat history, splitting compound questions, normalizing jargon. <em>When it\'s worth it:</em> almost always in conversational products — it is nearly mandatory for follow-up turns, costs one small-model call (~$0.0001, 100–300ms), and is the first thing to add after hybrid search. The trade: added latency on every query and occasional rewrites that drift from intent — log both original and rewritten queries so you can see the drift.</p>' +
        '<p><b>Multi-query.</b> Generate 3–5 paraphrases/decompositions of the query, retrieve for each, fuse with RRF. Attacks vocabulary mismatch by buying multiple lottery tickets. <em>When it\'s worth it:</em> broad or ambiguous questions over heterogeneous corpora; it lifts recall a few points for 3–5× retrieval cost and modest latency (parallelize the retrievals). Skip when queries are already precise or latency is tight — and note a well-tuned hybrid + reranker often captures most of the same gain.</p>' +
        '<p><b>HyDE (hypothetical document embeddings).</b> Have the model hallucinate a plausible <em>answer</em> to the query, embed that fake document, and search with its vector — because a fake answer looks more like a real document than a question does, directly attacking query-document mismatch. <em>When it\'s worth it:</em> honestly, less often than its fame suggests as of early 2026 — it shines zero-shot on domains where you cannot tune anything, but it adds a full generation call (200–800ms) to every query, and hybrid search + reranking usually matches or beats it once those are in place. Reach for it when you cannot touch the index but can touch the query path.</p>' +
        '<h2>Restructure what retrieval returns</h2>' +
        '<p><b>Parent-document / small-to-big retrieval.</b> Covered mechanically in lesson 2: search small, read big. <em>When it\'s worth it:</em> nearly always for QA over structured docs; the cost is bookkeeping, not dollars. The main failure mode is parents that are too big — pull a 4,000-token section for every hit and five hits blow 20k tokens of context budget (module 8). Cap parent size or window instead.</p>' +
        '<p><b>Graph RAG.</b> Extract entities and relations at ingest into a knowledge graph (or build community summaries, in the Microsoft GraphRAG style); at query time, traverse relationships or retrieve community summaries instead of/alongside chunks. Answers the questions vanilla RAG structurally cannot: multi-hop ("which customers are affected by the outage in the service that team X owns?") and global-summary ("what are the main themes across all incident reports this year?") — vanilla top-k retrieves fragments, not connections. <em>When it\'s worth it:</em> when your questions are genuinely relational/aggregative and the corpus is worth the investment — extraction costs one LLM pass over the entire corpus at ingest (real money at scale), the graph is another stateful system to keep fresh, and entity-resolution errors compound. Most teams do not need it; the ones that do, really do.</p>' +
        '<h2>Give the model the steering wheel</h2>' +
        '<p><b>Agentic retrieval.</b> Instead of one-shot retrieve-then-generate, the model gets search as a <em>tool</em>: it formulates queries, inspects results, reformulates, retrieves again, and decides when it has enough evidence. This subsumes query rewriting, multi-query, and decomposition — the model does them adaptively, only when needed. <em>When it\'s worth it:</em> complex, multi-hop, or research-shaped questions where single-shot retrieval demonstrably fails; as of early 2026 this pattern (deep-research-style loops) sets quality records on hard corpora. The bill: 3–10× tokens and multi-second-to-minutes latency, plus real evaluation difficulty — the retrieval trace differs per run, so failures are harder to reproduce and regression-test. The pragmatic deployment is a router: cheap single-shot path for the 80% of simple queries, agentic loop for detected-hard ones.</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Stack rank by ROI for a typical docs/support corpus, as of early 2026: hybrid search → reranker → structural chunking + parent retrieval → query rewriting (conversational) → multi-query → agentic (for the hard slice) → HyDE (niche) → graph RAG (only for relational/global questions). Each rung costs more latency, money, or ops than the last. Climbing the ladder before measuring the current rung (lesson 3) is the signature RAG anti-pattern.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team implemented HyDE, multi-query (5 paraphrases), <em>and</em> an agentic loop in their first quarter — before building any retrieval eval. p95 latency hit 14 seconds, cost per query 30×\'d, and when they finally built a golden set, plain hybrid + rerank scored within 2 points of the whole tower on their corpus. They deleted three systems in a week. The patterns were not wrong; the sequencing was.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Pattern questions are bait for buzzword recital. The differentiating move is attaching a cost and a trigger condition to each: "multi-query: 3–5× retrieval cost, worth it for ambiguous queries when recall — measured on our golden set — is the bottleneck." Interviewers upgrade you the moment a pattern comes with the condition under which you would <em>not</em> use it.</div>'
    },
    {
      id: 'when-rag-is-wrong',
      title: 'When RAG is the wrong tool',
      blurb: 'Fits-in-context, long-context economics, and the fine-tuning decision table.',
      html: '<h2>The fits-in-context test</h2>' +
        '<p>Before building any retrieval pipeline, ask the embarrassing question: <b>does the whole corpus just fit in the context window?</b> Your product docs might be 60k tokens. Frontier windows run 200k–1M+ (as of early 2026). If the corpus fits comfortably — with room for the conversation and output — you can skip chunking, embedding, indexing, retrieval evals, and freshness pipelines entirely: stuff the corpus into the (cached) prompt and ship this week. No retrieval-miss failure mode exists, because nothing is ever missed.</p>' +
        '<p>The catch is economics and attention, and prompt caching transforms the former. Raw math: 100k tokens × $3/Mtok = $0.30 <em>per query</em> — untenable at volume. With caching (module 3): cache reads at ~0.1× make it ~$0.03/query on Anthropic-style pricing, plus modest per-turn output costs; OpenAI\'s automatic caching gives ~50% off transparently. At $0.03/query and 10k queries/month you are at $300 — compare that to the <em>engineering payroll</em> cost of building and operating a RAG pipeline, and the stuffed-context answer wins for small corpora far more often than pride admits. It stops winning when: the corpus outgrows the window (or the budget), freshness requires per-query recency anyway, attention degrades on your task (long-context recall is real but imperfect — module 8), or you need per-user access control over which documents the model may see (stuffing everything shows everything to everyone — often the true dealbreaker).</p>' +
        '<h2>Long-context vs RAG at real scale</h2>' +
        '<table><tr><th>Axis</th><th>Long-context stuffing</th><th>RAG</th></tr>' +
        '<tr><td>Corpus size</td><td>Up to ~0.5–1M tokens, hard ceiling</td><td>Effectively unbounded</td></tr>' +
        '<tr><td>Cost/query (100k corpus)</td><td>~$0.03–0.30 depending on caching</td><td>~$0.002–0.02 (4–8k retrieved tokens + search)</td></tr>' +
        '<tr><td>Latency</td><td>High prefill on cache miss; fast on hit</td><td>Retrieval ~50–300ms + short prefill</td></tr>' +
        '<tr><td>Freshness</td><td>Re-cache on every corpus change (cache invalidation cost)</td><td>Incremental index updates</td></tr>' +
        '<tr><td>Access control</td><td>All-or-nothing per prompt</td><td>Per-chunk ACL filtering at retrieval</td></tr>' +
        '<tr><td>Failure modes</td><td>Attention dilution, lost-in-middle</td><td>Retrieval miss + everything in lesson 4</td></tr>' +
        '<tr><td>Engineering cost</td><td>Days</td><td>Weeks to months, plus permanent ops</td></tr></table>' +
        '<p>The honest synthesis: these are ends of a dial, not enemies. A common production pattern is coarse retrieval (fetch the 5 most relevant <em>documents</em>, not chunks) into a large cached context — retrieval for scale and ACLs, long context to eliminate chunking pathologies within documents.</p>' +
        '<h2>Fine-tuning vs RAG: the decision table</h2>' +
        '<p>The most misdiagnosed choice in applied AI, because both get pitched as "teach the model about our stuff." They change different things: <b>RAG changes what the model reads; fine-tuning changes how the model behaves.</b> Fine-tuning is poor at knowledge injection — facts partially stick, interfere, and go stale the moment your docs change (module 1, module 14) — and it is excellent at format, style, tone, and domain-specific behavior that prompting cannot pin down.</p>' +
        '<table><tr><th>You need…</th><th>Right tool</th><th>Why</th></tr>' +
        '<tr><td>Answers grounded in changing private docs</td><td>RAG</td><td>Updateable by writing to an index; auditable via citations</td></tr>' +
        '<tr><td>Freshness (prices, policies, inventory)</td><td>RAG (or tools)</td><td>Fine-tuned facts are frozen at training time</td></tr>' +
        '<tr><td>Per-user/tenant knowledge isolation</td><td>RAG</td><td>ACL-filtered retrieval; one fine-tune per tenant is absurd</td></tr>' +
        '<tr><td>Consistent output format/style/persona</td><td>Fine-tuning</td><td>Behavior lives in weights; stops paying per-request prompt tax</td></tr>' +
        '<tr><td>Domain language the model mangles (medical coding, legalese)</td><td>Fine-tuning</td><td>Distributional behavior, not lookup-able facts</td></tr>' +
        '<tr><td>Shorter prompts / cheaper serving at high volume</td><td>Fine-tuning</td><td>Bake in the instructions and few-shots you resend today</td></tr>' +
        '<tr><td>Grounded answers <em>and</em> house style</td><td>Both</td><td>RAG for facts, a light fine-tune for behavior — common at maturity</td></tr></table>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Sequence the escalation: prompting → context stuffing (if it fits) → RAG (when scale/freshness/ACLs demand) → fine-tuning (when <em>behavior</em>, not knowledge, is the gap) → both. Each step up adds engineering and ops cost; each is justified by a measured failure of the previous step, not by architecture-astronaut ambition.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A 40-person startup spent six weeks building a full RAG stack — vector DB cluster, ingest pipeline, eval harness — over a corpus that totaled 45k tokens and changed monthly. A competitor shipped the same assistant in three days with a cached stuffed prompt, at comparable per-query cost after caching. The RAG stack was not wrong <em>technically</em>; it was wrong <em>economically</em>. Do the fits-in-context arithmetic before the architecture diagram, and write the number in the design doc.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Would you use RAG or fine-tuning for X?" is a false-dichotomy probe. Strong shape: knowledge-vs-behavior distinction first, then the fits-in-context check with caching math, then the escalation ladder, then "and at maturity, often both." Candidates who reflexively answer "RAG" to every knowledge question without the context-stuffing check are pattern-matching, not engineering — and interviewers as of early 2026 know it.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your RAG bot gives wrong numeric answers about policy limits. You check retrieval for failing queries: the right chunks come back, but their text interleaves sentences from unrelated sections. Which stage is broken?',
      options: [
        'Generation — the model is hallucinating numbers',
        'Ingest — the PDF parser is garbling layout (e.g. reading two-column pages straight across), so every downstream stage is faithfully processing corrupted text',
        'The embedding model — it cannot represent numbers',
        'The reranker — it is promoting the wrong chunks'
      ],
      answer: [1],
      explanation: 'Interleaved sentences from unrelated sections is the signature of layout-blind PDF extraction; retrieval and generation are operating correctly on garbage input. (A) blames the visible stage — the model is being faithful to corrupted context, and swapping models changes nothing. (C) — embeddings represent the text they are given; the text itself is wrong. (D) — the reranker returned the "right" chunks; their content was mangled before any index saw it. Debugging discipline: read the raw parsed text before touching anything downstream.'
    },
    {
      text: 'You have no evals yet and limited time. The team debates building (a) an LLM-judge for answer quality or (b) a retrieval golden set with recall@k. Why is (b) first?',
      options: [
        'LLM judges are too expensive to run',
        'Generation quality is upper-bounded by retrieval: if the evidence is not in the top-k, no prompt or model fixes the answer — and retrieval evals are cheap, deterministic, and attribute failures to a specific stage',
        'recall@k is the metric investors ask about',
        'Answer-quality evals require production traffic, which you do not have yet'
      ],
      answer: [1],
      explanation: 'Retrieval gates everything downstream, and its eval needs no LLM judge — just labeled query→source pairs and set arithmetic, runnable in CI in seconds for ~$0. Building generation evals over unmeasured retrieval confounds every conclusion. (A) — judges cost real but modest money; that is not the core reason. (C) is noise. (D) is false — you can eval answers on a hand-built set without traffic; it is still the wrong first eval because failures cannot be attributed to a stage.'
    },
    {
      text: 'Your golden set shows recall@50 = 0.94 but recall@5 = 0.61. You pass 5 chunks to the model. What is the highest-leverage next investment?',
      options: [
        'A cross-encoder reranker over the top-50, since good candidates exist but are poorly ordered',
        'Switch to a bigger embedding model to improve recall',
        'Increase k from 5 to 50 chunks in the prompt',
        'HyDE, to fix query-document mismatch'
      ],
      answer: [0],
      explanation: 'The gap between recall@50 and recall@5 is precisely the reranker\'s job description: the evidence is being retrieved but ranked 6th–50th; a cross-encoder rescore promotes it into the top 5. (B) attacks recall@50, which at 0.94 is not the bottleneck. (C) "works" but floods the context — cost, latency, and lost-in-the-middle dilution over 45 mediocre chunks; you would trade a ranking problem for an attention problem. (D) also targets first-stage recall, which is already fine.'
    },
    {
      text: 'Users report the bot cites last quarter\'s prices days after the pricing page changed. Retrieval logs show the old chunk scoring highest — the new page was never ingested. Which TWO pipeline capabilities most directly prevent this class of failure?',
      options: [
        'Change detection with a freshness SLA per source (webhooks/CDC or scheduled re-crawls, monitored)',
        'Deletion/update propagation so superseded chunks leave the index',
        'A larger context window',
        'Lowering the temperature at generation',
        'A better reranker'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'This is the stale-index failure mode: pure data plumbing. Change detection gets the new content in; propagation gets the old content out — both are required, and the forgotten half is usually deletion (the old chunk keeps winning retrieval because it legitimately matches). (C) and (D) are generation-side knobs for a data-side failure. (E) — a reranker can only reorder what the index contains; it will happily top-rank the stale chunk, which is, after all, relevant.'
    },
    {
      text: 'Retrieval places the correct chunk at position 9 of 15 in the prompt; the model answers as though it never saw it. Which combination of changes targets this failure directly?',
      options: [
        'Retrieve more chunks so the right one appears multiple times',
        'Pass fewer, reranked chunks and order them so the strongest evidence sits at the start or end of the context block',
        'Fine-tune the model on your corpus',
        'Raise efSearch on the vector index'
      ],
      answer: [1],
      explanation: 'This is lost-in-the-middle: models attend most reliably to the beginning and end of context, and 15 chunks dilute attention over mostly-irrelevant text. Fewer, better-ordered chunks is the direct mitigation. (A) adds more middle to get lost in and more duplicates to confuse synthesis. (C) is a months-long detour that does not change positional attention behavior. (D) tunes ANN recall — retrieval already succeeded; the failure is downstream of it.'
    },
    {
      text: 'Your internal docs describe your fork\'s config-file mechanism, but the bot keeps describing the upstream project\'s environment-variable mechanism — even when the correct chunk is retrieved and plainly worded. What is happening?',
      options: [
        'The retrieval scores are too low for the model to trust the chunk',
        'Knowledge conflict: the model\'s parametric prior (trained on abundant public docs for the upstream project) is overriding the contextual evidence — mitigate with restrict-to-context instructions, citation requirements, and mechanical citation verification',
        'The chunk is too long for the context window',
        'The embedding model was trained on the upstream project'
      ],
      answer: [1],
      explanation: 'This is the canonical faithfulness failure where private truth diverges from public consensus: pretraining saw the upstream behavior thousands of times, your paragraph once, and the prior wins some fraction of generations. Instructions plus verified citations turn an invisible failure into a measured one. (A) — models do not read retrieval scores; chunks arrive as plain text. (C) would truncate visibly and affect all answers, not just prior-conflicting ones. (D) confuses pipelines: the embedding model found the right chunk; the failure is in generation.'
    },
    {
      text: 'You generated 200 golden-set queries by asking an LLM to write questions from sampled chunks. recall@5 measures 0.96, yet production users complain about constant misses. Most likely explanation?',
      options: [
        'Production traffic is adversarial',
        'LLM-generated questions inherit each passage\'s vocabulary, making lexical and semantic matching artificially easy; real users phrase the same needs in different words — blend mined real queries into the set',
        'The golden set is too small at 200 queries',
        'recall@5 is the wrong metric; you should use nDCG'
      ],
      answer: [1],
      explanation: 'Synthetic-from-chunk queries share the chunk\'s exact terms, so they measure an upper bound, not product reality — the vocabulary-mismatch failure mode is defined away by construction. Mining real queries from logs/tickets restores it. (A) — ordinary users are not adversarial; they just use their own words. (C) — 200 is a healthy size; composition, not count, is the flaw. (D) — nDCG on the same easy queries would be equally inflated; changing metrics does not fix a biased dataset.'
    },
    {
      text: 'A conversational assistant answers first questions well but fails on follow-ups like "and what about for the EU?" Retrieval logs show that literal string being embedded as the query. Cheapest effective fix?',
      options: [
        'Agentic retrieval with a multi-step search loop',
        'Query rewriting: a small-model pass that resolves the follow-up against chat history into a standalone search query before retrieval',
        'Increase k to 30 so EU-related chunks appear by chance',
        'Fine-tune the embedding model on conversational queries'
      ],
      answer: [1],
      explanation: '"And what about for the EU?" contains no retrievable signal without the preceding turns; rewriting it to "data residency requirements for EU customers" costs one cheap-model call (~$0.0001, ~200ms) and is nearly mandatory for conversational RAG. (A) would work but is a 10× cost/latency sledgehammer for a solved problem. (C) is a lottery — the query vector still points nowhere. (D) — no embedding model can recover referents that are not in its input; the information lives in the history, which rewriting injects.'
    },
    {
      text: 'Which situations genuinely justify graph RAG over well-tuned vanilla retrieval? Choose TWO.',
      options: [
        'Multi-hop relational questions like "which customers depend on the service owned by the team whose lead just left?"',
        'Global-synthesis questions like "what are the recurring themes across this year\'s incident reports?"',
        'Users searching for exact error codes',
        'Reducing embedding costs at ingest',
        'Answers needing per-chunk citations'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'Top-k chunk retrieval structurally cannot follow relationship chains (each hop needs the previous hop\'s answer) and cannot summarize a whole corpus (it retrieves fragments, and no k covers everything) — entity graphs and community summaries exist precisely for these two shapes. (C) is a hybrid-search/BM25 problem, solved far cheaper. (D) is backwards: graph construction adds an LLM extraction pass over the corpus — costs go up, not down. (E) — vanilla RAG does per-chunk citations natively; no graph required.'
    },
    {
      text: 'Your corpus is 50k tokens of product docs updated monthly; expected load is 2,000 queries/month; you need answers this sprint. Sound architecture call?',
      options: [
        'Full RAG: chunking, vector DB, hybrid search, reranker — the industry standard',
        'Stuff the whole corpus into a cached prompt: at ~50k tokens it fits comfortably, caching makes per-query cost cents or less, there is no retrieval-miss failure mode, and it ships in days',
        'Fine-tune a small model on the docs to avoid per-query costs',
        'Graph RAG for maximum answer quality'
      ],
      answer: [1],
      explanation: 'The fits-in-context test decides this: 50k tokens fits every frontier window with room to spare; with cache reads at ~0.1× input price the monthly bill is trivial next to the payroll cost of building and operating a pipeline; monthly updates mean one re-cache per month. (A) is weeks of engineering plus permanent ops to solve a scale problem you do not have. (C) — fine-tuning is poor at knowledge injection and freezes facts that change monthly. (D) is the most expensive answer to a corpus with no evident relational-query need.'
    },
    {
      text: 'The team wants the assistant to (a) answer from a 200M-token, hourly-changing document base with per-customer access control, and (b) always respond in a rigid house report format that prompting keeps failing to enforce. What does the knowledge-vs-behavior framing prescribe?',
      options: [
        'Fine-tune on the document base to internalize both',
        'RAG for (a) — scale, freshness, and ACL-filtered retrieval — plus a light fine-tune for (b), because format consistency is behavior that lives in weights',
        'RAG alone; the format will improve as models get better',
        'Long-context stuffing with the full corpus per query'
      ],
      answer: [1],
      explanation: 'Knowledge that is huge, fresh, and permissioned is RAG\'s exact mandate; a rigid output format that resists prompting is the textbook fine-tuning use case — the combination is the standard mature architecture. (A) — fine-tuning cannot hold 200M changing tokens (facts go stale instantly) and cannot express per-customer ACLs. (C) ignores a stated, persistent requirement on hope. (D) — 200M tokens exceeds every context window by ~200×, and stuffing shows every customer everything, violating ACLs outright.'
    },
    {
      text: 'After adding multi-query (5 paraphrases) and HyDE simultaneously, p95 latency doubled and cost tripled, but your golden-set recall@5 moved from 0.78 to 0.80. What should the team conclude?',
      options: [
        'The techniques failed; the papers were wrong',
        'On this corpus the marginal recall was already captured by the existing hybrid+rerank stack; pay the 2-point gain only if it justifies 2× latency and 3× cost — and test such additions one at a time against the eval, not stacked on faith',
        'Recall@5 is saturated; switch the metric until improvements show',
        'Keep both since any improvement is worth shipping'
      ],
      answer: [1],
      explanation: 'Advanced patterns overlap in what they fix (mostly vocabulary/query-document mismatch); once hybrid + reranking works, their marginal value shrinks — which is exactly why each pattern carries a "when it\'s worth it" condition and why changes get evaluated individually. (A) overcorrects: the techniques work where their target failure mode dominates; that is a property of the corpus, not fraud. (C) is metric-shopping — the eval did its job by revealing a small effect. (D) ignores that latency and cost are product features too; a 2-point recall gain at p95 doubling is frequently a net product loss.'
    },
    {
      text: 'A spreadsheet of per-region rate limits was serialized row-by-row into chunks. "What is the EU Pro limit?" works, but "what is the average limit across regions?" reliably fails. Why, and what is the right fix?',
      options: [
        'Chunks are too small; merge the whole sheet into one chunk',
        'Top-k retrieval fetches a handful of rows, not all of them, so aggregations run on partial data — route computational/aggregation queries to a structured tool (SQL/dataframe) instead of RAG',
        'The embedding model cannot embed numbers; switch models',
        'Add a reranker so all region rows rank higher'
      ],
      answer: [1],
      explanation: 'Aggregation needs every row; top-k retrieval is sampling, and the model averages whatever subset arrived — structurally wrong regardless of tuning. Tabular-computation queries belong in a tool call; RAG handles the lookup-shaped ones. (A) helps only until the sheet outgrows a chunk, and one giant chunk embeds as topic soup (module 6). (C) — numbers embed fine; the failure is missing rows, not misread ones. (D) — reranking reorders candidates; it cannot make k cover N rows or make the model compute reliably over 200 of them.'
    },
    {
      text: 'You must defend a per-stage instrumentation budget to a skeptical manager who says "just measure whether answers are good." What is the strongest technical argument?',
      options: [
        'End-to-end metrics are always statistically invalid',
        'RAG quality is a product of stage success rates; an aggregate score cannot attribute a regression to parse, chunking, retrieval, ranking, or generation — so every incident becomes guess-and-check across five subsystems, and the visible knob (the prompt) gets tuned regardless of where failures live',
        'Per-stage metrics are required for SOC 2 compliance',
        'End-to-end evals require expensive human labelers'
      ],
      answer: [1],
      explanation: 'The chain-of-probabilities structure is the argument: five stages at 90% yields 59% end-to-end, and an aggregate number cannot say which stage moved. Stage attribution converts debugging from folklore to arithmetic — the weekly failure-class tally decides the next sprint. (A) is false; end-to-end metrics are valid and worth having — they are just insufficient alone. (C) is invented. (D) — end-to-end evals can be automated with judges; expense is not the discriminating issue, attribution is.'
    }
  ],
  flashcards: [
    { id: 'fc-rag-def', front: 'RAG in one sentence, framed for debugging?', back: 'A <b>data pipeline bolted to a prompt template</b>: ingest → chunk → embed → index → retrieve → rerank → generate. Quality problems are overwhelmingly data/retrieval problems, not model problems — debug data first, model last.' },
    { id: 'fc-chain-prob', front: 'Why do per-stage metrics beat one end-to-end score?', back: 'P(good answer) is a product of stage success rates (five stages at 90% = 59% end-to-end). An aggregate score cannot attribute regressions to parse/chunk/retrieve/rank/generate; per-stage metrics turn debugging into arithmetic.' },
    { id: 'fc-ingest-silent', front: 'Why is ingest the most underestimated RAG stage?', back: 'Parsers fail <em>silently</em> — you always get text, sometimes wrong text (two-column PDFs read across columns, flattened tables, boilerplate as content). Downstream stages faithfully process garbage. Habit: eyeball random raw parses per source type.' },
    { id: 'fc-parent-doc', front: 'Parent-document (small-to-big) retrieval?', back: 'Embed and search small precise units; hand the model the enclosing parent section or a window around the hit. Decouples the unit of matching from the unit of evidence. Near-universal win for QA; cost is only metadata bookkeeping.' },
    { id: 'fc-golden-set', front: 'What is a retrieval golden set and when do you build it?', back: '50–150 queries labeled with their relevant chunks/docs — built <b>before touching generation</b>. Best source: real user queries (they carry true vocabulary mismatch); LLM-generated ones inherit passage vocabulary and inflate scores.' },
    { id: 'fc-recall-k', front: 'recall@k — definition and the k values to track?', back: 'Fraction of queries with a relevant item in the top k. Track at prompt-k (what the model sees, e.g. recall@5) and at rerank-pool k (recall@50) — the gap between them is the reranker decision.' },
    { id: 'fc-mrr-ndcg', front: 'MRR vs nDCG — what does each see?', back: 'MRR = mean of 1/rank of the <em>first</em> relevant hit — top-position sensitivity. nDCG rewards more relevant items placed higher with graded relevance — the lens for multi-evidence answers and for measuring reranker gains.' },
    { id: 'fc-recall-rule', front: 'The recall@50 vs recall@5 decision rule?', back: 'High @50, low @5 → candidates exist, ordering is bad → add a <b>reranker</b>. Low @50 → no reranker can help → fix chunking, hybrid search, or query handling. Prevents the most common wasted month in RAG.' },
    { id: 'fc-failure-classes', front: 'Name the five classic RAG failure modes.', back: '(1) Retrieval miss, (2) stale index, (3) query-document mismatch, (4) lost-in-the-middle (evidence present, positionally ignored), (5) faithfulness failures (evidence present, contradicted/over-synthesized). Disjoint fixes — classify before fixing.' },
    { id: 'fc-stale-index', front: 'The two halves of index freshness?', back: 'Change detection (webhooks/CDC or scheduled re-crawls, with a per-source freshness SLA) AND <b>deletion propagation</b> — removed/superseded docs must leave the index. The deletion half is the one everyone forgets.' },
    { id: 'fc-knowledge-conflict', front: 'Why does a model contradict text sitting in its context?', back: 'Knowledge conflict: the parametric prior (public facts seen thousands of times in training) competes with your one contradicting paragraph — worst exactly where private truth diverges from public consensus. Mitigate: restrict-to-context + mechanically verified citations.' },
    { id: 'fc-query-rewrite', front: 'Query rewriting — cost and when it is near-mandatory?', back: 'Small-model pass resolving follow-ups against history into standalone search queries (~$0.0001, 100–300ms). Near-mandatory for conversational RAG — "what about for the EU?" has no retrievable signal on its own.' },
    { id: 'fc-hyde', front: 'HyDE — mechanism and honest verdict (early 2026)?', back: 'Generate a hypothetical answer, embed it, search with that vector (fake answers resemble real docs more than questions do). Verdict: shines zero-shot when you cannot tune the index; once hybrid + rerank exist, it usually adds a generation call for little gain.' },
    { id: 'fc-agentic', front: 'Agentic retrieval — what it buys and what it costs?', back: 'Search as a tool in a loop: model reformulates, inspects, re-retrieves, decides sufficiency. Best quality on multi-hop/research questions; costs 3–10× tokens, seconds-to-minutes latency, and hard-to-reproduce eval traces. Deploy behind a simple/hard query router.' },
    { id: 'fc-pattern-ladder', front: 'The RAG technique ROI ladder (typical docs corpus)?', back: 'Hybrid → reranker → structural chunking + parent retrieval → query rewriting → multi-query → agentic (hard slice) → HyDE (niche) → graph RAG (relational/global questions only). Measure before climbing each rung.' },
    { id: 'fc-fits-in-context', front: 'The fits-in-context test?', back: 'If the corpus fits comfortably in the window (with caching: ~0.1× read pricing making 100k-token prompts ~cents/query), stuff it and skip the entire pipeline. RAG earns its keep at scale, for freshness, or for per-user ACLs — not for 50k-token doc sets.' },
    { id: 'fc-rag-vs-ft', front: 'RAG vs fine-tuning in one line?', back: '<b>RAG changes what the model reads; fine-tuning changes how it behaves.</b> Knowledge that is large/fresh/permissioned → RAG. Format, style, domain behavior that resists prompting → fine-tuning. At maturity: often both.' },
    { id: 'fc-escalation', front: 'The tool-escalation ladder for grounded answers?', back: 'Prompting → context stuffing (if it fits) → RAG (scale/freshness/ACLs) → fine-tuning (behavior gaps) → both. Each step justified by a <em>measured</em> failure of the previous one, not by ambition.' },
    { id: 'fc-tabular', front: 'Why does RAG fail on "average across all regions" over a serialized spreadsheet?', back: 'Top-k retrieval is sampling — aggregations need every row, and the model averages whatever subset arrived. Route computational queries to SQL/dataframe tools; keep RAG for lookup-shaped questions.' }
  ],
  lab: {
    title: 'Build a measured RAG pipeline: golden set first, generation last',
    intro: '<p>You will build a small but honest RAG system in the order this module preaches: ingest and chunk a real corpus, build a retrieval golden set, measure recall@k/MRR, improve retrieval measurably, and only then wire up generation with verified citations. Uses an OpenAI-compatible API (or Ollama for $0).</p><p><b>Needs:</b> <code>python3</code>, an API key, ~25 minutes, worst case ~$0.25.</p>',
    steps: [
      {
        title: 'Ingest and chunk a real corpus two ways',
        html: '<p>Grab a real documentation set — e.g. clone a project whose docs you know (any repo with a <code>docs/</code> folder of Markdown works). Chunk it twice: fixed-size and structure-aware.</p>' +
          '<pre><code>pip install openai numpy rank-bm25\n\npython3 - &lt;&lt;\'EOF\'\nimport glob, json, re\n\ndocs = {p: open(p).read() for p in glob.glob("docs/**/*.md", recursive=True)}\nprint(len(docs), "files")\n\ndef fixed_chunks(text, size=400):  # ~words as a token proxy\n    w = text.split()\n    return [" ".join(w[i:i+size]) for i in range(0, len(w), size)]\n\ndef heading_chunks(text):\n    parts = re.split(r"(?m)^(#{1,3} .*)$", text)\n    out, head = [], ""\n    for p in parts:\n        if re.match(r"^#{1,3} ", p): head = p.strip("# ")\n        elif p.strip(): out.append(head + " — " + p.strip())  # heading path prepended\n    return out\n\ncorpus = {"fixed": [], "structural": []}\nfor path, text in docs.items():\n    for c in fixed_chunks(text):      corpus["fixed"].append({"src": path, "text": c})\n    for c in heading_chunks(text):    corpus["structural"].append({"src": path, "text": c})\njson.dump(corpus, open("corpus.json", "w"))\nprint({k: len(v) for k, v in corpus.items()})\nEOF</code></pre>' +
          '<p>Open <code>corpus.json</code> and actually read ten chunks from each strategy. Note how many fixed chunks start mid-sentence or mid-list — that is the pathology you are about to measure.</p>'
      },
      {
        title: 'Build the golden set BEFORE any generation code',
        html: '<p>Write 20–30 queries with known answer locations. Mix three sources: questions you would genuinely ask, questions phrased in <em>different words</em> than the docs use (this is the important slice), and 5 with exact identifiers (flag names, error strings).</p>' +
          '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json\ngolden = [\n  # {"q": "...", "src": "docs/path/to/answering-file.md"}\n  {"q": "how do I make the server listen on a different port", "src": "docs/configuration.md"},\n  {"q": "app will not start after upgrading", "src": "docs/troubleshooting.md"},\n  # ... write ~20 more against YOUR corpus; label at file level (coarse labels beat none)\n]\njson.dump(golden, open("golden.json", "w"))\nprint(len(golden), "labeled queries")\nEOF</code></pre>' +
          '<p>Resist generating these with an LLM from the chunks — the lesson-3 vocabulary trap would make your next step meaningless. Ten minutes of honest labeling here is the highest-ROI ten minutes in this lab.</p>'
      },
      {
        title: 'Measure recall@k and MRR for both chunking strategies',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json, numpy as np\nfrom openai import OpenAI\nclient = OpenAI()\ncorpus = json.load(open("corpus.json")); golden = json.load(open("golden.json"))\n\ndef embed(texts):\n    out = []\n    for i in range(0, len(texts), 256):\n        r = client.embeddings.create(model="text-embedding-3-small", input=texts[i:i+256])\n        out += [e.embedding for e in r.data]\n    return np.array(out, dtype=np.float32)\n\nfor strat, chunks in corpus.items():\n    X = embed([c["text"] for c in chunks])\n    Q = embed([g["q"] for g in golden])\n    hits5, rr = 0, 0.0\n    for qi, g in enumerate(golden):\n        order = np.argsort(-(X @ Q[qi]))\n        srcs = [chunks[i]["src"] for i in order[:10]]\n        if g["src"] in srcs[:5]: hits5 += 1\n        if g["src"] in srcs: rr += 1.0 / (srcs.index(g["src"]) + 1)\n    print(f"{strat:11s}  recall@5={hits5/len(golden):.2f}  MRR@10={rr/len(golden):.2f}")\nEOF</code></pre>' +
          '<p>You now have the number most RAG teams never compute. Check the exact-identifier queries specifically — dense-only retrieval should visibly struggle on them. Optional stretch: add a BM25 leg with RRF fusion (module 6 lab) and re-run; watch which golden-set slice moves.</p>'
      },
      {
        title: 'Only now: generation with verified citations',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json, numpy as np\nfrom openai import OpenAI\nclient = OpenAI()\ncorpus = json.load(open("corpus.json"))["structural"]\nX = np.load("structural.npy") if False else None  # or re-embed as in step 3\n\ndef answer(q, chunks_topk):\n    ctx = "\\n\\n".join(f"[{i}] {c[\'text\'][:1200]}" for i, c in enumerate(chunks_topk))\n    r = client.chat.completions.create(model="gpt-4o-mini", messages=[{\n      "role": "user",\n      "content": "Answer ONLY from the numbered context. Cite chunk numbers like [2] "\n                 "for every claim. If the context does not contain the answer, say "\n                 "\'not found in the docs\'.\\n\\nContext:\\n" + ctx + "\\n\\nQuestion: " + q}])\n    return r.choices[0].message.content\n\n# retrieval + answer for one query, then VERIFY: for each [n] cited,\n# check the claim\'s key terms actually appear in chunk n.\nEOF</code></pre>' +
          '<p>Run three probes: (1) a question your golden set says is answerable — check the citation numbers point at chunks that really contain the claims; (2) a question the corpus cannot answer — confirm you get the abstention, not an invention; (3) a question where public knowledge likely differs from this corpus — watch for the knowledge-conflict failure from lesson 4. You have now touched every failure class this module catalogued, on purpose, in a system where retrieval was measured before generation existed.</p>'
      }
    ],
    costNote: 'Worst case: embedding a few thousand chunks twice with text-embedding-3-small (~2M tokens ≈ $0.04) plus ~30 gpt-4o-mini generations (≈ $0.02) — call it $0.25 with generous re-runs. Fully $0 with Ollama (nomic-embed-text + llama3.2). Cleanup: <code>rm corpus.json golden.json *.npy</code> — no cloud resources persist.'
  }
});
