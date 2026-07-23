COURSE.register({
  id: 'm06-embeddings-vector-search',
  track: 'core',
  order: 6,
  title: 'Embeddings & vector search',
  short: 'Embeddings & search',
  tagline: 'Similarity math, ANN indexes, chunking, hybrid retrieval, and the vector DB decision — the retrieval substrate everything in module 7 stands on.',
  minutes: 105,
  lessons: [
    {
      id: 'similarity-metrics',
      title: 'Similarity metrics: cosine, dot, euclidean — and the normalization detail',
      blurb: 'Three metrics that are secretly one metric, until someone forgets to normalize.',
      html: '<h2>Three metrics, one geometry (usually)</h2>' +
        '<p>Every vector search system asks the same question: given a query vector, which stored vectors are "closest"? Three distance functions dominate:</p>' +
        '<ul>' +
        '<li><b>Cosine similarity</b> — the angle between vectors: <code>cos(a,b) = a·b / (|a||b|)</code>. Range −1..1. Ignores magnitude entirely; only direction matters.</li>' +
        '<li><b>Dot product</b> — <code>a·b</code>, unbounded. Rewards both alignment <em>and</em> magnitude: a long vector pointing roughly the right way can outscore a short vector pointing exactly the right way.</li>' +
        '<li><b>Euclidean (L2)</b> — straight-line distance <code>|a−b|</code>. Smaller is closer.</li>' +
        '</ul>' +
        '<p>Here is the fact that collapses the decision for most of your career: <b>on unit-normalized vectors (length 1), all three produce the same ranking.</b> Cosine equals dot product when magnitudes are 1, and squared L2 becomes <code>2 − 2·cos(a,b)</code> — a monotonic transform of cosine, so nearest-neighbor order is identical. Most embedding APIs (OpenAI text-embedding-3, Cohere embed-v3, Voyage) return pre-normalized vectors precisely so that the cheap dot product is safe to use everywhere.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> The metric choice is not a tuning knob — it is a correctness constraint. Match the metric your embedding model was trained with (its model card says), normalize if it expects normalized inputs, and then stop thinking about it. There is no corpus where switching cosine to L2 on normalized vectors "improves recall" — anyone claiming that has a bug elsewhere.</div>' +
        '<h2>Normalization: the silent decider</h2>' +
        '<p>The trouble starts when vectors are <em>not</em> unit length. Open-source models served through sentence-transformers only normalize if you pass <code>normalize_embeddings=True</code>; roll your own pooling over a raw transformer and you get unnormalized vectors whose magnitude correlates with things like token count and word frequency. Feed those into a dot-product index and long, keyword-dense chunks float to the top of every query — a real production pattern where one 2,000-token boilerplate legal chunk matched <em>everything</em>.</p>' +
        '<p>When is unnormalized dot product deliberately correct? Recommendation systems: matrix-factorization embeddings encode popularity in the magnitude, so dot product usefully biases toward popular items. Some retrieval models are also trained with dot product on purpose. But for text retrieval with modern embedding APIs, the rule is: normalize, use dot/cosine interchangeably, move on.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Index implementations exploit the equivalence. HNSW on cosine is implemented as dot product over normalized copies of your vectors (Qdrant, pgvector do the normalize-once-at-insert trick — a dot product per comparison is one fused-multiply-add loop, SIMD-friendly, ~1536 mults in ~100ns). L2 needs a subtract per dimension first, which is why dot-friendly layouts are the fast path everywhere.</div>' +
        '<h2>Scores are not probabilities — calibration and thresholds</h2>' +
        '<p>Engineers coming from classical ML expect a similarity of 0.83 to "mean" something. It does not. Three hard truths:</p>' +
        '<ul>' +
        '<li><b>Score distributions are model-specific.</b> Many embedding models are anisotropic — all vectors crowd into a narrow cone, so even unrelated texts score 0.5–0.7 cosine. OpenAI text-embedding-3 models spread scores lower; a 0.45 there can be a strong match. A threshold tuned on one model is garbage on another.</li>' +
        '<li><b>Scores are corpus-relative.</b> The same 0.62 means "best of a bad bunch" on a sparse corpus and "seventeen better candidates exist" on a dense one. Absolute-threshold cutoffs ("only show results above 0.7") are the number-one cause of mysteriously empty RAG contexts.</li>' +
        '<li><b>Scores across models never compare.</b> Two embedding models define two unrelated coordinate systems. Mixing their vectors in one index fails silently — no dimension error if dims happen to match, just meaningless neighbors (module 1 covered this war story; module 6 lesson 6 covers the migration that avoids it).</li>' +
        '</ul>' +
        '<p>If you need a "is this actually relevant?" signal, use rank-based cutoffs (take top-k, always), a reranker score (cross-encoders are better calibrated — lesson 5), or tune a per-model threshold against a labeled set of ~100 query-document pairs from <em>your</em> corpus.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team shipped "no answer found" logic keyed on cosine &lt; 0.75, tuned by eyeballing ada-002 scores. They upgraded to text-embedding-3-large — whose score distribution sits visibly lower — and the bot started answering "I could not find anything" for queries with perfect matches at 0.55. No errors, no alerts; a 30% drop in answer rate discovered a week later in product analytics. Thresholds are model-coupled config: version them together.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "When do cosine and dot product differ, and when would you prefer each?" Strong answer: identical on normalized vectors; dot product rewards magnitude, so use it when magnitude carries signal (recommendations, popularity priors) and cosine/normalized-dot for text similarity. Bonus: mention that squared L2 on normalized vectors is 2−2cos, so all three rank identically — and that thresholds do not transfer across models.</div>'
    },
    {
      id: 'hnsw-internals',
      title: 'ANN part 1: HNSW internals',
      blurb: 'Layered skip-list graphs, M and ef, and the recall-vs-latency dial you actually operate.',
      html: '<h2>Why approximate at all</h2>' +
        '<p>Exact nearest-neighbor search is a linear scan: compare the query to every vector. With SIMD, scanning 1M×1024-dim float32 vectors takes ~50–200ms on one CPU core and reads 4GB from RAM. At 10M vectors and real QPS, you are burning cores and blowing latency budgets. Approximate nearest neighbor (ANN) indexes trade a little recall — returning, say, 97 of the true top-100 — for 10–100× less work per query. Below ~100k vectors, note well, <b>brute force is fine</b> and has 100% recall with zero index maintenance; do not deploy an ANN index to search 20k support articles.</p>' +
        '<h2>HNSW: a skip list made of graphs</h2>' +
        '<p>Hierarchical Navigable Small World (Malkov &amp; Yashunin, 2016) is the default index in pgvector, Qdrant, Weaviate, Elasticsearch, and most managed services. The structure:</p>' +
        '<ul>' +
        '<li>Every vector is a node in a <b>layer-0 graph</b>, connected to up to <code>2·M</code> near neighbors (M is the build-time fanout parameter, default 16).</li>' +
        '<li>A random subset of nodes (each node is promoted with probability ~1/e per level) also exists in <b>higher layers</b> — sparser graphs with longer-range links. Think skip list: top layers for coarse navigation, layer 0 for precision.</li>' +
        '<li><b>Search</b>: enter at the top layer\'s entry point, greedily hop to whichever neighbor is closest to the query, drop a layer when no neighbor improves, repeat. At layer 0, switch from pure greedy to a <b>beam search</b> that keeps the best <code>ef</code> candidates (efSearch), exploring until none of the frontier beats the worst of the current top-ef. Return the k best.</li>' +
        '</ul>' +
        '<p>Total work is roughly O(log N) hops times ef distance computations — a few thousand comparisons instead of millions. That is the entire trick: a navigable graph where greedy routing from anywhere reaches near-anything in few hops ("small world").</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Build quality is governed by <code>efConstruction</code> (default 64–200): how many candidates are considered when wiring each inserted node. Higher = better graph = better recall ceiling, at linearly more build time. M controls memory and connectivity: each node stores ~2·M×8-byte neighbor ids at layer 0, so M=16 adds ~256 bytes/vector of graph overhead on top of the vector itself (a 1536-dim float32 vector is 6,144 bytes — graph overhead is real but not dominant). Low M (&lt;8) risks a disconnected graph on hard distributions; high M (&gt;48) buys little and bloats RAM.</div>' +
        '<h2>The dial you operate in production: efSearch</h2>' +
        '<p>M and efConstruction are frozen at build time. <code>efSearch</code> is per-query: the beam width, and therefore the recall-vs-latency dial. Typical shape of the curve (1M vectors, 1024 dims, single node — as of early 2026 these are unremarkable numbers):</p>' +
        '<table><tr><th>efSearch</th><th>recall@10</th><th>p50 latency</th></tr>' +
        '<tr><td>16</td><td>~0.85</td><td>~0.3ms</td></tr>' +
        '<tr><td>64</td><td>~0.96</td><td>~1ms</td></tr>' +
        '<tr><td>128</td><td>~0.98</td><td>~2ms</td></tr>' +
        '<tr><td>512</td><td>~0.995</td><td>~7ms</td></tr></table>' +
        '<p>The curve saturates: past a point you pay linear latency for asymptotic recall. Measure recall against a brute-force ground truth on <em>your</em> data (the lab does exactly this) and pick the knee. Remember efSearch can never return more than it explores — set <code>efSearch ≥ k</code>, and if you rerank top-50, efSearch must comfortably exceed 50.</p>' +
        '<h2>What HNSW is bad at</h2>' +
        '<ul>' +
        '<li><b>Memory.</b> The whole structure lives in RAM for speed. 10M×1536-dim float32 = ~61GB of vectors + ~3GB of graph. This is the #1 reason quantization (next lesson) exists.</li>' +
        '<li><b>Deletes.</b> Removing a node would tear routing paths, so implementations tombstone: the node stays in the graph, gets filtered from results. Heavy churn (&gt;10–20% deleted) degrades recall and speed until a rebuild/vacuum. Update-heavy workloads need scheduled reindexing.</li>' +
        '<li><b>Build time.</b> Inserting 10M vectors at efConstruction=200 is hours of CPU. Bulk-load paths and parallel builds (pgvector builds HNSW in parallel since 0.6) help, but "just reindex" is a maintenance window, not a click.</li>' +
        '<li><b>Filtered search.</b> Greedy routing assumes it can walk anywhere; a restrictive metadata filter turns the graph into swiss cheese. Lesson 6 covers the workarounds.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> An ingestion pipeline that re-embedded and re-upserted every document nightly (even unchanged ones) quietly turned 40% of an HNSW index into tombstones over a quarter. Recall@10 drifted from 0.97 to 0.81 with zero code changes and zero alerts — retrieval "felt dumber" in support tickets before anyone checked index stats. Upsert only on content-hash change, and monitor deleted-fraction like you monitor disk space.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Explain HNSW to me and tell me which parameters you would tune." Strong answer: skip-list-of-graphs mental model, greedy descent then beam search at layer 0, M/efConstruction fixed at build vs efSearch per query, and the recall-latency curve with a knee you find empirically. Mentioning tombstone decay under churn signals you have actually run one.</div>'
    },
    {
      id: 'ivf-quantization',
      title: 'ANN part 2: IVF, quantization, and picking an index',
      blurb: 'Cluster-and-probe, shrinking vectors 4–32×, and the decision table.',
      html: '<h2>IVF: cluster, then probe</h2>' +
        '<p>The other classic ANN family is the inverted file index (IVF). Build: run k-means over a sample to produce <code>nlist</code> centroids (rule of thumb ~√N to 4√N; e.g. 4,096 lists for 4M vectors); assign every vector to its nearest centroid\'s posting list. Search: compare the query to all centroids, pick the closest <code>nprobe</code> lists (say 32 of 4,096), scan only those — you touch nprobe/nlist of the data, ~1% here.</p>' +
        '<p>IVF vs HNSW trade-offs: IVF builds far faster (k-means + assignment vs graph wiring), maps naturally to disk and batch rebuilds, and pairs beautifully with quantization (FAISS\'s IVF-PQ, LanceDB\'s default). HNSW gives better recall-latency at moderate scale and handles incremental inserts more gracefully. IVF has a sharp edge HNSW does not: <b>the centroids are a snapshot of your data distribution at training time.</b> Ingest a new corpus that looks different (new language, new domain), and vectors pile into ill-fitting clusters near cluster boundaries; recall sags until you retrain centroids and rebuild. pgvector\'s IVFFlat docs say it plainly: create the index <em>after</em> loading representative data.</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> The boundary problem is IVF\'s tax: a query landing near a cluster edge has true neighbors in lists you did not probe. Raising nprobe buys recall linearly in scan cost — nprobe=nlist is brute force. Typical operating points: nprobe 1–5% of nlist for recall@10 around 0.9–0.98 depending on data. As with efSearch, measure on your corpus; published curves are always someone else\'s distribution.</div>' +
        '<h2>Quantization: pay less per vector</h2>' +
        '<p>At scale, memory is the bill. 100M×1536-dim float32 is ~600GB of raw vectors — that is a cluster, not a server. Quantization shrinks each vector:</p>' +
        '<ul>' +
        '<li><b>Scalar quantization (SQ, int8):</b> map each float32 dimension to one byte. 4× smaller, ~1–2% recall loss, nearly free to implement. Elasticsearch and Qdrant do int8 by default or one flag. As of early 2026 this is the "always on" choice.</li>' +
        '<li><b>Product quantization (PQ):</b> split the vector into m subvectors (e.g. 96 subvectors of 16 dims); k-means each subspace into 256 codes; store one byte per subvector. 1536-dim float32 → 96 bytes = 64× smaller. Distances computed from precomputed lookup tables — fast, but lossy enough (recall can drop 5–15 points) that PQ is used as a first pass, not a final answer.</li>' +
        '<li><b>Binary quantization (BQ):</b> keep one bit per dimension (sign). 32× smaller, and distance becomes Hamming — XOR + popcount, absurdly fast. Works surprisingly well on high-dim, well-spread embeddings (1024+ dims; OpenAI and Cohere embeddings hold up; some older/anisotropic models collapse).</li>' +
        '</ul>' +
        '<p>The pattern that makes aggressive quantization safe is <b>two-stage search with rescoring</b>: search the compressed index for top-200 candidates, then recompute exact distances for those 200 using full-precision vectors kept on disk, return top-10. You get most of the memory win and give back almost none of the recall. Qdrant, Weaviate, and pgvector (halfvec/bit + reorder patterns) all support this shape.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> A related lever lives in the embedding model itself: Matryoshka representation learning (MRL) trains models so prefixes of the vector are usable embeddings. OpenAI text-embedding-3-large at 3072 dims can be truncated to 1024 or 256 dims (renormalize after truncating!) with graceful quality decay — 12× storage reduction before the index even sees the vector. Truncation + int8 + rescoring stack multiplicatively.</div>' +
        '<h2>Choosing: a decision table</h2>' +
        '<table><tr><th>Scale / constraint</th><th>Index</th><th>Why</th></tr>' +
        '<tr><td>&lt;100k vectors</td><td>Brute force (flat)</td><td>100% recall, zero maintenance, ~ms latency; ANN is premature</td></tr>' +
        '<tr><td>100k–10M, RAM available</td><td>HNSW (+int8 SQ)</td><td>Best recall/latency, incremental inserts, every store supports it</td></tr>' +
        '<tr><td>10M–100M, RAM tight</td><td>HNSW+BQ/PQ with rescore, or IVF-PQ</td><td>Memory is the binding constraint; two-stage keeps recall</td></tr>' +
        '<tr><td>100M–1B+, batch-heavy</td><td>IVF-PQ / DiskANN-style on NVMe</td><td>Disk-resident graphs (DiskANN, Milvus, LanceDB) trade latency (~5–20ms) for 10× cheaper hardware</td></tr>' +
        '<tr><td>Heavy churn (constant updates)</td><td>HNSW with scheduled rebuilds, or a store that compacts (Qdrant, Milvus)</td><td>Tombstone decay is the silent killer; own the rebuild cadence</td></tr></table>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "You have 200M embeddings and a 64GB box — design the search." Walk the math out loud: 200M×1024×4B = 800GB raw, so full-precision RAM is out; binary quantization → 25GB in RAM for the fast pass, full vectors on NVMe for rescoring top-200, HNSW or IVF over the binary codes. Saying the numbers is the signal; the specific index name is almost secondary.</div>'
    },
    {
      id: 'chunking',
      title: 'Chunking: the unglamorous decision that dominates quality',
      blurb: 'Size and overlap trade-offs, structural vs fixed splitting, and the metadata you must carry.',
      html: '<h2>Why chunking exists at all</h2>' +
        '<p>An embedding model pools an entire input into <em>one</em> vector. Feed it a 6,000-token document covering pricing, SLAs, and a migration guide, and you get a vector pointing at the centroid of three topics — matching none of them well. Feed it a 15-token sentence and the vector is sharp but context-free ("it defaults to 30 seconds" — what does?). Chunking is the art of cutting documents into units that are each <em>about one thing</em> while carrying enough context to be interpretable alone — because the chunk, not the document, is what gets embedded, retrieved, and stuffed into the LLM\'s context.</p>' +
        '<p>Two separate constraints get conflated: the embedding model\'s input limit (8,191 tokens for OpenAI text-embedding-3; 512 for many open-source BERT-lineage models — a hard truncation cliff where text past the limit silently vanishes from the vector) and the <em>useful</em> semantic size, which is much smaller. Empirically, retrieval quality for question-answering peaks around <b>200–800 tokens per chunk</b>, with 300–500 the boringly reliable default as of early 2026.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team embedded whole PDFs "to keep context" with a 512-token open-source model. The tokenizer truncated at 512 — so every vector represented only each document\'s first half-page, mostly title pages and legal boilerplate. Retrieval returned documents whose <em>openings</em> resembled the query. No error, no warning; discovered only when someone noticed page 40 content was never retrievable. Know your embedding model\'s input limit and assert on it in the pipeline.</div>' +
        '<h2>Size and overlap: the actual trade-offs</h2>' +
        '<ul>' +
        '<li><b>Small chunks (100–300 tokens):</b> precise vectors, high retrieval precision, but fragments lose antecedents ("this setting", "the above table") and you need more of them in context to reconstruct an answer — more k, more assembly risk.</li>' +
        '<li><b>Large chunks (800–1500+):</b> self-contained, fewer retrieval calls to cover an answer, but vectors blur across topics (recall drops for specific questions) and every retrieved chunk spends more of your generation context budget (module 8) on padding.</li>' +
        '<li><b>Overlap (typically 10–20%):</b> insurance against cutting a sentence or fact at a boundary. Costs storage and embedding spend linearly (20% overlap = 20% more of both) and creates near-duplicate chunks that can crowd the top-k with three copies of the same paragraph. If you retrieve k=5 and two are overlap-twins, you effectively retrieved 4. Dedupe by document+position at query time, or better, use structure so you need less overlap.</li>' +
        '</ul>' +
        '<h2>Fixed vs structural vs semantic splitting</h2>' +
        '<p><b>Fixed-size</b> (every N tokens, sliding window) is the baseline: trivial, uniform, and ignorant — it will split a code block mid-function and a table mid-row. <b>Structural (recursive) splitting</b> respects the document\'s own boundaries: split on headings, then paragraphs, then sentences, only falling back to hard cuts when a unit exceeds the size cap. For Markdown/HTML/code — anything with real structure — structural wins and it is not close: a chunk that is exactly one runbook section titled "Rotating API keys" is retrieval gold. <b>Semantic chunking</b> (embed sentences, cut where consecutive-sentence similarity dips) is the fancy option; it occasionally beats structural on unstructured prose, costs an embedding pass at ingest, and in most published and private evals the gain over good structural chunking is small. Try it only after structural + metadata + hybrid search are in place.</p>' +
        '<p>Special cases that punish naive splitters: <b>tables</b> (split a table from its header row and every fragment is meaningless — keep tables whole, or serialize each row with its headers), <b>code</b> (split on function/class boundaries via tree-sitter, not lines), and <b>PDFs</b> (layout extraction is its own hell — module 7 covers ingestion in anger).</p>' +
        '<h2>Metadata: the part everyone under-builds</h2>' +
        '<p>A chunk without provenance is a liability. Carry at minimum: source document id and URL, section/heading path ("Admin Guide &gt; Security &gt; Rotating API keys"), position (for neighbor expansion and dedupe), timestamps (for freshness filtering and stale-index debugging), access-control tags (retrieval must respect permissions — bolting ACLs on later is a rewrite), and the embedding model version (lesson 6). Two high-leverage tricks:</p>' +
        '<ul>' +
        '<li><b>Prepend the heading path to the chunk text before embedding.</b> "Rotating API keys — you can rotate keys from the console…" disambiguates pronouns and anchors the vector. Cheap, consistently worth 2–5 points of recall.</li>' +
        '<li><b>Contextual enrichment:</b> have an LLM write 1–2 sentences situating each chunk in its document, prepended before embedding (Anthropic\'s "contextual retrieval" write-up reported ~35–49% fewer retrieval failures combining this with hybrid search, as of late 2024). Costs one cheap-model call per chunk at ingest — with prompt caching of the shared document, roughly $1 per million document tokens — and pays rent on every query thereafter.</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Chunking is a lossy projection of documents into retrieval units. Every downstream metric — recall, faithfulness, context cost — is bounded by it. Teams tune rerankers for weeks to claw back 3 points that a heading-aware chunker with prepended titles would have delivered in an afternoon.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How would you chunk 10,000 mixed PDFs and Markdown runbooks?" Strong answers are boring: convert to structured text, split on headings with a 300–500 token target and ~15% overlap fallback, keep tables/code intact, prepend heading paths, carry source/section/ACL/model-version metadata, and — the senior move — say you will validate with a retrieval eval set (module 7) rather than by vibes.</div>'
    },
    {
      id: 'hybrid-rerankers',
      title: 'Hybrid search and rerankers: BM25, RRF, and the top-50 rescore',
      blurb: 'Why dense misses exact identifiers, how rank fusion fixes it, and when a cross-encoder pays.',
      html: '<h2>Where dense-only retrieval whiffs</h2>' +
        '<p>Embeddings compress meaning and discard surface form. That is the feature — "container evicted under memory pressure" matches "pod OOMKilled" — and also the bug: exact identifiers have no semantic neighborhood. Error codes (<code>ORA-01555</code>), part numbers, function names, CVEs, people\'s names, version strings — the tokenizer shreds them into meaningless fragments and the vector barely registers them. Users search for exactly these things. Meanwhile <b>BM25</b> — the 1990s term-frequency ranking function behind Lucene/Elasticsearch — nails exact tokens, rare terms (its IDF weighting <em>loves</em> rare terms), and boolean-ish precision, while being blind to synonyms and paraphrase. The two failure profiles are near-perfect complements, which is why hybrid search is the as-of-early-2026 default for production RAG, not an optimization.</p>' +
        '<h2>Fusing two ranked lists: RRF</h2>' +
        '<p>You now have two result lists whose scores live on incomparable scales (BM25: unbounded, corpus-dependent; cosine: model-dependent distribution — lesson 1). Do not try to normalize and weight raw scores; that path is a per-corpus tuning treadmill. <b>Reciprocal Rank Fusion</b> throws the scores away and uses only ranks:</p>' +
        '<pre><code>RRF(d) = Σ over lists  1 / (k + rank_list(d))     # k = 60 by convention</code></pre>' +
        '<p>A document ranked 1st in BM25 and 8th in dense scores 1/61 + 1/68. The constant k=60 damps the difference between rank 1 and rank 5 so one list cannot dominate; documents appearing in <em>both</em> lists get a natural boost. RRF is embarrassingly simple, has one insensitive parameter, needs zero training, and is what Elasticsearch, OpenSearch, Qdrant, Weaviate, and pgvector recipes all ship. Weighted score fusion can beat it by a point or two <em>if</em> you maintain per-corpus weight tuning; almost nobody should.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> The neural cousin of BM25 is learned sparse retrieval (SPLADE, Elastic\'s ELSER): a transformer emits weighted term expansions ("OOMKilled" also lights up "memory", "kill", "container"), stored in a classic inverted index. You get exact-match behavior plus some semantics in one index. Cost: heavier ingest compute and bigger postings. Worth knowing it exists; hybrid BM25+dense+RRF remains the deployment default.</div>' +
        '<h2>Rerankers: the second-stage rescore</h2>' +
        '<p>Everything so far is a <b>bi-encoder</b>: query and document embedded <em>separately</em>, meeting only at a dot product. Fast — the corpus is pre-embedded — but the model never sees query and document together, so it cannot resolve fine-grained relevance ("does this chunk answer <em>this specific</em> question or just share its topic?"). A <b>cross-encoder</b> feeds the concatenated (query, document) pair through a transformer and outputs one relevance score. It reads them jointly with full attention — dramatically more accurate, and dramatically more expensive: one full forward pass <em>per candidate per query</em>, unbatchable ahead of time because the query is not known until it arrives.</p>' +
        '<p>Hence the universal two-stage architecture: <b>fast retrieval (hybrid) pulls top-50–100 candidates; a cross-encoder rescores those; you keep the top 5–10.</b> The numbers as of early 2026: hosted rerankers (Cohere Rerank 3.5, Voyage rerank-2, Jina reranker) run ~$1–2 per 1,000 queries at 100 candidates and add ~100–400ms; a self-hosted bge-reranker-v2-m3 on one small GPU adds ~50–150ms for 50 candidates. Typical gains: 5–15 points of nDCG@10 on real corpora — usually the single largest quality jump available after hybrid search itself.</p>' +
        '<h2>When the rescore pays — and when it does not</h2>' +
        '<ul>' +
        '<li><b>Pays:</b> RAG answer quality gates on getting the right 5 chunks from a plausible 50 (precision@5 is your bottleneck); latency budget can absorb 100–300ms; candidate sets are genuinely confusable (dense docs, similar sections). Also: reranker scores are far better calibrated than cosine, so "no relevant document" thresholds finally work.</li>' +
        '<li><b>Does not pay:</b> your recall@50 is the problem (reranking cannot rescue candidates that were never retrieved — fix chunking/hybrid first); strict latency budgets (&lt;100ms end-to-end); or the first stage is already precise on easy corpora. Rerank spend on top of a broken first stage is the classic cargo-cult buy.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team added a hosted reranker and quality <em>dropped</em>. Cause: they reranked top-10 instead of top-50 — the reranker had no better candidates to promote, but its scores reordered the list enough to push the best chunk from position 1 to 4, and their prompt only used the top 3. Rerankers need a wide candidate pool to earn their keep: rescore 50–100, keep 5–10. Rank order into the prompt still matters (module 8, lost-in-the-middle).</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your users complain that searching an error code returns tangentially related docs. Diagnose." The expected chain: dense-only retrieval + tokenizer fragmentation of rare identifiers → add BM25 leg + RRF fusion → cross-encoder rescore of top-50 for precision → and cite recall@k evidence, not vibes. Bonus: mention bi- vs cross-encoder asymmetry as the <em>reason</em> two stages exist at all.</div>'
    },
    {
      id: 'vector-db-ops',
      title: 'The vector DB landscape and the ops nobody demos',
      blurb: 'Vendor-neutral comparison, when Postgres is enough, and re-embedding migrations done right.',
      html: '<h2>The landscape, as of early 2026</h2>' +
        '<table><tr><th>System</th><th>Shape</th><th>Index / hybrid</th><th>Sweet spot</th></tr>' +
        '<tr><td>pgvector (Postgres)</td><td>Extension in your existing RDBMS</td><td>HNSW + IVFFlat; halfvec/bit types; BM25 via tsvector or pg_search</td><td>You already run Postgres; ≤5–10M vectors; joins/transactions/ACLs with your data</td></tr>' +
        '<tr><td>Qdrant</td><td>Dedicated, Rust, OSS + cloud</td><td>HNSW with filterable graph links; built-in sparse vectors; int8/binary quantization</td><td>Rich metadata filtering at scale, self-host control</td></tr>' +
        '<tr><td>Weaviate</td><td>Dedicated, Go, OSS + cloud</td><td>HNSW (+flat/dynamic); native BM25+dense hybrid with fusion built in</td><td>Batteries-included hybrid search, multi-tenancy features</td></tr>' +
        '<tr><td>Pinecone</td><td>Managed SaaS only</td><td>Proprietary serverless (storage/compute split); sparse+dense</td><td>Zero ops appetite, spiky scale, pay-per-use</td></tr>' +
        '<tr><td>Milvus</td><td>Distributed, OSS + cloud (Zilliz)</td><td>Widest index menu: HNSW, IVF-PQ, DiskANN, GPU indexes</td><td>Hundreds of millions to billions of vectors, dedicated infra team</td></tr>' +
        '<tr><td>Elasticsearch / OpenSearch</td><td>Search engine with kNN</td><td>HNSW (int8 default in ES); best-in-class BM25, aggregations, ELSER/sparse</td><td>You already run ELK; text search + facets + vectors in one system</td></tr>' +
        '<tr><td>LanceDB</td><td>Embedded / serverless, columnar on object storage</td><td>IVF-PQ default; runs off S3/local disk, no server</td><td>Local dev, lakehouse-adjacent pipelines, cheap cold storage of vectors</td></tr></table>' +
        '<p><b>When is Postgres enough?</b> More often than the vendor content suggests: a few million vectors, low hundreds of QPS, filters expressible as WHERE clauses — pgvector on a box you already operate, with your ACLs, backups, and transactions, beats introducing a new stateful distributed system. You outgrow it when: vector RAM crowds out your OLTP workload, you need billion-scale or aggressive quantization tiers, or index rebuilds start fighting your transactional load. The honest heuristic: <b>the retrieval database you already operate well beats the theoretically better one you operate badly.</b></p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Vector search is a feature, not a product category — it is being absorbed into every database (Postgres, Elastic, Mongo, Redis, SQLite all have it now). Choose on the boring axes: ops model, filtering power, hybrid support, and where your data already lives. The ANN algorithm inside is the most commoditized part of the stack.</div>' +
        '<h2>Filtering × ANN: the interplay that bites</h2>' +
        '<p>"Vector search WHERE tenant_id = 42 AND doc_type = \'runbook\'" is where ANN indexes get weird. Two naive strategies fail at the edges: <b>post-filtering</b> (ANN top-k, then filter) returns fewer than k — or zero — results when the filter is selective (top-50 retrieved, 1% match the tenant, you present 0–1 chunks); <b>pre-filtering</b> (filter first, brute-force the survivors) is correct but slow when the filter matches millions. Production engines blend: Qdrant builds filter-aware HNSW links and falls back to exact scan below a cardinality threshold; pgvector 0.8+ does iterative index scans (keep walking the graph until k filtered results are found); Weaviate/Milvus apply allow-lists during traversal — which still degrades recall and latency when the filter passes &lt;1–5% of nodes, because the graph walk keeps hitting dead ends.</p>' +
        '<ul>' +
        '<li>High-cardinality mandatory filters (tenant!) deserve <b>partitioning/namespaces</b> — one index per tenant shard, not one global index plus a filter.</li>' +
        '<li>Test retrieval quality <em>with production-realistic filters applied</em>; an unfiltered recall benchmark is fiction for a multi-tenant app.</li>' +
        '<li>Watch p99 under selective filters — that is where iterative scans blow up.</li>' +
        '</ul>' +
        '<h2>Re-embedding migrations and index versioning</h2>' +
        '<p>Embedding models are dependencies that you <em>will</em> upgrade — better models ship yearly, and vectors from different models are mutually meaningless. Treat the switch like a database migration, never an in-place edit:</p>' +
        '<ol>' +
        '<li><b>Version everything:</b> index/collection names carry the embedding model id (<code>docs_te3l_v2</code>); every stored vector row carries model + dims + preprocessing hash. Unknown-version vectors are bugs you can now detect.</li>' +
        '<li><b>Blue-green re-embed:</b> build the new index alongside the old — full corpus re-embed. Cost the backfill honestly: 10M chunks × ~400 tokens = 4B tokens; at text-embedding-3-small ($0.02/Mtok) that is ~$80; at -3-large ($0.13/Mtok) ~$520 — plus days of rate-limited pipeline time. The dollars are usually trivial; the pipeline time and the eval work are not.</li>' +
        '<li><b>Dual-write during the cutover window</b> so new documents land in both indexes; replay any gap.</li>' +
        '<li><b>Evaluate before flipping:</b> run your retrieval golden set (module 7) against both indexes; re-tune k, thresholds, and reranker interplay — they are all model-coupled. Flip the alias, keep the old index warm for a week for instant rollback.</li>' +
        '</ol>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> The half-migrated index is the canonical vector-search outage: someone points the ingest pipeline at the new embedding model before the backfill finishes, and for three days queries embedded with model B are scored against a corpus that is 80% model-A vectors. Nothing errors — dimensions matched — retrieval is just quietly random for most of the corpus. Version checks at write time (reject vectors whose model tag mismatches the index) turn this from a silent quality incident into a loud pipeline failure, which is the good kind.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Walk me through upgrading the embedding model on a live 20M-vector system." They are probing for: incompatible-spaces awareness, blue-green + dual-write, backfill cost math said out loud, eval-gated cutover, and rollback. Anyone who says "re-embed in place over the weekend" has not been paged for this yet.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your team self-hosts an open-source embedding model and builds a dot-product HNSW index. Long boilerplate-heavy chunks dominate the top results for almost every query. Most likely cause?',
      options: [
        'HNSW efSearch is set too low, biasing toward hub nodes',
        'The vectors are not unit-normalized, so magnitude (which correlates with chunk length/term stats) inflates dot-product scores',
        'BM25 is leaking into the dense scores',
        'The chunks exceed the context window of the LLM'
      ],
      answer: [1],
      explanation: 'Unnormalized dot product rewards vector magnitude as well as direction; self-served models often skip normalization unless you ask for it, and magnitude correlates with content statistics — so a few long generic chunks outscore precise matches everywhere. Low efSearch (A) hurts recall but does not systematically favor long chunks. (C) is impossible in a pure dense index — there is no BM25 component to leak. (D) concerns generation, not retrieval ranking.'
    },
    {
      text: 'You must pick between cosine similarity and euclidean distance for an index over OpenAI text-embedding-3 vectors (which arrive unit-normalized). What is the correct engineering position?',
      options: [
        'Cosine — euclidean fails in high dimensions',
        'Euclidean — it is a true metric and cosine is not',
        'The rankings are identical on normalized vectors (L2² = 2−2·cos), so choose whichever the store computes fastest and move on',
        'Run an A/B test on production traffic, since the better metric is corpus-dependent'
      ],
      answer: [2],
      explanation: 'On unit vectors, squared euclidean distance is a monotonic transform of cosine, so nearest-neighbor rankings are identical — the choice is a performance detail (dot product is the SIMD-friendly fast path), not a quality lever. (A) and (B) both invent a quality difference that cannot exist under normalization. (D) sounds rigorous but tests a mathematical identity — the A/B will show zero difference while burning a sprint.'
    },
    {
      text: 'Recall@10 on your 5M-vector HNSW index measures 0.86 against brute-force ground truth; p50 latency is 0.4ms and your budget is 15ms. What is the right first move?',
      options: [
        'Rebuild the index with a much higher M value',
        'Raise efSearch and re-measure — you have latency headroom to walk up the recall curve at query time without rebuilding',
        'Switch to an IVF index, which has higher recall ceilings',
        'Reduce vector dimensionality to make the space easier to search'
      ],
      answer: [1],
      explanation: 'efSearch is the per-query recall/latency dial and needs no rebuild — at 0.4ms against a 15ms budget you can afford 10–30× more exploration, which typically moves recall from 0.86 into the high 0.9s. Raising M (A) can raise the recall ceiling but costs a full rebuild and more RAM — try the free knob first. (C) is backwards: IVF is not a recall upgrade over well-tuned HNSW. (D) trades away embedding quality to solve a problem the query-time parameter already solves.'
    },
    {
      text: 'Six months after launch, your IVFFlat index (centroids trained on the original English docs corpus) now also holds a large newly ingested Japanese corpus. Japanese-query recall is poor even at high nprobe. Root cause?',
      options: [
        'IVF cannot handle non-English text',
        'The k-means centroids snapshot the old distribution; the new corpus piles into ill-fitting clusters, so true neighbors sit in lists the probe never selects — retrain centroids and rebuild',
        'Japanese tokens inflate BM25 scores and drown the dense results',
        'The Japanese vectors need L2 instead of cosine'
      ],
      answer: [1],
      explanation: 'IVF partitions space using centroids learned at build time; a distribution shift (new language/domain) makes the partition a bad fit, scattering related vectors across boundary clusters that nprobe misses. Retraining on representative data is the fix — pgvector docs warn to build after loading representative data for exactly this reason. (A) — IVF is language-agnostic; it sees only vectors. (C) describes a hybrid pipeline component that does not exist here. (D) — the metric does not interact with cluster fit.'
    },
    {
      text: 'You have 200M × 1024-dim float32 embeddings and one 64GB-RAM server. Which TWO techniques, combined, most directly make this servable with good recall?',
      options: [
        'Binary quantization of the in-RAM index (~25GB for the fast pass)',
        'Rescoring the top-200 candidates with full-precision vectors kept on NVMe',
        'Raising efConstruction to 800',
        'Sharding the corpus across 200 Postgres schemas',
        'Switching from cosine to dot product to halve compute'
      ],
      answer: [0, 1],
      multi: true,
      explanation: '800GB of raw vectors cannot live in 64GB — binary quantization (32×) fits a fast approximate pass in RAM, and two-stage rescoring against full-precision vectors on disk claws back the recall the compression cost. That pairing is the standard architecture. (C) improves graph quality but does nothing about the 800GB memory wall. (D) reshuffles the same too-big data without shrinking it, and 200 schemas on one box still need the vectors in memory to be fast. (E) — on normalized vectors they are the same computation; there is no 2× to win.'
    },
    {
      text: 'Users searching exact error codes like "ORA-01555" get topically-related but wrong documents from your dense-only retrieval. Which change most directly fixes this class of query?',
      options: [
        'Upgrade to a larger embedding model with more dimensions',
        'Add a BM25 leg and fuse with RRF — lexical search handles rare exact tokens that embeddings compress away',
        'Increase k from 5 to 25 so the right document sneaks in',
        'Lower the HNSW efSearch to make matching stricter'
      ],
      answer: [1],
      explanation: 'Rare identifiers get shredded by the tokenizer and carry almost no weight in a semantic vector, so no dense model reliably retrieves them — while BM25\'s IDF weighting makes rare exact tokens its strongest case; hybrid + RRF is the canonical fix. (A) bigger embeddings still compress surface forms — this is architectural, not a capacity issue. (C) may occasionally luck out while flooding the context with noise, and fails when the exact-match doc is not in the dense top-100 at all. (D) misunderstands efSearch: it controls exploration breadth, not match strictness, and lowering it reduces recall.'
    },
    {
      text: 'Why does RRF fuse the BM25 and dense result lists by rank rather than by combining their raw scores?',
      options: [
        'Ranks are faster to compute than scores',
        'BM25 and cosine scores live on incomparable, corpus- and model-dependent scales; rank is the only shared currency, so rank fusion is robust without per-corpus weight tuning',
        'Raw score fusion is mathematically impossible',
        'RRF was designed for GPU efficiency'
      ],
      answer: [1],
      explanation: 'BM25 scores are unbounded and corpus-dependent; cosine distributions vary per embedding model — any raw-score mix needs normalization plus weights that must be re-tuned per corpus and re-broken by every model change. RRF sidesteps all of it with 1/(k+rank) and one insensitive constant. (A) — you must fully score and sort both lists anyway to get ranks; nothing is saved. (C) — weighted score fusion exists and can win slightly, at permanent tuning cost. (D) is invented; RRF predates the GPU retrieval era entirely (2009).'
    },
    {
      text: 'You bought a hosted reranker, feed it your dense top-10, and keep the top 3 for the prompt. Quality did not improve and sometimes got worse. What is the most likely explanation?',
      options: [
        'The reranker model is weaker than your embedding model',
        'Reranking needs a wide candidate pool (top-50–100) to promote from; over 10 near-identical candidates it can only shuffle, and shuffling can demote your previous best chunk out of the top 3',
        'Rerankers only work with BM25 candidates, not dense ones',
        'The reranker scores must be renormalized against cosine scores first'
      ],
      answer: [1],
      explanation: 'The value of a cross-encoder is promoting relevant documents that the first stage ranked 20th–80th; given only 10 candidates there is nothing to promote, and its (better, but different) ordering can push the previously-top chunk below your keep-3 cutoff — a strict quality loss. (A) is conceivable but far less likely than the classic pool-too-small misconfiguration. (C) — rerankers are source-agnostic; they score (query, text) pairs. (D) — reranker scores replace first-stage ordering; no cross-normalization is involved.'
    },
    {
      text: 'A 512-max-token open-source embedding model is used to embed 3,000-token chunks. What actually happens, and what is the symptom?',
      options: [
        'The model errors out and the pipeline halts',
        'Everything past token 512 is silently truncated — vectors represent only chunk openings, so content deep in chunks becomes unretrievable with no error anywhere',
        'The model automatically averages multiple windows over the full chunk',
        'Retrieval is unaffected because meaning is concentrated in the first paragraph'
      ],
      answer: [1],
      explanation: 'Tokenizer truncation is silent by default in most serving stacks: the vector faithfully represents the first 512 tokens and knows nothing about the rest, so anything discussed deep in a chunk simply cannot be found. No exception fires — the classic invisible failure. (A) would actually be preferable — loud failures get fixed. (C) — some frameworks can window-and-pool but only if you configure it; it is not default behavior. (D) is wishful; real documents bury critical facts mid-section constantly.'
    },
    {
      text: 'Your top-5 retrieved chunks routinely include two or three overlap-twins — near-identical text from adjacent sliding-window chunks. What are the TWO most sensible responses?',
      options: [
        'Dedupe candidates by document+position at query time before filling the top-k',
        'Move to structure-aware chunking so overlap insurance (and the twins it creates) is needed less',
        'Increase overlap to 50% so at least the duplicates are complete',
        'Disable the ANN index and use brute force, which does not return duplicates',
        'Raise the similarity threshold until duplicates fall below it'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'Twins waste top-k slots — retrieving 5 with 3 twins means ~3 distinct pieces of evidence. Query-time dedupe by provenance is the immediate fix; structural chunking attacks the cause, since chunks aligned to real section boundaries need far less overlap. (C) makes the duplication strictly worse. (D) — duplicates come from the chunk inventory, not the index type; brute force returns the same twins. (E) — twins have nearly identical scores; any threshold keeps or kills them together while also discarding legitimate results.'
    },
    {
      text: 'A multi-tenant app applies tenant_id filters to ANN queries. Small tenants (0.5% of the corpus) see terrible recall and occasional empty results despite relevant docs existing. What is going on?',
      options: [
        'Small tenants\' documents were never embedded',
        'Selective filters gut the HNSW graph traversal (post-filtering returns few/zero survivors from top-k; filtered walks hit dead ends) — partition per tenant or use a store with filter-aware indexing / exact-scan fallback',
        'The tenant_id column needs a B-tree index',
        'Cosine similarity is undefined on filtered subsets'
      ],
      answer: [1],
      explanation: 'This is the classic filtering × ANN interplay: post-filtering a top-50 where only 0.5% match yields ~0 results, and filter-during-traversal degrades badly at low selectivity because the graph walk keeps hitting excluded nodes. High-cardinality mandatory filters like tenant deserve partitioning/namespaces, or engines that build filter-aware links and fall back to exact scan below a cardinality threshold. (A) is possible but would show as total absence, not degraded recall. (C) speeds up the relational filter, not the ANN interaction. (D) is nonsense — similarity is defined pairwise regardless of subsets.'
    },
    {
      text: 'You have 2M vectors, ~20 QPS, filters that are natural SQL WHERE clauses, and an ops team that already runs Postgres well. A vendor pitches a dedicated managed vector DB. What is the sound default?',
      options: [
        'Take the dedicated DB — Postgres cannot do vector search at this scale',
        'pgvector in your existing Postgres: this scale and QPS is comfortably within range, and you keep transactions, ACLs, joins, backups, and an ops model you already run well',
        'Elasticsearch, because hybrid search always requires it',
        'Build a custom FAISS service for maximum performance'
      ],
      answer: [1],
      explanation: '2M vectors at 20 QPS with SQL-shaped filters is squarely pgvector territory (HNSW handles this on modest hardware), and the operational argument dominates: the database you already operate well beats the theoretically better one you operate badly. (A) is vendor fiction at this scale — pgvector serves far larger deployments. (C) — pgvector does hybrid via tsvector/pg_search; Elastic is the right call when you already run ELK or need heavy text-search features. (D) buys you an unmanaged stateful service to babysit for performance you do not need.'
    },
    {
      text: 'Mid-way through an embedding model upgrade, queries start returning near-random results for most of the corpus, with zero errors logged. The likely operational mistake?',
      options: [
        'The new model has a different maximum input length',
        'Ingest/query switched to the new model before the backfill completed, so new-model query vectors are being scored against a corpus of mostly old-model vectors — incompatible spaces, silently',
        'The HNSW index needed a higher efConstruction for the new vectors',
        'The new embeddings require euclidean distance'
      ],
      answer: [1],
      explanation: 'Vectors from different models are mutually meaningless; if dimensions match, nothing errors — cross-model comparisons just return noise. The half-migrated index is the canonical vector-search outage, prevented by blue-green indexes, dual-write, and write-time model-version checks that reject mismatched vectors loudly. (A) would cause truncation quality issues, not corpus-wide randomness. (C) affects recall marginally, never randomness. (D) — metric choice does not repair cross-space comparisons; they are unfixable by any metric.'
    },
    {
      text: 'Product wants "only show results the system is confident about" using a fixed cosine cutoff of 0.7 across your three embedding-model-backed indexes. Your best counsel?',
      options: [
        'Fine — 0.7 is the industry-standard relevance threshold',
        'Cosine distributions are model- and corpus-specific (anisotropy, different scales), so one fixed number will over-filter some indexes and under-filter others; use per-model tuned thresholds, or better, a calibrated reranker score for the confidence gate',
        'Use euclidean distance instead, which has an absolute scale',
        'Confidence gating is impossible in vector search'
      ],
      answer: [1],
      explanation: 'There is no universal cosine threshold: anisotropic models cluster unrelated pairs at 0.6+, while text-embedding-3-family scores sit lower — 0.7 would filter almost everything on one index and almost nothing on another. Per-model thresholds tuned on labeled pairs work; cross-encoder reranker scores are better calibrated and make cleaner gates. (A) — that "standard" is folklore. (C) — L2 on normalized vectors is a transform of cosine; same problem, different numbers. (D) too strong — gating is possible, just not with one magic constant.'
    },
    {
      text: 'Your nightly pipeline re-upserts every document (changed or not) into an HNSW-based store. Over months, recall decays and p99 latency creeps up without any code change. Mechanism?',
      options: [
        'Vector values drift slightly with each re-embedding due to floating point noise',
        'Deletes/updates tombstone graph nodes rather than removing them; a high churned fraction degrades routing and recall until a rebuild or compaction — so upsert only on content-hash change and monitor deleted-fraction',
        'HNSW indexes expire after a fixed number of queries',
        'The embedding API silently switched model versions'
      ],
      answer: [1],
      explanation: 'HNSW cannot cheaply remove nodes without tearing routing paths, so implementations tombstone; a nightly full re-upsert marks nearly the whole graph deleted-and-reinserted repeatedly, accumulating dead weight that the traversal still walks through. Fix the pipeline (hash-gated upserts) and schedule rebuilds/compaction. (A) — identical text re-embedded by the same pinned model returns identical vectors; and noise would not degrade the graph anyway. (C) is invented. (D) would break retrieval abruptly and semantically, not as gradual index-health decay.'
    }
  ],
  flashcards: [
    { id: 'fc-metric-equiv', front: 'When do cosine, dot product, and euclidean give identical rankings?', back: 'On <b>unit-normalized vectors</b>: cosine = dot, and L2² = 2 − 2·cos (monotonic). Most embedding APIs pre-normalize, making the metric choice a performance detail, not a quality lever.' },
    { id: 'fc-dot-magnitude', front: 'When is unnormalized dot product the deliberately correct metric?', back: 'When magnitude carries signal — e.g. recommendation embeddings where vector length encodes popularity. For text retrieval with modern APIs: normalize and stop worrying.' },
    { id: 'fc-threshold', front: 'Why can\'t you reuse a cosine similarity threshold across embedding models?', back: 'Score distributions are model-specific (anisotropy: some models score unrelated pairs 0.6+). A 0.7 cutoff over-filters one model and under-filters another. Thresholds are model-coupled config — version them together.' },
    { id: 'fc-hnsw-shape', front: 'HNSW in one sentence?', back: 'A <b>skip list made of graphs</b>: sparse upper layers for coarse greedy navigation, dense layer 0 (up to 2·M links/node) searched with an ef-wide beam for the final candidates.' },
    { id: 'fc-hnsw-params', front: 'HNSW: which parameters are build-time vs query-time?', back: '<b>Build:</b> M (fanout, RAM) and efConstruction (graph quality). <b>Query:</b> efSearch — the per-query recall-vs-latency dial. Tune efSearch first; it needs no rebuild.' },
    { id: 'fc-hnsw-deletes', front: 'Why do heavy updates degrade an HNSW index?', back: 'Deletes are <b>tombstones</b> — nodes stay in the graph and get filtered from results. High churned fraction degrades recall and latency until rebuild/compaction. Upsert only on content change; monitor deleted-fraction.' },
    { id: 'fc-ivf', front: 'IVF index: how it works and its sharp edge?', back: 'K-means the corpus into nlist clusters; search probes the nprobe closest lists. Sharp edge: centroids snapshot the training-time distribution — <b>data drift silently degrades recall</b> until you retrain and rebuild.' },
    { id: 'fc-quant-ladder', front: 'The quantization ladder and typical compression?', back: 'int8 scalar = 4× (~free, on by default in ES/Qdrant); PQ = 16–64× (lossy, first-pass only); binary = 32× (Hamming distance, needs high-dim well-spread embeddings). Pair aggressive compression with full-precision rescoring.' },
    { id: 'fc-two-stage-rescore', front: 'What makes aggressive quantization safe?', back: '<b>Two-stage search:</b> compressed index returns top-100–200 candidates; exact distances recomputed from full-precision vectors (RAM or NVMe); return top-k. Most of the memory win, almost none of the recall loss.' },
    { id: 'fc-brute-force', front: 'Below what scale should you skip ANN indexes entirely?', back: 'Roughly <b>&lt;100k vectors</b>: SIMD brute force is milliseconds, 100% recall, zero index maintenance. Deploying HNSW to search 20k documents is premature optimization.' },
    { id: 'fc-chunk-size', front: 'Default chunking recipe that is boringly reliable (early 2026)?', back: 'Structure-aware splitting on headings, <b>300–500 token target</b>, ~10–20% overlap as fallback insurance, tables/code kept intact, heading path prepended to chunk text before embedding.' },
    { id: 'fc-chunk-tradeoff', front: 'Small chunks vs large chunks — the core trade?', back: 'Small (100–300 tok): sharp vectors, high precision, but fragments lose antecedents. Large (800+): self-contained but vectors blur across topics and eat generation context budget. The chunk is what gets embedded AND what gets prompted.' },
    { id: 'fc-contextual', front: 'What is contextual enrichment of chunks?', back: 'An LLM writes 1–2 sentences situating each chunk in its document, prepended before embedding. Anthropic reported ~35–49% fewer retrieval failures combined with hybrid search. Ingest-time cost, query-time payoff.' },
    { id: 'fc-hybrid-why', front: 'Why is hybrid BM25+dense the production default?', back: 'Complementary failure profiles: embeddings handle paraphrase but compress away exact identifiers (error codes, part numbers); BM25\'s IDF loves rare exact tokens but is blind to synonyms. Fuse with RRF.' },
    { id: 'fc-rrf', front: 'RRF formula and why rank-based?', back: '<code>score(d) = Σ 1/(k + rank)</code> with k=60. BM25 and cosine scores live on incomparable scales; rank is the shared currency — zero training, one insensitive parameter, ships everywhere.' },
    { id: 'fc-bi-vs-cross', front: 'Bi-encoder vs cross-encoder?', back: 'Bi-encoder: query and doc embedded separately, meet at a dot product — fast, pre-computable, coarser. Cross-encoder: joint forward pass per (query, doc) pair — far more accurate, expensive, only viable as a second-stage rescorer of top-50–100.' },
    { id: 'fc-rerank-econ', front: 'When does a reranker pay for itself?', back: 'When precision@5 over a plausible top-50 is the bottleneck and you can afford ~100–400ms and ~$1–2/1k queries (hosted, early 2026). It cannot fix recall — candidates never retrieved cannot be promoted. Fix chunking/hybrid first.' },
    { id: 'fc-filter-ann', front: 'Why do selective metadata filters break ANN search?', back: 'Post-filtering empties the top-k; filter-during-traversal hits dead ends when few nodes qualify. Fixes: partition/namespace per high-cardinality key (tenant), filter-aware indexes, exact-scan fallback below a cardinality threshold.' },
    { id: 'fc-reembed-migration', front: 'The safe re-embedding migration recipe?', back: 'Blue-green: build new index alongside old (full re-embed), dual-write during cutover, eval both with the retrieval golden set, flip an alias, keep old index a week for rollback. Reject write-time vectors with a mismatched model tag.' },
    { id: 'fc-vector-mem-math', front: 'Memory math: 10M × 1536-dim float32?', back: '10M × 1536 × 4B ≈ <b>61GB</b> raw (+~3GB HNSW graph at M=16). Levers: Matryoshka truncation, int8 (÷4), binary (÷32) with rescoring, or disk-resident indexes (DiskANN/LanceDB-style).' }
  ],
  lab: {
    title: 'Build the whole retrieval stack small: brute force → HNSW → hybrid → rerank',
    intro: '<p>You will embed a small corpus with a real API, measure ANN recall against a brute-force ground truth while sweeping efSearch, watch dense retrieval whiff on an exact identifier, fix it with BM25+RRF, and finish with a local cross-encoder rerank. Everything runs on your laptop; the only API spend is embeddings.</p><p><b>Needs:</b> <code>python3</code>, an OpenAI-compatible API key (or Ollama with <code>nomic-embed-text</code> for $0), ~10 minutes.</p>',
    steps: [
      {
        title: 'Embed a corpus and verify the normalization story',
        html: '<pre><code>pip install openai hnswlib rank-bm25 numpy sentence-transformers\n\npython3 - &lt;&lt;\'EOF\'\nimport json, numpy as np\nfrom openai import OpenAI\nclient = OpenAI()  # or OpenAI(base_url="http://localhost:11434/v1", api_key="x") + model="nomic-embed-text"\n\ndocs = [\n  "To rotate an API key, open Console > Security, revoke the old key, then issue a new one.",\n  "Error ORA-01555 (snapshot too old) occurs when undo data is overwritten during a long query.",\n  "Kubernetes evicts pods under memory pressure; the container status shows OOMKilled.",\n  "Our SLA guarantees 99.9% uptime measured monthly, excluding scheduled maintenance windows.",\n  "Postgres autovacuum prevents transaction ID wraparound by freezing old tuples.",\n  "The billing exporter retries failed webhook deliveries with exponential backoff up to 24h.",\n] * 50  # pad the corpus so ANN has something to chew on\ndocs = [d + f" (variant {i})" for i, d in enumerate(docs)]\n\nresp = client.embeddings.create(model="text-embedding-3-small", input=docs)\nX = np.array([e.embedding for e in resp.data], dtype=np.float32)\nprint("shape:", X.shape)\nprint("norms (should all be ~1.0):", np.linalg.norm(X, axis=1)[:5])\nnp.save("vecs.npy", X); json.dump(docs, open("docs.json", "w"))\nEOF</code></pre>' +
          '<p>Confirm the norms print as 1.0 — this is why cosine and dot product are interchangeable here. If you self-host a model later and skip normalization, everything in step 3 silently changes ranking behavior.</p>'
      },
      {
        title: 'Brute force vs HNSW: measure the recall curve yourself',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json, numpy as np, hnswlib\nX = np.load("vecs.npy"); docs = json.load(open("docs.json"))\nn, dim = X.shape\n\n# ground truth: exact top-10 by dot product (vectors are normalized)\nq = X[0]  # use a doc as a stand-in query\ntruth = set(np.argsort(-(X @ q))[:10])\n\nidx = hnswlib.Index(space="ip", dim=dim)\nidx.init_index(max_elements=n, M=16, ef_construction=200)\nidx.add_items(X, np.arange(n))\n\nfor ef in [10, 20, 50, 100, 200]:\n    idx.set_ef(ef)\n    labels, _ = idx.knn_query(q, k=10)\n    recall = len(truth &amp; set(labels[0])) / 10\n    print(f"efSearch={ef:4d}  recall@10={recall:.2f}")\nEOF</code></pre>' +
          '<p>You just reproduced the recall-vs-ef curve from the lesson on your own data. On a corpus this small the curve saturates almost immediately — which is itself the lesson: at 300 vectors, brute force was already the right answer. Re-run with 100k random vectors to see the curve become interesting.</p>'
      },
      {
        title: 'Watch dense retrieval whiff on an error code, then fix it with hybrid + RRF',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json, numpy as np\nfrom rank_bm25 import BM25Okapi\nfrom openai import OpenAI\nclient = OpenAI()\nX = np.load("vecs.npy"); docs = json.load(open("docs.json"))\n\nquery = "ORA-01555"\nqv = np.array(client.embeddings.create(model="text-embedding-3-small", input=[query]).data[0].embedding)\ndense_rank = list(np.argsort(-(X @ qv)))\n\nbm25 = BM25Okapi([d.lower().split() for d in docs])\nsparse_rank = list(np.argsort(-bm25.get_scores(query.lower().split())))\n\ndef rrf(*lists, k=60):\n    s = {}\n    for lst in lists:\n        for r, doc_id in enumerate(lst[:50]):\n            s[doc_id] = s.get(doc_id, 0) + 1.0 / (k + r + 1)\n    return sorted(s, key=s.get, reverse=True)\n\nprint("dense top-3 :", [docs[i][:60] for i in dense_rank[:3]])\nprint("bm25  top-3 :", [docs[i][:60] for i in sparse_rank[:3]])\nprint("rrf   top-3 :", [docs[i][:60] for i in rrf(dense_rank, sparse_rank)[:3]])\nEOF</code></pre>' +
          '<p>Try queries at both ends: "ORA-01555" (BM25 should carry it) and "container killed for using too much memory" (dense should carry it — the OOMKilled doc shares no keywords). RRF should be sane on both. That two-sided robustness is the whole argument for hybrid.</p>'
      },
      {
        title: 'Add a local cross-encoder rerank and compare orderings',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json, numpy as np\nfrom sentence_transformers import CrossEncoder\ndocs = json.load(open("docs.json"))\nce = CrossEncoder("cross-encoder/ms-marco-MiniLM-L6-v2")  # ~90MB download, CPU-fine\n\nquery = "how do I replace a compromised credential"\ncandidates = docs[:50]  # in real life: your hybrid top-50\nscores = ce.predict([(query, d) for d in candidates])\nfor i in np.argsort(-scores)[:3]:\n    print(f"{scores[i]:6.2f}  {candidates[i][:70]}")\nEOF</code></pre>' +
          '<p>Note two things: the reranker surfaces the API-key-rotation doc for a query that shares no vocabulary with it, and its scores are on a far more interpretable scale than cosine — this is why confidence gates belong here, not on raw similarity. Time the call too: ~50 pairs on CPU takes a second or two, which is exactly the latency budget conversation from the lesson.</p>'
      }
    ],
    costNote: 'Worst-case spend: ~300 short docs + a few queries through text-embedding-3-small ($0.02/Mtok) is well under $0.01 — call it $0.05 if you rerun everything ten times. Ollama (<code>ollama pull nomic-embed-text</code>) makes it $0. Cleanup: <code>rm vecs.npy docs.json</code> — no cloud resources are created.'
  }
});
