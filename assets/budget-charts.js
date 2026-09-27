/* Seven fixed-cap comparisons, linked to the exact model/cap numerical row. */
(() => {
  'use strict';
  const data = window.BUDGET_DATA;
  if (!data) return;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const COLORS = {'Qwen-3.6-Plus':'#ff7517','Gemini-3-Flash':'#2fab53','Qwen3-Next-80B-3B':'#bb982e','GLM-Air-106B-12B':'#2584e9','Step-Flash-196B-11B':'#e53b89','Hunyuan3-295B-21B':'#908137'};
  const SHORT = {'Qwen-3.6-Plus':'Qwen-3.6-Plus','Gemini-3-Flash':'Gemini-3-Flash','Qwen3-Next-80B-3B':'Qwen3-Next','GLM-Air-106B-12B':'GLM-Air','Step-Flash-196B-11B':'Step-Flash','Hunyuan3-295B-21B':'Hunyuan3'};
  const names = [...new Set(data.rows.map(row=>row.name))];
  let selected = null, hidden = new Set(), metric = 'average', axis = 'tokens';
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => value === null || value === undefined ? '—' : Number(value).toLocaleString('en-US',{maximumFractionDigits:8});
  const acc = value => Number(value).toFixed(1);
  const pair = row => metric === 'average' ? row.average : row.benchmarks[metric];
  const xValue = row => axis === 'tokens' ? pair(row).tokens : pair(row).tokens * row.pricing.output_price / 1000;
  function svg(tag, attrs = {}, value) {
    const node = document.createElementNS(NS,tag);
    for(const [key,val] of Object.entries(attrs)) node.setAttribute(key,val);
    if(value !== undefined) node.textContent = value;
    return node;
  }
  function label(x,y,value,attrs={}) {return svg('text',{x,y,fill:'#75757b','font-size':11,'font-family':'Arial, Helvetica, sans-serif',...attrs},value);}
  function buildTable() {
    $('budget-table-body').innerHTML = data.metadata.caps.map(cap =>
      `<tr class="benchmark-group"><th colspan="13" scope="rowgroup">${cap === '256K' ? 'Unlimited · 256K baseline' : cap + ' simulated cap'}</th></tr>` +
      data.rows.filter(row=>row.cap===cap).map(row=>{
        const pairs = [row.average,...data.metadata.tasks.map(task=>row.benchmarks[task])];
        const cells = pairs.map((values,i)=>`<td class="benchmark-number ${i===0?'average-cell':''}">${number(values.tokens)}</td><td class="benchmark-number ${i===0?'average-cell':''}">${acc(values.accuracy)}</td>`).join('');
        const price = row.pricing.price_url ? `<a href="${esc(row.pricing.price_url)}" target="_blank" rel="noopener noreferrer">${number(row.pricing.output_price)}</a>` : number(row.pricing.output_price);
        return `<tr id="${esc(row.id)}" class="benchmark-data-row" data-budget-id="${esc(row.id)}"><th scope="row" class="model-column">${esc(row.name)}<span class="budget-row-cap">${row.cap==='256K'?'Unlimited · 256K':row.cap+' cap'}</span></th>${cells}<td class="benchmark-number price-cell" title="${esc([row.pricing.openrouter_id,row.pricing.price_type,row.pricing.price_snapshot].filter(Boolean).join(' · '))}">${price}</td><td class="benchmark-number cost-cell">${number(row.cost)}</td></tr>`;
      }).join('')).join('');
  }
  function reveal(scrollPage) {
    if(!selected) return;
    const row = $(selected), container = $('budget-table-scroll');
    const box = row.getBoundingClientRect(), parent = container.getBoundingClientRect();
    container.scrollTop += box.top - parent.top - container.clientHeight/2 + box.height/2;
    if(scrollPage) $('budget-results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }
  function select(row) {
    selected = row.id;
    for(const tr of $('budget-table-body').querySelectorAll('.benchmark-data-row')) {
      const active = tr.dataset.budgetId === row.id;
      tr.classList.toggle('is-highlighted',active);
      active ? tr.setAttribute('aria-current','true') : tr.removeAttribute('aria-current');
    }
    for(const point of $('budget-charts').querySelectorAll('.budget-point')) point.classList.toggle('is-selected',point.dataset.rowId===row.id);
    $('budget-selection-status').textContent = `Highlighted: ${row.name} · ${row.cap==='256K'?'Unlimited (256K)':row.cap+' cap'}`;
    $('budget-locate-row').hidden = false;
    reveal(false);
    document.dispatchEvent(new CustomEvent('budget-row-highlighted',{detail:{id:row.id}}));
  }
  function legend() {
    $('budget-legend').innerHTML=names.map(name=>`<button data-model="${esc(name)}" aria-pressed="${!hidden.has(name)}"><span class="legend-dot" style="--color:${COLORS[name]}"></span>${esc(name)}</button>`).join('');
  }
  function chart(cap) {
    const card = $('budget-panel-'+cap.toLowerCase()), plot = card.querySelector('svg'), tooltip = card.querySelector('.budget-tooltip');
    const rows = data.rows.filter(row=>row.cap===cap&&!hidden.has(row.name));
    const width = Math.max(290,plot.parentElement.clientWidth), height = 320;
    const margin = {left:53,right:19,top:22,bottom:60}, pw=width-margin.left-margin.right, ph=height-margin.top-margin.bottom;
    const xmax=rows.length?Math.max(...rows.map(xValue))*1.17:1;
    const x=value=>margin.left+value/xmax*pw, y=value=>margin.top+ph*(1-value/100);
    tooltip.hidden = true;
    plot.replaceChildren(); plot.setAttribute('viewBox',`0 0 ${width} ${height}`);
    plot.append(svg('title',{},`${cap} token cap: ${metric==='average'?'Average':metric} accuracy versus ${axis==='tokens'?'mean output tokens':'estimated output cost'}`));
    plot.append(svg('desc',{},'Click a point or press Enter to highlight the exact model–cap row in the final numerical table.'));
    for(let value=0;value<=100;value+=20) {
      plot.append(svg('line',{x1:margin.left,y1:y(value),x2:width-margin.right,y2:y(value),stroke:value===0?'#b4b4b8':'#efeff1','stroke-width':.8}));
      plot.append(label(margin.left-8,y(value)+4,value,{'text-anchor':'end'}));
    }
    const raw=xmax/4, power=10**Math.floor(Math.log10(raw)), ratio=raw/power, step=(ratio<=1?1:ratio<=2?2:ratio<=5?5:10)*power;
    for(let value=0;value<=xmax;value+=step) {
      plot.append(svg('line',{x1:x(value),y1:y(0),x2:x(value),y2:y(0)+4,stroke:'#a6a6ac','stroke-width':.8}));
      plot.append(label(x(value),y(0)+19,axis==='tokens'?(value>=1000?number(value/1000)+'K':number(value)):'$'+number(value),{'text-anchor':'middle'}));
    }
    plot.append(label(margin.left+pw/2,height-12,axis==='tokens'?'Mean output tokens':'Output cost / 1K responses (USD)',{'text-anchor':'middle',fill:'#222','font-size':12}));
    plot.append(label(15,margin.top+ph/2,'Accuracy (%)',{transform:`rotate(-90 15 ${margin.top+ph/2})`,'text-anchor':'middle',fill:'#222','font-size':12}));
    const positions = rows.map(row=>({row,x:x(xValue(row)),y:y(pair(row).accuracy)}));
    const occupied = [];
    function overlap(a,b) {return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));}
    for(const point of positions) {
      const row=point.row, title=SHORT[row.name], textWidth=title.length*5.8, textHeight=13;
      const candidates=[[point.x+10,point.y-8],[point.x-textWidth-10,point.y-8],[point.x+10,point.y+19],[point.x-textWidth-10,point.y+19],[point.x-textWidth/2,point.y-22],[point.x-textWidth/2,point.y+32]].map(([lx,ly])=>({x:Math.max(margin.left+2,Math.min(width-margin.right-textWidth,lx)),y:Math.max(margin.top+12,Math.min(y(0)-2,ly)),w:textWidth,h:textHeight}));
      const chosen=candidates.sort((a,b)=>occupied.reduce((sum,box)=>sum+overlap(a,box),0)-occupied.reduce((sum,box)=>sum+overlap(b,box),0))[0];
      occupied.push(chosen);
      const g=svg('g',{class:'budget-point'+(selected===row.id?' is-selected':''),tabindex:0,role:'button','data-row-id':row.id,'aria-label':`${row.name}, ${row.cap} cap, ${metric==='average'?'Average':metric} accuracy ${acc(pair(row).accuracy)}%, ${axis==='tokens'?number(xValue(row))+' output tokens':'cost $'+number(xValue(row))}`});
      g.append(svg('circle',{cx:point.x,cy:point.y,r:11,fill:'transparent',class:'budget-hit'}));
      g.append(svg('circle',{cx:point.x,cy:point.y,r:5.8,fill:row.unlimited?COLORS[row.name]:'#fff',stroke:COLORS[row.name],'stroke-width':2.4,class:'budget-dot'}));
      g.append(label(chosen.x,chosen.y,title,{class:'budget-point-label',fill:COLORS[row.name],'font-size':11}));
      const show=()=>{
        tooltip.innerHTML=`<strong>${esc(row.name)}</strong><span>${row.unlimited?'Unlimited · 256K baseline':row.cap+' simulated cap'} · ${metric==='average'?'Average':esc(metric)}</span><dl><div><dt>Accuracy</dt><dd>${acc(pair(row).accuracy)}%</dd></div><div><dt>Mean output tokens</dt><dd>${number(pair(row).tokens)}</dd></div><div><dt>Output cost / 1K</dt><dd>$${number(pair(row).tokens*row.pricing.output_price/1000)}</dd></div></dl><small>Click to highlight the model–cap row below.</small>`;
        tooltip.hidden=false;
        const rect=card.getBoundingClientRect(),box=g.getBoundingClientRect();
        tooltip.style.left=Math.max(8,Math.min(card.clientWidth-260,box.left-rect.left+12))+'px';
        tooltip.style.top=Math.max(48,Math.min(card.clientHeight-180,box.top-rect.top-80))+'px';
      };
      g.addEventListener('pointerenter',show);g.addEventListener('focus',show);
      g.addEventListener('pointerleave',()=>tooltip.hidden=true);g.addEventListener('blur',()=>tooltip.hidden=true);
      g.addEventListener('click',()=>{select(row);show();});
      g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(row);show();}if(event.key==='Escape')tooltip.hidden=true;});
      plot.append(g);
    }
    if(!rows.length) plot.append(label(margin.left+pw/2,margin.top+ph/2,'No models selected',{'text-anchor':'middle'}));
    card.querySelector('.budget-panel-subtitle').textContent=`${metric==='average'?'Average · all four benchmarks':metric} · ${rows.length} models`;
  }
  function render() {legend();for(const cap of data.metadata.caps) chart(cap);}
  function reset() {
    selected=null;hidden.clear();metric='average';axis='tokens';$('budget-metric').value=metric;$('budget-axis').value=axis;
    for(const row of $('budget-table-body').querySelectorAll('.is-highlighted')) {row.classList.remove('is-highlighted');row.removeAttribute('aria-current');}
    $('budget-selection-status').textContent='Click a budget-chart point to highlight its exact row.';$('budget-locate-row').hidden=true;render();
    document.dispatchEvent(new CustomEvent('budget-row-highlighted',{detail:{id:null}}));
  }
  $('budget-charts').innerHTML=data.metadata.caps.map(cap=>`<article class="budget-panel" id="budget-panel-${cap.toLowerCase()}"><div class="budget-panel-heading"><h3>${cap==='256K'?'Unlimited · 256K':cap+' token cap'}</h3><span>${cap==='256K'?'Original baseline':'Post-hoc simulation'}</span></div><p class="budget-panel-subtitle"></p><div class="budget-plot"><svg role="group" aria-label="${cap} cap interactive model comparison"></svg></div><p class="budget-panel-note">${cap==='256K'?'Solid markers · effectively unlimited generation':'Hollow markers · simulated budget constraint'}</p><div class="budget-tooltip" hidden role="status"></div></article>`).join('');
  buildTable();render();
  $('budget-metric').addEventListener('change',event=>{metric=event.target.value;render();});
  $('budget-axis').addEventListener('change',event=>{axis=event.target.value;render();});
  $('budget-legend').addEventListener('click',event=>{const button=event.target.closest('[data-model]');if(!button)return;const name=button.dataset.model;hidden.has(name)?hidden.delete(name):hidden.add(name);render();});
  $('budget-reset').addEventListener('click',reset);
  $('budget-locate-row').addEventListener('click',()=>reveal(true));
  document.addEventListener('benchmark-selection-cleared',reset);
  document.addEventListener('budget-selection-reset',reset);
  document.addEventListener('budget-row-selected',event=>{
    const row=data.rows.find(row=>row.id===event.detail.id);
    if(row) select(row);
  });
  const observer=new ResizeObserver(()=>{for(const cap of data.metadata.caps)chart(cap);});observer.observe($('budget-charts'));
})();
