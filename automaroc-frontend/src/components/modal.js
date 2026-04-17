/**
 * modal.js — Composant modale générique
 *
 * Usage :
 *   import { openModal, closeModal, confirmModal } from './modal.js';
 *
 *   openModal({
 *     title:        'Modifier la machine',
 *     size:         'md',           // 'sm' | 'md' | 'lg'
 *     content:      '<form>…</form>',  // HTML string ou HTMLElement
 *     confirmLabel: 'Enregistrer',
 *     cancelLabel:  'Annuler',
 *     onConfirm:    () => { … },
 *     onClose:      () => { … },     // appelé à chaque fermeture
 *     danger:       false,           // bouton confirm rouge
 *   });
 *
 *   closeModal();   // ferme la modale courante
 *
 *   confirmModal({ title, message, confirmLabel, danger, onConfirm });
 *   // → modale pré-formatée "êtes-vous sûr ?"
 */

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  /* Overlay */
  #am-modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(17,24,39,.45);
    backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    opacity: 0;
    transition: opacity .22s ease;
  }
  #am-modal-overlay.open { opacity: 1; }

  /* Modale */
  .am-modal {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,.18), 0 4px 16px rgba(0,0,0,.08);
    width: 100%;
    max-height: calc(100vh - 48px);
    display: flex; flex-direction: column;
    transform: scale(.95) translateY(12px);
    transition: transform .22s cubic-bezier(.34,1.56,.64,1), opacity .22s ease;
    opacity: 0;
    overflow: hidden;
    font-family: 'Inter', system-ui, sans-serif;
  }
  #am-modal-overlay.open .am-modal {
    transform: scale(1) translateY(0);
    opacity: 1;
  }

  /* Sizes */
  .am-modal.sm { max-width: 400px; }
  .am-modal.md { max-width: 560px; }
  .am-modal.lg { max-width: 720px; }

  /* Header */
  .am-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 20px 16px;
    border-bottom: 1px solid #f3f4f6;
    flex-shrink: 0;
  }
  .am-modal-title {
    font-size: 16px; font-weight: 700; color: #111827;
    margin: 0; line-height: 1.3;
  }
  .am-modal-close {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px;
    border: none; background: transparent; cursor: pointer;
    border-radius: 8px; color: #9ca3af;
    transition: color .15s, background .15s;
    flex-shrink: 0;
  }
  .am-modal-close:hover { color: #111827; background: #F3F4F6; }
  .am-modal-close svg  { width: 18px; height: 18px; display: block; }

  /* Body */
  .am-modal-body {
    flex: 1; overflow-y: auto;
    padding: 20px;
    scrollbar-width: thin;
    scrollbar-color: #e5e7eb transparent;
  }
  .am-modal-body::-webkit-scrollbar { width: 4px; }
  .am-modal-body::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }

  /* Footer */
  .am-modal-footer {
    display: flex; align-items: center; justify-content: flex-end; gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid #f3f4f6;
    background: #FAFAFA;
    flex-shrink: 0;
  }

  /* Boutons footer */
  .am-modal-btn {
    padding: 8px 18px;
    border-radius: 10px;
    font-size: 14px; font-weight: 600;
    cursor: pointer; border: none;
    transition: filter .15s, transform .1s;
    font-family: inherit;
    line-height: 1.4;
  }
  .am-modal-btn:active { transform: scale(.97); }
  .am-modal-btn.cancel {
    background: #F3F4F6; color: #374151;
  }
  .am-modal-btn.cancel:hover { background: #E5E7EB; }
  .am-modal-btn.confirm {
    background: #378ADD; color: #fff;
  }
  .am-modal-btn.confirm:hover { filter: brightness(1.08); }
  .am-modal-btn.confirm.danger {
    background: #E24B4A;
  }

  /* ── Mobile : bottom sheet < 640px ── */
  @media (max-width: 639px) {
    #am-modal-overlay {
      align-items: flex-end;
      padding: 0;
    }
    .am-modal {
      max-width: 100% !important;
      width: 100%;
      border-radius: 20px 20px 0 0;
      max-height: 90vh;
      transform: translateY(100%);
    }
    #am-modal-overlay.open .am-modal {
      transform: translateY(0);
    }
  }
`;

function injectStyles() {
  if (document.getElementById('am-modal-styles')) return;
  const s = document.createElement('style');
  s.id = 'am-modal-styles';
  s.textContent = STYLES;
  document.head.appendChild(s);
}

// ─── État interne ─────────────────────────────────────────────────────────────

let _overlay    = null;
let _onCloseCb  = null;
let _onConfirmCb= null;
let _keyHandler = null;

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * openModal(config)
 * @param {{
 *   title?:        string,
 *   size?:         'sm'|'md'|'lg',
 *   content:       string | HTMLElement,
 *   confirmLabel?: string,
 *   cancelLabel?:  string,
 *   onConfirm?:    () => void,
 *   onClose?:      () => void,
 *   danger?:       boolean,
 *   hideFooter?:   boolean,
 * }} config
 */
export function openModal(config = {}) {
  injectStyles();
  closeModal();   // ferme toute modale existante

  const {
    title        = '',
    size         = 'md',
    content      = '',
    confirmLabel = 'Confirmer',
    cancelLabel  = 'Annuler',
    onConfirm    = null,
    onClose      = null,
    danger       = false,
    hideFooter   = false,
  } = config;

  _onCloseCb   = onClose;
  _onConfirmCb = onConfirm;

  // ── Overlay ────────────────────────────────────────────────────────────────
  _overlay = document.createElement('div');
  _overlay.id = 'am-modal-overlay';

  // ── Modale ─────────────────────────────────────────────────────────────────
  const modal = document.createElement('div');
  modal.className = `am-modal ${size}`;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', title || 'Fenêtre de dialogue');

  // Header
  const header = document.createElement('div');
  header.className = 'am-modal-header';
  header.innerHTML = `
    <h2 class="am-modal-title">${title}</h2>
    <button class="am-modal-close" id="am-modal-close-btn" aria-label="Fermer">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;
  modal.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'am-modal-body';
  if (content instanceof HTMLElement) {
    body.appendChild(content);
  } else {
    body.innerHTML = content;
  }
  modal.appendChild(body);

  // Footer
  if (!hideFooter) {
    const footer = document.createElement('div');
    footer.className = 'am-modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'am-modal-btn cancel';
    cancelBtn.textContent = cancelLabel;
    cancelBtn.addEventListener('click', closeModal);
    footer.appendChild(cancelBtn);

    if (onConfirm) {
      const confirmBtn = document.createElement('button');
      confirmBtn.className = `am-modal-btn confirm${danger ? ' danger' : ''}`;
      confirmBtn.textContent = confirmLabel;
      confirmBtn.addEventListener('click', () => {
        if (_onConfirmCb) _onConfirmCb();
      });
      footer.appendChild(confirmBtn);
    }

    modal.appendChild(footer);
  }

  // ── Assemblage ─────────────────────────────────────────────────────────────
  _overlay.appendChild(modal);
  document.body.appendChild(_overlay);

  // Empêche le scroll du body
  document.body.style.overflow = 'hidden';

  // Animation d'ouverture (next frame pour la transition CSS)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => _overlay.classList.add('open'));
  });

  // Fermeture clic overlay (mais pas clic sur la modale elle-même)
  _overlay.addEventListener('click', (e) => {
    if (e.target === _overlay) closeModal();
  });

  // Fermeture bouton ×
  modal.querySelector('#am-modal-close-btn')?.addEventListener('click', closeModal);

  // Fermeture Escape
  _keyHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  window.addEventListener('keydown', _keyHandler);

  // Focus trap — focus sur le premier input si disponible
  setTimeout(() => {
    const first = modal.querySelector('input, textarea, select, button:not(.am-modal-close)');
    first?.focus();
  }, 250);
}

/**
 * closeModal()
 * Ferme la modale courante avec animation.
 */
export function closeModal() {
  if (!_overlay) return;

  _overlay.classList.remove('open');

  if (_keyHandler) {
    window.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }

  const cb = _onCloseCb;
  _onCloseCb   = null;
  _onConfirmCb = null;

  setTimeout(() => {
    _overlay?.remove();
    _overlay = null;
    document.body.style.overflow = '';
    cb?.();
  }, 240);
}

/**
 * confirmModal(config)
 * Modale pré-formatée "êtes-vous sûr ?"
 *
 * @param {{
 *   title?:        string,
 *   message?:      string,
 *   confirmLabel?: string,
 *   cancelLabel?:  string,
 *   danger?:       boolean,
 *   onConfirm:     () => void,
 *   onClose?:      () => void,
 * }} config
 */
export function confirmModal({
  title        = 'Confirmer l\'action',
  message      = 'Êtes-vous sûr de vouloir continuer ?',
  confirmLabel = 'Confirmer',
  cancelLabel  = 'Annuler',
  danger       = true,
  onConfirm,
  onClose,
}) {
  const icon = danger
    ? `<svg width="44" height="44" fill="none" viewBox="0 0 24 24" stroke="#E24B4A" stroke-width="1.5">
         <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
       </svg>`
    : `<svg width="44" height="44" fill="none" viewBox="0 0 24 24" stroke="#378ADD" stroke-width="1.5">
         <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
       </svg>`;

  openModal({
    title,
    size: 'sm',
    content: `
      <div style="text-align:center; padding: 8px 0 4px;">
        <div style="display:flex;justify-content:center;margin-bottom:14px">${icon}</div>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0">${message}</p>
      </div>`,
    confirmLabel,
    cancelLabel,
    danger,
    onConfirm,
    onClose,
  });
}
