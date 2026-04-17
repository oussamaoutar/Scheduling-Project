/**
 * layout.js — Shell principal AutoMaroc Scheduling
 *
 * Exports :
 *   initLayout()          — injecte sidebar + topbar dans document.body, démarre l'horloge
 *   setActiveNav(hash)    — met à jour le lien actif et le titre de page
 *   updateImprevuBadge(n) — met à jour le compteur d'imprévus (sidebar + cloche topbar)
 *   setAtelierType(label) — met à jour le badge type atelier (ex: "Flow Shop")
 *
 * Utilisation :
 *   import { initLayout, setActiveNav, updateImprevuBadge } from './components/layout.js';
 *   initLayout();
 *   window.addEventListener('hashchange', () => setActiveNav(location.hash));
 *   setActiveNav(location.hash);
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

const SIDEBAR_W = 240; // px
const TOPBAR_H  = 56;  // px

// Définition des liens de navigation
// group: null → pas de séparateur avant, 'production' → séparateur avant le groupe
const NAV_LINKS = [
  {
    group: null,
    items: [
      { hash: '#/dashboard',  label: 'Dashboard',       icon: iconGrid(),   title: 'Tableau de bord' },
    ],
  },
  {
    group: 'DONNÉES',
    items: [
      { hash: '#/machines',   label: 'Machines',        icon: iconGear(),   title: 'Machines' },
      { hash: '#/jobs',       label: 'Jobs',            icon: iconList(),   title: 'Jobs de production' },
      { hash: '#/operations', label: 'Opérations',      icon: iconLink(),   title: 'Opérations' },
    ],
  },
  {
    group: 'PLANIFICATION',
    items: [
      { hash: '#/scheduling', label: 'Scheduling',      icon: iconPlay(),   title: 'Ordonnancement' },
      { hash: '#/gantt',      label: 'Diagramme Gantt', icon: iconBars(),   title: 'Diagramme de Gantt' },
      { hash: '#/comparison', label: 'Comparaison',     icon: iconBalance(), title: 'Comparaison d\'algorithmes' },
    ],
  },
  {
    group: 'PRODUCTION',         // <-- séparateur before this group
    items: [
      { hash: '#/imprevus',   label: 'Imprévus',        icon: iconAlert(),  title: 'Imprévus & Pannes', accent: 'orange' },
      { hash: '#/historique', label: 'Historique',      icon: iconGraph(),  title: 'Historique' },
    ],
  },
];

// Styles CSS injectés une seule fois
const LAYOUT_STYLES = `
  /* ── Reset box sizing ── */
  *, *::before, *::after { box-sizing: border-box; }

  /* ── CSS variables ── */
  :root {
    --primary: #378ADD;
    --primary-light: #EFF6FF;
    --secondary: #1D9E75;
    --orange: #F97316;
    --danger: #E24B4A;
    --border: #e5e7eb;
    --text-main: #111827;
    --text-muted: #6B7280;
    --bg-main: #F9FAFB;
    --sidebar-w: ${SIDEBAR_W}px;
    --topbar-h: ${TOPBAR_H}px;
  }

  body {
    margin: 0;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    background: var(--bg-main);
    color: var(--text-main);
  }

  /* ── Sidebar ── */
  #am-sidebar {
    position: fixed;
    top: 0; left: 0;
    width: var(--sidebar-w);
    height: 100vh;
    background: #ffffff;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    z-index: 200;
    transition: transform 0.28s cubic-bezier(.4,0,.2,1);
    overflow: hidden;
  }

  /* ── Sidebar header ── */
  #am-sidebar .sb-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 16px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  #am-sidebar .sb-logo-icon {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, var(--primary) 0%, #2563eb 100%);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(55,138,221,.30);
  }

  #am-sidebar .sb-logo-icon svg {
    width: 20px; height: 20px; color: #fff; fill: none;
  }

  #am-sidebar .sb-logo-text .sb-name {
    font-size: 15px; font-weight: 700;
    color: var(--text-main); line-height: 1.2;
    letter-spacing: -.3px;
  }

  #am-sidebar .sb-logo-text .sb-sub {
    font-size: 11px; color: var(--text-muted);
    font-weight: 500; text-transform: uppercase; letter-spacing: .6px;
  }

  /* ── Nav scroll area ── */
  #am-sidebar .sb-nav {
    flex: 1;
    overflow-y: auto;
    padding: 10px 0;
    scrollbar-width: thin;
    scrollbar-color: #e5e7eb transparent;
  }

  #am-sidebar .sb-nav::-webkit-scrollbar { width: 4px; }
  #am-sidebar .sb-nav::-webkit-scrollbar-thumb {
    background: #e5e7eb; border-radius: 4px;
  }

  /* ── Group label ── */
  #am-sidebar .sb-group {
    padding: 14px 16px 4px;
  }

  #am-sidebar .sb-group-label {
    font-size: 10px; font-weight: 700;
    letter-spacing: .9px; color: #9ca3af;
    user-select: none;
  }

  /* ── Nav separator ── */
  #am-sidebar .sb-separator {
    height: 1px; background: var(--border);
    margin: 8px 16px;
  }

  /* ── Nav link ── */
  #am-sidebar .sb-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    margin: 1px 8px;
    border-radius: 8px;
    text-decoration: none;
    font-size: 13.5px;
    font-weight: 450;
    color: var(--text-muted);
    transition: background .15s, color .15s, border-color .15s;
    border-left: 3px solid transparent;
    position: relative;
    cursor: pointer;
  }

  #am-sidebar .sb-link:hover:not(.active) {
    background: #F9FAFB;
    color: var(--text-main);
  }

  #am-sidebar .sb-link.active {
    background: var(--primary-light);
    color: var(--primary);
    font-weight: 500;
    border-left-color: var(--primary);
  }

  #am-sidebar .sb-link.active svg { color: var(--primary) !important; }

  /* Orange variant (Imprévus) */
  #am-sidebar .sb-link.accent-orange svg { color: var(--orange); }
  #am-sidebar .sb-link.accent-orange:hover:not(.active) { color: var(--orange); }
  #am-sidebar .sb-link.accent-orange.active {
    background: #FFF7ED;
    color: var(--orange);
    border-left-color: var(--orange);
  }

  #am-sidebar .sb-link svg {
    width: 18px; height: 18px;
    flex-shrink: 0;
    color: #9ca3af;
    transition: color .15s;
  }

  /* ── Imprévus badge in sidebar ── */
  .sb-imprevu-badge {
    margin-left: auto;
    background: var(--danger);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    border-radius: 9999px;
    padding: 0px 6px;
    min-width: 18px;
    height: 18px;
    display: flex; align-items: center; justify-content: center;
    line-height: 1;
  }

  /* ── Sidebar footer ── */
  #am-sidebar .sb-footer {
    border-top: 1px solid var(--border);
    padding: 12px 16px;
    flex-shrink: 0;
    background: #fff;
  }

  /* Indicateur usine active */
  .sb-usine-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .sb-pulse {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--secondary);
    flex-shrink: 0;
    position: relative;
  }

  .sb-pulse::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2px solid var(--secondary);
    animation: pulse-ring 1.8s ease-out infinite;
    opacity: 0;
  }

  @keyframes pulse-ring {
    0%   { transform: scale(.6); opacity: .8; }
    80%  { transform: scale(1.6); opacity: 0; }
    100% { opacity: 0; }
  }

  .sb-usine-label {
    font-size: 12px; font-weight: 600;
    color: var(--text-main); flex: 1;
  }

  #sb-atelier-badge {
    font-size: 10px; font-weight: 700;
    padding: 2px 7px; border-radius: 6px;
    background: #EFF6FF; color: var(--primary);
    letter-spacing: .3px;
  }

  /* Imprévus actifs */
  .sb-imprevu-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .sb-imprevu-count {
    font-weight: 700;
    background: var(--danger);
    color: #fff;
    border-radius: 9999px;
    padding: 1px 7px;
    font-size: 11px;
    margin-left: auto;
  }

  .sb-sep { height: 1px; background: var(--border); margin: 8px 0; }

  /* Utilisateur */
  .sb-user-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sb-avatar {
    width: 30px; height: 30px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 12px; font-weight: 700;
    flex-shrink: 0;
  }

  .sb-user-name {
    font-size: 13px; font-weight: 600;
    color: var(--text-main); flex: 1;
  }

  .sb-logout-btn {
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); padding: 4px;
    border-radius: 6px;
    display: flex; align-items: center;
    transition: color .15s, background .15s;
  }

  .sb-logout-btn:hover { color: var(--danger); background: #FEF2F2; }
  .sb-logout-btn svg { width: 16px; height: 16px; }

  /* ── Topbar ── */
  #am-topbar {
    position: fixed;
    top: 0;
    left: var(--sidebar-w);
    right: 0;
    height: var(--topbar-h);
    background: #ffffff;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 20px 0 16px;
    gap: 14px;
    z-index: 100;
    transition: left 0.28s cubic-bezier(.4,0,.2,1);
  }

  /* Hamburger */
  #am-hamburger {
    display: none;
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); padding: 6px;
    border-radius: 8px;
    transition: color .15s, background .15s;
    flex-shrink: 0;
  }

  #am-hamburger:hover { background: var(--bg-main); color: var(--primary); }
  #am-hamburger svg { width: 20px; height: 20px; display: block; }

  /* Page title */
  #page-title {
    font-size: 16px; font-weight: 700;
    color: var(--text-main); flex: 1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* Topbar right cluster */
  .tb-right {
    display: flex; align-items: center; gap: 12px; flex-shrink: 0;
  }

  /* Shift badge */
  .tb-shift-badge {
    display: flex; align-items: center; gap: 6px;
    background: #ECFDF5; color: var(--secondary);
    font-size: 12px; font-weight: 600;
    padding: 4px 10px; border-radius: 999px;
    border: 1px solid #A7F3D0;
    white-space: nowrap;
  }

  .tb-shift-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--secondary);
    animation: pulse-ring 2s ease-out infinite;
  }

  /* Heure */
  #tb-clock {
    font-size: 13px; font-weight: 700;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    letter-spacing: -.2px;
  }

  /* Cloche */
  .tb-bell-btn {
    position: relative;
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); padding: 6px;
    border-radius: 8px;
    display: flex; align-items: center;
    transition: color .15s, background .15s;
  }

  .tb-bell-btn:hover { background: #FEF2F2; color: var(--danger); }
  .tb-bell-btn svg { width: 20px; height: 20px; display: block; }

  #tb-bell-badge {
    position: absolute;
    top: 2px; right: 2px;
    width: 16px; height: 16px;
    background: var(--danger);
    color: #fff;
    font-size: 9px; font-weight: 700;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #fff;
    line-height: 1;
  }

  /* ── Content area ── */
  #am-content {
    margin-left: var(--sidebar-w);
    margin-top: var(--topbar-h);
    padding: 24px;
    min-height: calc(100vh - var(--topbar-h));
    background: var(--bg-main);
    transition: margin-left 0.28s cubic-bezier(.4,0,.2,1);
  }

  /* ── Mobile overlay ── */
  #am-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.4);
    z-index: 150;
    backdrop-filter: blur(2px);
  }

  /* ── Responsive <768px ── */
  @media (max-width: 767px) {
    #am-sidebar {
      transform: translateX(-100%);
    }

    #am-sidebar.open {
      transform: translateX(0);
      box-shadow: 4px 0 24px rgba(0,0,0,.12);
    }

    #am-topbar {
      left: 0;
    }

    #am-hamburger { display: flex; }

    #am-content {
      margin-left: 0;
    }

    #am-overlay.open { display: block; }
  }
`;

// ─── Données d'état ───────────────────────────────────────────────────────────

let _imprevuCount  = 0;
let _atelierType   = 'Flow Shop';
let _clockInterval = null;

// ─── Point d'entrée ───────────────────────────────────────────────────────────

/**
 * initLayout()
 * Injecte les styles, la sidebar et la topbar dans document.body.
 * Doit être appelé une seule fois, avant tout rendu de page.
 */
export function initLayout() {
  _injectStyles();
  _buildSidebar();
  _buildTopbar();
  _buildContentArea();
  _bindEvents();
  _startClock();
}

// ─── Navigation active ────────────────────────────────────────────────────────

/**
 * setActiveNav(hash)
 * Met à jour le lien actif dans la sidebar et le titre dans la topbar.
 * @param {string} hash — ex: '#/dashboard', '#/machines'
 */
export function setActiveNav(hash) {
  // Normalise (retire query string si présente)
  const cleanHash = (hash || '#/dashboard').split('?')[0];

  // Liens sidebar
  document.querySelectorAll('.sb-link').forEach((link) => {
    const isActive = link.dataset.hash === cleanHash;
    link.classList.toggle('active', isActive);
  });

  // Titre topbar
  const titleEl   = document.getElementById('page-title');
  const found     = NAV_LINKS.flatMap((g) => g.items).find((n) => n.hash === cleanHash);
  if (titleEl) titleEl.textContent = found?.title || 'AutoMaroc Scheduling';
}

// ─── Mise à jour du badge d'imprévus ─────────────────────────────────────────

/**
 * updateImprevuBadge(count)
 * Met à jour le compteur d'imprévus actifs dans la sidebar et la topbar.
 * @param {number} count — nombre d'imprévus actifs
 */
export function updateImprevuBadge(count) {
  _imprevuCount = count;

  // Badge dans le lien "Imprévus"
  const sbBadge = document.getElementById('sb-imprevu-badge');
  if (sbBadge) {
    sbBadge.textContent = count;
    sbBadge.style.display = count > 0 ? 'flex' : 'none';
  }

  // Compteur dans le footer
  const footerCount = document.getElementById('sb-footer-imprevu-count');
  if (footerCount) {
    const row = document.getElementById('sb-footer-imprevu-row');
    if (count > 0) {
      footerCount.textContent = count;
      row?.style.setProperty('display', 'flex');
    } else {
      row?.style.setProperty('display', 'none');
    }
  }

  // Badge cloche topbar
  const bellBadge = document.getElementById('tb-bell-badge');
  if (bellBadge) {
    bellBadge.textContent = count;
    bellBadge.style.display = count > 0 ? 'flex' : 'none';
  }
}

/**
 * setAtelierType(label)
 * Met à jour le badge type atelier dans le footer sidebar.
 * @param {string} label — ex: 'Flow Shop', 'Job Shop'
 */
export function setAtelierType(label) {
  _atelierType = label;
  const badge = document.getElementById('sb-atelier-badge');
  if (badge) badge.textContent = label;
}

// ─── Builders internes ────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById('am-layout-styles')) return;
  const style = document.createElement('style');
  style.id = 'am-layout-styles';
  style.textContent = LAYOUT_STYLES;
  document.head.appendChild(style);

  // Charge Inter depuis Google Fonts si pas déjà présent
  if (!document.getElementById('am-gfont')) {
    const link = document.createElement('link');
    link.id = 'am-gfont';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }
}

function _buildSidebar() {
  const sidebar = document.createElement('aside');
  sidebar.id = 'am-sidebar';
  sidebar.setAttribute('aria-label', 'Navigation principale');

  // ── En-tête brand ──────────────────────────────────────────────────────────
  sidebar.innerHTML = `
    <div class="sb-header">
      <div class="sb-logo-icon">
        ${iconGearLogo()}
      </div>
      <div class="sb-logo-text">
        <div class="sb-name">AutoMaroc</div>
        <div class="sb-sub">Scheduling</div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="sb-nav" aria-label="Menu principal">
      ${_buildNavItems()}
    </nav>

    <!-- Footer -->
    <div class="sb-footer">
      <!-- Usine active + type atelier -->
      <div class="sb-usine-row">
        <div class="sb-pulse"></div>
        <span class="sb-usine-label">Usine active</span>
        <span id="sb-atelier-badge">${_atelierType}</span>
      </div>

      <!-- Imprévus actifs -->
      <div class="sb-imprevu-row" id="sb-footer-imprevu-row" style="display:none">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#E24B4A" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <span style="color:#E24B4A;font-size:12px">Imprévus actifs</span>
        <span class="sb-imprevu-count" id="sb-footer-imprevu-count">0</span>
      </div>

      <div class="sb-sep"></div>

      <!-- Utilisateur -->
      <div class="sb-user-row">
        <div class="sb-avatar">AD</div>
        <span class="sb-user-name">Admin</span>
        <button class="sb-logout-btn" id="btn-logout" aria-label="Déconnexion" title="Déconnexion">
          ${iconLogout()}
        </button>
      </div>
    </div>
  `;

  document.body.insertBefore(sidebar, document.body.firstChild);
}

function _buildNavItems() {
  return NAV_LINKS.map((group, gi) => {
    const sepBefore = gi > 0
      ? `<div class="sb-separator"></div>
         <div class="sb-group">
           <span class="sb-group-label">${group.group || ''}</span>
         </div>`
      : '';

    const links = group.items.map((item) => {
      const orangeCls = item.accent === 'orange' ? ' accent-orange' : '';
      const badgeHTML = item.hash === '#/imprevus'
        ? `<span class="sb-imprevu-badge" id="sb-imprevu-badge" style="display:none">0</span>`
        : '';

      return `
        <a href="${item.hash}"
           class="sb-link${orangeCls}"
           data-hash="${item.hash}"
           title="${item.title}"
           aria-label="${item.title}">
          ${item.icon}
          ${item.label}
          ${badgeHTML}
        </a>`;
    }).join('');

    // Premier groupe : pas de header de groupe
    const groupHeader = gi === 0
      ? ''
      : sepBefore;

    return groupHeader + links;
  }).join('');
}

function _buildTopbar() {
  const topbar = document.createElement('header');
  topbar.id = 'am-topbar';
  topbar.setAttribute('role', 'banner');

  topbar.innerHTML = `
    <!-- Hamburger (mobile) -->
    <button id="am-hamburger" aria-label="Ouvrir le menu" aria-expanded="false">
      ${iconMenu()}
    </button>

    <!-- Titre de page -->
    <span id="page-title">Tableau de bord</span>

    <!-- Droite -->
    <div class="tb-right">
      <!-- Badge shift -->
      <div class="tb-shift-badge" id="tb-shift-badge">
        <span class="tb-shift-dot"></span>
        Shift matin
      </div>

      <!-- Heure courante -->
      <span id="tb-clock" aria-live="polite" aria-label="Heure courante">--:--:--</span>

      <!-- Cloche notifications -->
      <button class="tb-bell-btn" id="btn-bell" aria-label="Notifications imprévus">
        ${iconBell()}
        <span id="tb-bell-badge" style="display:none">0</span>
      </button>
    </div>
  `;

  document.body.insertBefore(topbar, document.body.firstChild);
}

function _buildContentArea() {
  // S'il existe déjà un #am-content, on ne le recrée pas
  if (document.getElementById('am-content')) return;

  const content = document.createElement('main');
  content.id = 'am-content';
  content.setAttribute('role', 'main');
  document.body.appendChild(content);

  // Overlay mobile
  const overlay = document.createElement('div');
  overlay.id = 'am-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.appendChild(overlay);
}

// ─── Événements ───────────────────────────────────────────────────────────────

function _bindEvents() {
  // Hamburger → toggle sidebar
  document.getElementById('am-hamburger')?.addEventListener('click', _toggleSidebar);

  // Overlay → ferme sidebar
  document.getElementById('am-overlay')?.addEventListener('click', _closeSidebar);

  // Clic sur lien → ferme sidebar sur mobile
  document.querySelectorAll('.sb-link').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) _closeSidebar();
    });
  });

  // Cloche → navigue vers imprévus
  document.getElementById('btn-bell')?.addEventListener('click', () => {
    window.location.hash = '#/imprevus';
  });

  // Bouton déconnexion
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (window.confirm('Déconnecter l\'administrateur ?')) {
      // Hook personnalisable
      window.dispatchEvent(new CustomEvent('am:logout'));
    }
  });

  // Resize → réinitialise sidebar en desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) _closeSidebar();
  });
}

function _toggleSidebar() {
  const sidebar  = document.getElementById('am-sidebar');
  const overlay  = document.getElementById('am-overlay');
  const btn      = document.getElementById('am-hamburger');
  const isOpen   = sidebar.classList.contains('open');

  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
  btn?.setAttribute('aria-expanded', String(!isOpen));
}

function _closeSidebar() {
  const sidebar = document.getElementById('am-sidebar');
  const overlay = document.getElementById('am-overlay');
  const btn     = document.getElementById('am-hamburger');

  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  btn?.setAttribute('aria-expanded', 'false');
}

// ─── Horloge topbar ───────────────────────────────────────────────────────────

function _startClock() {
  if (_clockInterval) clearInterval(_clockInterval);

  function tick() {
    const el = document.getElementById('tb-clock');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('fr-MA', { hour12: false });

    // Met à jour le badge shift selon l'heure
    const h = now.getHours();
    const shiftEl = document.getElementById('tb-shift-badge');
    if (shiftEl) {
      const isNuit  = h >= 22 || h < 6;
      const isSoir  = h >= 14 && h < 22;
      const label   = isNuit ? 'Shift nuit' : isSoir ? 'Shift soir' : 'Shift matin';
      const dot     = shiftEl.querySelector('.tb-shift-dot');
      if (dot) dot.style.background = isNuit ? '#6b7280' : isSoir ? '#f97316' : 'var(--secondary)';
      // Met à jour seulement le texte (pas le svg)
      const textNode = [...shiftEl.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = ' ' + label;
      else shiftEl.lastChild.textContent = ' ' + label;
    }
  }

  tick();
  _clockInterval = setInterval(tick, 1000);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function svgIcon(path, extra = '') {
  return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${path}</svg>`;
}

// Logo (engrenage — brand sidebar)
function iconGearLogo() {
  return `<svg fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="1.7" width="20" height="20">
    <path stroke-linecap="round" stroke-linejoin="round"
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>`;
}

// Dashboard — grille 2x2
function iconGrid() {
  return svgIcon(`<rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>`);
}

// Machines — engrenage
function iconGear() {
  return svgIcon(`<path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`);
}

// Jobs — liste avec puces
function iconList() {
  return svgIcon(`<line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>`);
}

// Opérations — lien chaîne
function iconLink() {
  return svgIcon(`<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>`);
}

// Scheduling — bouton play
function iconPlay() {
  return svgIcon(`<circle cx="12" cy="12" r="9"/>
    <polygon points="10,8 16,12 10,16"/>`);
}

// Gantt — barres horizontales
function iconBars() {
  return svgIcon(`<line x1="3" y1="6" x2="14" y2="6"/>
    <line x1="3" y1="12" x2="19" y2="12"/>
    <line x1="3" y1="18" x2="11" y2="18"/>
    <line x1="17" y1="6" x2="21" y2="6"/>
    <line x1="22" y1="12" x2="22" y2="12"/>
    <line x1="15" y1="18" x2="21" y2="18"/>`);
}

// Comparaison — balance
function iconBalance() {
  return svgIcon(`<path d="M12 3v18M3 9h18M8 3l-5 6h18l-5-6"/>
    <line x1="3" y1="15" x2="8" y2="21"/>
    <line x1="21" y1="15" x2="16" y2="21"/>`);
}

// Imprévus — triangle alerte orange
function iconAlert() {
  return svgIcon(`<path stroke="#F97316" fill="none"
    d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line stroke="#F97316" x1="12" y1="9" x2="12" y2="13"/>
    <line stroke="#F97316" x1="12" y1="17" x2="12.01" y2="17"/>`);
}

// Historique — graphe courbe
function iconGraph() {
  return svgIcon(`<polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>`);
}

// Menu hamburger
function iconMenu() {
  return svgIcon(`<line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>`);
}

// Cloche
function iconBell() {
  return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="20" height="20">
    <path stroke-linecap="round" stroke-linejoin="round"
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
  </svg>`;
}

// Déconnexion
function iconLogout() {
  return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="16" height="16">
    <path stroke-linecap="round" stroke-linejoin="round"
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
  </svg>`;
}
