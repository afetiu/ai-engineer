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
    { prompt: 'user pastes a webpage that hijacks your bot\'s instructions', answer: 'prompt injection defenses', why: 'Untrusted content in context = injection surface; isolate, mark, and constrain tool access.' }
  ]
});
