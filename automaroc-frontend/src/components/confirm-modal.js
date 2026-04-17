/**
 * confirm-modal.js — Modal de confirmation de suppression
 *
 * Usage :
 *   import { confirmDelete } from './confirm-modal.js';
 *   confirmDelete({
 *     title:     'Supprimer la machine ?',
 *     message:   'Cette action est irréversible.',
 *     itemName:  'PRESS-01',
 *     onConfirm: async () => { await machinesApi.delete(id); },
 *   });
 */

// ─── Styles (injectés une seule fois) ────────────────────────────────────────

const CONFIRM_STYLES = `
  #am-confirm-overlay {
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(17,24,39,.55);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: cfm-fadein .2s ease;
  }

  @keyframes cfm-fadein {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  #am-confirm-box {
    background: #fff;
    border-radius: 20px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 20px 60px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.04);
    animation: cfm-slidein .25s cubic-bezier(.34,1.56,.64,1);
    overflow: hidden;
  }

  @keyframes cfm-slidein {
    from { transform: translateY(20px) scale(.97); opacity: 0; }
    to   { transform: translateY(0)  scale(1);    opacity: 1; }
  }

  @keyframes cfm-shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-8px); }
    40%       { transform: translateX(8px); }
    60%       { transform: translateX(-6px); }
    80%       { transform: translateX(6px); }
  }

  #am-confirm-box.shake {
    animation: cfm-shake .35s ease;
  }

  /* Mobile : bottom sheet */
  @media (max-width: 600px) {
    #am-confirm-overlay { align-items: flex-end; padding: 0; }
    #am-confirm-box {
      max-width: 100%;
      border-radius: 24px 24px 0 0;
      animation: cfm-slideup .28s cubic-bezier(.4,0,.2,1);
    }
    @keyframes cfm-slideup {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
  }
`;

function injectConfirmStyles() {
  if (document.getElementById('am-confirm-styles')) return;
  const s = document.createElement('style');
  s.id = 'am-confirm-styles';
  s.textContent = CONFIRM_STYLES;
  document.head.appendChild(s);
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * confirmDelete(config)
 * @param {{
 *   title?:      string,
 *   message?:    string,
 *   itemName:    string,   — code ou nom à taper pour valider
 *   onConfirm:   function, — appelé quand confirmé (peut être async)
 *   onCancel?:   function,
 *   requireType?: boolean, — true = doit taper itemName, false = simple bouton
 * }} config
 */
export function confirmDelete(config) {
  injectConfirmStyles();

  const {
    title       = `Supprimer "${config.itemName}" ?`,
    message     = 'Cette action est définitive et ne peut pas être annulée.',
    itemName    = '',
    onConfirm,
    onCancel,
    requireType = true,
  } = config;

  // Nettoyage préventif
  document.getElementById('am-confirm-overlay')?.remove();

  // ── Construction du DOM ──────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id    = 'am-confirm-overlay';
  overlay.setAttribute('role',         'dialog');
  overlay.setAttribute('aria-modal',   'true');
  overlay.setAttribute('aria-labelledby', 'cfm-title');

  overlay.innerHTML = `
    <div id="am-confirm-box">

      <!-- ICÔNE + EN-TÊTE -->
      <div class="cfm-header" style="
        padding: 28px 24px 0;
        display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px;">

        <!-- Icône poubelle -->
        <div style="
          width:64px; height:64px; border-radius:50%;
          background:#FEF2F2; display:flex; align-items:center; justify-content:center;
          border: 2px solid #FECACA; flex-shrink:0;">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#EF4444" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6
                 m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </div>

        <!-- Titre -->
        <div>
          <h3 id="cfm-title" style="
            font-size:17px; font-weight:700; color:#111827;
            margin:0 0 6px; font-family:Inter,system-ui,sans-serif;">
            ${escHtml(title)}
          </h3>
          <p style="font-size:13.5px; color:#6B7280; margin:0; line-height:1.5;">
            ${escHtml(message)}
          </p>
        </div>
      </div>

      <!-- CORPS -->
      <div style="padding:20px 24px 24px;">

        ${requireType && itemName ? `
          <!-- Champ confirmation -->
          <div style="
            background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px;
            padding:12px 16px; margin-bottom:20px;">
            <p style="
              font-size:12px; color:#6B7280; margin:0 0 8px;
              font-family:Inter,system-ui,sans-serif;">
              Tapez <strong style="color:#111827; font-family:monospace;">${escHtml(itemName)}</strong>
              pour confirmer :
            </p>
            <input
              id="cfm-input"
              type="text"
              autocomplete="off"
              placeholder="${escHtml(itemName)}"
              style="
                width:100%; padding:10px 12px; border:1.5px solid #E5E7EB;
                border-radius:8px; font-size:14px; font-family:monospace;
                outline:none; transition:border-color .15s, box-shadow .15s;
                color:#111827; background:#fff; box-sizing:border-box;"
              aria-label="Confirmer le nom">
          </div>
        ` : ''}

        <!-- BOUTONS -->
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="cfm-cancel" style="
            padding:10px 20px; border-radius:10px;
            border:1.5px solid #E5E7EB; background:#fff;
            font-size:14px; font-weight:600; color:#374151;
            cursor:pointer; font-family:Inter,system-ui,sans-serif;
            transition:background .15s, border-color .15s;">
            Annuler
          </button>
          <button id="cfm-confirm" ${requireType && itemName ? 'disabled' : ''} style="
            padding:10px 20px; border-radius:10px;
            border:none; background:#DC2626; color:#fff;
            font-size:14px; font-weight:600;
            cursor:pointer; font-family:Inter,system-ui,sans-serif;
            opacity:${requireType && itemName ? '.45' : '1'};
            transition:background .15s, opacity .15s;
            display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7"/>
            </svg>
            Supprimer
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // ── Références ───────────────────────────────────────────────────────────
  const box       = document.getElementById('am-confirm-box');
  const cancelBtn = document.getElementById('cfm-cancel');
  const confirmBtn= document.getElementById('cfm-confirm');
  const input     = document.getElementById('cfm-input');

  // Focus
  setTimeout(() => (input ?? confirmBtn)?.focus(), 60);

  // ── Validation de l'input ────────────────────────────────────────────────
  if (input && requireType) {
    input.addEventListener('input', () => {
      const ok = input.value.trim() === itemName.trim();
      confirmBtn.disabled = !ok;
      confirmBtn.style.opacity = ok ? '1' : '.45';
      confirmBtn.style.cursor  = ok ? 'pointer' : 'not-allowed';

      // Focus ring
      input.style.borderColor = ok ? '#1D9E75' : '#E5E7EB';
      input.style.boxShadow   = ok ? '0 0 0 3px rgba(29,158,117,.15)' : 'none';
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (input.value.trim() !== itemName.trim()) {
          shakeBox(box);
        } else {
          doConfirm();
        }
      }
    });
  }

  // ── Styles hover boutons ─────────────────────────────────────────────────
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background    = '#F9FAFB';
    cancelBtn.style.borderColor   = '#D1D5DB';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background    = '#fff';
    cancelBtn.style.borderColor   = '#E5E7EB';
  });
  confirmBtn.addEventListener('mouseenter', () => {
    if (!confirmBtn.disabled) confirmBtn.style.background = '#B91C1C';
  });
  confirmBtn.addEventListener('mouseleave', () => {
    if (!confirmBtn.disabled) confirmBtn.style.background = '#DC2626';
  });

  // ── Actions ──────────────────────────────────────────────────────────────
  cancelBtn.addEventListener('click', doCancel);
  confirmBtn.addEventListener('click', () => {
    if (requireType && itemName && input?.value.trim() !== itemName.trim()) {
      shakeBox(box);
      input?.focus();
      return;
    }
    doConfirm();
  });

  // Clic overlay → ferme
  overlay.addEventListener('click', e => {
    if (e.target === overlay) doCancel();
  });

  // Escape → ferme
  const onKeydown = e => {
    if (e.key === 'Escape') doCancel();
  };
  document.addEventListener('keydown', onKeydown);

  // ── Fonctions internes ───────────────────────────────────────────────────
  function doCancel() {
    closeModal();
    onCancel?.();
  }

  async function doConfirm() {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `
      <svg style="animation:spin .6s linear infinite" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Suppression…`;

    if (!document.getElementById('cfm-spin-kf')) {
      const s = document.createElement('style');
      s.id = 'cfm-spin-kf';
      s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(s);
    }

    try {
      await onConfirm?.();
      closeModal();
    } catch (err) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '✕ Erreur — réessayez';
      confirmBtn.style.background = '#991B1B';
      setTimeout(() => {
        confirmBtn.innerHTML = 'Supprimer';
        confirmBtn.style.background = '#DC2626';
        confirmBtn.disabled = false;
      }, 2200);
    }
  }

  function closeModal() {
    document.removeEventListener('keydown', onKeydown);
    overlay.style.animation = 'cfm-fadein .15s ease reverse forwards';
    setTimeout(() => overlay.remove(), 150);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shakeBox(box) {
  box.classList.remove('shake');
  void box.offsetWidth; // reflow
  box.classList.add('shake');
  box.addEventListener('animationend', () => box.classList.remove('shake'), { once: true });
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
