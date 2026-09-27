/* Lossless CSV observations rendered locally, without external dependencies. */
(() => {
  'use strict';
  const data = window.COMPRESSION_LIMITS_DATA;
  const root = document.getElementById('figure-compression-limits');
  if (!data || !root) return;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const colors = {GRPO:'#0071f8', KL:'#dd3a1f'};
  const hidden = new Set(), plots = [];
  function el(tag, attributes = {}, text) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const number = value => value.toLocaleString('en-US', {maximumFractionDigits: 8});
  const active = plot => plot.series.filter(series => !hidden.has(series.method));
  function nearest(values, step) {
    let lo = 0, hi = values.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (values[mid].step < step) lo = mid + 1; else hi = mid;
    }
    if (lo > 0 && Math.abs(values[lo-1].step-step) < Math.abs(values[lo].step-step)) lo--;
    return values[lo];
  }
  function inspect(plot, step) {
    plot.selected = step;
    plot.guide.replaceChildren();
    plot.detail.replaceChildren();
    const series = active(plot);
    if (!series.length) {plot.detail.textContent = 'No visible method in this panel.'; return;}
    const rows = series.map(s => ({series:s, point:nearest(s.values, step)}))
      .filter(row => row.point.step >= plot.low && row.point.step <= plot.high && row.point.step === step);
    if (!rows.length) {plot.detail.textContent = `Step ${step} · No recorded observation in this range.`; return;}
    plot.guide.append(el('line', {x1:plot.x(step), x2:plot.x(step), y1:plot.top, y2:plot.bottom, stroke:'#555', 'stroke-dasharray':'3 3'}));
    const label = document.createElement('strong');
    label.textContent = `Step ${step}  `;
    plot.detail.append(label);
    for (const {series:s, point} of rows) {
      plot.guide.append(el(s.method === 'GRPO' ? 'circle' : 'rect', s.method === 'GRPO'
        ? {cx:plot.x(point.step), cy:plot.y(point.tokens), r:4, fill:colors[s.method], stroke:'#fff'}
        : {x:plot.x(point.step)-4, y:plot.y(point.tokens)-4, width:8, height:8, fill:colors[s.method], stroke:'#fff'}));
      const value = document.createElement('span');
      value.textContent = `${s.method}: ${number(point.tokens)} tokens`;
      plot.detail.append(value);
    }
  }
  function draw(plot) {
    const width = Math.round(plot.element.getBoundingClientRect().width);
    if (!width) return;
    const height = width < 400 ? 290 : 315;
    const left = 66, right = width-18, top = 34, bottom = height-53;
    const {low, high} = plot;
    plot.top = top; plot.bottom = bottom;
    plot.range.textContent = `Steps ${low}–${high}${low === plot.firstStep && high === plot.lastStep ? ' · full range' : ' · zoomed'}`;
    plot.element.dataset.fromStep = low;
    plot.element.dataset.toStep = high;
    plot.x = step => left + (step-low) / Math.max(1,high-low) * (right-left);
    plot.y = tokens => bottom - tokens / data.metadata.rollout_cap * (bottom-top);
    plot.element.setAttribute('viewBox', `0 0 ${width} ${height}`);
    plot.element.replaceChildren(el('title', {}, `${plot.title}: mean response length by training step`),
      el('desc', {}, 'Original unsmoothed training observations. GRPO is blue and solid; KL is red and dashed. Click to zoom into this panel. Arrow keys inspect steps, Enter zooms at the selected step, and Escape resets this panel.'));
    const clipId = `compression-clip-${plot.panel}`;
    const defs = el('defs'), clip = el('clipPath', {id:clipId});
    clip.append(el('rect', {x:left, y:top, width:right-left, height:bottom-top}));
    defs.append(clip); plot.element.append(defs);
    for (const value of [0,1024,2048,3072,4096]) {
      const y = plot.y(value);
      plot.element.append(el('line',{x1:left, x2:right, y1:y, y2:y, stroke:value===4096?'#a7a7ac':'#e7e7eb', 'stroke-dasharray':value===4096?'5 3':'2 3'}),
        el('text',{x:left-9, y:y+4, 'text-anchor':'end'},number(value)));
    }
    plot.element.append(el('rect',{x:left,y:top,width:right-left,height:bottom-top,fill:'none',stroke:'#dadade','data-chart-frame':''}));
    const ticks = width < 380 ? 3 : 4;
    for (let i=0; i<ticks; i++) {
      const step = Math.round(low+(high-low)*i/(ticks-1));
      plot.element.append(el('text',{x:plot.x(step),y:bottom+21,'text-anchor':i===0?'start':i===ticks-1?'end':'middle'},step));
    }
    plot.element.append(el('text',{x:(left+right)/2,y:height-8,'text-anchor':'middle',class:'compression-axis-title','data-axis':'x'},'Training step'),
      el('text',{transform:`translate(16 ${(top+bottom)/2}) rotate(-90)`,'text-anchor':'middle',class:'compression-axis-title','data-axis':'y'},'Response length (tokens)'));
    const layer = el('g',{'clip-path':`url(#${clipId})`});
    for (const s of active(plot)) {
      const values = s.values.filter(v => v.step >= low && v.step <= high);
      const path = values.map((v,i) => `${i?'L':'M'}${plot.x(v.step)},${plot.y(v.tokens)}`).join(' ');
      layer.append(el('path',{d:path,class:'compression-line',stroke:colors[s.method],'stroke-dasharray':s.method==='KL'?'5 2':'none','data-series':s.id,'data-observations':values.length}));
    }
    const marker = data.metadata.collapse_markers[plot.panel];
    if (marker && marker >= low && marker <= high) {
      layer.append(el('line',{x1:plot.x(marker),x2:plot.x(marker),y1:top,y2:bottom,stroke:'#303036','stroke-dasharray':'5 4','data-collapse-step':marker}));
      const anchor = plot.x(marker) > right-90 ? 'end' : 'start';
      plot.element.append(el('text',{x:plot.x(marker)+(anchor==='end'?-4:4),y:top-11,'text-anchor':anchor,fill:'#303036'},`Step ${marker}`));
    }
    plot.guide = el('g',{'clip-path':`url(#${clipId})`,'pointer-events':'none'});
    plot.element.append(layer, plot.guide);
    const overlay = el('rect',{x:left,y:top,width:right-left,height:bottom-top,fill:'transparent','data-chart-hit':''});
    plot.element.append(overlay);
    function pointerStep(event) {
      const bounds = plot.element.getBoundingClientRect();
      const x = (event.clientX-bounds.left)*width/bounds.width;
      return Math.max(low,Math.min(high,Math.round(low+(x-left)/(right-left)*(high-low))));
    }
    overlay.addEventListener('pointermove', event => inspect(plot,pointerStep(event)));
    overlay.addEventListener('click', event => zoom(plot,pointerStep(event)));
    plot.element.onkeydown = event => {
      if (event.key === 'Escape') {event.preventDefault(); reset(plot); return;}
      if (!['ArrowLeft','ArrowRight','Home','End','Enter'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Enter') {zoom(plot,plot.selected); return;}
      let step = plot.selected;
      if (event.key === 'Home') step = low;
      else if (event.key === 'End') step = Math.min(high,plot.lastStep);
      else step += event.key === 'ArrowLeft' ? -1 : 1;
      inspect(plot, Math.max(low,Math.min(high,plot.lastStep,step)));
    };
    const selected = Math.max(low,Math.min(high, plot.selected));
    inspect(plot,selected);
  }
  function zoom(plot, step) {
    const span = Math.max(Math.min(4,plot.lastStep-plot.firstStep),Math.floor((plot.high-plot.low)/2));
    const low = Math.max(plot.firstStep,Math.min(plot.lastStep-span,Math.round(step-span/2)));
    plot.low = low;
    plot.high = low+span;
    plot.selected = step;
    draw(plot);
  }
  function reset(plot) {
    plot.low = plot.firstStep;
    plot.high = plot.lastStep;
    plot.selected = data.metadata.collapse_markers[plot.panel] || plot.firstStep;
    draw(plot);
  }
  for (const method of ['GRPO','KL']) {
    const button = document.createElement('button');
    button.type = 'button'; button.setAttribute('aria-pressed','true'); button.dataset.method = method;
    const swatch = document.createElement('span');
    swatch.className = 'compression-key'; swatch.dataset.method = method;
    swatch.style.setProperty('--series-color',colors[method]); swatch.setAttribute('aria-hidden','true');
    button.append(swatch,document.createTextNode(method));
    button.onclick = () => {
      if (hidden.has(method)) hidden.delete(method); else hidden.add(method);
      button.setAttribute('aria-pressed',String(!hidden.has(method))); plots.forEach(draw);
    };
    $('compression-legend').append(button);
  }
  for (const panel of ['A','B','C','D']) {
    const series = data.series.filter(s => s.panel === panel);
    const section = document.createElement('section'); section.className = 'compression-panel';
    const heading = document.createElement('div'); heading.className = 'compression-panel-heading';
    const title = document.createElement('h4'); title.textContent = `(${panel}) ${series[0].model}`;
    const resetButton = document.createElement('button');
    resetButton.type = 'button'; resetButton.textContent = 'Reset';
    resetButton.setAttribute('aria-label',`Reset panel ${panel} to its full range`);
    resetButton.dataset.resetPanel = panel;
    heading.append(title,resetButton);
    const range = document.createElement('p'); range.className = 'compression-panel-range';
    const element = el('svg',{class:'compression-plot',role:'img',tabindex:0,'aria-label':`${title.textContent}. Interactive response length by training step.`});
    const detail = document.createElement('p'); detail.className = 'compression-panel-detail';
    detail.setAttribute('role','status');
    section.append(heading,range,element,detail); $('compression-charts').append(section);
    const firstStep = Math.min(...series.flatMap(s => s.values.map(v => v.step)));
    const lastStep = Math.max(...series.flatMap(s => s.values.map(v => v.step)));
    const plot = {panel, title:title.textContent, series, element, detail, range, firstStep, lastStep, low:firstStep, high:lastStep, selected:data.metadata.collapse_markers[panel] || firstStep};
    resetButton.onclick = () => reset(plot);
    plots.push(plot);

  }
  const observer = new ResizeObserver(() => plots.forEach(draw));
  for (const plot of plots) observer.observe(plot.element);
  plots.forEach(draw);
})();
