/* ============================================================
   AI Engineer — Interactive Course · engine
   Vanilla JS. No build step. Everything renders into #view.
   ============================================================ */
'use strict';

/* ---------------- utils ---------------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function el(id) { return document.getElementById(id); }
function h(html) { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
function fmtInt(n) { return Number(n || 0).toLocaleString('en-US'); }
function fmtMoney(n, dp) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dp == null ? 2 : dp, maximumFractionDigits: dp == null ? 2 : dp }); }
function todayKey(d) { const t = d || new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a); return b.every(x => s.has(x));
}
function toast(msg) {
  const t = h('<div class="toast">' + esc(msg) + '</div>');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

/* ---------------- store ---------------- */
const STORE_KEY = 'aie_course_v1';
const SECRETS_KEY = 'aie_secrets_v1'; // API keys & tokens: never leave this device via export/sync

function blankStore() {
  return {
    v: 1,
    savedAt: 0,
    lessonsDone: {},   // "moduleId/lessonId" -> true
    quizBest: {},      // moduleId -> best %
    examHistory: [],   // {examId, date, pct, domains:{d:{ok,total}}, flagged, answers}
    cards: {},         // "moduleId/cardId" -> {b: box 1..5, due: ts}
    streakDates: {},   // "YYYY-MM-DD" -> 1
    drillBest: 0,
    drillPlays: 0,
    missions: {},      // missionId -> {crit:{idx:true}}
    notes: [],         // {id, text, comment, source, hash, learned, created}
    settings: { gistId: '' }
  };
}
function backfillStore(s) {
  const b = blankStore();
  if (!s || typeof s !== 'object') return b;
  for (const k in b) {
    if (s[k] == null) s[k] = b[k];
  }
  if (!s.settings || typeof s.settings !== 'object') s.settings = b.settings;
  for (const k in b.settings) if (s.settings[k] == null) s.settings[k] = b.settings[k];
  return s;
}
let store = (function () {
  try { return backfillStore(JSON.parse(localStorage.getItem(STORE_KEY))); }
  catch (e) { return blankStore(); }
})();
function saveStore() {
  store.savedAt = Date.now();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* quota */ }
  renderSidebarBadges();
}
let secrets = (function () {
  try { return JSON.parse(localStorage.getItem(SECRETS_KEY)) || {}; }
  catch (e) { return {}; }
})();
function saveSecrets() { try { localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets)); } catch (e) {} }

function touchStreak() {
  const k = todayKey();
  if (!store.streakDates[k]) { store.streakDates[k] = 1; saveStore(); }
}
function streakLen() {
  let n = 0; const d = new Date();
  if (!store.streakDates[todayKey(d)]) d.setDate(d.getDate() - 1); // today not yet studied: count up to yesterday
  while (store.streakDates[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---------------- content lookups ---------------- */
const MODULES = COURSE.modules.slice().sort((a, b) => (a.order || 99) - (b.order || 99));
const TRACKS = [
  { id: 'core', name: 'Track 1 · Core AI Engineering' },
  { id: 'advanced', name: 'Track 2 · Advanced & Production' }
];
function modById(id) { return MODULES.find(m => m.id === id); }
function explainerFor(mid) { return COURSE.explainers.find(x => x.moduleId === mid); }
function diagramsFor(mid) { return COURSE.diagrams.filter(d => d.moduleId === mid); }
function widgetsFor(mid) { return COURSE.widgets.filter(w => w.moduleId === mid); }
function diagramById(id) { return COURSE.diagrams.find(d => d.id === id); }
function widgetById(id) { return COURSE.widgets.find(w => w.id === id); }
function missionById(id) { return COURSE.missions.find(m => m.id === id); }
function examById(id) { return COURSE.exams.find(e => e.id === id); }
const DRILL_ITEMS = COURSE.drills.reduce((acc, d) => acc.concat(d.items || []), []);

/* ---------------- progress math ---------------- */
function moduleLessonPct(m) {
  if (!m.lessons.length) return 0;
  const done = m.lessons.filter(l => store.lessonsDone[m.id + '/' + l.id]).length;
  return Math.round(100 * done / m.lessons.length);
}
function cardState(mid, cid) { return store.cards[mid + '/' + cid]; }
function dueCards() {
  const now = Date.now(); const out = [];
  MODULES.forEach(m => (m.flashcards || []).forEach(c => {
    const st = cardState(m.id, c.id);
    if (!st || st.due <= now) out.push({ m, c, st });
  }));
  return out;
}
function bestExamPct(track) {
  let best = 0;
  store.examHistory.forEach(hst => {
    const ex = examById(hst.examId);
    if (ex && (!track || ex.track === track)) best = Math.max(best, hst.pct);
  });
  return best;
}
function trackReadiness(track) {
  const mods = MODULES.filter(m => m.track === track);
  if (!mods.length) return 0;
  const lessonPct = mods.reduce((s, m) => s + moduleLessonPct(m), 0) / mods.length;
  const quizPct = mods.reduce((s, m) => s + (store.quizBest[m.id] || 0), 0) / mods.length;
  const examPct = bestExamPct(track);
  return Math.round(lessonPct * 0.40 + quizPct * 0.35 + examPct * 0.25);
}
function suggestNext() {
  // 1. due flashcards, 2. first module with unread lessons, 3. module quiz below 80, 4. exam
  const due = dueCards().length;
  if (due >= 10) return { href: '#/review', label: 'Review ' + due + ' due flashcards', why: 'Spaced repetition beats cramming — clear the queue first.' };
  for (const m of MODULES) {
    const lesson = m.lessons.find(l => !store.lessonsDone[m.id + '/' + l.id]);
    if (lesson) return { href: '#/module/' + m.id + '/lesson/' + lesson.id, label: 'Read: ' + m.title + ' → ' + lesson.title, why: 'Next unread lesson in course order.' };
  }
  for (const m of MODULES) {
    if ((store.quizBest[m.id] || 0) < 80) return { href: '#/module/' + m.id + '/quiz', label: 'Pass the quiz: ' + m.title, why: 'Best score ' + (store.quizBest[m.id] || 0) + '% — mastery bar is 80%.' };
  }
  if (due > 0) return { href: '#/review', label: 'Review ' + due + ' due flashcards', why: 'Keep the retention loop going.' };
  const ex = COURSE.exams.find(e => bestExamPct(e.track) < 80);
  if (ex) return { href: '#/exams', label: 'Take a mock exam: ' + ex.title, why: 'Lessons and quizzes are done — pressure-test under the clock.' };
  return { href: '#/missions', label: 'Ship a mission', why: 'You know the material. Now build with it.' };
}

/* ---------------- router ---------------- */
const routes = [];
function route(pattern, fn) { routes.push({ pattern, fn }); }
function navigate() {
  const hash = location.hash || '#/';
  const path = hash.slice(1).split('?')[0];
  const parts = path.split('/').filter(Boolean);
  cleanupView();
  for (const r of routes) {
    const pp = r.pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {}; let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i][0] === ':') params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pp[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) {
      window.scrollTo(0, 0);
      closeSidebar();
      try { r.fn(params); } catch (e) { el('view').innerHTML = '<div class="card"><h2>Render error</h2><pre>' + esc(e.stack || e) + '</pre></div>'; }
      renderSidebarBadges();
      return;
    }
  }
  el('view').innerHTML = '<div class="empty">Page not found. <a href="#/">Back to dashboard</a></div>';
}
let viewCleanups = [];
function onCleanup(fn) { viewCleanups.push(fn); }
function cleanupView() { viewCleanups.forEach(fn => { try { fn(); } catch (e) {} }); viewCleanups = []; }

/* ---------------- app shell ---------------- */
function buildShell() {
  document.body.insertAdjacentHTML('afterbegin',
    '<div class="mobile-bar"><button class="burger" id="burger" aria-label="Menu">☰</button><span class="ttl">AI Engineer</span></div>' +
    '<div id="app">' +
    '  <nav class="sidebar" id="sidebar"></nav>' +
    '  <div class="backdrop" id="backdrop"></div>' +
    '  <main class="main"><div id="view"></div></main>' +
    '</div>');
  el('burger').onclick = () => { el('sidebar').classList.toggle('open'); el('backdrop').classList.toggle('show'); };
  el('backdrop').onclick = closeSidebar;
  renderSidebar();
}
function closeSidebar() { el('sidebar').classList.remove('open'); el('backdrop').classList.remove('show'); }

function renderSidebar() {
  const cur = location.hash || '#/';
  let html = '<div class="brand"><h1>AI Engineer</h1><div class="sub">Interactive Course</div></div>';
  const links = [
    ['#/', '⌂', 'Dashboard'],
    ['#/review', '🃏', 'Flashcard review', 'due'],
    ['#/diagrams', '🗺', 'Diagrams'],
    ['#/playground', '🎛', 'Playground'],
    ['#/drill', '⚡', 'Speed drill'],
    ['#/missions', '⛰', 'Missions'],
    ['#/exams', '⏱', 'Practice exams'],
    ['#/notes', '✎', 'My notes', 'notes'],
    ['#/settings', '⚙', 'Settings']
  ];
  html += '<div class="nav-section">';
  links.forEach(([href, ico, label, badge]) => {
    html += '<a class="nav-link" data-badge="' + (badge || '') + '" href="' + href + '"><span class="ico">' + ico + '</span>' + esc(label) + '</a>';
  });
  html += '</div>';
  TRACKS.forEach(tr => {
    html += '<div class="nav-section"><div class="nav-head">' + esc(tr.name) + '</div>';
    MODULES.filter(m => m.track === tr.id).forEach(m => {
      const pct = moduleLessonPct(m);
      const mastered = (store.quizBest[m.id] || 0) >= 80;
      html += '<a class="nav-link nav-mod" href="#/module/' + m.id + '"><span class="num">' + String(m.order).padStart(2, '0') + '</span><span>' + esc(m.short || m.title) + '</span>' +
        (mastered ? '<span class="done-mark">✓✓</span>' : pct >= 100 ? '<span class="done-mark">✓</span>' : '') + '</a>';
    });
    html += '</div>';
  });
  html += '<div class="nav-section" style="padding:14px 18px;color:#7d6c4f;font-size:.7rem">Progress is saved locally.<br>Export in Settings.</div>';
  el('sidebar').innerHTML = html;
  markActiveNav(cur);
  renderSidebarBadges();
}
function markActiveNav(cur) {
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href');
    const active = href === '#/' ? (cur === '#/' || cur === '') : cur.startsWith(href);
    a.classList.toggle('active', active);
  });
}
function renderSidebarBadges() {
  const due = dueCards().length;
  const openNotes = store.notes.filter(n => !n.learned).length;
  document.querySelectorAll('.nav-link[data-badge]').forEach(a => {
    const kind = a.dataset.badge;
    let old = a.querySelector('.badge'); if (old) old.remove();
    let n = kind === 'due' ? due : kind === 'notes' ? openNotes : 0;
    if (n > 0) a.insertAdjacentHTML('beforeend', '<span class="badge' + (kind === 'notes' ? ' dim' : '') + '">' + n + '</span>');
  });
}

/* ---------------- dashboard ---------------- */
route('/', function () {
  const totalLessons = MODULES.reduce((s, m) => s + m.lessons.length, 0);
  const doneLessons = Object.keys(store.lessonsDone).length;
  const due = dueCards().length;
  const next = suggestNext();
  const streak = streakLen();

  let html = '<div class="page-head"><h1>Dashboard</h1><p class="lede">Everything a senior engineer needs to master AI engineering — internals, trade-offs, and failure modes. No fluff.</p></div>';

  html += '<div class="grid cols-4">' +
    stat(doneLessons + '<span class="muted">/' + totalLessons + '</span>', 'Lessons read') +
    stat(due, 'Flashcards due') +
    stat(streak + (streak === 1 ? ' day' : ' days'), 'Study streak') +
    stat((store.drillBest || 0), 'Drill best') +
    '</div>';

  html += '<div class="card" style="margin-top:16px"><h3 class="mt0">Suggested next step</h3>' +
    '<div class="flex spread"><div><a class="btn" href="' + next.href + '">' + esc(next.label) + ' →</a>' +
    '<div class="muted" style="margin-top:6px">' + esc(next.why) + '</div></div></div></div>';

  html += '<div class="grid cols-2">';
  TRACKS.forEach(tr => {
    const r = trackReadiness(tr.id);
    const mods = MODULES.filter(m => m.track === tr.id);
    const lessonPct = mods.length ? Math.round(mods.reduce((s, m) => s + moduleLessonPct(m), 0) / mods.length) : 0;
    const quizPct = mods.length ? Math.round(mods.reduce((s, m) => s + (store.quizBest[m.id] || 0), 0) / mods.length) : 0;
    html += '<div class="card"><h3 class="mt0">' + esc(tr.name) + '</h3>' +
      '<div class="flex spread"><span class="muted">Readiness estimate</span><b>' + r + '%</b></div>' +
      '<div class="bar"><i style="width:' + r + '%"></i></div>' +
      '<div class="muted" style="margin-top:8px">Lessons ' + lessonPct + '% · Quizzes ' + quizPct + '% · Best exam ' + bestExamPct(tr.id) + '%<br>Weighted 40 / 35 / 25.</div></div>';
  });
  html += '</div>';

  html += '<h2>Modules</h2>';
  TRACKS.forEach(tr => {
    html += '<h3 class="muted" style="font-family:var(--font-ui);font-size:.8rem;text-transform:uppercase;letter-spacing:.1em">' + esc(tr.name) + '</h3><div class="grid cols-2">';
    MODULES.filter(m => m.track === tr.id).forEach(m => {
      const pct = moduleLessonPct(m);
      const qb = store.quizBest[m.id] || 0;
      html += '<a class="tile" href="#/module/' + m.id + '"><h3>' + String(m.order).padStart(2, '0') + ' · ' + esc(m.title) + '</h3>' +
        '<div class="meta">' + m.lessons.length + ' lessons · quiz best ' + qb + '%' + (qb >= 80 ? ' <span class="pill green">mastered</span>' : '') + '</div>' +
        '<div class="bar" style="margin-top:8px"><i style="width:' + pct + '%"></i></div></a>';
    });
    html += '</div>';
  });

  if (store.examHistory.length) {
    html += '<h2>Exam history</h2><div class="card"><table><tr><th>Date</th><th>Exam</th><th>Score</th><th></th></tr>';
    store.examHistory.slice().reverse().forEach((hst, i) => {
      const ex = examById(hst.examId);
      html += '<tr><td>' + new Date(hst.date).toLocaleDateString() + '</td><td>' + esc(ex ? ex.title : hst.examId) + '</td>' +
        '<td><b>' + hst.pct + '%</b> ' + (hst.pct >= 80 ? '<span class="pill green">pass</span>' : '<span class="pill red">below bar</span>') + '</td>' +
        '<td><a href="#/exam-review/' + (store.examHistory.length - 1 - i) + '">review</a></td></tr>';
    });
    html += '</table></div>';
  }
  el('view').innerHTML = html;

  function stat(num, lbl) { return '<div class="card stat mb0"><div class="num">' + num + '</div><div class="lbl">' + esc(lbl) + '</div></div>'; }
});

/* ---------------- module views ---------------- */
function moduleHeader(m, tab) {
  const tabs = [
    ['lessons', 'Lessons', '#/module/' + m.id],
    ['intuition', 'Intuition', '#/module/' + m.id + '/intuition'],
    ['quiz', 'Quiz', '#/module/' + m.id + '/quiz'],
    ['cards', 'Flashcards', '#/module/' + m.id + '/flashcards'],
    ['lab', 'Lab', '#/module/' + m.id + '/lab']
  ];
  const pct = moduleLessonPct(m);
  const qb = store.quizBest[m.id] || 0;
  return '<div class="crumbs"><a href="#/">Dashboard</a> / ' + esc(m.title) + '</div>' +
    '<div class="page-head"><span class="pill ' + m.track + '">' + (m.track === 'core' ? 'Core track' : 'Advanced track') + '</span>' +
    '<h1>' + String(m.order).padStart(2, '0') + ' · ' + esc(m.title) + '</h1>' +
    '<p class="lede">' + esc(m.tagline || '') + '</p>' +
    '<div class="flex" style="margin-top:8px"><div style="flex:1;min-width:180px"><div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
    '<span class="muted">' + pct + '% read · quiz best ' + qb + '%' + (qb >= 80 ? ' ✓ mastered' : '') + '</span></div>' +
    '<div class="chip-row" style="margin-top:12px">' + tabs.map(t =>
      '<a class="chip' + (t[0] === tab ? ' active' : '') + '" href="' + t[2] + '">' + t[1] + '</a>').join('') + '</div></div>';
}

route('/module/:mid', function (p) {
  const m = modById(p.mid); if (!m) return notFound();
  let html = moduleHeader(m, 'lessons');
  html += '<div class="grid">';
  m.lessons.forEach((l, i) => {
    const done = store.lessonsDone[m.id + '/' + l.id];
    html += '<a class="tile" href="#/module/' + m.id + '/lesson/' + l.id + '">' +
      '<div class="flex spread"><h3>' + (i + 1) + '. ' + esc(l.title) + '</h3>' +
      (done ? '<span class="pill green">read ✓</span>' : '<span class="pill gray">unread</span>') + '</div>' +
      (l.blurb ? '<div class="desc">' + esc(l.blurb) + '</div>' : '') + '</a>';
  });
  html += '</div>';

  const dgs = diagramsFor(m.id), wgs = widgetsFor(m.id);
  if (dgs.length || wgs.length) {
    html += '<h2>Interactive for this module</h2><div class="grid cols-2">';
    dgs.forEach(d => { html += '<a class="tile" href="#/diagram/' + d.id + '"><h3>🗺 ' + esc(d.title) + '</h3><div class="meta">Interactive diagram · step-through</div></a>'; });
    wgs.forEach(w => { html += '<a class="tile" href="#/sim/' + w.id + '"><h3>🎛 ' + esc(w.title) + '</h3><div class="meta">Simulator</div></a>'; });
    html += '</div>';
  }
  el('view').innerHTML = html;
});

function notFound() { el('view').innerHTML = '<div class="empty">Not found. <a href="#/">Dashboard</a></div>'; }

/* Split lesson html into accordion sections on h2 (h3 stays inline). */
function splitSections(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  const sections = []; let cur = null;
  Array.from(container.childNodes).forEach(node => {
    if (node.nodeType === 1 && node.tagName === 'H2') {
      cur = { title: node.textContent, nodes: [] };
      sections.push(cur);
    } else {
      if (!cur) { cur = { title: '', nodes: [] }; sections.push(cur); }
      cur.nodes.push(node);
    }
  });
  return sections.map(s => {
    const d = document.createElement('div');
    s.nodes.forEach(n => d.appendChild(n));
    return { title: s.title, html: d.innerHTML };
  });
}

route('/module/:mid/lesson/:lid', function (p) {
  const m = modById(p.mid); if (!m) return notFound();
  const idx = m.lessons.findIndex(l => l.id === p.lid);
  if (idx < 0) return notFound();
  const l = m.lessons[idx];
  const key = m.id + '/' + l.id;
  const done = !!store.lessonsDone[key];
  const sections = splitSections(l.html);

  let html = '<div class="crumbs"><a href="#/">Dashboard</a> / <a href="#/module/' + m.id + '">' + esc(m.title) + '</a> / Lesson ' + (idx + 1) + '</div>' +
    '<div class="page-head"><h1>' + esc(l.title) + '</h1></div><div class="lesson-body" data-source="' + esc(m.title + ' → ' + l.title) + '">';
  sections.forEach((s, i) => {
    if (!s.title && sections.length === 1) { html += s.html; return; }
    html += '<div class="acc' + (i === 0 ? ' open' : '') + '"><button class="acc-head" data-acc="' + i + '">' + esc(s.title || 'Introduction') + '<span class="tw">▶</span></button>' +
      '<div class="acc-body">' + s.html + '</div></div>';
  });
  html += '</div>';

  html += '<div class="flex spread" style="margin-top:22px">';
  html += idx > 0 ? '<a class="btn ghost" href="#/module/' + m.id + '/lesson/' + m.lessons[idx - 1].id + '">← ' + esc(m.lessons[idx - 1].title) + '</a>' : '<span></span>';
  html += '<button class="btn ' + (done ? 'ghost' : 'green') + '" id="markdone">' + (done ? 'Read ✓ (click to unmark)' : 'Mark as read ✓') + '</button>';
  html += idx < m.lessons.length - 1 ? '<a class="btn ghost" href="#/module/' + m.id + '/lesson/' + m.lessons[idx + 1].id + '">' + esc(m.lessons[idx + 1].title) + ' →</a>' :
    '<a class="btn ghost" href="#/module/' + m.id + '/quiz">Take the quiz →</a>';
  html += '</div>';

  el('view').innerHTML = html;
  document.querySelectorAll('.acc-head').forEach(b => b.onclick = () => b.parentElement.classList.toggle('open'));
  el('markdone').onclick = () => {
    if (store.lessonsDone[key]) delete store.lessonsDone[key];
    else { store.lessonsDone[key] = true; touchStreak(); }
    saveStore(); navigate();
  };
  touchStreak();
});

/* ---------------- intuition builder ---------------- */
route('/module/:mid/intuition', function (p) {
  const m = modById(p.mid); if (!m) return notFound();
  const ex = explainerFor(m.id);
  let html = moduleHeader(m, 'intuition');
  if (!ex) { el('view').innerHTML = html + '<div class="empty">No intuition builder for this module yet.</div>'; return; }
  html += '<div class="card"><h2 class="mt0">' + esc(ex.title) + '</h2>' +
    '<div class="chip-row" id="lvlchips">' + ex.levels.map((lv, i) =>
      '<button class="chip' + (i === 0 ? ' active' : '') + '" data-lvl="' + i + '">' + esc(lv.name) + '</button>').join('') + '</div>' +
    '<div id="lvlbody" class="lesson-body" data-source="' + esc(m.title + ' → intuition') + '"></div></div>';
  el('view').innerHTML = html;
  const body = el('lvlbody');
  function show(i) {
    body.innerHTML = ex.levels[i].html;
    document.querySelectorAll('#lvlchips .chip').forEach((c, j) => c.classList.toggle('active', i === j));
  }
  document.querySelectorAll('#lvlchips .chip').forEach(c => c.onclick = () => show(+c.dataset.lvl));
  show(0);
});

/* ---------------- quiz ---------------- */
route('/module/:mid/quiz', function (p) {
  const m = modById(p.mid); if (!m) return notFound();
  const questions = m.quiz || [];
  let html = moduleHeader(m, 'quiz');
  if (!questions.length) { el('view').innerHTML = html + '<div class="empty">No quiz yet.</div>'; return; }
  html += '<div id="quizbox"></div>';
  el('view').innerHTML = html;
  runQuiz(el('quizbox'), questions, {
    title: m.title,
    onDone(pct) {
      if (pct > (store.quizBest[m.id] || 0)) { store.quizBest[m.id] = pct; }
      touchStreak(); saveStore();
    },
    best: store.quizBest[m.id] || 0
  });
});

/* Shared quiz runner: one question at a time, immediate dissection after submit. */
function runQuiz(box, questions, opts) {
  const order = shuffle(questions.map((q, i) => i));
  let pos = 0, correct = 0;
  const results = [];

  function qhtml(q, sel, submitted) {
    const multi = !!q.multi;
    let s = '<div class="q-progress">Question ' + (pos + 1) + ' of ' + order.length +
      (opts.best ? ' · best score ' + opts.best + '%' : '') + '</div>' +
      '<h3 style="margin:8px 0 2px">' + esc(q.text) + '</h3>' +
      (multi ? '<div class="muted small">Select all that apply (' + q.answer.length + ').</div>' : '');
    q.options.forEach((o, i) => {
      let cls = 'q-option', mark = '';
      if (!submitted) { if (sel.has(i)) cls += ' sel'; }
      else {
        const isAns = q.answer.includes(i);
        if (isAns && sel.has(i)) { cls += ' correct'; mark = '✓'; }
        else if (isAns) { cls += ' missed'; mark = '✓'; }
        else if (sel.has(i)) { cls += ' wrong'; mark = '✕'; }
      }
      s += '<div class="' + cls + '" data-i="' + i + '"><span class="box' + (multi ? '' : ' round') + '">' + mark + '</span><span>' + esc(o) + '</span></div>';
    });
    if (submitted) {
      s += '<div class="q-explain"><b>' + (results[pos].ok ? '✓ Correct.' : '✕ Not quite.') + '</b> ' + q.explanation + '</div>' +
        '<button class="btn" id="qnext">' + (pos + 1 < order.length ? 'Next question →' : 'See results →') + '</button>';
    } else {
      s += '<button class="btn" id="qsubmit"' + (sel.size ? '' : ' disabled') + '>Check answer</button>';
    }
    return '<div class="card">' + s + '</div>';
  }

  function showQuestion() {
    const q = questions[order[pos]];
    const sel = new Set();
    box.innerHTML = qhtml(q, sel, false);
    box.querySelectorAll('.q-option').forEach(opt => opt.onclick = () => {
      const i = +opt.dataset.i;
      if (q.multi) { sel.has(i) ? sel.delete(i) : sel.add(i); }
      else { sel.clear(); sel.add(i); }
      box.innerHTML = qhtml(q, sel, false);
      wire(sel, q);
    });
    wire(sel, q);
    function wire(sel, q) {
      box.querySelectorAll('.q-option').forEach(opt => opt.onclick = () => {
        const i = +opt.dataset.i;
        if (q.multi) { sel.has(i) ? sel.delete(i) : sel.add(i); }
        else { sel.clear(); sel.add(i); }
        box.innerHTML = qhtml(q, sel, false);
        wire(sel, q);
      });
      const sb = box.querySelector('#qsubmit');
      if (sb) sb.onclick = () => {
        const ok = sameSet(Array.from(sel), q.answer);
        if (ok) correct++;
        results[pos] = { ok, sel: Array.from(sel) };
        box.innerHTML = qhtml(q, sel, true);
        box.querySelector('#qnext').onclick = () => { pos++; pos < order.length ? showQuestion() : showResults(); };
        box.querySelector('#qnext').focus();
      };
    }
  }

  function showResults() {
    const pct = Math.round(100 * correct / order.length);
    opts.onDone(pct);
    const pass = pct >= 80;
    box.innerHTML = '<div class="card center"><h2>' + (pass ? '🏆 Mastered' : 'Score') + ': ' + pct + '%</h2>' +
      '<p class="muted">' + correct + ' of ' + order.length + ' correct · mastery bar is 80%</p>' +
      '<div class="bar' + (pass ? ' green' : '') + '" style="max-width:380px;margin:10px auto"><i style="width:' + pct + '%"></i></div>' +
      '<div class="flex" style="justify-content:center;margin-top:14px"><button class="btn" id="again">Retake quiz</button>' +
      '<a class="btn ghost" href="#/">Dashboard</a></div></div>';
    box.querySelector('#again').onclick = () => { pos = 0; correct = 0; results.length = 0; order.splice(0, order.length, ...shuffle(questions.map((q, i) => i))); showQuestion(); };
  }

  showQuestion();
}

/* ---------------- flashcards (Leitner) ---------------- */
const LEITNER_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
function gradeCard(mid, cid, ok) {
  const key = mid + '/' + cid;
  const st = store.cards[key] || { b: 1, due: 0 };
  st.b = ok ? Math.min(5, st.b + 1) : 1;
  st.due = startOfToday() + LEITNER_DAYS[st.b] * 86400000 + (ok ? 86400000 * (st.b === 1 ? 0 : 0) : 0);
  // box 1 & 2 with 0/1 day: wrong cards come back same session? Leitner spec: box1 due today (0d).
  if (ok && st.b === 1) st.due = startOfToday(); // unreachable, kept for clarity
  store.cards[key] = st;
  touchStreak(); saveStore();
}

function runFlashcards(box, queue, opts) {
  let i = 0, flipped = false, reviewed = 0;
  function show() {
    if (i >= queue.length) {
      box.innerHTML = '<div class="card center"><h2>🎉 Queue clear</h2><p class="muted">' + reviewed + ' cards reviewed. ' +
        (opts.global ? 'Come back tomorrow — spaced repetition works on a schedule, not on bingeing.' : 'These cards are now scheduled in your global review queue.') + '</p>' +
        '<a class="btn" href="#/">Dashboard</a></div>';
      return;
    }
    const item = queue[i];
    const st = cardState(item.m.id, item.c.id);
    flipped = false;
    box.innerHTML =
      '<div class="fc-meta">' + (i + 1) + ' / ' + queue.length + ' · ' + esc(item.m.short || item.m.title) + ' · box ' + (st ? st.b : 'new') + '</div>' +
      '<div class="fc-stage"><div class="fc-card" id="fccard">' +
      '<div class="fc-face"><div class="lesson-body">' + item.c.front + '</div><span class="fc-hint">click or press Space to flip</span></div>' +
      '<div class="fc-face back"><div class="lesson-body">' + item.c.back + '</div></div>' +
      '</div></div>' +
      '<div class="fc-grade" id="fcgrade" style="visibility:hidden">' +
      '<button class="btn red" id="fcno">✕ Didn\'t know <span class="kbd">1</span></button>' +
      '<button class="btn green" id="fcyes">✓ Knew it <span class="kbd">2</span></button></div>';
    const card = el('fccard');
    card.onclick = flip;
    el('fcno').onclick = () => grade(false);
    el('fcyes').onclick = () => grade(true);
  }
  function flip() {
    flipped = !flipped;
    el('fccard').classList.toggle('flipped', flipped);
    el('fcgrade').style.visibility = flipped ? 'visible' : 'hidden';
  }
  function grade(ok) {
    const item = queue[i];
    gradeCard(item.m.id, item.c.id, ok);
    reviewed++;
    if (!ok && opts.requeueWrong) queue.push(item);
    i++; show();
  }
  function keys(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); if (i < queue.length) flip(); }
    if (flipped && e.key === '1') grade(false);
    if (flipped && e.key === '2') grade(true);
  }
  document.addEventListener('keydown', keys);
  onCleanup(() => document.removeEventListener('keydown', keys));
  show();
}

route('/review', function () {
  const due = shuffle(dueCards());
  let html = '<div class="page-head"><h1>Flashcard review</h1><p class="lede">Leitner spaced repetition: 5 boxes, due in 0 / 1 / 3 / 7 / 14 days. Miss a card and it drops back to box 1.</p></div>';
  if (!due.length) {
    const counts = [0, 0, 0, 0, 0, 0];
    let total = 0;
    MODULES.forEach(m => (m.flashcards || []).forEach(c => { total++; const st = cardState(m.id, c.id); counts[st ? st.b : 0]++; }));
    html += '<div class="empty">Nothing due right now — the schedule is doing its job. 🎓</div>' +
      '<div class="card"><h3 class="mt0">Box distribution</h3><table><tr><th>New</th><th>Box 1</th><th>Box 2</th><th>Box 3</th><th>Box 4</th><th>Box 5</th></tr>' +
      '<tr>' + counts.map(c => '<td>' + c + '</td>').join('') + '</tr></table>' +
      '<p class="muted">' + total + ' cards in the course.</p></div>';
    el('view').innerHTML = html;
    return;
  }
  html += '<div id="fcbox"></div>';
  el('view').innerHTML = html;
  runFlashcards(el('fcbox'), due, { global: true, requeueWrong: false });
});

route('/module/:mid/flashcards', function (p) {
  const m = modById(p.mid); if (!m) return notFound();
  let html = moduleHeader(m, 'cards');
  const cards = (m.flashcards || []).map(c => ({ m, c }));
  if (!cards.length) { el('view').innerHTML = html + '<div class="empty">No flashcards yet.</div>'; return; }
  html += '<p class="muted small">Practicing here also feeds the global Leitner schedule.</p><div id="fcbox"></div>';
  el('view').innerHTML = html;
  runFlashcards(el('fcbox'), shuffle(cards), { global: false, requeueWrong: true });
});

/* ---------------- lab ---------------- */
route('/module/:mid/lab', function (p) {
  const m = modById(p.mid); if (!m) return notFound();
  let html = moduleHeader(m, 'lab');
  const lab = m.lab;
  if (!lab) { el('view').innerHTML = html + '<div class="empty">No lab yet.</div>'; return; }
  html += '<div class="card"><h2 class="mt0">🔬 ' + esc(lab.title) + '</h2><div class="lesson-body" data-source="' + esc(m.title + ' → lab') + '">' + (lab.intro || '') + '</div></div>';
  (lab.steps || []).forEach((s, i) => {
    html += '<div class="acc' + (i === 0 ? ' open' : '') + '"><button class="acc-head">Step ' + (i + 1) + ': ' + esc(s.title) + '<span class="tw">▶</span></button>' +
      '<div class="acc-body lesson-body">' + s.html + '</div></div>';
  });
  if (lab.costNote) html += '<div class="callout limits"><span class="co-title">Cost & cleanup</span>' + lab.costNote + '</div>';
  el('view').innerHTML = html;
  document.querySelectorAll('.acc-head').forEach(b => b.onclick = () => b.parentElement.classList.toggle('open'));
});

/* ---------------- diagrams ---------------- */
route('/diagrams', function () {
  let html = '<div class="page-head"><h1>Interactive diagrams</h1><p class="lede">Click nodes for internals. Use the step-through to watch data move through each system.</p></div><div class="grid cols-2">';
  COURSE.diagrams.forEach(d => {
    const m = modById(d.moduleId);
    html += '<a class="tile" href="#/diagram/' + d.id + '"><h3>' + esc(d.title) + '</h3><div class="meta">' + (m ? esc(m.short || m.title) : 'General') + ' · ' + (d.steps ? d.steps.length + ' steps' : 'static') + '</div>' +
      (d.caption ? '<div class="desc">' + esc(d.caption) + '</div>' : '') + '</a>';
  });
  html += '</div>';
  el('view').innerHTML = html;
});

function renderDiagramSVG(d) {
  const W = d.w || 900, H = d.h || 420;
  let defs = '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#cdbd9d"/></marker>' +
    '<marker id="arrlit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#b4531f"/></marker></defs>';
  const nodeMap = {};
  d.nodes.forEach(n => nodeMap[n.id] = n);

  function anchor(a, b) {
    // point on border of rect a toward center of b
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const dx = bx - ax, dy = by - ay;
    if (dx === 0 && dy === 0) return { x: ax, y: ay };
    const sx = dx !== 0 ? (a.w / 2) / Math.abs(dx) : Infinity;
    const sy = dy !== 0 ? (a.h / 2) / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy);
    return { x: ax + dx * s, y: ay + dy * s };
  }

  let edges = '';
  (d.edges || []).forEach((e, i) => {
    const a = nodeMap[e.from], b = nodeMap[e.to];
    if (!a || !b) return;
    const p1 = anchor(a, b), p2 = anchor(b, a);
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    edges += '<path class="dg-edge" data-edge="' + e.from + '→' + e.to + '" d="M' + p1.x + ',' + p1.y + ' L' + p2.x + ',' + p2.y + '" marker-end="url(#arr)"' + (e.dashed ? ' stroke-dasharray="5,4"' : '') + '/>';
    if (e.label) edges += '<text class="dg-edge-label" x="' + mx + '" y="' + (my - 5) + '" text-anchor="middle">' + esc(e.label) + '</text>';
  });

  let nodes = '';
  d.nodes.forEach(n => {
    const lines = String(n.label).split('\n');
    const lh = 15;
    const ty = n.y + n.h / 2 - (lines.length - 1) * lh / 2 + 4;
    nodes += '<g class="dg-node kind-' + (n.kind || 'proc') + '" data-node="' + esc(n.id) + '">' +
      '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="9"/>' +
      lines.map((ln, li) => '<text x="' + (n.x + n.w / 2) + '" y="' + (ty + li * lh) + '" text-anchor="middle">' + esc(ln) + '</text>').join('') +
      '</g>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' + defs + edges + nodes + '</svg>';
}

route('/diagram/:id', function (p) {
  const d = diagramById(p.id); if (!d) return notFound();
  const m = modById(d.moduleId);
  let html = '<div class="crumbs"><a href="#/diagrams">Diagrams</a> / ' + esc(d.title) + '</div>' +
    '<div class="page-head"><h1>' + esc(d.title) + '</h1>' + (d.caption ? '<p class="lede">' + esc(d.caption) + '</p>' : '') +
    (m ? '<a class="small" href="#/module/' + m.id + '">↳ from module: ' + esc(m.title) + '</a>' : '') + '</div>' +
    '<div class="dg-wrap"><div class="dg-svgbox" id="dgsvg">' + renderDiagramSVG(d) + '</div>' +
    '<div class="dg-panel" id="dgpanel"></div></div>';
  el('view').innerHTML = html;

  const panel = el('dgpanel');
  const hasSteps = d.steps && d.steps.length;
  let stepIdx = -1, playTimer = null;

  function panelDefault() {
    panel.innerHTML = '<h4>Explore</h4><p class="small muted">Click any node for what happens inside it.</p>' +
      (hasSteps ? '<div class="dg-steps"><button class="btn sm" id="dgstart">▶ Step through</button></div>' : '');
    if (hasSteps) el('dgstart').onclick = () => setStep(0);
  }
  function selectNode(id) {
    stopPlay();
    document.querySelectorAll('.dg-node').forEach(g => g.classList.toggle('selected', g.dataset.node === id));
    const n = d.nodes.find(x => x.id === id);
    panel.innerHTML = '<h4>' + esc(n.label.replace(/\n/g, ' ')) + '</h4><div class="small">' + (n.info || '<span class="muted">No details.</span>') + '</div>' +
      '<div style="margin-top:10px"><button class="btn sm ghost" id="dgback">← Overview</button></div>';
    el('dgback').onclick = () => { document.querySelectorAll('.dg-node.selected').forEach(g => g.classList.remove('selected')); hasSteps && stepIdx >= 0 ? setStep(stepIdx) : panelDefault(); };
  }
  function setStep(i) {
    stepIdx = clamp(i, 0, d.steps.length - 1);
    const st = d.steps[stepIdx];
    document.querySelectorAll('.dg-node').forEach(g => g.classList.toggle('lit', (st.nodes || []).includes(g.dataset.node)));
    document.querySelectorAll('.dg-edge').forEach(pe => {
      const lit = (st.edges || []).some(e => (e[0] + '→' + e[1]) === pe.dataset.edge);
      pe.classList.toggle('lit', lit);
      pe.setAttribute('marker-end', lit ? 'url(#arrlit)' : 'url(#arr)');
    });
    panel.innerHTML = '<h4>Step ' + (stepIdx + 1) + ' / ' + d.steps.length + ': ' + esc(st.title) + '</h4>' +
      '<div class="dg-step-desc">' + (st.desc || '') + '</div>' +
      '<div class="flex" style="margin-top:8px">' +
      '<button class="btn sm ghost" id="dgprev"' + (stepIdx === 0 ? ' disabled' : '') + '>←</button>' +
      '<button class="btn sm ghost" id="dgnext"' + (stepIdx === d.steps.length - 1 ? ' disabled' : '') + '>→</button>' +
      '<button class="btn sm" id="dgplay">' + (playTimer ? '⏸ Pause' : '▶ Play') + '</button>' +
      '<button class="btn sm ghost" id="dgreset">Reset</button></div>';
    el('dgprev').onclick = () => { stopPlay(); setStep(stepIdx - 1); };
    el('dgnext').onclick = () => { stopPlay(); setStep(stepIdx + 1); };
    el('dgreset').onclick = () => { stopPlay(); stepIdx = -1; clearLights(); panelDefault(); };
    el('dgplay').onclick = () => { playTimer ? stopPlay() : startPlay(); setStep(stepIdx); };
  }
  function clearLights() {
    document.querySelectorAll('.dg-node.lit').forEach(g => g.classList.remove('lit'));
    document.querySelectorAll('.dg-edge.lit').forEach(pe => { pe.classList.remove('lit'); pe.setAttribute('marker-end', 'url(#arr)'); });
  }
  function startPlay() {
    playTimer = setInterval(() => {
      if (stepIdx >= d.steps.length - 1) { stopPlay(); setStep(stepIdx); return; }
      setStep(stepIdx + 1);
    }, 2200);
  }
  function stopPlay() { if (playTimer) { clearInterval(playTimer); playTimer = null; } }
  onCleanup(stopPlay);

  document.querySelectorAll('.dg-node').forEach(g => g.onclick = () => selectNode(g.dataset.node));
  panelDefault();
});

/* ---------------- playground (simulators) ---------------- */
route('/playground', function () {
  let html = '<div class="page-head"><h1>Playground</h1><p class="lede">Calculators and simulators. Move the sliders — intuition lives in the numbers.</p></div><div class="grid cols-2">';
  COURSE.widgets.forEach(w => {
    const m = modById(w.moduleId);
    html += '<a class="tile" href="#/sim/' + w.id + '"><h3>' + esc(w.title) + '</h3>' +
      '<div class="meta">' + (m ? esc(m.short || m.title) : 'General') + '</div>' +
      (w.desc ? '<div class="desc">' + esc(w.desc) + '</div>' : '') + '</a>';
  });
  html += '</div>';
  el('view').innerHTML = html;
});

route('/sim/:id', function (p) {
  const w = widgetById(p.id); if (!w) return notFound();
  const m = modById(w.moduleId);
  el('view').innerHTML = '<div class="crumbs"><a href="#/playground">Playground</a> / ' + esc(w.title) + '</div>' +
    '<div class="page-head"><h1>' + esc(w.title) + '</h1>' + (w.desc ? '<p class="lede">' + esc(w.desc) + '</p>' : '') +
    (m ? '<a class="small" href="#/module/' + m.id + '">↳ from module: ' + esc(m.title) + '</a>' : '') + '</div>' +
    '<div class="card" id="simroot"></div>';
  try { w.render(el('simroot'), { esc, fmtInt, fmtMoney, clamp, onCleanup }); }
  catch (e) { el('simroot').innerHTML = '<pre>' + esc(e.stack || e) + '</pre>'; }
});

/* ---------------- speed drill ---------------- */
route('/drill', function () {
  const DUR = 75;
  let html = '<div class="page-head"><h1>⚡ Speed drill</h1><p class="lede">' + DRILL_ITEMS.length + ' scenario → technique mappings. 75 seconds. +10 per hit plus streak bonus; a miss costs 3 seconds and tells you why.</p></div>' +
    '<div class="card center"><div class="drill-hud"><span>Personal best: <b class="big">' + (store.drillBest || 0) + '</b></span><span class="muted">' + (store.drillPlays || 0) + ' runs</span></div>' +
    '<button class="btn" id="dstart" style="font-size:1.05rem;padding:12px 30px">Start run ▶</button></div><div id="drillbox"></div>';
  el('view').innerHTML = html;

  const box = el('drillbox');
  let timer = null;
  onCleanup(() => { if (timer) clearInterval(timer); });

  el('dstart').onclick = startRun;

  function startRun() {
    el('dstart').disabled = true;
    let t = DUR, score = 0, streak = 0, hits = 0, misses = 0;
    let deck = shuffle(DRILL_ITEMS);
    let di = 0;
    const answers = Array.from(new Set(DRILL_ITEMS.map(x => x.answer)));

    timer = setInterval(() => {
      t -= 0.1;
      const te = el('dtime');
      if (te) { te.textContent = Math.max(0, t).toFixed(1); te.style.color = t < 10 ? 'var(--red)' : ''; }
      if (t <= 0) endRun();
    }, 100);

    function nextItem() {
      if (di >= deck.length) { deck = shuffle(DRILL_ITEMS); di = 0; }
      const item = deck[di++];
      const opts = shuffle([item.answer].concat(shuffle(answers.filter(a => a !== item.answer)).slice(0, 3)));
      box.innerHTML = '<div class="card"><div class="drill-hud">' +
        '<span>⏱ <b class="big" id="dtime">' + t.toFixed(1) + '</b>s</span>' +
        '<span>Score <b class="big">' + score + '</b></span>' +
        '<span>Streak <b>' + streak + '</b>' + (streak >= 3 ? ' 🔥' : '') + '</span></div>' +
        '<div class="drill-prompt">“' + esc(item.prompt) + '”</div>' +
        '<div class="drill-opts">' + opts.map(o => '<button class="btn" data-a="' + esc(o) + '">' + esc(o) + '</button>').join('') + '</div>' +
        '<div class="drill-flash" id="dflash"></div></div>';
      box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
        if (b.dataset.a === item.answer) {
          streak++; hits++;
          score += 10 + Math.min(20, (streak - 1) * 2);
          nextItem();
        } else {
          streak = 0; misses++; t -= 3;
          const f = el('dflash');
          f.className = 'drill-flash bad';
          f.innerHTML = '−3s · <b>' + esc(item.answer) + '</b> — ' + esc(item.why || '');
          box.querySelectorAll('[data-a]').forEach(x => { if (x.dataset.a === item.answer) x.style.borderColor = 'var(--green)'; });
        }
      });
    }

    function endRun() {
      clearInterval(timer); timer = null;
      store.drillPlays = (store.drillPlays || 0) + 1;
      const isPB = score > (store.drillBest || 0);
      if (isPB) store.drillBest = score;
      touchStreak(); saveStore();
      box.innerHTML = '<div class="card center"><h2>' + (isPB ? '🏅 New personal best!' : 'Time!') + '</h2>' +
        '<div class="drill-hud"><span>Score <b class="big">' + score + '</b></span><span>' + hits + ' hits</span><span>' + misses + ' misses</span></div>' +
        '<button class="btn" id="dagain">Run it back ▶</button></div>';
      el('dstart').disabled = false;
      el('dagain').onclick = () => { el('dstart').disabled = true; startRun(); };
    }
    nextItem();
  }
});

/* ---------------- missions ---------------- */
const MISSION_LEVELS = [
  ['base', '🏕 Base camp', 'Foundation builds — a focused evening each.'],
  ['ascent', '🧗 Ascent', 'Multi-evening builds that join several skills.'],
  ['summit', '🏔 Summit', 'Portfolio pieces. Bring these to interviews.']
];
function missionPct(ms) {
  const st = store.missions[ms.id];
  if (!st || !ms.criteria.length) return 0;
  const done = ms.criteria.filter((c, i) => st.crit && st.crit[i]).length;
  return Math.round(100 * done / ms.criteria.length);
}
route('/missions', function () {
  let html = '<div class="page-head"><h1>Missions</h1><p class="lede">Real builds in YOUR environment with real APIs and models. Reading about agents is not the same as debugging one at 1am.</p></div>';
  MISSION_LEVELS.forEach(([lv, name, blurb]) => {
    const list = COURSE.missions.filter(x => x.level === lv);
    if (!list.length) return;
    html += '<h2>' + name + '</h2><p class="muted small">' + esc(blurb) + '</p><div class="grid cols-2">';
    list.forEach(ms => {
      const pct = missionPct(ms);
      html += '<a class="tile" href="#/mission/' + ms.id + '"><div class="flex spread"><h3>' + esc(ms.title) + '</h3>' +
        (pct >= 100 ? '<span class="pill green">shipped ✓</span>' : pct > 0 ? '<span class="pill gold">' + pct + '%</span>' : '') + '</div>' +
        '<div class="meta">' + esc(ms.time || '') + ' · worst-case spend ' + esc(ms.cost || '$0') + '</div>' +
        '<div class="desc">' + esc(ms.summary || '') + '</div>' +
        '<div class="bar" style="margin-top:8px"><i style="width:' + pct + '%"></i></div></a>';
    });
    html += '</div>';
  });
  el('view').innerHTML = html;
});

route('/mission/:id', function (p) {
  const ms = missionById(p.id); if (!ms) return notFound();
  const lvName = (MISSION_LEVELS.find(x => x[0] === ms.level) || [])[1] || ms.level;
  const st = store.missions[ms.id] || { crit: {} };
  let html = '<div class="crumbs"><a href="#/missions">Missions</a> / ' + esc(ms.title) + '</div>' +
    '<div class="page-head"><span class="pill gold">' + esc(lvName) + '</span><h1>' + esc(ms.title) + '</h1>' +
    '<p class="lede">' + esc(ms.summary || '') + '</p>' +
    '<div class="muted small">⏱ ' + esc(ms.time || '?') + ' · 💸 worst-case API spend ' + esc(ms.cost || '$0') + '</div></div>';

  html += '<div class="card"><h2 class="mt0">The situation</h2><div class="lesson-body" data-source="' + esc('Mission: ' + ms.title) + '">' + ms.brief + '</div></div>';

  html += '<div class="card"><h2 class="mt0">Acceptance criteria</h2><p class="muted small">Check these off as you hit them — progress is saved.</p>';
  ms.criteria.forEach((c, i) => {
    html += '<label style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line);cursor:pointer">' +
      '<input type="checkbox" data-crit="' + i + '"' + (st.crit && st.crit[i] ? ' checked' : '') + ' style="margin-top:4px">' +
      '<span>' + esc(c) + '</span></label>';
  });
  html += '</div>';

  if (ms.hints && ms.hints.length) {
    html += '<div class="acc"><button class="acc-head">💡 Hints (' + ms.hints.length + ') — peek only when stuck<span class="tw">▶</span></button><div class="acc-body">';
    ms.hints.forEach((hint, i) => { html += '<div class="callout note"><span class="co-title">Hint ' + (i + 1) + '</span>' + hint + '</div>'; });
    html += '</div></div>';
  }
  if (ms.walkthrough) {
    html += '<div class="acc"><button class="acc-head">📜 Full walkthrough — last resort<span class="tw">▶</span></button><div class="acc-body lesson-body">' + ms.walkthrough + '</div></div>';
  }
  if (ms.cleanup) {
    html += '<div class="callout limits"><span class="co-title">Cleanup & spend check</span>' + ms.cleanup + '</div>';
  }
  el('view').innerHTML = html;
  document.querySelectorAll('.acc-head').forEach(b => b.onclick = () => b.parentElement.classList.toggle('open'));
  document.querySelectorAll('[data-crit]').forEach(cb => cb.onchange = () => {
    const s = store.missions[ms.id] || (store.missions[ms.id] = { crit: {} });
    if (cb.checked) { s.crit[cb.dataset.crit] = true; touchStreak(); } else delete s.crit[cb.dataset.crit];
    saveStore();
  });
});

/* ---------------- exams ---------------- */
route('/exams', function () {
  let html = '<div class="page-head"><h1>Timed practice exams</h1><p class="lede">65 scenario questions, 100 minutes, per-domain breakdown. Treat them like the real thing: one sitting, no notes.</p></div><div class="grid cols-2">';
  COURSE.exams.forEach(ex => {
    const best = Math.max(0, ...store.examHistory.filter(hst => hst.examId === ex.id).map(hst => hst.pct));
    html += '<div class="tile"><h3>' + esc(ex.title) + '</h3>' +
      '<div class="meta">' + ex.questions.length + ' questions · ' + ex.minutes + ' min · pass bar 80%</div>' +
      '<div class="desc">' + esc(ex.blurb || '') + '</div>' +
      '<div class="flex spread" style="margin-top:10px"><span class="muted small">best: ' + best + '%</span>' +
      '<a class="btn sm" href="#/exam/' + ex.id + '">Start exam ▶</a></div></div>';
  });
  html += '</div>';
  el('view').innerHTML = html;
});

route('/exam/:id', function (p) {
  const ex = examById(p.id); if (!ex) return notFound();
  const box = el('view');
  box.innerHTML = '<div class="page-head"><h1>' + esc(ex.title) + '</h1></div>' +
    '<div class="card"><p><b>' + ex.questions.length + ' questions · ' + ex.minutes + ' minutes.</b> The timer starts when you click. You can flag questions and jump around; unanswered counts as wrong. Auto-submits at 0:00.</p>' +
    '<button class="btn" id="exstart" style="font-size:1.05rem">Begin timed exam ▶</button> <a class="btn ghost" href="#/exams">Back</a></div>';
  el('exstart').onclick = () => runExam(ex);
});

function runExam(ex) {
  const box = el('view');
  const N = ex.questions.length;
  const answers = Array(N).fill(null); // arrays of selected indices
  const flags = Array(N).fill(false);
  let cur = 0;
  let remain = ex.minutes * 60;
  const timer = setInterval(() => {
    remain--;
    const te = el('extime');
    if (te) { te.textContent = fmtClock(remain); te.classList.toggle('low', remain < 300); }
    if (remain <= 0) finish();
  }, 1000);
  onCleanup(() => clearInterval(timer));

  function fmtClock(s) { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  function render() {
    const q = ex.questions[cur];
    const sel = new Set(answers[cur] || []);
    let html = '<div class="exam-top"><span class="exam-timer" id="extime">' + fmtClock(remain) + '</span>' +
      '<span class="muted">Q ' + (cur + 1) + '/' + N + ' · ' + answers.filter(a => a && a.length).length + ' answered</span>' +
      '<button class="btn sm ghost" id="exflag">' + (flags[cur] ? '🚩 Flagged' : '⚐ Flag') + '</button>' +
      '<button class="btn sm red" id="exsubmit" style="margin-left:auto">Submit exam</button></div>';
    html += '<div class="exam-nav">' + ex.questions.map((_, i) =>
      '<button data-n="' + i + '" class="' + (i === cur ? 'current ' : '') + (flags[i] ? 'flagged' : (answers[i] && answers[i].length ? 'answered' : '')) + '">' + (i + 1) + '</button>').join('') + '</div>';
    html += '<div class="card"><div class="muted small">' + esc(q.domain || '') + (q.multi ? ' · select ' + q.answer.length : '') + '</div>' +
      '<h3 style="margin:6px 0 4px">' + esc(q.text) + '</h3>';
    q.options.forEach((o, i) => {
      html += '<div class="q-option' + (sel.has(i) ? ' sel' : '') + '" data-i="' + i + '"><span class="box' + (q.multi ? '' : ' round') + '"></span><span>' + esc(o) + '</span></div>';
    });
    html += '<div class="flex spread" style="margin-top:12px">' +
      '<button class="btn ghost" id="exprev"' + (cur === 0 ? ' disabled' : '') + '>← Prev</button>' +
      '<button class="btn ghost" id="exnext"' + (cur === N - 1 ? ' disabled' : '') + '>Next →</button></div></div>';
    box.innerHTML = html;

    box.querySelectorAll('.q-option').forEach(opt => opt.onclick = () => {
      const i = +opt.dataset.i;
      let a = answers[cur] || [];
      if (q.multi) { a = a.includes(i) ? a.filter(x => x !== i) : a.concat(i); }
      else a = [i];
      answers[cur] = a; render();
    });
    box.querySelectorAll('.exam-nav button').forEach(b => b.onclick = () => { cur = +b.dataset.n; render(); });
    el('exprev').onclick = () => { cur--; render(); };
    el('exnext').onclick = () => { cur++; render(); };
    el('exflag').onclick = () => { flags[cur] = !flags[cur]; render(); };
    el('exsubmit').onclick = () => {
      const un = answers.filter(a => !a || !a.length).length;
      if (un > 0 && remain > 0 && !confirm(un + ' unanswered question(s) will count as wrong. Submit anyway?')) return;
      finish();
    };
  }

  function finish() {
    clearInterval(timer);
    let ok = 0; const domains = {};
    ex.questions.forEach((q, i) => {
      const d = q.domain || 'General';
      domains[d] = domains[d] || { ok: 0, total: 0 };
      domains[d].total++;
      const good = sameSet(answers[i] || [], q.answer);
      if (good) { ok++; domains[d].ok++; }
    });
    const pct = Math.round(100 * ok / N);
    store.examHistory.push({ examId: ex.id, date: Date.now(), pct, domains, answers, flags });
    touchStreak(); saveStore();
    location.hash = '#/exam-review/' + (store.examHistory.length - 1);
  }
  render();
}

route('/exam-review/:idx', function (p) {
  const hst = store.examHistory[+p.idx]; if (!hst) return notFound();
  const ex = examById(hst.examId); if (!ex) return notFound();
  const pass = hst.pct >= 80;
  let html = '<div class="crumbs"><a href="#/exams">Exams</a> / Review</div>' +
    '<div class="page-head"><h1>' + esc(ex.title) + ' — ' + hst.pct + '% ' + (pass ? '<span class="pill green">pass</span>' : '<span class="pill red">below bar</span>') + '</h1>' +
    '<p class="lede">Taken ' + new Date(hst.date).toLocaleString() + '. Read every dissection below — the wrong options teach more than the right ones.</p></div>';

  html += '<div class="card"><h3 class="mt0">Score by domain</h3>';
  Object.keys(hst.domains).forEach(d => {
    const dd = hst.domains[d];
    const dp = Math.round(100 * dd.ok / dd.total);
    html += '<div class="flex spread" style="margin-top:8px"><span class="small">' + esc(d) + '</span><span class="small muted">' + dd.ok + '/' + dd.total + '</span></div>' +
      '<div class="bar' + (dp >= 80 ? ' green' : '') + '"><i style="width:' + dp + '%"></i></div>';
  });
  html += '</div>';

  ex.questions.forEach((q, i) => {
    const sel = new Set(hst.answers[i] || []);
    const good = sameSet(hst.answers[i] || [], q.answer);
    html += '<div class="card"><div class="flex spread"><span class="muted small">Q' + (i + 1) + ' · ' + esc(q.domain || '') + (hst.flags && hst.flags[i] ? ' · 🚩 flagged' : '') + '</span>' +
      (good ? '<span class="pill green">correct</span>' : '<span class="pill red">' + (sel.size ? 'wrong' : 'unanswered') + '</span>') + '</div>' +
      '<h3 style="margin:6px 0 2px">' + esc(q.text) + '</h3>';
    q.options.forEach((o, oi) => {
      let cls = 'q-option', mark = '';
      const isAns = q.answer.includes(oi);
      if (isAns && sel.has(oi)) { cls += ' correct'; mark = '✓'; }
      else if (isAns) { cls += ' missed'; mark = '✓'; }
      else if (sel.has(oi)) { cls += ' wrong'; mark = '✕'; }
      html += '<div class="' + cls + '"><span class="box' + (q.multi ? '' : ' round') + '">' + mark + '</span><span>' + esc(o) + '</span></div>';
    });
    html += '<div class="q-explain">' + q.explanation + '</div></div>';
  });
  el('view').innerHTML = html;
});

/* ---------------- notes ---------------- */
route('/notes', function () {
  renderNotes('all');
});
function renderNotes(filter) {
  let notes = store.notes.slice().reverse();
  if (filter === 'open') notes = notes.filter(n => !n.learned);
  if (filter === 'learned') notes = notes.filter(n => n.learned);
  let html = '<div class="page-head"><h1>My notes</h1><p class="lede">Select any text anywhere in the course and hit “Save note”. Mark a note learned once it sticks.</p></div>' +
    '<div class="chip-row">' +
    ['all', 'open', 'learned'].map(f => '<button class="chip' + (f === filter ? ' active' : '') + '" data-f="' + f + '">' +
      (f === 'all' ? 'All' : f === 'open' ? 'To learn' : 'Learned') + '</button>').join('') +
    '<button class="btn sm ghost" id="addnote" style="margin-left:auto">+ New note</button></div>';
  if (!notes.length) html += '<div class="empty">No notes here yet. Go select something interesting.</div>';
  notes.forEach(n => {
    html += '<div class="card note-item' + (n.learned ? ' learned' : '') + '" data-id="' + n.id + '">' +
      '<div class="lesson-body">' + esc(n.text) + '</div>' +
      (n.comment ? '<div class="muted small" style="margin-top:4px">📝 ' + esc(n.comment) + '</div>' : '') +
      '<div class="flex spread" style="margin-top:10px"><span class="src">' + (n.href ? '<a href="' + esc(n.href) + '">' + esc(n.source || 'source') + '</a>' : esc(n.source || '')) +
      ' · ' + new Date(n.created).toLocaleDateString() + '</span>' +
      '<span class="flex"><button class="btn sm ghost" data-act="learn">' + (n.learned ? '↩ To-learn' : '✓ Learned') + '</button>' +
      '<button class="btn sm ghost" data-act="edit">Edit</button>' +
      '<button class="btn sm ghost" data-act="del">Delete</button></span></div></div>';
  });
  el('view').innerHTML = html;
  document.querySelectorAll('[data-f]').forEach(c => c.onclick = () => renderNotes(c.dataset.f));
  el('addnote').onclick = () => {
    const text = prompt('Note text:');
    if (text) { addNote(text, 'manual note', ''); renderNotes(filter); }
  };
  document.querySelectorAll('.note-item [data-act]').forEach(b => b.onclick = () => {
    const id = b.closest('.note-item').dataset.id;
    const n = store.notes.find(x => x.id === id); if (!n) return;
    const act = b.dataset.act;
    if (act === 'learn') { n.learned = !n.learned; }
    if (act === 'edit') {
      const t = prompt('Edit note:', n.text); if (t == null) return; n.text = t;
      const c = prompt('Comment (optional):', n.comment || ''); if (c != null) n.comment = c;
    }
    if (act === 'del') { if (!confirm('Delete this note?')) return; store.notes = store.notes.filter(x => x.id !== id); }
    saveStore(); renderNotes(filter);
  });
}
function addNote(text, source, href) {
  store.notes.push({ id: uid(), text: text.slice(0, 2000), comment: '', source, href, learned: false, created: Date.now() });
  saveStore();
}

/* ---------------- selection capture (Save note / Ask AI) ---------------- */
let selFloat = null;
function killSelFloat() { if (selFloat) { selFloat.remove(); selFloat = null; } }
document.addEventListener('mouseup', function (e) {
  if (e.target.closest('.sel-float') || e.target.closest('.ai-popup')) return;
  setTimeout(() => {
    killSelFloat();
    const sel = window.getSelection();
    const text = sel ? String(sel).trim() : '';
    if (!text || text.length < 8 || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r || (!r.width && !r.height)) return;
    selFloat = h('<div class="sel-float"><button data-a="note">💾 Save note</button><button data-a="ai">✨ Ask AI</button></div>');
    document.body.appendChild(selFloat);
    selFloat.style.left = Math.max(8, Math.min(window.innerWidth - 190, r.left + window.scrollX)) + 'px';
    selFloat.style.top = (r.bottom + window.scrollY + 8) + 'px';
    const srcEl = document.querySelector('[data-source]');
    const source = srcEl ? srcEl.dataset.source : (document.querySelector('.page-head h1') || {}).textContent || 'Course';
    selFloat.querySelector('[data-a=note]').onclick = () => {
      addNote(text, source, location.hash);
      toast('Saved to My notes 📝'); killSelFloat();
      window.getSelection().removeAllRanges();
    };
    selFloat.querySelector('[data-a=ai]').onclick = () => { openAskAI(text, source); killSelFloat(); };
  }, 10);
});
document.addEventListener('mousedown', function (e) {
  if (!e.target.closest('.sel-float')) killSelFloat();
});

/* ---------------- Ask AI ---------------- */
let aiPopup = null;
function openAskAI(context, source) {
  if (aiPopup) aiPopup.remove();
  const hasKey = !!(secrets.apiKey);
  aiPopup = h('<div class="ai-popup">' +
    '<div class="head">✨ Ask AI<button id="aiclose">✕</button></div>' +
    '<div class="body" id="aibody">' +
    '<div class="ctx">' + esc(context.slice(0, 300)) + '</div>' +
    (hasKey
      ? '<div class="chip-row">' +
        ['Explain simply', 'Example', 'Interview angle', 'Why it matters'].map(q => '<button class="chip" data-q="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>' +
        '<div class="answer" id="aianswer"></div>'
      : '<p class="small">No API key configured. Paste an OpenAI-compatible key in <a href="#/settings">Settings</a> — it stays in this browser\'s localStorage and is never exported.</p>') +
    '</div>' +
    (hasKey ? '<div class="foot"><textarea id="aiq" placeholder="…or ask your own question"></textarea>' +
      '<div class="flex spread" style="margin-top:6px"><button class="btn sm" id="aiask">Ask</button><button class="btn sm ghost hidden" id="aisave">💾 Save as note</button></div></div>' : '') +
    '</div>');
  document.body.appendChild(aiPopup);
  aiPopup.querySelector('#aiclose').onclick = () => { aiPopup.remove(); aiPopup = null; };
  if (!hasKey) return;
  let lastAnswer = '';
  aiPopup.querySelectorAll('[data-q]').forEach(c => c.onclick = () => ask(chipPrompt(c.dataset.q)));
  aiPopup.querySelector('#aiask').onclick = () => { const v = aiPopup.querySelector('#aiq').value.trim(); if (v) ask(v); };
  aiPopup.querySelector('#aisave').onclick = () => {
    if (lastAnswer) { addNote(lastAnswer, 'Ask AI · ' + source, location.hash); toast('Saved to My notes 📝'); }
  };
  function chipPrompt(q) {
    return {
      'Explain simply': 'Explain this simply, in 3-5 sentences, to a senior software engineer new to AI engineering:',
      'Example': 'Give one concrete, realistic example (with numbers or code if useful) illustrating this:',
      'Interview angle': 'How would this topic be probed in an AI engineering interview? Give 2 likely questions and strong answers in brief:',
      'Why it matters': 'Why does this matter in production AI systems? Give the practical consequences in 3-4 sentences:'
    }[q] || q;
  }
  async function ask(question) {
    const out = aiPopup.querySelector('#aianswer');
    out.textContent = '⏳ thinking…';
    try {
      const base = (secrets.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const resp = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + secrets.apiKey },
        body: JSON.stringify({
          model: secrets.apiModel || 'gpt-4o-mini',
          max_tokens: 500,
          messages: [
            { role: 'system', content: 'You are a concise AI-engineering tutor inside a course app. The student is a senior software engineer. Answer briefly and concretely.' },
            { role: 'user', content: question + '\n\n---\nContext (selected from lesson "' + source + '"):\n' + context.slice(0, 1500) }
          ]
        })
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ': ' + (await resp.text()).slice(0, 300));
      const data = await resp.json();
      lastAnswer = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '(empty response)';
      out.textContent = lastAnswer;
      aiPopup.querySelector('#aisave').classList.remove('hidden');
    } catch (err) {
      out.textContent = '⚠ ' + err.message + '\n\nCheck your key, base URL and model in Settings. If calling from a file:// page, the provider must allow CORS (OpenAI, Anthropic-compatible gateways, OpenRouter, and local llama.cpp/ollama all do).';
    }
  }
}

/* ---------------- settings ---------------- */
route('/settings', function () {
  const s = store.settings;
  let html = '<div class="page-head"><h1>Settings & data</h1></div>';

  html += '<div class="card"><h2 class="mt0">Ask-AI key (stays on this device)</h2>' +
    '<p class="muted small">Any OpenAI-compatible endpoint works: OpenAI, OpenRouter, Groq, Together, local llama.cpp / Ollama (<code>http://localhost:11434/v1</code>). Stored in localStorage only — never included in exports or sync.</p>' +
    '<label class="fld">API key<input type="password" id="set-key" value="' + esc(secrets.apiKey || '') + '" placeholder="sk-…"></label>' +
    '<label class="fld">Base URL<input type="text" id="set-base" value="' + esc(secrets.apiBase || '') + '" placeholder="https://api.openai.com/v1"></label>' +
    '<label class="fld">Model<input type="text" id="set-model" value="' + esc(secrets.apiModel || '') + '" placeholder="gpt-4o-mini"></label>' +
    '<button class="btn" id="savekeys">Save keys</button></div>';

  html += '<div class="card"><h2 class="mt0">Cross-device sync (GitHub Gist)</h2>' +
    '<p class="muted small">Create a fine-grained PAT with <b>only the gist scope</b>. Progress syncs last-writer-wins by savedAt timestamp. The token itself never syncs or exports.</p>' +
    '<label class="fld">Gist token (gist scope only)<input type="password" id="set-gtok" value="' + esc(secrets.gistToken || '') + '"></label>' +
    '<label class="fld">Gist ID (leave blank to create one)<input type="text" id="set-gid" value="' + esc(s.gistId || '') + '"></label>' +
    '<div class="flex"><button class="btn" id="syncpush">⬆ Push to gist</button><button class="btn ghost" id="syncpull">⬇ Pull from gist</button><button class="btn ghost" id="syncsmart">⇅ Smart sync</button></div>' +
    '<div class="muted small" id="syncmsg" style="margin-top:8px"></div></div>';

  html += '<div class="card"><h2 class="mt0">Export / import</h2>' +
    '<p class="muted small">Full progress (lessons, quiz/exam scores, flashcard schedule, missions, notes). No secrets.</p>' +
    '<div class="flex"><button class="btn" id="doexport">⬇ Export JSON</button>' +
    '<label class="btn ghost" style="cursor:pointer">⬆ Import JSON<input type="file" id="doimport" accept=".json" class="hidden"></label></div></div>';

  html += '<div class="card danger-zone"><h2 class="mt0">Danger zone</h2>' +
    '<p class="muted small">Wipes all progress, notes, flashcard schedule and exam history on this device. Secrets are wiped too.</p>' +
    '<button class="btn red" id="doreset">Reset everything</button></div>';

  el('view').innerHTML = html;

  el('savekeys').onclick = () => {
    secrets.apiKey = el('set-key').value.trim();
    secrets.apiBase = el('set-base').value.trim();
    secrets.apiModel = el('set-model').value.trim();
    saveSecrets(); toast('Keys saved (this device only)');
  };

  const msg = t => { el('syncmsg').textContent = t; };
  async function gistReq(method, url, body) {
    const resp = await fetch(url, {
      method,
      headers: { 'Authorization': 'Bearer ' + secrets.gistToken, 'Accept': 'application/vnd.github+json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!resp.ok) throw new Error('GitHub ' + resp.status + ' — check token scope (gist) and gist id');
    return resp.json();
  }
  async function pushGist() {
    secrets.gistToken = el('set-gtok').value.trim(); saveSecrets();
    store.settings.gistId = el('set-gid').value.trim();
    if (!secrets.gistToken) return msg('Token required.');
    const files = { 'ai-engineer-progress.json': { content: JSON.stringify(store, null, 1) } };
    if (store.settings.gistId) {
      await gistReq('PATCH', 'https://api.github.com/gists/' + store.settings.gistId, { files });
    } else {
      const g = await gistReq('POST', 'https://api.github.com/gists', { description: 'AI Engineer course progress', public: false, files });
      store.settings.gistId = g.id; el('set-gid').value = g.id;
    }
    saveStore(); msg('Pushed ✓ ' + new Date().toLocaleTimeString());
  }
  async function pullGist(force) {
    secrets.gistToken = el('set-gtok').value.trim(); saveSecrets();
    store.settings.gistId = el('set-gid').value.trim();
    if (!secrets.gistToken || !store.settings.gistId) return msg('Token and gist ID required.');
    const g = await gistReq('GET', 'https://api.github.com/gists/' + store.settings.gistId);
    const f = g.files && g.files['ai-engineer-progress.json'];
    if (!f) return msg('No progress file in that gist.');
    const remote = backfillStore(JSON.parse(f.content));
    if (!force && remote.savedAt <= store.savedAt) return msg('Local copy is newer (last-writer-wins) — nothing pulled. Use Push instead.');
    remote.settings.gistId = store.settings.gistId;
    store = remote; saveStore(); msg('Pulled ✓ — reloading view'); setTimeout(navigate, 400);
  }
  el('syncpush').onclick = () => pushGist().catch(e => msg('⚠ ' + e.message));
  el('syncpull').onclick = () => pullGist(true).catch(e => msg('⚠ ' + e.message));
  el('syncsmart').onclick = async () => {
    try {
      secrets.gistToken = el('set-gtok').value.trim(); saveSecrets();
      store.settings.gistId = el('set-gid').value.trim();
      if (!secrets.gistToken) return msg('Token required.');
      if (!store.settings.gistId) return pushGist();
      const g = await gistReq('GET', 'https://api.github.com/gists/' + store.settings.gistId);
      const f = g.files && g.files['ai-engineer-progress.json'];
      const remote = f ? backfillStore(JSON.parse(f.content)) : null;
      if (remote && remote.savedAt > store.savedAt) { await pullGist(true); }
      else { await pushGist(); }
    } catch (e) { msg('⚠ ' + e.message); }
  };

  el('doexport').onclick = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ai-engineer-progress-' + todayKey() + '.json';
    a.click(); URL.revokeObjectURL(a.href);
  };
  el('doimport').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        store = backfillStore(JSON.parse(rd.result));
        saveStore(); toast('Imported ✓'); navigate();
      } catch (err) { alert('Import failed: ' + err.message); }
    };
    rd.readAsText(file);
  };
  el('doreset').onclick = () => {
    if (!confirm('Really wipe ALL progress, notes and keys on this device?')) return;
    if (!confirm('Last chance — this cannot be undone. Wipe everything?')) return;
    localStorage.removeItem(STORE_KEY); localStorage.removeItem(SECRETS_KEY);
    store = blankStore(); secrets = {};
    toast('Everything reset'); renderSidebar(); navigate();
  };
});

/* ---------------- boot ---------------- */
buildShell();
window.addEventListener('hashchange', () => { navigate(); markActiveNav(location.hash || '#/'); });
navigate();
