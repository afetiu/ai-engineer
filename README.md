# AI Engineer — Interactive Course

A complete, self-contained interactive course that takes a senior software engineer
from "I've shipped systems for 10 years" to fluent in AI engineering — LLM internals,
tokens & sampling, prompting, model APIs, structured outputs, embeddings, RAG, context
engineering, agents, evals, observability, safety, fine-tuning, inference internals,
open models, multimodal, cost/latency, production patterns, system design, the frontier,
and interviewing.

No "what is AI" fluff. It goes straight to mental models, internals, trade-offs, real
numbers, and failure modes — the things that get probed in interviews and bite you in
production.

## Run it

It's vanilla HTML/CSS/JS — **no build step, no npm install, no framework.**

```bash
# Option A: just open the file
open index.html            # macOS  (or double-click it)

# Option B: serve it (needed for some browsers' file:// restrictions)
python3 -m http.server 8000
# then visit http://localhost:8000
```

That's the whole setup. Everything runs in the browser; progress is saved to
`localStorage`.

## What's inside

- **22 modules** across two tracks (Core AI Engineering 01–13, Advanced & Production
  14–22). Each module has 5–8 deep lessons in collapsible sections with recurring
  callouts (*Under the hood*, *Production gotcha*, *Limits that matter*, *Interview lens*),
  a 4-level "intuition builder", a 12–15 question scenario quiz with full answer
  dissections and an 80% mastery bar, 15–25 spaced-repetition flashcards, and a hands-on
  lab with real API/CLI snippets.
- **15+ interactive diagrams** — clickable SVG architectures (transformer forward pass,
  RAG pipeline, the agent loop, tool-calling round trip, MCP, KV cache, speculative
  decoding, continuous batching, multi-agent orchestrator, prompt-injection paths,
  eval pipeline, SFT→DPO, streaming, model routing, VRAM budget) with step-through
  animated flows.
- **12+ simulators** — tokenizer playground, sampling simulator, cost calculator,
  context-window budget, embedding similarity explorer, chunking visualizer, RAG
  precision/recall, VRAM calculator, batching latency/throughput, agent step-budget,
  LLM-as-judge agreement, fine-tune-vs-prompt crossover.
- **Speed drill** — a 75-second arcade matching scenario phrases to the right technique
  (130+ items), with a personal best.
- **9 missions** — real builds in *your* environment with real APIs, in three tiers
  (Base camp / Ascent / Summit): a RAG bot, a from-scratch agent loop, an eval harness,
  a LoRA fine-tune, an MCP/tool agent, a red-team-and-patch, a production support agent,
  and more. Each has a brief, persisted acceptance criteria, collapsed hints, a full
  walkthrough, time/cost estimates, and a cleanup/spend-check.
- **Two timed mock exams** (65 questions, 100 minutes each — core and advanced) with a
  question navigator, flagging, per-domain score breakdown, and full post-exam review.
- **My notes** — select any text anywhere to save a note; manage them with
  To-learn/Learned filters and links back to the source.
- **Ask AI** — select text and ask your own OpenAI-compatible model about it (key stays
  on your device).

## The study loop

1. **Dashboard** → follow the *Suggested next step*.
2. **Read** a module's lessons; expand the callouts; flip to the *Intuition* tab if a
   concept hasn't clicked.
3. **Quiz** yourself — aim for the 80% mastery bar; read every dissection, including the
   wrong options.
4. **Flashcards** — do the daily *Flashcard review* (sidebar shows the due count). The
   Leitner schedule (boxes due in 0/1/3/7/14 days) beats cramming.
5. **Play** — a simulator or diagram for the module to build number-sense.
6. **Drill** — a 75-second speed run when you have a spare minute.
7. **Build** — a mission once the material sticks. Reading about agents ≠ debugging one.
8. **Exam** — pressure-test under the clock before you consider a track done.

Readiness per track is estimated as a weighted blend of lessons read (40%), best quiz
scores (35%), and best exam score (25%).

## Data, sync & privacy

- **All progress** (lessons, quiz/exam scores, flashcard schedule, missions, notes) lives
  in a single `localStorage` key with a forward-compatible schema (`blankStore()` keys are
  backfilled on load/import, so old exports keep working).
- **Export / import JSON** in Settings.
- **Optional cross-device sync** via a private GitHub Gist: create a fine-grained PAT with
  **only the gist scope**, paste it in Settings, and Push/Pull/Smart-sync (last-writer-wins
  by `savedAt` timestamp).
- **Secrets never leave your device**: your Ask-AI API key and gist token are stored in a
  *separate* localStorage key and are **excluded from exports and sync**.

## Content authoring

Content is data, registered into a global `window.COURSE` registry by plain `<script>`
files under `content/`. To add or edit a module, diagram, simulator, drill, mission, or
exam, follow **[content/AUTHORING.md](content/AUTHORING.md)** and validate:

```bash
node tools/validate.js            # schema check (referenced-but-missing files = warnings)
node tools/validate.js --complete # also enforce full-course counts (used in CI)
```

The validator checks every quiz/exam answer index is in range, `multi` is set whenever
there are multiple answers, every lesson has id/title/html, no duplicate ids, every
flashcard has front/back, diagram step edges exist, and more — and exits non-zero on any
problem.

An optional headless smoke test clicks through every major view (requires a globally
installed Playwright + Chromium):

```bash
NODE_PATH=$(npm root -g) node tools/smoke.js
```

## Project layout

```
index.html                 defines window.COURSE, loads content scripts, then app.js
app.js                     the whole engine: hash router, all views, state, sync
styles.css                 one stylesheet; warm parchment theme; mobile drawer <=900px
content/
  modules/mNN-*.js         one file per module (COURSE.register)
  explainers/*.js          intuition builders (COURSE.registerExplainer)
  diagrams/*.js            interactive diagrams (COURSE.registerDiagram)
  widgets.js               simulators (COURSE.registerWidget)
  drills.js                speed-drill items (COURSE.registerDrills)
  missions/missions.js     project briefs (COURSE.registerMission)
  exams/*.js               timed mock exams (COURSE.registerExam)
  AUTHORING.md             the content schema, documented
tools/
  validate.js              schema validator (CI gate)
  smoke.js                 headless-browser smoke test
.github/workflows/
  deploy-pages.yml         validate + publish to gh-pages on every push
```

## Deployment

Pushing to the working branch runs `node tools/validate.js --complete` and, on success,
force-publishes the tree to the `gh-pages` branch — so every push goes live on GitHub
Pages automatically. Enable Pages for the repo (Settings → Pages → Branch: `gh-pages`).

## A note on freshness

This field moves fast. Volatile claims (specific prices, context-window sizes, VRAM
figures, model rankings) are date-stamped "as of early 2026" and taught *after* the
durable mental model, so the reasoning survives even when the numbers change. When in
doubt, measure on your own data — that advice never goes stale.
