/**
 * skeleton.js — Skeleton loaders AutoMaroc
 *
 * Exports :
 *   renderTableSkeleton(rows?)   — placeholder tableau avec lignes animées
 *   renderCardSkeleton(count?)   — placeholder grille de cartes KPI
 *   renderFormSkeleton()         — placeholder formulaire avec labels + inputs
 *   skeletonShimmer()            — styles CSS animés (injectés automatiquement)
 */

// ─── Styles shimmer ───────────────────────────────────────────────────────────

const SHIMMER_CSS = `
  @keyframes am-shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }

  .am-skel {
    display: inline-block;
    background: linear-gradient(
      90deg,
      #f3f4f6 25%,
      #e9eaec 50%,
      #f3f4f6 75%
    );
    background-size: 600px 100%;
    animation: am-shimmer 1.4s ease-in-out infinite;
    border-radius: 6px;
  }

  .am-skel-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    border-bottom: 1px solid #f9fafb;
  }

  .am-skel-card {
    background: #fff;
    border: 1px solid #f3f4f6;
    border-radius: 16px;
    padding: 18px;
  }

  .am-skel-form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
`;

let _stylesInjected = false;
function injectSkeletonStyles() {
  if (_stylesInjected || document.getElementById('am-skel-styles')) return;
  const s = document.createElement('style');
  s.id  = 'am-skel-styles';
  s.textContent = SHIMMER_CSS;
  document.head.appendChild(s);
  _stylesInjected = true;
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * renderTableSkeleton(rows?)
 * Retourne un nœud DOM simulant un tableau en chargement.
 * @param {number} rows — nombre de lignes skeleton (défaut 5)
 * @returns {HTMLElement}
 */
export function renderTableSkeleton(rows = 5) {
  injectSkeletonStyles();

  const wrap = document.createElement('div');
  wrap.className = 'am-skel-table-wrap';
  wrap.setAttribute('aria-busy', 'true');
  wrap.setAttribute('aria-label', 'Chargement…');
  wrap.style.cssText = `
    background:#fff; border:1px solid #f3f4f6; border-radius:16px; overflow:hidden;`;

  // Faux header
  wrap.innerHTML = `
    <div style="
      background:#f9fafb; border-bottom:1px solid #f3f4f6;
      padding:10px 20px; display:flex; gap:16px; align-items:center;">
      ${skRow([90,160,120,80,100,60], true)}
    </div>
    ${Array.from({ length: rows }, (_, i) => `
      <div class="am-skel-row" style="opacity:${1 - i * 0.12}">
        <span class="am-skel" style="width:${pick([70,90,80])}px; height:20px; border-radius:20px;"></span>
        <span class="am-skel" style="width:${pick([140,180,120])}px; height:14px;"></span>
        <span class="am-skel" style="width:${pick([100,120,80])}px; height:14px;"></span>
        <span class="am-skel" style="width:${pick([60,80,90])}px; height:14px;"></span>
        <span class="am-skel" style="width:${pick([90,60,110])}px; height:14px; margin-left:auto;"></span>
        <span class="am-skel" style="width:60px; height:28px; border-radius:8px;"></span>
      </div>`).join('')}`;

  return wrap;
}

/**
 * renderCardSkeleton(count?)
 * Retourne un nœud DOM simulant des cartes KPI en chargement.
 * @param {number} count — nombre de cartes (défaut 4)
 * @returns {HTMLElement}
 */
export function renderCardSkeleton(count = 4) {
  injectSkeletonStyles();

  const grid = document.createElement('div');
  grid.setAttribute('aria-busy', 'true');
  grid.setAttribute('aria-label', 'Chargement…');
  grid.style.cssText = `
    display:grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap:16px;`;

  grid.innerHTML = Array.from({ length: count }, (_, i) => `
    <div class="am-skel-card" style="opacity:${1 - i * 0.1}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
        <span class="am-skel" style="width:${pick([80,100,70])}px; height:12px;"></span>
        <span class="am-skel" style="width:36px; height:36px; border-radius:10px;"></span>
      </div>
      <span class="am-skel" style="width:${pick([60,80,50])}px; height:32px; display:block; margin-bottom:10px;"></span>
      <span class="am-skel" style="width:${pick([110,90,120])}px; height:10px; display:block;"></span>
    </div>`).join('');

  return grid;
}

/**
 * renderFormSkeleton()
 * Retourne un nœud DOM simulant un formulaire en chargement.
 * @returns {HTMLElement}
 */
export function renderFormSkeleton() {
  injectSkeletonStyles();

  const wrap = document.createElement('div');
  wrap.setAttribute('aria-busy', 'true');
  wrap.style.cssText = `display:flex; flex-direction:column; gap:20px; padding:4px 0;`;

  wrap.innerHTML = `
    ${Array.from({ length: 4 }, () => `
      <div class="am-skel-form-field">
        <span class="am-skel" style="width:${pick([80,110,90])}px; height:11px;"></span>
        <span class="am-skel" style="width:100%; height:40px; border-radius:10px;"></span>
      </div>`).join('')}
    <div style="display:flex; gap:10px; margin-top:8px; justify-content:flex-end;">
      <span class="am-skel" style="width:90px; height:36px; border-radius:10px;"></span>
      <span class="am-skel" style="width:120px; height:36px; border-radius:10px;"></span>
    </div>`;

  return wrap;
}

/**
 * renderChartSkeleton(height?)
 * Retourne un nœud DOM simulant un graphique en chargement.
 * @param {number} height — hauteur en px (défaut 200)
 * @returns {HTMLElement}
 */
export function renderChartSkeleton(height = 200) {
  injectSkeletonStyles();

  const wrap = document.createElement('div');
  wrap.setAttribute('aria-busy', 'true');
  wrap.style.cssText = `
    background:#fff; border:1px solid #f3f4f6; border-radius:16px;
    padding:20px; display:flex; flex-direction:column; gap:12px;`;

  // Faux titre + sous-titre
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:6px;">
      <span class="am-skel" style="width:${pick([140,160,120])}px; height:14px;"></span>
      <span class="am-skel" style="width:${pick([200,180,220])}px; height:10px;"></span>
    </div>
    <div style="
      height:${height}px; background:#f9fafb; border-radius:10px;
      display:flex; align-items:flex-end; gap:8px; padding:16px 12px;
      overflow:hidden;">
      ${Array.from({ length: 7 }, () => {
        const h = 30 + Math.floor(Math.random() * 60);
        return `<span class="am-skel" style="
          flex:1; height:${h}%; border-radius:6px 6px 0 0;
          align-self:flex-end;"></span>`;
      }).join('')}
    </div>`;

  return wrap;
}

/**
 * renderTimelineSkeleton(items?)
 * Retourne un nœud DOM simulant une timeline en chargement.
 * @param {number} items — nombre d'items (défaut 4)
 * @returns {HTMLElement}
 */
export function renderTimelineSkeleton(items = 4) {
  injectSkeletonStyles();

  const wrap = document.createElement('div');
  wrap.setAttribute('aria-busy', 'true');
  wrap.style.cssText = `
    background:#fff; border:1px solid #f3f4f6; border-radius:16px; overflow:hidden;`;

  wrap.innerHTML = `
    <div style="padding:14px 20px; border-bottom:1px solid #f3f4f6; display:flex; gap:10px; align-items:center;">
      <span class="am-skel" style="width:160px; height:14px;"></span>
      <span class="am-skel" style="width:60px; height:22px; border-radius:20px; margin-left:auto;"></span>
    </div>
    ${Array.from({ length: items }, (_, i) => `
      <div class="am-skel-row" style="gap:14px; opacity:${1 - i * 0.15}">
        <span class="am-skel" style="width:40px; height:40px; border-radius:10px; flex-shrink:0;"></span>
        <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
          <span class="am-skel" style="width:${pick([140,120,160])}px; height:12px;"></span>
          <span class="am-skel" style="width:${pick([200,180,220])}px; height:10px;"></span>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
          <span class="am-skel" style="width:50px; height:14px;"></span>
          <span class="am-skel" style="width:80px; height:10px;"></span>
        </div>
      </div>`).join('')}`;

  return wrap;
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function skRow(widths, isHeader = false) {
  return widths.map(w => `
    <span class="am-skel" style="
      width:${w}px; height:${isHeader ? 11 : 14}px;
      opacity:${isHeader ? 0.7 : 1};"></span>`).join('');
}
