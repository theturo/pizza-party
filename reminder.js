// ============================================================
// Promemoria PDF: la card viene disegnata direttamente su <canvas>.
// Non dipende da html2canvas né dal caricamento dei fogli di stile,
// quindi il risultato è lo stesso in tutti i browser.
// Misure in px CSS (card 559×794, cioè un A5), come il vecchio layout HTML.
// ============================================================
const Reminder = (() => {
  const W = 559, H = 794, PAD_X = 44, CONTENT_W = W - PAD_X * 2;
  const C = {
    bg: '#17141a', stripe: '#2b2733', gold: '#f5c934', tomato: '#d24a30', basil: '#5c8a4a',
    parchment: '#f3e8d6', dim: '#cabfa8', ink: '#0c2a4a', rule: 'rgba(245,201,52,.3)'
  };
  const SERIF = '"Fraunces", Georgia, serif';
  const HAND = '"Kalam", "Bradley Hand", cursive';
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const FLAME = [
    ['M50 120 C20 100 15 70 30 45 C33 60 40 62 40 50 C40 30 30 20 32 5 C55 20 70 40 65 60 C75 55 78 45 76 35 C90 55 88 85 65 105 C70 90 60 90 55 100 C58 90 50 88 50 120 Z', '#ff8a4d', 1],
    ['M50 120 C35 105 32 85 40 68 C42 78 46 79 46 70 C46 55 40 48 41 38 C56 48 65 62 62 76 C68 73 70 66 69 59 C77 72 76 92 62 106 Z', '#ffb15c', .85]
  ];

  function loadImage(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Immagine non caricata: ' + src));
      img.src = src;
    });
  }

  // Testo con spaziatura tra le lettere (ctx.letterSpacing non c'è ovunque).
  function spacedText(ctx, text, x, y, spacing){
    for(const ch of text){ ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + spacing; }
  }

  // A capo per parole entro maxWidth; restituisce le righe.
  function wrap(ctx, text, maxWidth){
    const words = String(text).split(/\s+/).filter(Boolean), lines = [];
    let line = '';
    words.forEach(w => {
      const test = line ? line + ' ' + w : w;
      if(line && ctx.measureText(test).width > maxWidth){ lines.push(line); line = w; }
      else line = test;
    });
    if(line) lines.push(line);
    return lines.length ? lines : [''];
  }

  // Scrive un blocco di testo centrando ogni riga nella sua line-box, come fa il CSS.
  function textBlock(ctx, lines, x, top, lineHeight, align){
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x, top + lineHeight * (i + .5)));
    return top + lineHeight * lines.length;
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // data: {nome, quando, dove, quota, porti, online, cashNote}
  async function draw(data, scale = 2){
    await Promise.all([
      document.fonts.load('italic 900 60px "Fraunces"'),
      document.fonts.load('italic 700 22px "Fraunces"'),
      document.fonts.load('700 16px "Kalam"')
    ]).catch(() => {});
    const [qrPaypal, qrSatispay] = data.online
      ? await Promise.all([loadImage('assets/qr-paypal.png'), loadImage('assets/qr-satispay.png')])
      : [null, null];

    const canvas = document.createElement('canvas');
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // sfondo e striscia di pellicola in alto
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    for(let x = 0; x < W; x += 33){ ctx.fillStyle = C.stripe; ctx.fillRect(x, 0, 20, 24); }
    ctx.fillStyle = C.gold; ctx.fillRect(0, 24, W, 2);

    // fiamma nell'angolo in basso a destra
    ctx.save();
    ctx.globalAlpha = .22;
    ctx.translate(W + 34 - 210, H + 44 - 252);
    ctx.scale(2.1, 2.1);
    FLAME.forEach(([d, color, alpha]) => {
      ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.fill(new Path2D(d)); ctx.restore();
    });
    ctx.restore();

    // timbro
    ctx.save();
    ctx.translate(W - 30 - 35, 44 + 35);
    ctx.rotate(-9 * Math.PI / 180);
    ctx.strokeStyle = C.basil; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 33.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = C.basil; ctx.font = `italic 900 12px ${SERIF}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ISCRITTO', 0, 0);
    ctx.restore();

    let y = 26 + 38;

    // "PROMEMORIA DI …"
    ctx.fillStyle = C.dim; ctx.font = `700 12px ${SANS}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    // accorciato con "…" se arriverebbe sotto il timbro (che inizia a x = 459)
    const spacedWidth = t => [...t].reduce((w, ch) => w + ctx.measureText(ch).width + 12 * .16, 0);
    let eyebrow = ('Promemoria di ' + data.nome).toUpperCase();
    if(spacedWidth(eyebrow) > 400){
      while(eyebrow.length > 16 && spacedWidth(eyebrow + '…') > 400) eyebrow = eyebrow.slice(0, -1);
      eyebrow = eyebrow.trimEnd() + '…';
    }
    spacedText(ctx, eyebrow, PAD_X, y + 9.3, 12 * .16);
    y += 18.6 + 8;

    // titolo e sottotitolo
    ctx.fillStyle = C.gold; ctx.font = `italic 900 60px ${SERIF}`;
    y = textBlock(ctx, ['PizzaParty'], PAD_X, y, 54);
    ctx.fillStyle = C.parchment; ctx.font = `italic 700 22px ${SERIF}`;
    y = textBlock(ctx, ['10° Anniversario'], PAD_X, y + 8, 34.1);

    // bigliettino "Ci vediamo il …"
    y += 20;
    ctx.font = `italic 700 16px ${HAND}`;
    const sticker = 'Ci vediamo il ' + data.dayMonth + '!';
    const sw = ctx.measureText(sticker).width + 36, sh = 24.8 + 14;
    ctx.save();
    ctx.translate(PAD_X + sw / 2, y + sh / 2);
    ctx.rotate(-1.5 * Math.PI / 180);
    ctx.fillStyle = C.parchment; roundRect(ctx, -sw / 2, -sh / 2, sw, sh, 3); ctx.fill();
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sticker, 0, 1);
    ctx.restore();
    y += sh;

    const rule = () => { y += 26; ctx.fillStyle = C.rule; ctx.fillRect(PAD_X, y, CONTENT_W, 1); y += 1 + 26; };
    rule();

    // Quando / Dove / Quota / Porti
    const DT_W = 92, GAP = 18, DD_X = PAD_X + DT_W + GAP, DD_W = CONTENT_W - DT_W - GAP, LH = 22.5;
    [['Quando', data.quando], ['Dove', data.dove], ['Quota', data.quota], ['Porti', data.porti]].forEach(([k, v], i) => {
      if(i) y += 15;
      ctx.fillStyle = C.tomato; ctx.font = `italic 700 15px ${SERIF}`;
      textBlock(ctx, [k], PAD_X, y, LH);
      ctx.fillStyle = C.parchment; ctx.font = `400 15px ${SANS}`;
      y = textBlock(ctx, wrap(ctx, v, DD_W), DD_X, y, LH);
    });

    if(data.online){
      rule();
      ctx.fillStyle = C.parchment; ctx.font = `italic 700 19px ${SERIF}`;
      y = textBlock(ctx, ["Paga la quota comodamente da qui"], PAD_X, y, 29.45) + 16;
      const colW = (CONTENT_W - 24) / 2;
      [[qrPaypal, 'PayPal', 'paypal.me/ArturoScalori'], [qrSatispay, 'Satispay', '@arturoscalori']].forEach(([img, lbl, id], i) => {
        const cx = PAD_X + i * (colW + 24) + colW / 2;
        const x0 = cx - 64;
        ctx.save();
        roundRect(ctx, x0, y, 128, 128, 6); ctx.clip();
        ctx.imageSmoothingEnabled = false;          // moduli del QR netti, quindi leggibili
        ctx.drawImage(img, x0 + 2, y + 2, 124, 124);
        ctx.restore();
        ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
        roundRect(ctx, x0 + 1, y + 1, 126, 126, 5); ctx.stroke();
        ctx.fillStyle = C.gold; ctx.font = `700 14px ${SANS}`;
        const after = textBlock(ctx, [lbl], cx, y + 128 + 10, 21.7, 'center');
        ctx.fillStyle = C.dim; ctx.font = `400 11px ${SANS}`;
        textBlock(ctx, [id], cx, after + 2, 17.05, 'center');
      });
    } else {
      y += 26;
      ctx.fillStyle = C.dim; ctx.font = `400 13px ${SANS}`;
      textBlock(ctx, wrap(ctx, data.cashNote, CONTENT_W), PAD_X, y, 19.5);
    }
    return canvas;
  }

  return {draw};
})();
