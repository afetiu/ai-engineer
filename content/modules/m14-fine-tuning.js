COURSE.register({
  id: 'm14-fine-tuning',
  track: 'advanced',
  order: 14,
  title: 'Fine-tuning & adaptation',
  short: 'Fine-tuning',
  tagline: 'When to change the weights, when to change the prompt — LoRA math, DPO mechanics, and the data discipline that decides whether your fine-tune ships or embarrasses you.',
  minutes: 120,
  lessons: [
    {
      id: 'when-not-to',
      title: 'The decision tree: when NOT to fine-tune',
      blurb: 'Most fine-tuning projects should have been a prompt. The escalation ladder, the knowledge-injection trap, and the maintenance tail.',
      html: '<h2>The escalation ladder</h2>' +
        '<p>Fine-tuning is the most seductive tool in AI engineering and the most frequently misapplied. The correct order of escalation is boring and almost never wrong: <b>prompting → few-shot examples → RAG → fine-tuning</b>. Each rung is cheaper, faster to iterate, and easier to undo than the next. You climb only when you have <em>measured</em> the current rung failing — not when a stakeholder says "we should train our own model."</p>' +
        '<ul>' +
        '<li><b>Prompting</b> fixes style, format, persona, and task framing. Iteration time: seconds. If you have not spent at least a day on serious prompt engineering with an eval set, you have no evidence fine-tuning is needed.</li>' +
        '<li><b>Few-shot examples</b> fix output-shape conformance and edge-case handling. In-context learning is a real capability (module 1): 5–20 curated examples in the prompt often buy what people expect from a fine-tune, at zero training cost. The price is per-request tokens — which prompt caching largely neutralizes.</li>' +
        '<li><b>RAG</b> fixes missing or changing <em>knowledge</em>. Facts live in an index you can update in seconds, audit line-by-line, and delete for compliance.</li>' +
        '<li><b>Fine-tuning</b> fixes <em>behavior</em>: consistent tone across thousands of outputs, strict adherence to a house format, a task the model does clumsily even with examples, latency/cost (a tuned 8B replacing a frontier model), or a genuinely new skill in a narrow domain.</li>' +
        '</ul>' +
        '<div class="callout note"><span class="co-title">Key idea</span> Fine-tuning changes <b>how</b> the model behaves; retrieval changes <b>what it knows</b> at request time. Teams that keep this one sentence on the wall skip six-figure mistakes.</div>' +
        '<h2>The knowledge-injection trap</h2>' +
        '<p>The most common failed fine-tune, by a wide margin: "let\'s fine-tune the model on our docs so it knows our product." It fails for mechanical reasons. SFT gradient updates on a few thousand documents nudge weights that encode trillions of tokens of pretraining; facts partially stick, interfere with neighboring facts, and the model happily interpolates across the seams — you get a model that is <em>confidently wrong about your own product</em>, which is worse than one that knows nothing. And the facts you burned in are stale the day your docs change, with no way to update short of retraining, and no way to audit which "fact" the model used.</p>' +
        '<p>Compare the RAG version of the same requirement: exact text in context, updated by writing to an index, per-answer citations, per-tenant access control. Fine-tuning has no answer to any of that. The legitimate knowledge-adjacent use of fine-tuning is <em>vocabulary and fluency</em> — teaching a model your domain\'s jargon, entity formats, and reasoning patterns so it uses retrieved context better — not fact storage.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A fintech team fine-tuned an 8B model on 40k internal wiki pages to "internalize" policy. Eval on paraphrased policy questions: 61% accuracy, with fluent fabrications on the misses — and three months later a policy change forced a full retrain. The RAG baseline they skipped scored 89% on day one and absorbed the policy change by re-indexing one directory. The fine-tune was deleted; the war story survives.</div>' +
        '<h2>The maintenance tail</h2>' +
        '<p>A prompt is a config change. A fine-tune is a <b>production ML system</b>: dataset versioning, training pipeline, eval harness, regression suite, GPU budget, and an owner. Count the tail before you start:</p>' +
        '<ul>' +
        '<li><b>Base-model churn.</b> As of early 2026, open-model generations turn over every 6–12 months. Your adapter is welded to one base checkpoint; when Llama-N+1 or Qwen-N+1 lands and beats your tuned model out of the box (it happens constantly), you re-run the whole pipeline or fall behind.</li>' +
        '<li><b>Every behavior change is a training run.</b> Want the tone 10% warmer? That\'s a data edit, a run, and a regression eval — days, not minutes.</li>' +
        '<li><b>Drift.</b> Your traffic distribution shifts; the frozen fine-tune doesn\'t. Without ongoing evals you won\'t notice until users do.</li>' +
        '<li><b>API fine-tunes add vendor coupling:</b> a hosted tuned model can be deprecated on the provider\'s schedule, not yours, and usually costs more per token than the base model.</li>' +
        '</ul>' +
        '<h2>When fine-tuning genuinely wins</h2>' +
        '<p>None of this means "never." The strong cases, all assuming you have an eval set first: <b>(1) cost/latency compression</b> — distilling a frontier model\'s behavior on your narrow task into an 8B you serve for 1/20th the price at 3× the speed; <b>(2) format/behavior consistency at scale</b> — 100k daily outputs that must all follow a house style no prompt reliably holds; <b>(3) narrow skills</b> — a proprietary DSL, medical coding, your codebase\'s idioms — where few-shot tops out; <b>(4) latency-critical structured tasks</b> where you can\'t afford few-shot tokens; <b>(5) open-model deployment</b> where you control weights anyway and the marginal cost of adaptation is low.</p>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "When would you fine-tune instead of using RAG?" is a standard senior screen. The strong answer names the ladder, states behavior-vs-knowledge, gives one legitimate use (cost compression via distillation is the crowd-pleaser), and volunteers the maintenance tail unprompted. Answering "when the model doesn\'t know our data" fails the screen.</div>'
    },
    {
      id: 'sft-mechanics',
      title: 'SFT mechanics: data formats, templates, loss masking, epochs',
      blurb: 'What actually happens in a supervised fine-tuning run — and the three switches everyone gets wrong first.',
      html: '<h2>The training loop is the pretraining loop</h2>' +
        '<p>Supervised fine-tuning is next-token prediction with better groceries: you continue training the same cross-entropy objective, but on curated (prompt → ideal response) pairs instead of raw web text. Everything you know about the pretraining loop applies — the differences are the dataset (thousands, not trillions of tokens), the learning rate (tiny: 1e-5 to 2e-4 territory), and three mechanical details that decide whether the run works: the chat template, loss masking, and epoch count.</p>' +
        '<p>Data arrives as JSONL, one conversation per line. The de-facto standard is the messages format:</p>' +
        '<pre><code>{"messages": [\n  {"role": "system", "content": "You are a support triage engine. Output JSON only."},\n  {"role": "user", "content": "App crashes when I upload a photo &gt; 10MB"},\n  {"role": "assistant", "content": "{\\"queue\\": \\"mobile-bugs\\", \\"severity\\": \\"P2\\", \\"component\\": \\"upload\\"}"}\n]}</code></pre>' +
        '<p>Frameworks (TRL, Axolotl, Unsloth, LLaMA-Factory) all consume this shape; older "alpaca format" (<code>instruction</code>/<code>input</code>/<code>output</code> columns) still circulates and gets converted under the hood.</p>' +
        '<h2>Chat templates: where silent failure lives</h2>' +
        '<p>The model never sees your JSON. A <b>chat template</b> (a Jinja string shipped in the tokenizer config) renders messages into the exact token stream the model was originally trained on — special tokens and all. Llama-3 uses <code>&lt;|start_header_id|&gt;user&lt;|end_header_id|&gt;</code> markup; Qwen uses ChatML (<code>&lt;|im_start|&gt;user</code>); Gemma uses <code>&lt;start_of_turn&gt;</code>. Train with one rendering and serve with another and you get no error — just a model that is measurably, mysteriously worse (module 16 covers the serving side of this footgun). Rules: always render via <code>tokenizer.apply_chat_template()</code>, never hand-concatenate strings; verify by decoding one training example and eyeballing the special tokens; and make sure your training template and your inference server\'s template are byte-identical.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> <b>Loss masking</b> is the detail interviews love. Each training sequence is prompt tokens followed by response tokens, but you only want gradients from the response. Implementation: set the label to <code>-100</code> (PyTorch\'s ignore_index) for every prompt-token position, so cross-entropy skips them. Skip the masking and the model spends capacity learning to <em>predict user messages</em> — you\'ll see it start completing your questions, echoing instructions, or generating fake multi-turn conversations. In TRL this is one switch (assistant-only loss / completion-only collator); in hand-rolled loops it\'s the bug you ship first.</div>' +
        '<h2>Epochs and the overfitting cliff</h2>' +
        '<p>Fine-tuning datasets are small — 500 to 50k examples — so the model can memorize them, and will. Symptoms of overcooking: training loss falls while held-out loss climbs; outputs become rigid (identical phrasing on every response, few-shot flexibility gone); the model regurgitates training examples verbatim; and general capability outside your task degrades (catastrophic forgetting, lesson 6). Working defaults as of early 2026: <b>1–3 epochs</b>, and for LoRA runs, learning rate around 1e-4 to 2e-4 with cosine decay and a short warmup; full fine-tunes run 10× lower LR. Under ~1k examples, favor 2–3 epochs at lower LR over one hot epoch; past ~50k examples, one epoch usually suffices.</p>' +
        '<table><tr><th>Symptom</th><th>Diagnosis</th><th>Fix</th></tr>' +
        '<tr><td>Model completes user turns / asks itself questions</td><td>No loss masking, or broken template</td><td>Assistant-only loss; decode and inspect one rendered example</td></tr>' +
        '<tr><td>Eval loss up, train loss down after epoch 1</td><td>Overfitting the small set</td><td>Fewer epochs, lower LR, more/better data</td></tr>' +
        '<tr><td>Rigid, template-stuck outputs; ignores novel instructions</td><td>Overfit + data too homogeneous</td><td>Diversify prompts; mix in 5–10% general instruction data</td></tr>' +
        '<tr><td>Great on train-style inputs, falls apart on paraphrases</td><td>Memorization, not generalization</td><td>Dedup near-duplicates; paraphrase-augment; hold out by <em>topic</em>, not random row</td></tr></table>' +
        '<h2>How much data, and hyperparameters that matter</h2>' +
        '<p>For format/style/behavior tasks, <b>500–5,000 excellent examples</b> is the working range — quality dominates (lesson 5). Narrow classification can work with a few hundred; new-skill training (a DSL, a complex workflow) wants 10k+. The hyperparameters worth your attention, in order: learning rate (the only one that will destroy a run outright), epochs, effective batch size (16–128 via gradient accumulation; smaller batches are noisier but fine), max sequence length (truncation silently deletes your long examples — check the length histogram <em>before</em> training), and warmup (3–10% of steps). Everything else is a distraction until those are right.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team fine-tuned for JSON extraction and saw eval accuracy stuck at 71%. Cause: 30% of training examples exceeded the 2,048-token <code>max_seq_len</code> and were truncated mid-JSON — the model was being <em>trained to emit unterminated JSON</em>. One histogram of tokenized lengths would have caught it. Always plot lengths; always set max_seq_len above your p99.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "Walk me through what happens to one example in an SFT step" separates people who\'ve run this from people who\'ve read about it: render with chat template → tokenize → labels = input shifted, prompt positions set to −100 → forward pass → cross-entropy on response tokens only → backprop → optimizer step. Mentioning the −100 convention is the shibboleth.</div>'
    },
    {
      id: 'lora-qlora',
      title: 'LoRA & QLoRA internals: the low-rank trick and the VRAM math',
      blurb: 'ΔW = BA, what rank and alpha actually do, and why a 70B fine-tune fits on one GPU.',
      html: '<h2>Why full fine-tuning is a datacenter problem</h2>' +
        '<p>Count the VRAM for full fine-tuning an 8B model with AdamW: BF16 weights 16 GB + BF16 gradients 16 GB + FP32 master weights 32 GB + two FP32 Adam moments 64 GB ≈ <b>128 GB before activations</b> — you\'re sharding across several 80 GB GPUs for a "small" model. A 70B model scales that past a terabyte: multi-node territory, real distributed-systems pain. The observation that rescues you: fine-tuning barely moves the weights, and the movement is highly redundant — the <em>update</em> lives in a low-dimensional subspace even though the weight matrices are huge.</p>' +
        '<h2>LoRA: learn the update, not the weights</h2>' +
        '<p><b>LoRA (Low-Rank Adaptation)</b> freezes the base weights W and learns a low-rank correction: <code>W\' = W + ΔW</code> where <code>ΔW = (α/r) · B·A</code>, with <code>A</code> an <code>r×k</code> matrix, <code>B</code> a <code>d×r</code> matrix, and rank <code>r</code> tiny (8–64) against d,k in the thousands. A d×k matrix has d·k trainable numbers; the LoRA pair has r·(d+k). For a 4096×4096 attention projection at r=16: 16.8M parameters become 131k — <b>~0.8%</b>. Only A and B get gradients and optimizer states, so the 96 GB of Adam overhead above collapses to under a gigabyte. <code>A</code> initializes Gaussian, <code>B</code> initializes to zero, so ΔW starts at exactly zero — training begins from the unmodified base model.</p>' +
        '<ul>' +
        '<li><b>Rank r</b> is the capacity knob. r=8–16 handles style/format; r=32–64 for harder behavioral shifts or new skills. Doubling r doubles adapter size and rarely doubles quality — when r=16 underperforms, the fix is usually better data, not r=128.</li>' +
        '<li><b>Alpha (α)</b> scales the update: the effective multiplier is α/r. Convention: α = 2r (so scale 2) or α = r. If you raise r but keep α, you\'ve silently <em>weakened</em> the adapter — a classic confusion. Treat α/r as one combined knob near 1–2 and leave it alone.</li>' +
        '<li><b>Dropout</b> (0.05–0.1) on the LoRA path fights overfitting on small sets; set 0 for 50k+ examples.</li>' +
        '<li><b>Target modules:</b> early practice adapted only <code>q_proj</code>/<code>v_proj</code>; current consensus (QLoRA paper onward) is <b>all linear layers</b> — q,k,v,o plus the MLP\'s gate/up/down — which reliably beats attention-only at the same parameter budget. The MLP is where much of the behavior lives.</li>' +
        '</ul>' +
        '<p>At inference you either <b>merge</b> (<code>W + (α/r)BA</code> once, zero runtime overhead, indistinguishable from a full checkpoint) or keep the adapter separate — which is how one served base model hosts dozens of per-tenant adapters, hot-swapped per request (vLLM/LoRAX-style multi-LoRA serving). Adapters are 50–500 MB artifacts you can version in git-lfs, not 16 GB checkpoints.</p>' +
        '<h2>QLoRA: the base model doesn\'t need gradients, so quantize it</h2>' +
        '<p><b>QLoRA</b> pushes one step further: the frozen base is stored in <b>4-bit NF4</b> (NormalFloat4 — quantization levels matched to the normal distribution of trained weights, with "double quantization" compressing the scale factors themselves). Forward passes dequantize blockwise to BF16 on the fly; gradients flow <em>through</em> the frozen 4-bit weights into the BF16 LoRA adapters, which are the only thing trained. Quality loss versus BF16-base LoRA is small and often unmeasurable on downstream tasks. A paged optimizer spills Adam states to CPU RAM on memory spikes instead of OOMing.</p>' +
        '<table><tr><th>Setup</th><th>8B model</th><th>70B model</th></tr>' +
        '<tr><td>Full FT (AdamW, BF16)</td><td>~128 GB + activations → 2–4× A100/H100</td><td>~1.1+ TB → multi-node</td></tr>' +
        '<tr><td>LoRA (BF16 base)</td><td>16 GB base + &lt;1 GB adapter/opt + activations ≈ <b>20–24 GB</b> → one RTX 4090</td><td>140 GB base → 2× 80 GB GPUs</td></tr>' +
        '<tr><td>QLoRA (NF4 base)</td><td>~5.5 GB base + overhead ≈ <b>10–12 GB</b> → one 12–16 GB card / free Colab T4</td><td>~36 GB base + overhead ≈ <b>46–55 GB</b> → one 80 GB GPU (48 GB is a squeeze)</td></tr></table>' +
        '<p>Date-stamping the economics, as of early 2026: an RTX 4090 rents for ~$0.35–0.45/hr, an A100-80GB for ~$1.30–1.80/hr, an H100 for ~$2–3/hr on the marketplace clouds. A 3-epoch QLoRA run over 10k examples on an 8B model is 1–3 GPU-hours: <b>a fine-tune costs less than lunch</b>. The scarce resources are your data quality and your eval discipline, not compute.</p>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why does low-rank work at all? Empirically, the intrinsic dimensionality of task adaptation is small: the base model already contains the features; fine-tuning mostly <em>re-weights and routes</em> existing circuitry rather than growing new machinery. This is also LoRA\'s honest limit — it amplifies what pretraining put there. Genuinely new knowledge or a language the base barely saw wants higher rank, more data, or full fine-tuning, and often still disappoints.</div>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> Activation memory scales with sequence length × batch size and can dwarf everything above at long context — gradient checkpointing (recompute activations in the backward pass, ~30% slower, several× less memory) is on by default in every sane recipe. And training throughput ≠ inference throughput: QLoRA trains fine, but serving that same NF4 checkpoint via bitsandbytes is slow; re-quantize to GGUF/AWQ for serving (module 15).</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> The two questions that get asked: "Explain LoRA to me" — answer with ΔW = BA, the parameter arithmetic (give the 0.8% number), B=0 init, and merge-vs-hot-swap. And "your fine-tune needs to run on one 24 GB card — what do you do?" — QLoRA, all-linear targets, r=16, gradient checkpointing, paged optimizer. Concrete numbers close interviews.</div>'
    },
    {
      id: 'preference-tuning',
      title: 'Preference tuning: DPO, RLHF, and the alphabet soup',
      blurb: 'When "good vs better" beats "here\'s the answer" — and why most teams never need PPO.',
      html: '<h2>Why SFT isn\'t enough</h2>' +
        '<p>SFT teaches the model to imitate demonstrations. But some qualities are easier to <em>judge</em> than to demonstrate: which of two answers is more helpful, less sycophantic, better-toned, safer. Preference tuning optimizes directly on comparisons — pairs of (chosen, rejected) responses to the same prompt — and it is where chat models get their judgment, refusal boundaries, and polish (module 1\'s stage attribution). For app-level fine-tuning you reach for it when SFT output is <em>correct but not good</em>: right facts, wrong emphasis; valid JSON, verbose padding; helpful, but caves under user pushback.</p>' +
        '<h2>The RLHF pipeline — and what DPO deleted</h2>' +
        '<p>Classic RLHF is a three-stage machine: <b>(1)</b> SFT a base model; <b>(2)</b> train a separate <b>reward model</b> on human preference pairs to emit a scalar score; <b>(3)</b> run <b>PPO</b> — sample responses from the policy, score them with the reward model, update the policy to increase reward while a <b>KL penalty against a frozen reference model</b> stops it drifting into reward-hacked gibberish. It works (it built ChatGPT) but it\'s an unstable, four-model juggling act (policy, reference, reward model, value function), hyperparameter-sensitive and hungry for both compute and RL expertise.</p>' +
        '<p><b>DPO (Direct Preference Optimization, 2023)</b> collapsed stages 2–3 into a supervised loss. The insight: the RLHF objective has a closed-form optimal policy, and you can rearrange it so the preference data trains the policy <em>directly</em> — the model becomes its own implicit reward model. The loss pushes up the margin by which the policy prefers the chosen response over the rejected one, measured in log-probability ratios against the frozen reference: <code>-log σ( β·[ log π(y_w|x)/π_ref(y_w|x) − log π(y_l|x)/π_ref(y_l|x) ] )</code>. β (~0.1) plays the KL role: higher β hugs the reference tighter. Mechanically it\'s just two forward passes per example (policy + reference) and backprop — it runs on the same QLoRA rig as your SFT, no sampling loop, no reward model, no PPO plumbing.</p>' +
        '<table><tr><th></th><th>DPO</th><th>RLHF (PPO)</th></tr>' +
        '<tr><td>Data</td><td>Static preference pairs</td><td>Preference pairs → reward model, then online sampling</td></tr>' +
        '<tr><td>Models in memory</td><td>2 (policy + frozen reference)</td><td>4 (policy, reference, reward, value)</td></tr>' +
        '<tr><td>Stability / expertise</td><td>Supervised-learning easy</td><td>RL-tuning hard</td></tr>' +
        '<tr><td>Ceiling</td><td>Bounded by your pair distribution</td><td>Explores beyond the data; scales with reward-model quality</td></tr>' +
        '<tr><td>Use when</td><td>App-level behavior shaping — 95% of teams</td><td>Frontier alignment, verifiable-reward RL (code/math), online adaptation</td></tr></table>' +
        '<div class="callout note"><span class="co-title">Key idea</span> The practical recipe as of early 2026: <b>SFT first, then DPO on top</b>, both via (Q)LoRA. DPO refines a model that already does the task; running DPO on a model that can\'t do the task yet just teaches it to prefer the less-bad of two failures. A few thousand good pairs move tone, verbosity, and refusal behavior measurably.</div>' +
        '<h2>The extended family: KTO, ORPO, and verifiable-reward RL</h2>' +
        '<p>You mostly need to know these exist and what constraint they relax. <b>KTO</b> drops the pairing requirement: it trains on independent thumbs-up/thumbs-down labels — exactly the shape of production feedback logs, where you have ratings on single responses, not curated A/B pairs. <b>ORPO</b> folds preference optimization into the SFT pass itself (odds-ratio penalty, no reference model, one training stage). <b>GRPO</b> and friends power the reasoning-model wave: RL against <em>verifiable</em> rewards — did the code pass tests, is the math answer correct — replacing human taste with a checkable signal (module 21). If a vendor pitch says "RLHF-quality alignment," your first question is which of these is actually under the hood.</p>' +
        '<h2>Failure modes to expect</h2>' +
        '<ul>' +
        '<li><b>Verbosity hacking:</b> raters (human and LLM) prefer longer answers, so naive preference tuning inflates length. Control length in your pairs or you\'ll ship a model that pads.</li>' +
        '<li><b>Reward hacking / drift:</b> optimize hard enough against any proxy and you get artifacts — over-hedging, formulaic empathy, refusal sprawl. The β/KL leash and diverse pairs are your brakes.</li>' +
        '<li><b>Judge bias inheritance:</b> most teams generate pairs with an LLM judge (RLAIF-style). Cheap and effective — but the student inherits the judge\'s biases (position bias, self-preference, verbosity). Calibrate the judge against a human-labeled sample first (module 11).</li>' +
        '<li><b>DPO overfitting:</b> log-prob margins on training pairs climb forever; held-out win-rate is the only number that matters. Evaluate with pairwise win-rate against the SFT checkpoint on unseen prompts.</li>' +
        '</ul>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A support-bot team DPO-tuned on 8k pairs where "chosen" responses were, on average, 40% longer than "rejected" ones — an accident of how the pairs were generated. The tuned model\'s median response length doubled, token costs followed, and CSAT <em>dropped</em> — users wanted answers, not essays. They rebuilt the pairs length-matched and recovered. Audit the chosen/rejected length distribution before every DPO run; it\'s one histogram.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> Standard probe: "DPO vs RLHF — when is each appropriate?" Strong answer: DPO for offline behavior shaping from static pairs (cheap, stable, sufficient for app work); PPO-style RL when you need online exploration or have a verifiable reward; then name-drop KTO for unpaired production feedback. Knowing that DPO\'s reference model provides the KL anchor shows you understand <em>why</em> it doesn\'t collapse.</div>'
    },
    {
      id: 'distillation-data',
      title: 'Distillation and data quality: the LIMA lesson',
      blurb: 'Teacher→student pipelines, licensing landmines, and why 1,000 great examples beat 50,000 mediocre ones.',
      html: '<h2>Distillation: buying capability with inference, not labeling</h2>' +
        '<p><b>Distillation</b> in the modern, practical sense: use a strong teacher model to generate training data for a small student. (Classical logit-matching distillation exists but API models rarely expose full logits; sequence-level distillation — training on teacher <em>outputs</em> — is what everyone actually does.) The pipeline: collect representative prompts from your real traffic → generate responses with the teacher, using your best prompt + few-shot scaffold and, ideally, chain-of-thought → <b>filter hard</b> → SFT the student on the survivors. The filter is where distillation is won: verify JSON parses, run generated code against tests, check citations exist, use a judge model to score faithfulness, and discard 20–50% of raw generations. Every surviving example is a unit of teacher capability compressed into your student.</p>' +
        '<p>This is the economically dominant fine-tune as of early 2026: frontier-model quality on a <em>narrow</em> task, served on an 8B at roughly 1/20th the per-token price and 3–5× lower latency. It\'s also self-bootstrapping — the same teacher can generate the eval set (with human spot-checks) that will judge the student.</p>' +
        '<div class="callout limits"><span class="co-title">Limits that matter</span> <b>Licensing is not a footnote.</b> Most proprietary-API terms (OpenAI, Anthropic, Google) prohibit using outputs to train models that <em>compete</em> with the provider — an intentionally elastic word; internal narrow-task fine-tunes are commonly considered fine, but that\'s a legal read, not an engineering one. Get it reviewed. Open-weight teachers changed this calculus: Apache-2.0/MIT-licensed models (Qwen and DeepSeek families, notably) permit distillation outright, which is exactly why DeepSeek-R1\'s MIT release with its explicit blessing of distillation mattered — and why "R1-distill" students of every size flooded out within weeks. Also note some community licenses (several Llama versions) require derivative models to carry naming/attribution terms. Track the provenance of every training token; acquirers\' due-diligence teams certainly will.</div>' +
        '<h2>The LIMA lesson: quality is the whole game</h2>' +
        '<p>LIMA (Meta, 2023) fine-tuned a 65B base on just <b>1,000 meticulously curated</b> examples — no RLHF, no six-figure dataset — and produced a competitive assistant. The now-standard reading (the "superficial alignment hypothesis"): capability lives in pretraining; SFT mostly teaches <em>format, style, and which latent skills to surface</em>. Interpretation for practitioners: past a modest floor, adding mediocre examples doesn\'t help and actively hurts — every sloppy example is a gradient vote for sloppy outputs. The model averages what you show it. Your dataset is a specification written in examples; write it with the care you\'d put into an API contract.</p>' +
        '<p>The corollary nobody likes: <b>the highest-leverage hour in fine-tuning is reading your data.</b> Not tuning rank, not sweeping learning rates. Read 100 random examples; you will find horrors — mislabeled rows, truncated outputs, contradictory answers to near-identical prompts, template leakage. Fix the data, rerun, and watch the eval move more than any hyperparameter ever moved it.</p>' +
        '<h2>Hygiene: dedup and decontamination</h2>' +
        '<ul>' +
        '<li><b>Deduplication.</b> Exact and <em>near</em>-duplicates (MinHash/embedding-similarity at ~0.9+) concentrate gradient weight on repeated patterns → memorization and rigidity. Scraped and synthetic corpora are both duplicate-riddled; synthetic generation especially loves producing the same example with cosmetic variation. Dedup before every run.</li>' +
        '<li><b>Decontamination.</b> Remove training rows that overlap your eval set — n-gram (13-gram is the classic) plus embedding-similarity matching, because paraphrase contamination survives n-gram checks. A contaminated eval reads as a breakthrough: you benchmark the training set through the weights. If your fine-tune jumps 20 points overnight, your first hypothesis is leakage, not genius. Split by <em>topic/entity/time</em>, not by random row — random splits leak paraphrases of the same underlying items across the boundary.</li>' +
        '<li><b>Label consistency.</b> Two annotators (or two judge-model runs) disagreeing on 30% of rows puts a hard ceiling on what any model can learn. Measure inter-annotator agreement before training; reconcile or drop the disputed slice.</li>' +
        '</ul>' +
        '<h2>Synthetic data that doesn\'t poison you</h2>' +
        '<p>Synthetic data is now the default filler for coverage gaps — edge cases, rare classes, adversarial phrasings. The discipline that keeps it safe: <b>generate with verification or don\'t generate.</b> Constrain outputs to checkable forms (code with tests, JSON with schemas, math with answers), verify, and discard failures. Seed generation with real traffic patterns so the distribution stays honest; cap synthetic at a sane fraction (teams commonly hold it under ~50% of the mix); and dedup aggressively because generators repeat themselves. Unverified synthetic-on-synthetic loops compound errors — the model-collapse literature is the cautionary tale, and "we trained on our own outputs without checking them" is its production translation.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team generated 30k synthetic examples for a code-review student. The teacher had a tic: it prefixed ~15% of reviews with "Great question!". Nobody read the data. The student said "Great question!" to diffs. Distillation transfers <em>everything</em> — tics, biases, hedges, hallucination patterns. The fix was a filter regex plus, more importantly, a standing rule: no training run without a 100-example human read of the exact final dataset.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "You have budget for 50k scraped examples or 2k hand-curated ones — which do you take?" is a values probe; LIMA is the citation, and the strong answer adds the mechanics: dedup, decontaminate against the eval, measure annotator agreement, and read the data. Bonus points for raising the distillation licensing question before the interviewer does.</div>'
    },
    {
      id: 'evaluating-fine-tunes',
      title: 'Evaluating fine-tunes: held-out sets, regressions, and forgetting',
      blurb: 'The fine-tune isn\'t done when loss converges — it\'s done when it beats the baseline without breaking everything else.',
      html: '<h2>Loss is not the deliverable</h2>' +
        '<p>Training loss going down tells you optimization is working; it says nothing about whether you should ship. The eval battery for a fine-tune has <b>three mandatory panels</b>, and teams that run only the first one ship regressions:</p>' +
        '<ol>' +
        '<li><b>Task eval (held-out):</b> does the tuned model beat the un-tuned baseline (base + your best prompt) on <em>your task</em>, on examples it never trained on? This is the whole justification for the project — if tuned-8B doesn\'t beat prompted-8B by a margin that matters, the fine-tune loses to the prompt on maintenance cost alone.</li>' +
        '<li><b>General-capability regression:</b> did you break instruction following, reasoning, safety behavior, or adjacent tasks the same endpoint serves?</li>' +
        '<li><b>Behavioral/format checks:</b> schema-valid rate, refusal calibration (still refuses what it should, doesn\'t refuse your domain\'s benign jargon), verbosity drift, degenerate repetition.</li>' +
        '</ol>' +
        '<p>Build the held-out set <b>before</b> training and treat the split as a security boundary: split by topic/entity/time rather than random rows (paraphrase leakage across a random split inflates scores), decontaminate the training set against it (lesson 5), and never let anyone "just peek" to fix a failing case — every peek converts test into training. 200–500 held-out examples with an automatic grader (exact match, schema check, or a calibrated LLM judge — module 11) gives you statistically usable signal; 20 examples gives you vibes.</p>' +
        '<h2>Catastrophic forgetting: the tax on every gradient step</h2>' +
        '<p>Neural nets learn new tasks by overwriting the weights that encoded old ones — <b>catastrophic forgetting</b>. Fine-tune an 8B hard on SQL generation and its summarization, multilingual fluency, or willingness to answer off-domain questions can quietly degrade. The damage scales with learning rate, epochs, and dataset narrowness; a model trained on 3k near-identical prompts for 5 epochs at 5e-4 will be visibly lobotomized outside its lane. LoRA <em>reduces</em> the blast radius versus full fine-tuning — frozen base weights bound how far you can drift, and lower rank means a tighter leash — but it does not eliminate it: the adapter modulates every forward pass, off-domain included.</p>' +
        '<p>Mitigations, in order of practical value:</p>' +
        '<ul>' +
        '<li><b>Mix in general data:</b> 5–10% general instruction data (or your other production tasks) blended into the training set anchors general behavior. Cheapest and most effective single fix.</li>' +
        '<li><b>Turn the knobs down:</b> fewer epochs, lower LR, lower rank. Most forgetting cases are simply overcooked runs.</li>' +
        '<li><b>Measure it:</b> a fixed general-capability probe suite — a few hundred prompts sampling instruction following, reasoning, coding, safety, and <em>your other production tasks</em> — run on every candidate, diffed against the base model. You cannot manage what you don\'t measure, and forgetting is invisible in the task eval by construction.</li>' +
        '<li><b>Scope the deployment:</b> if the tuned model serves exactly one narrow endpoint and generalist traffic routes elsewhere, forgetting off-domain skills may be an acceptable, even irrelevant, cost. Say so explicitly in the eval report rather than discovering it in prod.</li>' +
        '</ul>' +
        '<div class="callout hood"><span class="co-title">Under the hood</span> Why does a LoRA adapter affect unrelated inputs at all? ΔW = BA adds to the weight matrix for <em>every</em> token of every request — there\'s no task gate. The update is low-rank, so it perturbs a small subspace, but if that subspace carries general routing (and with all-linear targets, some of it does), off-domain behavior shifts. This is also why per-task adapters + routing beats one adapter trained on everything when tasks conflict.</div>' +
        '<h2>Ship gates and the ongoing loop</h2>' +
        '<p>Write the promotion criteria before the run, like any launch: <em>tuned model must beat the prompted baseline by ≥X points on the task eval, regress ≤Y on every general probe, hold schema-validity ≥99%, and pass a human review of N transcripts.</em> Then version everything — dataset hash, base checkpoint, adapter, hyperparameters, eval scores — so any prod behavior change traces to a diff. Post-ship, the fine-tune enters the same observability loop as every model (module 12): sampled online grading, drift alarms, and a quarterly "does the new base model beat our fine-tune out of the box?" check — the answer flips to <em>yes</em> more often than fine-tuning teams like to admit, and the honest response is to celebrate and delete the adapter.</p>' +
        '<div class="callout gotcha"><span class="co-title">Production gotcha</span> A team shipped a support fine-tune that aced its task eval (+11 points). Two weeks later, sales noticed the same endpoint\'s <em>other</em> workload — email drafting — had gone stilted and terse. Nobody had eval\'d it: it wasn\'t "the task." The regression panel now includes every workload the endpoint serves, which in a shared-model shop means the panel is mostly <em>other teams\' tasks</em>. Coordinate or get paged.</div>' +
        '<div class="callout interview"><span class="co-title">Interview lens</span> "How do you know your fine-tune is ready to ship?" — the strong answer is the three-panel battery plus pre-registered gates, with catastrophic forgetting named unprompted and the LoRA-reduces-but-doesn\'t-eliminate nuance. The follow-up is usually "what\'s your baseline?" — and the only right answer is <em>the best prompted version of the same base model</em>, not the untouched model with a lazy prompt.</div>'
    }
  ],
  quiz: [
    {
      text: 'A PM wants to fine-tune an open 8B model on your product documentation "so the chatbot knows our product." Docs change weekly. What is the strongest technical objection?',
      options: [
        'An 8B model is too small to fine-tune; you need at least 70B',
        'SFT is unreliable at storing facts — they partially stick and interpolate into confident errors — and weekly doc changes would each require a retrain, while RAG updates by re-indexing and gives auditable citations',
        'Fine-tuning on documentation violates most model licenses',
        'The chatbot should use few-shot examples of the docs instead'
      ],
      answer: [1],
      explanation: 'This is the knowledge-injection trap: gradient updates on a small corpus store facts lossily, the model fabricates across the gaps, and the weights are stale on every doc change — RAG is exact, updateable in seconds, and auditable. (A) is backwards — 8B fine-tunes are routine; size isn\'t the issue, the use case is. (C) is invented; training on your own docs is fine under every mainstream license. (D) confuses mechanisms: you can\'t fit a doc corpus into few-shot examples, and examples teach format, not knowledge — the knowledge belongs in retrieved context.'
    },
    {
      text: 'Your extraction service must emit a strict house JSON schema. Prompting gets 91% schema-valid; adding 15 few-shot examples gets 96%; you need 99.5% at 200k requests/day and the few-shot tokens are a third of your bill. What does the decision tree say?',
      options: [
        'Stop — never fine-tune; keep iterating on the prompt until 99.5%',
        'Fine-tuning is now justified: you climbed the ladder with measurements, the failure is behavioral (format conformance), and volume makes the few-shot token cost material',
        'Switch to RAG to retrieve the schema at request time',
        'Use a larger frontier model with the same prompt'
      ],
      answer: [1],
      explanation: 'This is the textbook legitimate fine-tune: prompting and few-shot were tried and measured, the residual failure is behavior (format consistency) not knowledge, and at 200k req/day the fine-tune also deletes the few-shot token overhead. (A) misreads the lesson — the ladder has a top, and 96%→99.5% on format is exactly what SFT is good at. (C) misapplies RAG: the schema isn\'t missing knowledge; retrieval doesn\'t improve conformance. (D) might hit 99.5% but raises per-token cost at volume — the opposite of the goal, and constrained decoding aside, the question is about the escalation logic.'
    },
    {
      text: 'After an SFT run, your model has started generating fake user questions and answering them, and sometimes completes your prompt instead of responding to it. Which training mistake most likely caused this?',
      options: [
        'Learning rate too high, corrupting the weights',
        'Prompt tokens were not masked out of the loss, so the model was trained to predict user turns as well as assistant turns',
        'Too few epochs — the model has not converged',
        'The dataset was too small for the model size'
      ],
      answer: [1],
      explanation: 'Training on the full sequence without setting prompt-token labels to -100 spends gradient on predicting user messages — so the model learns to generate them, the signature symptom described. (A) high LR degrades quality broadly (incoherence, repetition), not this specific role-confusion pattern. (C) under-training leaves the model close to its base behavior; it doesn\'t create new pathologies. (D) small data causes overfitting/rigidity, not user-turn generation. The related suspect worth checking is a broken chat template, but among the options loss masking is the classic cause.'
    },
    {
      text: 'You fine-tune on 800 examples for 8 epochs. Training loss is near zero; the model nails anything phrased like the training data but falls apart on paraphrases, and every response now opens with the same sentence. Diagnosis and fix?',
      options: [
        'Underfitting — train for more epochs at a higher learning rate',
        'Memorization/overfitting of a small set — cut to 1–3 epochs, lower LR, dedup near-duplicate examples, and diversify prompt phrasing',
        'The base model is too small — move to a 70B',
        'Rank too low — raise LoRA rank from 16 to 128'
      ],
      answer: [1],
      explanation: 'Near-zero train loss + paraphrase brittleness + template-stuck openings is the overfitting cliff on a small homogeneous set; the fix is fewer epochs, lower LR, deduplication, and more diverse data. (A) is the opposite prescription and would deepen memorization. (C) a bigger model memorizes 800 examples even faster — capacity isn\'t the problem. (D) raising rank adds capacity, which worsens memorization; rank changes address capability shortfalls, not overfitting.'
    },
    {
      text: 'Your LoRA config used r=16, alpha=32. A teammate bumps rank to 64 "for more capacity" but leaves alpha at 32, and quality drops. What happened?',
      options: [
        'Rank 64 always overfits; rank must never exceed 32',
        'The effective update scale is alpha/r — it silently fell from 2.0 to 0.5, weakening the adapter\'s contribution 4×; alpha should scale with rank (e.g. alpha=128) or the LR adjusted',
        'Higher rank requires 4-bit quantization of the base model',
        'alpha must always equal exactly 2× rank or training diverges'
      ],
      answer: [1],
      explanation: 'LoRA applies ΔW scaled by alpha/r: at r=16/α=32 the multiplier is 2.0; at r=64/α=32 it\'s 0.5 — the adapter\'s influence quietly shrank 4×, a classic confusion. (A) invents a rule; r=64 is routine for harder tasks when data supports it. (C) quantization is orthogonal to rank. (D) α=2r is a common convention, not a stability requirement — the point is that α/r is one combined knob and must be managed when either side changes, not that a specific ratio is mandatory.'
    },
    {
      text: 'You must fine-tune a 70B model and your entire budget is one rented 80 GB A100. Which approach fits, and why?',
      options: [
        'Full fine-tuning with AdamW — 70B parameters need about 70 GB, which fits',
        'LoRA with the base model in BF16 — the frozen base needs no optimizer states',
        'QLoRA — the frozen base stored in 4-bit NF4 takes ~36 GB, and gradients/optimizer states exist only for the small BF16 adapters, landing the run around 46–55 GB',
        'It cannot be done on fewer than four GPUs at any precision'
      ],
      answer: [2],
      explanation: 'QLoRA is built for exactly this: NF4 base (~0.5 bytes/param ≈ 36 GB for 70B) + LoRA adapters + paged optimizer fits an 80 GB card. (A) catastrophically undercounts: BF16 weights alone are 140 GB, and Adam states push full FT past a terabyte. (B) BF16 LoRA still needs the 140 GB frozen base resident — two 80 GB GPUs minimum. (D) is falsified by (C); the whole point of the QLoRA paper was single-GPU 65B-class tuning.'
    },
    {
      text: 'Which THREE of the following are genuine advantages of LoRA over full fine-tuning?',
      options: [
        'Optimizer and gradient memory shrink to the adapter\'s ~1% of parameters, enabling single-GPU training',
        'Adapters are small swappable artifacts, so one served base model can host many per-tenant adaptations',
        'A merged LoRA model runs inference faster than the original base model',
        'The frozen base bounds drift, typically reducing (not eliminating) catastrophic forgetting versus full FT',
        'LoRA adds new knowledge more effectively than full fine-tuning'
      ],
      answer: [0, 1, 3],
      multi: true,
      explanation: '(A) is the core economics: gradients and Adam states exist only for B·A. (B) multi-LoRA serving (vLLM/LoRAX-style hot-swap) is a real deployment pattern full checkpoints can\'t match. (D) frozen base weights plus low-rank updates keep the model on a leash — reduced, not zero, forgetting. (C) is false: merged LoRA is byte-for-byte the same architecture and speed as the base; unmerged adds slight overhead. (E) is backwards — LoRA\'s low-rank constraint makes it weaker at genuinely new knowledge than full FT, and both are the wrong tool for fact injection anyway.'
    },
    {
      text: 'Your SFT\'d support model is factually fine but verbose, hedges constantly, and caves instantly when users push back. You have ~5k prompts where you can generate and label better-vs-worse response pairs. What is the standard next move as of early 2026?',
      options: [
        'Another SFT round on the same data with more epochs',
        'DPO on the preference pairs, on top of the SFT checkpoint, via (Q)LoRA — offline pairwise optimization is exactly shaped for tone/verbosity/sycophancy fixes',
        'Full RLHF: train a reward model and run PPO',
        'Raise temperature so responses vary more'
      ],
      answer: [1],
      explanation: 'Correct-but-not-good is the preference-tuning use case, and DPO handles it with two models in memory and a supervised loss — the standard app-level recipe (SFT then DPO). (A) more epochs on the same demonstrations can\'t teach a preference the demonstrations don\'t encode, and invites overfitting. (C) PPO would work but costs 4-model plumbing and RL expertise for no ceiling gain at this scale — DPO suffices for static-pair behavior shaping. (D) temperature changes variance, not the systematic hedging/sycophancy trained into the weights.'
    },
    {
      text: 'You have 40k production thumbs-up/thumbs-down ratings on individual responses — no A/B pairs. Which preference method is the most direct fit?',
      options: [
        'DPO — convert each rating into a pair by treating the prompt as the rejected response',
        'KTO — it optimizes directly on unpaired binary feedback, which is exactly the shape of production ratings',
        'PPO — reward models require unpaired data',
        'None: preference tuning strictly requires human-written ideal responses'
      ],
      answer: [1],
      explanation: 'KTO\'s entire reason to exist is relaxing DPO\'s pairing requirement to independent good/bad labels — production feedback logs are its native food. (A) is nonsense — a prompt isn\'t a response, and DPO needs chosen/rejected pairs for the same prompt (you could synthesize pairs, but that\'s extra machinery, not the direct fit). (C) is confused: reward models train fine on pairs, and PPO is the heavyweight option regardless. (D) is false — preference methods need judgments, not demonstrations; that\'s precisely what distinguishes them from SFT.'
    },
    {
      text: 'Your team plans to generate 50k training examples for an internal fine-tune using a proprietary frontier API as teacher. What must be checked before the run, and what changed the calculus recently?',
      options: [
        'Nothing — data generated via an API belongs entirely to you in all cases',
        'The provider\'s terms of service: most prohibit using outputs to train competing models, so get a legal read on your use; open-weight teachers with permissive licenses (e.g. MIT-licensed DeepSeek-R1, Apache-2.0 Qwen) avoid the issue and are why distilled variants proliferated',
        'Only whether the teacher\'s knowledge cutoff covers your domain',
        'GDPR — synthetic data is always personal data'
      ],
      answer: [1],
      explanation: 'Distillation\'s licensing caveat is real: proprietary API terms restrict training on outputs (with an elastic definition of "compete"), so provenance review is mandatory — while permissively-licensed open teachers made distillation legally clean, which is exactly why R1-distills appeared within weeks of release. (A) conflates owning output copies with freedom from contractual use restrictions. (C) matters for quality but isn\'t the compliance gate. (D) is wrong twice: synthetic data isn\'t automatically personal data, and GDPR isn\'t the operative constraint here.'
    },
    {
      text: 'Given a fixed budget, you can buy 50,000 lightly-filtered scraped examples or 2,000 expert-curated ones for an assistant-style SFT. What does the LIMA result predict, and why?',
      options: [
        'The 50k set wins — SFT quality scales primarily with dataset size',
        'The 2k curated set likely wins: SFT mainly teaches format/style and surfaces pretrained capability, so example quality dominates — and every sloppy example is a gradient vote for sloppy outputs',
        'They perform identically since the base model is the same',
        'Neither matters — only the base model size determines outcome'
      ],
      answer: [1],
      explanation: 'LIMA showed 1,000 meticulous examples aligned a 65B competitively — the superficial-alignment reading: capability comes from pretraining, SFT selects and formats it, so quality beats quantity past a modest floor. (A) is the pre-LIMA intuition the paper falsified for this regime (scale matters more for new-skill training, not assistant alignment). (C) ignores that the model averages what you show it — 50k mediocre examples actively teach mediocrity. (D) base size sets the ceiling, but the dataset decides where under the ceiling you land.'
    },
    {
      text: 'Overnight, your fine-tune\'s eval score jumps from 74% to 96% after a teammate "enriched" the training set with scraped Q&A data. What is the FIRST hypothesis to check?',
      options: [
        'The new data unlocked latent capability — ship it',
        'Contamination: the scraped data overlaps the eval set (exactly or as paraphrases), so you are benchmarking the training set through the weights — run n-gram plus embedding-similarity decontamination and re-split by topic/time',
        'The learning rate interacted favorably with the larger dataset',
        'The eval harness has a bug that inflates all scores'
      ],
      answer: [1],
      explanation: 'A 22-point overnight jump from scraped data is the classic leakage signature — scraped corpora frequently contain benchmark/eval items, and paraphrase contamination survives naive n-gram checks, which is why embedding-similarity matching and topic/time-based splits are standard. (A) is how contaminated results get shipped and then collapse on real traffic. (C) plausible-sounding but no mechanism delivers +22 from an LR interaction. (D) worth ruling out second, but a harness bug wouldn\'t correlate with the data change; the data change is the event to interrogate first.'
    },
    {
      text: 'After LoRA-tuning your 8B for SQL generation (5 epochs, LR 5e-4, 3k narrow examples), the model aces SQL but has become terse and unhelpful on the endpoint\'s other workloads. Which TWO changes most directly address this?',
      options: [
        'Blend 5–10% general instruction data (and the endpoint\'s other production tasks) into the training mix',
        'Reduce the aggressiveness of the run: fewer epochs, lower learning rate, and/or lower rank',
        'Switch from LoRA to full fine-tuning for more capacity',
        'Raise LoRA alpha to strengthen the adapter',
        'Disable loss masking so the model sees more diverse tokens'
      ],
      answer: [0, 1],
      multi: true,
      explanation: 'This is catastrophic forgetting from an overcooked, narrow run. Mixing general/other-task data anchors off-domain behavior (the single most effective fix), and turning down epochs/LR/rank shrinks the drift. (C) full FT removes the frozen-base leash and makes forgetting worse. (D) strengthening the adapter amplifies the very shift causing the damage. (E) disabling loss masking introduces the user-turn-prediction pathology — it adds token diversity in the worst possible way.'
    },
    {
      text: 'Your tuned 8B beats the base 8B by 9 points on the task eval. Before shipping, a skeptic asks "against what baseline?" Which comparison actually justifies the fine-tune, and what else must the eval report show?',
      options: [
        'Base model with default prompt — that was the comparison run, so ship it',
        'The best prompted+few-shot version of the same base model — and the report must also show general-capability regression panels and format/refusal checks, since the task eval is blind to forgetting by construction',
        'A frontier API model — the fine-tune must beat the best model that exists',
        'No baseline is needed if held-out accuracy exceeds 90%'
      ],
      answer: [1],
      explanation: 'The honest baseline is the strongest zero-training alternative — best prompt plus few-shot on the same base; beating a lazy default prompt proves nothing about whether training was worth its maintenance tail. And the three-panel battery exists because task metrics can\'t see off-task damage. (A) is the classic self-serving comparison. (C) sets the wrong bar — the fine-tune\'s job is beating its own base\'s prompted ceiling at its cost point, not beating a model 20× the price. (D) absolute scores justify nothing without an alternative-cost comparison.'
    }
  ],
  flashcards: [
    { id: 'fc-ladder', front: 'The adaptation escalation ladder, in order?', back: '<b>Prompting → few-shot → RAG → fine-tuning.</b> Climb only on measured failure of the current rung. Each rung up costs more to build and far more to maintain.' },
    { id: 'fc-behavior-knowledge', front: 'One-sentence rule for fine-tune vs RAG?', back: 'Fine-tuning changes <b>behavior</b> (style, format, skill); retrieval changes <b>knowledge</b> at request time. Fine-tuning as fact storage = confidently wrong model + retrain on every update.' },
    { id: 'fc-maintenance-tail', front: 'Name 3 items in the fine-tune maintenance tail.', back: 'Base-model churn (re-run pipeline when the next generation beats you) · every behavior tweak = data edit + training run + regression eval · drift monitoring · dataset/adapter versioning. A prompt is a config change; a fine-tune is an ML system.' },
    { id: 'fc-sft-objective', front: 'What objective does SFT use?', back: 'The same next-token cross-entropy as pretraining — just on curated (prompt → response) pairs, at tiny learning rates, with the loss masked to response tokens only.' },
    { id: 'fc-loss-masking', front: 'What is loss masking and the symptom of skipping it?', back: 'Set prompt-token labels to <b>-100</b> so cross-entropy only scores response tokens. Skip it and the model learns to predict user turns — it starts generating fake questions and completing your prompts.' },
    { id: 'fc-chat-template-ft', front: 'Why do chat templates matter in fine-tuning?', back: 'The model sees the template-rendered token stream, not your JSON. Train with one rendering, serve with another → no error, silent quality collapse. Always use apply_chat_template and decode-inspect one example.' },
    { id: 'fc-epochs', front: 'Default epochs for SFT and the overfitting signature?', back: '<b>1–3 epochs.</b> Overfit signs: train loss ≈ 0 with rising eval loss, rigid identical phrasing, verbatim regurgitation, paraphrase brittleness. Small sets memorize fast.' },
    { id: 'fc-lora-math', front: 'LoRA in one equation + parameter count?', back: 'W\' = W + (α/r)·<b>B·A</b>, A: r×k (Gaussian init), B: d×r (zero init), base frozen. Params: r(d+k) vs d·k — e.g. 4096² at r=16 → 131k vs 16.8M ≈ 0.8%.' },
    { id: 'fc-rank-alpha', front: 'What do rank and alpha control in LoRA?', back: 'r = update capacity (8–16 style/format, 32–64 harder shifts). Effective scale = <b>α/r</b> (~1–2 by convention) — raise r without raising α and you silently weaken the adapter.' },
    { id: 'fc-target-modules', front: 'Which modules should LoRA target, per current consensus?', back: '<b>All linear layers</b> — q/k/v/o projections plus MLP gate/up/down. All-linear reliably beats attention-only at equal budget (QLoRA finding); much behavior lives in the MLPs.' },
    { id: 'fc-qlora', front: 'QLoRA\'s trick and why quality survives?', back: 'Frozen base stored in <b>4-bit NF4</b> (+ double quantization, paged optimizer); forward passes dequantize blockwise; gradients flow through to BF16 adapters — the only trained part. Trained corrections ride on top of the quantized base.' },
    { id: 'fc-vram-numbers', front: 'VRAM ballparks: full FT vs LoRA vs QLoRA for 8B / 70B?', back: 'Full FT 8B ≈ 128 GB+ (multi-GPU); 70B ≈ 1+ TB (multi-node). LoRA BF16: 8B ≈ 20–24 GB (one 4090); 70B ≈ 2×80 GB. QLoRA: 8B ≈ 10–12 GB; 70B ≈ ~46–55 GB (one 80 GB card).' },
    { id: 'fc-merge-vs-swap', front: 'Two ways to deploy a LoRA adapter?', back: '<b>Merge</b> (W + (α/r)BA once → zero overhead, normal checkpoint) or <b>hot-swap</b> unmerged adapters over one shared base — multi-tenant serving with 50–500 MB artifacts per tenant.' },
    { id: 'fc-dpo', front: 'What did DPO remove from RLHF, and via what loss?', back: 'Removed the reward model and PPO loop. Loss: −log σ(β·[Δ log-prob ratio of chosen vs rejected, each against a frozen reference]). Two models in memory, pure supervised training; β is the KL leash.' },
    { id: 'fc-dpo-vs-ppo', front: 'When does DPO suffice vs needing PPO-style RL?', back: 'DPO: offline behavior shaping from static pairs — tone, verbosity, sycophancy — ~95% of app teams. PPO/GRPO: online exploration or verifiable rewards (code passes tests, math checks) — frontier and reasoning-model territory.' },
    { id: 'fc-kto-orpo', front: 'What do KTO and ORPO relax?', back: 'KTO: no pairs needed — trains on unpaired thumbs-up/down (production feedback shape). ORPO: no reference model, folds preference into the SFT pass. Know they exist; reach for KTO when you only have ratings.' },
    { id: 'fc-distill', front: 'Modern distillation pipeline in one line + the legal caveat?', back: 'Real prompts → teacher generates (with CoT) → <b>verify/filter hard</b> (tests, schemas, judge) → SFT student. Caveat: proprietary API terms restrict training competing models on outputs; permissive open teachers (MIT/Apache) avoid it.' },
    { id: 'fc-lima', front: 'The LIMA lesson?', back: '1,000 meticulously curated examples aligned a 65B competitively: SFT mostly teaches format/style and surfaces pretrained skill → <b>quality dominates quantity</b>; every sloppy example is a gradient vote for slop.' },
    { id: 'fc-decontam', front: 'Decontamination: what and how?', back: 'Remove training rows overlapping the eval set — n-gram (13-gram classic) <em>plus</em> embedding similarity (paraphrases survive n-grams); split held-out by topic/entity/time, not random rows. Sudden +20 eval jump ⇒ suspect leakage first.' },
    { id: 'fc-forgetting', front: 'Catastrophic forgetting: cause and top mitigations?', back: 'New-task gradients overwrite weights carrying old skills. Mitigate: mix 5–10% general data, lower epochs/LR/rank, run a general-capability regression panel on every candidate. LoRA reduces but does not eliminate it.' },
    { id: 'fc-ship-gates', front: 'The three mandatory eval panels for a fine-tune?', back: '1) Task eval vs the <b>best-prompted</b> baseline on held-out data · 2) general-capability regression (incl. the endpoint\'s other workloads) · 3) behavioral checks (schema validity, refusal calibration, verbosity). Pre-register the pass gates.' }
  ],
  lab: {
    title: 'QLoRA fine-tune a small model end to end',
    intro: '<p>You will fine-tune a 1B-class open model into a strict JSON ticket-triage engine using QLoRA + TRL: build the dataset, inspect the rendered template, train with assistant-only loss, then run the honest eval — tuned model vs base-plus-few-shot baseline, plus a forgetting probe. Runs on a free Colab T4 (16 GB), any local GPU with ≥8 GB VRAM, or a rented card.</p><p><b>Needs:</b> <code>python3</code>, a GPU (Colab T4 is fine), a Hugging Face account for model download. Worst case cost: $0 on Colab; ~$1 for 2 hours on a rented RTX 4090 (~$0.40/hr as of early 2026).</p>',
    steps: [
      {
        title: 'Environment and a deliberately small task',
        html: '<pre><code>pip install -U transformers trl peft datasets bitsandbytes accelerate</code></pre>' +
          '<p>The task: classify support tickets into <code>{"queue": ..., "severity": ...}</code> JSON with a fixed taxonomy — a behavior/format task, which is what SFT is actually for. Generate ~300 training examples. In real work you\'d distill these from a frontier model over real tickets (with verification — lesson 5); for the lab, synthesize them locally:</p>' +
          '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json, random\nrandom.seed(0)\nqueues = {"billing": ["refund", "invoice", "charged twice", "cancel subscription"],\n          "mobile-bugs": ["app crashes", "black screen on launch", "upload fails on iOS"],\n          "auth": ["cannot log in", "2FA code never arrives", "password reset loop"]}\nsev = ["P1", "P2", "P3"]\nrows = []\nfor q, topics in queues.items():\n    for t in topics:\n        for i in range(25):\n            s = random.choice(sev)\n            user = f"Ticket #{1000+i}: {t} - customer reports this {random.choice([\'daily\',\'since the update\',\'intermittently\'])}"\n            rows.append({"messages": [\n                {"role": "system", "content": "You are a triage engine. Output only JSON with keys queue and severity."},\n                {"role": "user", "content": user},\n                {"role": "assistant", "content": json.dumps({"queue": q, "severity": s})}]})\nrandom.shuffle(rows)\njson.dump(rows[:260], open("train.json", "w"))\njson.dump(rows[260:], open("heldout.json", "w"))\nprint(len(rows), "examples written")\nEOF</code></pre>' +
          '<p>Note what we just did badly on purpose: severity is <em>random</em>, so it is unlearnable. Watch what the model does with it in step 4 — a miniature lesson in label noise setting a hard ceiling.</p>'
      },
      {
        title: 'Inspect the rendered template before training (always)',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json\nfrom transformers import AutoTokenizer\ntok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-1B-Instruct")\nex = json.load(open("train.json"))[0]\nprint(tok.apply_chat_template(ex["messages"], tokenize=False))\nlens = [len(tok.apply_chat_template(e["messages"])) for e in json.load(open("train.json"))]\nprint("max tokenized length:", max(lens))\nEOF</code></pre>' +
          '<p>Eyeball the special tokens (<code>&lt;|start_header_id|&gt;</code> etc.) and confirm max length fits your <code>max_seq_len</code> — the truncation bug from the lesson dies here. Any instruct model works if Llama access is pending: <code>Qwen/Qwen2.5-1.5B-Instruct</code> is Apache-2.0 with no gate.</p>'
      },
      {
        title: 'Train with QLoRA + assistant-only loss',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport torch, json\nfrom datasets import Dataset\nfrom transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig\nfrom peft import LoraConfig\nfrom trl import SFTTrainer, SFTConfig\n\nmid = "meta-llama/Llama-3.2-1B-Instruct"\nbnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",\n                         bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)\nmodel = AutoModelForCausalLM.from_pretrained(mid, quantization_config=bnb, device_map="auto")\nds = Dataset.from_list(json.load(open("train.json")))\n\npeft_cfg = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM",\n    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"])\ncfg = SFTConfig(output_dir="triage-lora", num_train_epochs=2, per_device_train_batch_size=4,\n    gradient_accumulation_steps=4, learning_rate=1e-4, lr_scheduler_type="cosine",\n    warmup_ratio=0.05, logging_steps=5, max_length=512, assistant_only_loss=True,\n    gradient_checkpointing=True, report_to="none")\nSFTTrainer(model=model, train_dataset=ds, args=cfg, peft_config=peft_cfg).train()\nEOF</code></pre>' +
          '<p>Everything from the lessons is in this config: NF4 + double quantization, all-linear targets, r=16/α=32 (scale 2), 2 epochs, cosine + warmup, gradient checkpointing, and <code>assistant_only_loss</code> doing the −100 masking. Training takes ~5–15 minutes on a T4. Watch the loss: it should drop fast and flatten — if it grinds toward zero, you are memorizing 260 examples.</p>'
      },
      {
        title: 'The honest eval: tuned vs few-shot baseline, plus a forgetting probe',
        html: '<pre><code>python3 - &lt;&lt;\'EOF\'\nimport json, torch\nfrom transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig\nfrom peft import PeftModel\n\nmid = "meta-llama/Llama-3.2-1B-Instruct"\ntok = AutoTokenizer.from_pretrained(mid)\nbnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",\n                         bnb_4bit_compute_dtype=torch.bfloat16)\nbase = AutoModelForCausalLM.from_pretrained(mid, quantization_config=bnb, device_map="auto")\n\ndef run(model, messages):\n    ids = tok.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt").to(model.device)\n    out = model.generate(ids, max_new_tokens=40, do_sample=False)\n    return tok.decode(out[0][ids.shape[1]:], skip_special_tokens=True)\n\ndef score(model, fewshot):\n    ok_json, ok_queue = 0, 0\n    held = json.load(open("heldout.json"))\n    for ex in held:\n        msgs = list(fewshot) + [ex["messages"][0], ex["messages"][1]]\n        txt = run(model, msgs).strip()\n        try:\n            pred = json.loads(txt)\n            ok_json += 1\n            gold = json.loads(ex["messages"][2]["content"])\n            ok_queue += int(pred.get("queue") == gold["queue"])\n        except Exception: pass\n    n = len(held)\n    print(f"  json-valid {ok_json}/{n}   queue-correct {ok_queue}/{n}")\n\nshots = json.load(open("train.json"))[0]["messages"]  # 1-shot baseline\nprint("BASE + few-shot:"); score(base, shots)\ntuned = PeftModel.from_pretrained(base, "triage-lora/checkpoint-32")  # use your last checkpoint dir\nprint("TUNED, zero-shot:"); score(tuned, [])\nprint("Forgetting probe:", run(tuned, [{"role": "user", "content": "Explain what a mutex is in two sentences."}]))\nEOF</code></pre>' +
          '<p>Read the three results like a reviewer: (1) the tuned model should hit ~100% JSON-validity and high queue accuracy with <em>zero</em> few-shot tokens — that token saving is the production win; (2) severity accuracy will hover near 33% for both — random labels are unlearnable, and no hyperparameter will fix your data for you; (3) the mutex answer checks the model still speaks — if it replies in triage JSON, you have witnessed catastrophic forgetting on a 260-example diet. Try 8 epochs and watch the probe degrade for real.</p>'
      },
      {
        title: 'Ship artifact and cleanup',
        html: '<pre><code># the deliverable is ~50–100 MB of adapter, not a 2.5 GB checkpoint\nls -lh triage-lora/checkpoint-*/adapter_model.safetensors\n\n# optional: merge for standalone serving\npython3 -c "from peft import AutoPeftModelForCausalLM as M; \\\n  M.from_pretrained(\'triage-lora/checkpoint-32\').merge_and_unload().save_pretrained(\'triage-merged\')"</code></pre>' +
          '<p>Version the trio together — dataset hash, base model id, adapter — because any one changing changes prod behavior. If you rented a GPU, <b>terminate the instance now</b>, not after coffee: an idle A100 bills the same as a busy one.</p>'
      }
    ],
    costNote: 'Worst case ~$1: Colab T4 free tier covers the whole lab; a rented RTX 4090 at ~$0.40/hr (early-2026 marketplace pricing) needs under 2 hours. No API spend. Cleanup: terminate any rented GPU instance immediately and delete large checkpoints (<code>rm -rf triage-lora triage-merged</code>) if disk is billed; the base model cache (~2.5 GB) lives in <code>~/.cache/huggingface</code>.'
  }
});
