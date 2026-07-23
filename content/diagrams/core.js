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

COURSE.registerDiagram({
  id: 'streaming-delivery',
  moduleId: 'm04-model-apis',
  title: 'Streaming token delivery to the browser',
  caption: 'How one token travels from GPU decode to pixels — and why streaming wins on feel, not physics.',
  w: 940, h: 440,
  nodes: [
    { id: 'model', label: 'Model server\n(GPU decode)', x: 20, y: 110, w: 150, h: 52, kind: 'model',
      info: 'Prefill processes the whole prompt in one parallel pass (compute-bound), then decode emits one token per forward pass (memory-bandwidth-bound). The provider flushes each delta the moment it is sampled — buffering here would destroy the entire point of streaming. Prefill time is what you experience as TTFT: it scales roughly linearly with prompt length.' },
    { id: 'sse', label: 'SSE chunk\nstream', x: 230, y: 110, w: 140, h: 52, kind: 'io',
      info: 'Server-Sent Events over a single long-lived HTTP response: <code>Content-Type: text/event-stream</code>, each event a <code>data: {json}</code> line pair, terminated by a sentinel (<code>data: [DONE]</code> or an explicit stop event). Crucially the HTTP status is 200 <em>before generation finishes</em> — success of the connection says nothing about success of the generation. One network chunk may carry several events, or half of one.' },
    { id: 'gateway', label: 'API gateway /\nLB', x: 430, y: 110, w: 140, h: 52,
      info: 'The classic streaming killer. Default nginx/ALB/CDN configs buffer responses for efficiency, turning your stream into one big blob delivered at the end. You need <code>proxy_buffering off</code> (or <code>X-Accel-Buffering: no</code>), long idle timeouts (a slow model can go 20s+ between tokens on a busy GPU), and HTTP/1.1 chunked or HTTP/2 pass-through the whole way down.' },
    { id: 'backend', label: 'Your backend\n(parse & relay)', x: 630, y: 110, w: 150, h: 52,
      info: 'Reads the upstream byte stream, reassembles it into events (buffer until the <code>\\n\\n</code> event separator, split on <code>data: </code>, JSON-parse each delta), then re-emits to the browser — usually as your own SSE stream. This is where you inject app logic: token counting, moderation of partial text, logging the accumulated string, and translating provider-specific event shapes into one internal format.' },
    { id: 'browser', label: 'Browser\nrender loop', x: 630, y: 280, w: 150, h: 52, kind: 'io',
      info: 'EventSource or fetch + ReadableStream. Appending to the DOM per token at 60+ tokens/sec causes layout thrash — production UIs batch deltas with requestAnimationFrame and re-render at most once per frame. Markdown mid-stream is its own problem: an unclosed code fence renders the rest of the message as code until the closing fence arrives.' },
    { id: 'error', label: 'Mid-stream\nerror', x: 430, y: 280, w: 140, h: 50, kind: 'danger',
      info: 'Because the 200 already went out, failures arrive <em>inside</em> the stream: an <code>error</code> event, an abrupt TCP close, or silence past your idle timeout. You now hold a partial answer. Choices: surface the partial with a retry affordance, or retry server-side and dedupe — naive retry-and-append shows the user the first half twice. Never bill or log a partial as complete.' },
    { id: 'user', label: 'Perceived\nlatency', x: 230, y: 280, w: 140, h: 50, kind: 'io',
      info: 'The psychology node. Users judge responsiveness by time-to-first-visible-progress, not time-to-completion. A 500ms TTFT with tokens flowing feels faster than a 4s spinner followed by an instant full answer — even when total wall-clock time is identical. Streaming buys you nothing physically; it buys you everything perceptually.' }
  ],
  edges: [
    { from: 'model', to: 'sse', label: 'token deltas' },
    { from: 'sse', to: 'gateway' },
    { from: 'gateway', to: 'backend', label: 'byte chunks' },
    { from: 'backend', to: 'browser', label: 'app SSE' },
    { from: 'browser', to: 'user', label: 'text appears' },
    { from: 'sse', to: 'error', label: 'stream drops', dashed: true },
    { from: 'error', to: 'browser', label: 'partial + retry', dashed: true }
  ],
  steps: [
    { title: 'Prefill: the TTFT clock is running', desc: 'The request lands and the model server runs prefill over the entire prompt before a single output token exists. This is the dominant component of time-to-first-token — a 50k-token prompt can add seconds. Nothing has reached the user yet.', nodes: ['model'], edges: [] },
    { title: 'First token → first SSE event', desc: 'The first sampled token is flushed immediately as a <code>data:</code> event on an already-open HTTP response. TTFT stops here from the provider\'s perspective — everything downstream is your infrastructure\'s problem to not ruin.', nodes: ['model', 'sse'], edges: [['model', 'sse']] },
    { title: 'Surviving the gateway', desc: 'Every proxy hop must forward chunks without buffering, or the user sees nothing until the very end. Watch idle timeouts too: a 10s gap between tokens on a loaded GPU will trip default LB timeouts and kill a healthy stream.', nodes: ['sse', 'gateway'], edges: [['sse', 'gateway']] },
    { title: 'Backend parses chunk boundaries', desc: 'TCP chunks do not align with SSE events — your parser buffers bytes, splits on blank lines, and JSON-decodes each delta. The backend accumulates the full text for logging and re-emits clean events to the browser.', nodes: ['gateway', 'backend'], edges: [['gateway', 'backend']] },
    { title: 'Render loop batches deltas', desc: 'The browser appends deltas to state and re-renders once per animation frame, not once per token. Text flows in front of the user while the model is still generating the ending.', nodes: ['backend', 'browser'], edges: [['backend', 'browser']] },
    { title: 'Error mid-stream: the 200 lied', desc: 'The connection dies at token 300 of 800. The HTTP layer already said 200, so the failure is an in-stream event or a dead socket. Show the partial with a retry option or retry-and-dedupe server-side — and make sure billing and logs mark it incomplete.', nodes: ['error', 'browser'], edges: [['sse', 'error'], ['error', 'browser']] },
    { title: 'Perceived beats real', desc: 'Total generation time is unchanged by streaming — the win is that visible progress starts ~10× sooner. Optimize TTFT (shorter prompts, prompt caching) before optimizing tokens/sec: the first number is the one users feel.', nodes: ['browser', 'user'], edges: [['browser', 'user']] }
  ]
});

COURSE.registerDiagram({
  id: 'tool-calling-roundtrip',
  moduleId: 'm05-structured-outputs',
  title: 'Tool-calling round trip',
  caption: 'The model never runs anything — it emits JSON asking you to. One full loop, including the repair path.',
  w: 940, h: 400,
  nodes: [
    { id: 'user', label: 'User\nmessage', x: 20, y: 50, w: 130, h: 50, kind: 'io',
      info: 'The conversation so far plus tool schemas (name, description, JSON Schema parameters) travel to the API on <em>every</em> call. Tool definitions are prompt content — they consume tokens and the description text materially changes when the model chooses to call the tool.' },
    { id: 'llm', label: 'LLM\ndecides', x: 210, y: 50, w: 140, h: 54, kind: 'model',
      info: 'The model weighs answering directly vs. emitting a tool call — a next-token prediction shaped by the tool descriptions, not a symbolic planner. It can hallucinate tool names, invent parameters, or call a tool when it should not (and vice versa). <code>tool_choice</code> lets you force or forbid calls when you already know the right move.' },
    { id: 'toolcall', label: 'tool_call\nJSON', x: 420, y: 50, w: 140, h: 50,
      info: 'The response arrives with a stop reason of <code>tool_calls</code>/<code>tool_use</code> and a payload: tool name plus arguments as a JSON string you must parse. Arguments were generated token-by-token — they can be truncated by max_tokens, contain trailing commas, or omit required fields. Treat this as untrusted input from an eager intern.' },
    { id: 'validate', label: 'Validate\nagainst schema', x: 650, y: 50, w: 150, h: 50,
      info: 'Parse the JSON, validate against the declared schema (types, required fields, enums), then apply <em>business</em> checks the schema cannot express: does this order ID belong to this user? Is the amount under the refund limit? Constrained decoding guarantees syntax, never semantics — the well-formed call can still target the wrong record.' },
    { id: 'repair', label: 'Repair loop\n(re-prompt)', x: 650, y: 170, w: 150, h: 50, kind: 'danger',
      info: 'On validation failure, do not crash and do not silently guess. Append a tool-result message containing the precise validator error (\'expected ISO-8601 date, got "tomorrow"\') and call the model again — it usually self-corrects in one attempt. Cap retries at 2–3; a model that fails schema validation three times running is telling you the tool description or schema is the real bug.' },
    { id: 'exec', label: 'Execute tool\n(your code)', x: 650, y: 290, w: 150, h: 50,
      info: 'Your process makes the actual DB query or API request, with the tool\'s own credentials and timeouts — the model has no execution capability whatsoever. Enforce least privilege here: the executor, not the model, is the security boundary. Side-effecting tools deserve idempotency keys, because loops retry.' },
    { id: 'result', label: 'Tool result\nappended', x: 420, y: 290, w: 140, h: 50, kind: 'io',
      info: 'The result goes back as a new message referencing the tool_call id, and the <em>entire</em> grown conversation is resent — the API is stateless, so every round trip re-pays the full prompt (prompt caching exists precisely for this). Errors belong here too, as readable text: \'404: order not found\' lets the model recover; a raw stack trace mostly confuses it.' },
    { id: 'answer', label: 'Final\nanswer', x: 210, y: 290, w: 140, h: 50, kind: 'io',
      info: 'On a later pass the model, now holding real data, responds with plain text instead of another tool call — the loop\'s terminating condition is simply \'no tool_calls in the response\'. Multi-step tasks may take several round trips first, so production loops also enforce a hard iteration cap.' }
  ],
  edges: [
    { from: 'user', to: 'llm' },
    { from: 'llm', to: 'toolcall', label: 'stop: tool_use' },
    { from: 'toolcall', to: 'validate' },
    { from: 'validate', to: 'exec', label: 'valid' },
    { from: 'validate', to: 'repair', label: 'invalid', dashed: true },
    { from: 'repair', to: 'llm', label: 'error msg back', dashed: true },
    { from: 'exec', to: 'result' },
    { from: 'result', to: 'llm', label: 'resend grown convo' },
    { from: 'llm', to: 'answer', label: 'no tool call' }
  ],
  steps: [
    { title: 'Request with tool schemas', desc: 'The user message ships with every tool\'s name, description, and JSON Schema. The model reads these as text — a vague description is the #1 cause of wrong-tool and no-tool decisions.', nodes: ['user', 'llm'], edges: [['user', 'llm']] },
    { title: 'Model emits a tool call', desc: 'Instead of prose, the response stops with <code>tool_use</code>: a tool name and generated JSON arguments. Nothing has executed — this is a structured <em>request</em> aimed at your code.', nodes: ['llm', 'toolcall'], edges: [['llm', 'toolcall']] },
    { title: 'Validate before you trust', desc: 'Parse and check the arguments against the schema, then run business-rule checks the schema can\'t encode. Generated JSON fails in mundane ways: wrong types, missing required fields, or a perfectly-formed call against the wrong entity.', nodes: ['toolcall', 'validate'], edges: [['toolcall', 'validate']] },
    { title: 'Error path: the repair loop', desc: 'Validation failed — so feed the exact validator error back to the model as the tool result and let it retry. One precise error message fixes most failures; after 2–3 strikes, bail to a fallback instead of looping forever.', nodes: ['validate', 'repair', 'llm'], edges: [['validate', 'repair'], ['repair', 'llm']] },
    { title: 'Execute and append the result', desc: 'The validated call runs in your code with your credentials and limits. The result — or a readable error — is appended to the conversation as a tool-result message tied to the call\'s id.', nodes: ['exec', 'result'], edges: [['validate', 'exec'], ['exec', 'result']] },
    { title: 'Model continues to a final answer', desc: 'The whole conversation, now containing real data, goes back to the stateless API. The model answers in plain text; \'no tool call in the response\' is what ends the loop. Every round trip re-sent the full history — that\'s the token bill of agency.', nodes: ['result', 'llm', 'answer'], edges: [['result', 'llm'], ['llm', 'answer']] }
  ]
});
