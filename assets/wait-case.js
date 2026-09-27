/* Original token colors and truthful, source-backed NormLP inspection. */
(() => {
  'use strict';
  const data = window.WAIT_CASE_DATA;
  if (!data) return;
  const root = document.getElementById('wait-token-case');
  if (!root) return;
  const tokens = data.tokens, byId = new Map(tokens.map(token => [token.id, token]));
  const waits = tokens.filter(token => token.is_wait);
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => value === null ? 'Unavailable in source' : (value >= 0 ? '+' : '−') + Math.abs(value).toFixed(6);
  let part = 1, selected = null;
  function color(token) {
    if (!token.color) return '';
    const mix = token.intensity_percent/100, faded = Math.round(255*(1-mix));
    return token.color === 'green' ? `rgb(${faded},255,${faded})` : `rgb(255,${faded},${faded})`;
  }
  for (const p of [1,2,3]) {
    const panel = $('wait-panel-'+p);
    panel.innerHTML = data.lines.filter(line=>line.part===p).map(line => {
      let words = '', open = false;
      for(const id of line.tokens) {
        const token = byId.get(id);
        if(!open || token.space_before) {if(open)words+='</span> ';words+='<span class="token-word">';open=true;}
        const desc = `NormLP ${norm(token.normlp)}`;
        words += `<button type="button" id="${id}" data-token-id="${id}" class="trace-token${token.is_wait?' wait-token':''}" tabindex="-1" aria-label="${escape(desc)}"${token.color?` style="background-color:${color(token)}"`:''}>${escape(token.text)}</button>`;
      }
      if(open)words+='</span>';
      return `<div class="wait-source-line" id="wait-line-${line.number}"><span class="wait-line-number">${line.number}</span><div class="wait-line-text">${line.heading?'<strong class="trace-response-label">'+escape(line.heading)+'</strong> ':''}${words}</div></div>`;
    }).join('');
    panel.querySelector('.trace-token')?.setAttribute('tabindex','0');
  }
  $('wait-jump').innerHTML = '<option value="">Jump to a Wait occurrence</option>'+waits.map(token=>`<option value="${token.id}">NormLP ${norm(token.normlp)}</option>`).join('');
  function setPart(next) {
    part = Number(next);
    for(const p of [1,2,3]) {
      $('wait-panel-'+p).hidden = p !== part;
      const tab = root.querySelector(`[data-wait-part="${p}"]`);
      tab.setAttribute('aria-selected',p===part?'true':'false');
      tab.tabIndex=p===part?0:-1;
    }
    $('wait-color-tooltip').hidden=true;
  }
  function details(token) {
    return `<div class="wait-value"><span>NormLP</span><strong>${norm(token.normlp)}</strong></div>`;
  }
  function select(token, reveal=false) {
    if(selected){$(selected.id).classList.remove('is-selected');$(selected.id).removeAttribute('aria-pressed');}
    selected=token;
    setPart(token.part);
    const button=$(token.id),panel=$('wait-panel-'+token.part);
    panel.querySelectorAll('.trace-token[tabindex="0"]').forEach(node=>node.tabIndex=-1);
    button.tabIndex=0;button.classList.add('is-selected');button.setAttribute('aria-pressed','true');
    $('wait-token-detail').innerHTML=details(token);
    $('wait-jump').value=token.is_wait?token.id:'';
    if(reveal) {
      const row=button.closest('.wait-source-line'),rect=row.getBoundingClientRect(),bounds=panel.getBoundingClientRect();
      panel.scrollTop += rect.top-bounds.top-panel.clientHeight/2+Math.min(rect.height,panel.clientHeight)/2;
      $('wait-token-detail').scrollIntoView({block:'nearest',behavior:'auto'});
    }
  }
  root.addEventListener('click',event=>{
    const token=event.target.closest('[data-token-id]');
    if(token)select(byId.get(token.dataset.tokenId));
    const tab=event.target.closest('[data-wait-part]');
    if(tab)setPart(tab.dataset.waitPart);
  });
  root.addEventListener('keydown',event=>{
    const token=event.target.closest('[data-token-id]'),tab=event.target.closest('[data-wait-part]');
    if(token && ['ArrowRight','ArrowLeft'].includes(event.key)) {
      event.preventDefault();const index=byId.get(token.dataset.tokenId).display_index-1;
      const target=tokens[Math.max(0,Math.min(tokens.length-1,index+(event.key==='ArrowRight'?1:-1)))];
      select(target,true);$(target.id).focus({preventScroll:true});
    }
    if(tab&&['ArrowRight','ArrowLeft'].includes(event.key)) {
      event.preventDefault();setPart((part-1+(event.key==='ArrowRight'?1:2))%3+1);
      root.querySelector(`[data-wait-part="${part}"]`).focus();
    }
    if(event.key==='Escape')$('wait-color-tooltip').hidden=true;
  });
  function tooltip(token,node) {
    const tip=$('wait-color-tooltip'),box=node.getBoundingClientRect();
    tip.innerHTML=`<span>NormLP: ${norm(token.normlp)}</span>`;
    tip.hidden=false;
    tip.style.left=Math.max(8,Math.min(innerWidth-tip.offsetWidth-8,box.left))+'px';
    tip.style.top=Math.max(55,Math.min(innerHeight-tip.offsetHeight-8,box.bottom+7))+'px';
  }
  root.addEventListener('pointerover',event=>{const node=event.target.closest('[data-token-id]');if(node)tooltip(byId.get(node.dataset.tokenId),node);});
  root.addEventListener('pointerout',event=>{if(event.target.closest('[data-token-id]'))$('wait-color-tooltip').hidden=true;});
  root.addEventListener('focusin',event=>{const node=event.target.closest('[data-token-id]');if(node)tooltip(byId.get(node.dataset.tokenId),node);});
  root.addEventListener('focusout',()=>{$('wait-color-tooltip').hidden=true;});
  root.querySelectorAll('.wait-trace-panel').forEach(panel=>panel.addEventListener('scroll',()=>{$('wait-color-tooltip').hidden=true;}));
  addEventListener('scroll',()=>{$('wait-color-tooltip').hidden=true;},{passive:true});
  $('wait-jump').addEventListener('change',event=>{if(event.target.value)select(byId.get(event.target.value),true);});
  for(const [id,step] of [['wait-previous',-1],['wait-next',1]]) $(id).addEventListener('click',()=>{
    const target=step===1
      ? waits.find(token=>!selected||token.display_index>selected.display_index)||waits[0]
      : [...waits].reverse().find(token=>!selected||token.display_index<selected.display_index)||waits[waits.length-1];
    select(target,true);
  });
  document.querySelectorAll('#wait-analysis a[href^="#wait-panel-"]').forEach(link=>link.addEventListener('click',()=>setPart(Number(link.getAttribute('href').slice(-1)))));
  document.querySelectorAll('[data-wait-raw-index]').forEach(button=>button.addEventListener('click',()=>select(tokens.find(token=>token.raw_index===Number(button.dataset.waitRawIndex)),true)));
  setPart(1);
})();
