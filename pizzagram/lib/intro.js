// Animazione d'avvio di Pizzagram, disegnata su canvas.
// Forno a legna acceso → la pala inforna una margherita → cottura tra braci e fumo →
// la pizza esce, vola in alto e diventa la "lente" dell'icona → logo e tagline (nel DOM).
// Si salta con un tocco; con "riduci movimento" mostra direttamente la scena finale.

const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const outCubic = t => 1 - (1 - t) ** 3;
const inOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const inCubic = t => t * t * t;
const outBack = t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`;
}

// Tempi in millisecondi a velocità normale.
const T = {
  ovenIn: [0, 550],
  fire: [150, 950],
  slideIn: [550, 1350],
  peelOut: [1350, 1700],
  bake: [1350, 2550],
  pullOut: [2550, 3000],
  fly: [3000, 3650],
  ovenOut: [2950, 3550],
  icon: [3350, 4050],
  text: 3550,
  end: 4800
};

// Posizioni fisse (niente casualità: la scena è identica a ogni avvio).
const MOZZ = [[-0.28, -0.22, 0.19], [0.3, -0.12, 0.17], [0.02, 0.3, 0.18], [-0.32, 0.22, 0.14], [0.12, -0.38, 0.13], [0.36, 0.3, 0.12]];
const BASIL = [[-0.05, -0.05, 0.6], [0.4, 0.06, 2.1], [-0.42, -0.02, 4.0], [0.2, 0.46, 1.2]];
const CHAR = Array.from({ length: 22 }, (_, i) => [i / 22 * TAU + Math.sin(i * 7.3) * 0.12, 0.9 + Math.sin(i * 3.1) * 0.06, 0.035 + (i % 3) * 0.012]);
const BRICKS = [[-0.62, -0.38], [-0.35, -0.72], [0.05, -0.86], [0.42, -0.66], [0.66, -0.3], [-0.78, -0.12], [0.2, -0.45], [-0.18, -0.5]];

function layout(W, H) {
  const s = Math.max(0.72, Math.min(1.45, Math.min(W / 390, H / 780)));
  const domeW = 300 * s, domeH = 185 * s;
  const cx = W / 2, floorY = H * 0.58;
  const mW = domeW * 0.46, mH = domeH * 0.56;
  const iconSize = Math.min(W * 0.44, 176 * s);
  return {
    s, W, H, cx, floorY, domeW, domeH, mW, mH,
    iconSize, iconY: H * 0.36,
    ovenPizza: { x: cx, y: floorY - mH * 0.1, r: mW * 0.27, sq: 0.3 },
    startPizza: { x: cx + W * 0.42, y: H + 60 * s, r: 74 * s, sq: 0.42 },
    frontPizza: { x: cx, y: floorY + 64 * s, r: 66 * s, sq: 0.42 }
  };
}

function mouthPath(ctx, L, grow = 0, begin = true) {
  const { cx, floorY, mW, mH } = L;
  const w = mW / 2 + grow, springY = floorY - mH * 0.42;
  if (begin) ctx.beginPath();
  ctx.moveTo(cx - w, floorY);
  ctx.lineTo(cx - w, springY);
  ctx.ellipse(cx, springY, w, mH * 0.58 + grow, 0, Math.PI, 0);
  ctx.lineTo(cx + w, floorY);
  ctx.closePath();
}

function drawPizza(ctx, x, y, r, sq, bake, rot = 0, cut = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, sq);
  ctx.rotate(rot);

  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.arc(r * 0.04, r * 0.08, r * 1.02, 0, TAU); ctx.fill();

  const crust = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r);
  crust.addColorStop(0, mix('#f3e2b8', '#e9a94e', bake));
  crust.addColorStop(1, mix('#e2c48c', '#b8681f', bake));
  ctx.fillStyle = crust;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

  if (bake > 0.45) {
    ctx.fillStyle = `rgba(52,22,8,${(bake - 0.45) * 1.3})`;
    for (const [a, d, rr] of CHAR) {
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * d, Math.sin(a) * r * d, r * rr, 0, TAU); ctx.fill();
    }
  }

  ctx.fillStyle = mix('#d6452b', '#b3301b', bake);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.fill();

  for (const [mx, my, mr] of MOZZ) {
    const rr = r * mr * (1 + bake * 0.3);
    ctx.fillStyle = mix('#fffdf5', '#fbe3a6', bake);
    ctx.beginPath(); ctx.arc(mx * r, my * r, rr, 0, TAU); ctx.fill();
    if (bake > 0.3) {
      ctx.fillStyle = `rgba(214,150,64,${(bake - 0.3) * 0.75})`;
      ctx.beginPath(); ctx.arc(mx * r + rr * 0.2, my * r - rr * 0.15, rr * 0.38, 0, TAU); ctx.fill();
    }
  }

  for (const [bx, by, ba] of BASIL) {
    ctx.save();
    ctx.translate(bx * r, by * r);
    ctx.rotate(ba);
    ctx.fillStyle = mix('#4f9a3e', '#2f6e2a', bake * 0.6);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.13, r * 0.065, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,60,20,.6)';
    ctx.lineWidth = r * 0.012;
    ctx.beginPath(); ctx.moveTo(-r * 0.11, 0); ctx.lineTo(r * 0.11, 0); ctx.stroke();
    ctx.restore();
  }

  if (cut > 0) {
    ctx.strokeStyle = 'rgba(70,28,10,.55)';
    ctx.lineWidth = r * 0.035;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3 + 0.35, len = r * 0.97 * cut;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * len, -Math.sin(a) * len);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPeel(ctx, x, y, r, sq, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const wood = '#b57a43';
  ctx.strokeStyle = '#8f5a2c';
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + r * 0.7, y + r * sq * 0.7);
  ctx.lineTo(x + r * 3.2, y + r * 3.6);
  ctx.stroke();
  ctx.fillStyle = wood;
  ctx.beginPath(); ctx.ellipse(x, y + r * sq * 0.06, r * 1.18, r * 1.18 * sq, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,20,.35)';
  ctx.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.ellipse(x + i * r * 0.3, y, r * 0.08, r * 0.9 * sq, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawFire(ctx, L, t, k) {
  if (k <= 0) return;
  const { cx, floorY, mW, mH } = L;
  const base = floorY - mH * 0.16, w = mW * 0.86, h = mH * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(cx, base, 0, cx, base, w * 0.85);
  glow.addColorStop(0, `rgba(255,150,50,${0.55 * k})`);
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - w, base - h * 1.4, w * 2, h * 1.8);

  const layers = [['214,64,30', 1, 0.75], ['255,138,40', 0.74, 0.8], ['255,214,120', 0.44, 0.9]];
  const N = 7;
  for (const [col, sc, al] of layers) {
    ctx.fillStyle = `rgba(${col},${al * k})`;
    for (let i = 0; i < N; i++) {
      const fx = cx - w / 2 + w * (i + 0.5) / N;
      const edge = 1 - Math.abs(i - (N - 1) / 2) / N;
      const fh = h * sc * k * edge * (0.62 + 0.38 * Math.sin(t * 0.011 + i * 1.9 + sc * 4));
      const fw = (w / N) * (1.7 * sc + 0.5);
      const sway = Math.sin(t * 0.007 + i * 2.3) * fw * 0.35;
      ctx.beginPath();
      ctx.moveTo(fx - fw / 2, base);
      ctx.quadraticCurveTo(fx - fw * 0.55, base - fh * 0.55, fx + sway, base - fh);
      ctx.quadraticCurveTo(fx + fw * 0.55, base - fh * 0.55, fx + fw / 2, base);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.fillStyle = '#2a140a';
  ctx.beginPath(); ctx.ellipse(cx - w * 0.16, base + 2, w * 0.24, h * 0.06, -0.12, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + w * 0.18, base + 3, w * 0.22, h * 0.055, 0.15, 0, TAU); ctx.fill();
}

function drawOven(ctx, L, t, fireK, pizzaInside) {
  const { s, cx, floorY, domeW, domeH, mW, mH } = L;

  // Comignolo (dietro la cupola)
  ctx.fillStyle = '#4a2a1f';
  ctx.fillRect(cx + domeW * 0.14, floorY - domeH * 1.08, 30 * s, 60 * s);
  ctx.fillStyle = '#5d3828';
  ctx.fillRect(cx + domeW * 0.14 - 4 * s, floorY - domeH * 1.08 - 8 * s, 38 * s, 10 * s);

  // Basamento in pietra
  const bw = domeW * 1.16, bh = 74 * s;
  ctx.fillStyle = '#2c2420';
  ctx.fillRect(cx - bw / 2, floorY, bw, bh);
  ctx.fillStyle = '#4b3d34';
  ctx.fillRect(cx - bw / 2 - 6 * s, floorY - 2 * s, bw + 12 * s, 12 * s);
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 3; row++) {
    const y = floorY + 10 * s + row * 21 * s;
    ctx.beginPath(); ctx.moveTo(cx - bw / 2, y); ctx.lineTo(cx + bw / 2, y); ctx.stroke();
    for (let c = 0; c < 6; c++) {
      const x = cx - bw / 2 + (c + (row % 2) * 0.5) * bw / 6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 21 * s); ctx.stroke();
    }
  }

  // Cupola
  const dome = ctx.createRadialGradient(cx - domeW * 0.18, floorY - domeH * 0.75, domeW * 0.05, cx, floorY, domeW * 0.7);
  dome.addColorStop(0, '#c0613a');
  dome.addColorStop(0.55, '#8e3d22');
  dome.addColorStop(1, '#5a2414');
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.ellipse(cx, floorY, domeW / 2, domeH, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(40,12,4,.35)';
  for (const [bx, by] of BRICKS) {
    ctx.beginPath();
    ctx.roundRect?.(cx + bx * domeW / 2 - 13 * s, floorY + by * domeH - 5 * s, 26 * s, 10 * s, 3 * s);
    ctx.fill();
  }

  // Bocca: interno, fuoco, pizza
  ctx.save();
  mouthPath(ctx, L);
  ctx.clip();
  const inside = ctx.createLinearGradient(0, floorY - mH, 0, floorY);
  inside.addColorStop(0, '#120806');
  inside.addColorStop(1, '#2e1409');
  ctx.fillStyle = inside;
  ctx.fillRect(cx - mW, floorY - mH * 1.2, mW * 2, mH * 1.3);
  ctx.fillStyle = `rgba(255,120,40,${0.12 + 0.18 * fireK})`;
  ctx.beginPath(); ctx.ellipse(cx, floorY, mW * 0.6, mH * 0.16, 0, 0, TAU); ctx.fill();
  drawFire(ctx, L, t, fireK);
  if (pizzaInside) pizzaInside();
  ctx.restore();

  // Arco di mattoni intorno alla bocca
  ctx.save();
  mouthPath(ctx, L, 12 * s);
  mouthPath(ctx, L, 0, false);
  ctx.fillStyle = '#a84c2c';
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(40,12,4,.55)';
  ctx.lineWidth = 1.6;
  const springY = floorY - mH * 0.42;
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    const rx = mW / 2, ry = mH * 0.58;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rx, springY + Math.sin(a) * ry);
    ctx.lineTo(cx + Math.cos(a) * (rx + 12 * s), springY + Math.sin(a) * (ry + 12 * s));
    ctx.stroke();
  }
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawIcon(ctx, L, p, dot) {
  if (p <= 0) return;
  const { cx, iconY, iconSize: S } = L;
  const r = S * 0.29, x = cx - S / 2, y = iconY - S / 2;
  const grad = ctx.createLinearGradient(x, y + S, x + S, y);
  grad.addColorStop(0, '#f5c934');
  grad.addColorStop(0.55, '#ff8a4d');
  grad.addColorStop(1, '#d24a30');
  const perimeter = 4 * (S - 2 * r) + TAU * r;
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = S * 0.105;
  ctx.lineCap = 'round';
  ctx.setLineDash([perimeter * p, perimeter]);
  roundRectPath(ctx, x, y, S, S, r);
  ctx.stroke();
  ctx.restore();
  if (dot > 0) {
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx + S * 0.316, iconY - S * 0.316, S * 0.056 * dot, 0, TAU);
    ctx.fill();
  }
}

// Particelle: braci dalla bocca del forno e fumo dal comignolo.
function particles() {
  const list = [];
  return {
    emit(p) { if (list.length < 220) list.push(p); },
    step(dt, ctx) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        p.x += (p.vx + Math.sin(p.life * 0.004 + p.seed) * p.wob) * dt / 1000;
        p.y += p.vy * dt / 1000;
        const a = p.life / p.max;
        ctx.save();
        if (p.kind === 'ember') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(255,${150 + 60 * a | 0},70,${a * p.alpha})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = `rgba(190,178,168,${a * a * p.alpha})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.8 - a), 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
  };
}

export function playIntro(root, { fast = false } = {}) {
  const canvas = root.querySelector('canvas');
  const text = root.querySelector('.intro-text');
  const ctx = canvas.getContext('2d');
  const speed = fast ? 1.7 : 1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let L, raf = 0, last = 0, elapsed = reduced ? T.end : 0, finished = false, textShown = false;
  const fx = particles();

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = root.clientWidth, H = root.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = layout(W, H);
    text.style.top = (L.iconY + L.iconSize / 2 + 30 * L.s) + 'px';
  };
  resize();
  window.addEventListener('resize', resize);

  function frame(t, dt) {
    const { W, H, s, cx, floorY, domeW, domeH, mW, mH } = L;
    ctx.clearRect(0, 0, W, H);

    const ovenIn = outCubic(seg(t, ...T.ovenIn));
    const ovenOut = inCubic(seg(t, ...T.ovenOut));
    const ovenAlpha = ovenIn * (1 - ovenOut);
    const bakeP = seg(t, ...T.bake);
    const fireK = outCubic(seg(t, ...T.fire)) * (1 + 0.35 * Math.sin(bakeP * Math.PI)) * (1 - ovenOut);

    // Bagliore d'ambiente
    const glowY = lerp(floorY - mH * 0.3, L.iconY, outCubic(seg(t, ...T.fly)));
    const g = ctx.createRadialGradient(cx, glowY, 0, cx, glowY, Math.max(W, H) * 0.7);
    g.addColorStop(0, `rgba(255,110,40,${0.22 * Math.max(fireK, outCubic(seg(t, ...T.icon)) * 0.6)})`);
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Pizza: dove si trova in questo istante
    const slide = inOutCubic(seg(t, ...T.slideIn));
    const pull = inOutCubic(seg(t, ...T.pullOut));
    const fly = inOutCubic(seg(t, ...T.fly));
    const bake = outCubic(bakeP);
    const P = L.startPizza, O = L.ovenPizza, F = L.frontPizza;
    let pizza, inside = false, peelA = 0;
    if (t < T.slideIn[1]) {
      pizza = { x: lerp(P.x, O.x, slide), y: lerp(P.y, O.y, slide), r: lerp(P.r, O.r, slide), sq: lerp(P.sq, O.sq, slide) };
      inside = slide > 0.94;
      peelA = 1;
    } else if (t < T.pullOut[0]) {
      pizza = { ...O };
      inside = true;
      peelA = 1 - seg(t, ...T.peelOut);
    } else if (t < T.fly[0]) {
      pizza = { x: O.x, y: lerp(O.y, F.y, pull), r: lerp(O.r, F.r, pull), sq: lerp(O.sq, F.sq, pull) };
      inside = pull < 0.06;
      peelA = 1;
    } else {
      const lift = Math.sin(fly * Math.PI) * 40 * s;
      pizza = {
        x: F.x, y: lerp(F.y, L.iconY, fly) - lift,
        r: lerp(F.r, L.iconSize * 0.263, fly), sq: lerp(F.sq, 1, fly)
      };
      peelA = 1 - seg(t, T.fly[0], T.fly[0] + 250);
    }
    const peelPos = t < T.pullOut[0] && t >= T.slideIn[1]
      ? { x: lerp(O.x, P.x, inCubic(seg(t, ...T.peelOut))), y: lerp(O.y, P.y, inCubic(seg(t, ...T.peelOut))), r: O.r, sq: O.sq }
      : t >= T.fly[0] ? { ...F, y: F.y + 40 * s * seg(t, T.fly[0], T.fly[0] + 250) } : pizza;
    const rot = fly * TAU * 0.75;
    const cut = outCubic(seg(t, T.fly[1] + 150, T.fly[1] + 600));
    const drawP = () => drawPizza(ctx, pizza.x, pizza.y, pizza.r, pizza.sq, bake, rot, cut);
    const drawPl = () => drawPeel(ctx, peelPos.x, peelPos.y, peelPos.r, peelPos.sq, peelA);

    // Fumo e forno
    if (ovenAlpha > 0) {
      if (Math.random() < 0.35 * ovenAlpha) {
        fx.emit({ kind: 'smoke', x: cx + domeW * 0.14 + 15 * s, y: floorY - domeH * 1.12, vx: 8 * s, vy: -38 * s,
          wob: 14 * s, seed: Math.random() * 9, size: (7 + Math.random() * 6) * s, life: 1600, max: 1600, alpha: 0.28 * ovenAlpha });
      }
      ctx.save();
      ctx.globalAlpha = ovenAlpha;
      ctx.translate(0, (1 - ovenIn) * 30 * s + ovenOut * 60 * s);
      drawOven(ctx, L, t, fireK, inside ? () => { if (peelA > 0 && t < T.pullOut[0]) drawPl(); drawP(); } : null);
      ctx.restore();
    }

    // Braci durante la cottura
    if (bakeP > 0 && bakeP < 1 && Math.random() < 0.6) {
      fx.emit({ kind: 'ember', x: cx + (Math.random() - 0.5) * mW * 0.7, y: floorY - mH * 0.85, vx: (Math.random() - 0.5) * 30 * s,
        vy: -(70 + Math.random() * 90) * s, wob: 30 * s, seed: Math.random() * 9, size: (1.4 + Math.random() * 1.8) * s,
        life: 900 + Math.random() * 700, max: 1600, alpha: 0.9 });
    }
    fx.step(dt, ctx);

    // Icona che si disegna intorno alla pizza
    drawIcon(ctx, L, outCubic(seg(t, ...T.icon)), outBack(seg(t, T.icon[1] - 150, T.icon[1] + 250)));

    if (!inside) {
      if (peelA > 0) drawPl();
      drawP();
    }

    if (!textShown && t >= T.text) {
      textShown = true;
      text.classList.add('show');
    }
  }

  return new Promise(resolve => {
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      elapsed = T.end;
      frame(T.end, 0);
      text.classList.add('show');
      root.classList.add('done');
      window.removeEventListener('resize', resize);
      setTimeout(() => { root.hidden = true; resolve(); }, reduced ? 0 : 450);
    };
    root.addEventListener('click', () => {
      if (!finished) { text.classList.add('show'); setTimeout(finish, 120); }
    }, { once: true });

    if (reduced) {
      frame(T.end, 0);
      text.classList.add('show');
      setTimeout(finish, 900);
      return;
    }
    const tick = now => {
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      elapsed += dt * speed;
      frame(elapsed, dt * speed);
      if (elapsed >= T.end) finish();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}
