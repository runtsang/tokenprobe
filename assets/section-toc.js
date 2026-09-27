(() => {
  'use strict';
  const toc = document.querySelector('.floating-toc');
  if (!toc) return;
  const toggle = document.getElementById('toc-toggle');
  const current = document.getElementById('toc-current');
  const entries = [...toc.querySelectorAll('nav a')].map(link => ({
    link, target: document.getElementById(link.hash.slice(1))
  })).filter(entry => entry.target);
  const compact = matchMedia('(max-width:1099px)');
  function setOpen(open) {
    toc.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', `${open ? 'Close' : 'Open'} chapter navigation`);
  }
  toggle.addEventListener('click', () => setOpen(!toc.classList.contains('is-open')));
  toc.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setOpen(false); toggle.focus(); }
  });
  for (const {link} of entries) link.addEventListener('click', () => {
    if (compact.matches) setOpen(false);
  });
  let active = null;
  function update() {
    const threshold = Math.min(160, innerHeight * .25);
    let selected = entries[0];
    for (const entry of entries) {
      if (entry.target.getBoundingClientRect().top <= threshold) selected = entry;
    }
    if (!selected || active === selected) return;
    active = selected;
    current.textContent = selected.link.dataset.sectionLabel;
    current.title = current.textContent;
    for (const entry of entries) {
      if (entry === selected) entry.link.setAttribute('aria-current', 'location');
      else entry.link.removeAttribute('aria-current');
    }
    for (const link of document.querySelectorAll('.section-nav a')) {
      if (link.hash === selected.link.hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  let pending = false;
  function scheduleUpdate() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(); });
  }
  addEventListener('scroll', scheduleUpdate, {passive:true});
  addEventListener('resize', scheduleUpdate);
  addEventListener('load', scheduleUpdate);
  addEventListener('hashchange', scheduleUpdate);
  update();
})();
