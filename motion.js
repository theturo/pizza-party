// ============================================================
// Animazioni del sito (Web Animations API, nessuna libreria).
// Tutte le funzioni rispettano prefers-reduced-motion: con il movimento
// ridotto attivo portano subito allo stato finale.
// ============================================================
const Motion = (() => {
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => RM.matches;
  const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
  const rand = (a, b) => a + Math.random() * (b - a);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // Easing a molla: simula una molla smorzata e la campiona in un easing linear().
  // Fallback su una cubic-bezier con overshoot dove linear() non è supportato.
  function springEasing({stiffness = 180, damping = 12, mass = 1} = {}){
    if(!CSS.supports('animation-timing-function', 'linear(0, 1)')){
      return {easing: 'cubic-bezier(.34,1.4,.64,1)', duration: 520};
    }
    const dt = 1 / 120; let x = 0, v = 0, t = 0; const pts = [];
    while(t < 3){
      const a = (-stiffness * (x - 1) - damping * v) / mass;
      v += a * dt; x += v * dt; t += dt; pts.push(x);
      if(t > .3 && Math.abs(x - 1) < .001 && Math.abs(v) < .01) break;
    }
    const step = Math.max(1, Math.floor(pts.length / 60));
    const s = [0]; for(let i = step; i < pts.length; i += step) s.push(+pts[i].toFixed(4)); s.push(1);
    return {easing: 'linear(' + s.join(',') + ')', duration: Math.round(t * 1000)};
  }

  function sizeCanvas(canvas){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------------------------------------------------------------------------
  // Fiamma della hero: rumore smussato su ogni lingua + braci su canvas.
  // Il ciclo si ferma quando la hero non è visibile o la scheda è in background.
  // ---------------------------------------------------------------------------
  function flame(hero){
    const paths = Array.from(hero.querySelectorAll('.flame path'));
    const canvas = hero.querySelector('.embers');
    if(!paths.length || !canvas) return;
    const ctx = canvas.getContext('2d');
    const st = paths.map((_, i) => ({sx: 1, sy: 1, r: 0, tsx: 1, tsy: 1, tr: 0, next: 0, amp: 1 - i * .18}));
    const embers = [];
    let raf = 0, last = 0, running = false, visible = true;

    function tick(now){
      const dt = Math.min(50, now - (last || now)); last = now;
      const k = 1 - Math.pow(.0015, dt / 1000);   // smussamento indipendente dal frame-rate
      st.forEach((s, i) => {
        if(now > s.next){
          s.tsy = 1 + rand(-.07, .1) * s.amp;
          s.tsx = 1 + rand(-.05, .05) * s.amp;
          s.tr = rand(-2, 2) * s.amp;
          s.next = now + rand(90, 320);
        }
        s.sx += (s.tsx - s.sx) * k; s.sy += (s.tsy - s.sy) * k; s.r += (s.tr - s.r) * k;
        paths[i].style.transform = `rotate(${s.r.toFixed(2)}deg) scale(${s.sx.toFixed(3)},${s.sy.toFixed(3)})`;
      });

      const w = canvas.clientWidth, h = canvas.clientHeight;
      if(embers.length < 22 && Math.random() < dt / 110){
        embers.push({x: w / 2 + rand(-45, 45), y: h + 4, vy: rand(-34, -64), vx: rand(-8, 8),
                     life: 0, max: rand(1.8, 3.4), r: rand(.8, 2), ph: rand(0, 6.28)});
      }
      ctx.clearRect(0, 0, w, h);
      for(let i = embers.length - 1; i >= 0; i--){
        const e = embers[i], s = dt / 1000;
        e.life += s; e.y += e.vy * s; e.x += (e.vx + Math.sin(e.life * 3 + e.ph) * 14) * s;
        const p = e.life / e.max;
        if(p >= 1){ embers.splice(i, 1); continue; }
        const alpha = p < .15 ? p / .15 : 1 - (p - .15) / .85;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,${Math.round(177 - p * 80)},92,${(alpha * .75).toFixed(3)})`;
        ctx.shadowColor = 'rgba(255,138,77,.8)'; ctx.shadowBlur = 6;
        ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }

    function sync(){
      const should = visible && !document.hidden && !reduced();
      if(should && !running){ running = true; last = 0; raf = requestAnimationFrame(tick); }
      if(!should && running){ running = false; cancelAnimationFrame(raf); }
    }
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }).observe(hero);
    document.addEventListener('visibilitychange', sync);
    RM.addEventListener('change', sync);
    window.addEventListener('resize', () => sizeCanvas(canvas));
    sizeCanvas(canvas); sync();
  }

  // ---------------------------------------------------------------------------
  // Blocco che si apre/chiude animando l'altezza reale del contenuto.
  // Da chiuso è inert: i campi non sono raggiungibili con Tab né dallo screen reader.
  // ---------------------------------------------------------------------------
  function reveal(el, open, animate = true){
    el.getAnimations().forEach(a => a.cancel());
    const from = el.offsetHeight;
    el.classList.toggle('open', open);
    el.inert = !open;
    if(!animate || reduced()) return;
    const to = open ? el.scrollHeight : 0;
    if(from === to) return;
    el.animate([{height: from + 'px', opacity: open ? .2 : 1}, {height: to + 'px', opacity: open ? 1 : 0}],
               {duration: 240 + Math.abs(to - from) * .8, easing: EASE_OUT});
  }

  // ---------------------------------------------------------------------------
  // Numero che conta fino al nuovo valore, con un piccolo rimbalzo finale.
  // ---------------------------------------------------------------------------
  const counters = new WeakMap();
  function countTo(el, from, to, format){
    cancelAnimationFrame(counters.get(el) || 0);
    if(reduced() || from === to){ el.textContent = format(to); return; }
    const t0 = performance.now(), dur = 420;
    function frame(now){
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = format(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if(p < 1){ counters.set(el, requestAnimationFrame(frame)); return; }
      el.animate([{transform: 'scale(1)'}, {transform: 'scale(1.2)'}, {transform: 'scale(1)'}],
                 {duration: 360, easing: 'cubic-bezier(.34,1.56,.64,1)'});
    }
    counters.set(el, requestAnimationFrame(frame));
  }

  // ---------------------------------------------------------------------------
  // Cambio scena: uscita → scambio → ingresso, con l'altezza del contenitore
  // che si adatta alla nuova scena. swap() fa lo scambio vero (classi, focus...).
  // ---------------------------------------------------------------------------
  async function sceneSwap(container, oldEl, newEl, dir, swap){
    if(reduced()){ swap(); return; }
    const h0 = container.offsetHeight;
    await oldEl.animate(
      [{opacity: 1, transform: 'translateX(0)'}, {opacity: 0, transform: `translateX(${-28 * dir}px)`}],
      {duration: 180, easing: 'ease-in', fill: 'forwards'}).finished;
    swap();
    oldEl.getAnimations().forEach(a => a.cancel());
    const h1 = container.offsetHeight;
    container.classList.add('is-animating');
    const anims = [
      container.animate([{height: h0 + 'px'}, {height: h1 + 'px'}], {duration: 300, easing: EASE_OUT}),
      newEl.animate([{opacity: 0, transform: `translateX(${28 * dir}px)`}, {opacity: 1, transform: 'translateX(0)'}],
                    {duration: 300, easing: EASE_OUT})
    ];
    Array.from(newEl.children).forEach((c, k) => c.animate(
      [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}],
      {duration: 260, delay: 60 + k * 40, easing: EASE_OUT, fill: 'backwards'}));
    await Promise.all(anims.map(a => a.finished));
    container.classList.remove('is-animating');
  }

  // Fotogramma della pellicola che si "impressiona" da sinistra a destra.
  function reelAdvance(frame, dir){
    if(reduced() || !frame) return;
    const fill = frame.querySelector('.fill');
    if(fill) fill.animate([{transform: `scaleX(${dir > 0 ? 0 : 1})`}, {transform: 'scaleX(1)'}],
                          {duration: 380, easing: EASE_OUT});
    frame.animate([{transform: 'translateY(0)'}, {transform: 'translateY(-3px)'}, {transform: 'translateY(0)'}],
                  {duration: 320, easing: 'ease-out'});
  }

  // ---------------------------------------------------------------------------
  // Sequenza finale: pizza che si compone → fette portate via con briciole →
  // timbro con impatto. Saltabile con il pulsante "Salta".
  // ---------------------------------------------------------------------------
  const SVGNS = 'http://www.w3.org/2000/svg';
  let pizzaBuilt = null;

  function buildPizza(svg){
    if(pizzaBuilt) return pizzaBuilt;
    const defs = svg.querySelector('defs'), group = svg.querySelector('.slices');
    const R = 92, N = 8, slices = [];
    for(let i = 0; i < N; i++){
      const a0 = -Math.PI / 2 + i * 2 * Math.PI / N, a1 = a0 + 2 * Math.PI / N;
      const pt = a => (100 + R * Math.cos(a)).toFixed(2) + ',' + (100 + R * Math.sin(a)).toFixed(2);
      const d = `M100,100 L${pt(a0)} A${R},${R} 0 0,1 ${pt(a1)} Z`;
      const cp = document.createElementNS(SVGNS, 'clipPath'); cp.id = 'slice-clip-' + i;
      const cpp = document.createElementNS(SVGNS, 'path'); cpp.setAttribute('d', d); cp.appendChild(cpp); defs.appendChild(cp);
      const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'slice');
      const inner = document.createElementNS(SVGNS, 'g'); inner.setAttribute('clip-path', `url(#slice-clip-${i})`);
      const use = document.createElementNS(SVGNS, 'use'); use.setAttribute('href', '#pizzaArt'); inner.appendChild(use);
      const edge = document.createElementNS(SVGNS, 'path');
      edge.setAttribute('d', d); edge.setAttribute('fill', 'none');
      edge.setAttribute('stroke', 'rgba(0,0,0,.26)'); edge.setAttribute('stroke-width', '1.5');
      g.append(inner, edge); group.appendChild(g);
      const mid = (a0 + a1) / 2;
      slices.push({el: g, dx: Math.cos(mid), dy: Math.sin(mid)});
    }
    pizzaBuilt = slices;
    return slices;
  }

  function crumbSystem(canvas){
    const ctx = canvas.getContext('2d');
    let crumbs = [], raf = 0, last = 0;
    function step(now){
      const dt = Math.min(.04, (now - (last || now)) / 1000); last = now;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      let moving = false;
      crumbs.forEach(c => {
        if(!c.rest){
          c.vy += 620 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vx * dt * .05;
          if(c.y > c.floor){ c.y = c.floor; c.vy *= -.35; c.vx *= .6; if(Math.abs(c.vy) < 30){ c.vy = 0; c.rest = true; } }
          moving = true;
        }
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.fillStyle = c.c;
        ctx.beginPath(); ctx.ellipse(0, 0, c.r * 1.2, c.r, 0, 0, 6.283); ctx.fill(); ctx.restore();
      });
      raf = moving ? requestAnimationFrame(step) : 0;
    }
    return {
      spawn(sl){
        const cw = canvas.clientWidth, ch = canvas.clientHeight, pad = 40;
        const scale = (cw - pad * 2) / 200, cx = cw / 2, cy = ch / 2;
        for(let k = 0; k < 7; k++){
          crumbs.push({x: cx + sl.dx * 60 * scale + rand(-10, 10), y: cy + sl.dy * 60 * scale + rand(-10, 10),
                       vx: sl.dx * rand(20, 80) + rand(-30, 30), vy: rand(-160, -60), r: rand(1.6, 3.6),
                       rot: rand(0, 6), floor: cy + 100 * scale + rand(0, 26),
                       c: Math.random() < .7 ? '#a8781f' : '#e6b45a', rest: false});
        }
        if(!raf){ last = 0; raf = requestAnimationFrame(step); }
      },
      clear(){ crumbs = []; cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
    };
  }

  // els: {bake, wheel, crumbs, caption, skip, success, stage, stamp, ink, reveal: [..]}
  // texts: {intro, outro}
  async function finale(els, texts){
    const showSuccess = () => {
      els.bake.classList.remove('show');
      els.success.classList.add('show');
    };
    if(reduced()){ showSuccess(); return; }

    const slices = buildPizza(els.wheel);
    els.bake.classList.add('show');
    sizeCanvas(els.crumbs);          // solo ora il canvas ha una dimensione reale
    const crumbs = crumbSystem(els.crumbs);
    let running = [], skipped = false, skipResolve;
    const skipPromise = new Promise(r => { skipResolve = r; });
    const track = a => { running.push(a); if(skipped) a.finish(); return a; };
    const all = arr => Promise.all(arr.map(a => a.finished));
    const pause = ms => skipped ? Promise.resolve() : Promise.race([wait(ms), skipPromise]);

    function skip(){
      if(skipped) return;
      skipped = true; skipResolve();
      running.forEach(a => { try{ a.finish(); }catch(e){} });
      crumbs.clear();
    }
    els.skip.hidden = false;
    els.skip.addEventListener('click', skip, {once: true});

    els.caption.textContent = texts.intro;
    const spring = springEasing({stiffness: 220, damping: 14});
    const order = [0, 3, 6, 1, 4, 7, 2, 5];

    // 1) la pizza si compone
    await all(order.map((idx, k) => {
      const s = slices[idx];
      return track(s.el.animate([
        {opacity: 0, transform: `translate(${s.dx * 40}px, ${s.dy * 40 - 60}px) scale(.3) rotate(${s.dx * -30}deg)`},
        {opacity: 1, offset: .35},
        {opacity: 1, transform: 'translate(0,0) scale(1) rotate(0deg)'}
      ], {duration: spring.duration, easing: spring.easing, delay: k * 90, fill: 'forwards'}));
    }));
    await pause(450);

    // 2) fetta dopo fetta, con briciole
    els.caption.textContent = texts.outro;
    for(const idx of order){
      if(skipped) break;
      const s = slices[idx];
      crumbs.spawn(s);
      track(s.el.animate([
        {opacity: 1, transform: 'translate(0,0) scale(1) rotate(0deg)'},
        {opacity: 1, transform: `translate(${s.dx * 14}px, ${s.dy * 14}px) scale(1.04) rotate(${s.dx * 6}deg)`, offset: .25},
        {opacity: 0, transform: `translate(${s.dx * 90}px, ${s.dy * 60 - 110}px) scale(.35) rotate(${s.dx * 40}deg)`}
      ], {duration: 480, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards'}));
      await pause(150);
    }
    await all(running);
    await pause(350);
    els.skip.hidden = true;

    // 3) timbro con impatto
    showSuccess();
    const hit = track(els.stamp.animate([
      {opacity: 0, transform: 'rotate(-20deg) scale(2.6)'},
      {opacity: 1, transform: 'rotate(-8deg) scale(.92)', offset: .7},
      {opacity: 1, transform: 'rotate(-8deg) scale(1)'}
    ], {duration: 420, easing: 'cubic-bezier(.55,0,.4,1)'}));
    els.reveal.forEach(el => { el.style.opacity = 0; });
    await pause(290);
    track(els.stage.animate(
      [{transform: 'translate(0,0)'}, {transform: 'translate(-4px,2px)'}, {transform: 'translate(3px,-2px)'},
       {transform: 'translate(-2px,1px)'}, {transform: 'translate(0,0)'}],
      {duration: 260, easing: 'ease-out'}));
    track(els.ink.animate([{opacity: .7, transform: 'scale(1)'}, {opacity: 0, transform: 'scale(1.6)'}],
                          {duration: 600, easing: EASE_OUT}));
    await hit.finished;
    els.reveal.forEach((el, k) => {
      el.style.opacity = '';
      track(el.animate([{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}],
                       {duration: 380, delay: k * 110, easing: EASE_OUT, fill: 'backwards'}));
    });
  }

  return {reduced, flame, reveal, countTo, sceneSwap, reelAdvance, finale};
})();
