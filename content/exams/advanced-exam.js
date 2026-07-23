COURSE.registerExam({
  id: 'exam-advanced',
  track: 'advanced',
  title: 'Advanced & Production — Mock Exam',
  blurb: 'Scenario questions across the advanced track: fine-tuning, inference internals, open models, multimodal, cost/latency, production patterns, system design, the frontier, and career.',
  minutes: 100,
  questions: [

    /* ===================== Fine-tuning ===================== */
    {
      domain: 'Fine-tuning',
      text: 'A support team wants the assistant to (a) always answer in their exact five-field JSON house format and (b) reflect this week\'s pricing changes. They ask you to fine-tune for both. What is the right split?',
      options: [
        'Fine-tune for both — a single training run can bake in format and current prices together',
        'Fine-tune for neither; prompt engineering alone always beats fine-tuning',
        'Fine-tune to teach the durable output format/behavior, but serve current pricing via retrieval/tools — weekly-changing facts do not belong in weights',
        'Retrieve the format each turn and fine-tune the prices in nightly'
      ],
      answer: [2],
      explanation: 'Fine-tuning excels at teaching a stable style, format, or behavior, so the house JSON shape is a legitimate target; volatile facts like this week\'s prices belong in retrieval because re-training on every price change is slow, costly, and unreliable at exact recall. (A) bakes perishable facts into weights — the classic mistake. (B) overstates prompting; format adherence is exactly where a small fine-tune helps. (D) inverts each need onto the wrong tool.'
    },
    {
      domain: 'Fine-tuning',
      text: 'You are fine-tuning an 8B model with LoRA on a single 24 GB GPU. Which TWO statements about why LoRA fits where full fine-tuning would not are correct (as of early 2026)?',
      options: [
        'LoRA trains only small low-rank adapter matrices, so optimizer state and gradients cover a tiny fraction of the parameters instead of all 8B',
        'LoRA changes the model architecture to a smaller one at inference time',
        'Full fine-tuning must hold weights plus Adam optimizer state (roughly 2 extra copies) in VRAM, which for an 8B in FP16/mixed precision blows past 24 GB',
        'LoRA works by quantizing the base model to 1-bit during training',
        'LoRA removes the need for any base model at inference'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'LoRA freezes the base weights and trains small rank-r adapters, so gradients and optimizer state scale with the adapter size, not 8B — that is the memory win. Full fine-tuning must also store Adam\'s momentum and variance (about two more full-size copies) plus activations, which overruns a 24 GB card for an 8B in mixed precision. (B) is false: adapters merge or add alongside the unchanged base. (D) is false: LoRA is 4-bit quant of the frozen base during training, not 1-bit. (E) the base model is still required at inference.'
    },
    {
      domain: 'Fine-tuning',
      text: 'After SFT on 300 hand-written examples, your model nails the new task but has become noticeably worse at general reasoning and formatting it used to handle. What happened and what is the best mitigation?',
      options: [
        'The learning rate was too low; raise it and retrain',
        'Catastrophic forgetting from over-narrow data; mix in general/instruction data, lower the LR, and use fewer epochs (or LoRA) to preserve prior capabilities',
        'The model needs more epochs on the same 300 examples',
        'This is impossible — fine-tuning never degrades other skills'
      ],
      answer: [1],
      explanation: 'Training hard on a narrow distribution shifts weights away from previously learned behavior — catastrophic forgetting — and the standard defenses are replaying general data, a gentler learning rate, fewer epochs, and parameter-efficient methods like LoRA that perturb less. (A) a too-low LR would under-fit, not cause forgetting. (C) more epochs on the same 300 deepens overfitting and forgetting. (D) denies a well-documented failure mode.'
    },
    {
      domain: 'Fine-tuning',
      text: 'You have 50,000 pairs of (prompt, preferred answer, rejected answer) from human raters and want the model to prefer the better style. Which training approach directly targets this, and what is the key contrast with plain SFT?',
      options: [
        'Plain SFT on only the preferred answers — it is identical to preference tuning',
        'Preference optimization (e.g., DPO): it learns from the relative ranking of preferred vs rejected, teaching what to avoid, whereas SFT only imitates positive examples',
        'Pretraining from scratch on the pairs',
        'Retrieval over the 50,000 pairs at inference time'
      ],
      answer: [1],
      explanation: 'DPO-style preference optimization uses both the chosen and rejected completion, so the signal includes what NOT to do — something pure imitation of preferred answers cannot express. SFT on only the winners (A) loses the contrastive information that makes preference tuning powerful. (C) pretraining is the wrong scale and objective. (D) retrieval does not change model behavior/style.'
    },
    {
      domain: 'Fine-tuning',
      text: 'A stakeholder says "our fine-tune hallucinated a policy that does not exist — the training data was clearly bad." Your 2,000 examples were all correct, but many asked the model to state facts it had no way to know. Why does clean data still produce this, and the fix?',
      options: [
        'Correct-but-unknowable targets teach the model to fabricate confident answers in that shape; the fix is to include abstention/uncertainty examples and only train on knowledge the model can actually ground',
        'The data was secretly corrupted; re-label all 2,000',
        'Hallucination is purely a temperature setting; set it to 0',
        'Fine-tuning cannot cause hallucination under any circumstances'
      ],
      answer: [0],
      explanation: 'If every training target asserts a fact confidently, the model learns the pattern "produce a confident fact here" even when it lacks the knowledge, generalizing into fabrication — SFT teaches form as much as content. The fix is teaching the desired behavior on thin evidence (abstention, "I do not have that") and grounding facts via retrieval rather than weights. (B) assumes corruption that is not there. (C) temperature 0 makes the fabrication deterministic, not absent. (D) denies the mechanism.'
    },
    {
      domain: 'Fine-tuning',
      text: 'Before committing to a fine-tune, you want the cheapest experiments that might make it unnecessary. Which TWO should you exhaust first?',
      options: [
        'Few-shot prompting with well-chosen examples of the target behavior/format',
        'Immediately renting 8xH100s to train a full fine-tune for a week',
        'A stronger base model and/or better system-prompt instructions to see if the gap closes without training',
        'Re-pretraining the model on your domain corpus',
        'Deleting your eval set so results look better'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'Few-shot examples and a stronger base model or sharper instructions are near-zero-cost probes that frequently close the gap, and you want them ruled out before paying for data curation and training. (B) jumps straight to the most expensive option. (D) re-pretraining is vastly more costly than fine-tuning and rarely warranted. (E) sabotages the very measurement you need to decide.'
    },
    {
      domain: 'Fine-tuning',
      text: 'Your fine-tuned model scores 96% on your held-out eval but users report it is worse than the base model in production. What is the most likely cause?',
      options: [
        'The base model was secretly downgraded by the provider',
        'Train/eval leakage or an eval set drawn from the same narrow distribution as training — it measures memorization, not the production distribution',
        'Fine-tuned models always beat base models, so users are mistaken',
        'The eval should have had exactly 5 questions to be reliable'
      ],
      answer: [1],
      explanation: 'A high eval score with poor real-world behavior is the signature of leakage or an eval that mirrors the training distribution, so it rewards memorization instead of generalization to live traffic. (A) is an unfounded conspiracy. (C) contradicts the reported evidence. (D) a tiny eval gives noisy signal — the opposite of what you want. Build the eval from real production data with held-out, non-overlapping examples.'
    },

    /* ===================== Inference internals ===================== */
    {
      domain: 'Inference internals',
      text: 'A latency dashboard shows time-to-first-token is fast but tokens/sec during generation is your bottleneck on a self-hosted model. Which characterization of the two phases is correct?',
      options: [
        'Both phases are compute-bound; buy more FLOPs',
        'Prefill (processing the prompt) is parallel and compute-bound; decode (one token at a time) is memory-bandwidth-bound, so per-token generation speed is gated by how fast weights and KV cache stream from HBM',
        'Decode is parallel and prefill is sequential',
        'tokens/sec is fixed by the tokenizer and cannot be improved'
      ],
      answer: [1],
      explanation: 'Prefill runs the whole prompt through the network in one parallel pass (compute-bound), while decode emits tokens sequentially and is limited by memory bandwidth streaming weights plus the growing KV cache, which is why generation speed is the usual bottleneck. (A) misdiagnoses decode as compute-bound. (C) reverses the two phases. (D) tokens/sec depends on hardware, batching, and quantization, not the tokenizer.'
    },
    {
      domain: 'Inference internals',
      text: 'Serving a single request on an 80 GB H100, your GPU utilization sits near 10% yet throughput is poor and cost per token is high. Which TWO techniques most directly fix the underutilization?',
      options: [
        'Continuous (in-flight) batching to interleave many requests through the GPU and keep it busy',
        'Setting temperature to 0 for all requests',
        'Raising max_tokens on every request',
        'Larger effective batch sizes so the memory-bandwidth cost of loading weights is amortized across many sequences',
        'Disabling the KV cache to save memory'
      ],
      answer: [0, 3],
      multi: true,
      explanation: 'Decode is memory-bandwidth-bound, so a single sequence wastes the GPU; continuous batching and larger batches amortize the cost of streaming weights across many concurrent sequences, sharply raising throughput and lowering cost per token. (B) temperature is unrelated to utilization. (C) longer outputs do not fix underutilization and cost more. (E) disabling the KV cache forces recomputation of all past tokens every step — catastrophic for speed.'
    },
    {
      domain: 'Inference internals',
      text: 'You increase context length from 4k to 32k on a self-hosted 8B and OOM at higher concurrency even though the weights fit comfortably. What is consuming the memory?',
      options: [
        'The tokenizer vocabulary grew with context length',
        'The KV cache: it grows linearly with sequence length and number of concurrent sequences, so long contexts times many users can dwarf the weight footprint',
        'Model weights double every time context doubles',
        'Longer context increases the parameter count of the model'
      ],
      answer: [1],
      explanation: 'The KV cache stores keys and values for every past token in every layer, so its size scales with sequence length multiplied by batch size — at 32k across many concurrent users it can exceed the weights themselves. (A) vocabulary is fixed. (C) and (D) weights and parameter count are constant regardless of context length. This is why long-context serving is a memory-planning problem.'
    },
    {
      domain: 'Inference internals',
      text: 'A teammate proposes quantizing your self-hosted 70B from FP16 to 4-bit (Q4) to fit cheaper hardware, worried it will "break the model." What is the accurate expectation as of early 2026?',
      options: [
        '4-bit always makes models unusable; never go below 16-bit',
        'Quantization only affects speed, never quality',
        'A well-done 4-bit quant (e.g., Q4_K_M) typically loses little quality while roughly quartering the memory footprint; degradation becomes severe mainly below ~4 bits',
        '4-bit doubles the parameter count'
      ],
      answer: [2],
      explanation: 'Modern 4-bit K-quants preserve most quality while cutting memory ~4x versus FP16, which is why they are the practical default for local serving; the sharp quality cliff shows up below about 4 bits (Q2/Q3). (A) overstates the loss at 4-bit. (B) quantization affects both memory/speed and, at low bit-widths, quality. (D) quantization reduces bytes per parameter, it does not change the parameter count.'
    },
    {
      domain: 'Inference internals',
      text: 'To speed up decoding, an inference stack uses a small "draft" model to propose several tokens that the large model then verifies in one pass. What is this, and when does it help without changing outputs?',
      options: [
        'Speculative decoding: the big model verifies the draft\'s tokens in parallel, accepting the correct prefix — it speeds up decode with identical output distribution when the draft agrees often',
        'Quantization: it rewrites weights to lower precision',
        'Continuous batching: it merges unrelated user requests',
        'Prompt caching: it reuses a shared prefix across requests'
      ],
      answer: [0],
      explanation: 'Speculative decoding uses a cheap draft model to guess several next tokens that the target model verifies in a single parallel step, keeping only the accepted prefix — it preserves the target model\'s output distribution while cutting latency when acceptance is high. (B) quantization is a precision change, unrelated. (C) continuous batching is a throughput technique across requests. (D) prompt caching reuses input prefixes, not draft tokens.'
    },
    {
      domain: 'Inference internals',
      text: 'A batch job and an interactive chat feature share one self-hosted model, and chat latency spikes whenever the batch job runs. Which explanation and remedy best fit how batched inference works?',
      options: [
        'Nothing can be done; a shared model cannot serve two workloads',
        'Large batches raise throughput but add per-token latency, and long batch sequences occupy KV cache/compute; isolate latency-sensitive traffic (separate replica or priority scheduling) from throughput-oriented batch work',
        'Lower the chat temperature to reduce interference',
        'Chat is slow only because its prompts are longer than the batch prompts'
      ],
      answer: [1],
      explanation: 'Throughput-oriented batching improves tokens-per-second overall but increases individual request latency and competes for KV-cache and compute, so mixing interactive and bulk traffic on one replica hurts the latency-sensitive path. Isolating workloads (dedicated replica or priority scheduling) is the standard fix. (A) is defeatist. (C) temperature does not affect scheduling. (D) assumes prompt length without evidence and misses the batching contention.'
    },
    {
      domain: 'Inference internals',
      text: 'Two providers both advertise a 70B model but one streams at ~120 tok/s and the other at ~30 tok/s at similar price. Which factors most plausibly explain the gap (choose the best single answer)?',
      options: [
        'The faster one must be using a smaller model and mislabeling it',
        'Serving-stack differences — quantization, batching efficiency, speculative decoding, and GPU/interconnect — can produce large tokens/sec differences for the same nominal model',
        'tokens/sec is purely a function of parameter count, so equal-size models must match',
        'The slower provider has a larger context window, which always halves speed'
      ],
      answer: [1],
      explanation: 'Decode speed for a given model depends heavily on the serving stack: quantization level, batch scheduling, speculative decoding, kernel quality, and GPU/interconnect all move tokens/sec substantially. (A) jumps to accusation when infrastructure fully explains it. (C) ignores that identical parameter counts can serve at very different speeds. (D) context-window capability does not by itself halve generation speed.'
    },

    /* ===================== Open models & local ===================== */
    {
      domain: 'Open models & local',
      text: 'You must run a 70B open model on a workstation with a single 24 GB GPU. A colleague enables CPU offload so most layers run on the CPU and reports 0.8 tok/s. What is the correct read?',
      options: [
        'The GPU is broken; replace it',
        'Offloading layers to CPU/system RAM crushes decode speed because those layers stream from far slower memory; either use a smaller/more-quantized model that fits VRAM, add GPU memory, or use a unified-memory Mac',
        'CPU offload always matches GPU speed, so 0.8 tok/s means the model is corrupt',
        '70B models simply cannot run on any consumer hardware'
      ],
      answer: [1],
      explanation: 'When most layers live in system RAM, decode is bottlenecked by CPU memory bandwidth, so single-digit-or-worse tok/s is expected — the fix is to fit the model in fast VRAM (smaller model, heavier quant like Q4, more GPUs) or use a high-bandwidth unified-memory Mac that holds a 70B Q4 wholly in memory. (A) hardware is fine. (C) CPU offload is far slower than GPU, not equal. (D) a 128 GB Mac or dual 3090s can run a 70B Q4.'
    },
    {
      domain: 'Open models & local',
      text: 'At equal memory budget, you can run an 8B at FP16 (~16 GB) or a 70B at Q4 (~40 GB is too big, but conceptually) versus a 70B at Q4 on a bigger box. For a fixed ~16-20 GB budget, which TWO principles guide the choice (as of early 2026)?',
      options: [
        'Above roughly 4 bits, a bigger model at Q4 generally beats a smaller model at higher precision on most tasks',
        'Always pick FP16 regardless of model size — precision beats scale',
        'Below roughly 4 bits (Q2), aggressive quantization lobotomizes a large model, so a cleanly quantized smaller/mid model often wins',
        'Quantization level never affects the quality trade-off, only speed',
        'A 1B model at FP32 always beats any quantized larger model'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'The durable rule is that above ~4 bits scale wins — a 70B at Q4 beats an 8B at FP16 on most tasks at similar memory — but below ~4 bits the large model degrades so much that a clean mid-size Q4/Q5 is better. (B) blanket-preferring FP16 ignores that scale usually matters more than the last bits of precision. (D) denies the well-measured quality/bit trade-off. (E) tiny high-precision models do not beat capable quantized larger ones.'
    },
    {
      domain: 'Open models & local',
      text: 'You validated an on-prem RAG appliance\'s quality with a 70B in the cloud, then shipped on 8B-class hardware. Faithfulness on multi-chunk synthesis dropped noticeably. What was the process error?',
      options: [
        'The embedding model changed between environments',
        'You evaluated on a different (larger) model than you deployed, so the eval never measured the 8B\'s weaker cross-chunk synthesis; always eval on the exact model you will ship',
        '8B models cannot do RAG at all',
        'The vector database was too small'
      ],
      answer: [1],
      explanation: 'Validating with a 70B and deploying an 8B means the eval measured a capability the shipped model does not have — smaller models are weaker at synthesizing across several retrieved chunks — so the regression was invisible until production. The remedy is to evaluate on the exact deployment model and hardware. (A) and (D) are not indicated by the symptom. (C) overstates; 8B does RAG, just with weaker synthesis.'
    },
    {
      domain: 'Open models & local',
      text: 'A regulated client insists on self-hosting for data residency. Your steady workload is ~2M tokens/day of simple classification. Which analysis best frames whether self-hosting an 8B beats a serverless open-model API?',
      options: [
        'Self-hosting is always cheaper because there is no per-token fee',
        'Compute the fully-loaded cost — GPU rental/depreciation, ops, and utilization — against the API bill; at low, bursty volume a serverless open-model API (~$0.10/Mtok for 8B-class) often wins, while high steady utilization favors self-hosting; the residency requirement may still mandate self-hosting regardless of cost',
        'The API is always cheaper, so ignore residency',
        'Only latency matters; cost is irrelevant for classification'
      ],
      answer: [1],
      explanation: 'Self-hosting economics hinge on utilization: an idle rented GPU still costs money, so at low or bursty volume a serverless open-model API around $0.10/Mtok for 8B-class often beats it, while high, steady utilization amortizes the hardware. Here a hard data-residency requirement can override the pure cost comparison and force self-hosting. (A) ignores idle/ops cost. (C) dismisses a binding constraint. (D) cost clearly matters at 2M tokens/day.'
    },
    {
      domain: 'Open models & local',
      text: 'You see a GGUF quant labeled Q4_K_M and are unsure whether to prefer it over Q8_0 or Q2_K for local serving. What is the sound default and reasoning?',
      options: [
        'Always pick Q2_K to save the most memory',
        'Always pick Q8_0 because more bits is always better',
        'Default to Q4_K_M unless you have a specific reason: it is a K-quant near 4 bits that balances quality and memory well, whereas Q8 barely improves quality at double the size and Q2 risks serious degradation',
        'The suffix _K_M means the model is a different architecture'
      ],
      answer: [2],
      explanation: 'Q4_K_M is the widely used sweet spot: a block-wise K-quant around 4 bits that preserves most quality while roughly quartering FP16 memory. Q8 roughly doubles Q4\'s size for marginal quality gain, and Q2 drops below the safe threshold and often degrades badly. (A) chases memory at the cost of quality. (B) treats more bits as free. (D) misreads the quant naming as an architecture change.'
    },
    {
      domain: 'Open models & local',
      text: 'An 8B-Q4 (~5 GB weights) runs fine on an 8 GB card in short chats, but crashes on long-document sessions at 32k context. Which TWO facts explain and resolve this?',
      options: [
        'VRAM must hold weights plus the KV cache, and at 32k context the KV cache can exceed the leftover headroom, causing OOM',
        'The weights grow with context length, so 5 GB becomes 8 GB',
        'Reduce context length, use a smaller/quantized KV cache, or move to a card with more VRAM to create KV headroom',
        'Long context increases the model\'s parameter count until it OOMs',
        'The tokenizer runs out of vocabulary at 32k tokens'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'On an 8 GB card the ~5 GB of weights leaves little room, and the KV cache grows with context length until 32k exhausts VRAM — that is the OOM. Remedies are shrinking context, quantizing/limiting the KV cache, or getting more VRAM. (B) and (D) are false: neither weights nor parameter count grow with context. (E) tokenization is unrelated to VRAM exhaustion.'
    },
    {
      domain: 'Open models & local',
      text: 'A team benchmarks "Llama-70B locally" on a laptop and reports it "unusable" at low tok/s, concluding open models are not viable. What is the flaw in that conclusion?',
      options: [
        'Open models are indeed never viable locally',
        'They ran a model too large for the hardware (heavy CPU offload) and generalized from a sizing mistake; a right-sized model (e.g., an 8B or a Q4 mid-size that fits VRAM) is the fair test',
        'The benchmark should have used a cloud GPU and reported that number as "local"',
        '70B is the only model worth running, so smaller models do not count'
      ],
      answer: [1],
      explanation: 'The conclusion generalizes from a sizing error: a 70B forced to offload onto CPU on a laptop is bandwidth-starved and slow, which says nothing about right-sized local models. Fitting an appropriately quantized model in VRAM (or using unified-memory hardware) is the honest test. (A) contradicts working local deployments. (C) that would not be a local benchmark. (D) task-appropriate smaller models are often the correct choice.'
    },

    /* ===================== Multimodal ===================== */
    {
      domain: 'Multimodal',
      text: 'A document-QA feature sends full-page scans to a vision model and the bill is far higher than expected for "just a few images." What is the most likely mechanism?',
      options: [
        'Images are billed as a flat 100 tokens regardless of size',
        'High-resolution images are tiled and each tile is encoded into many tokens, so a detailed page can cost hundreds to thousands of input tokens — resolution and tiling drive the price',
        'Vision models bill by file size in megabytes, not tokens',
        'Images are free; only the text prompt is billed'
      ],
      answer: [1],
      explanation: 'Vision inputs are converted to tokens, and high-resolution images get split into tiles that each encode to many tokens, so a dense full-page scan can consume hundreds to thousands of input tokens — resolution and detail settings dominate cost. (A) a flat rate ignores tiling. (C) billing is token-based, not raw megabytes. (D) image tokens are very much billed, often the majority of the input cost.'
    },
    {
      domain: 'Multimodal',
      text: 'Your OCR-free pipeline asks a vision model to read a table of figures from a scanned invoice. It gets most numbers right but occasionally transposes or invents a digit in dense cells. What is the correct engineering posture?',
      options: [
        'Vision models read text perfectly; the errors must be in your parser',
        'Treat vision-extracted numbers as probabilistic, not ground truth: add validation (checksums, totals that must reconcile), confidence thresholds, and human review for high-stakes fields',
        'Raise temperature so it reads more carefully',
        'Switch to a larger context window to fix digit errors'
      ],
      answer: [1],
      explanation: 'Vision models estimate text rather than deterministically transcribe it, so dense numeric cells are exactly where they slip — you engineer around it with reconciliation checks (totals, checksums), confidence gating, and human review on critical fields. (A) is dangerously overconfident about vision OCR. (C) higher temperature increases variance, worsening reliability. (D) context window does not address perceptual digit errors.'
    },
    {
      domain: 'Multimodal',
      text: 'For a product-catalog search where users query in text and results are images, a colleague wants one embedding model per modality with a similarity threshold across them. What is the fundamental issue and the right approach?',
      options: [
        'Two separate unimodal models put text and image vectors in incompatible spaces; use a shared multimodal (joint) embedding model so text queries and images live in one comparable space',
        'Cosine similarity is modality-agnostic, so any two models compose fine',
        'Just average the text and image vectors together',
        'Convert every image to a caption and never embed images'
      ],
      answer: [0],
      explanation: 'Cross-modal retrieval requires text and images in the same vector space, which only a jointly trained multimodal embedding model provides; two independent unimodal models produce incomparable coordinates. (B) is the exact misconception — different models are not comparable. (C) averaging incompatible vectors is meaningless. (D) captioning is a valid alternative pipeline but discards visual detail and is not what "compare across modalities" needs when a joint space is available.'
    },
    {
      domain: 'Multimodal',
      text: 'A vision agent confidently describes a "red warning label" in a photo that on inspection has no such label. Which characterization of multimodal hallucination and mitigation is most accurate?',
      options: [
        'Vision models never hallucinate; the label must be there',
        'Language priors can override weak visual evidence, so the model reports plausible-but-absent details; mitigate with grounding prompts ("only describe what is visibly present"), asking for uncertainty, and verification on high-stakes reads',
        'The image resolution being too high causes invented objects',
        'Setting max_tokens lower removes hallucinations'
      ],
      answer: [1],
      explanation: 'Multimodal models blend visual features with strong language priors, so when visual evidence is weak the prior can fill in plausible details that are not in the image — the same fluency/accuracy gap as text, now visual. Grounding instructions, uncertainty prompts, and verification reduce it. (A) denies a documented failure. (C) high resolution generally helps, not hurts. (D) output length does not govern faithfulness.'
    },
    {
      domain: 'Multimodal',
      text: 'You are choosing how to feed 40-page PDFs (mixed text, tables, charts) into an LLM pipeline. Which TWO trade-offs correctly compare "render each page as an image to a vision model" vs "extract text/tables first, then send text"?',
      options: [
        'Vision-on-page preserves layout, charts, and figures that text extraction loses, but costs many image tokens per page',
        'Text extraction is always higher quality and cheaper with no downsides',
        'Text extraction is far cheaper per page and searchable/chunkable, but can mangle complex tables and drops chart/figure content',
        'Rendering pages as images is always cheaper than extracting text',
        'Both approaches cost exactly the same and preserve identical information'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'Sending page images keeps layout, charts, and figures the vision model can read, but each page costs many image tokens; text extraction is cheap, chunkable, and searchable but loses charts and can garble intricate tables. The right choice is document-dependent, often a hybrid. (B) ignores extraction\'s failure on charts/complex tables. (D) image tokens are usually pricier than extracted text. (E) the two differ sharply in cost and fidelity.'
    },
    {
      domain: 'Multimodal',
      text: 'A voice assistant must respond quickly. One design transcribes audio to text (STT) then calls a text LLM then TTS; another uses a native speech-to-speech model. Which statement best captures the trade-off?',
      options: [
        'The STT-LLM-TTS cascade is always better because each stage is specialized',
        'Native speech models can cut latency and preserve tone/prosody by skipping the transcription round-trip, while the cascade is more debuggable, swappable, and lets you log text at each stage — pick per latency and observability needs',
        'Native speech-to-speech models cannot be used in production',
        'Both approaches have identical latency and the choice is arbitrary'
      ],
      answer: [1],
      explanation: 'A native speech pipeline removes an intermediate hop, lowering latency and retaining prosody the text bottleneck discards, whereas the cascade exposes an inspectable text stage at each step and lets you swap components independently — a real latency-versus-observability trade-off. (A) overstates the cascade. (C) native speech models are shipping in production. (D) the approaches differ meaningfully in latency and debuggability.'
    },
    {
      domain: 'Multimodal',
      text: 'Your app lets users upload images, then passes the image plus untrusted user text to a tool-calling vision agent. A security reviewer flags a new risk versus text-only. What is it?',
      options: [
        'Images cannot carry instructions, so there is no new risk',
        'Prompt injection can hide in the image itself (text embedded in the picture the model reads as instructions), expanding the injection surface beyond the text channel — apply the same isolation/least-privilege defenses to image-derived content',
        'The only risk is larger token bills',
        'Images automatically sanitize any malicious text'
      ],
      answer: [1],
      explanation: 'A vision model reads text rendered inside an image, so an attacker can embed injected instructions in the picture — a channel text-only defenses miss — meaning image-derived content is untrusted and needs the same isolation, labeling, and least-privilege tool constraints. (A) and (D) are false: images are an injection vector, not a sanitizer. (C) cost is a concern but not the security risk being flagged.'
    },

    /* ===================== Cost & latency ===================== */
    {
      domain: 'Cost & latency',
      text: 'A feature routes every request to your most capable (and expensive) model. Analysis shows 80% of traffic is trivial classification. What is the highest-leverage cost move, and its guardrail?',
      options: [
        'Raise the temperature to reduce token usage',
        'Model routing/cascade: send easy requests to a cheap small model and escalate only hard/low-confidence cases to the expensive model — guard it with an eval so routing does not silently drop quality',
        'Always use the biggest model; routing never saves money',
        'Truncate all prompts to 50 tokens'
      ],
      answer: [1],
      explanation: 'When most traffic is easy, routing it to a small cheap model and reserving the frontier model for hard or low-confidence cases captures large savings; the guardrail is an eval that confirms the cheap tier meets quality so the cascade does not quietly regress. (A) temperature does not reduce token count meaningfully. (C) denies the whole point of cascades. (D) blanket truncation breaks tasks to cut cost.'
    },
    {
      domain: 'Cost & latency',
      text: 'A high-traffic assistant resends an identical 3,000-token system prompt and tool schema on every call. Which TWO changes cut input cost the most without changing behavior?',
      options: [
        'Enable prompt caching and keep the stable instructions/tool schema as an identical leading prefix so cached tokens are billed at a steep discount',
        'Lower temperature to reduce input token pricing',
        'Move the volatile user query to the end so the cacheable prefix stays byte-identical across requests',
        'Fine-tune the model on the system prompt so you never send it',
        'Stream the response, which makes input tokens free'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'Prompt caching discounts repeated prefix tokens heavily, but only if the cached span is a byte-identical prefix, so leading with the stable instructions/schema and trailing the volatile query maximizes hits. (B) temperature does not affect input pricing. (D) fine-tuning is a heavy, unreliable substitute for a clean caching win. (E) streaming changes delivery, not token billing.'
    },
    {
      domain: 'Cost & latency',
      text: 'You must classify 5M archived documents by tomorrow morning; per-item latency is irrelevant but cost matters. Which provider capability fits best?',
      options: [
        'Real-time streaming endpoint, one document per call',
        'An asynchronous batch API: submit the whole job offline for a large per-token discount (commonly ~50%) with a longer turnaround SLA',
        'A 1M-token context window to fit all 5M documents in one call',
        'Function calling on each document for structure'
      ],
      answer: [1],
      explanation: 'Latency-insensitive bulk work is the ideal case for a batch API, which trades turnaround time for roughly a 50% discount. (A) per-item synchronous calls maximize overhead and cost. (C) no context window fits 5M documents, and it would be astronomically expensive if it could. (D) function calling adds complexity irrelevant to straight classification.'
    },
    {
      domain: 'Cost & latency',
      text: 'Users complain the chat "feels slow" even though total generation time is fine. The UI waits for the full completion before rendering. What changes perceived latency without changing total time?',
      options: [
        'Lower max_tokens to 1',
        'Stream tokens as they are decoded so the user sees output within the first fraction of a second — this improves time-to-first-token and perceived speed while total tokens/sec is unchanged',
        'Increase the model size for faster tokens',
        'Cache the full response before showing anything'
      ],
      answer: [1],
      explanation: 'Streaming renders partial output as it is generated, so perceived latency (dominated by time-to-first-token) drops even though total generation time is identical. (A) returns an almost-empty answer. (C) a bigger model is usually slower, not faster. (D) buffering the whole response is exactly what causes the spinner.'
    },
    {
      domain: 'Cost & latency',
      text: 'Your p50 latency is good but p99 is terrible, dominated by a few very long generations. Which combination best tames the tail without hurting typical requests?',
      options: [
        'Set every request to the maximum output length',
        'Cap max_tokens to a sensible task-specific bound, stream so long ones are not perceived as a stall, and consider a faster/smaller model or timeout+fallback for the tail',
        'Remove all timeouts so long requests always finish',
        'Route all traffic to the largest model for consistency'
      ],
      answer: [1],
      explanation: 'Tail latency from runaway-length outputs is bounded by capping max_tokens per task, softened by streaming, and backstopped with a timeout plus fallback or a faster model for the slow tail — all while leaving typical requests untouched. (A) maximizing output length worsens the tail. (C) removing timeouts lets the tail run unbounded. (D) the largest model tends to be slower, aggravating p99.'
    },
    {
      domain: 'Cost & latency',
      text: 'A finance summarizer processes 20,000 docs of ~4,000 English words each. Which input-token estimate is the best planning basis, and why?',
      options: [
        'Exactly 4,000 tokens per doc (one word equals one token)',
        'About 5,300 tokens per doc, since English runs ~1.3 tokens per word (~0.75 words/token); roughly 106M input tokens across the corpus',
        '400 tokens per doc (tokens are always 10x fewer than words)',
        'Unknowable in advance, so cost cannot be estimated'
      ],
      answer: [1],
      explanation: 'English averages about 1.3 tokens per word, so 4,000 words is roughly 5,300 tokens and 20,000 docs is about 106M input tokens — a usable planning number, and provider tokenizer libraries let you count exactly offline before spending. (A) conflates words and tokens 1:1, understating cost. (C) inverts the ratio. (D) is defeatist when precise offline counting exists.'
    },
    {
      domain: 'Cost & latency',
      text: 'A RAG endpoint stuffs the top 30 retrieved chunks into every prompt "for completeness," and both cost and latency are high. Which TWO token-dieting moves cut cost while often improving quality?',
      options: [
        'Rerank and pass only the top 3-5 highest-precision chunks, trimming distractors',
        'Always increase to the top 50 chunks so nothing is missed',
        'Compress/summarize retrieved passages or drop low-score chunks below a relevance cutoff',
        'Raise temperature to compensate for fewer chunks',
        'Send the entire source corpus every request to be safe'
      ],
      answer: [0, 2],
      multi: true,
      explanation: 'Reranking to a tight high-precision set and compressing or cutting low-relevance chunks reduces input tokens and simultaneously lifts quality by removing distractors and lost-in-the-middle risk. (B) and (E) inflate tokens and add noise, the opposite of the goal. (D) temperature does not address token cost and adds variance.'
    },
    {
      domain: 'Cost & latency',
      text: 'A product manager wants an SLA promising a fixed end-to-end latency for an agent that may call 1-6 tools per request. What is the sound way to frame the target?',
      options: [
        'Promise a single fixed latency; agent runs are always constant time',
        'Model latency as a distribution driven by variable tool-call depth and generation length; commit to percentile targets (p50/p95) with a hard timeout and a fallback, not a single fixed number',
        'Latency is unpredictable, so refuse to give any target',
        'Set the SLA to the fastest observed run so it looks good'
      ],
      answer: [1],
      explanation: 'Agent latency varies with how many tool calls and tokens a request needs, so the honest commitment is percentile targets (p50/p95) plus a hard timeout and fallback behavior, not a single constant. (A) ignores the variable-depth reality. (C) overcorrects into no commitment when percentiles are exactly the tool for this. (D) advertising the best case sets up constant SLA breaches.'
    },

    /* ===================== Production patterns ===================== */
    {
      domain: 'Production patterns',
      text: 'Your only model provider has a regional outage and your assistant is down. What is the standard resilience pattern, and its main complication?',
      options: [
        'Retry the same provider forever; outages always end quickly',
        'Multi-provider failover to an alternate model, accepting that prompts and output behavior differ across models so you need provider-specific prompt handling and an eval on the fallback',
        'Cache one canned response and serve it to everyone during outages',
        'Nothing can be done; a single provider is unavoidable'
      ],
      answer: [1],
      explanation: 'Failing over to an alternate provider/model keeps you up, but the complication is that different models respond to prompts differently, so you need per-provider prompt adjustments and to have eval\'d the fallback so quality does not crater silently. (A) offers no availability during a sustained outage. (C) a single canned reply is not a functioning assistant. (D) multi-provider abstraction is a well-established pattern.'
    },
    {
      domain: 'Production patterns',
      text: 'You are rolling out a new prompt template to a live assistant. Which TWO practices most reduce the risk of a silent quality regression?',
      options: [
        'Deploy to 100% immediately; fast iteration beats caution',
        'Canary/guarded rollout to a small traffic slice with monitoring before ramping to all users',
        'Run the new template against your regression eval suite and compare online metrics (feedback, deflection) on the canary before full rollout',
        'Delete the old template so you cannot roll back',
        'Skip evals since the change is "just a prompt"'
      ],
      answer: [1, 2],
      multi: true,
      explanation: 'A canary on a small slice plus an offline regression eval and online-metric comparison catches regressions before they hit everyone and preserves a rollback path. (A) full immediate deploy maximizes blast radius. (D) removing the old template destroys your safety net. (E) "just a prompt" changes are exactly the ones that silently regress, so evals still apply.'
    },
    {
      domain: 'Production patterns',
      text: 'A provider ships a new checkpoint behind the same model alias you use in production, and your prompts implicitly depend on the old behavior. What is the safe operational practice?',
      options: [
        'Auto-upgrade in production immediately; newer is always better',
        'Pin the model version where offered, run your regression eval against the new checkpoint, and promote only after it passes — silent SFT/preference changes can break prompt assumptions',
        'Assume behavior never changes across checkpoints',
        'Delete your evals to move faster'
      ],
      answer: [1],
      explanation: 'New checkpoints carry different post-training, so pinning the version and gating promotion behind a regression eval catches silent behavior shifts before users do. (A) auto-upgrading invites unpredictable regressions. (C) contradicts the reality that model updates are behavior changes. (D) removing evals discards the only mechanism that would catch the drift.'
    },
    {
      domain: 'Production patterns',
      text: 'An abusive user scripts thousands of expensive long-generation requests, spiking your bill. Which layered defenses are the right response (choose the best single answer)?',
      options: [
        'Raise the model temperature to slow them down',
        'Per-user rate limiting and quotas, max_tokens/cost caps per request, anomaly detection on spend, and authentication — defense in depth against abuse and runaway cost',
        'Trust all traffic; abuse cannot be prevented',
        'Increase the context window so requests finish faster'
      ],
      answer: [1],
      explanation: 'Cost-driven abuse is contained by layering per-user rate limits and quotas, per-request token/cost caps, spend anomaly alerts, and authentication so a single actor cannot run up the bill. (A) temperature is irrelevant to abuse. (C) is fatalistic when standard controls exist. (D) a bigger context window does not stop abusive volume and can raise cost.'
    },
    {
      domain: 'Production patterns',
      text: 'Your synchronous API sometimes exceeds its 30s HTTP timeout on long agent runs, dropping connections mid-task. Which TWO approaches make this robust?',
      options: [
        'Retry the whole request on timeout with no other change',
        'Move long-running work to an async job/queue: accept the request, return a job id, and let the client poll or receive a webhook on completion',
        'Truncate every prompt to 50 tokens regardless of task',
        'Stream partial results so bytes flow before any single-shot timeout trips, and align client/server timeouts with realistic run duration',
        'Set temperature to 0 to make generation instantaneous'
      ],
      answer: [1, 3],
      multi: true,
      explanation: 'For work that can exceed an HTTP timeout, an async job/queue with polling or webhooks decouples completion from the request, and streaming plus realistic timeouts keeps interactive paths alive. (A) blind retries double cost and can time out again. (C) hard-truncating all prompts breaks the task to fix a timeout. (E) temperature 0 does not change generation speed.'
    },
    {
      domain: 'Production patterns',
      text: 'In a multi-tenant SaaS, one tenant\'s prompt-injected document tries to make the shared agent read another tenant\'s data. Which design principle most directly prevents cross-tenant leakage?',
      options: [
        'Trust the model to keep tenants separate based on instructions',
        'Enforce tenant isolation in the data/tool layer — scope every retrieval and tool call to the authenticated tenant\'s resources — so the model physically cannot access another tenant\'s data regardless of what a prompt says',
        'Put "do not leak other tenants\' data" in the system prompt and consider it solved',
        'Use one shared vector index for all tenants to simplify ops'
      ],
      answer: [1],
      explanation: 'Isolation must live in the infrastructure: scoping retrieval and tool access to the authenticated tenant makes cross-tenant access impossible no matter what an injected prompt requests. (A) and (C) rely on the model honoring instructions, which prompt injection defeats. (D) a shared unscoped index is the very thing that enables leakage. Security boundaries belong outside the token stream.'
    },
    {
      domain: 'Production patterns',
      text: 'Users report intermittent bad answers you cannot reproduce. Which observability foundation most directly enables root-cause analysis of an LLM feature?',
      options: [
        'Log only the final answer text',
        'Capture end-to-end traces per request: assembled prompt, retrieved chunks, tool calls/results, model id and version, token counts, latency, and raw output, so you can replay and localize the failure',
        'Track only aggregate uptime',
        'Log nothing to protect privacy and rely on guesswork'
      ],
      answer: [1],
      explanation: 'Structured per-request tracing of the full pipeline — prompt, retrievals, tool I/O, model version, tokens, latency, output — lets you replay a failing request and pinpoint the failing stage. (A) hides the cause behind the final text. (C) uptime says nothing about answer quality. (D) logging nothing makes diagnosis impossible; handle PII with redaction, not blindness.'
    },

    /* ===================== AI system design ===================== */
    {
      domain: 'AI system design',
      text: 'In a design interview you are asked to build a support assistant over a knowledge base that changes weekly and must cite sources. What is the correct high-level architecture and the key reason?',
      options: [
        'Fine-tune a model weekly on the knowledge base so it "knows" the docs',
        'RAG: retrieve relevant passages with stable ids at query time and have the model answer from and cite them, because the corpus is fresh, changing, and requires auditable provenance',
        'Dump the entire knowledge base into every prompt using a large context window',
        'Cache a fixed FAQ and serve it to all users'
      ],
      answer: [1],
      explanation: 'Fresh, changing, citation-bearing knowledge is the textbook case for RAG: retrieval updates instantly by writing to the index and yields verifiable passage ids for citations. (A) weekly fine-tuning is slow, costly, and poor at exact recall and provenance. (C) stuffing the whole base wastes tokens and degrades retrieval via lost-in-the-middle. (D) a static FAQ cannot cover the full, evolving knowledge base.'
    },
    {
      domain: 'AI system design',
      text: 'Given a new AI feature request, which design method best generates a sound architecture (choose the best single answer)?',
      options: [
        'Pick the trendiest framework first, then fit the problem to it',
        'Start from requirements — task type, freshness, accuracy/latency/cost budgets, and failure tolerance — then choose techniques (prompt, RAG, tools, fine-tune) that satisfy them, and design evals and guardrails alongside',
        'Always use the largest model and an agent for every feature',
        'Copy a reference architecture verbatim without checking fit'
      ],
      answer: [1],
      explanation: 'Good system design is requirements-first: the task, freshness needs, quality/latency/cost budgets, and tolerance for failure determine whether you need prompting, retrieval, tools, or fine-tuning, with evals and guardrails designed in from the start. (A) and (D) let tooling or templates drive instead of requirements. (C) over-engineers with the biggest model and an agent where a simpler design would serve.'
    },
    {
      domain: 'AI system design',
      text: 'A coding-assistant design must handle a large repository that exceeds any context window. Which TWO architectural choices are most appropriate?',
      options: [
        'Load the entire repository into the prompt every request',
        'Index the codebase for retrieval (embeddings plus symbol/keyword search) and fetch only relevant files/snippets per task',
        'Give the assistant tools to navigate the repo on demand (search, read file, list references) rather than pre-loading everything',
        'Fine-tune a model on the repository nightly and never retrieve',
        'Truncate the repository to its first file and ignore the rest'
      ],
      answer: [1, 2],
      multi: true,
      explanation: 'A repo larger than the context window calls for retrieval over an index plus agentic navigation tools so the assistant pulls only the relevant files per task instead of loading everything. (A) and (E) are impossible or lossy given the size limit. (D) nightly fine-tuning is stale for fast-changing code and poor at exact recall, and it forgoes the precise, on-demand access retrieval and tools provide.'
    },
    {
      domain: 'AI system design',
      text: 'For a research agent that browses the web and synthesizes a report, a stakeholder worries it will loop forever or wander. Which design controls best bound it (choose the best single answer)?',
      options: [
        'Remove the stop condition so it keeps improving the report',
        'Explicit step/iteration caps, a per-run token/cost budget, a clear task-completion definition, and checkpoints/human review for long runs',
        'Set temperature to 0 so it always terminates',
        'Give it every possible tool so it never gets stuck'
      ],
      answer: [1],
      explanation: 'Open-ended agents are bounded with hard step caps, token/cost budgets, an explicit completion definition, and human checkpoints on long runs — the standard circuit breakers. (A) removing the stop condition guarantees runaway behavior. (C) temperature 0 does not prevent a deterministic loop from looping. (D) more tools can increase thrash and cost rather than ensure termination.'
    },
    {
      domain: 'AI system design',
      text: 'A document-processing pipeline must extract structured fields from 200k contracts with high accuracy and auditability. Which end-to-end design is soundest?',
      options: [
        'One giant prompt per contract asking for everything, trusting the JSON',
        'Chunk/parse the document, use constrained/structured outputs for the schema, validate business rules after parsing with a repair loop, run a batch API for cost, and sample outputs for human QA with full tracing',
        'Fine-tune a model to memorize all 200k contracts',
        'Extract with regex only and skip the model'
      ],
      answer: [1],
      explanation: 'A robust extraction pipeline combines parsing, schema-constrained decoding, post-parse business-rule validation with a repair loop, a batch API for cost at scale, and sampled human QA with tracing for auditability. (A) trusting raw JSON ignores semantic-validity failures. (C) memorizing 200k contracts is the wrong tool and unauditable. (D) regex alone cannot handle contract-language variability.'
    },
    {
      domain: 'AI system design',
      text: 'You are asked to add "memory" so the assistant recalls user preferences across sessions. What is the correct architectural understanding?',
      options: [
        'The model stores conversation state internally between API calls once you pass a session id',
        'Memory is an application feature: you persist facts/preferences in your own store and re-inject the relevant ones into the context each session; inference itself is stateless',
        'You must fine-tune the model nightly on each user\'s conversations',
        'Setting temperature to 0 makes the model remember prior sessions'
      ],
      answer: [1],
      explanation: 'LLM inference is stateless, so cross-session memory means your application saves facts/preferences and retrieves the relevant ones into the context window each time — server-side conversation storage is a convenience layer, not model learning. (A) misattributes persistence to the model. (C) per-user nightly fine-tuning is wildly impractical and poor at exact recall. (D) temperature governs sampling, not persistence.'
    },
    {
      domain: 'AI system design',
      text: 'A greenfield feature could be shipped as a single well-prompted model call or a multi-step agent with tools. Which principle should decide, and what is the bias?',
      options: [
        'Always build the agent; agents are strictly more capable',
        'Prefer the simplest design that meets requirements — a single call or fixed pipeline if the task is well-scoped — and add agentic autonomy only when the task genuinely needs dynamic, multi-step tool use, since agents add cost, latency, and failure modes',
        'Always use a single call; agents never work in production',
        'Flip a coin; the two are equivalent in practice'
      ],
      answer: [1],
      explanation: 'The sound bias is toward the simplest architecture that satisfies the requirements, escalating to an agent only when the task truly needs dynamic multi-step tool use, because autonomy brings extra cost, latency, and new failure modes. (A) over-engineers by default. (C) dismisses agents that do work when warranted. (D) ignores the real trade-offs that distinguish the two.'
    },

    /* ===================== Frontier & reasoning ===================== */
    {
      domain: 'Frontier & reasoning',
      text: 'For a hard multi-step math/logic task, a reasoning model that emits a long internal chain-of-thought outperforms a standard model. Given that compute per token is fixed, why does this work?',
      options: [
        'Reasoning models have a separate hidden "thinking engine" that standard models lack',
        'Emitting more intermediate tokens gives the model more forward passes to condition on, effectively spending more test-time compute on the problem before committing to an answer',
        'They run at a lower temperature, which makes them smarter',
        'They have larger vocabularies that encode answers directly'
      ],
      answer: [1],
      explanation: 'Since per-token compute is constant, the only way a model "thinks harder" is to produce more intermediate tokens, and reasoning models are trained to spend that test-time compute on structured intermediate steps before answering. (A) there is no separate engine — it is the same autoregressive loop with more tokens. (C) temperature controls variance, not capability. (D) vocabulary size does not store solved answers.'
    },
    {
      domain: 'Frontier & reasoning',
      text: 'A team routes ALL traffic, including trivial lookups and formatting, to an expensive reasoning model "to be safe." What is the strongest critique?',
      options: [
        'Reasoning models are always the correct default for every task',
        'Reasoning models cost far more tokens and latency for their long chains, so using them on easy tasks wastes money and slows responses with no quality gain — reserve them for genuinely hard multi-step problems',
        'Reasoning models cannot do simple tasks at all',
        'Trivial tasks require even more reasoning tokens than hard ones'
      ],
      answer: [1],
      explanation: 'Reasoning models burn many extra tokens and add latency for their chains, which is wasteful on trivial tasks that a cheap standard model handles equally well — match the model tier to task difficulty. (A) is the misconception being corrected. (C) they can do simple tasks, just expensively. (D) reverses reality — trivial tasks need little to no extended reasoning.'
    },
    {
      domain: 'Frontier & reasoning',
      text: 'You want to expose a reasoning model\'s chain-of-thought to end users as a transparent "explanation of its decision." What caution applies?',
      options: [
        'The chain-of-thought is a faithful, auditable trace of the true computation',
        'The visible reasoning is generated text that improves answers but is not guaranteed to be a faithful account of the internal computation; do not treat it as a verified audit trail, and be aware some providers restrict raw CoT exposure',
        'Chain-of-thought is always exactly correct if temperature is 0',
        'Showing reasoning eliminates hallucination entirely'
      ],
      answer: [1],
      explanation: 'Chain-of-thought reliably boosts performance, but it is sampled text and can diverge from the model\'s actual internal computation, so it is not a trustworthy audit trail, and some providers limit access to raw reasoning tokens. (A) overstates faithfulness. (C) temperature 0 makes the reasoning deterministic, not verified. (D) visible reasoning reduces some errors but does not eliminate hallucination.'
    },
    {
      domain: 'Frontier & reasoning',
      text: 'Which TWO claims about multi-agent "swarm" systems reflect the durable engineering reality rather than hype (as of early 2026)?',
      options: [
        'Adding more agents always improves results monotonically',
        'Multi-agent designs add coordination overhead, more failure surface, and higher cost/latency, so they are justified only when subtasks genuinely benefit from parallel specialization',
        'A single well-designed agent or pipeline often matches or beats a complex swarm on many tasks, so complexity must earn its keep',
        'Multi-agent systems remove the need for evals and guardrails',
        'Swarms eliminate hallucination because agents check each other perfectly'
      ],
      answer: [1, 2],
      multi: true,
      explanation: 'Multi-agent systems bring real coordination overhead, extra failure modes, and cost/latency, so they pay off only when subtasks truly benefit from parallel specialization — and a single solid agent or pipeline frequently matches them. (A) more agents can add noise and cost, not guaranteed gains. (D) evals/guardrails matter more, not less. (E) agents do not perfectly cross-check, so hallucination persists.'
    },
    {
      domain: 'Frontier & reasoning',
      text: 'A leader wants to bet the architecture on a specific model provider\'s current ranking on a public leaderboard. What is the durable-principles caution?',
      options: [
        'The top leaderboard model today will remain best indefinitely; lock in',
        'Rankings churn month to month and benchmarks can be gamed or contaminated; design provider-agnostic abstractions and evaluate on your own task so you can swap models as the frontier shifts',
        'Public leaderboards measure your specific production task directly',
        'Model choice never matters, so pick randomly'
      ],
      answer: [1],
      explanation: 'Leaderboard positions change constantly and public benchmarks can be gamed or contaminated, so the durable move is a provider-agnostic abstraction plus evaluation on your own workload, letting you switch as the frontier moves. (A) assumes a stable ranking that history contradicts. (C) generic benchmarks do not measure your task. (D) model choice does matter — it just should not be locked to a transient ranking.'
    },
    {
      domain: 'Frontier & reasoning',
      text: 'On-device/small-model inference is improving fast. For a mobile feature doing simple intent classification with privacy needs, which reasoning is soundest?',
      options: [
        'Only a frontier cloud model can ever do intent classification',
        'A small on-device model can handle simple, well-scoped tasks with low latency and strong privacy (data never leaves the device), while hard or open-ended requests can still escalate to the cloud — size the model to the task',
        'On-device models are useless because they are not the largest available',
        'Privacy is irrelevant since all inference is equally private'
      ],
      answer: [1],
      explanation: 'A small on-device model is well matched to simple, scoped tasks like intent classification, giving low latency and keeping data on the device, with escalation to the cloud reserved for hard cases — size to the task rather than defaulting to the biggest model. (A) and (C) reflexively demand the largest model. (D) cloud inference sends data off-device, so privacy differs materially.'
    },
    {
      domain: 'Frontier & reasoning',
      text: 'Amid rapid model releases, how should you separate durable skills from churn when planning your team\'s AI-engineering investments?',
      options: [
        'Rewrite the whole stack for every new model release',
        'Invest in durable fundamentals — evals, retrieval, context engineering, tool/agent design, cost/latency discipline, and safety — which outlast specific models, while keeping model choice swappable behind an abstraction',
        'Ignore new models entirely; nothing changes',
        'Bet everything on one specific model version and never revisit'
      ],
      answer: [1],
      explanation: 'The durable investments are the disciplines that persist across model generations — evaluation, retrieval, context engineering, agent/tool design, cost/latency control, and safety — while the specific model stays a swappable component behind an abstraction. (A) chasing every release wastes effort. (C) ignores real capability jumps. (D) locking to one version forgoes genuine improvements and creates lock-in.'
    },

    /* ===================== Interview & career ===================== */
    {
      domain: 'Interview & career',
      text: 'In an AI-engineering system-design round, you are asked to design a RAG chatbot. You immediately start naming vector databases. What does a strong candidate do first instead?',
      options: [
        'Pick the trendiest vector DB and defend it at length',
        'Clarify requirements and constraints first — data freshness, scale, latency/cost budgets, accuracy needs, citations — then derive the architecture and name where evals and guardrails go',
        'Write production code on the whiteboard immediately',
        'State that RAG is obsolete and pivot to fine-tuning'
      ],
      answer: [1],
      explanation: 'Interviewers reward requirements-first thinking: clarifying freshness, scale, latency/cost, accuracy, and citation needs before choosing components, and calling out where evaluation and guardrails fit. (A) jumping to a specific database signals tool-first, not problem-first, reasoning. (C) premature code skips the design the round is testing. (D) dismissing RAG here is a wrong technical call for a fresh, citation-bearing corpus.'
    },
    {
      domain: 'Interview & career',
      text: 'Asked "how would you evaluate this LLM feature?" which TWO elements make the strongest answer?',
      options: [
        'Rely on a generic public benchmark score and stop there',
        'Build an eval set from the real production distribution including edge cases, adversarial inputs, and past failures',
        'Combine offline evals with online signals (user feedback, A/B tests, production sampling), and use LLM-as-judge with a rubric calibrated against human labels',
        'Say "it looks good in the demo" as the primary evidence',
        'Test only on questions the model already answers correctly'
      ],
      answer: [1, 2],
      multi: true,
      explanation: 'A strong evaluation answer builds the set from the real production distribution (with edge and adversarial cases and known failures) and pairs offline evals with online signals plus a rubric-driven, human-calibrated LLM judge. (A) generic benchmarks measure pretraining coverage, not your system. (D) demo vibes are not evidence. (E) excluding failures produces a self-congratulatory, useless eval.'
    },
    {
      domain: 'Interview & career',
      text: 'An interviewer asks "why can\'t you just fine-tune the model to stop hallucinating?" What is the strongest answer?',
      options: [
        'Hallucination is a bug that a large enough fine-tune fully removes',
        'Hallucination is architectural: the model is trained to produce plausible continuations and truth is only correlated with plausibility, so mitigations (grounding/RAG, abstention training, verification) move probability mass but do not eliminate it',
        'Set temperature to 0 and hallucination disappears',
        'Only base models hallucinate; chat models never do'
      ],
      answer: [1],
      explanation: 'The strong answer names the root cause: plausible-continuation training decouples fluency from truth, so hallucination is a structural property that grounding, abstention training, and verification reduce but cannot fully remove. (A) overstates fine-tuning. (C) temperature 0 makes a hallucination deterministic, not absent. (D) chat models hallucinate too; alignment shifts probabilities, it does not install a truth oracle.'
    },
    {
      domain: 'Interview & career',
      text: 'In a coding round you must implement a tool-using agent loop. Which description should your implementation follow?',
      options: [
        'The model returns a final answer in one shot; tools are never revisited',
        'Loop: model reasons and may emit tool call(s) with arguments; your runtime executes them; append results to the message list; call the model again; repeat until a final answer or a step/cost cap stops it',
        'Your runtime picks the tools and the model only formats output',
        'Run all tools first, then let the model reason once about everything'
      ],
      answer: [1],
      explanation: 'The correct agent loop interleaves model reasoning, tool selection with arguments, runtime execution, appending results to context, and re-invoking the model, iterating until a final answer or a guardrail cap halts it. (A) describes a non-agentic single call. (C) inverts control — the model decides tool calls, the runtime executes. (D) reverses the reason-then-act ordering.'
    },
    {
      domain: 'Interview & career',
      text: 'A take-home asks you to cut the cost of an existing LLM feature by 50% without hurting quality. Which approach demonstrates the best engineering judgment?',
      options: [
        'Immediately switch to the cheapest model and hope quality holds',
        'Profile where tokens/cost actually go, then apply targeted levers (prompt caching, model routing/cascade, token dieting/reranking, batch API for offline work) each gated by an eval to protect quality',
        'Truncate all prompts and outputs aggressively across the board',
        'Fine-tune a smaller model as the first and only step'
      ],
      answer: [1],
      explanation: 'The judgment interviewers want is measure-then-optimize: profile the cost drivers and apply targeted levers — caching, routing/cascades, token dieting/reranking, batch APIs — each validated by an eval so quality is protected. (A) and (C) are blind cuts that risk silent quality loss. (D) fine-tuning is a heavy first move before cheaper, lower-risk levers are even measured.'
    },
    {
      domain: 'Interview & career',
      text: 'A hiring manager asks how you keep up given how fast models change. Which answer best signals durable seniority?',
      options: [
        'I memorize each new model\'s benchmark scores as they release',
        'I invest in fundamentals that outlast specific models — evals, retrieval, context engineering, agent design, cost/latency, safety — and keep model choice swappable, adopting new models through my own eval on my task',
        'I rewrite my stack for every release to stay current',
        'I ignore new releases because fundamentals never change'
      ],
      answer: [1],
      explanation: 'Seniority shows in prioritizing durable fundamentals and treating models as swappable behind an abstraction, adopting new ones only after they pass your own task eval. (A) memorizing benchmarks is shallow and perishable. (C) constant rewrites signal churn-chasing, not judgment. (D) ignoring releases forgoes real capability gains — the point is to evaluate them, not dismiss them.'
    },
    {
      domain: 'Interview & career',
      text: 'You are asked to give an honest read on scoping an AI feature under a tight deadline. Which answer reflects mature engineering?',
      options: [
        'Promise a fully autonomous agent for everything by the deadline',
        'Ship the simplest design that meets the core requirement (often a well-prompted call or a constrained pipeline with evals and guardrails), prove it with metrics, and expand scope only as evidence and time allow',
        'Skip evals and guardrails to hit the date',
        'Use the largest, most expensive model everywhere so nothing is under-powered'
      ],
      answer: [1],
      explanation: 'Mature scoping ships the simplest design that meets the core requirement, backs it with evals and guardrails, proves it with metrics, and expands only as evidence and time permit. (A) over-promises autonomy under deadline pressure. (C) dropping evals/guardrails trades a demo for production risk. (D) defaulting to the biggest model everywhere wastes cost and latency without proven need.'
    }

  ]
});
