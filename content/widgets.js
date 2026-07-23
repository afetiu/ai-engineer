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
