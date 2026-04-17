/**
 * formatters.js — Formateurs de données alignés sur les vrai modèles Django
 */

// ─── Dates & heures ───────────────────────────────────────────────────────────

const dtFmt   = new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeStyle: 'short' });
const dateFmt = new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' });

export function formatDateTime(value) {
  if (!value) return '—';
  try { return dtFmt.format(new Date(value)); } catch { return value; }
}

export function formatDate(value) {
  if (!value) return '—';
  try { return dateFmt.format(new Date(value)); } catch { return value; }
}

/**
 * Durée en minutes → "2h 15min" ou "45min"
 */
export function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function formatNumber(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-MA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function truncate(str, max = 45) {
  if (!str) return '—';
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

// ─── Machine types (champ machine_type du modèle Machine) ────────────────────

const MACHINE_TYPE_MAP = {
  cutting:   { label: 'Découpe',     icon: '✂️', color: 'orange' },
  drilling:  { label: 'Perçage',     icon: '🔩', color: 'blue'   },
  milling:   { label: 'Fraisage',    icon: '⚙️', color: 'gray'   },
  turning:   { label: 'Tournage',    icon: '🔄', color: 'purple' },
  assembly:  { label: 'Assemblage',  icon: '🔧', color: 'teal'   },
  painting:  { label: 'Peinture',    icon: '🎨', color: 'violet' },
  packaging: { label: 'Emballage',   icon: '📦', color: 'sky'    },
  other:     { label: 'Autre',       icon: '🏭', color: 'gray'   },
};

export function formatMachineType(type) {
  return MACHINE_TYPE_MAP[type] || { label: type || '—', icon: '🏭', color: 'gray' };
}

// ─── Job status (champ status du modèle Job) ─────────────────────────────────

const JOB_STATUS_MAP = {
  draft:       { label: 'Brouillon',   color: 'gray'    },
  ready:       { label: 'Prêt',        color: 'primary' },
  in_progress: { label: 'En cours',    color: 'warning' },
  completed:   { label: 'Terminé',     color: 'success' },
  cancelled:   { label: 'Annulé',      color: 'danger'  },
};

export function formatJobStatus(status) {
  return JOB_STATUS_MAP[status] || { label: status || '—', color: 'gray' };
}

// ─── Schedule run status ──────────────────────────────────────────────────────

const RUN_STATUS_MAP = {
  draft:     { label: 'Brouillon', color: 'gray'    },
  running:   { label: 'En cours',  color: 'warning' },
  completed: { label: 'Terminé',   color: 'success' },
  failed:    { label: 'Échec',     color: 'danger'  },
};

export function formatRunStatus(status) {
  return RUN_STATUS_MAP[status] || { label: status || '—', color: 'gray' };
}

// ─── Algorithmes ─────────────────────────────────────────────────────────────

const ALGO_MAP = {
  spt:     { label: 'SPT',     icon: '⚡', description: 'Shortest Processing Time' },
  lpt:     { label: 'LPT',     icon: '🐢', description: 'Longest Processing Time'  },
  edd:     { label: 'EDD',     icon: '📅', description: 'Earliest Due Date'         },
  johnson: { label: 'Johnson', icon: '🏆', description: 'Algorithme de Johnson (2 machines)' },
  cds:     { label: 'CDS',     icon: '🧮', description: 'Campbell-Dudek-Smith (≥3 machines)' },
};

export function formatAlgorithm(code) {
  return ALGO_MAP[code] || { label: code || '—', icon: '📐', description: '' };
}

// ─── Objectifs de planification ───────────────────────────────────────────────

const OBJECTIVE_MAP = {
  minimize_cmax:      { label: 'Minimiser Cmax',       icon: '⏱️' },
  minimize_tardiness: { label: 'Minimiser retard',      icon: '📉' },
  balance_load:       { label: 'Équilibrer la charge',  icon: '⚖️' },
};

export function formatObjective(obj) {
  return OBJECTIVE_MAP[obj] || { label: obj || '—', icon: '🎯' };
}

// ─── Priorités job (1 = la plus haute, 5 = la plus basse) ───────────────────

const PRIORITY_MAP = {
  1: { label: 'Très haute', color: 'danger'  },
  2: { label: 'Haute',      color: 'warning' },
  3: { label: 'Normale',    color: 'primary' },
  4: { label: 'Basse',      color: 'success' },
  5: { label: 'Très basse', color: 'gray'    },
};

export function formatPriority(p) {
  return PRIORITY_MAP[p] || { label: `P${p}`, color: 'gray' };
}

// ─── Helper badge HTML ────────────────────────────────────────────────────────

const BADGE_CSS = {
  primary: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  danger:  'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  gray:    'bg-gray-100 text-gray-700',
};

export function statusBadge(label, color) {
  const cls = BADGE_CSS[color] || BADGE_CSS.gray;
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}">${label}</span>`;
}
