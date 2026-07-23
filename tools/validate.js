#!/usr/bin/env node
/* Schema validator for AI Engineer course content.
   Usage: node tools/validate.js [--complete]
   - Loads every content <script> referenced by index.html into a fake COURSE registry.
   - Validates the schema documented in content/AUTHORING.md.
   - Missing referenced files are warnings normally, errors with --complete
     (global count requirements are also only enforced with --complete).
   Exits non-zero on any error. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const COMPLETE = process.argv.includes('--complete');
const errors = [];
const warnings = [];
function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

/* ---- collect content scripts from index.html ---- */
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scriptRefs = [];
const re = /<script src="(content\/[^"]+)"><\/script>/g;
let m;
while ((m = re.exec(indexHtml)) !== null) scriptRefs.push(m[1]);
if (!scriptRefs.length) err('index.html references no content scripts');

// every .js file under content/ must be referenced, and vice versa
function walk(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (f.endsWith('.js')) out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out;
}
for (const f of walk(path.join(ROOT, 'content'))) {
  if (!scriptRefs.includes(f)) err('content file on disk but not loaded by index.html: ' + f);
}

/* ---- load scripts into sandbox ---- */
const COURSE = {
  modules: [], exams: [], widgets: [], diagrams: [], explainers: [], drills: [], missions: [],
  register(x) { this.modules.push(x); },
  registerExam(x) { this.exams.push(x); },
  registerWidget(x) { this.widgets.push(x); },
  registerDiagram(x) { this.diagrams.push(x); },
  registerExplainer(x) { this.explainers.push(x); },
  registerDrills(x) { this.drills.push(x); },
  registerMission(x) { this.missions.push(x); }
};
const sandbox = vm.createContext({ COURSE, window: { COURSE }, console });
for (const ref of scriptRefs) {
  const p = path.join(ROOT, ref);
  if (!fs.existsSync(p)) {
    (COMPLETE ? err : warn)('referenced content file missing: ' + ref);
    continue;
  }
  try {
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: ref });
  } catch (e) {
    err(ref + ' failed to execute: ' + e.message);
  }
}

/* ---- validation helpers ---- */
function isStr(x) { return typeof x === 'string' && x.trim().length > 0; }
function uniq(list, keyName, where) {
  const seen = new Set();
  for (const k of list) {
    if (seen.has(k)) err(where + ': duplicate ' + keyName + ' "' + k + '"');
    seen.add(k);
  }
}
function checkQuestion(q, where, requireDomain) {
  if (!isStr(q.text)) err(where + ': question missing text');
  if (!Array.isArray(q.options) || q.options.length < 3) err(where + ': needs >=3 options');
  else {
    q.options.forEach((o, i) => { if (!isStr(o)) err(where + ': option ' + i + ' empty'); });
    if (!Array.isArray(q.answer) || !q.answer.length) err(where + ': answer must be a non-empty array of indices');
    else {
      q.answer.forEach(a => {
        if (!Number.isInteger(a) || a < 0 || a >= q.options.length) err(where + ': answer index ' + a + ' out of range (0..' + (q.options.length - 1) + ')');
      });
      if (new Set(q.answer).size !== q.answer.length) err(where + ': duplicate answer indices');
      if (q.answer.length > 1 && !q.multi) err(where + ': multiple answers but multi flag not set');
      if (q.multi && q.answer.length < 2) err(where + ': multi flag set but fewer than 2 answers');
    }
  }
  if (!isStr(q.explanation)) err(where + ': missing explanation (dissection)');
  else if (q.explanation.length < 60) warn(where + ': explanation is thin (<60 chars) — dissect every wrong option');
  if (requireDomain && !isStr(q.domain)) err(where + ': exam question missing domain');
}

/* ---- modules ---- */
uniq(COURSE.modules.map(x => x.id), 'module id', 'modules');
uniq(COURSE.modules.map(x => x.order), 'module order', 'modules');
for (const mod of COURSE.modules) {
  const W = 'module ' + (mod.id || '?');
  if (!isStr(mod.id)) err(W + ': missing id');
  if (!isStr(mod.title)) err(W + ': missing title');
  if (!['core', 'advanced'].includes(mod.track)) err(W + ': track must be "core" or "advanced"');
  if (!Number.isInteger(mod.order)) err(W + ': order must be an integer');
  if (!isStr(mod.tagline)) warn(W + ': missing tagline');
  if (!Array.isArray(mod.lessons) || mod.lessons.length < 5) err(W + ': needs >=5 lessons (has ' + (mod.lessons || []).length + ')');
  else {
    uniq(mod.lessons.map(l => l.id), 'lesson id', W);
    mod.lessons.forEach(l => {
      const LW = W + '/lesson ' + (l.id || '?');
      if (!isStr(l.id)) err(LW + ': missing id');
      if (!isStr(l.title)) err(LW + ': missing title');
      if (!isStr(l.html)) err(LW + ': missing html');
      else if (l.html.length < 1500) warn(LW + ': lesson html is short (<1500 chars) — is it substantial?');
    });
  }
  if (!Array.isArray(mod.quiz) || mod.quiz.length < 12 || mod.quiz.length > 16) {
    err(W + ': quiz must have 12-16 questions (has ' + (mod.quiz || []).length + ')');
  }
  (mod.quiz || []).forEach((q, i) => checkQuestion(q, W + '/quiz#' + (i + 1), false));
  if (!Array.isArray(mod.flashcards) || mod.flashcards.length < 15 || mod.flashcards.length > 25) {
    err(W + ': flashcards must number 15-25 (has ' + (mod.flashcards || []).length + ')');
  }
  if (Array.isArray(mod.flashcards)) {
    uniq(mod.flashcards.map(c => c.id), 'flashcard id', W);
    mod.flashcards.forEach(c => {
      if (!isStr(c.id)) err(W + ': flashcard missing id');
      if (!isStr(c.front) || !isStr(c.back)) err(W + '/card ' + (c.id || '?') + ': flashcard needs front and back');
    });
  }
  if (!mod.lab || !isStr(mod.lab.title) || !Array.isArray(mod.lab.steps) || !mod.lab.steps.length) {
    err(W + ': lab needs title and >=1 steps');
  } else {
    mod.lab.steps.forEach((s, i) => { if (!isStr(s.title) || !isStr(s.html)) err(W + '/lab step ' + (i + 1) + ': needs title and html'); });
  }
}

/* ---- explainers ---- */
uniq(COURSE.explainers.map(x => x.id), 'explainer id', 'explainers');
for (const ex of COURSE.explainers) {
  const W = 'explainer ' + (ex.id || '?');
  if (!isStr(ex.id) || !isStr(ex.title)) err(W + ': needs id and title');
  if (!COURSE.modules.some(mm => mm.id === ex.moduleId)) (COMPLETE ? err : warn)(W + ': moduleId "' + ex.moduleId + '" does not match a module');
  if (!Array.isArray(ex.levels) || ex.levels.length !== 4) err(W + ': needs exactly 4 levels (analogy → technical → internals → sharp edges)');
  (ex.levels || []).forEach((lv, i) => { if (!isStr(lv.name) || !isStr(lv.html)) err(W + '/level ' + (i + 1) + ': needs name and html'); });
}

/* ---- diagrams ---- */
uniq(COURSE.diagrams.map(x => x.id), 'diagram id', 'diagrams');
for (const d of COURSE.diagrams) {
  const W = 'diagram ' + (d.id || '?');
  if (!isStr(d.id) || !isStr(d.title)) err(W + ': needs id and title');
  if (d.moduleId && !COURSE.modules.some(mm => mm.id === d.moduleId)) (COMPLETE ? err : warn)(W + ': unknown moduleId ' + d.moduleId);
  if (!Array.isArray(d.nodes) || d.nodes.length < 3) err(W + ': needs >=3 nodes');
  const ids = new Set();
  (d.nodes || []).forEach(n => {
    if (!isStr(n.id)) err(W + ': node missing id');
    if (ids.has(n.id)) err(W + ': duplicate node id ' + n.id);
    ids.add(n.id);
    ['x', 'y', 'w', 'h'].forEach(k => { if (typeof n[k] !== 'number') err(W + '/node ' + n.id + ': missing numeric ' + k); });
    if (!isStr(n.label)) err(W + '/node ' + n.id + ': missing label');
    if (!isStr(n.info)) warn(W + '/node ' + n.id + ': no info panel text');
  });
  (d.edges || []).forEach(e => {
    if (!ids.has(e.from) || !ids.has(e.to)) err(W + ': edge ' + e.from + '→' + e.to + ' references unknown node');
  });
  if (!Array.isArray(d.steps) || d.steps.length < 3) err(W + ': needs a step-through with >=3 steps');
  (d.steps || []).forEach((s, i) => {
    const SW = W + '/step ' + (i + 1);
    if (!isStr(s.title) || !isStr(s.desc)) err(SW + ': needs title and desc');
    (s.nodes || []).forEach(n => { if (!ids.has(n)) err(SW + ': unknown node ' + n); });
    (s.edges || []).forEach(e => {
      if (!Array.isArray(e) || e.length !== 2) { err(SW + ': step edge must be [from,to]'); return; }
      if (!(d.edges || []).some(de => de.from === e[0] && de.to === e[1])) err(SW + ': step edge ' + e[0] + '→' + e[1] + ' not in diagram edges');
    });
  });
}

/* ---- widgets ---- */
uniq(COURSE.widgets.map(x => x.id), 'widget id', 'widgets');
for (const w of COURSE.widgets) {
  const W = 'widget ' + (w.id || '?');
  if (!isStr(w.id) || !isStr(w.title)) err(W + ': needs id and title');
  if (typeof w.render !== 'function') err(W + ': render must be a function(el, helpers)');
  if (w.moduleId && !COURSE.modules.some(mm => mm.id === w.moduleId)) (COMPLETE ? err : warn)(W + ': unknown moduleId ' + w.moduleId);
}

/* ---- drills ---- */
let drillItems = [];
for (const d of COURSE.drills) {
  if (!Array.isArray(d.items)) { err('drills: registerDrills object needs items[]'); continue; }
  drillItems = drillItems.concat(d.items);
}
drillItems.forEach((it, i) => {
  if (!isStr(it.prompt)) err('drill#' + (i + 1) + ': missing prompt');
  if (!isStr(it.answer)) err('drill#' + (i + 1) + ': missing answer');
  if (!isStr(it.why)) err('drill#' + (i + 1) + ': missing why (shown on wrong answers)');
});
if (new Set(drillItems.map(x => x.answer)).size < 8 && drillItems.length >= 8) {
  err('drills: need at least 8 distinct answers to build distractors');
}

/* ---- missions ---- */
uniq(COURSE.missions.map(x => x.id), 'mission id', 'missions');
for (const ms of COURSE.missions) {
  const W = 'mission ' + (ms.id || '?');
  if (!isStr(ms.id) || !isStr(ms.title)) err(W + ': needs id and title');
  if (!['base', 'ascent', 'summit'].includes(ms.level)) err(W + ': level must be base|ascent|summit');
  if (!isStr(ms.summary)) err(W + ': missing summary');
  if (!isStr(ms.brief)) err(W + ': missing brief html');
  if (!isStr(ms.time) || !isStr(ms.cost)) err(W + ': missing time or cost estimate');
  if (!Array.isArray(ms.criteria) || ms.criteria.length < 3) err(W + ': needs >=3 acceptance criteria');
  if (!Array.isArray(ms.hints) || !ms.hints.length) err(W + ': needs hints');
  if (!isStr(ms.walkthrough)) err(W + ': needs a full walkthrough');
  if (!isStr(ms.cleanup)) err(W + ': needs a cleanup/spend-check section');
}

/* ---- exams ---- */
uniq(COURSE.exams.map(x => x.id), 'exam id', 'exams');
for (const ex of COURSE.exams) {
  const W = 'exam ' + (ex.id || '?');
  if (!isStr(ex.id) || !isStr(ex.title)) err(W + ': needs id and title');
  if (!['core', 'advanced'].includes(ex.track)) err(W + ': track must be core|advanced');
  if (ex.minutes !== 100) warn(W + ': minutes is ' + ex.minutes + ' (expected 100)');
  if (!Array.isArray(ex.questions) || ex.questions.length !== 65) err(W + ': must have exactly 65 questions (has ' + (ex.questions || []).length + ')');
  (ex.questions || []).forEach((q, i) => checkQuestion(q, W + '/q#' + (i + 1), true));
}

/* ---- global completeness ---- */
if (COMPLETE) {
  if (COURSE.modules.length < 22) err('course: expected >=22 modules, found ' + COURSE.modules.length);
  if (COURSE.diagrams.length < 15) err('course: expected >=15 diagrams, found ' + COURSE.diagrams.length);
  if (COURSE.widgets.length < 12) err('course: expected >=12 widgets/simulators, found ' + COURSE.widgets.length);
  if (drillItems.length < 120) err('course: expected >=120 drill items, found ' + drillItems.length);
  if (COURSE.missions.length < 8) err('course: expected >=8 missions, found ' + COURSE.missions.length);
  if (COURSE.exams.length < 2) err('course: expected 2 exams, found ' + COURSE.exams.length);
  for (const mod of COURSE.modules) {
    if (!COURSE.explainers.some(x => x.moduleId === mod.id)) err('module ' + mod.id + ': no intuition-builder explainer registered');
  }
}

/* ---- report ---- */
console.log('content loaded: %d modules, %d explainers, %d diagrams, %d widgets, %d drill items, %d missions, %d exams',
  COURSE.modules.length, COURSE.explainers.length, COURSE.diagrams.length, COURSE.widgets.length,
  drillItems.length, COURSE.missions.length, COURSE.exams.length);
warnings.forEach(w => console.warn('WARN  ' + w));
errors.forEach(e => console.error('ERROR ' + e));
console.log(errors.length ? '✗ ' + errors.length + ' error(s), ' + warnings.length + ' warning(s)' : '✓ schema valid (' + warnings.length + ' warning(s))');
process.exit(errors.length ? 1 : 0);
