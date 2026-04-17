/**
 * toast.js — Système de notifications toast
 *
 * Usage :
 *   import { toast } from './toast.js';
 *
 *   toast.success('Machine créée avec succès');
 *   toast.error('Erreur de connexion au serveur');
 *   toast.info('Synchronisation en cours…');
 *   toast.warning('Champ non rempli', 6000);
 *
 *   // OU directement :
 *   import { showToast } from './toast.js';
 *   showToast('Message', 'success', 4000);
 *
 * Config :
 *   - Types    : success | error | info | warning
 *   - Max      : 3 toasts simultanés (le plus ancien est retiré)
 *   - Duration : 4000ms par défaut, 0 = permanent
 *   - Pile     : coin haut-droite (z-index 9999)
 *   - Animation: slide-in depuis droite + fade-out avant disparition
 */

// ─── Palette par type ─────────────────────────────────────────────────────────

const TYPES = {
  success: {
    bg:     '#1A3F12',
    accent: '#639922',
    label:  'Succès',
    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" width="18" height="18">
             <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
           </svg>`,
  },
  error: {
    bg:     '#3B0F0F',
    accent: '#E24B4A',
    label:  'Erreur',
    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" width="18" height="18">
             <path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
           </svg>`,
  },
  info: {
    bg:     '#0C1F38',
    accent: '#378ADD',
    label:  'Info',
    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" width="18" height="18">
             <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
           </svg>`,
  },
  warning: {
    bg:     '#2E1F06',
    accent: '#BA7517',
    label:  'Attention',
    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" width="18" height="18">
             <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
           </svg>`,
  },
};

const MAX_TOASTS = 3;

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  #am-toast-stack {
    position: fixed;
    top: 20px; right: 20px;
    z-index: 9999;
    display: flex; flex-direction: column; gap: 10px;
    pointer-events: none;
    width: 340px;
    max-width: calc(100vw - 32px);
  }

  .am-toast {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 13px 15px;
    border-radius: 12px;
    pointer-events: auto;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(0,0,0,.28), 0 1px 6px rgba(0,0,0,.14);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13.5px;
    line-height: 1.4;
    color: #fff;
    position: relative;
    overflow: hidden;
    transform: translateX(110%);
    opacity: 0;
    transition: transform .32s cubic-bezier(.34,1.24,.64,1), opacity .22s ease;
    will-change: transform, opacity;
  }

  .am-toast.in {
    transform: translateX(0);
    opacity: 1;
  }

  .am-toast.out {
    transform: translateX(110%);
    opacity: 0;
    transition: transform .25s ease-in, opacity .2s ease-in;
  }

  /* Barre de progression */
  .am-toast-progress {
    position: absolute;
    bottom: 0; left: 0;
    height: 3px;
    border-radius: 0 0 12px 12px;
    transform-origin: left;
    animation: toast-progress linear forwards;
  }
  @keyframes toast-progress {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }

  /* Icône */
  .am-toast-icon {
    flex-shrink: 0;
    width: 32px; height: 32px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
  }

  /* Contenu texte */
  .am-toast-content { flex: 1; min-width: 0; }
  .am-toast-type    { font-size: 11px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; opacity: .7; margin-bottom: 2px; }
  .am-toast-msg     { font-weight: 500; word-break: break-word; }

  /* Bouton fermeture */
  .am-toast-close {
    flex-shrink: 0; margin-top: 1px;
    background: transparent; border: none; cursor: pointer;
    color: rgba(255,255,255,.55);
    padding: 2px; border-radius: 4px;
    font-size: 16px; line-height: 1;
    transition: color .15s;
  }
  .am-toast-close:hover { color: rgba(255,255,255,.9); }
`;

function injectStyles() {
  if (document.getElementById('am-toast-styles')) return;
  const s = document.createElement('style');
  s.id = 'am-toast-styles';
  s.textContent = STYLES;
  document.head.appendChild(s);
}

// ─── Stack interne ────────────────────────────────────────────────────────────

let _stack   = null;
const _active = [];   // { el, dismiss }

function getStack() {
  if (!_stack) {
    _stack = document.createElement('div');
    _stack.id = 'am-toast-stack';
    document.body.appendChild(_stack);
  }
  return _stack;
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * showToast(message, type?, duration?)
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} [type='info']
 * @param {number}  [duration=4000]  0 = permanent
 */
export function showToast(message, type = 'info', duration = 4000) {
  injectStyles();
  const stack = getStack();
  const cfg   = TYPES[type] || TYPES.info;

  // Retire le plus ancien si déjà 3 toasts
  if (_active.length >= MAX_TOASTS) {
    _active[0].dismiss();
  }

  // ── Élément ──────────────────────────────────────────────────────────────
  const el = document.createElement('div');
  el.className = 'am-toast';
  el.setAttribute('role', 'alert');
  el.style.background = cfg.bg;

  el.innerHTML = `
    <!-- Icône -->
    <div class="am-toast-icon" style="background:${cfg.accent}22; color:${cfg.accent}">
      ${cfg.icon}
    </div>

    <!-- Texte -->
    <div class="am-toast-content">
      <div class="am-toast-type" style="color:${cfg.accent}">${cfg.label}</div>
      <div class="am-toast-msg">${message}</div>
    </div>

    <!-- Fermeture -->
    <button class="am-toast-close" aria-label="Fermer">×</button>

    <!-- Barre de progression -->
    ${duration > 0 ? `<div class="am-toast-progress"
        style="background:${cfg.accent};animation-duration:${duration}ms"></div>` : ''}
  `;

  stack.appendChild(el);

  // ── Dismiss ──────────────────────────────────────────────────────────────
  let dismissed = false;
  let autoTimer = null;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(autoTimer);

    el.classList.remove('in');
    el.classList.add('out');

    setTimeout(() => {
      el.remove();
      const i = _active.findIndex((t) => t.el === el);
      if (i !== -1) _active.splice(i, 1);
    }, 280);
  }

  // Clic sur le toast ou le × → dismiss
  el.addEventListener('click', dismiss);

  // Animation d'entrée (next-frame)
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));

  // Auto-dismiss
  if (duration > 0) {
    autoTimer = setTimeout(dismiss, duration);
  }

  _active.push({ el, dismiss });
}

// ─── Raccourcis typés ─────────────────────────────────────────────────────────

/**
 * Objet utilitaire avec méthodes nommées.
 * import { toast } from './toast.js';
 * toast.success('…');
 */
export const toast = {
  success: (msg, d) => showToast(msg, 'success', d),
  error:   (msg, d) => showToast(msg, 'error',   d),
  info:    (msg, d) => showToast(msg, 'info',    d),
  warning: (msg, d) => showToast(msg, 'warning', d),
};

export default toast;
