/* Interactive diagrams — modules 01–05 territory. */

COURSE.registerDiagram({
  id: 'transformer-forward',
  moduleId: 'm01-how-llms-work',
  title: 'Transformer forward pass',
  caption: 'One decode step: from token IDs to the next-token distribution.',
  w: 940, h: 460,
  nodes: [
    { id: 'input', label: 'Prompt tokens', x: 20, y: 200, w: 130, h: 50, kind: 'io',
      info: 'Token IDs from the tokenizer — opaque integers, not characters. The model\'s entire universe for this request is this sequence.' },
    { id: 'embed', label: 'Embedding\nlookup', x: 190, y: 200, w: 120, h: 50,
      info: 'Each token ID indexes a learned vector (d_model = 4k–16k dims in frontier models). Rotary position info (RoPE) is applied later, inside attention.' },
    { id: 'attn', label: 'Multi-head\nattention', x: 360, y: 90, w: 140, h: 50, kind: 'model',
      info: 'Every position emits a query; scores against all earlier keys (causal mask); softmax-weighted sum of values. O(n²) in context length. Heads specialize: copying, induction, syntax.' },
    { id: 'kv', label: 'KV cache', x: 360, y: 20, w: 140, h: 44, kind: 'store',
      info: 'Keys/values of all previous tokens, kept per layer so each new token computes only its own Q/K/V. Grows linearly with context — the VRAM cost of long conversations (module 15).' },
    { id: 'mlp', label: 'MLP\n(feed-forward)', x: 360, y: 310, w: 140, h: 50, kind: 'model',
      info: '~⅔ of all parameters. Interpretability evidence: MLPs store most factual associations; attention routes information between positions.' },
    { id: 'residual', label: 'Residual stream', x: 560, y: 200, w: 140, h: 50,
      info: 'The running per-token vector each sublayer reads from and adds back into — a shared bus accumulating information across 30–120 layers. Repeat attention+MLP N times.' },
    { id: 'unembed', label: 'Unembed →\nlogits', x: 750, y: 200, w: 130, h: 50,
      info: 'The final position\'s vector is projected onto the vocabulary: one logit per token (~100k–200k of them).' },
    { id: 'sample', label: 'Sample next\ntoken', x: 750, y: 330, w: 130, h: 50, kind: 'io',
      info: 'Temperature reshapes, top-p truncates, one token is sampled, appended to the sequence — and the whole loop runs again. This loop IS generation.' }
  ],
  edges: [
    { from: 'input', to: 'embed' },
    { from: 'embed', to: 'attn', label: 'Q·K·V' },
    { from: 'kv', to: 'attn', label: 'past K,V' },
    { from: 'attn', to: 'residual' },
    { from: 'embed', to: 'mlp', dashed: true },
    { from: 'mlp', to: 'residual' },
    { from: 'residual', to: 'unembed', label: '×N layers' },
    { from: 'unembed', to: 'sample', label: 'softmax' },
    { from: 'sample', to: 'input', label: 'append', dashed: true }
  ],
  steps: [
    { title: 'Tokenize & embed', desc: 'The prompt arrives as token IDs; each becomes a d_model-dimensional vector. No characters, no words — vectors from here on.', nodes: ['input', 'embed'], edges: [['input', 'embed']] },
    { title: 'Attention reads the past', desc: 'Each position queries all earlier positions (causal mask). During decode, past keys/values come from the KV cache instead of being recomputed — that cache is why long contexts eat VRAM.', nodes: ['attn', 'kv'], edges: [['embed', 'attn'], ['kv', 'attn']] },
    { title: 'MLP transforms', desc: 'The position-wise feed-forward network — most of the parameters, most of the stored facts — transforms each position independently.', nodes: ['mlp'], edges: [['embed', 'mlp']] },
    { title: 'Residual stream accumulates ×N', desc: 'Attention and MLP outputs add into the residual stream, layer after layer (30–120+). Early layers: syntax. Middle: semantics. Late: sharpening toward the next-token decision.', nodes: ['residual'], edges: [['attn', 'residual'], ['mlp', 'residual']] },
    { title: 'Logits over the vocabulary', desc: 'The last position\'s final vector is projected to ~200k logits — a score for every possible next token.', nodes: ['unembed'], edges: [['residual', 'unembed']] },
    { title: 'Sample, append, repeat', desc: 'Temperature and top-p reshape the distribution; one token is sampled and appended. The function runs again on n+1 tokens. Everything an LLM does is this loop.', nodes: ['sample', 'input'], edges: [['unembed', 'sample'], ['sample', 'input']] }
  ]
});
