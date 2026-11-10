// Animazioni della scena e del modulo. Nessuna dipendenza esterna.
// Con "riduci movimento" attivo nel sistema, tutto resta fermo.
const Scene = (() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Neve fuori dalla finestra (riquadro 138..262 × 38..162 nel disegno).
  function snow(){
    const g = document.getElementById('snow');
    if(!g) return;
    for(let i = 0; i < 34; i++){
      const c = document.createElementNS(NS, 'circle');
      const x = rnd(140, 260), r = rnd(.7, 2);
      c.setAttribute('cx', x.toFixed(1));
      c.setAttribute('cy', reduced ? rnd(40, 150).toFixed(1) : '34');
      c.setAttribute('r', r.toFixed(1));
      c.setAttribute('opacity', rnd(.5, 1).toFixed(2));
      g.appendChild(c);
      if(reduced) continue;
      const dur = rnd(5200, 11000) / (r / 1.3 + .4);   // i fiocchi grandi (vicini) cadono più in fretta
      const drift = rnd(-14, 14);
      c.animate([
        {transform: 'translate(0,0)'},
        {transform: `translate(${(drift * .6).toFixed(1)}px,66px)`},
        {transform: `translate(${drift.toFixed(1)}px,132px)`}
      ], {duration: dur, delay: -rnd(0, dur), iterations: Infinity});
    }
  }

  // Scintille che salgono dal fuoco.
  function embers(){
    const g = document.getElementById('embers');
    if(!g || reduced) return;
    for(let i = 0; i < 12; i++){
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', rnd(180, 222).toFixed(1));
      c.setAttribute('cy', '500');
      c.setAttribute('r', rnd(.8, 1.8).toFixed(1));
      g.appendChild(c);
      const dur = rnd(1800, 3600), dx = rnd(-34, 34);
      c.animate([
        {transform: 'translate(0,0)', opacity: 0},
        {transform: `translate(${(dx * .3).toFixed(1)}px,-40px)`, opacity: 1, offset: .2},
        {transform: `translate(${dx.toFixed(1)}px,-${rnd(110, 170).toFixed(0)}px)`, opacity: 0}
      ], {duration: dur, delay: -rnd(0, dur), iterations: Infinity, easing: 'ease-out'});
    }
  }

  // Passaggio da un passo del modulo al successivo.
  async function stepSwap(oldEl, newEl, direction, commit){
    if(reduced || !oldEl.animate){ commit(); return; }
    await oldEl.animate(
      [{opacity: 1, transform: 'none'}, {opacity: 0, transform: `translateX(${-direction * 18}px)`}],
      {duration: 170, easing: 'ease-in'}).finished;
    commit();
    newEl.animate(
      [{opacity: 0, transform: `translateX(${direction * 18}px)`}, {opacity: 1, transform: 'none'}],
      {duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)'});
  }

  function reveal(el, open){
    el.classList.toggle('open', open);
    el.inert = !open;
  }

  // Finale: il biglietto entra nella busta, la busta si chiude, cala la ceralacca.
  async function finale(els, captions, done){
    if(reduced){ done(); return; }
    els.caption.textContent = captions[0];
    els.envelope.className = 'envelope';
    els.screen.hidden = false;
    els.screen.animate([{opacity: 0}, {opacity: 1}], {duration: 250});
    await sleep(350);
    els.envelope.classList.add('tucked');
    await sleep(750);
    els.envelope.classList.add('closed');
    els.caption.textContent = captions[1];
    await sleep(700);
    els.envelope.classList.add('sealed');
    await sleep(380);
    els.envelope.animate(
      [{transform: 'none'}, {transform: 'translateY(4px) scale(.985)'}, {transform: 'none'}],
      {duration: 220});
    els.caption.textContent = captions[2];
    await sleep(1300);
    await els.screen.animate([{opacity: 1}, {opacity: 0}], {duration: 300}).finished;
    els.screen.hidden = true;
    done();
  }

  function popIn(el){
    if(reduced || !el.animate) return;
    el.animate(
      [{transform: 'rotate(-6deg) scale(2.2)', opacity: 0}, {transform: 'rotate(-6deg) scale(1)', opacity: 1}],
      {duration: 320, easing: 'cubic-bezier(.5,0,.6,1.4)'});
  }

  snow();
  embers();
  return {stepSwap, reveal, finale, popIn, reduced};
})();
