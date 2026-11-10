// Animazioni della scena e del modulo. Nessuna dipendenza esterna.
// Con "riduci movimento" attivo nel sistema, tutto resta fermo.
const Scene = (() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);

  function svgEl(parent, tag, attrs){
    const el = document.createElementNS(NS, tag);
    for(const k in attrs) el.setAttribute(k, attrs[k]);
    parent.appendChild(el);
    return el;
  }

  // Neve fuori dalla finestra (riquadro 138..262 × 38..162 nel disegno).
  function windowSnow(){
    const g = $('snow');
    for(let i = 0; i < 34; i++){
      const r = rnd(.7, 2);
      const c = svgEl(g, 'circle', {
        cx: rnd(140, 260).toFixed(1), cy: reduced ? rnd(40, 150).toFixed(1) : 34,
        r: r.toFixed(1), opacity: rnd(.5, 1).toFixed(2)
      });
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
    if(reduced) return;
    const g = $('embers');
    for(let i = 0; i < 12; i++){
      const c = svgEl(g, 'circle', {cx: rnd(180, 222).toFixed(1), cy: 500, r: rnd(.8, 1.8).toFixed(1)});
      const dur = rnd(1800, 3600), dx = rnd(-34, 34);
      c.animate([
        {transform: 'translate(0,0)', opacity: 0},
        {transform: `translate(${(dx * .3).toFixed(1)}px,-40px)`, opacity: 1, offset: .2},
        {transform: `translate(${dx.toFixed(1)}px,-${rnd(110, 170).toFixed(0)}px)`, opacity: 0}
      ], {duration: dur, delay: -rnd(0, dur), iterations: Infinity, easing: 'ease-out'});
    }
  }

  // Lucine dell'albero: sparse dentro la sagoma (cono con punta a 130 e base a 500).
  function treeLights(){
    const g = $('treeLights');
    const colors = ['#ffe9a8', '#ff7a5c', '#ffd24e', '#9be3a8', '#ffe9a8'];
    for(let i = 0; i < 26; i++){
      const y = 165 + (i / 25) * 325 + rnd(-8, 8);
      const half = (y - 130) * .2 * .85;
      const x = 455 + rnd(-half, half);
      const color = colors[i % colors.length];
      const b = svgEl(g, 'g', {'class': 'tl'});
      svgEl(b, 'circle', {cx: x.toFixed(1), cy: y.toFixed(1), r: 9, fill: color, opacity: .22});
      svgEl(b, 'circle', {cx: x.toFixed(1), cy: y.toFixed(1), r: 2.6, fill: color});
      b.style.animationDelay = (-rnd(0, 2.1)).toFixed(2) + 's';
      b.style.animationDuration = rnd(1.5, 3.2).toFixed(2) + 's';
    }
  }

  // Pulviscolo dorato in primo piano: è lo strato più vicino, quindi quello che si sposta di più.
  function motes(){
    if(reduced) return;
    const g = $('motes');
    for(let i = 0; i < 16; i++){
      const r = rnd(1.2, 4.5);
      const c = svgEl(g, 'circle', {cx: rnd(20, 540).toFixed(0), cy: rnd(60, 540).toFixed(0), r: r.toFixed(1)});
      const dur = rnd(7000, 14000);
      c.animate([
        {transform: 'translate(0,0)', opacity: 0},
        {transform: `translate(${rnd(-20, 20).toFixed(0)}px,-${rnd(20, 50).toFixed(0)}px)`, opacity: rnd(.12, .4)},
        {transform: `translate(${rnd(-40, 40).toFixed(0)}px,-${rnd(60, 110).toFixed(0)}px)`, opacity: 0}
      ], {duration: dur, delay: -rnd(0, dur), iterations: Infinity});
    }
  }

  // Filo di lucine in cima alla pagina, ricostruito sulla larghezza della finestra.
  function topLights(){
    const host = $('lights');
    const colors = ['#e05a47', '#f2c14e', '#4fa36a', '#fff0c9'];
    function build(){
      const w = host.clientWidth, h = 70;
      const n = Math.max(2, Math.round(w / 190)), seg = w / n;
      let d = 'M0 4', bulbs = '', k = 0;
      for(let i = 0; i < n; i++){
        const x0 = i * seg;
        d += ` Q${(x0 + seg / 2).toFixed(1)} 44 ${(x0 + seg).toFixed(1)} 4`;
        [.18, .5, .82].forEach(t => {
          const x = (x0 + seg * t).toFixed(1), y = 4 + 80 * t * (1 - t), col = colors[k % 4];
          bulbs += `<g class="lb t${k % 3 + 1}"><circle cx="${x}" cy="${y + 11}" r="15" fill="${col}" opacity=".2"/>`
            + `<ellipse cx="${x}" cy="${y + 11}" rx="4.6" ry="6.6" fill="${col}"/></g>`
            + `<rect x="${x - 2.5}" y="${y}" width="5" height="5.5" rx="1" fill="#3a2416"/>`;
          k++;
        });
      }
      host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`
        + `<path d="${d}" fill="none" stroke="#3a2416" stroke-width="2"/>${bulbs}</svg>`;
    }
    build();
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 150); });
  }

  // Effetto 3D: la scena si inclina seguendo il mouse; senza mouse (telefono) ondeggia da sola.
  function parallax(){
    if(reduced) return;
    const layers = $('layers'), art = $('sceneArt');
    let tx = 0, ty = 0, cx = 0, cy = 0, lastPointer = -1e9, visible = true, running = false;
    window.addEventListener('pointermove', e => {
      if(e.pointerType !== 'mouse') return;
      tx = (e.clientX / window.innerWidth - .5) * 2;
      ty = (e.clientY / window.innerHeight - .5) * 2;
      lastPointer = performance.now();
    }, {passive: true});
    function frame(now){
      if(!visible || document.hidden){ running = false; return; }
      let gx = tx, gy = ty;
      if(now - lastPointer > 4000){
        gx = Math.sin(now / 2300) * .75;
        gy = Math.cos(now / 3100) * .5;
      }
      cx += (gx - cx) * .06;
      cy += (gy - cy) * .06;
      layers.style.transform = `rotateY(${(cx * 9).toFixed(2)}deg) rotateX(${(-cy * 5).toFixed(2)}deg)`;
      requestAnimationFrame(frame);
    }
    function start(){ if(!running){ running = true; requestAnimationFrame(frame); } }
    new IntersectionObserver(en => { visible = en[0].isIntersecting; if(visible) start(); }).observe(art);
    document.addEventListener('visibilitychange', start);
    start();
  }

  // Neve su canvas a tre profondità (apertura). Restituisce la funzione per fermarla.
  function snowCanvas(canvas){
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w, h, alive = true;
    function size(){ w = canvas.width = canvas.clientWidth * dpr; h = canvas.height = canvas.clientHeight * dpr; }
    size();
    const flakes = Array.from({length: 150}, () => {
      const z = Math.random();                       // 0 lontano, 1 vicino
      return {x: Math.random(), y: Math.random(), z, ph: rnd(0, 6.28)};
    });
    let last = performance.now();
    (function frame(now){
      if(!alive) return;
      const dt = Math.min(50, now - last) / 1000; last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      for(const f of flakes){
        f.y += dt * (.05 + f.z * .22);
        f.ph += dt * (.6 + f.z);
        if(f.y > 1.03){ f.y = -.03; f.x = Math.random(); }
        const r = (.7 + f.z * f.z * 3.4) * dpr;
        ctx.globalAlpha = .35 + f.z * .6;
        ctx.beginPath();
        ctx.arc((f.x + Math.sin(f.ph) * .012 * (1 + f.z)) * w, f.y * h, r, 0, 6.283);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    })(last);
    return () => { alive = false; };
  }

  // Apertura, una volta per visita: la casa nella neve, poi si entra dalla finestra accesa.
  function intro(){
    const KEY = 'cenaNataleIntro';
    let seen = false;
    try{ seen = !!sessionStorage.getItem(KEY); sessionStorage.setItem(KEY, '1'); }catch(e){}
    if(reduced || seen) return;
    const el = $('intro'), zoom = $('introZoom');
    el.hidden = false;
    const stopSnow = snowCanvas($('introSnow'));
    const page = document.querySelector('.page');
    let finished = false;
    function finish(fast){
      if(finished) return;
      finished = true;
      const fade = el.animate([{opacity: 1}, {opacity: 0}], {duration: fast ? 250 : 550, fill: 'forwards'});
      page.animate(
        [{opacity: 0, transform: 'scale(1.12)'}, {opacity: 1, transform: 'none'}],
        {duration: fast ? 300 : 900, easing: 'cubic-bezier(.2,.7,.2,1)'});
      fade.finished.then(() => { stopSnow(); el.remove(); });
    }
    zoom.animate(
      [{opacity: 0, transform: 'translateY(14px)'}, {opacity: 1, transform: 'none'}],
      {duration: 700, easing: 'ease-out'});
    const timer = setTimeout(() => {
      // Lo zoom punta al centro della finestra accesa, fino a riempire lo schermo di luce.
      const zr = zoom.getBoundingClientRect(), wr = $('introWindow').getBoundingClientRect();
      zoom.style.transformOrigin = (wr.left + wr.width / 2 - zr.left) + 'px ' + (wr.top + wr.height / 2 - zr.top) + 'px';
      zoom.animate(
        [{transform: 'scale(1)'}, {transform: 'scale(34)'}],
        {duration: 1500, easing: 'cubic-bezier(.75,0,.9,.45)', fill: 'forwards'});
      setTimeout(() => finish(false), 1150);
    }, 2100);
    el.addEventListener('click', () => { clearTimeout(timer); finish(true); });
  }

  // Passaggio da un passo del modulo al successivo: il foglio gira come una pagina.
  async function stepSwap(oldEl, newEl, direction, commit){
    if(reduced || !oldEl.animate){ commit(); return; }
    const origin = direction > 0 ? '0 50%' : '100% 50%';
    oldEl.style.transformOrigin = newEl.style.transformOrigin = origin;
    await oldEl.animate(
      [{opacity: 1, transform: 'rotateY(0deg)'}, {opacity: 0, transform: `rotateY(${-direction * 70}deg)`}],
      {duration: 230, easing: 'ease-in'}).finished;
    commit();
    newEl.animate(
      [{opacity: 0, transform: `rotateY(${direction * 70}deg)`}, {opacity: 1, transform: 'rotateY(0deg)'}],
      {duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)'});
  }

  function reveal(el, open){
    el.classList.toggle('open', open);
    el.inert = !open;
  }

  // Pioggia di coriandoli e stelline dal centro dello schermo.
  function burst(canvas){
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width = canvas.clientWidth * dpr, h = canvas.height = canvas.clientHeight * dpr;
    const colors = ['#f2c14e', '#fff0c9', '#e05a47', '#4fa36a', '#ffd98c'];
    const parts = Array.from({length: 110}, () => {
      const a = rnd(0, 6.283), v = rnd(180, 760) * dpr;
      return {x: w / 2, y: h * .46, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 260 * dpr,
              s: rnd(3, 8) * dpr, rot: rnd(0, 6), vr: rnd(-9, 9), c: colors[(Math.random() * 5) | 0], round: Math.random() < .4};
    });
    const t0 = performance.now(); let last = t0;
    (function frame(now){
      const dt = Math.min(40, now - last) / 1000, age = (now - t0) / 1000; last = now;
      ctx.clearRect(0, 0, w, h);
      if(age > 2.4) return;
      for(const p of parts){
        p.vy += 900 * dpr * dt; p.vx *= .985; p.vy *= .985;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        ctx.globalAlpha = Math.max(0, 1 - age / 2.4);
        ctx.fillStyle = p.c;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if(p.round){ ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 6.283); ctx.fill(); }
        else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * Math.abs(Math.cos(p.rot * 1.7)) + 1);
        ctx.restore();
      }
      requestAnimationFrame(frame);
    })(t0);
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
    burst(els.canvas);
    els.caption.textContent = captions[2];
    await sleep(1600);
    await els.screen.animate([{opacity: 1}, {opacity: 0}], {duration: 300}).finished;
    els.screen.hidden = true;
    done();
  }

  // Dopo l'invio la stella dell'albero si accende.
  function starFlash(){
    if(reduced) return;
    const star = document.querySelector('.star');
    star.classList.add('flash');
    setTimeout(() => star.classList.remove('flash'), 1300);
  }

  function popIn(el){
    if(reduced || !el.animate) return;
    el.animate(
      [{transform: 'rotate(-6deg) scale(2.2)', opacity: 0}, {transform: 'rotate(-6deg) scale(1)', opacity: 1}],
      {duration: 320, easing: 'cubic-bezier(.5,0,.6,1.4)'});
  }

  windowSnow();
  embers();
  treeLights();
  motes();
  topLights();
  parallax();
  intro();
  return {stepSwap, reveal, finale, popIn, starFlash, reduced};
})();
