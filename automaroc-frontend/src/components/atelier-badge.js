/**
 * atelier-badge.js — Badge coloré par type d'atelier
 *
 * Architecture en deux couches :
 *  1. ATELIER_TYPES  → map extensible type → { label, colors }
 *     Ajouter un nouveau type = 1 ligne dans ce map, rien d'autre à modifier.
 *  2. renderAtelierBadge(type) → string HTML du badge
 *     getAtelierMeta(type)     → { label, bg, color, border } (pour usage externe)
 *
 * Usage :
 *   import { renderAtelierBadge, ATELIER_TYPES } from './atelier-badge.js';
 *
 *   // Insérer le badge dans du HTML
 *   td.innerHTML = renderAtelierBadge(machine.workshop_type);
 *
 *   // Accéder aux métadonnées (pour un graphique, etc.)
 *   const { label, color } = getAtelierMeta('flow_shop');
 *
 *   // Mettre à jour le badge layout (footer sidebar)
 *   import { setAtelierType } from './layout.js';
 *   setAtelierType(ATELIER_TYPES['job_shop'].label);
 */

// ─── Map type → métadonnées ────────────────────────────────────────────────────
// C'est le SEUL endroit à modifier pour ajouter / renommer un type d'atelier.
// Chaque entrée :
//   label   — texte affiché
//   bg      — couleur de fond du badge (hex ou rgba)
//   color   — couleur du texte
//   border  — couleur de bordure (optionnel, sinon transparent)
//   dot     — couleur du point de statut (optionnel)

export const ATELIER_TYPES = {

  flow_shop: {
    label:  'Flow Shop',
    bg:     '#EFF6FF',
    color:  '#1D4ED8',
    border: '#BFDBFE',
    dot:    '#378ADD',
  },

  job_shop: {
    label:  'Job Shop',
    bg:     '#ECFDF5',
    color:  '#065F46',
    border: '#A7F3D0',
    dot:    '#1D9E75',
  },

  open_shop: {
    label:  'Open Shop',
    bg:     '#F5F3FF',
    color:  '#5B21B6',
    border: '#DDD6FE',
    dot:    '#7C3AED',
  },

  flexible_flow_shop: {
    label:  'Flex Flow Shop',
    bg:     '#FFF7ED',
    color:  '#92400E',
    border: '#FED7AA',
    dot:    '#F59E0B',
  },

  // ── Exemples de types futurs (décommenter pour activer) ────────────────────
  // single_machine: {
  //   label:  'Machine unique',
  //   bg:     '#FEF2F2',
  //   color:  '#991B1B',
  //   border: '#FECACA',
  //   dot:    '#E24B4A',
  // },
  // parallel_machines: {
  //   label:  'Machines parallèles',
  //   bg:     '#F0FFFE',
  //   color:  '#134E4A',
  //   border: '#99F6E4',
  //   dot:    '#0D9488',
  // },
};

// ─── Fallback pour type inconnu ───────────────────────────────────────────────

const UNKNOWN_TYPE = {
  label:  'Atelier personnalisé',
  bg:     '#F9FAFB',
  color:  '#6B7280',
  border: '#E5E7EB',
  dot:    '#9CA3AF',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * getAtelierMeta(type) → métadonnées du type (avec fallback gracieux)
 * @param {string} type  clé du type d'atelier (ex: 'flow_shop')
 * @returns {{ label, bg, color, border, dot }}
 */
export function getAtelierMeta(type) {
  return ATELIER_TYPES[type] ?? UNKNOWN_TYPE;
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * renderAtelierBadge(type, opts?) → string HTML du badge
 *
 * @param {string}  type         clé du type d'atelier
 * @param {object}  [opts]
 * @param {boolean} [opts.dot]   afficher le point coloré à gauche (défaut: true)
 * @param {string}  [opts.size]  'sm' | 'md' (défaut: 'md')
 * @returns {string}  fragment HTML inline
 */
export function renderAtelierBadge(type, opts = {}) {
  const { dot = true, size = 'md' } = opts;
  const meta = getAtelierMeta(type);

  const padding = size === 'sm' ? '2px 8px'  : '3px 10px';
  const fontSize = size === 'sm' ? '11px'    : '12px';
  const dotSize  = size === 'sm' ? '6px'     : '7px';

  const dotHtml = dot
    ? `<span style="
         display:inline-block;
         width:${dotSize}; height:${dotSize};
         border-radius:50%;
         background:${meta.dot ?? meta.color};
         flex-shrink:0;
       "></span>`
    : '';

  return `
    <span style="
      display:inline-flex;
      align-items:center;
      gap:5px;
      padding:${padding};
      border-radius:20px;
      background:${meta.bg};
      color:${meta.color};
      border:1px solid ${meta.border ?? 'transparent'};
      font-size:${fontSize};
      font-weight:600;
      font-family:'Inter',system-ui,sans-serif;
      white-space:nowrap;
      line-height:1.5;
    ">
      ${dotHtml}
      ${meta.label}
    </span>`.trim();
}

/**
 * createAtelierBadgeEl(type, opts?) → HTMLElement (pour insertion DOM directe)
 * Même interface que renderAtelierBadge mais retourne un Node.
 */
export function createAtelierBadgeEl(type, opts = {}) {
  const span = document.createElement('span');
  span.innerHTML = renderAtelierBadge(type, opts);
  return span.firstChild;
}

/**
 * atelierOptions() → tableau d'options pour un <select>
 * Utile pour les formulaires de création/modification.
 *
 * @returns {{ value: string, label: string }[]}
 */
export function atelierOptions() {
  return Object.entries(ATELIER_TYPES).map(([value, { label }]) => ({ value, label }));
}

/**
 * atelierSelectHtml(selectedValue?, name?) → string HTML d'un <select> complet
 * Génère un <select> prêt à l'emploi avec toutes les options.
 */
export function atelierSelectHtml(selectedValue = '', name = 'workshop_type') {
  const opts = Object.entries(ATELIER_TYPES)
    .map(([v, { label }]) =>
      `<option value="${v}"${v === selectedValue ? ' selected' : ''}>${label}</option>`
    )
    .join('\n');

  return `
    <select name="${name}" id="${name}"
            style="width:100%;padding:8px 12px;border:1px solid #e5e7eb;
                   border-radius:8px;font-size:14px;color:#374151;
                   background:#fff;font-family:'Inter',system-ui,sans-serif;
                   cursor:pointer;">
      <option value="">— Choisir un type d'atelier —</option>
      ${opts}
    </select>`.trim();
}
