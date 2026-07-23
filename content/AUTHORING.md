# Content authoring guide

All content lives in plain `.js` files loaded as `<script>` tags by `index.html`
(add a `<script>` line there for every new file). Each file registers content into
the global `COURSE` registry. **No build step, no imports/exports, no template
literals containing `</script>`.** Run `node tools/validate.js` after every edit.

Audience & voice: written for a **senior software engineer (10 yrs)** who is new to
AI engineering. Skip "what is AI" fluff. Lead with the mental model, then internals,
trade-offs, real numbers (context window sizes, $/Mtok prices, VRAM math — date-stamp
volatile ones "as of early 2026"), production war stories, and failure modes.
Vendor-neutral: OpenAI, Anthropic, Google, and open-source covered evenhandedly.

HTML in content strings is trusted (we author it); it is inserted with innerHTML.
Never interpolate user input into content HTML.

## Module — `content/modules/mNN-slug.js`

```js
COURSE.register({
  id: 'm07-rag',            // unique, kebab, starts mNN-
  track: 'core',            // 'core' (01-13) | 'advanced' (14-22)
  order: 7,                 // unique integer, drives sidebar order
  title: 'RAG',             // full title
  short: 'RAG',             // short sidebar label
  tagline: 'One-sentence hook for the module header.',
  minutes: 90,              // estimated study time
  lessons: [ /* 5-8 items */
    {
      id: 'pipeline',       // unique within module
      title: 'The full pipeline',
      blurb: 'Optional one-liner shown on the lesson tile.',
      html: '<h2>Section heading</h2><p>…</p>'  // see "Lesson HTML" below
    }
  ],
  quiz: [ /* 12-16 scenario questions */
    {
      text: 'Your agent occasionally deletes the wrong file. Which TWO changes most reduce blast radius?',
      options: ['…', '…', '…', '…', '…'],   // 4-6 options
      answer: [1, 3],       // indices; single answer = [2]
      multi: true,          // REQUIRED true when answer.length > 1
      explanation: 'Why the right answers are right AND why each wrong option is wrong. Plain HTML allowed.'
    }
  ],
  flashcards: [ /* 15-25 */
    { id: 'fc1', front: 'Question side (HTML ok)', back: 'Answer side (HTML ok)' }
  ],
  lab: {
    title: 'Build X with real tools',
    intro: '<p>What you will build, what you need (API key, python3), and rough cost.</p>',
    steps: [ { title: 'Set up', html: '<pre><code>pip install …</code></pre><p>…</p>' } ],
    costNote: 'Worst-case spend $0.40. Delete the test index afterwards: <code>…</code>'  // required when API spend is involved
  }
});
```

### Lesson HTML conventions

- 3+ `<h2>` sections per lesson — the app auto-splits lessons into accordions on `<h2>`.
  `<h3>` stays inline within a section.
- Substantial: aim 700–1200 words per lesson. Tables (`<table>`) for option comparisons.
- Code samples: `<pre><code>…</code></pre>`, Python/CLI-first. Escape `<` as `&lt;` inside code.
- Recurring callouts — use liberally, ≥3 kinds per lesson where sensible:

```html
<div class="callout hood"><span class="co-title">Under the hood</span> internals…</div>
<div class="callout gotcha"><span class="co-title">Production gotcha</span> war story…</div>
<div class="callout limits"><span class="co-title">Limits that matter</span> windows, rate limits, cost…</div>
<div class="callout interview"><span class="co-title">Interview lens</span> how this gets probed…</div>
<div class="callout note"><span class="co-title">Key idea</span> the durable mental model…</div>
```

### Quiz rules

Scenario-based, never trivia recall. Wrong options must be *plausible* — things a
smart engineer might actually pick. The explanation dissects every option.

## Explainer (intuition builder) — `content/explainers/*.js`

One per module. Exactly 4 levels: everyday analogy → precise technical → internals → sharp edges.

```js
COURSE.registerExplainer({
  id: 'x-rag', moduleId: 'm07-rag', title: 'RAG in four passes',
  levels: [
    { name: '🏠 Analogy', html: '<p>…</p>' },
    { name: '🔬 Technical', html: '<p>…</p>' },
    { name: '⚙️ Internals', html: '<p>…</p>' },
    { name: '🔪 Sharp edges', html: '<p>…</p>' }
  ]
});
```

## Diagram — `content/diagrams/*.js`

Rendered generically by the engine (rounded rects + arrow edges + step-through).
Coordinate space is the `viewBox` you set with `w`/`h` (default 900×420).

```js
COURSE.registerDiagram({
  id: 'rag-pipeline', moduleId: 'm07-rag',
  title: 'RAG: ingest → retrieve → generate',
  caption: 'One-liner shown on the tile and page header.',
  w: 940, h: 430,
  nodes: [
    // kind: 'proc' (default, parchment) | 'model' (violet) | 'store' (green) | 'io' (blue) | 'danger' (red)
    { id: 'docs', label: 'Source docs', x: 20, y: 40, w: 120, h: 46, kind: 'io',
      info: 'Shown in the side panel when clicked. HTML ok. Explain what happens inside.' }
  ],
  edges: [ { from: 'docs', to: 'chunker', label: 'raw text' } ],  // optional dashed: true
  steps: [  // >=3; step-through lights these up
    { title: 'Ingest', desc: 'What is happening at this step (HTML ok).',
      nodes: ['docs', 'chunker'], edges: [['docs', 'chunker']] }
  ]
});
```

Layout tips: 46-high nodes, ~120-170 wide; leave 60+px between columns so arrows read.
Multi-line labels: `\n` in the label string.

## Widget (simulator) — `content/widgets.js`

```js
COURSE.registerWidget({
  id: 'cost-calc', moduleId: 'm04-model-apis',
  title: 'API cost calculator', desc: 'Tile + page subtitle.',
  render(root, H) {   // H = {esc, fmtInt, fmtMoney, clamp, onCleanup}
    root.innerHTML = '…sliders + outputs…';
    // wire up listeners; use H.onCleanup(fn) for timers.
  }
});
```

Slider row markup convention:
`<div class="sim-row"><span class="lbl">Label</span><input type="range" …><span class="val" id="…"></span></div>`
Outputs in `<div class="sim-out">…</div>`; big numbers with `<span class="big">`.

## Drills — `content/drills.js`

```js
COURSE.registerDrills({ id: 'main', items: [
  { prompt: 'need grounded answers over private docs', answer: 'RAG',
    why: 'Private + factual + changing = retrieval, not fine-tuning.' }
]});
```

`answer` strings double as the distractor pool — keep them short, reuse the same
canonical technique names across items (aim ~25-40 distinct answers over ~130 items).

## Mission — `content/missions/missions.js`

```js
COURSE.registerMission({
  id: 'rag-notes-bot', level: 'base',   // base | ascent | summit
  title: 'RAG chatbot over your own notes',
  summary: 'Tile one-liner.',
  time: '2-3 h', cost: '≤ $1',
  brief: '<p>Realistic situation brief…</p>',
  criteria: ['Observable acceptance criterion 1', '…'],   // >=5 recommended
  hints: ['<p>hint 1 html</p>', '<p>hint 2</p>'],
  walkthrough: '<h2>Step 1</h2><p>full solution…</p>',
  cleanup: 'Spend check + what to delete (HTML).'
});
```

## Exam — `content/exams/*.js`

```js
COURSE.registerExam({
  id: 'exam-core', track: 'core',
  title: 'Core AI Engineering — Mock Exam 1',
  blurb: 'Tile description.', minutes: 100,
  questions: [ /* exactly 65; same shape as quiz questions PLUS: */
    { domain: 'RAG & retrieval', text: '…', options: […], answer: [0], explanation: '…' }
  ]
});
```

Use 6-9 recurring domains per exam so the per-domain breakdown is meaningful.

## Checklist before committing

1. `node tools/validate.js` → exits 0.
2. Every new file added as a `<script>` in `index.html`.
3. No `</script>` inside any content string (breaks the page). Write `<\/script>` if needed.
4. IDs kebab-case and unique. `answer` indices in range. `multi: true` whenever answer.length > 1.
