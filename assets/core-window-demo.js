/* Appendix core_token_mask: greedy selection of non-overlapping windows. */
(() => {
  'use strict';
  const root = document.getElementById('core-window-demo');
  const trace = window.CORE_WINDOW_TRACE;
  if (!root || !trace?.length) return;
  const $ = id => document.getElementById(id);
  const sizeInput = $('core-window-size'), countInput = $('core-window-count');
  const panel = $('core-window-trace'), status = $('core-window-status');
  const jump = $('core-window-jump'), map = $('core-window-map');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let windows = [], current = 0;

  function selectWindows(width, count) {
    const prefix = new Float64Array(trace.length + 1);
    for (let i = 0; i < trace.length; i++) prefix[i + 1] = prefix[i] + trace[i][0];
    const scores = Array.from({length: trace.length - width + 1}, (_, i) => prefix[i + width] - prefix[i]);
    const selected = [];
    for (let k = 0; k < count; k++) {
      let best = -1, score = -Infinity;
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] > score) { best = i; score = scores[i]; }
      }
      if (best < 0) break;
      selected.push({start: best, end: best + width, score});
      for (let i = Math.max(0, best - width + 1); i < Math.min(scores.length, best + width); i++) scores[i] = -Infinity;
    }
    return selected;
  }

  function renderTrace() {
    const ordered = windows.map((item, rank) => ({...item, rank})).sort((a, b) => a.start - b.start);
    let html = '', position = 0;
    const text = (start, end) => escape(trace.slice(start, end).map(token => token[1]).join(''));
    for (const item of ordered) {
      html += text(position, item.start);
      html += `<span class="core-window-span" data-core-window="${item.rank}" data-start="${item.start}" data-end="${item.end}" aria-label="Core window ${item.rank + 1}, cumulative NormLP ${item.score.toFixed(3)}">${text(item.start, item.end)}</span>`;
      position = item.end;
    }
    panel.innerHTML = html + text(position, trace.length);
    map.innerHTML = windows.map((item, rank) => `<button type="button" data-core-jump="${rank}" aria-label="Go to core window ${rank + 1}" title="Window ${rank + 1} · cumulative NormLP ${item.score.toFixed(3)}" style="left:${item.start / trace.length * 100}%;width:${(item.end - item.start) / trace.length * 100}%"></button>`).join('');
    jump.innerHTML = windows.map((item, rank) => `<option value="${rank}">Window ${rank + 1} · Σ NormLP ${item.score.toFixed(3)}</option>`).join('');
  }

  function reveal(rank) {
    current = Number(rank);
    jump.value = String(current);
    panel.querySelectorAll('.is-current').forEach(node => node.classList.remove('is-current'));
    map.querySelectorAll('[aria-pressed]').forEach(node => node.removeAttribute('aria-pressed'));
    const span = panel.querySelector(`[data-core-window="${current}"]`);
    if (!span) return;
    span.classList.add('is-current');
    map.querySelector(`[data-core-jump="${current}"]`)?.setAttribute('aria-pressed', 'true');
    const bounds = panel.getBoundingClientRect();
    const rect = span.getClientRects()[0];
    if (rect) panel.scrollTop += rect.top - bounds.top - panel.clientHeight / 3;
    $('core-window-previous').disabled = current === 0;
    $('core-window-next').disabled = current === windows.length - 1;
  }

  function updateRanges() {
    const width = Number(sizeInput.value || 10);
    const max = Number.isInteger(width) && width >= 1 && width <= trace.length ? Math.floor(trace.length / width) : trace.length;
    countInput.max = String(max);
    countInput.placeholder = String(Math.min(10, max));
    $('core-count-range').textContent = `1–${max.toLocaleString()} windows · blank uses ${countInput.placeholder}`;
  }
  sizeInput.max = String(trace.length);
  $('core-size-range').textContent = `1–${trace.length.toLocaleString()} tokens · blank uses 10`;
  updateRanges();
  panel.textContent = trace.map(token => token[1]).join('');
  sizeInput.addEventListener('input', updateRanges);
  $('core-window-form').addEventListener('input', () => {
    status.textContent = 'Click Preview to apply these parameters.';
  });
  function preview() {
    updateRanges();
    const width = Number(sizeInput.value || 10), count = Number(countInput.value || countInput.placeholder);
    if ([sizeInput, countInput].some(input => input.validity.badInput) || !Number.isInteger(width) || width < 1 || width > trace.length || !Number.isInteger(count) || count < 1 || count > Math.floor(trace.length / width)) {
      status.textContent = 'Enter whole numbers within the ranges shown below the fields.';
      return;
    }
    windows = selectWindows(width, count);
    renderTrace();
    const coreTokens = windows.length * width;
    status.textContent = `${windows.length} ${windows.length === 1 ? 'window' : 'windows'} · ${coreTokens.toLocaleString()} / ${trace.length.toLocaleString()} core tokens (${(coreTokens / trace.length * 100).toFixed(1)}%) · W = ${width}, K = ${count}` + (windows.length < count ? ' · No further non-overlapping window fits.' : '');
    $('core-window-results').hidden = false;
    reveal(0);
  }
  $('core-window-form').addEventListener('submit', event => {
    event.preventDefault();
    preview();
  });
  jump.addEventListener('change', () => reveal(jump.value));
  $('core-window-previous').addEventListener('click', () => reveal(Math.max(0, current - 1)));
  $('core-window-next').addEventListener('click', () => reveal(Math.min(windows.length - 1, current + 1)));
  map.addEventListener('click', event => {
    const button = event.target.closest('[data-core-jump]');
    if (button) reveal(button.dataset.coreJump);
  });
  panel.addEventListener('click', event => {
    const span = event.target.closest('[data-core-window]');
    if (span) reveal(span.dataset.coreWindow);
  });
  preview();
})();
