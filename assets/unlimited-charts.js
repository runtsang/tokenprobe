/* Five data-driven budget-gradient plots; no image or PDF dependencies. */
(() => {
  'use strict';
  const data = window.BUDGET_DATA, root = document.getElementById('figure-unlimited');
  if (!data || !root) return;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const caps = data.metadata.caps;
  const names = [...new Set(data.rows.map(row => row.name))];
  const models = [
    {color:'#ff7517',shape:'circle'}, {color:'#2fab53',shape:'square'},
    {color:'#bb982e',shape:'diamond'}, {color:'#2584e9',shape:'triangle'},
    {color:'#e53b89',shape:'hexagon'}, {color:'#908137',shape:'cross'}
  ];
  const style = Object.fromEntries(names.map((name,i) => [name,models[i]]));
  const short = {'Qwen-3.6-Plus':'Qwen-3.6-Plus','Gemini-3-Flash':'Gemini-3-Flash','Qwen3-Next-80B-3B':'Qwen3-Next','GLM-Air-106B-12B':'GLM-Air','Step-Flash-196B-11B':'Step-Flash','Hunyuan3-295B-21B':'Hunyuan3'};
  const metrics = [{key:'average',title:'(a) Average',subtitle:'All four benchmarks'}, ...data.metadata.tasks.map((key,i) => ({key,title:`(${String.fromCharCode(98+i)}) ${key}`,subtitle:'Benchmark accuracy'}))];
  const rowLookup = new Map(data.rows.map(row => [row.name+'|'+row.cap,row]));
  const hidden = new Set(), plots = [];
  let capIndex = 3, previewIndex = null, selectedId = null, pinnedPlot = null;
  const esc = value => String(value).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = value => Number(value).toLocaleString('en-US',{maximumFractionDigits:0});
  const pair = (row,key) => key === 'average' ? row.average : row.benchmarks[key];
  const visible = () => names.filter(name => !hidden.has(name));
  const rowAt = (name,index) => rowLookup.get(name+'|'+caps[index]);
  const capLabel = index => index === caps.length-1 ? 'Unlimited · 256K' : caps[index]+' simulated cap';
  function svg(tag,attrs={},value) {
    const element = document.createElementNS(NS,tag);
    for (const [key,val] of Object.entries(attrs)) element.setAttribute(key,val);
    if (value !== undefined) element.textContent = value;
    return element;
  }
  function symbol(name,x,y,size,solid,attrs={}) {
    const {shape,color} = style[name];
    const a = {...attrs,fill:solid?color:'#fff',stroke:color,'stroke-width':1.8,class:'unlimited-symbol'};
    if (shape === 'circle') return svg('circle',{...a,cx:x,cy:y,r:size});
    if (shape === 'square') return svg('rect',{...a,x:x-size,y:y-size,width:size*2,height:size*2});
    const vertices = shape === 'diamond' ? [[0,-1.25],[1.1,0],[0,1.25],[-1.1,0]]
      : shape === 'triangle' ? [[0,-1.25],[1.2,1],[-1.2,1]]
      : shape === 'hexagon' ? [[-1,0],[-.5,-1],[.5,-1],[1,0],[.5,1],[-.5,1]]
      : [[-.35,-1],[.35,-1],[.35,-.35],[1,-.35],[1,.35],[.35,.35],[.35,1],[-.35,1],[-.35,.35],[-1,.35],[-1,-.35],[-.35,-.35]];
    return svg('polygon',{...a,points:vertices.map(([dx,dy]) => `${x+dx*size},${y+dy*size}`).join(' ')});
  }
  function keySvg(name) {
    const element = svg('svg',{viewBox:'0 0 20 20',class:'unlimited-key','aria-hidden':'true'});
    element.append(symbol(name,10,10,5,true));return element.outerHTML;
  }
  function updateLegend() {
    for (const button of $('unlimited-legend').querySelectorAll('button')) button.setAttribute('aria-pressed',String(!hidden.has(button.dataset.model)));
  }
  function selectRow(row,key) {
    selectedId = row.id;
    setCap(caps.indexOf(row.cap),false);
    const values = pair(row,key);
    $('unlimited-selection').textContent = `${row.name} · ${capLabel(capIndex)} · ${key==='average'?'Average':key}: ${values.accuracy.toFixed(1)}% accuracy, ${num(values.tokens)} mean output tokens. Exact model–cap row highlighted below.`;
    document.dispatchEvent(new CustomEvent('budget-row-selected',{detail:{id:row.id}}));
    updateSelection();
  }
  function updateSelection() {
    for (const point of root.querySelectorAll('[data-unlimited-row]')) point.classList.toggle('is-selected',point.dataset.unlimitedRow===selectedId);
  }
  function valuesTable(plot,index,tooltip=false) {
    const namesVisible = visible();
    const header = `<thead><tr><th scope="col">Model</th><th scope="col">Acc. (%)</th><th scope="col">Mean tokens</th></tr></thead>`;
    const body = namesVisible.map(name => {
      const row = rowAt(name,index), values = pair(row,plot.metric.key);
      return `<tr><td><button type="button" class="${tooltip?'unlimited-tooltip-name':''}" data-value-row="${esc(row.id)}">${tooltip?keySvg(name):''}${esc(tooltip?short[name]:name)}</button></td><td>${values.accuracy.toFixed(1)}</td><td>${num(values.tokens)}</td></tr>`;
    }).join('');
    return `<table aria-label="${esc(plot.metric.title)} results at ${esc(capLabel(index))}">${header}<tbody>${body || '<tr><td colspan="3">No models selected</td></tr>'}</tbody></table>`;
  }
  function updateValues() {
    for (const plot of plots) {
      plot.details.querySelector('summary').textContent = 'Values at '+capLabel(capIndex);
      plot.details.querySelector('.unlimited-value-scroll').innerHTML = valuesTable(plot,capIndex);
    }
  }
  function closeTooltip() {
    for (const plot of plots) {plot.tooltip.hidden = true;plot.tooltip.dataset.pinned='false';}
    pinnedPlot = null;previewIndex = null;updateGuides(capIndex);
  }
  function showTooltip(plot,index,pinned=false) {
    if (pinnedPlot && !pinned) return;
    for (const other of plots) if (other !== plot) other.tooltip.hidden=true;
    if (pinned) {pinnedPlot=plot;setCap(index,false);}
    previewIndex=index;updateGuides(index);
    plot.tooltip.dataset.pinned=String(pinned);
    plot.tooltip.innerHTML=`<div class="unlimited-tooltip-heading"><strong>${esc(capLabel(index))}</strong>${pinned?'<button type="button" class="unlimited-tooltip-close" aria-label="Close comparison">×</button>':''}</div>${valuesTable(plot,index,true)}<small>${pinned?'Select a model to highlight its exact table row.':'Click to keep these values open.'}</small>`;
    plot.tooltip.hidden=false;
    const width=plot.svg.getBoundingClientRect().width, x=plot.x(index);
    plot.tooltip.style.left=Math.max(8,Math.min(width-plot.tooltip.offsetWidth-8,x+14))+'px';
    plot.tooltip.style.top='50px';
  }
  function updateGuides(index) {
    for (const plot of plots) {
      if (!plot.guide) continue;
      plot.guide.setAttribute('x1',plot.x(index));plot.guide.setAttribute('x2',plot.x(index));
      plot.band.setAttribute('x',plot.x(index)-9);
      for (const text of plot.svg.querySelectorAll('[data-cap-tick]')) {
        const active=Number(text.dataset.capTick)===index;
        text.style.fill=active?'#267b4e':'#737379';text.style.fontWeight=active?'600':'400';
      }
      plot.hoverMarks.replaceChildren();
      for (const name of visible()) {
        const values=pair(rowAt(name,index),plot.metric.key);
        plot.hoverMarks.append(svg('circle',{cx:plot.x(index),cy:plot.y(values.accuracy),r:9,fill:'none',stroke:style[name].color,'stroke-width':1,opacity:.65}));
      }
    }
  }
  function setCap(index,announce=true) {
    capIndex=Math.max(0,Math.min(caps.length-1,index));
    $('unlimited-budget').value=capIndex;
    $('unlimited-budget').setAttribute('aria-valuetext',capLabel(capIndex));
    $('unlimited-budget-value').textContent=capIndex===caps.length-1?'Unlimited · 256K':caps[capIndex];
    updateGuides(capIndex);updateValues();
    if (announce) $('unlimited-selection').textContent=`Inspecting ${capLabel(capIndex)} across all five plots.`;
  }
  function draw(plot) {
    const width=plot.container.clientWidth;
    if (!width) return;
    const height=width>700?330:315;
    const margin={left:52,right:27,top:17,bottom:64};
    const pw=width-margin.left-margin.right,ph=height-margin.top-margin.bottom;
    plot.x=index=>margin.left+10+index/(caps.length-1)*(pw-20);
    plot.y=value=>margin.top+8+(100-value)/100*(ph-16);
    plot.svg.replaceChildren();plot.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    plot.svg.append(svg('title',{},`${plot.metric.title}: accuracy by token budget`));
    plot.svg.append(svg('desc',{},'Seven reported budget categories from 1K to the unlimited 256K baseline. Arrow keys change the inspected budget; open the values table to select an exact result.'));
    for (let value=0;value<=100;value+=20) {
      plot.svg.append(svg('line',{x1:margin.left,y1:plot.y(value),x2:width-margin.right,y2:plot.y(value),stroke:'#e9e9ed','stroke-width':.8}));
      plot.svg.append(svg('text',{x:margin.left-9,y:plot.y(value)+4,'text-anchor':'end'},value));
    }
    plot.svg.append(svg('line',{x1:margin.left,y1:plot.y(0),x2:width-margin.right,y2:plot.y(0),stroke:'#b4b4b8','stroke-width':1}));
    for (let i=0;i<caps.length;i++) {
      plot.svg.append(svg('line',{x1:plot.x(i),x2:plot.x(i),y1:plot.y(0),y2:plot.y(0)+4,stroke:'#aaa'}));
      plot.svg.append(svg('text',{x:plot.x(i),y:plot.y(0)+20,'text-anchor':'middle','data-cap-tick':i},caps[i]));
    }
    plot.svg.append(svg('text',{x:plot.x(6),y:plot.y(0)+35,'text-anchor':'middle',style:'font-size:11px'},'Unlimited'));
    plot.svg.append(svg('text',{x:margin.left+pw/2,y:height-9,class:'unlimited-axis-title','text-anchor':'middle'},'Token budget (tokens)'));
    plot.svg.append(svg('text',{x:15,y:margin.top+ph/2,class:'unlimited-axis-title','text-anchor':'middle',transform:`rotate(-90 15 ${margin.top+ph/2})`},'Accuracy (%)'));
    plot.band=svg('rect',{x:plot.x(capIndex)-9,y:margin.top,width:18,height:ph,fill:'#eef5ef'});
    plot.guide=svg('line',{x1:plot.x(capIndex),x2:plot.x(capIndex),y1:margin.top,y2:margin.top+ph,stroke:'#98b5a1','stroke-width':1,'pointer-events':'none'});
    plot.svg.append(plot.band,plot.guide);
    const values=visible();
    for (const name of values) {
      const points=caps.map((_,i)=>({row:rowAt(name,i),x:plot.x(i),y:plot.y(pair(rowAt(name,i),plot.metric.key).accuracy)}));
      plot.svg.append(svg('path',{d:points.map((point,i)=>`${i?'L':'M'}${point.x},${point.y}`).join(' '),stroke:style[name].color,class:'unlimited-line','data-unlimited-series':name}));
      for (const point of points) {
        const group=svg('g',{class:'unlimited-point'+(selectedId===point.row.id?' is-selected':''),'data-unlimited-row':point.row.id,'data-unlimited-model':name});
        const val=pair(point.row,plot.metric.key);
        group.append(svg('title',{},`${name} · ${point.row.cap}: ${val.accuracy.toFixed(1)}% accuracy, ${num(val.tokens)} mean output tokens`));
        group.append(symbol(name,point.x,point.y,4.6,point.row.unlimited));
        plot.svg.append(group);
      }
    }
    plot.hoverMarks=svg('g',{'pointer-events':'none'});plot.svg.append(plot.hoverMarks);
    // One nearest-budget target covers overlapping observations and works on touch.
    const overlay=svg('rect',{x:margin.left,y:margin.top,width:pw,height:ph,fill:'transparent','data-unlimited-hit':'true'});
    function indexAt(event) {
      const bounds=plot.svg.getBoundingClientRect();
      const local=(event.clientX-bounds.left)*width/bounds.width;
      return Math.max(0,Math.min(caps.length-1,Math.round((local-plot.x(0))/(plot.x(1)-plot.x(0)))));
    }
    overlay.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')showTooltip(plot,indexAt(event));});
    overlay.addEventListener('pointerleave',()=>{if(!pinnedPlot){plot.tooltip.hidden=true;previewIndex=null;updateGuides(capIndex);}});
    overlay.addEventListener('click',event=>{
      const index=indexAt(event),bounds=plot.svg.getBoundingClientRect(),localY=(event.clientY-bounds.top)*height/bounds.height;
      setCap(index);
      const candidates=visible().map(name=>({row:rowAt(name,index),distance:Math.hypot(plot.x(index)-(event.clientX-bounds.left)*width/bounds.width,plot.y(pair(rowAt(name,index),plot.metric.key).accuracy)-localY)})).sort((a,b)=>a.distance-b.distance);
      if (candidates[0] && candidates[0].distance<=14) selectRow(candidates[0].row,plot.metric.key);
      showTooltip(plot,index,true);
    });
    plot.svg.append(overlay);
    if (!values.length) plot.svg.append(svg('text',{x:margin.left+pw/2,y:margin.top+ph/2,'text-anchor':'middle'},'No models selected'));
    plot.container.querySelector('.unlimited-model-count').textContent=`${values.length} models`;
  }
  function render() {
    closeTooltip();updateLegend();for (const plot of plots) draw(plot);updateValues();updateGuides(capIndex);
  }
  $('unlimited-legend').innerHTML=names.map(name=>`<button type="button" data-model="${esc(name)}" aria-pressed="true">${keySvg(name)}${esc(name)}</button>`).join('');
  $('unlimited-charts').innerHTML=metrics.map((metric,i)=>`<article class="unlimited-panel"><div class="unlimited-panel-heading"><h4 id="unlimited-panel-title-${i}">${esc(metric.title)}</h4><span class="unlimited-model-count">6 models</span></div><svg class="unlimited-plot" role="group" tabindex="0" aria-labelledby="unlimited-panel-title-${i}"></svg><details class="unlimited-values"><summary>Values at 8K simulated cap</summary><div class="unlimited-value-scroll"></div></details><div class="unlimited-tooltip" role="dialog" aria-label="Budget comparison" hidden></div></article>`).join('');
  for (const [i,container] of [...$('unlimited-charts').children].entries()) {
    const plot={container,metric:metrics[i],svg:container.querySelector('.unlimited-plot'),tooltip:container.querySelector('.unlimited-tooltip'),details:container.querySelector('.unlimited-values')};plots.push(plot);
    container.addEventListener('click',event=>{
      const button=event.target.closest('[data-value-row]');
      if (button) {const row=data.rows.find(row=>row.id===button.dataset.valueRow);selectRow(row,plot.metric.key);closeTooltip();}
      if (event.target.closest('.unlimited-tooltip-close')) {closeTooltip();plot.svg.focus();}
    });
    plot.svg.addEventListener('keydown',event=>{
      if (!['ArrowLeft','ArrowRight','Home','End','Enter','Escape'].includes(event.key)) return;
      event.preventDefault();closeTooltip();
      if (event.key==='Escape') return;
      if (event.key==='Enter') {plot.details.open=!plot.details.open;return;}
      setCap(event.key==='Home'?0:event.key==='End'?6:capIndex+(event.key==='ArrowRight'?1:-1));
    });
  }
  $('unlimited-budget').addEventListener('input',event=>{closeTooltip();setCap(Number(event.target.value));});
  $('unlimited-legend').addEventListener('click',event=>{const button=event.target.closest('[data-model]');if(!button)return;const name=button.dataset.model;hidden.has(name)?hidden.delete(name):hidden.add(name);render();});
  function reset() {hidden.clear();selectedId=null;setCap(3);render();}
  $('unlimited-reset').addEventListener('click',()=>{reset();document.dispatchEvent(new CustomEvent('budget-selection-reset'));});
  document.addEventListener('benchmark-selection-cleared',reset);
  document.addEventListener('budget-row-highlighted',event=>{selectedId=event.detail.id;updateSelection();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeTooltip();});
  document.addEventListener('pointerdown',event=>{if(pinnedPlot&&!root.contains(event.target))closeTooltip();});
  const observer=new ResizeObserver(()=>render());observer.observe($('unlimited-charts'));
  render();
})();
