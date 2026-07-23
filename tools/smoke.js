#!/usr/bin/env node
/* Headless smoke test: boots the app in Chromium and clicks through the main views.
   Dev-only; requires a globally installed playwright (NODE_PATH=/opt/node22/lib/node_modules on CI boxes).
   Usage: node tools/smoke.js */
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/plain' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, buf) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(buf);
  });
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/index.html';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

  async function go(hash, mustContain) {
    await page.goto(base + hash, { waitUntil: 'load' });
    await page.waitForTimeout(250);
    const txt = await page.textContent('#view');
    if (mustContain && !txt.includes(mustContain)) errors.push(hash + ': expected "' + mustContain + '" in view, got: ' + txt.slice(0, 120));
  }

  await go('#/', 'Dashboard');
  const counts = await page.evaluate(() => ({
    modules: COURSE.modules.length, widgets: COURSE.widgets.length,
    diagrams: COURSE.diagrams.length, drills: COURSE.drills.reduce((a, d) => a + d.items.length, 0),
    exams: COURSE.exams.length, missions: COURSE.missions.length, explainers: COURSE.explainers.length
  }));
  console.log('registry:', JSON.stringify(counts));

  const mid = await page.evaluate(() => COURSE.modules[0].id);
  const lid = await page.evaluate(() => COURSE.modules[0].lessons[0].id);
  await go('#/module/' + mid, 'Lessons');
  await go('#/module/' + mid + '/lesson/' + lid, '');
  // accordion toggle
  await page.click('.acc-head');
  // mark lesson read
  await page.click('#markdone');
  await go('#/module/' + mid + '/quiz', 'Question 1');
  // answer first quiz question
  await page.click('.q-option');
  await page.click('#qsubmit');
  const explained = await page.textContent('.q-explain').catch(() => '');
  if (!explained) errors.push('quiz: no explanation after submit');
  await go('#/module/' + mid + '/intuition', '');
  await go('#/module/' + mid + '/flashcards', '');
  const hasCard = await page.$('#fccard');
  if (hasCard) { await page.click('#fccard'); await page.click('#fcyes'); }
  await go('#/module/' + mid + '/lab', '');
  await go('#/review', 'Flashcard review');
  await go('#/diagrams', 'Interactive diagrams');
  const dgid = await page.evaluate(() => COURSE.diagrams.length ? COURSE.diagrams[0].id : null);
  if (dgid) {
    await go('#/diagram/' + dgid, '');
    const svgOk = await page.$('#dgsvg svg');
    if (!svgOk) errors.push('diagram: no svg rendered');
    await page.click('.dg-node');
    const started = await page.$('#dgback');
    if (!started) errors.push('diagram: node click did not open info panel');
  }
  await go('#/playground', 'Playground');
  const wid = await page.evaluate(() => COURSE.widgets.length ? COURSE.widgets[0].id : null);
  if (wid) {
    await go('#/sim/' + wid, '');
    const simOk = await page.$('#simroot input, #simroot textarea, #simroot select');
    if (!simOk) errors.push('widget ' + wid + ': rendered no controls');
  }
  await go('#/drill', 'Speed drill');
  await page.click('#dstart');
  await page.waitForTimeout(300);
  const drillOpt = await page.$('.drill-opts .btn');
  if (!drillOpt) errors.push('drill: no options rendered after start');
  await go('#/missions', 'Missions');
  await go('#/exams', 'practice exams');
  const exid = await page.evaluate(() => COURSE.exams.length ? COURSE.exams[0].id : null);
  if (exid) {
    await go('#/exam/' + exid, '');
    await page.click('#exstart');
    await page.waitForTimeout(200);
    const nav = await page.$$('.exam-nav button');
    if (!nav.length) errors.push('exam: navigator not rendered');
    await page.click('.q-option');
  }
  await go('#/notes', 'My notes');
  await go('#/settings', 'Settings');
  // export button exists
  if (!(await page.$('#doexport'))) errors.push('settings: export button missing');

  // mobile drawer
  await page.setViewportSize({ width: 480, height: 800 });
  await go('#/', 'Dashboard');
  await page.click('#burger');
  const open = await page.$eval('#sidebar', s => s.classList.contains('open'));
  if (!open) errors.push('mobile: burger did not open drawer');

  await browser.close();
  server.close();
  if (errors.length) {
    console.error('SMOKE FAILURES:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('✓ smoke test passed');
})().catch(e => { console.error(e); process.exit(1); });
