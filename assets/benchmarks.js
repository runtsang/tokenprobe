/* Complete numerical paper tables. Independent of the figure's display filters. */
(() => {
  'use strict';
  const data = window.BENCHMARK_DATA;
  if (!data || !Array.isArray(data.rows)) return;
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selected = null;
  function numeric(value, metric) {
    if (value === null || value === undefined) return '<span class="missing-number" aria-label="Unreported or unavailable">—</span>';
    if (metric === 'money') return Number(value).toLocaleString('en-US', {maximumFractionDigits:8});
    if (metric === 'tokens') return Number(value).toLocaleString('en-US', {maximumFractionDigits:2});
    return Math.abs(Number(value)*10-Math.round(Number(value)*10)) < 1e-8 ? Number(value).toFixed(1) : Number(value).toFixed(2);
  }
  function buildTable(domain, tasks, bodyId) {
    const body = $(bodyId);
    body.innerHTML = data.metadata.groups.map(group => {
      const records = data.rows.filter(row => row.group === group && !(domain === 'out_of_domain' && row.ood_excluded));
      if (!records.length) return '';
      return `<tr class="benchmark-group"><th colspan="13" scope="rowgroup">${escape(group)}</th></tr>` + records.map(row => {
        const measurement = row[domain];
        const pairs = [measurement?.average, ...tasks.map(task => measurement?.benchmarks[task])];
        const numbers = pairs.map((pair, i) => ['tokens','accuracy'].map(metric => `<td class="benchmark-number ${i === 0 ? 'average-cell' : ''}">${numeric(pair?.[metric], metric)}</td>`).join('')).join('');
        const priceTitle = [row.pricing?.openrouter_id, row.pricing?.price_type, row.pricing?.price_snapshot, row.pricing?.pricing_note].filter(Boolean).join(' · ');
        const priceValue = numeric(row.pricing?.output_price, 'money');
        const priceCell = row.pricing?.price_url && row.pricing.output_price !== null ? `<a href="${escape(row.pricing.price_url)}" target="_blank" rel="noopener noreferrer">${priceValue}</a>` : priceValue;
        const costCells = `<td class="benchmark-number price-cell" title="${escape(priceTitle)}">${priceCell}</td><td class="benchmark-number cost-cell">${numeric(measurement?.cost, 'money')}</td>`;
        const footnote = /^Qwen3-(4|8)B/.test(row.name) ? ' <sup title="Serving-price estimates are explained beneath the figure">†</sup>' : '';
        const name = row.chart_id ? `<button type="button" class="benchmark-model-button" aria-label="Highlight ${escape(row.name)} in the accuracy and cost chart">${escape(row.name)}</button>` : escape(row.name);
        const title = [row.chart_id ? 'Click to highlight this configuration in the accuracy and cost chart' : 'Not plotted: no output-cost estimate is available', domain === 'out_of_domain' ? row.ood_note : ''].filter(Boolean).join(' · ');
        return `<tr id="${domain === 'in_domain' ? 'id' : 'ood'}-${escape(row.id)}" data-benchmark-id="${escape(row.id)}" ${row.chart_id ? `data-chart-id="${escape(row.chart_id)}"` : ''} class="benchmark-data-row ${measurement ? '' : 'unreported-row'}" title="${escape(title)}"><th scope="row" class="model-column">${name}${footnote}</th>${numbers}${costCells}</tr>`;
      }).join('');
    }).join('');
  }
  function revealRow(scrollPage) {
    if (!selected) return;
    const row = $('in-domain-body').querySelector(`tr[data-chart-id="${selected.chart_id}"]`);
    if (!row) return;
    const container = $('in-domain-scroll'), box = row.getBoundingClientRect(), containerBox = container.getBoundingClientRect();
    // Reveal within this table, preserving the user's horizontal column position.
    container.scrollTop += box.top - containerBox.top - container.clientHeight / 2 + box.height / 2;
    if (scrollPage) $('in-domain-results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
  }
  function selectModel(id) {
    const match = data.rows.find(row => row.chart_id === id);
    if (!match) return;
    selected = match;
    for (const row of document.querySelectorAll('#in-domain-body .benchmark-data-row, #out-of-domain-body .benchmark-data-row')) {
      const active = row.dataset.chartId === id;
      row.classList.toggle('is-highlighted', active);
      active ? row.setAttribute('aria-current','true') : row.removeAttribute('aria-current');
    }
    $('benchmark-selection-status').textContent = 'Highlighted: ' + match.name;
    $('locate-benchmark-row').hidden = false;
    revealRow(false);
  }
  function clearSelection() {
    selected = null;
    for (const row of document.querySelectorAll('#in-domain-body .is-highlighted, #out-of-domain-body .is-highlighted')) {row.classList.remove('is-highlighted');row.removeAttribute('aria-current');}
    $('benchmark-selection-status').textContent = 'Click a figure point to highlight its row, or click a model row to locate its figure point.';
    $('locate-benchmark-row').hidden = true;
  }
  buildTable('in_domain', data.metadata.in_domain_tasks, 'in-domain-body');
  buildTable('out_of_domain', data.metadata.out_of_domain_tasks, 'out-of-domain-body');
  for (const bodyId of ['in-domain-body','out-of-domain-body']) {
    $(bodyId).addEventListener('click',event=>{
      if(event.target.closest('a'))return;
      const row=event.target.closest('.benchmark-data-row[data-chart-id]');
      if(row)document.dispatchEvent(new CustomEvent('benchmark-row-selected',{detail:{id:row.dataset.chartId}}));
    });
  }
  $('benchmark-coverage').textContent = `${data.rows.length} In-domain configurations; ${data.rows.filter(r=>!r.ood_excluded).length} OOD configurations (${data.rows.filter(r=>r.out_of_domain).length} with reported results).`;
  document.addEventListener('benchmark-model-selected', event => selectModel(event.detail.id));
  document.addEventListener('benchmark-selection-cleared', clearSelection);
  $('locate-benchmark-row').addEventListener('click', () => revealRow(true));
})();
