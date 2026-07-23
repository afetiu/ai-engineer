/* Playground simulators. render(root, H) with H = {esc, fmtInt, fmtMoney, clamp, onCleanup}. */

/* ---------- 1. Tokenizer playground ---------- */
COURSE.registerWidget({
  id: 'tokenizer-playground',
  moduleId: 'm02-tokens-sampling',
  title: 'Tokenizer playground',
  desc: 'Approximate BPE segmentation of your text — see why "strawberry" is two bricks, not ten letters.',
  render(root, H) {
    // Greedy approximate BPE: common English words/subwords stay whole; the rest splits into chunks.
    const COMMON = ['the', 'and', 'ing', 'ion', 'tion', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but',
      'straw', 'berry', 'function', 'return', 'const', 'import', 'class', 'def', 'print', 'hello', 'world',
      'token', 'model', 'data', 'user', 'name', 'time', 'code', 'test', 'value', 'error', 'string', 'number',
      'er', 'ed', 'ly', 'es', 'un', 're', 'in', 'on', 'at', 'en', 'an', 'or', 'is', 'it', 'as', 'al', 'le'];
    COMMON.sort((a, b) => b.length - a.length);
    function pseudoTokenize(text) {
      const out = [];
      const words = text.split(/(\s+)/);
      for (const w of words) {
        if (!w) continue;
        if (/^\s+$/.test(w)) { if (out.length) out[out.length - 1].trail = true; continue; }
        let rest = w;
        let first = true;
        while (rest.length) {
          let hit = null;
          const lower = rest.toLowerCase();
          for (const c of COMMON) { if (lower.startsWith(c) && (c.length > 2 || rest.length <= 4)) { hit = rest.slice(0, c.length); break; } }
          if (!hit) hit = rest.slice(0, Math.min(rest.length, /^[0-9]+$/.test(rest) ? 3 : 4));
          out.push({ t: (first ? '' : '·') + hit, sp: first });
          rest = rest.slice(hit.length);
          first = false;
        }
      }
      return out;
    }
    const PALETTE = ['#f5e0d1', '#e4efdd', '#dfe9f3', '#f7ead0', '#eae3f2', '#f6dedb'];
    root.innerHTML = '<label class="fld">Your text<textarea id="tkz-in" rows="4">The quick brown strawberry function returned 1234567 tokens unexpectedly.</textarea></label>' +
      '<div class="sim-out"><div id="tkz-viz" class="tokviz"></div>' +
      '<div class="flex" style="margin-top:12px;gap:22px"><div><span class="big" id="tkz-count">0</span><div class="muted small">approx tokens</div></div>' +
      '<div><span class="big" id="tkz-chars">0</span><div class="muted small">characters</div></div>' +
      '<div><span class="big" id="tkz-ratio">0</span><div class="muted small">chars / token</div></div></div>' +
      '<p class="muted small" style="margin-bottom:0">Approximation for intuition only — real BPE merge tables differ (o200k ≈ 200k entries). Rule of thumb: English ≈ 4 chars/token; code and non-Latin scripts diverge hard. Verify with <code>tiktoken</code> for real budgets.</p></div>';
    const input = root.querySelector('#tkz-in');
    function update() {
      const toks = pseudoTokenize(input.value);
      root.querySelector('#tkz-viz').innerHTML = toks.map((tk, i) =>
        '<span style="background:' + PALETTE[i % PALETTE.length] + '">' + H.esc(tk.t) + '</span>' + (tk.trail ? ' ' : '')).join('');
      const chars = input.value.length;
      root.querySelector('#tkz-count').textContent = toks.length;
      root.querySelector('#tkz-chars').textContent = chars;
      root.querySelector('#tkz-ratio').textContent = toks.length ? (chars / toks.length).toFixed(1) : '0';
    }
    input.addEventListener('input', update);
    update();
  }
});

/* ---------- 2. Sampling simulator ---------- */
COURSE.registerWidget({
  id: 'sampling-sim',
  moduleId: 'm02-tokens-sampling',
  title: 'Sampling simulator',
  desc: 'Temperature, top-k and top-p reshaping a real-looking next-token distribution.',
  render(root, H) {
    const TOKENS = [
      ['" the"', 4.1], ['" a"', 3.2], ['" this"', 2.5], ['" its"', 2.1], ['" our"', 1.6],
      ['" an"', 1.2], ['" my"', 0.7], ['" that"', 0.4], ['" one"', 0.1], ['" some"', -0.2],
      ['" your"', -0.5], ['" every"', -0.9], ['" said"', -1.4], ['" banana"', -2.2], ['" quantum"', -2.8], ['" yeet"', -3.5]
    ];
    root.innerHTML =
      '<div class="sim-row"><span class="lbl">Temperature</span><input type="range" id="sp-t" min="0.05" max="2" step="0.05" value="0.8"><span class="val" id="sp-tv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Top-k</span><input type="range" id="sp-k" min="1" max="16" step="1" value="16"><span class="val" id="sp-kv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Top-p (nucleus)</span><input type="range" id="sp-p" min="0.05" max="1" step="0.05" value="1"><span class="val" id="sp-pv"></span></div>' +
      '<div class="sim-out"><div class="muted small" style="margin-bottom:8px">Next-token candidates after <i>“The engineers reviewed ___”</i> (fixed logits → your knobs reshape selection, greyed = cut by top-k/top-p):</div>' +
      '<div id="sp-bars"></div>' +
      '<div class="flex" style="margin-top:10px;gap:22px"><div><span class="big" id="sp-alive">0</span><div class="muted small">tokens in play</div></div>' +
      '<div><span class="big" id="sp-ent">0</span><div class="muted small">entropy (bits)</div></div>' +
      '<button class="btn sm" id="sp-roll">🎲 Sample 20 tokens</button></div>' +
      '<div id="sp-samples" class="small" style="margin-top:8px;font-family:var(--font-mono)"></div></div>';
    const $ = s => root.querySelector(s);
    function compute() {
      const T = +$('#sp-t').value, K = +$('#sp-k').value, P = +$('#sp-p').value;
      $('#sp-tv').textContent = T.toFixed(2); $('#sp-kv').textContent = K; $('#sp-pv').textContent = P.toFixed(2);
      const exps = TOKENS.map(([, l]) => Math.exp(l / T));
      const Z = exps.reduce((a, b) => a + b, 0);
      let probs = exps.map(e => e / Z);
      // rank by prob desc (already sorted by logit)
      const alive = probs.map((_, i) => i < K);
      let cum = 0;
      probs.forEach((p, i) => { if (alive[i]) { if (cum >= P) alive[i] = false; else cum += p; } });
      const Z2 = probs.reduce((a, p, i) => a + (alive[i] ? p : 0), 0) || 1;
      const finalP = probs.map((p, i) => alive[i] ? p / Z2 : 0);
      let ent = 0; finalP.forEach(p => { if (p > 0) ent -= p * Math.log2(p); });
      $('#sp-bars').innerHTML = TOKENS.map(([name], i) =>
        '<div class="probbar' + (alive[i] ? '' : ' cut') + '"><span class="pb-lbl">' + H.esc(name) + '</span>' +
        '<span class="pb-track"><span class="pb-fill" style="width:' + (100 * (alive[i] ? finalP[i] : probs[i])).toFixed(1) + '%"></span></span>' +
        '<span class="pb-val">' + (alive[i] ? (100 * finalP[i]).toFixed(1) + '%' : '✕ cut') + '</span></div>').join('');
      $('#sp-alive').textContent = alive.filter(Boolean).length;
      $('#sp-ent').textContent = ent.toFixed(2);
      return finalP;
    }
    ['#sp-t', '#sp-k', '#sp-p'].forEach(s => $(s).addEventListener('input', () => compute()));
    $('#sp-roll').onclick = () => {
      const p = compute();
      let out = [];
      for (let n = 0; n < 20; n++) {
        let r = Math.random(), acc = 0, pick = 0;
        for (let i = 0; i < p.length; i++) { acc += p[i]; if (r <= acc) { pick = i; break; } }
        out.push(TOKENS[pick][0].replace(/"/g, ''));
      }
      $('#sp-samples').textContent = out.join(' |');
    };
    compute();
  }
});

/* ---------- 3. API cost calculator ---------- */
COURSE.registerWidget({
  id: 'cost-calculator',
  moduleId: 'm04-model-apis',
  title: 'API cost calculator',
  desc: 'Model × traffic × caching → $/day. The arithmetic every AI feature should do before kickoff.',
  render(root, H) {
    // $/Mtok (in, cachedIn, out) — representative early-2026 list prices; update as the market moves.
    const MODELS = [
      ['Frontier (Claude Opus-class)', 15, 1.5, 75],
      ['Frontier (GPT/Claude/Gemini flagship)', 3, 0.3, 15],
      ['Mid-tier (Sonnet-class)', 3, 0.3, 15],
      ['Small (4o-mini / Haiku / Flash-class)', 0.15, 0.02, 0.6],
      ['Open 70B (hosted)', 0.6, 0.6, 0.8],
      ['Open 8B (hosted)', 0.05, 0.05, 0.08]
    ];
    root.innerHTML =
      '<label class="fld">Model tier<select id="cc-model">' + MODELS.map((m, i) => '<option value="' + i + '"' + (i === 1 ? ' selected' : '') + '>' + m[0] + ' — $' + m[1] + ' / $' + m[3] + ' per Mtok</option>').join('') + '</select></label>' +
      '<div class="sim-row"><span class="lbl">Requests / day</span><input type="range" id="cc-req" min="2" max="6" step="0.05" value="4"><span class="val" id="cc-reqv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Input tokens / request</span><input type="range" id="cc-in" min="100" max="50000" step="100" value="6000"><span class="val" id="cc-inv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Output tokens / request</span><input type="range" id="cc-out" min="50" max="8000" step="50" value="700"><span class="val" id="cc-outv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Prompt-cache hit rate</span><input type="range" id="cc-cache" min="0" max="95" step="5" value="0"><span class="val" id="cc-cachev"></span></div>' +
      '<div class="sim-out"><div class="grid cols-3">' +
      '<div class="center"><span class="big" id="cc-day"></span><div class="muted small">per day</div></div>' +
      '<div class="center"><span class="big" id="cc-month"></span><div class="muted small">per month</div></div>' +
      '<div class="center"><span class="big" id="cc-per"></span><div class="muted small">per request</div></div></div>' +
      '<div class="muted small" id="cc-split" style="margin-top:10px"></div>' +
      '<p class="muted small" style="margin-bottom:0">Cache hit rate applies to input tokens (system prompt, tools, stable history) at the cached rate. Note how output tokens dominate at low input sizes and caching flips the economics at high ones. Prices are representative list prices as of early 2026 — always check current sheets.</p></div>';
    const $ = s => root.querySelector(s);
    function update() {
      const m = MODELS[+$('#cc-model').value];
      const reqs = Math.round(Math.pow(10, +$('#cc-req').value));
      const tin = +$('#cc-in').value, tout = +$('#cc-out').value, hit = +$('#cc-cache').value / 100;
      $('#cc-reqv').textContent = H.fmtInt(reqs);
      $('#cc-inv').textContent = H.fmtInt(tin);
      $('#cc-outv').textContent = H.fmtInt(tout);
      $('#cc-cachev').textContent = Math.round(hit * 100) + '%';
      const inCost = reqs * tin * ((1 - hit) * m[1] + hit * m[2]) / 1e6;
      const outCost = reqs * tout * m[3] / 1e6;
      const day = inCost + outCost;
      $('#cc-day').textContent = H.fmtMoney(day, day < 10 ? 2 : 0);
      $('#cc-month').textContent = H.fmtMoney(day * 30, day * 30 < 10 ? 2 : 0);
      $('#cc-per').textContent = '$' + (day / reqs).toFixed(4);
      $('#cc-split').textContent = 'Split: input ' + H.fmtMoney(inCost, 2) + '/day · output ' + H.fmtMoney(outCost, 2) + '/day · ' +
        (outCost > inCost ? 'output-dominated — shorter answers and cheaper output tiers pay off most.' : 'input-dominated — caching, prompt dieting and history caps pay off most.');
    }
    root.querySelectorAll('select,input').forEach(x => x.addEventListener('input', update));
    update();
  }
});

/* ---------- 4. Context window budget calculator ---------- */
COURSE.registerWidget({
  id: 'context-budget',
  moduleId: 'm08-context-engineering',
  title: 'Context window budget',
  desc: 'System + tools + history + RAG + output reserve, fighting for one window.',
  render(root, H) {
    const SLICES = [
      ['System prompt', 'cb-sys', 100, 12000, 2000, '#b4531f'],
      ['Tool schemas', 'cb-tools', 0, 20000, 3000, '#c8912a'],
      ['Few-shot examples', 'cb-shot', 0, 15000, 1000, '#6d5590'],
      ['Conversation history', 'cb-hist', 0, 100000, 8000, '#38618c'],
      ['RAG chunks', 'cb-rag', 0, 60000, 6000, '#4a7c46'],
      ['Output reserve (max_tokens)', 'cb-out', 256, 32000, 4000, '#b03a2e']
    ];
    root.innerHTML =
      '<label class="fld">Context window<select id="cb-win"><option value="32000">32k (small/local)</option><option value="128000" selected>128k (typical frontier)</option><option value="200000">200k (Claude-class)</option><option value="1000000">1M (long-context tier)</option></select></label>' +
      SLICES.map(s => '<div class="sim-row"><span class="lbl">' + s[0] + '</span><input type="range" id="' + s[1] + '" min="' + s[2] + '" max="' + s[3] + '" step="100" value="' + s[4] + '"><span class="val" id="' + s[1] + 'v"></span></div>').join('') +
      '<div class="sim-out"><div style="display:flex;height:34px;border-radius:8px;overflow:hidden;border:1px solid var(--line)" id="cb-bar"></div>' +
      '<div class="flex spread" style="margin-top:10px"><div><span class="big" id="cb-used"></span><div class="muted small">tokens used</div></div>' +
      '<div class="right"><span class="big" id="cb-free"></span><div class="muted small">headroom for the user\'s actual question</div></div></div>' +
      '<div id="cb-warn" style="margin-top:8px"></div></div>';
    const $ = s => root.querySelector(s);
    function update() {
      const win = +$('#cb-win').value;
      let used = 0; const parts = [];
      SLICES.forEach(s => {
        const v = +$('#' + s[1]).value;
        $('#' + s[1] + 'v').textContent = H.fmtInt(v);
        used += v; parts.push([s[0], v, s[5]]);
      });
      const free = win - used;
      $('#cb-bar').innerHTML = parts.map(p =>
        '<div title="' + p[0] + ': ' + H.fmtInt(p[1]) + '" style="width:' + (100 * p[1] / win) + '%;background:' + p[2] + '"></div>').join('') +
        '<div style="flex:1;background:var(--bg-deep)"></div>';
      $('#cb-used').textContent = H.fmtInt(used);
      $('#cb-free').textContent = H.fmtInt(free);
      $('#cb-warn').innerHTML = free < 0
        ? '<div class="callout gotcha" style="margin:0"><span class="co-title">Over budget</span> Requests will fail or silently truncate. Something must shrink — usually history (summarize) or RAG chunk count.</div>'
        : free < win * 0.1
          ? '<div class="callout limits" style="margin:0"><span class="co-title">Tight</span> Under 10% headroom. Long user inputs will blow this up; degradation should be designed, not discovered.</div>'
          : '<div class="callout note" style="margin:0"><span class="co-title">Healthy</span> Remember: bigger windows ≠ free — you pay per token every request, and mid-context recall degrades (“lost in the middle”).</div>';
    }
    root.querySelectorAll('select,input').forEach(x => x.addEventListener('input', update));
    update();
  }
});

/* ---------- 5. Embedding similarity explorer ---------- */
COURSE.registerWidget({
  id: 'embedding-explorer',
  moduleId: 'm06-embeddings-vector-search',
  title: 'Embedding similarity explorer',
  desc: 'A toy 2-D embedding space — click a phrase, see its 5 nearest neighbors by cosine similarity.',
  render(root, H) {
    // [label, x, y, clusterColor] — hand-authored 2-D "embeddings"; cosine = angle from origin.
    const PTS = [
      ['kubernetes pod', 7.8, 1.9, '#38618c'], ['docker container', 7.0, 2.2, '#38618c'],
      ['helm chart', 5.9, 1.4, '#38618c'], ['CI/CD pipeline', 6.6, 2.8, '#38618c'],
      ['terraform module', 4.9, 1.8, '#38618c'], ['load balancer', 8.4, 3.1, '#38618c'],
      ['java language', 6.1, 3.5, '#b03a2e'], ['java island', 5.2, 3.4, '#b03a2e'],
      ['bali beach holiday', 4.6, 5.3, '#c8912a'], ['island vacation', 3.9, 5.0, '#c8912a'],
      ['sourdough starter', 2.6, 6.9, '#b4531f'], ['braised short ribs', 2.0, 7.6, '#b4531f'],
      ['cast-iron skillet', 2.9, 7.9, '#b4531f'], ['simmer the sauce', 1.2, 7.0, '#b4531f'],
      ['gradient descent', -1.8, 7.4, '#6d5590'], ['transformer attention', -2.6, 6.8, '#6d5590'],
      ['overfitting', -3.3, 7.7, '#6d5590'], ['embedding vector', -1.4, 6.3, '#6d5590'],
      ['learning rate', -2.2, 8.2, '#6d5590'],
      ['compound interest', -6.6, 3.8, '#4a7c46'], ['index fund', -7.4, 3.0, '#4a7c46'],
      ['quarterly earnings', -5.8, 3.2, '#4a7c46'], ['hedge fund', -8.0, 4.1, '#4a7c46'],
      ['balance sheet', -6.9, 2.4, '#4a7c46']
    ];
    function cos(a, b) { return (a[1] * b[1] + a[2] * b[2]) / (Math.hypot(a[1], a[2]) * Math.hypot(b[1], b[2])); }
    root.innerHTML =
      '<label class="fld">Pick a phrase (or click a dot on the map)<select id="ee-sel">' +
      PTS.map((p, i) => '<option value="' + i + '"' + (p[0] === 'java island' ? ' selected' : '') + '>' + H.esc(p[0]) + '</option>').join('') +
      '</select></label>' +
      '<canvas id="ee-cv" class="simcanvas" width="660" height="420"></canvas>' +
      '<div class="sim-out"><div class="muted small" style="margin-bottom:6px">5 nearest neighbors by cosine similarity (computed from the 2-D coordinates):</div><div id="ee-list"></div>' +
      '<p class="muted small" style="margin-bottom:0">The planted trap: <b>“java island”</b> lands closer to <b>“java language”</b> and the devops cluster than to “bali beach holiday”. That is polysemy — one surface string, several meanings, and a single vector forced to average them, so the dominant sense in the training data (code) wins. Real embedding spaces use 256–3,072 dimensions precisely so different senses and facets can separate along different axes; this 2-D toy only shows the geometry (angle ≈ cosine), not that capacity.</p></div>';
    const cv = root.querySelector('#ee-cv'), ctx = cv.getContext('2d'), sel = root.querySelector('#ee-sel');
    function px(x) { return (x + 9) / 18.5 * 620 + 20; }
    function py(y) { return 400 - (y + 0.5) / 9.5 * 380; }
    function draw() {
      const si = +sel.value, s = PTS[si];
      const nn = PTS.map((p, i) => [i, cos(s, p)]).filter(e => e[0] !== si).sort((a, b) => b[1] - a[1]).slice(0, 5);
      ctx.clearRect(0, 0, 660, 420);
      ctx.strokeStyle = '#c9b7a0';
      nn.forEach(e => { const p = PTS[e[0]]; ctx.beginPath(); ctx.moveTo(px(s[1]), py(s[2])); ctx.lineTo(px(p[1]), py(p[2])); ctx.stroke(); });
      PTS.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(px(p[1]), py(p[2]), i === si ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = p[3]; ctx.fill();
        if (i === si) { ctx.lineWidth = 2; ctx.strokeStyle = '#1e1a14'; ctx.stroke(); ctx.lineWidth = 1; }
        ctx.fillStyle = '#4c4336'; ctx.font = (i === si ? 'bold ' : '') + '11px sans-serif';
        ctx.fillText(p[0], px(p[1]) + 8, py(p[2]) - 6);
      });
      root.querySelector('#ee-list').innerHTML = nn.map(e =>
        '<div class="probbar"><span class="pb-lbl" style="width:170px">' + H.esc(PTS[e[0]][0]) + '</span>' +
        '<span class="pb-track"><span class="pb-fill" style="width:' + (Math.max(0, e[1]) * 100).toFixed(1) + '%"></span></span>' +
        '<span class="pb-val">' + e[1].toFixed(3) + '</span></div>').join('');
    }
    cv.addEventListener('click', ev => {
      const r = cv.getBoundingClientRect();
      const mx = (ev.clientX - r.left) * 660 / r.width, my = (ev.clientY - r.top) * 420 / r.height;
      let best = 0, bd = 1e9;
      PTS.forEach((p, i) => { const d = Math.hypot(px(p[1]) - mx, py(p[2]) - my); if (d < bd) { bd = d; best = i; } });
      if (bd < 30) { sel.value = String(best); draw(); }
    });
    sel.addEventListener('input', draw);
    draw();
  }
});

/* ---------- 6. Chunking strategy visualizer ---------- */
COURSE.registerWidget({
  id: 'chunking-visualizer',
  moduleId: 'm07-rag',
  title: 'Chunking strategy visualizer',
  desc: 'Fixed-size vs structure-aware chunking on a real document — watch where the knife falls.',
  render(root, H) {
    const DOC = [
      '# Payments API incident runbook',
      'This runbook covers the first sixty minutes of any customer-facing incident on the payments API. It assumes you are the on-call engineer, that you have production read access, and that the incident commander role has not yet been assigned. Follow the sections in order and resist the urge to skip the communication step when the debugging gets interesting.',
      '## Detection',
      'Most incidents announce themselves through the burn-rate alerts on the checkout success SLO. A fast-burn alert means the error budget for the month will be gone within hours; treat it as a page, not a ticket. Slow-burn alerts arrive by email and can wait for business hours, but they often foreshadow the fast variety, so note them in the channel.',
      'Before declaring an incident, confirm the signal in two independent places. Dashboards can lie after a deploy that renames a metric, so cross-check the raw load balancer logs and the synthetic canary that runs a test purchase every minute from three regions. Two independent signals agreeing is the bar for paging anyone else.',
      '## Triage',
      'The first question is always the same: what changed? Check the deploy log, the feature flag audit trail, and the upstream status pages for the card networks before reading any code. Roughly eight out of ten payment incidents trace back to a change we shipped ourselves within the previous six hours.',
      'If nothing changed on our side, look at traffic shape instead. A sudden surge of declines concentrated in a single bank identification number range usually means an issuer outage, not a bug. In that case the fix is a status page update and a retry policy adjustment, never a rollback.',
      '## Rollback',
      'Rollbacks are cheap and reversible; debugging in production during an outage is neither. If a deploy is implicated and the error rate is above one percent, roll back first and investigate afterwards. The deploy pipeline keeps the previous three images warm, so a full rollback completes in under four minutes.',
      'Database migrations are the exception. Never roll a service back past a schema migration without checking the expand-and-contract ledger, because the old binary may not understand the new schema. When in doubt, roll forward with a revert commit instead of rolling back the deploy.',
      '## Communication',
      'Post in the incident channel within ten minutes of acknowledging the page, even if the update is only that you are looking. Silence reads as absence. The status page owes customers an update every thirty minutes while checkout is degraded, written in plain language without internal service names.',
      'Escalate to the incident commander rotation when two conditions hold: customer impact is confirmed and the fix is not obvious within fifteen minutes. Handing off coordination is not an admission of failure; it frees the person with the most context to debug while someone else manages stakeholders and the timeline.',
      '## Postmortem',
      'Schedule the postmortem within two business days while memories are fresh. The document is blameless: it names systems and gaps, never people. Every action item gets an owner and a due date, and the incident is not closed until the monitoring gap that let the problem grow unnoticed has been fixed.'
    ].join('\n\n');
    const PALETTE = ['#f5e0d1', '#e4efdd', '#dfe9f3', '#f7ead0', '#eae3f2', '#f6dedb'];
    root.innerHTML =
      '<div class="sim-row"><span class="lbl">Chunk size (chars)</span><input type="range" id="ch-size" min="100" max="1200" step="25" value="400"><span class="val" id="ch-sizev"></span></div>' +
      '<div class="sim-row"><span class="lbl">Overlap</span><input type="range" id="ch-ovl" min="0" max="50" step="5" value="10"><span class="val" id="ch-ovlv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Strategy</span><label class="small" style="font-weight:400"><input type="checkbox" id="ch-aware"> paragraph/heading-aware (packs whole paragraphs, starts fresh at headings; overlap ignored)</label></div>' +
      '<div class="sim-out"><div class="grid cols-4">' +
      '<div class="center"><span class="big" id="ch-n"></span><div class="muted small">chunks</div></div>' +
      '<div class="center"><span class="big" id="ch-avg"></span><div class="muted small">avg chars/chunk</div></div>' +
      '<div class="center"><span class="big" id="ch-mid"></span><div class="muted small">mid-sentence splits</div></div>' +
      '<div class="center"><span class="big" id="ch-tok"></span><div class="muted small">tokens/query (top-4)</div></div></div>' +
      '<div id="ch-doc" style="white-space:pre-wrap;font-size:.78rem;line-height:1.55;margin-top:12px;max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:6px;padding:8px"></div>' +
      '<p class="muted small" style="margin:10px 0 0">Striped regions are overlap (indexed twice — you pay embedding + storage for them twice). Mid-sentence splits are where fixed-size chunking cuts a sentence in half: the orphaned half embeds poorly and retrieves as noise. Structure-aware chunking nearly eliminates them at the price of uneven chunk sizes. Tokens/query estimates retrieving the top-4 chunks at ~4 chars/token.</p></div>';
    const $ = s => root.querySelector(s);
    function chunkFixed(size, ovl) {
      const out = [], step = Math.max(20, Math.round(size * (1 - ovl)));
      for (let s = 0; s < DOC.length; s += step) {
        const e = Math.min(DOC.length, s + size);
        out.push([s, e]);
        if (e >= DOC.length) break;
      }
      return out;
    }
    function chunkAware(size) {
      const out = [];
      let pos = 0, start = 0, len = 0;
      DOC.split('\n\n').forEach(p => {
        const pe = pos + p.length;
        const isHead = p.charAt(0) === '#';
        if (len > 0 && (isHead || len + p.length + 2 > size)) { out.push([start, pos - 2]); len = 0; }
        if (p.length > size) {           // oversize paragraph: fall back to sentence-boundary cuts
          if (len > 0) { out.push([start, pos - 2]); len = 0; }
          let cs = pos;
          while (pe - cs > size) {
            const seg = DOC.slice(cs, cs + size);
            let cut = Math.max(seg.lastIndexOf('. '), seg.lastIndexOf('! '), seg.lastIndexOf('? '));
            cut = cut > 40 ? cs + cut + 1 : cs + size;
            out.push([cs, cut]); cs = cut;
          }
          out.push([cs, pe]);
        } else {
          if (len === 0) start = pos;
          len += p.length + 2;
        }
        pos = pe + 2;
      });
      if (len > 0) out.push([start, DOC.length]);
      return out;
    }
    function update() {
      const size = +$('#ch-size').value, ovl = +$('#ch-ovl').value / 100, aware = $('#ch-aware').checked;
      $('#ch-sizev').textContent = H.fmtInt(size);
      $('#ch-ovlv').textContent = Math.round(ovl * 100) + '%';
      const chunks = aware ? chunkAware(size) : chunkFixed(size, ovl);
      let mid = 0;
      chunks.forEach(c => { const e = c[1]; if (e < DOC.length && !/[.!?\n]/.test(DOC.charAt(e - 1))) mid++; });
      const avg = chunks.reduce((a, c) => a + (c[1] - c[0]), 0) / chunks.length;
      $('#ch-n').textContent = chunks.length;
      $('#ch-avg').textContent = H.fmtInt(Math.round(avg));
      $('#ch-mid').textContent = mid;
      $('#ch-tok').textContent = '≈' + H.fmtInt(Math.round(avg / 4) * Math.min(4, chunks.length));
      // paint: split doc into segments at every chunk boundary, color by owning chunk(s)
      const cuts = new Set([0, DOC.length]);
      chunks.forEach(c => { cuts.add(c[0]); cuts.add(c[1]); });
      const bs = Array.from(cuts).sort((a, b) => a - b);
      let html = '';
      for (let i = 0; i < bs.length - 1; i++) {
        const a = bs[i], b = bs[i + 1];
        const owners = [];
        chunks.forEach((c, ci) => { if (c[0] <= a && c[1] >= b) owners.push(ci); });
        const txt = H.esc(DOC.slice(a, b));
        if (!owners.length) html += '<span>' + txt + '</span>';
        else if (owners.length === 1) html += '<span style="background:' + PALETTE[owners[0] % 6] + '">' + txt + '</span>';
        else html += '<span style="background:repeating-linear-gradient(45deg,#e9d5c0 0 6px,#d9bfa2 6px 12px)" title="overlap — indexed in ' + owners.length + ' chunks">' + txt + '</span>';
      }
      $('#ch-doc').innerHTML = html;
    }
    root.querySelectorAll('input').forEach(x => x.addEventListener('input', update));
    update();
  }
});

/* ---------- 7. Retrieval precision/recall trade-off ---------- */
COURSE.registerWidget({
  id: 'retrieval-tradeoff',
  moduleId: 'm07-rag',
  title: 'Retrieval precision/recall trade-off',
  desc: 'Top-k, score threshold and corpus noise fighting over precision, recall and your token budget.',
  render(root, H) {
    function mulberry32(seed) {
      return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    const REL = 12, CORPUS = 120, TOKENS_PER_CHUNK = 380, BUDGET = 8000;
    root.innerHTML =
      '<div class="sim-row"><span class="lbl">Top-k retrieved</span><input type="range" id="rt-k" min="1" max="20" step="1" value="5"><span class="val" id="rt-kv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Score threshold</span><input type="range" id="rt-th" min="0" max="0.95" step="0.05" value="0.3"><span class="val" id="rt-thv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Corpus noise level</span><input type="range" id="rt-nz" min="0" max="100" step="5" value="30"><span class="val" id="rt-nzv"></span></div>' +
      '<div class="sim-out"><div class="muted small" style="margin-bottom:6px">Corpus: ' + CORPUS + ' chunks, ' + REL + ' truly relevant to the query. Same seeded PRNG (mulberry32) every run — only your knobs move the numbers.</div>' +
      '<div id="rt-bars"></div>' +
      '<div class="probbar" style="margin-top:10px"><span class="pb-lbl" style="width:120px">context tokens</span><span class="pb-track"><span class="pb-fill" id="rt-tokfill" style="background:#c8912a"></span></span><span class="pb-val" id="rt-tokv"></span></div>' +
      '<div id="rt-note" style="margin-top:10px"></div></div>';
    const $ = s => root.querySelector(s);
    function bar(label, v, color) {
      return '<div class="probbar"><span class="pb-lbl" style="width:120px">' + label + '</span>' +
        '<span class="pb-track"><span class="pb-fill" style="width:' + (v * 100).toFixed(1) + '%;background:' + color + '"></span></span>' +
        '<span class="pb-val">' + (v * 100).toFixed(0) + '%</span></div>';
    }
    function update() {
      const k = +$('#rt-k').value, th = +$('#rt-th').value, nz = +$('#rt-nz').value / 100;
      $('#rt-kv').textContent = k; $('#rt-thv').textContent = th.toFixed(2); $('#rt-nzv').textContent = Math.round(nz * 100) + '%';
      const rnd = mulberry32(20260723);
      const docs = [];
      for (let i = 0; i < CORPUS; i++) {
        const rel = i < REL;
        const g = (rnd() + rnd() + rnd()) / 3;   // bell-ish
        const score = rel ? 0.55 + 0.4 * g - nz * 0.30 * rnd() : 0.20 + 0.35 * g + nz * 0.45 * rnd();
        docs.push([rel, Math.max(0, Math.min(1, score))]);
      }
      docs.sort((a, b) => b[1] - a[1]);
      const kept = docs.filter(d => d[1] >= th).slice(0, k);
      const tp = kept.filter(d => d[0]).length;
      const prec = kept.length ? tp / kept.length : 0;
      const rec = tp / REL;
      const f1 = (prec + rec) ? 2 * prec * rec / (prec + rec) : 0;
      $('#rt-bars').innerHTML = bar('precision', prec, '#38618c') + bar('recall', rec, '#4a7c46') + bar('F1', f1, '#6d5590');
      const toks = kept.length * TOKENS_PER_CHUNK;
      $('#rt-tokfill').style.width = Math.min(100, toks / BUDGET * 100) + '%';
      $('#rt-tokv').textContent = H.fmtInt(toks);
      let note;
      if (!kept.length) note = '<div class="callout gotcha" style="margin:0"><span class="co-title">Nothing retrieved</span> Threshold above every score — the model answers from parametric memory alone, i.e. it will guess.</div>';
      else if (prec < 0.5) note = '<div class="callout gotcha" style="margin:0"><span class="co-title">Low precision</span> Over half the context is distractors. Irrelevant chunks do not just waste ' + H.fmtInt(toks) + ' tokens — models anchor on plausible-looking wrong passages, so hallucination risk goes <i>up</i> with more retrieval, not down.</div>';
      else if (rec < 0.5) note = '<div class="callout limits" style="margin:0"><span class="co-title">Low recall</span> Most relevant chunks never reach the model. No prompt engineering fixes missing facts — answers will be confidently incomplete.</div>';
      else note = '<div class="callout note" style="margin:0"><span class="co-title">Balanced</span> Decent precision and recall. Note the noise slider: as embedding quality degrades (jargon corpus, bad chunking), no k/threshold pair stays good — fix retrieval upstream, not by tuning k.</div>';
      $('#rt-note').innerHTML = note;
    }
    root.querySelectorAll('input').forEach(x => x.addEventListener('input', update));
    update();
  }
});

/* ---------- 8. VRAM & quantization calculator ---------- */
COURSE.registerWidget({
  id: 'vram-calculator',
  moduleId: 'm15-inference-internals',
  title: 'VRAM & quantization calculator',
  desc: 'Weights + KV cache + overhead vs the GPUs you can actually buy.',
  render(root, H) {
    // [label, params(B), layers, heads, head_dim] — representative dense-model shapes
    const MODELS = [
      ['3B', 3, 28, 24, 128], ['8B', 8, 32, 32, 128], ['13B', 13, 40, 40, 128],
      ['32B', 32, 64, 40, 128], ['70B', 70, 80, 64, 128], ['405B', 405, 126, 128, 128]
    ];
    // [label, bytes/weight, kv bytes/elem]
    const QUANTS = [
      ['FP16 / BF16', 2, 2], ['FP8', 1, 1], ['INT8', 1, 1],
      ['Q5_K_M (~5.5 bpw)', 0.69, 2], ['Q4_K_M (~4.9 bpw)', 0.61, 2]
    ];
    const GPUS = [['1× RTX 4090 (24 GB)', 24], ['1× A100 40 GB', 40], ['1× A100/H100 80 GB', 80],
      ['2× H100 (160 GB)', 160], ['4× H100 (320 GB)', 320], ['8× H100 node (640 GB)', 640]];
    root.innerHTML =
      '<label class="fld">Model size<select id="vr-m">' + MODELS.map((m, i) => '<option value="' + i + '"' + (i === 1 ? ' selected' : '') + '>' + m[0] + ' params (' + m[2] + ' layers, ' + m[3] + ' heads)</option>').join('') + '</select></label>' +
      '<label class="fld">Quantization<select id="vr-q">' + QUANTS.map((q, i) => '<option value="' + i + '">' + q[0] + '</option>').join('') + '</select></label>' +
      '<label class="fld">Attention layout<select id="vr-g"><option value="1">MHA 1:1 (kv heads = heads)</option><option value="4">GQA 4:1</option><option value="8" selected>GQA 8:1</option></select></label>' +
      '<div class="sim-row"><span class="lbl">Context length</span><input type="range" id="vr-ctx" min="2048" max="262144" step="2048" value="16384"><span class="val" id="vr-ctxv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Batch size (concurrent seqs)</span><input type="range" id="vr-b" min="1" max="32" step="1" value="1"><span class="val" id="vr-bv"></span></div>' +
      '<div class="sim-out"><div class="grid cols-4">' +
      '<div class="center"><span class="big" id="vr-w"></span><div class="muted small">weights GB</div></div>' +
      '<div class="center"><span class="big" id="vr-kv"></span><div class="muted small">KV cache GB</div></div>' +
      '<div class="center"><span class="big" id="vr-oh"></span><div class="muted small">overhead GB</div></div>' +
      '<div class="center"><span class="big" id="vr-tot"></span><div class="muted small">total VRAM GB</div></div></div>' +
      '<div id="vr-verdict" style="margin-top:10px"></div>' +
      '<p class="muted small" style="margin:10px 0 0">KV cache = 2 (K and V) × layers × kv_heads × head_dim × bytes × tokens × batch. Overhead ≈ 8% of weights + 0.75 GB for CUDA context, activations and fragmentation. Note the lever ordering: quantization shrinks weights 2–3.5×, GQA shrinks KV 4–8×, and at long context + real batch sizes <b>KV cache, not weights, is what evicts you from the GPU</b>. FP8/INT8 here also assume a quantized KV cache; GGUF Q4/Q5 keep KV in FP16.</p></div>';
    const $ = s => root.querySelector(s);
    function update() {
      const m = MODELS[+$('#vr-m').value], q = QUANTS[+$('#vr-q').value];
      const ratio = +$('#vr-g').value, ctx = +$('#vr-ctx').value, batch = +$('#vr-b').value;
      $('#vr-ctxv').textContent = (ctx / 1024) + 'k';
      $('#vr-bv').textContent = batch;
      const kvHeads = Math.max(1, Math.round(m[3] / ratio));
      const weights = m[1] * 1e9 * q[1] / 1e9;
      const kv = 2 * m[2] * kvHeads * m[4] * q[2] * ctx * batch / 1e9;
      const oh = weights * 0.08 + 0.75;
      const total = weights + kv + oh;
      $('#vr-w').textContent = weights.toFixed(1);
      $('#vr-kv').textContent = kv.toFixed(1);
      $('#vr-oh').textContent = oh.toFixed(1);
      $('#vr-tot').textContent = total.toFixed(1);
      const fit = GPUS.find(g => total <= g[1]);
      $('#vr-verdict').innerHTML = fit
        ? '<div class="callout note" style="margin:0"><span class="co-title">Fits</span> Smallest common option: <b>' + fit[0] + '</b>' + (fit[1] - total < fit[1] * 0.1 ? ' — but under 10% headroom; expect OOMs under load. Size for the next tier or cut context.' : ' (' + (fit[1] - total).toFixed(1) + ' GB headroom for spikes).') + '</div>'
        : '<div class="callout gotcha" style="margin:0"><span class="co-title">Does not fit one node</span> ' + total.toFixed(0) + ' GB exceeds an 8×H100 node — you are in multi-node tensor/pipeline-parallel territory, or you cut precision, context, batch, or model size.</div>';
    }
    root.querySelectorAll('select,input').forEach(x => x.addEventListener('input', update));
    update();
  }
});

/* ---------- 9. Latency vs throughput batching sim ---------- */
COURSE.registerWidget({
  id: 'batching-sim',
  moduleId: 'm15-inference-internals',
  title: 'Latency vs throughput batching sim',
  desc: 'A continuous-batching server: throughput multiplies with batch size — until the queue explodes.',
  render(root, H) {
    // Analytic model: decode step time L(b) = t0·(1 + a·b); memory-bound, so batching is nearly free.
    const T0 = 0.018, A = 0.045, PREFILL = 0.06;
    root.innerHTML =
      '<div class="sim-row"><span class="lbl">Arrival rate (req/s)</span><input type="range" id="bt-l" min="0.2" max="40" step="0.2" value="4"><span class="val" id="bt-lv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Max batch size</span><input type="range" id="bt-b" min="1" max="64" step="1" value="16"><span class="val" id="bt-bv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Tokens per response</span><input type="range" id="bt-t" min="50" max="2000" step="50" value="400"><span class="val" id="bt-tv"></span></div>' +
      '<div class="sim-out"><div class="grid cols-4">' +
      '<div class="center"><span class="big" id="bt-thr"></span><div class="muted small">throughput tok/s</div></div>' +
      '<div class="center"><span class="big" id="bt-ttft"></span><div class="muted small">avg time-to-first-token</div></div>' +
      '<div class="center"><span class="big" id="bt-lat"></span><div class="muted small">avg total latency</div></div>' +
      '<div class="center"><span class="big" id="bt-util"></span><div class="muted small">GPU utilization</div></div></div>' +
      '<div class="probbar" style="margin-top:10px"><span class="pb-lbl" style="width:120px">utilization</span><span class="pb-track"><span class="pb-fill" id="bt-ufill"></span></span><span class="pb-val" id="bt-uval"></span></div>' +
      '<div id="bt-note" style="margin-top:10px"></div>' +
      '<p class="muted small" style="margin:10px 0 0">Why batching is nearly free: decode is memory-bandwidth-bound — each step streams the whole model from HBM whether it serves 1 sequence or 32, so a step for batch 16 costs only slightly more than for batch 1 (here L(b) = ' + (T0 * 1000) + ' ms × (1 + ' + A + '·b)). Throughput scales ~linearly with batch while per-token latency creeps up gently — until arrivals exceed capacity, queueing theory takes over, and wait time grows like 1/(1−utilization). The knee lives at ~80–90% utilization; production servers deliberately run below it.</p></div>';
    const $ = s => root.querySelector(s);
    function update() {
      const lam = +$('#bt-l').value, B = +$('#bt-b').value, T = +$('#bt-t').value;
      $('#bt-lv').textContent = lam.toFixed(1); $('#bt-bv').textContent = B; $('#bt-tv').textContent = H.fmtInt(T);
      const L = b => T0 * (1 + A * b);
      const capacity = B / L(B);                 // tok/s at full batch
      const rho = Math.min(lam * T / capacity, 1.05);
      let b = 1;                                  // steady-state occupancy: b = min(B, λ·T·L(b))
      for (let i = 0; i < 40; i++) b = Math.min(B, Math.max(1, lam * T * L(b)));
      const thr = Math.min(lam * T, capacity);
      const over = rho >= 0.995;
      const ttft = over ? Infinity : PREFILL + 0.15 * rho / (1 - rho);
      const lat = over ? Infinity : ttft + T * L(b);
      $('#bt-thr').textContent = H.fmtInt(Math.round(thr));
      $('#bt-ttft').textContent = over ? '∞' : (ttft < 1 ? Math.round(ttft * 1000) + ' ms' : ttft.toFixed(1) + ' s');
      $('#bt-lat').textContent = over ? '∞' : lat.toFixed(1) + ' s';
      $('#bt-util').textContent = Math.round(Math.min(rho, 1) * 100) + '%';
      $('#bt-ufill').style.width = Math.min(rho, 1) * 100 + '%';
      $('#bt-ufill').style.background = rho > 0.85 ? '#b03a2e' : '#4a7c46';
      $('#bt-uval').textContent = Math.round(Math.min(rho, 1) * 100) + '%';
      $('#bt-note').innerHTML = over
        ? '<div class="callout gotcha" style="margin:0"><span class="co-title">Saturated</span> Arrivals exceed capacity (' + H.fmtInt(Math.round(capacity)) + ' tok/s) — the queue grows without bound and every latency percentile goes to the moon. Shed load, add replicas, or raise max batch.</div>'
        : rho > 0.85
          ? '<div class="callout limits" style="margin:0"><span class="co-title">On the knee</span> Above ~85% utilization the 1/(1−ρ) term dominates: a small traffic bump doubles or triples wait time. This is where p99 alerts fire while averages still look fine.</div>'
          : '<div class="callout note" style="margin:0"><span class="co-title">Healthy region</span> Effective batch ≈ ' + b.toFixed(1) + '. Try doubling arrival rate: throughput rises almost linearly while latency barely moves — that is the free lunch of continuous batching, and it lasts exactly until the knee.</div>';
    }
    root.querySelectorAll('input').forEach(x => x.addEventListener('input', update));
    update();
  }
});

/* ---------- 10. Agent step budget vs success sim ---------- */
COURSE.registerWidget({
  id: 'agent-budget-sim',
  moduleId: 'm09-agents-loop',
  title: 'Agent step budget vs success sim',
  desc: 'Per-step reliability compounds brutally — and the metric that matters is cost per SUCCESSFUL task.',
  render(root, H) {
    const K = 8;               // steps a task actually requires
    const PRICE = 6;           // $/Mtok blended (Sonnet-class agent traffic, early 2026)
    root.innerHTML =
      '<div class="sim-row"><span class="lbl">Per-step success prob.</span><input type="range" id="ab-p" min="50" max="99" step="1" value="90"><span class="val" id="ab-pv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Step budget</span><input type="range" id="ab-n" min="1" max="30" step="1" value="12"><span class="val" id="ab-nv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Tokens per step</span><input type="range" id="ab-c" min="200" max="5000" step="100" value="1500"><span class="val" id="ab-cv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Error recovery</span><label class="small" style="font-weight:400"><input type="checkbox" id="ab-r" checked> retry failed steps once (retry succeeds at 0.7× base rate, costs an extra step)</label></div>' +
      '<div class="sim-out"><div class="muted small" style="margin-bottom:6px">Task modeled as ' + K + ' required sequential steps. Success probability vs step budget (current budget highlighted):</div>' +
      '<div id="ab-chart" style="display:flex;align-items:flex-end;gap:2px;height:96px;border-bottom:1px solid var(--line)"></div>' +
      '<div class="grid cols-4" style="margin-top:12px">' +
      '<div class="center"><span class="big" id="ab-ps"></span><div class="muted small">task success prob.</div></div>' +
      '<div class="center"><span class="big" id="ab-es"></span><div class="muted small">expected steps used</div></div>' +
      '<div class="center"><span class="big" id="ab-cost"></span><div class="muted small">cost per attempt</div></div>' +
      '<div class="center"><span class="big" id="ab-cps"></span><div class="muted small">cost per SUCCESS</div></div></div>' +
      '<div id="ab-note" style="margin-top:10px"></div>' +
      '<p class="muted small" style="margin:10px 0 0">Cost assumes ' + H.fmtMoney(PRICE, 0) + '/Mtok blended (agent loops are input-heavy: the whole transcript is re-sent every step — early-2026 Sonnet-class pricing). Cost per success = cost per attempt ÷ success probability: failed attempts still burn tokens, so unreliable agents get <i>more</i> expensive per delivered result even though each run looks cheap.</p></div>';
    const $ = s => root.querySelector(s);
    function solve(p, retry) {
      const MAX = 30, q = 0.7 * p;
      const dp = []; for (let i = 0; i <= K; i++) dp.push(new Array(MAX + 1).fill(0));
      const fail = new Array(MAX + 1).fill(0);
      dp[0][0] = 1;
      for (let s = 0; s < K; s++) for (let a = 0; a < MAX; a++) {
        const m = dp[s][a]; if (!m) continue;
        dp[s + 1][a + 1] += m * p;
        const f = m * (1 - p);
        if (retry && a + 2 <= MAX) { dp[s + 1][a + 2] += f * q; fail[a + 2] += f * (1 - q); }
        else fail[a + 1] += f;
      }
      return { done: dp[K], fail: fail };
    }
    function update() {
      const p = +$('#ab-p').value / 100, N = +$('#ab-n').value, c = +$('#ab-c').value, retry = $('#ab-r').checked;
      $('#ab-pv').textContent = Math.round(p * 100) + '%'; $('#ab-nv').textContent = N; $('#ab-cv').textContent = H.fmtInt(c);
      const r = solve(p, retry);
      function stats(B) {
        let ps = 0, es = 0, seen = 0;
        for (let a = 1; a <= B; a++) { ps += r.done[a]; es += a * (r.done[a] + r.fail[a]); seen += r.done[a] + r.fail[a]; }
        return [ps, es + B * Math.max(0, 1 - seen)];
      }
      let bars = '', cum = 0;
      for (let b = 1; b <= 30; b++) {
        cum += r.done[b] || 0;
        bars += '<div title="budget ' + b + ': ' + (cum * 100).toFixed(1) + '%" style="flex:1;background:' + (b === N ? '#b4531f' : '#38618c') + ';height:' + Math.max(2, cum * 92) + 'px"></div>';
      }
      $('#ab-chart').innerHTML = bars;
      const st = stats(N);
      const cost = st[1] * c / 1e6 * PRICE;
      $('#ab-ps').textContent = (st[0] * 100).toFixed(1) + '%';
      $('#ab-es').textContent = st[1].toFixed(1);
      $('#ab-cost').textContent = H.fmtMoney(cost, 3);
      $('#ab-cps').textContent = st[0] > 0.001 ? H.fmtMoney(cost / st[0], 3) : '∞';
      $('#ab-note').innerHTML = st[0] < 0.5
        ? '<div class="callout gotcha" style="margin:0"><span class="co-title">Coin-flip agent</span> ' + Math.round(p * 100) + '% per step sounds high, but 0.' + Math.round(p * 100) + '^' + K + ' compounds to ' + (Math.pow(p, K) * 100).toFixed(0) + '% before retries. Fixes that raise per-step reliability (better tools, tighter prompts, validation) beat raising the budget.</div>'
        : '<div class="callout note" style="margin:0"><span class="co-title">Diminishing returns</span> Past the curve\'s knee, extra budget mostly funds doomed runs — success barely rises but expected cost keeps climbing. Cap budgets just past the knee and surface failures instead of retrying forever.</div>';
    }
    root.querySelectorAll('input').forEach(x => x.addEventListener('input', update));
    update();
  }
});

/* ---------- 11. LLM-as-judge agreement sim ---------- */
COURSE.registerWidget({
  id: 'judge-agreement-sim',
  moduleId: 'm11-evals',
  title: 'LLM-as-judge agreement sim',
  desc: 'How often does a noisy, biased judge crown the truly better prompt? Small effects need big N.',
  render(root, H) {
    function mulberry32(seed) {
      return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    const TRIALS = 300;
    root.innerHTML =
      '<div class="sim-row"><span class="lbl">True quality gap (A better)</span><input type="range" id="jg-d" min="0" max="30" step="1" value="8"><span class="val" id="jg-dv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Position bias</span><input type="range" id="jg-pb" min="0" max="30" step="1" value="10"><span class="val" id="jg-pbv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Length bias (B is wordier)</span><input type="range" id="jg-lb" min="0" max="30" step="1" value="5"><span class="val" id="jg-lbv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Eval set size</span><input type="range" id="jg-n" min="10" max="500" step="10" value="100"><span class="val" id="jg-nv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Judge samples per case</span><input type="range" id="jg-s" min="1" max="5" step="1" value="1"><span class="val" id="jg-sv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Order handling</span><label class="small" style="font-weight:400"><input type="checkbox" id="jg-rand" checked> randomize A/B position per sample (unchecked: candidate A always shown second)</label></div>' +
      '<div class="sim-out"><div class="grid cols-3">' +
      '<div class="center"><span class="big" id="jg-corr"></span><div class="muted small">runs where verdict picks A (truly better)</div></div>' +
      '<div class="center"><span class="big" id="jg-pc"></span><div class="muted small">per-comparison P(vote A)</div></div>' +
      '<div class="center"><span class="big" id="jg-cmp"></span><div class="muted small">judge calls per run</div></div></div>' +
      '<div id="jg-note" style="margin-top:10px"></div>' +
      '<p class="muted small" style="margin:10px 0 0">Seeded simulation (' + TRIALS + ' repeated experiments, mulberry32). A pp-gap of X means A truly wins X% more head-to-heads. Position bias favors whichever answer the judge sees in the biased slot; length bias systematically favors the wordier B. Randomizing order turns position bias into noise instead of a thumb on the scale; nothing but a better judge (or explicit length normalization) fixes length bias.</p></div>';
    const $ = s => root.querySelector(s);
    function update() {
      const d = +$('#jg-d').value, pb = +$('#jg-pb').value, lb = +$('#jg-lb').value;
      const N = +$('#jg-n').value, S = +$('#jg-s').value, randOrd = $('#jg-rand').checked;
      $('#jg-dv').textContent = d + ' pp'; $('#jg-pbv').textContent = pb + '%'; $('#jg-lbv').textContent = lb + '%';
      $('#jg-nv').textContent = H.fmtInt(N); $('#jg-sv').textContent = S;
      const rnd = mulberry32(424242);
      let correct = 0;
      for (let t = 0; t < TRIALS; t++) {
        let winsA = 0;
        for (let i = 0; i < N; i++) {
          let votesA = 0;
          for (let s = 0; s < S; s++) {
            const aFirst = randOrd ? rnd() < 0.5 : false;
            let pA = 0.5 + d / 200 - lb / 200 + (aFirst ? pb / 200 : -pb / 200);
            pA = Math.max(0.02, Math.min(0.98, pA));
            if (rnd() < pA) votesA++;
          }
          if (votesA * 2 > S) winsA++; else if (votesA * 2 === S && rnd() < 0.5) winsA++;
        }
        if (winsA * 2 > N) correct++; else if (winsA * 2 === N && rnd() < 0.5) correct++;
      }
      const frac = correct / TRIALS;
      const pcMean = 0.5 + d / 200 - lb / 200 - (randOrd ? 0 : pb / 200);
      $('#jg-corr').textContent = (frac * 100).toFixed(0) + '%';
      $('#jg-pc').textContent = (Math.max(0.02, Math.min(0.98, pcMean)) * 100).toFixed(1) + '%';
      $('#jg-cmp').textContent = H.fmtInt(N * S);
      let note;
      if (d === 0) note = '<div class="callout limits" style="margin:0"><span class="co-title">No true difference</span> Anything away from 50% here is pure bias plus luck. This is the null test to run before trusting any judge pipeline.</div>';
      else if (pcMean <= 0.5) note = '<div class="callout gotcha" style="margin:0"><span class="co-title">Bias flipped the verdict</span> Systematic biases (' + (randOrd ? 'length' : 'length + fixed position') + ') outweigh the true ' + d + ' pp gap — the judge now prefers the <i>worse</i> variant on average, and more data only makes it more confidently wrong.</div>';
      else if (frac < 0.8) note = '<div class="callout limits" style="margin:0"><span class="co-title">Underpowered</span> A ' + d + ' pp effect with N=' + N + ' gives only ' + (frac * 100).toFixed(0) + '% correct verdicts — you would ship the worse prompt ' + ((1 - frac) * 100).toFixed(0) + '% of the time. Grow N, average more samples per case, or accept only bigger effects.</div>';
      else note = '<div class="callout note" style="margin:0"><span class="co-title">Adequately powered</span> Verdicts are reliable at this effect size. Now halve the quality gap and watch how fast that confidence evaporates — small effects need disproportionately big N.</div>';
      $('#jg-note').innerHTML = note;
    }
    root.querySelectorAll('input').forEach(x => x.addEventListener('input', update));
    update();
  }
});

/* ---------- 12. Fine-tune vs prompt cost crossover ---------- */
COURSE.registerWidget({
  id: 'finetune-crossover',
  moduleId: 'm14-fine-tuning',
  title: 'Fine-tune vs prompt cost crossover',
  desc: 'Fine-tuning pays by deleting few-shot tokens at volume — not by magic. Find your break-even.',
  render(root, H) {
    const CORE = 900;   // tokens/request that survive either way (~600 in + 300 out, blended)
    root.innerHTML =
      '<div class="sim-row"><span class="lbl">Requests / day</span><input type="range" id="ft-r" min="2" max="6" step="0.05" value="4"><span class="val" id="ft-rv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Prompt overhead removed (tok)</span><input type="range" id="ft-o" min="0" max="4000" step="50" value="1200"><span class="val" id="ft-ov"></span></div>' +
      '<div class="sim-row"><span class="lbl">Base model $/Mtok (blended)</span><input type="range" id="ft-pb" min="0.1" max="20" step="0.1" value="3"><span class="val" id="ft-pbv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Tuned model $/Mtok (blended)</span><input type="range" id="ft-pt" min="0.1" max="40" step="0.1" value="6"><span class="val" id="ft-ptv"></span></div>' +
      '<div class="sim-row"><span class="lbl">One-time tuning cost ($)</span><input type="range" id="ft-tc" min="0" max="5000" step="50" value="500"><span class="val" id="ft-tcv"></span></div>' +
      '<div class="sim-row"><span class="lbl">Self-hosted tuned model</span><label class="small" style="font-weight:400"><input type="checkbox" id="ft-sh"> dedicated GPU instead of per-token API</label></div>' +
      '<div class="sim-row"><span class="lbl">Hosting $/day (if self-host)</span><input type="range" id="ft-h" min="0" max="500" step="10" value="40"><span class="val" id="ft-hv"></span></div>' +
      '<div class="sim-out"><div class="grid cols-4">' +
      '<div class="center"><span class="big" id="ft-dp"></span><div class="muted small">prompting $/day</div></div>' +
      '<div class="center"><span class="big" id="ft-dt"></span><div class="muted small">fine-tuned $/day</div></div>' +
      '<div class="center"><span class="big" id="ft-be"></span><div class="muted small">break-even req/day</div></div>' +
      '<div class="center"><span class="big" id="ft-rec"></span><div class="muted small">days to recoup tuning</div></div></div>' +
      '<div id="ft-verdict" style="margin-top:10px"></div>' +
      '<p class="muted small" style="margin:10px 0 0">Model: every request carries ' + H.fmtInt(CORE) + ' core tokens either way; prompting additionally pays the overhead tokens (few-shot examples, style guides, output-format lectures) that a tuned model has internalized. As of early 2026, API fine-tuned inference typically bills ~1.5–2× the base model $/Mtok, while a dedicated L4/A10G box runs ~$25–50/day and an H100 ~$50–80/day. If fine-tuning does not delete enough prompt tokens to beat its own price markup, no volume ever saves you money.</p></div>';
    const $ = s => root.querySelector(s);
    function update() {
      const req = Math.round(Math.pow(10, +$('#ft-r').value));
      const ovh = +$('#ft-o').value, pb = +$('#ft-pb').value, pt = +$('#ft-pt').value;
      const tc = +$('#ft-tc').value, sh = $('#ft-sh').checked, host = sh ? +$('#ft-h').value : 0;
      $('#ft-rv').textContent = H.fmtInt(req); $('#ft-ov').textContent = H.fmtInt(ovh);
      $('#ft-pbv').textContent = '$' + pb.toFixed(2); $('#ft-ptv').textContent = sh ? '(n/a)' : '$' + pt.toFixed(2);
      $('#ft-tcv').textContent = H.fmtMoney(tc, 0); $('#ft-hv').textContent = sh ? H.fmtMoney(host, 0) : '(off)';
      const tunedRate = sh ? 0 : pt;
      const dayPrompt = req * (CORE + ovh) * pb / 1e6;
      const dayTuned = req * CORE * tunedRate / 1e6 + host;
      const gainPerReq = ((CORE + ovh) * pb - CORE * tunedRate) / 1e6;   // $/request saved by tuning
      $('#ft-dp').textContent = H.fmtMoney(dayPrompt, dayPrompt < 10 ? 2 : 0);
      $('#ft-dt').textContent = H.fmtMoney(dayTuned, dayTuned < 10 ? 2 : 0);
      let beTxt, verdict;
      if (gainPerReq <= 0) {
        beTxt = 'never';
        verdict = '<div class="callout gotcha" style="margin:0"><span class="co-title">No crossover exists</span> The tuned model costs more per request than the overhead it removes (' + H.fmtInt(ovh) + ' tok at $' + pb.toFixed(2) + '/Mtok vs a ' + (tunedRate && pb ? (tunedRate / pb).toFixed(1) : '—') + '× price markup on every token). At any volume, prompting wins — fine-tune for quality or latency reasons, not cost.</div>';
      } else {
        const be = host / gainPerReq;
        beTxt = host > 0 ? H.fmtInt(Math.ceil(be)) : '0';
        const saving = dayPrompt - dayTuned;
        const rec = saving > 0 ? tc / saving : Infinity;
        verdict = saving > 0
          ? '<div class="callout note" style="margin:0"><span class="co-title">Fine-tuning wins at this volume</span> Saves ' + H.fmtMoney(saving, 2) + '/day (' + H.fmtMoney(saving * 365, 0) + '/yr); the ' + H.fmtMoney(tc, 0) + ' tuning bill is recouped in ' + (rec < 1 ? 'under a day' : H.fmtInt(Math.ceil(rec)) + ' days') + '. The entire saving comes from deleting ' + H.fmtInt(ovh) + ' overhead tokens × ' + H.fmtInt(req) + ' requests — check the removed few-shots did not cost you accuracy before celebrating.</div>'
          : '<div class="callout limits" style="margin:0"><span class="co-title">Below break-even</span> At ' + H.fmtInt(req) + ' req/day the fixed costs outweigh per-request savings. Crossover sits at ~' + beTxt + ' req/day — below that, keep prompting and revisit when traffic grows.</div>';
        $('#ft-rec').textContent = saving > 0 ? (tc / saving < 1 ? '<1' : H.fmtInt(Math.ceil(tc / saving))) : '—';
      }
      if (gainPerReq <= 0) $('#ft-rec').textContent = '—';
      $('#ft-be').textContent = beTxt;
      $('#ft-verdict').innerHTML = verdict;
    }
    root.querySelectorAll('input').forEach(x => x.addEventListener('input', update));
    update();
  }
});
