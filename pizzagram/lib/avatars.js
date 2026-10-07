// Avatar a tema PizzaParty: illustrazioni SVG statiche (viewBox 64×64) su sfondo colorato.
// L'ID è quello salvato in profiles/{uid}.avatar: le regole accettano solo ID di questo formato,
// l'app ignora quelli sconosciuti e torna all'iniziale del nickname.

const STROKE = 'stroke="#2a1410" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';

export const AVATARS = [
  {
    id: 'margherita', label: 'Margherita', bg: '#5c8a4a',
    svg: `<circle cx="32" cy="32" r="21" fill="#e2a24a" ${STROKE}/>
      <circle cx="32" cy="32" r="16.5" fill="#d6452b"/>
      <circle cx="25" cy="27" r="4.6" fill="#fffaf0"/><circle cx="38" cy="26" r="4" fill="#fffaf0"/>
      <circle cx="35" cy="38.5" r="4.8" fill="#fffaf0"/><circle cx="24.5" cy="38" r="3.4" fill="#fffaf0"/>
      <ellipse cx="31" cy="31" rx="4" ry="2" fill="#3f8a3a" transform="rotate(-30 31 31)"/>
      <ellipse cx="41.5" cy="32" rx="3.4" ry="1.7" fill="#3f8a3a" transform="rotate(40 41.5 32)"/>`
  },
  {
    id: 'diavola', label: 'Diavola', bg: '#2a1a2e',
    svg: `<path d="M14 18 Q32 9 50 18 L32 54 Z" fill="#f5c934" ${STROKE}/>
      <path d="M14 18 Q32 9 50 18 L47.6 22.8 Q32 15 16.4 22.8 Z" fill="#c9832e"/>
      <circle cx="26" cy="27" r="3.6" fill="#c0391f"/><circle cx="37" cy="28" r="3.4" fill="#c0391f"/>
      <circle cx="31" cy="38" r="3.2" fill="#c0391f"/>
      <path d="M44 40 q7 1 7 9 q-3-4-8-4 z" fill="#e5361f" ${STROKE}/><path d="M44 40 l-2.5-3.2" stroke="#3f8a3a" stroke-width="2.2" stroke-linecap="round"/>`
  },
  {
    id: 'fetta', label: 'Fetta filante', bg: '#d24a30',
    svg: `<path d="M13 20 Q32 10 51 20 L32 55 Z" fill="#f7d75a" ${STROKE}/>
      <path d="M13 20 Q32 10 51 20 L48.5 25 Q32 16.5 15.5 25 Z" fill="#d18a35"/>
      <path d="M20.6 34 Q19.6 41 21 46 Q23.2 47.4 23.6 44.6 Q23.2 40 24 38.6 Z" fill="#f7d75a" ${STROKE}/>
      <path d="M43.4 34 Q44.4 39 43.4 43 Q41.4 44.2 40.9 42 Q41 39 40 38.6 Z" fill="#f7d75a" ${STROKE}/>
      <circle cx="27" cy="27" r="2.6" fill="#d24a30"/><circle cx="37" cy="26" r="2.2" fill="#d24a30"/>`
  },
  {
    id: 'peperoncino', label: 'Peperoncino', bg: '#c99a1e',
    svg: `<path d="M22 22 Q40 18 44 30 Q48 44 30 50 Q38 40 34 32 Q30 26 22 22 Z" fill="#e0301e" ${STROKE}/>
      <path d="M38 23 Q41 24 42 28" stroke="#ff8b70" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M22 22 Q18 20 17 15" stroke="#3f8a3a" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M19 21 q2-5 7-3 q-2 4-7 3 z" fill="#4f9a3e"/>`
  },
  {
    id: 'basilico', label: 'Basilico', bg: '#c2477f',
    svg: `<path d="M32 52 V30" stroke="#2f6e2a" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M32 34 Q16 34 15 20 Q29 18 32 34 Z" fill="#4f9a3e" ${STROKE}/>
      <path d="M32 34 Q48 34 49 20 Q35 18 32 34 Z" fill="#5fae4a" ${STROKE}/>
      <path d="M32 30 Q24 22 32 11 Q40 22 32 30 Z" fill="#6bbd52" ${STROKE}/>
      <path d="M32 29 V14 M31 33 L19 23 M33 33 L45 23" stroke="#2f6e2a" stroke-width="1.1" stroke-linecap="round"/>`
  },
  {
    id: 'pomodoro', label: 'Pomodoro', bg: '#3d8fb0',
    svg: `<circle cx="32" cy="35" r="16" fill="#e5361f" ${STROKE}/>
      <path d="M24 28 q3-4 8-4" stroke="#ff9a82" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M32 20 l-6-3 l4 5 l-7 1 l7 2 l2 0 l2 0 l7-2 l-7-1 l4-5 z" fill="#3f8a3a" ${STROKE}/>
      <path d="M32 20 V13" stroke="#2f6e2a" stroke-width="2.4" stroke-linecap="round"/>`
  },
  {
    id: 'forno', label: 'Forno a legna', bg: '#1d2b4a',
    svg: `<path d="M11 46 Q11 16 32 16 Q53 16 53 46 Z" fill="#b2502f" ${STROKE}/>
      <path d="M22 46 V37 Q22 28 32 28 Q42 28 42 37 V46 Z" fill="#1a0c08"/>
      <path d="M26 46 Q25 39 29 35 Q29 40 32 38 Q31 33 35 31 Q34 37 38 39 Q40 43 38 46 Z" fill="#ff8a2a"/>
      <path d="M30 46 Q29 42 32 39 Q33 43 35 43 Q36 45 35 46 Z" fill="#ffd36a"/>
      <rect x="8" y="46" width="48" height="5" rx="1.5" fill="#5a4a40" ${STROKE}/>
      <rect x="38" y="10" width="6" height="9" fill="#7a3a24" ${STROKE}/>`
  },
  {
    id: 'chef', label: 'Pizzaiolo', bg: '#ff8a4d',
    svg: `<path d="M19 30 Q12 28 14 20 Q17 13 24 16 Q27 9 33 11 Q40 9 42 16 Q50 14 51 21 Q52 29 45 30 Z" fill="#fffaf0" ${STROKE}/>
      <rect x="20" y="29" width="25" height="7" rx="1.5" fill="#f3e8d6" ${STROKE}/>
      <circle cx="32.5" cy="45" r="11" fill="#f2c79c" ${STROKE}/>
      <path d="M25 47 Q29 43 32.5 46 Q36 43 40 47 Q36 50 32.5 48 Q29 50 25 47 Z" fill="#3a2418"/>
      <circle cx="28.5" cy="42" r="1.3" fill="#2a1410"/><circle cx="36.5" cy="42" r="1.3" fill="#2a1410"/>`
  },
  {
    id: 'pala', label: 'Pala', bg: '#8a5cc2',
    svg: `<path d="M38 38 L52 54" stroke="#8f5a2c" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="28" cy="28" r="17" fill="#c58a4f" ${STROKE}/>
      <circle cx="28" cy="28" r="12" fill="#e2a24a"/><circle cx="28" cy="28" r="9.4" fill="#d6452b"/>
      <circle cx="25" cy="25" r="2.5" fill="#fffaf0"/><circle cx="31.5" cy="30.5" r="2.7" fill="#fffaf0"/>
      <ellipse cx="30" cy="24" rx="2.3" ry="1.2" fill="#3f8a3a" transform="rotate(30 30 24)"/>`
  },
  {
    id: 'funghi', label: 'Funghi', bg: '#5c8a4a',
    svg: `<path d="M27 34 Q26 46 24 50 H40 Q38 46 37 34 Z" fill="#f3e8d6" ${STROKE}/>
      <path d="M12 34 Q12 15 32 14 Q52 15 52 34 Z" fill="#b8562f" ${STROKE}/>
      <circle cx="24" cy="24" r="3" fill="#f3e8d6"/><circle cx="37" cy="21" r="2.4" fill="#f3e8d6"/>
      <circle cx="43" cy="29" r="2.2" fill="#f3e8d6"/><circle cx="30" cy="30" r="1.8" fill="#f3e8d6"/>`
  },
  {
    id: 'birra', label: 'Birra', bg: '#3d8fb0',
    svg: `<path d="M17 22 H41 V50 Q41 53 38 53 H20 Q17 53 17 50 Z" fill="#f5b52e" ${STROKE}/>
      <path d="M41 27 H46 Q50 27 50 32 V40 Q50 45 46 45 H41" fill="none" stroke="#2a1410" stroke-width="3.2"/>
      <path d="M41 27 H46 Q50 27 50 32 V40 Q50 45 46 45 H41" fill="none" stroke="#f3e8d6" stroke-width="1.6"/>
      <path d="M15 22 Q15 13 23 15 Q27 10 32 14 Q38 11 41 16 Q45 17 43 23 Z" fill="#fffaf0" ${STROKE}/>
      <path d="M24 30 V47 M31 30 V47" stroke="#ffd36a" stroke-width="2" stroke-linecap="round"/>`
  },
  {
    id: 'fiamma', label: 'Fiamma', bg: '#4a2414',
    svg: `<path d="M32 54 Q16 50 17 36 Q18 28 25 22 Q25 30 30 31 Q27 20 35 10 Q36 21 43 27 Q49 33 47 42 Q45 52 32 54 Z" fill="#ff7a2a" ${STROKE}/>
      <path d="M32 52 Q23 49 24 41 Q25 36 29 33 Q30 39 33 39 Q33 33 37 30 Q39 37 41 40 Q43 49 32 52 Z" fill="#ffb347"/>
      <path d="M32 50 Q28 48 28.5 44 Q29 41 32 39 Q33 43 35 44 Q36 49 32 50 Z" fill="#ffe08a"/>`
  }
];

export const AVATAR_BY_ID = new Map(AVATARS.map(a => [a.id, a]));

// Restituisce l'elemento <svg> dell'avatar (markup statico: nessun dato degli utenti dentro).
export function avatarSvg(id) {
  const a = AVATAR_BY_ID.get(id);
  if (!a) return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = a.svg;
  return svg;
}
