/**
 * router.js — Routeur SPA hash-based
 *
 * Chaque page est un module independant qui exporte render(container).
 * Ajouter une nouvelle page = 1 ligne dans ROUTES, aucun autre changement.
 *
 * Fonctionnalites :
 *   - NProgress-style top progress bar
 *   - Transitions fadeOut 100ms + fadeIn 150ms
 *   - Titres dynamiques "[Page] - AutoMaroc Scheduling"
 *   - Page 404 avec SVG robot
 *   - Raccourcis clavier : Alt+D/M/J/S/G/I, Escape
 */

import { setActiveNav } from './components/layout.js';
import { setState }     from './utils/state.js';

// ─── Route registry ───────────────────────────────────────────────────────────

const ROUTES = {
  '/dashboard':  () => import('./pages/dashboard.js'),
  '/machines':   () => import('./pages/machines.js'),
  '/jobs':       () => import('./pages/jobs.js'),
  '/operations': () => import('./pages/operations.js'),
  '/scheduling': () => import('./pages/scheduling.js'),
  '/gantt':      () => import('./pages/gantt.js'),
  '/comparison': () => import('./pages/comparison.js'),
  '/imprevus':   () => import('./pages/imprevus.js'),
  '/historique': () => import('./pages/historique.js'),
};

const PAGE_TITLES = {
  '/dashboard':  'Tableau de bord',
  '/machines':   'Machines',
  '/jobs':       'Jobs de production',
  '/operations': 'Operations',
  '/scheduling': 'Ordonnancement',
  '/gantt':      'Diagramme de Gantt',
  '/comparison': "Comparaison d'algorithmes",
  '/imprevus':   'Imprevus & Perturbations',
  '/historique': 'Historique des machines',
};

const APP_NAME      = 'AutoMaroc Scheduling';
const DEFAULT_ROUTE = '/dashboard';

// ─── Cache des modules charges ────────────────────────────────────────────────
const _moduleCache = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
//  BARRE DE PROGRESSION (NProgress-style)
// ═══════════════════════════════════════════════════════════════════════════════

let _progressEl    = null;
let _progressTimer = null;

function _ensureProgressBar() {
  if (_progressEl) return;

  if (!document.getElementById('am-nprog-css')) {
    const s = document.createElement('style');
    s.id    = 'am-nprog-css';
    s.textContent = `
      #am-nprogress {
        pointer-events:none;
        position:fixed;top:0;left:0;right:0;height:3px;z-index:99999;
        background:linear-gradient(90deg,#378ADD,#60B8FF 50%,#378ADD);
        background-size:200% 100%;
        transform:scaleX(0);transform-origin:left center;
        border-radius:0 2px 2px 0;
        opacity:0;
        transition:transform .2s ease,opacity .2s ease;
      }
      #am-nprogress.np-act { opacity:1; animation:np-sh 1.4s ease-in-out infinite; }
      #am-nprogress.np-done{ opacity:0; transform:scaleX(1)!important;
                              transition:transform .12s ease,opacity .3s ease .05s!important;
                              animation:none!important; }
      @keyframes np-sh{0%,100%{background-position:0 0}50%{background-position:-200% 0}}
      @keyframes am-spin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(s);
  }

  _progressEl    = document.createElement('div');
  _progressEl.id = 'am-nprogress';
  document.body.prepend(_progressEl);
}

function _progressStart() {
  _ensureProgressBar();
  clearTimeout(_progressTimer);
  _progressEl.className            = '';
  void _progressEl.offsetWidth;
  _progressEl.style.transform      = 'scaleX(0.28)';
  _progressEl.classList.add('np-act');
}

function _progressDone() {
  if (!_progressEl) return;
  _progressEl.classList.replace('np-act', 'np-done');
  _progressEl.style.transform = 'scaleX(1)';
  clearTimeout(_progressTimer);
  _progressTimer = setTimeout(() => {
    _progressEl.className       = '';
    _progressEl.style.transform = 'scaleX(0)';
  }, 400);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSITIONS DE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function _fadeOut(el, ms) {
  return new Promise(resolve => {
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity    = '0';
    setTimeout(resolve, ms);
  });
}

function _fadeIn(el, ms) {
  el.style.opacity    = '0';
  el.style.transition = 'none';
  void el.offsetWidth;
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity    = '1';
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE 404
// ═══════════════════════════════════════════════════════════════════════════════

function _render404(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                min-height:68vh;text-align:center;gap:20px;padding:40px 20px;">

      <svg width="130" height="116" viewBox="0 0 130 116" fill="none" style="margin-bottom:8px">
        <rect x="30" y="44" width="70" height="54" rx="12" fill="#F3F4F6" stroke="#E5E7EB" stroke-width="1.5"/>
        <rect x="38" y="18" width="54" height="32" rx="10" fill="#E5E7EB" stroke="#D1D5DB" stroke-width="1.5"/>
        <line x1="65" y1="18" x2="65" y2="7" stroke="#D1D5DB" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="65" cy="5" r="4" fill="#378ADD"/>
        <circle cx="52" cy="32" r="6" fill="#fff" stroke="#D1D5DB" stroke-width="1.2"/>
        <circle cx="78" cy="32" r="6" fill="#fff" stroke="#D1D5DB" stroke-width="1.2"/>
        <line x1="48" y1="28" x2="56" y2="36" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
        <line x1="56" y1="28" x2="48" y2="36" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
        <line x1="74" y1="28" x2="82" y2="36" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
        <line x1="82" y1="28" x2="74" y2="36" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
        <path d="M54 58 Q65 53 76 58" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" fill="none"/>
        <rect x="8" y="50" width="22" height="10" rx="5" fill="#E5E7EB" stroke="#D1D5DB" stroke-width="1.2"/>
        <rect x="100" y="50" width="22" height="10" rx="5" fill="#E5E7EB" stroke="#D1D5DB" stroke-width="1.2"/>
        <rect x="40" y="94" width="16" height="16" rx="4" fill="#E5E7EB" stroke="#D1D5DB" stroke-width="1.2"/>
        <rect x="74" y="94" width="16" height="16" rx="4" fill="#E5E7EB" stroke="#D1D5DB" stroke-width="1.2"/>
        <text x="65" y="77" text-anchor="middle" font-size="14" font-weight="800"
              fill="#9CA3AF" font-family="monospace">404</text>
      </svg>

      <div>
        <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 8px;
                   font-family:Inter,system-ui,sans-serif">
          Page introuvable
        </h2>
        <p style="font-size:14px;color:#6B7280;margin:0;max-width:300px;line-height:1.65;
                  font-family:Inter,system-ui,sans-serif">
          Cette page n'existe pas ou a ete deplacee. Utilisez la navigation laterale.
        </p>
      </div>

      <a href="#/dashboard" style="
        display:inline-flex;align-items:center;gap:8px;padding:10px 22px;
        background:#378ADD;color:#fff;border-radius:10px;font-size:14px;font-weight:600;
        text-decoration:none;box-shadow:0 2px 10px rgba(55,138,221,.35);
        font-family:Inter,system-ui,sans-serif;">
        Retour au tableau de bord
      </a>

      <p style="font-size:12px;color:#9CA3AF;font-family:Inter,system-ui,sans-serif;margin:0">
        Raccourci : <kbd style="background:#F3F4F6;border:1px solid #E5E7EB;
                               border-radius:4px;padding:1px 5px;font-size:11px">Alt+D</kbd>
      </p>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

async function navigate(hash) {
  const route  = hash.replace(/^#/, '') || DEFAULT_ROUTE;
  const loader = ROUTES[route];

  const container = document.getElementById('am-content');
  if (!container) return;

  // Titre dynamique
  document.title = `${PAGE_TITLES[route] || APP_NAME} -- ${APP_NAME}`;

  setState('currentRoute', route);
  setActiveNav(route);

  // 404
  if (!loader) {
    _progressStart();
    if (container.children.length) await _fadeOut(container, 80);
    _render404(container);
    _fadeIn(container, 150);
    _progressDone();
    return;
  }

  _progressStart();
  if (container.children.length) await _fadeOut(container, 100);

  // Skeleton de chargement
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:200px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
        <div style="width:28px;height:28px;border-radius:50%;
                    border:3px solid #E5E7EB;border-top-color:#378ADD;
                    animation:am-spin .65s linear infinite"></div>
        <p style="font-size:13px;color:#9CA3AF;font-weight:500;
                  font-family:Inter,system-ui,sans-serif">Chargement...</p>
      </div>
    </div>`;

  try {
    let mod = _moduleCache.get(route);
    if (!mod) {
      mod = await loader();
      _moduleCache.set(route, mod);
    }

    container.innerHTML = '';
    const wrapper = document.createElement('div');

    // IMPORTANT : wrapper ajoute au DOM AVANT render() pour que getElementById()
    // fonctionne pendant le rendu asynchrone (Canvas, Chart.js, etc.)
    container.appendChild(wrapper);
    await mod.render(wrapper);

    _fadeIn(container, 150);
    container.scrollTo({ top: 0, behavior: 'instant' });

  } catch (err) {
    console.error('[Router] Erreur de chargement :', route, err);
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  min-height:200px;gap:16px;text-align:center;padding:40px 20px">
        <div style="width:52px;height:52px;border-radius:50%;background:#FEF2F2;
                    display:flex;align-items:center;justify-content:center">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#EF4444" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div>
          <p style="font-weight:600;color:#111827;font-family:Inter,system-ui,sans-serif">
            Erreur de chargement
          </p>
          <p style="font-size:13px;color:#6B7280;margin-top:4px">${err.message || 'Module introuvable'}</p>
        </div>
        <a href="#${DEFAULT_ROUTE}" style="
          padding:8px 18px;background:#378ADD;color:#fff;border-radius:10px;
          font-size:13px;font-weight:600;text-decoration:none">
          Retour au tableau de bord
        </a>
      </div>`;
    _fadeIn(container, 150);
  } finally {
    _progressDone();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RACCOURCIS CLAVIER
// ═══════════════════════════════════════════════════════════════════════════════

const SHORTCUTS = { d:'#/dashboard', m:'#/machines', j:'#/jobs',
                    s:'#/scheduling', g:'#/gantt', i:'#/imprevus' };

function _initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Ignorer si focus dans un champ de saisie
    const tag = document.activeElement?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const target = SHORTCUTS[e.key.toLowerCase()];
      if (target) { e.preventDefault(); window.location.hash = target; return; }
    }

    if (e.key === 'Escape') {
      for (const sel of ['#am-confirm-overlay','#am-modal-overlay','[data-modal-overlay]']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const btn = el.querySelector('[data-modal-close],#cfm-cancel,.modal-close,[aria-label="Fermer"]');
        if (btn) { btn.click(); return; }
        el.click(); return;
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════

export function initRouter() {
  _initKeyboardShortcuts();
  window.addEventListener('hashchange', () => navigate(window.location.hash));
  navigate(window.location.hash || ('#' + DEFAULT_ROUTE));
}

export function navigateTo(route) {
  window.location.hash = route;
}
