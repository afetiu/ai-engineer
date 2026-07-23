COURSE.register({
  id: 'm17-multimodal',
  track: 'advanced',
  order: 17,
  title: 'Multimodal',
  short: 'Multimodal',
  tagline: 'Images, documents, audio, and generated pixels — how each becomes tokens, what it costs, and where vision models quietly lie to you.',
  minutes: 115,
  lessons: [
    {
      id: 'vision-tokens',
      title: 'Vision inputs: how an image becomes tokens',
      blurb: 'Patches, tiles, and resolution math — plus the failure modes the demo never shows you.',
      html: '<h2>The pipeline: pixels → patches → soft tokens</h2>' +
        '<p>A vision-language model (VLM) does not "see" an image the way a CNN classifier did. The dominant recipe, as of early 2026, is: a <b>vision encoder</b> (a ViT — vision transformer) slices the image into fixed-size <b>patches</b> (typically 14×14 or 16×16 pixels), embeds each patch as a vector, runs transformer layers over the patch sequence, then a small <b>projection layer</b> maps those vectors into the same embedding space as text tokens. The result is a run of "soft tokens" spliced into the token sequence right where your image appeared in the message. From that point on, the LLM treats them exactly like text: attention over one flat sequence.</p>' +
        '<p>Two consequences fall straight out of this. First, <b>images consume context window</b> — a handful of screenshots can eat more tokens than the entire text of your prompt. Second, everything you know about the token stream applies: image content is in-band, attention over it is finite, and text inside an image is just as capable of prompt-injecting your agent as text in a retrieved web page (module 13 — this is not hypothetical; injection-via-screenshot is a working attack).</p>' +
        '<h2>Tiling and the resolution math</h2>' +
        '<p>A ViT at fixed patch size can only ingest a fixed resolution, so providers handle large images with <b>tiling</b>: downscale the image for a low-res global view, then cut the full-res image into tiles (commonly 512×512 or 768×768) and encode each tile separately. Token cost is therefore a step function of resolution, and each provider has its own math. Representative numbers as of early 2026:</p>' +
        '<table><tr><th>Provider style</th><th>Accounting</th><th>1024×1024 example</th></tr>' +
        '<tr><td>OpenAI-style tiling</td><td>Base image ~85 tok + ~170 tok per 512px tile (high detail)</td><td>~765 tokens</td></tr>' +
        '<tr><td>Anthropic-style area</td><td>≈ (width × height) / 750, capped ~1,600 tok; images over ~1568px long edge get downscaled</td><td>~1,400 tokens</td></tr>' +
        '<tr><td>Gemini-style flat/tile</td><td>258 tok per image up to 384px, else 258 per 768×768 tile</td><td>~1,032 tokens</td></tr></table>' +
        '<p>Run the math before you ship: an agent taking one 1080p screenshot per step, 30 steps per session, is ~35k–50k image tokens per session <em>before any text</em>. At $3/Mtok input that is ~$0.10–0.15 a session in screenshots alone — fine for a $2 task, ruinous for a free-tier feature.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Downscaling is the silent killer. Providers resize images above their limits before encoding. A 3000px-wide dashboard screenshot gets squeezed until 9px-tall axis labels become smears — the model then <em>guesses</em> the numbers, fluently. If small text matters, crop and send regions at native resolution instead of sending the whole thing once. Two 800px crops beat one 3000px original, and often cost less.</div>' +
        '<h2>What VLMs are good and bad at</h2>' +
        '<p>Frontier VLMs, as of early 2026, are genuinely strong at: <b>OCR of clean printed text</b> (near-parity with dedicated OCR on high-contrast scans), <b>chart and table reading</b> at moderate density, <b>UI understanding</b> (naming buttons, describing state — the substrate of computer-use agents), and <b>open-ended description</b>. They remain measurably weak at:</p>' +
        '<ul>' +
        '<li><b>Counting.</b> Ask for the number of objects past ~5–10 and accuracy collapses. Patch-based encoding has no serial enumeration mechanism — the model estimates from global features and answers in a confident register. Never build inventory counting, crowd counting, or "how many rows" features on raw VLM output.</li>' +
        '<li><b>Precise spatial reasoning.</b> "Exact pixel coordinates of the button," left/right confusions in cluttered scenes, relative depth. Grounded bounding-box output exists in some models but treat coordinates as approximate; computer-use stacks that click reliably use set-of-marks overlays or accessibility trees, not raw coordinate guesses.</li>' +
        '<li><b>Small, dense, or handwritten text</b> — degrades hard with resolution, style, and low contrast.</li>' +
        '<li><b>Negative claims.</b> "Confirm no error dialog is present" invites agreement bias; the model was trained to describe what is there, not certify absences.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A retail team shipped shelf-audit tooling that asked a VLM "how many facings of product X are visible?" The demo (4 facings) worked; stores with 15+ facings got answers between 8 and 20, different on each retry. The fix was an object detector for counting with the VLM used only for classification of the crops — right tool per subtask. VLMs are judgment layers, not measurement instruments.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How does an LLM process an image, and what does that predict about failure modes?" Strong answer: ViT patches → projected soft tokens in the same stream; predicts context cost, injection-via-image, counting and fine-spatial weaknesses, and resolution-driven OCR failure. Weak answer treats the model as a magic eye.</div>'
    },
    {
      id: 'document-understanding',
      title: 'Document understanding: PDFs, tables, and layout',
      blurb: 'Native text vs OCR vs vision parsing — a decision tree, not a religion.',
      html: '<h2>Three ways to read a PDF</h2>' +
        '<p>PDF is a page-description format, not a text format — it records "place these glyphs at these coordinates," and everything you want (reading order, tables, headings) must be reconstructed. There are exactly three extraction strategies, and mature pipelines use all three, routed per document:</p>' +
        '<table><tr><th>Strategy</th><th>Works when</th><th>Cost/page (early 2026)</th><th>Fails when</th></tr>' +
        '<tr><td><b>Native text extraction</b> (PyMuPDF, pdfplumber, pdfminer)</td><td>Born-digital PDFs with a real text layer</td><td>~$0 (CPU)</td><td>Scans, weird encodings, multi-column reading order, tables flatten to word soup</td></tr>' +
        '<tr><td><b>OCR</b> (Tesseract free; cloud OCR ~$1.50/1k pages; layout-aware document AI ~$10–65/1k pages)</td><td>Scans and images of documents</td><td>$0.0015–0.065</td><td>Handwriting, low-quality faxes, complex tables — and it strips layout semantics unless you pay for layout models</td></tr>' +
        '<tr><td><b>Vision-model parsing</b> (render page → image → VLM transcribes to markdown/JSON)</td><td>Complex layout, tables, mixed scan quality, forms, when you want structure + judgment in one step</td><td>~$0.003–0.03 per page depending on model and resolution</td><td>Hallucinated cell values, dropped rows on dense pages, 10–100× the cost of native extraction</td></tr></table>' +
        '<p>The routing heuristic that survives contact with production: <b>try the cheap thing, detect failure, escalate.</b> Extract native text first; if the text layer is empty or garbage (heuristics: chars/page &lt; 100, high replacement-char ratio), OCR it; route pages that OCR flags as table-heavy or low-confidence to a vision model. Most corpora are 80–95% born-digital, so the expensive path handles a sliver.</p>' +
        '<h2>Tables and layout: where pipelines go to die</h2>' +
        '<p>Tables are the single biggest source of silent corruption in document pipelines. Native extraction returns table text in <em>drawing order</em>, which may be column-major, interleaved, or reversed. A financial table extracted as a flat word stream can put a number under the wrong header with no error anywhere — and your RAG system will then confidently cite the wrong figure with a real-looking source.</p>' +
        '<ul>' +
        '<li><b>Reading order:</b> two-column academic layouts and sidebar-heavy reports scramble naive extractors. Layout-aware tools (Docling, Marker, unstructured, cloud document AI) infer blocks and order them; test on <em>your</em> documents because they all fail differently.</li>' +
        '<li><b>Table strategy:</b> convert tables to markdown or HTML, keep them as intact chunks (do not split a table across chunks — module 6), and store the page number + a rendered image of the table so generation can be checked against the source.</li>' +
        '<li><b>Merged cells and multi-row headers</b> defeat almost everything except vision parsing with an explicit instruction to emit HTML with rowspan/colspan.</li>' +
        '<li><b>Checkboxes, signatures, stamps, redactions</b> are invisible to text extraction entirely — if your compliance flow cares whether a box was ticked, you need vision on that page, full stop.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Vision parsing of documents works so well partly because a rendered page carries information text extraction destroys: font size implies heading level, indentation implies hierarchy, proximity implies association. That is also why VLM transcription errors are <em>plausible</em> — the model reconstructs what the table probably said. Dedicated OCR makes character-level errors (1→l, 0→O) you can catch with checksums and regexes; VLM errors are semantically coherent wrong numbers, which is a scarier failure class for financial data. For numeric-critical extraction, run OCR and VLM in parallel and reconcile disagreements.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> An insurance team benchmarked their extraction pipeline on 50 hand-picked claim forms and hit 98%. In production they met the long tail: rotated scans, faxed-twice artifacts, coffee stains, a 1997 form revision nobody remembered. Accuracy on the real stream was 81%. Document pipelines are distribution problems — sample your eval set from the live stream, stratified by source and decade, not from whatever is on someone\'s desktop.</div>' +
        '<h2>When to just use vision for everything</h2>' +
        '<p>The counter-position is gaining ground as VLM prices fall: render every page at ~150 DPI, send it to a cheap vision model, get markdown out, and delete half your pipeline. As of early 2026 that costs roughly $3–30 per thousand pages depending on model tier — for many corpora that is cheaper than the engineering time spent maintaining a five-stage extraction stack. It is the right call when: corpus is small-to-medium (&lt; a few million pages), layouts are heterogeneous, and you can spot-check outputs. It is the wrong call for high-volume ingestion (billions of pages), strict numeric fidelity, or latency-critical paths. Decide with arithmetic, not aesthetics: (pages × cost/page) vs (engineer-weeks × loaded cost + error-handling forever).</p>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Design ingestion for 10M mixed PDFs" is a common system-design prompt. Strong answers route by document type with escalation, treat tables as first-class citizens, keep page images for verification, and cite per-page costs. Answering "run it all through GPT-4-class vision" without doing the ($$ × 10M) multiplication is an instant level-down.</div>'
    },
    {
      id: 'audio-voice',
      title: 'Audio and voice: STT, TTS, and the 500 ms bar',
      blurb: 'The voice-agent latency budget, line by line — and why barge-in is table stakes.',
      html: '<h2>The landscape: three ways to build voice</h2>' +
        '<p>As of early 2026 there are three architectures for voice AI, and the choice is a latency/control trade-off:</p>' +
        '<ol>' +
        '<li><b>Cascaded pipeline:</b> streaming STT (speech-to-text) → LLM → streaming TTS. Maximum control — you see the transcript, can run guardrails, tools, RAG on text. Latency stacks: each stage adds delay.</li>' +
        '<li><b>Speech-to-speech (realtime) models:</b> one model consumes audio tokens and emits audio tokens over a WebSocket/WebRTC session (OpenAI Realtime, Gemini Live, and peers). Lowest latency, natural prosody, native barge-in — but you lose the clean text checkpoint: moderation, logging, and tool-injection points all get harder, and per-minute cost is high (~$0.06–0.30/min blended audio in+out on frontier tiers as of early 2026).</li>' +
        '<li><b>Hybrid:</b> speech-to-speech for chit-chat latency, with async text-side tool calls and guardrails riding along. Where most serious deployments are landing.</li>' +
        '</ol>' +
        '<p>Component realities: STT runs $0.004–0.01/min (Whisper-family, Deepgram, AssemblyAI) with word error rates of 5–10% on clean English and 2–4× worse on accents, crosstalk, and telephony audio (8 kHz μ-law is brutal); domain terms — drug names, SKUs, proper names — need custom vocabulary boosting or they transcribe as nonsense. TTS runs ~$10–30 per million characters for good streaming voices, with premium expressive tiers well above that.</p>' +
        '<h2>The latency budget: engineering to ~500 ms</h2>' +
        '<p>Human conversational turn-taking has a gap of roughly 200–300 ms; anything past ~800 ms reads as awkward, and past ~1.5 s users start talking over the bot. The working bar for "feels conversational" is <b>~500 ms voice-to-first-audio</b>. Budget it like an SLO, because every line item fights you:</p>' +
        '<table><tr><th>Stage</th><th>Typical (early 2026)</th><th>Notes</th></tr>' +
        '<tr><td>Endpointing (detecting the user finished)</td><td>150–400 ms</td><td>The hidden tax — VAD must wait to distinguish a pause from a finish; semantic endpointing models cut this</td></tr>' +
        '<tr><td>Streaming STT final</td><td>50–200 ms</td><td>Stream partials; do not wait for the full utterance</td></tr>' +
        '<tr><td>LLM TTFT</td><td>200–800 ms</td><td>Small/fast models or speculative "acknowledgment" first tokens</td></tr>' +
        '<tr><td>TTS first audio chunk</td><td>75–300 ms</td><td>Streaming TTS, sentence-by-sentence synthesis</td></tr>' +
        '<tr><td>Network (×3 hops) + audio buffering</td><td>50–200 ms</td><td>Co-locate; WebRTC over WebSockets for the client leg</td></tr></table>' +
        '<p>Naively summed, a cascade lands at 800–1500 ms. Getting under 600 requires overlapping stages: start LLM inference on STT partials (accepting occasional restarts when the final transcript differs), start TTS on the first complete clause rather than the full response, and co-locate STT/LLM/TTS in one region. Speech-to-speech models collapse the middle and reliably hit 300–600 ms — that is their entire value proposition.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Voice latency is a pipeline-overlap problem, not a model-speed problem. The winning systems never wait for any stage to fully finish before starting the next. Treat "time from user stops talking to first audio out" as your one metric; measure it P50 <em>and</em> P95, because tool calls blow up the tail.</div>' +
        '<h2>Barge-in, tool calls, and other hard parts</h2>' +
        '<ul>' +
        '<li><b>Barge-in</b> (user interrupts while the bot is speaking) is table stakes — without it, users hate the product within three turns. Requirements: full-duplex audio, echo cancellation so the bot does not hear itself, instant TTS stop, and — the part everyone forgets — <b>truncating the conversation history</b> to what was actually spoken before the interrupt, or the model believes it said things the user never heard.</li>' +
        '<li><b>Tool calls stall the voice.</b> A 3-second database lookup is an eternity of dead air. Pattern: emit a spoken filler ("let me check that…") <em>before</em> starting the tool call, and design tools for &lt;2 s P95 or make them async with a spoken callback.</li>' +
        '<li><b>Numbers, addresses, spellings</b> — STT mangles them and TTS mispronounces them. Confirmation loops ("that is 4-1-5-5-5-5-0-1-2-3, correct?") are not optional for anything transactional.</li>' +
        '<li><b>Phone channel:</b> 8 kHz audio degrades STT ~2×, and telephony adds 100–300 ms latency you do not control. Budget for it separately from web voice.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A voice-support pilot benchmarked beautifully in the office and collapsed in the field: real callers on speakerphone in cars, with TVs in the background. Endpointing fired mid-sentence (splitting utterances), STT WER doubled, and the LLM answered half-questions confidently. The team added noise-robust VAD, longer adaptive endpointing under low STT confidence, and an explicit "sorry, could you repeat that?" path triggered by confidence scores — accuracy recovered more from those three unglamorous fixes than from any model upgrade.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Walk me through the latency budget of a voice agent" is now a standard senior screen. Name endpointing explicitly — candidates who only count STT+LLM+TTS miss the largest and least obvious line item — and know why barge-in requires history truncation.</div>'
    },
    {
      id: 'image-generation',
      title: 'Image generation for engineers',
      blurb: 'Diffusion vs autoregressive in one lesson, plus pipelines, safety, and watermarking.',
      html: '<h2>Two generation paradigms</h2>' +
        '<p><b>Diffusion models</b> generate by iterative denoising: start from pure noise in a compressed latent space, run a learned denoiser 20–50 steps, each step conditioned on your prompt via cross-attention to a text encoding, then decode the latent to pixels. Strengths: photorealism, texture, style range, a massive open ecosystem (Stable Diffusion/FLUX lineages, LoRA fine-tunes, ControlNet for pose/edge/depth conditioning). Weaknesses: text rendering inside images has historically been poor (improving fast), prompt adherence degrades with compositional complexity ("red cube <em>on</em> blue sphere <em>left of</em> green cone"), and each image is a fresh sample — consistency across images is a fight.</p>' +
        '<p><b>Autoregressive image generation</b> — the newer wave behind gpt-image-1-class and Gemini-image-class models — treats image patches as tokens generated sequentially by (or tightly coupled to) the LLM itself. Strengths: dramatically better instruction following, in-image text that actually spells, conversational editing ("same image but make the jacket red"), and multimodal context (generate an image that matches this uploaded sketch and this brand doc). Weaknesses: slower and pricier per image, and less of an open fine-tuning ecosystem. As of early 2026, API pricing runs roughly $0.02–0.19 per image depending on model tier and resolution; self-hosted diffusion on a rented GPU amortizes to fractions of a cent at volume.</p>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Choose by task: <b>diffusion</b> for volume, style, photoreal texture, and controllable pipelines (ControlNet, LoRA); <b>autoregressive</b> for instruction-heavy asset work, text-in-image, and iterative editing. Most production shops use both — AR for the hero asset, diffusion for the 500 variants.</div>' +
        '<h2>Prompt-to-asset pipelines</h2>' +
        '<p>The demo is "type prompt, get image." The product is a pipeline, because raw generations are not assets:</p>' +
        '<ol>' +
        '<li><b>Prompt assembly:</b> a template merging user intent with locked style tokens ("flat vector, brand palette #1A73E8, white background, no gradients") — usually authored by an LLM step that expands a terse user request into a full prompt. Keep negative prompts (diffusion) and style suffixes in config, versioned like code (module 19).</li>' +
        '<li><b>Batch + select:</b> generate 4–8 candidates, auto-score with a VLM judge against a checklist (on-brand? artifacts? text legible?), surface the top 2 to a human. Seeds pinned for reproducibility where the API exposes them.</li>' +
        '<li><b>Post-processing:</b> upscale (real products rarely ship 1024px), background removal, palette snapping, compositing into templates. Boring, deterministic, essential.</li>' +
        '<li><b>Consistency machinery</b> for characters/products across images: reference-image conditioning, LoRA fine-tunes on your product shots, or AR-model multi-turn editing. This is the hardest open problem in the category — budget real time for it.</li>' +
        '</ol>' +
        '<h2>Safety and watermarking: not optional</h2>' +
        '<p>Image generation carries product risks text does not, and the mitigations are layered exactly like hallucination defenses:</p>' +
        '<ul>' +
        '<li><b>Input filtering:</b> prompt classifiers for sexual content involving minors (absolute), real-person deepfakes, trademark/logo requests, violence. Providers run their own and will refuse; if you self-host, that responsibility is entirely yours.</li>' +
        '<li><b>Output classification:</b> NSFW/violence classifiers on generated pixels, because prompts that pass filters can still produce policy-violating images (the text filter cannot predict the sample).</li>' +
        '<li><b>Provenance:</b> <b>C2PA content credentials</b> (cryptographically signed manifests recording "AI-generated, by which model, when") are shipping in major providers as of early 2026, and <b>invisible watermarks</b> (SynthID-style, embedded in pixel statistics, surviving crops and mild compression) are increasingly default. The EU AI Act\'s transparency provisions — machine-readable marking of synthetic media — have phased in, so "we forgot to label AI images" is now a compliance problem, not a nicety. Know that metadata-based credentials are stripped by screenshots and most social-media re-encodes; invisible watermarks survive better but are not unbreakable. Treat provenance as risk reduction, not proof.</li>' +
        '<li><b>Rights posture:</b> know your provider\'s training-data indemnification stance before shipping generated assets commercially — several vendors indemnify enterprise customers; open-source weights leave you on your own.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A marketing tool launched with prompt filtering only. Users discovered innocuous prompts that reliably produced celebrity lookalikes — no filter matched the prompt because the <em>prompt</em> was clean; the model\'s prior did the rest. The fix required an output-side face-recognition check against a public-figure index. Filter both sides of the model. Always both sides.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Generation latency as of early 2026: 2–10 s for diffusion at quality settings, 10–30 s for large AR models at high resolution. That is interactive-tool latency, not page-load latency — design the UX around progressive preview or async delivery (module 19\'s queue patterns), never a spinner on the critical path.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Expect "diffusion vs autoregressive — when would you pick each?" and "how do you stop your image feature generating a deepfake?" The second question is a values-and-layers question: input filters + output classifiers + provenance marking + rate limits, with the honest caveat that none is airtight.</div>'
    },
    {
      id: 'multimodal-rag',
      title: 'Multimodal RAG: retrieving pages, tables, and images',
      blurb: 'Three architectures — captions, joint embeddings, and ColPali-style page retrieval.',
      html: '<h2>The problem text-RAG cannot see</h2>' +
        '<p>Classic RAG (module 7) assumes knowledge lives in extractable text. Real corpora disagree: the answer to "what was Q3 churn in EMEA?" lives in a chart; the assembly torque spec lives in a diagram callout; the fraud signal lives in a scanned invoice\'s stamp. Text extraction either destroys these or renders them as noise. Multimodal RAG is the set of architectures that retrieve and reason over such content. There are three, in increasing order of fidelity and cost:</p>' +
        '<h2>Architecture 1: describe everything into text</h2>' +
        '<p>At ingestion, run every image/chart/table through a VLM: "describe this figure exhaustively — axes, series, notable values, trend." Embed the descriptions alongside normal text chunks; retrieval and generation stay 100% text. This is the pragmatic default: it reuses your entire existing RAG stack, works with any embedding model, and costs a one-time VLM pass (~$0.003–0.02 per image as of early 2026).</p>' +
        '<p>Its ceiling is the description. A caption is a lossy projection chosen <em>before</em> knowing the question — if the summarizer did not mention the EMEA line specifically, that fact is unretrievable forever. Mitigations: keep a pointer from each description chunk back to the source image, and at generation time <b>re-fetch the actual image</b> into the VLM context so the model answers from pixels, using the caption only for retrieval. Caption-for-retrieval, pixels-for-generation is the single highest-value trick in this lesson.</p>' +
        '<h2>Architecture 2: joint embedding spaces (CLIP lineage)</h2>' +
        '<p>CLIP-style models embed images and text into one space, so a text query can nearest-neighbor directly against image vectors. Great for <em>photographic</em> retrieval — product shots, scene search, "find images of corroded pipe joints." Weak for <em>documents</em>: a CLIP-class vector of a dense page collapses charts, table cells, and paragraphs into one gist vector; it can find "a page that looks financial" but not "the page containing the 4.2% figure." Use it for image-native corpora, not for PDFs.</p>' +
        '<h2>Architecture 3: ColPali-style page-screenshot retrieval</h2>' +
        '<p>The idea that reshaped document RAG from 2024 onward: <b>skip text extraction entirely</b>. Render each page as an image, run it through a VLM-based encoder that emits <em>hundreds of patch-level vectors per page</em> (not one), and score queries with <b>late interaction</b> (ColBERT-style MaxSim: each query token vector finds its best-matching patch vector, sum the maxima). Because matching is patch-level, a query about a specific number can lock onto the exact region of the chart where it appears. On visually rich corpora, ColPali-family models outperform full OCR-and-chunk pipelines on retrieval benchmarks (ViDoRe) while deleting the entire extraction stage — no OCR errors, no reading-order bugs, no table mangling.</p>' +
        '<p>The costs are concrete: <b>storage and compute blow up.</b> ~700–1,000 vectors per page instead of ~1–5 chunks — a multi-vector index over 1M pages is hundreds of GB and needs specialized indexing (binary quantization and pooling cut this 10–30× with modest quality loss, and are standard practice as of early 2026). Retrieval returns <em>page images</em>, so generation requires a VLM and pays image-token prices per retrieved page (~500–1,600 tokens each). And late-interaction scoring is heavier than a single dot product — you will want a two-stage retrieve (fast pooled-vector or hybrid first pass, late-interaction rerank).</p>' +
        '<table><tr><th></th><th>Describe-to-text</th><th>Joint embedding</th><th>ColPali-style</th></tr>' +
        '<tr><td>Reuses text-RAG stack</td><td>Fully</td><td>Partially</td><td>No — new index + VLM generation</td></tr>' +
        '<tr><td>Fine-grained doc queries</td><td>Caption-limited</td><td>Poor</td><td>Strong</td></tr>' +
        '<tr><td>Index size / 1M pages</td><td>Small</td><td>Small</td><td>Large (quantize!)</td></tr>' +
        '<tr><td>Best for</td><td>Mixed corpora, first version</td><td>Photo/image search</td><td>Visually dense documents where extraction fails</td></tr></table>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why late interaction wins on documents: a single-vector representation must compress a whole page into one point before seeing any query — it optimizes for the average question. Late interaction defers the compression decision to query time: the query\'s token vectors individually probe patch vectors, so rare, specific content stays findable. It is the same reason ColBERT beats bi-encoders on precise text retrieval, transplanted to pixels.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team indexed 400k slide decks ColPali-style, un-quantized, on a vector DB priced per GB of RAM. The index worked beautifully and cost more per month than the LLM bill. Binary quantization plus mean-pooling to ~130 vectors/page cut the bill ~25× with a ~2-point nDCG drop. Read the pricing page before you pick the fancy architecture.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Your RAG system can\'t answer questions about charts — options?" is the standard probe. Name all three architectures with their trade-off axes, and land the caption-for-retrieval/pixels-for-generation hybrid as the pragmatic middle. Bonus: mention quantization as the thing that makes multi-vector affordable.</div>'
    },
    {
      id: 'production-realities',
      title: 'Multimodal in production: the cost and latency math',
      blurb: 'Date-stamped numbers, prefill pain, caching images, and when to downscale.',
      html: '<h2>The bill, itemized (early 2026)</h2>' +
        '<p>Multimodal costs hide because they ride existing token meters. Pull them into the open with representative early-2026 numbers — volatile, so re-check quarterly, but the <em>ratios</em> are durable:</p>' +
        '<table><tr><th>Item</th><th>Ballpark</th><th>Comparison anchor</th></tr>' +
        '<tr><td>One 1024×1024 image, frontier model input</td><td>~750–1,600 tokens ≈ $0.002–0.005</td><td>≈ a 1,000-word text prompt</td></tr>' +
        '<tr><td>Screenshot-per-step agent, 30 steps</td><td>35k–50k image tokens ≈ $0.10–0.25/session</td><td>10–50× the text cost of the same session</td></tr>' +
        '<tr><td>Vision-parsing 1,000 PDF pages</td><td>$3–30 (model tier dependent)</td><td>vs ~$0 native extraction, ~$1.50 basic cloud OCR</td></tr>' +
        '<tr><td>Voice, cascaded (STT+LLM+TTS)</td><td>$0.02–0.06/min</td><td>Speech-to-speech frontier: $0.06–0.30/min</td></tr>' +
        '<tr><td>Generated image (API)</td><td>$0.02–0.19</td><td>Self-hosted diffusion at volume: &lt;$0.01</td></tr></table>' +
        '<p>Two structural facts to internalize. First, <b>images are input-heavy</b>: the expensive direction for text (output) is cheap for vision workloads, but sessions accumulate images in history, and history is resent every turn — a vision chat\'s cost curve bends far worse than a text chat\'s. Second, <b>audio is billed by time, not information</b>: a minute of silence costs the same as a minute of speech; VAD-gating what you send to STT is free money.</p>' +
        '<h2>Latency: prefill pain and pipeline shape</h2>' +
        '<p>Image tokens hit the same prefill stage as text (module 1), plus a vision-encoder pass. Practical effects:</p>' +
        '<ul>' +
        '<li><b>TTFT scales with image count and resolution.</b> A prompt with four high-detail screenshots can add 1–4 s of prefill before the first output token. For interactive UIs, downscale aggressively and send crops, not full frames.</li>' +
        '<li><b>Prompt caching applies to images</b> on the major APIs — a static image (brand guide, reference diagram, UI spec) placed <em>before</em> the variable part of the prompt gets the cached-input discount (up to 90% on some providers) and skips re-prefill. Stable-prefix discipline (module 3) matters double for vision.</li>' +
        '<li><b>Batch APIs take images.</b> Document backfills, nightly re-parsing, dataset labeling — all belong on the 50%-off async tier (module 18), not the interactive endpoint.</li>' +
        '<li><b>Resolution is a quality/cost dial you must tune per task.</b> OCR of dense tables needs native resolution; "is this a cat or a dog" is fine at 256px for a tenth of the tokens. The default of "send whatever the client uploaded" is the worst point on the curve — unbounded cost, and quality loss whenever the provider\'s silent downscale kicks in.</li>' +
        '</ul>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Provider image constraints as of early 2026: per-image size caps (commonly 5–20 MB), per-request image-count caps (tens to low hundreds), long-edge downscale thresholds (~1,500–2,000 px), and separate rate-limit accounting for image tokens. Realtime audio sessions cap at minutes-to-an-hour and bill for silence. Every one of these has ended an incident bridge; read the current limits page, not a blog post from last year.</div>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> The classic multimodal bill shock: a computer-use agent shipped sending full 2560×1440 screenshots every step, with history retained. By step 20 each request carried ~25 images ≈ 30k+ image tokens, re-billed every subsequent step — quadratic growth, exactly like text chat but 20× denser. Fixes, in order of impact: keep only the last 2–3 screenshots in history (older steps become one-line text summaries), downscale to the smallest resolution that passes the task eval, and cache the static system prefix. Session cost dropped 12× with no measurable success-rate change. Audit yours: log image tokens as a separate metric from day one.</div>' +
        '<h2>An adoption checklist</h2>' +
        '<p>Before shipping any multimodal feature, force answers to five questions: (1) What is the <b>per-unit cost</b> (per session, per page, per minute) at P50 and P95 usage, in dollars? (2) What is the <b>token-budget policy</b> for images/audio in history — who trims, when? (3) What does the <b>eval set</b> look like — sampled from real traffic, including the ugly tail (blurry photos, accents, scanned faxes)? (4) What is the <b>fallback</b> when the multimodal path fails or times out — text-only degradation, human queue, retry-at-lower-resolution? (5) Which <b>injection surface</b> did you just open — images and audio carry instructions too, and your text-side guardrails do not read pixels. Teams that answer these in the design review skip the retrofit; teams that do not, fund it with an outage.</p>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Senior multimodal questions are economics questions in disguise: "estimate the monthly cost of a screenshot-driven browser agent at 10k DAU." Interviewers want to watch you do tokens-per-image × steps × history-growth × price arithmetic out loud, then propose the trimming strategies. Have the ~1k-tokens-per-image anchor memorized.</div>'
    }
  ],
  quiz: [
    {
      text: 'Your VLM-based dashboard assistant misreads axis labels on wide monitoring screenshots (3200×900) but works on cropped panels. What is the most likely mechanism?',
      options: [
        'The model\'s OCR head is disabled for wide aspect ratios',
        'The provider silently downscales images past its long-edge limit, rendering small axis text illegible before encoding — the model then guesses fluently',
        'Wide images exceed the context window and get truncated mid-image',
        'Charts require a fine-tuned model; base VLMs cannot read axes'
      ],
      answer: [1],
      explanation: 'Providers resize images above their resolution limits before the vision encoder runs; 9px axis text becomes unreadable smear, and the model reconstructs plausible values instead of abstaining. Cropping preserves native resolution over the region that matters — which is exactly why crops work. (A) invents a mechanism; there is no separate OCR head toggle. (C) — images are encoded to a bounded token count, not truncated mid-image. (D) is contradicted by the crops working: the capability exists, the pixels were destroyed.'
    },
    {
      text: 'A warehouse product manager wants "count the boxes on this shelf photo" built on a frontier VLM, citing a demo where it correctly counted 4 boxes. What should you tell them?',
      options: [
        'Ship it — counting is a solved problem for frontier VLMs',
        'VLM counting accuracy collapses past roughly 5–10 objects because patch-based encoding has no enumeration mechanism; use an object detector for counting and the VLM for classifying crops',
        'Increase image resolution until counting becomes reliable',
        'Ask the VLM to count twice and average the answers'
      ],
      answer: [1],
      explanation: 'Counting is a known systematic VLM weakness: the model estimates quantity from global features and states it confidently; small-count demos do not generalize. Detectors enumerate; VLMs judge — split the task. (A) mistakes a 4-object demo for the 15-object reality. (C) — resolution helps OCR, not enumeration; the failure is architectural. (D) averages two samples from the same biased estimator; you get a confident wrong number with extra steps.'
    },
    {
      text: 'You must ingest 5M mixed PDFs (mostly born-digital, some scans, some dense financial tables). Which pipeline design is most defensible?',
      options: [
        'Render every page and vision-parse it with a frontier model for uniform quality',
        'Native text extraction for everything — OCR and vision models are legacy',
        'Route: native extraction first; OCR pages with empty/garbage text layers; escalate table-heavy or low-confidence pages to vision parsing',
        'OCR everything with Tesseract since it is free'
      ],
      answer: [2],
      explanation: 'Escalating cheap-to-expensive matches cost to difficulty: most born-digital pages extract for ~free, and the expensive vision path handles the sliver that needs it. (A) fails the arithmetic — 5M pages × even $0.01/page is $50k+ for pages that mostly extract for free, plus hallucinated-cell risk on the tables. (B) silently corrupts scans (no text layer) and mangles tables. (D) feeds born-digital pages through a lossy OCR step for no reason and still fails on complex tables.'
    },
    {
      text: 'Your RAG pipeline extracts financial tables as flat text; users report answers citing correct sources with wrong numbers. Which TWO changes most directly address the failure?',
      options: [
        'Convert tables to markdown/HTML with layout-aware parsing and keep each table as an intact chunk',
        'Increase the number of retrieved chunks from 5 to 20',
        'Store a rendered image of each table and pass it to a VLM at generation time for numeric verification',
        'Switch to a larger embedding model',
        'Lower the generation temperature to 0'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'The corruption happens at extraction: drawing-order text puts numbers under wrong headers, so the index itself is wrong. Structured table parsing fixes the stored representation (A); keeping the source image lets generation verify against ground truth (C). More chunks (B) retrieves more corrupted text. A better embedding model (D) embeds garbage more accurately. Temperature 0 (E) deterministically repeats the wrong number — the error predates sampling.'
    },
    {
      text: 'A vision model transcribing invoices occasionally outputs a plausible-but-wrong total. Dedicated OCR makes character-level errors like 0→O instead. Why does this difference matter for a payments workflow?',
      options: [
        'It does not — errors are errors; pick the cheaper tool',
        'OCR character errors are mechanical and often catchable with regex/checksum validation; VLM errors are semantically coherent reconstructions that pass surface validation, so numeric-critical fields need reconciliation across independent methods',
        'VLM errors are always rarer, so vision parsing is strictly safer',
        'OCR errors only occur on handwriting'
      ],
      answer: [1],
      explanation: 'The failure distributions differ in kind: a checksum or format regex catches "1O4.50", but a VLM that reconstructs "104.50" as "140.50" produces a perfectly valid-looking number. For money, run OCR and VLM in parallel and flag disagreements. (A) ignores that detectability, not just rate, drives risk. (C) overclaims — VLM error rates vary by page density and are not uniformly lower. (D) is false; print OCR errors on low-quality scans are routine.'
    },
    {
      text: 'Your cascaded voice agent (streaming STT → LLM → streaming TTS) measures 1.4 s from end-of-speech to first audio, and each component looks fast in isolation. Where does the recoverable time usually hide?',
      options: [
        'The components are sequential when they could overlap: run the LLM on STT partials, start TTS on the first clause, and tune endpointing — which alone often holds 150–400 ms',
        'Buy a faster GPU for the TTS model',
        'Replace streaming STT with batch STT for better accuracy',
        'Increase the LLM\'s max_tokens so it finishes in one call'
      ],
      answer: [0],
      explanation: 'Cascade latency is dominated by stage boundaries and endpointing, not stage speed: waiting for the full transcript, then the full LLM response, then synthesis serializes work that can overlap, and VAD endpointing silently spends hundreds of ms deciding the user finished. (B) optimizes one stage that is rarely the bottleneck. (C) moves the wrong direction — batch STT waits for the whole utterance. (D) confuses output length limits with latency; max_tokens does not speed anything up.'
    },
    {
      text: 'Users report your voice bot "talks over them and then repeats things they already heard." Which implementation gap explains the repetition after barge-in?',
      options: [
        'TTS speed is set too high',
        'The conversation history still contains the full text the bot intended to say, not just what was spoken before the interrupt, so the model believes those words were delivered',
        'STT is transcribing the bot\'s own voice',
        'The LLM context window is full'
      ],
      answer: [1],
      explanation: 'Correct barge-in requires truncating the assistant turn in history to what was actually played out loud; otherwise the model\'s view of the dialog diverges from the user\'s, producing repeats or references to unheard content. (A) affects speaking rate, not repetition logic. (C) — echo pickup is a real barge-in bug but causes self-interruption and garbled transcripts, not coherent repetition. (D) full context produces truncation errors or forgetting, not systematic post-interrupt repeats.'
    },
    {
      text: 'You are choosing between a cascaded pipeline and a speech-to-speech model for a voice agent that must run guardrails on every user utterance and call internal tools. What is the honest trade-off?',
      options: [
        'Speech-to-speech is better on every axis; cascades are legacy',
        'Speech-to-speech wins on latency and prosody but weakens the clean text checkpoint used for moderation, logging, and tool orchestration — a hybrid or cascade keeps control at a latency cost',
        'Cascades are always cheaper, so cost decides it',
        'Guardrails are impossible with speech-to-speech models'
      ],
      answer: [1],
      explanation: 'The architectural difference is where text exists: cascades give you a transcript between every stage — a natural interception point for guardrails, RAG, and tools. Speech-to-speech collapses stages for 300–600 ms latency but you must bolt moderation onto async transcripts. (A) ignores the control loss and per-minute pricing. (C) — cascaded is often cheaper, but the deciding axis here is the control requirement, not cost. (D) overstates it: harder and laggier, not impossible.'
    },
    {
      text: 'Your team needs 800 product-shot variants per week in a locked brand style, plus occasional hero images with accurate in-image text from detailed briefs. What is the strongest tool split, as of early 2026?',
      options: [
        'Autoregressive API model for everything — best quality wins',
        'Diffusion with a brand LoRA + ControlNet for the volume variants; an autoregressive model for instruction-heavy hero assets with text rendering',
        'Diffusion for everything including text-heavy heroes',
        'Fine-tune an open VLM to generate both'
      ],
      answer: [1],
      explanation: 'This maps each paradigm to its strength: diffusion + LoRA gives cheap, style-locked volume with structural control; AR models excel at complex instruction following and legible in-image text. (A) works but pays $0.02–0.19 × 800/week for variants diffusion produces for ~free self-hosted, with less style-locking control. (C) fights diffusion\'s weakest area (text rendering) on the assets where it matters most. (D) confuses model families — VLMs understand images; they are not production image generators.'
    },
    {
      text: 'Your image-generation feature filters prompts for celebrity names, yet users still produce recognizable celebrity likenesses from innocuous prompts. What does this demonstrate about generation safety?',
      options: [
        'The prompt filter needs a bigger blocklist',
        'Input-side filtering cannot predict what the model will sample; policy-relevant properties must also be checked on the output side (e.g. face matching against a public-figure index)',
        'The model is broken and should be replaced',
        'Watermarking the output solves this'
      ],
      answer: [1],
      explanation: 'The prompt was clean — the model\'s learned prior produced the likeness, so no input filter can catch it. Safety must be layered on both sides of the model: prompt classifiers AND output classifiers. (A) chases an unwinnable enumeration game against prompts that never name anyone. (C) — every strong image model has priors that surface this way. (D) — watermarking addresses provenance/disclosure, not whether the image should exist at all.'
    },
    {
      text: 'Legal asks whether C2PA content credentials on your generated images guarantee downstream platforms will identify them as AI-generated. What is the accurate answer?',
      options: [
        'Yes — C2PA manifests are cryptographically signed and cannot be removed',
        'No — signed metadata is stripped by screenshots and most re-encodes; invisible watermarks survive better but are not unbreakable. Provenance marking reduces risk and meets disclosure rules; it does not guarantee detection',
        'No — C2PA only applies to photographs, not generated images',
        'Yes — as of 2026 all platforms are legally required to preserve C2PA data'
      ],
      answer: [1],
      explanation: 'C2PA is signed metadata: robust to tampering (edits break the signature) but trivially removed by re-encoding or screenshotting. Pixel-domain watermarks (SynthID-style) survive common transforms yet degrade under aggressive edits. The right posture is layered marking as risk reduction plus compliance. (A) confuses tamper-evidence with removal-resistance. (C) is backwards — C2PA covers synthetic media explicitly. (D) — disclosure obligations bind generators/deployers; universal platform preservation is not the legal reality.'
    },
    {
      text: 'Your text-RAG system fails on "what does figure 3 show about latency vs batch size?" Retrieval finds the right page\'s text but the answer is in the chart. Which upgrade gives fine-grained chart answers at the lowest architectural disruption?',
      options: [
        'Swap the embedding model for a CLIP-style joint image-text model',
        'At ingestion, VLM-caption every figure for retrieval; at generation, re-fetch the actual figure image into a VLM context so answers come from pixels, not the caption',
        'Rebuild the whole index ColPali-style with multi-vector page embeddings',
        'Increase chunk size so chart-adjacent text is included'
      ],
      answer: [1],
      explanation: 'Caption-for-retrieval, pixels-for-generation reuses the existing text-RAG stack (one ingestion pass + one generation-time image fetch) and removes the caption ceiling because the model answers from the actual figure. (A) CLIP-class vectors find pages that "look chart-like," not specific data relationships — weak on documents. (C) works well but is a full re-architecture: new index, multi-vector storage, VLM generation — not the lowest-disruption path. (D) retrieves more text that still does not contain what the pixels show.'
    },
    {
      text: 'A ColPali-style index over 2M pages is delivering great retrieval quality but the vector DB bill exceeds the LLM bill. Which lever is standard practice before abandoning the architecture?',
      options: [
        'Reduce the corpus to the 100k most popular pages',
        'Binary quantization plus vector pooling (e.g. ~1,000 → ~100 vectors/page), accepting a small nDCG drop for a 10–30× storage cut, with a two-stage retrieve-then-rerank',
        'Switch to storing one averaged vector per page',
        'Move the index to local disk on the app servers'
      ],
      answer: [1],
      explanation: 'Multi-vector indexes are made affordable by quantization + pooling — a well-characterized trade of a few retrieval-quality points for order-of-magnitude storage savings, with late-interaction reranking preserving precision. (A) deletes coverage users will notice. (C) collapses to a single-vector representation, destroying exactly the patch-level matching that justified the architecture. (D) relocates cost while breaking the DB\'s indexing/scaling properties — an ops incident, not a fix.'
    },
    {
      text: 'A computer-use agent sends a full-resolution screenshot every step and keeps all of them in history. Sessions average 25 steps. Which THREE changes cut cost most without hurting task success?',
      options: [
        'Keep only the last 2–3 screenshots in history; replace older ones with one-line text summaries of the step',
        'Downscale screenshots to the smallest resolution that passes the task eval',
        'Place the static system prompt and instructions in a cached prefix before the variable screenshots',
        'Switch all screenshots to lossless PNG for encoder accuracy',
        'Generate longer text rationales each step so the model relies less on images'
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: 'History trimming attacks the quadratic term (every retained image is re-billed each subsequent step); resolution tuning cuts tokens per image at the source; prefix caching gets the static portion discounted up to 90%. Together these routinely cut sessions ~10×. (D) — file format does not change token count, which is set by resolution/tiling math, and lossless uploads are just larger. (E) adds output tokens (the expensive kind) while the images still bill; it raises cost.'
    }
  ],
  flashcards: [
    { id: 'fc-vlm-pipeline', front: 'How does an image enter an LLM\'s token stream?', back: 'ViT vision encoder slices it into 14–16px <b>patches</b>, embeds them, and a projection layer maps patch vectors into the text embedding space — "soft tokens" spliced into the sequence, attended to like text.' },
    { id: 'fc-image-cost', front: 'Rough token cost of a 1024×1024 image on frontier APIs (early 2026)?', back: '~750–1,600 tokens depending on provider tiling math (OpenAI-style ~85 base + ~170/tile; Anthropic-style ~w×h/750; Gemini-style 258/tile). Anchor: one image ≈ a 1,000-word prompt.' },
    { id: 'fc-tiling', front: 'Why is image token cost a step function of resolution?', back: 'Providers tile large images (512–768px tiles), each tile encoded separately at fixed token cost, plus a downscaled global view. Crossing a tile boundary jumps the price.' },
    { id: 'fc-downscale', front: 'What silently breaks OCR of large screenshots?', back: 'Provider-side downscaling past the long-edge limit (~1,500–2,000px) makes small text illegible <em>before</em> encoding — the model then guesses values fluently. Fix: send native-resolution crops.' },
    { id: 'fc-vlm-weak', front: 'Four systematic VLM weaknesses to design around?', back: '<b>Counting</b> past ~5–10 objects · <b>precise spatial/coordinate</b> answers · <b>small/dense/handwritten text</b> · <b>certifying absence</b> ("confirm no error shown"). Use detectors/OCR/structured checks for these.' },
    { id: 'fc-image-injection', front: 'Why are image inputs a prompt-injection surface?', back: 'Image content becomes in-band tokens like any text; instructions rendered inside a screenshot or photo can steer the model, and text-side guardrails never see pixels.' },
    { id: 'fc-pdf-three', front: 'The three PDF extraction strategies and the routing rule?', back: '<b>Native text</b> (free, born-digital) → <b>OCR</b> ($0.0015–0.065/page, scans) → <b>vision parsing</b> (complex layout/tables). Try cheap, detect failure (empty/garbage text layer), escalate.' },
    { id: 'fc-table-corruption', front: 'Why do extracted tables silently corrupt RAG answers?', back: 'PDF text extracts in drawing order — numbers land under wrong headers with no error thrown. Fix: layout-aware parsing to markdown/HTML, tables as intact chunks, keep a page image for verification.' },
    { id: 'fc-ocr-vs-vlm-err', front: 'OCR errors vs VLM transcription errors — the key difference?', back: 'OCR errors are mechanical (0→O) and catchable with regex/checksums. VLM errors are <em>plausible reconstructions</em> that pass validation. For money fields: run both, reconcile disagreements.' },
    { id: 'fc-voice-bar', front: 'The voice-agent latency bar and the human baseline?', back: 'Human turn gap ~200–300 ms; ~500 ms voice-to-first-audio feels conversational; past ~800 ms feels laggy, ~1.5 s users talk over the bot. Measure P50 and P95 of end-of-speech → first audio.' },
    { id: 'fc-endpointing', front: 'What is endpointing and why does it dominate voice latency?', back: 'Detecting the user has finished speaking. VAD must wait to distinguish pause from finish — 150–400 ms, usually the largest single line item. Semantic endpointing cuts it.' },
    { id: 'fc-cascade-vs-s2s', front: 'Cascade vs speech-to-speech: the core trade?', back: 'Cascade (STT→LLM→TTS): text checkpoint for guardrails/tools/logging, ~800–1500 ms unless stages overlap. Speech-to-speech: 300–600 ms, native prosody/barge-in, weaker text control point, higher $/min.' },
    { id: 'fc-barge-in', front: 'Barge-in requires which four things?', back: 'Full-duplex audio · echo cancellation (bot must not hear itself) · instant TTS stop · <b>history truncation</b> to what was actually spoken — else the model thinks it said unheard things.' },
    { id: 'fc-diff-vs-ar', front: 'Diffusion vs autoregressive image generation — when to pick each?', back: '<b>Diffusion:</b> volume, photoreal texture, style ecosystem (LoRA/ControlNet), cheap self-hosted. <b>Autoregressive:</b> instruction following, legible in-image text, conversational editing. Production shops use both.' },
    { id: 'fc-gen-safety', front: 'Why must image-gen safety run on both sides of the model?', back: 'Input filters cannot predict the sample — clean prompts can still produce policy-violating images from the model\'s prior. Layer prompt classifiers + output classifiers (+ provenance marking).' },
    { id: 'fc-watermark', front: 'C2PA credentials vs invisible watermarks?', back: 'C2PA = signed metadata: tamper-evident but stripped by screenshots/re-encodes. Invisible watermarks (SynthID-style) live in pixel statistics, survive crops/compression better, still not unbreakable. Both = risk reduction, not proof.' },
    { id: 'fc-mm-rag-three', front: 'Three multimodal RAG architectures?', back: '1) <b>Describe-to-text</b> (VLM captions, reuse text stack) 2) <b>Joint embeddings</b> (CLIP-style, photo search) 3) <b>ColPali-style</b> (page screenshots, multi-vector late interaction — best for dense documents, biggest index).' },
    { id: 'fc-caption-pixel', front: 'The highest-value multimodal RAG trick?', back: '<b>Caption for retrieval, pixels for generation:</b> embed VLM descriptions to find figures, then re-fetch the actual image into the VLM at answer time so responses come from pixels, not the lossy caption.' },
    { id: 'fc-colpali', front: 'What makes ColPali-style retrieval work, and its cost?', back: 'Hundreds of patch-level vectors/page + late interaction (MaxSim per query token) — specific content stays findable. Cost: 100–1,000× vectors per page; tame with binary quantization + pooling (10–30× cut).' },
    { id: 'fc-screenshot-audit', front: 'Top three cost fixes for a screenshot-heavy agent?', back: '1) Keep only last 2–3 screenshots in history (older → text summaries) 2) downscale to smallest resolution passing evals 3) prompt-cache the static prefix. Routinely ~10× cheaper, no success-rate loss.' }
  ],
  lab: {
    title: 'Measure the vision tax: token math, counting failures, and OCR vs vision parsing',
    intro: '<p>Three experiments against a real vision API to make image economics and failure modes tactile: measure what an image actually costs at different resolutions, catch the counting failure live, and race text extraction against vision parsing on a real PDF page.</p><p><b>Needs:</b> <code>python3</code>, an API key for any OpenAI-compatible vision endpoint (or a local VLM via Ollama for $0), one PDF with a table. Worst case ~$0.30.</p>',
    steps: [
      {
        title: 'Measure image token cost as a function of resolution',
        html: '<pre><code>pip install openai pillow\n\npython3 - &lt;&lt;\'EOF\'\nimport base64, io\nfrom PIL import Image\nfrom openai import OpenAI\nclient = OpenAI()  # set OPENAI_API_KEY\n\nimg = Image.new(\'RGB\', (2048, 2048), \'white\')  # blank: content doesn\'t matter, pixels do\nfor size in [256, 512, 1024, 2048]:\n    small = img.resize((size, size))\n    buf = io.BytesIO(); small.save(buf, format=\'PNG\')\n    b64 = base64.b64encode(buf.getvalue()).decode()\n    r = client.chat.completions.create(\n        model=\'gpt-4o-mini\',\n        messages=[{\'role\': \'user\', \'content\': [\n            {\'type\': \'text\', \'text\': \'Describe in 3 words.\'},\n            {\'type\': \'image_url\', \'image_url\': {\'url\': \'data:image/png;base64,\' + b64, \'detail\': \'high\'}}\n        ]}], max_tokens=10)\n    print(size, \'px →\', r.usage.prompt_tokens, \'prompt tokens\')\nEOF</code></pre>' +
          '<p>Watch prompt tokens step up with resolution — that staircase is the tiling math from lesson 1. Re-run with <code>\'detail\': \'low\'</code> and note the flat cost. Now you can price any screenshot feature on a napkin.</p>'
      },
      {
        title: 'Catch the counting failure',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport base64, io, random\nfrom PIL import Image, ImageDraw\nfrom openai import OpenAI\nclient = OpenAI()\n\ndef ask_count(n):\n    img = Image.new(\'RGB\', (768, 768), \'white\')\n    d = ImageDraw.Draw(img)\n    random.seed(42)\n    for _ in range(n):\n        x, y = random.randint(20, 700), random.randint(20, 700)\n        d.ellipse([x, y, x + 28, y + 28], fill=\'navy\')\n    buf = io.BytesIO(); img.save(buf, format=\'PNG\')\n    b64 = base64.b64encode(buf.getvalue()).decode()\n    r = client.chat.completions.create(model=\'gpt-4o-mini\',\n        messages=[{\'role\': \'user\', \'content\': [\n            {\'type\': \'text\', \'text\': \'Exactly how many circles? Answer with only the number.\'},\n            {\'type\': \'image_url\', \'image_url\': {\'url\': \'data:image/png;base64,\' + b64}}\n        ]}], max_tokens=5)\n    return r.choices[0].message.content.strip()\n\nfor n in [3, 7, 12, 19, 27]:\n    print(\'actual:\', n, \' model says:\', ask_count(n))\nEOF</code></pre>' +
          '<p>Small counts are fine; watch accuracy fall apart in the teens — and note the answer is always delivered with total confidence. Run the 27-circle case three times: you will likely get three different numbers. This is the experiment to show any PM who wants VLM-based counting.</p>'
      },
      {
        title: 'Race text extraction vs vision parsing on a real table',
        html: '<pre><code>pip install pymupdf\n\npython3 - &lt;&lt;\'EOF\'\nimport base64, sys\nimport fitz  # PyMuPDF\nfrom openai import OpenAI\nclient = OpenAI()\n\ndoc = fitz.open(\'yourfile.pdf\')      # pick a page with a table\npage = doc[0]\n\nprint(\'=== NATIVE TEXT EXTRACTION ===\')\nprint(page.get_text()[:1500])\n\npix = page.get_pixmap(dpi=150)\nb64 = base64.b64encode(pix.tobytes(\'png\')).decode()\nr = client.chat.completions.create(model=\'gpt-4o-mini\',\n    messages=[{\'role\': \'user\', \'content\': [\n        {\'type\': \'text\', \'text\': \'Transcribe this page to markdown. Render tables as markdown tables preserving structure.\'},\n        {\'type\': \'image_url\', \'image_url\': {\'url\': \'data:image/png;base64,\' + b64}}\n    ]}], max_tokens=1500)\nprint(\'=== VISION PARSING ===\')\nprint(r.choices[0].message.content)\nprint(\'\\nimage prompt tokens:\', r.usage.prompt_tokens)\nEOF</code></pre>' +
          '<p>Compare the two outputs against the actual PDF: check reading order, then check the table cell by cell. Typical finding: native extraction scrambles the table but never invents values; vision parsing keeps the structure but verify the numbers — if any cell differs from the source, you have witnessed a plausible-reconstruction error, the exact failure class from lesson 2. Note the per-page vision cost from the usage line and multiply by your corpus size.</p>'
      }
    ],
    costNote: 'Worst case across all three experiments on gpt-4o-mini-class pricing: ~$0.30 (the resolution sweep is the priciest part at high detail). On a local VLM (Ollama: <code>ollama run llama3.2-vision</code>, base_url http://localhost:11434/v1): $0, though token accounting will differ. Nothing persistent is created — no cleanup needed beyond deleting the local test PDF renders.'
  }
});
