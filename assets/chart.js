/* Dependency-free SVG chart. All calculations use the bundled evaluation snapshot. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const payload = window.CHART_DATA;
  if (!payload || !Array.isArray(payload.models)) {
    $('model-count').textContent = 'Data unavailable';
    $('chart-status').textContent = 'Check that data/models.js is included in the uploaded folder.';
    return;
  }
  const models = payload.models;
  const COLORS = {Google:'#2fab53',OpenAI:'#222222',Anthropic:'#d27861',xAI:'#7465d9','Alibaba / Qwen':'#ff7517','Z.ai':'#2584e9',DeepSeek:'#354bf4','Moonshot AI':'#0b9da0',StepFun:'#e53b89',Tencent:'#908137','Our models':'#21985b',closed:'#ce6c57',open:'#2584e9',ours:'#21985b'};
  const CATEGORY = {closed:'Closed-source API',open:'Open-source baseline',ours:'Our models'};
  const NS = 'http://www.w3.org/2000/svg';
  const defaults = () => ({selected:new Set(models.map(m=>m.id)),categories:new Set(['closed','open','ours']),hiddenGroups:new Set(),minAccuracy:'',maxCost:'',scale:'log',unit:1000,colorBy:'provider',labels:'all',pareto:true,quadrant:true,table:false,sort:'cost',sortDir:1});
  let state = defaults(), drawn = [], visible = [], frontier = [], pinned = null, positions = [], toastTimer;
  let dimensions = {width:1100,height:490};
  function escapeHTML(value) {return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function usd(value) {return '$'+Number(value.toPrecision(8)).toLocaleString('en-US',{maximumFractionDigits:8});}
  function accuracy(value) {return Number(value.toFixed(2)).toString()+'%';}
  function group(m) {return state.colorBy==='category'?m.category:(m.category==='ours'?'Our models':m.provider);}
  function color(m) {return COLORS[group(m)] || '#777';}
  function cost(m) {return m.cost===null ? null : m.cost*state.unit/1000;}
  function pareto(points) {
    const result=[]; let best=-Infinity;
    const sorted=[...points].filter(m=>m.cost!==null).sort((a,b)=>a.cost-b.cost || b.accuracy-a.accuracy);
    for(const m of sorted) {
      // Identical metrics are equally non-dominated. Lower-accuracy cost ties are dominated.
      if(m.accuracy>best) {result.push(m);best=m.accuracy;}
      else if(result.length && m.cost===result[result.length-1].cost && m.accuracy===result[result.length-1].accuracy) result.push(m);
    }
    return result;
  }
  function median(values) {const v=[...values].sort((a,b)=>a-b),n=v.length;return n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2;}
  function svg(tag,attrs={},text) {const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs)) el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
  function textEl(x,y,text,attrs={}) {return svg('text',{x,y,fill:'#737378','font-size':11,'font-family':'Arial, Helvetica, sans-serif',...attrs},text);}
  function notify(message) {$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
  function readShareState() {
    if(!location.hash.startsWith('#view=')) return;
    try {
      const v=JSON.parse(decodeURIComponent(location.hash.slice(6)));
      if(Array.isArray(v.s))state.selected=new Set(v.s.filter(id=>models.some(m=>m.id===id)));
      if(Array.isArray(v.c))state.categories=new Set(v.c.filter(c=>['open','closed','ours'].includes(c)));
      if(Array.isArray(v.g))state.hiddenGroups=new Set(v.g.filter(g=>Object.hasOwn(COLORS,g)));
      if(['log','linear'].includes(v.x))state.scale=v.x;
      if([1,1000].includes(v.u))state.unit=v.u;
      if(['provider','category'].includes(v.b))state.colorBy=v.b;
      if(['all','frontier','none'].includes(v.l))state.labels=v.l;
      if(typeof v.p==='boolean')state.pareto=v.p;
      if(typeof v.q==='boolean')state.quadrant=v.q;
      if(typeof v.t==='boolean')state.table=v.t;
      if(v.a!==undefined && Number.isFinite(Number(v.a)) && Number(v.a)>=0 && Number(v.a)<=100)state.minAccuracy=String(v.a);
      if(v.m!==undefined && Number.isFinite(Number(v.m)) && Number(v.m)>=0)state.maxCost=String(v.m);
    } catch (_) { /* An invalid URL fragment simply opens the default view. */ }
  }
  function shareURL() {
    const v={s:[...state.selected],c:[...state.categories],g:[...state.hiddenGroups],x:state.scale,u:state.unit,b:state.colorBy,l:state.labels,p:state.pareto,q:state.quadrant,t:state.table,a:state.minAccuracy,m:state.maxCost};
    return location.href.split('#')[0]+'#view='+encodeURIComponent(JSON.stringify(v));
  }
  function updateData() {
    visible=models.filter(m=>state.selected.has(m.id)&&state.categories.has(m.category)&&!state.hiddenGroups.has(group(m))&&m.accuracy>=Number(state.minAccuracy||0)&&(state.maxCost===''||(m.cost!==null&&m.cost<=Number(state.maxCost))));
    drawn=visible.filter(m=>m.cost!==null&&m.cost>0);frontier=pareto(drawn);
  }
  function renderLegend() {
    const groups=state.colorBy==='category'?['open','closed','ours']:[...new Set(models.map(m=>m.category==='ours'?'Our models':m.provider))];
    $('legend').innerHTML=groups.map(g=>`<button data-group="${escapeHTML(g)}" aria-pressed="${!state.hiddenGroups.has(g)}" title="Toggle ${escapeHTML(CATEGORY[g]||g)}"><span class="legend-dot ${g==='ours'||g==='Our models'?'ours':''}" style="--color:${COLORS[g]}"></span>${escapeHTML(CATEGORY[g]||g)}</button>`).join('');
  }
  function renderModelList() {
    const search=$('model-search').value.trim().toLowerCase();
    const filtered=models.filter(m=>(m.name+' '+m.provider+' '+CATEGORY[m.category]).toLowerCase().includes(search));
    $('models-list').innerHTML=filtered.map(m=>`<label class="model-option"><input type="checkbox" data-id="${m.id}" ${state.selected.has(m.id)?'checked':''}><span class="option-text">${escapeHTML(m.name)}<small>${escapeHTML(m.provider)} · ${m.cost===null?'Cost unavailable':accuracy(m.accuracy)+' · '+usd(cost(m))}</small></span><span class="legend-dot" style="--color:${color(m)}"></span></label>`).join('') || '<p class="panel-note">No matching models.</p>';
  }
  function syncControls() {
    $('cost-scale').value=state.scale;$('cost-unit').value=String(state.unit);$('color-by').value=state.colorBy;$('point-labels').value=state.labels;
    $('show-pareto').checked=state.pareto;$('show-quadrant').checked=state.quadrant;
    $('min-accuracy').value=state.minAccuracy;$('max-cost').value=state.maxCost;
    for(const el of document.querySelectorAll('input[name=category]')) el.checked=state.categories.has(el.value);
    $('pareto-key').setAttribute('aria-pressed',state.pareto);$('quadrant-key').setAttribute('aria-pressed',state.quadrant);
    $('chart-view').hidden=state.table;$('table-view').hidden=!state.table;
    $('table-toggle').setAttribute('aria-pressed',state.table);$('table-toggle').setAttribute('aria-label',state.table?'Show chart':'Show data table');
    const unit=state.unit===1000?'per 1,000 responses':'per response';
    $('subtitle').textContent='In-domain reasoning accuracy · Estimated output cost '+unit+' (USD)';
    const count=state.table?visible.length:drawn.length, total=state.table?models.length:models.filter(m=>m.cost!==null).length;
    $('model-count').textContent=`${count} of ${total} models`;
    $('table-unit').textContent='Estimated output cost '+unit+' · USD';

  }
  function shortName(m) {
    return m.name.replace(' + Selective KL Anchoring',' + KL (ours)').replace(' + Reward Shaping',' + RS (ours)').replace(' (8K budget)',' (8K)').replace(' (non-reasoning)',' (non-reason.)') + (/^Qwen3-(4|8)B/.test(m.name)?' †':'');
  }
  function renderChart() {
    if(state.table) return;
    const plot=$('plot'),width=Math.max(300,$('plot-wrap').clientWidth),height=parseFloat(getComputedStyle(plot).height)||490;
    dimensions={width,height};plot.replaceChildren();plot.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const mobile=width<600,margin={left:mobile?43:61,right:mobile?13:22,top:30,bottom:65};
    const pw=width-margin.left-margin.right,ph=height-margin.top-margin.bottom;
    const allCosts=drawn.map(m=>cost(m));
    let xmin=state.unit/1000*0.12,xmax=state.unit/1000*300;
    if(allCosts.length) {xmin=Math.min(...allCosts)*0.66;xmax=Math.max(...allCosts)*1.62;}
    if(state.scale==='linear') xmin=0;
    if(xmax<=xmin)xmax=xmin+1;
    const x=value=>margin.left+(state.scale==='log'?(Math.log(value)-Math.log(xmin))/(Math.log(xmax)-Math.log(xmin)):(value-xmin)/(xmax-xmin))*pw;
    const y=value=>margin.top+ph*(1-value/100);
    plot.append(svg('title',{},'Accuracy vs. estimated output cost'));
    plot.append(svg('desc',{},`${drawn.length} configurations. Accuracy is in percent; cost is USD per ${state.unit} response${state.unit===1?'':'s'}. Dotted line is the visible Pareto frontier.`));
    if(state.quadrant&&drawn.length) {
      const xm=x(median(allCosts)),ym=y(median(drawn.map(m=>m.accuracy)));
      plot.append(svg('rect',{x:margin.left,y:margin.top,width:xm-margin.left,height:ym-margin.top,fill:'#e5fae7'}));
      plot.append(svg('rect',{x:xm,y:ym,width:margin.left+pw-xm,height:margin.top+ph-ym,fill:'#fafafa'}));
    }
    // The restrained axis styling intentionally follows the reference chart.
    for(let value=0;value<=100;value+=20) {plot.append(svg('line',{x1:margin.left-4,x2:margin.left,y1:y(value),y2:y(value),stroke:'#a3a3a8','stroke-width':.7}));plot.append(textEl(margin.left-9,y(value)+3,value,{'text-anchor':'end','font-size':mobile?10:11}));}
    const ticks=[];
    if(state.scale==='log') {
      for(let exponent=Math.floor(Math.log10(xmin));exponent<=Math.ceil(Math.log10(xmax));exponent++)for(const mantissa of [1,2,3,5,7]) {const v=mantissa*10**exponent;if(v>=xmin&&v<=xmax)ticks.push(v);}
    } else {
      const raw=xmax/(mobile?4:8),power=10**Math.floor(Math.log10(raw)),r=raw/power,step=(r<=1?1:r<=2?2:r<=5?5:10)*power;
      for(let v=0;v<=xmax;v+=step)ticks.push(v);
    }
    let lastTickRight=-Infinity;
    for(const v of ticks) {const px=x(v),label=usd(v),halfWidth=label.length*(mobile?9:11)*.3;if(px-halfWidth<lastTickRight+12)continue;plot.append(svg('line',{x1:px,x2:px,y1:y(0),y2:y(0)+4,stroke:'#999','stroke-width':.7}));plot.append(textEl(px,y(0)+19,label,{'text-anchor':'middle','font-size':mobile?9:11}));lastTickRight=px+halfWidth;}
    plot.append(textEl(margin.left+pw/2,height-15,`Cost ${state.unit===1000?'per 1,000 responses':'per response'} (USD, ${state.scale==='log'?'Log':'Linear'} Scale)`,{'text-anchor':'middle',fill:'#151515','font-size':mobile?11:12}));
    plot.append(textEl(15,margin.top+ph/2,'Accuracy (%)',{'text-anchor':'middle',fill:'#151515','font-size':mobile?11:12,transform:`rotate(-90 15 ${margin.top+ph/2})`}));
    plot.append(textEl(width-margin.right,margin.top-9,'🔍💎 TokenProbe',{'text-anchor':'end','font-family':'Georgia, Times New Roman, serif','font-size':mobile?12:15,fill:'#96969b'}));
    if(state.pareto&&frontier.length) {
      const unique=frontier.filter((m,i)=>i===0||m.cost!==frontier[i-1].cost);
      const coords=[`${margin.left},${y(unique[0].accuracy)}`,...unique.map(m=>`${x(cost(m))},${y(m.accuracy)}`),`${margin.left+pw},${y(unique[unique.length-1].accuracy)}`];
      plot.append(svg('polyline',{points:coords.join(' '),fill:'none',stroke:'#4d4d51','stroke-width':1.7,'stroke-dasharray':'1 5','stroke-linecap':'round'}));
    }
    positions=drawn.map(m=>({m,x:x(cost(m)),y:y(m.accuracy)}));
    const frontIds=new Set(frontier.map(m=>m.id));
    const labelLayer=svg('g',{'aria-hidden':'true'});plot.append(labelLayer);
    const occupied=[];
    const labels=positions.filter(p=>state.labels==='all'||state.labels==='frontier'&&(frontIds.has(p.m.id)||p.m.category==='ours')).sort((a,b)=>(b.m.category==='ours')-(a.m.category==='ours')||Number(frontIds.has(b.m.id))-Number(frontIds.has(a.m.id))||a.x-b.x);
    const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    const measuring=document.createElement('canvas').getContext('2d');
    const fontSize=mobile?9:11;
    for(const p of labels) {
      const name=shortName(p.m);measuring.font=`${p.m.category==='ours'?'bold ':''}${fontSize}px Arial`;
      const tw=measuring.measureText(name).width,th=fontSize+4;
      const candidates=[];
      for(const dy of [0,-18,18,-36,36,-54,54,-72,72,-90,90,-108,108,-126,126])for(const side of [1,-1]) candidates.push({x:side===1?p.x+9:p.x-9-tw,y:p.y-6+dy,w:tw+3,h:th,side});
      let choice=null;
      for(const candidate of candidates) {
        if(candidate.x<margin.left+2||candidate.x+candidate.w>width-margin.right||candidate.y<margin.top||candidate.y+candidate.h>y(0)-3)continue;
        if(occupied.some(r=>intersects(candidate,r)))continue;
        if(positions.some(q=>q.m.id!==p.m.id&&intersects(candidate,{x:q.x-7,y:q.y-7,w:14,h:14})))continue;
        choice=candidate;break;
      }
      // On narrow screens, prioritize legibility; full model names remain in tooltips/table.
      if(!choice)continue;
      occupied.push({...choice,x:choice.x-2,y:choice.y-2,w:choice.w+4,h:choice.h+4});
      if(Math.abs(choice.y+6-p.y)>15)labelLayer.append(svg('line',{x1:p.x,y1:p.y,x2:choice.side===1?choice.x:choice.x+tw,y2:choice.y+fontSize/2,stroke:'#b9bcc1','stroke-width':.7}));
      labelLayer.append(textEl(choice.x,choice.y+fontSize,name,{'font-size':fontSize,fill:p.m.category==='ours'?'#267b4e':'#48484e','font-weight':p.m.category==='ours'?600:400,'class':'point-label'}));
    }
    for(const p of positions) {
      const g=svg('g',{'class':'plot-point',tabindex:'0',role:'button','data-id':p.m.id,'aria-label':`${p.m.name}, accuracy ${accuracy(p.m.accuracy)}, cost ${usd(cost(p.m))}${frontIds.has(p.m.id)?', Pareto frontier':''}`});
      g.append(svg('title',{},`${p.m.name} · ${accuracy(p.m.accuracy)} · ${usd(cost(p.m))}`));
      if(p.m.category==='ours')g.append(svg('circle',{cx:p.x,cy:p.y,r:10,fill:'#21985b',opacity:.12}));
      g.append(svg('circle',{cx:p.x,cy:p.y,r:13,fill:'none','class':'selection-ring'}));
      g.append(svg('circle',{cx:p.x,cy:p.y,r:mobile?10:9,fill:'transparent','class':'hit-target'}));
      g.append(svg('circle',{cx:p.x,cy:p.y,r:p.m.category==='ours'?6.5:5.6,fill:color(p.m),stroke:'#fff','stroke-width':1,'class':'dot'}));
      g.addEventListener('pointerenter',()=>{if(!pinned)showTooltip(p,false);});
      g.addEventListener('pointerleave',()=>{if(!pinned)hideTooltip();});
      g.addEventListener('focus',()=>{if(!pinned)showTooltip(p,false);});
      g.addEventListener('blur',()=>{if(!pinned)hideTooltip();});
      g.addEventListener('click',event=>{event.stopPropagation();document.dispatchEvent(new CustomEvent('benchmark-model-selected',{detail:{id:p.m.id}}));if(pinned===p.m.id){clearPin();return;}pinPoint(p);});
      g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();g.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
      plot.append(g);
    }
    const active=positions.find(p=>p.m.id===pinned);
    if(active)pinPoint(active);
    $('empty-state').hidden=drawn.length>0;
    $('chart-status').textContent=`${drawn.length} plotted · ${frontier.length} on the Pareto frontier${visible.length>drawn.length?' · '+(visible.length-drawn.length)+' without cost estimates':''}`;
  }
  function showTooltip(p,isPinned) {
    const m=p.m,el=$('tooltip'),isFront=frontier.some(f=>f.id===m.id);
    el.classList.toggle('is-pinned',isPinned);
    el.innerHTML=`${isPinned?'<button class="tooltip-close" aria-label="Unpin model details">×</button>':''}<div class="tooltip-title">${escapeHTML(m.name)}</div><div class="tooltip-sub"><span class="legend-dot" style="--color:${color(m)}"></span>${escapeHTML(m.provider)} · ${CATEGORY[m.category]}</div>${isFront?'<div class="tooltip-badge">↗ Pareto frontier</div>':''}<div class="tooltip-row"><span>Accuracy</span><b>${accuracy(m.accuracy)}</b></div><div class="tooltip-row"><span>Cost / ${state.unit===1000?'1,000 responses':'response'}</span><b>${usd(cost(m))}</b></div><div class="tooltip-row"><span>Mean output tokens</span><b>${m.tokens.toLocaleString('en-US')}</b></div><div class="tooltip-row"><span>Output price / 1M tokens</span><b>${usd(m.output_price)}</b></div>${m.openrouter_id?`<div class="tooltip-price-source"><a href="${escapeHTML(m.price_url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(m.openrouter_id)}</a><br>OpenRouter top-provider rate · ${escapeHTML(m.price_snapshot)}</div>`:""}<div class="tooltip-note">${escapeHTML(m.configuration)}${m.price_type==='serving estimate'?' · Serving-price estimate':''}${m.note?'<br>'+escapeHTML(m.note):''}<br>${isPinned?'Click × or press Escape to unpin.':'Click to pin these details.'}</div>`;
    el.hidden=false;
    const tw=el.offsetWidth,th=el.offsetHeight;
    let left=p.x+15,top=p.y-30;
    if(left+tw>dimensions.width-5)left=p.x-tw-15;
    if(left<5)left=Math.max(5,Math.min(dimensions.width-tw-5,p.x-tw/2));
    top=Math.max(5,Math.min(dimensions.height-th-5,top));
    el.style.left=left+'px';el.style.top=top+'px';
    if(isPinned)el.querySelector('.tooltip-close').onclick=clearPin;
  }
  function hideTooltip() {$('tooltip').hidden=true;}
  function clearPin() {pinned=null;hideTooltip();document.querySelectorAll('.plot-point.pinned').forEach(el=>{el.classList.remove('pinned');el.removeAttribute('aria-pressed');});}
  function pinPoint(p) {
    clearPin();
    const point=$('plot').querySelector(`[data-id="${p.m.id}"]`);
    if(!point)return;
    pinned=p.m.id;point.classList.add('pinned');point.setAttribute('aria-pressed','true');
    // Keep the selected ring visible when configurations share coordinates.
    $('plot').append(point);showTooltip(p,true);
  }
  function selectBenchmarkPoint(id) {
    const model=models.find(m=>m.id===id);
    if(!model || model.cost===null || model.cost<=0)return;
    state.selected.add(id);state.categories.add(model.category);state.hiddenGroups.delete(group(model));
    if(model.accuracy<Number(state.minAccuracy||0))state.minAccuracy='';
    if(state.maxCost!==''&&model.cost>Number(state.maxCost))state.maxCost='';
    state.table=false;closePanels();render();
    const point=positions.find(p=>p.m.id===id);
    if(!point)return;
    pinPoint(point);
    document.dispatchEvent(new CustomEvent('benchmark-model-selected',{detail:{id}}));
    $('plot').querySelector(`[data-id="${id}"]`).focus({preventScroll:true});
    $('plot-wrap').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  }
  function renderTable() {
    const ids=new Set(frontier.map(m=>m.id));
    const sorted=[...visible].sort((a,b)=>{
      const av=a[state.sort],bv=b[state.sort];if(av===null||av===undefined)return bv===null||bv===undefined?0:1;if(bv===null||bv===undefined)return -1;
      return(typeof av==='number'?av-bv:String(av).localeCompare(String(bv)))*state.sortDir;
    });
    $('table-body').innerHTML=sorted.map(m=>`<tr class="${m.category==='ours'?'our-row':''}"><td><span class="table-model"><span class="legend-dot" style="--color:${color(m)}"></span>${escapeHTML(m.name)}${/^Qwen3-(4|8)B/.test(m.name)?' <sup title="See serving-price estimate footnote below">†</sup>':''}</span></td><td>${escapeHTML(m.provider)}</td><td><span class="category-chip">${CATEGORY[m.category]}</span></td><td class="numeric">${Number(m.accuracy.toFixed(2))}</td><td class="numeric">${m.tokens.toLocaleString('en-US')}</td><td class="numeric">${m.cost===null?'—':usd(cost(m))}</td><td>${ids.has(m.id)?'<span class="frontier-chip">Frontier</span>':m.cost===null?'<span title="No reported serving-price estimate">No cost estimate</span>':'—'}</td></tr>`).join('') || '<tr><td colspan="7">No models match these filters.</td></tr>';
    $('table-status').textContent=`${visible.length} model configurations${visible.length>drawn.length?' · '+(visible.length-drawn.length)+' without cost estimates':''}`;
    for(const el of document.querySelectorAll('[data-sort]')) {el.parentElement.setAttribute('aria-sort',state.sort===el.dataset.sort?(state.sortDir===1?'ascending':'descending'):'none');el.querySelector('span').textContent=state.sort===el.dataset.sort?(state.sortDir===1?'↑':'↓'):'↕';}
  }
  function render() {clearPin();updateData();syncControls();renderLegend();renderModelList();renderChart();renderTable();}
  function closePanels() {for(const name of ['models','filters','settings']){$(name+'-panel').hidden=true;$(name+'-button').setAttribute('aria-expanded',false);}}
  function reset() {state=defaults();$('model-search').value='';closePanels();try{history.replaceState(null,'',location.href.split('#')[0]);}catch(_){}render();document.dispatchEvent(new Event('benchmark-selection-cleared'));}
  for(const name of ['models','filters','settings'])$(name+'-button').addEventListener('click',event=>{event.stopPropagation();const wasOpen=!$(name+'-panel').hidden;closePanels();if(!wasOpen){$(name+'-panel').hidden=false;$(name+'-button').setAttribute('aria-expanded',true);if(name==='models')$('model-search').focus();}});
  document.querySelectorAll('.close-panel').forEach(el=>el.addEventListener('click',closePanels));
  document.addEventListener('click',event=>{if(!event.target.closest('.popover')&&!event.target.closest('.control-row'))closePanels();if(!event.target.closest('.tooltip')&&!event.target.closest('.plot-point')&&!event.target.closest('.benchmark-data-row[data-chart-id]'))clearPin();});
  document.addEventListener('benchmark-row-selected',event=>selectBenchmarkPoint(event.detail.id));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const open=document.querySelector('.popover:not([hidden])');if(open){const name=open.id.split('-')[0];closePanels();$(name+'-button').focus();}clearPin();}});
  $('models-list').addEventListener('change',event=>{const id=event.target.dataset.id;if(!id)return;event.target.checked?state.selected.add(id):state.selected.delete(id);render();});
  $('model-search').addEventListener('input',renderModelList);
  $('select-all').onclick=()=>{state.selected=new Set(models.map(m=>m.id));render();};
  $('select-none').onclick=()=>{state.selected.clear();render();};
  $('select-frontier').onclick=()=>{state.selected=new Set(frontier.map(m=>m.id));render();};
  $('legend').addEventListener('click',event=>{const btn=event.target.closest('[data-group]');if(!btn)return;const g=btn.dataset.group;state.hiddenGroups.has(g)?state.hiddenGroups.delete(g):state.hiddenGroups.add(g);render();$('legend').querySelector(`[data-group="${g}"]`).focus({preventScroll:true});});
  document.querySelectorAll('input[name=category]').forEach(el=>el.addEventListener('change',()=>{el.checked?state.categories.add(el.value):state.categories.delete(el.value);render();}));
  $('min-accuracy').addEventListener('input',()=>{state.minAccuracy=$('min-accuracy').value;render();});
  $('max-cost').addEventListener('input',()=>{state.maxCost=$('max-cost').value;render();});
  $('reset-filters').onclick=()=>{state.categories=new Set(['closed','open','ours']);state.minAccuracy='';state.maxCost='';state.hiddenGroups.clear();render();};
  $('cost-scale').onchange=()=>{state.scale=$('cost-scale').value;render();};
  $('cost-unit').onchange=()=>{state.unit=Number($('cost-unit').value);render();};
  $('color-by').onchange=()=>{state.colorBy=$('color-by').value;state.hiddenGroups.clear();render();};
  $('point-labels').onchange=()=>{state.labels=$('point-labels').value;render();};
  $('show-pareto').onchange=()=>{state.pareto=$('show-pareto').checked;render();};
  $('show-quadrant').onchange=()=>{state.quadrant=$('show-quadrant').checked;render();};
  $('pareto-key').onclick=()=>{state.pareto=!state.pareto;render();};
  $('quadrant-key').onclick=()=>{state.quadrant=!state.quadrant;render();};
  $('table-toggle').onclick=()=>{state.table=!state.table;closePanels();render();};
  document.querySelectorAll('[data-sort]').forEach(el=>el.addEventListener('click',()=>{state.sortDir=state.sort===el.dataset.sort?-state.sortDir:1;state.sort=el.dataset.sort;renderTable();}));
  $('copy-link').onclick=async()=>{const url=shareURL();try{await navigator.clipboard.writeText(url);notify('Link copied with current chart settings');}catch(_){const ta=document.createElement('textarea');ta.value=url;ta.style.cssText='position:fixed;opacity:0';document.body.append(ta);ta.select();const copied=document.execCommand('copy');ta.remove();notify(copied?'Link copied with current chart settings':'Copy this page URL from your address bar after uploading.');}};
  $('reset-view').onclick=reset;$('reset-empty').onclick=reset;
  readShareState();render();
  let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{renderChart();},80);}).observe($('plot-wrap'));
  window.addEventListener('hashchange',()=>{state=defaults();readShareState();render();});
})();
