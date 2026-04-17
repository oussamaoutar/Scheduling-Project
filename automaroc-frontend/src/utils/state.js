/**
 * state.js — Store global léger (observable sans framework)
 *
 * Usage :
 *   import { store, setState, subscribe } from './state.js';
 *   subscribe('machines', (machines) => console.log(machines));
 *   setState('machines', [...]);
 */

// ─── État initial ─────────────────────────────────────────────────────────────

const initialState = {
  /** Donnees chargees depuis le backend */
  machines:        [],
  jobs:            [],
  operations:      [],
  schedulingResult: null,
  imprevus:        [],
  historique:      [],

  /**
   * Donnees partagees entre pages
   *   currentRun      : run en cours de visualisation (objet run API)
   *   selectedJobs    : IDs des jobs selectionnes (jobs.js -> scheduling.js)
   *   lastAlgo        : dernier algorithme utilise (scheduling.js -> gantt.js)
   *   dashboardData   : cache donnees dashboard (evite un rechargement)
   *   activeImprevus  : liste des imprevus actifs (dashboard -> sidebar badge)
   *   preferredAlgo   : algo recommande par comparison.js -> scheduling wizard
   */
  currentRun:      null,
  selectedJobs:    [],
  lastAlgo:        null,
  dashboardData:   null,
  activeImprevus:  [],
  preferredAlgo:   null,

  /** UI */
  currentRoute:    null,
  loading:         {},    // { [key]: boolean }
  errors:          {},    // { [key]: string|null }

  /** Filtres persistants */
  filters: {
    machines:   {},
    jobs:       {},
    imprevus:   { statut: 'all' },
    historique: { periode: '7d' },
  },
};

let _state = { ...initialState };

/** Map listeners: key → Set<callback> */
const _listeners = new Map();

// ─── API publique ─────────────────────────────────────────────────────────────

/** Lecture courante de l'état */
export const store = new Proxy(_state, {
  get(_, key) { return _state[key]; },
});

/**
 * Met a jour une cle de l'etat et notifie les abonnes.
 * @param {string} key
 * @param {*} value
 */
export function setState(key, value) {
  _state = { ..._state, [key]: value };
  const listeners = _listeners.get(key) || new Set();
  listeners.forEach((cb) => cb(value));
  // Notify wildcard listeners
  const wildcards = _listeners.get('*') || new Set();
  wildcards.forEach((cb) => cb({ key, value }));
}

/**
 * Lit la valeur courante d'une cle de l'etat.
 * @param {string} key
 * @returns {*}
 */
export function getState(key) {
  return _state[key];
}

/**
 * Met à jour un sous-objet (merge shallow).
 * @param {string} key
 * @param {object} partial
 */
export function mergeState(key, partial) {
  const current = _state[key];
  if (typeof current === 'object' && !Array.isArray(current) && current !== null) {
    setState(key, { ...current, ...partial });
  } else {
    setState(key, partial);
  }
}

/**
 * Abonne une fonction à un changement de clé.
 * @param {string} key  — clé de l'état, ou '*' pour tout écouter
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export function subscribe(key, callback) {
  if (!_listeners.has(key)) _listeners.set(key, new Set());
  _listeners.get(key).add(callback);
  return () => _listeners.get(key).delete(callback);
}

// ─── Helpers loading / error ──────────────────────────────────────────────────

export function setLoading(key, value) {
  mergeState('loading', { [key]: value });
}

export function setError(key, value) {
  mergeState('errors', { [key]: value });
}

export function isLoading(key) {
  return !!_state.loading[key];
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetState() {
  _state = { ...initialState };
  _listeners.forEach((listeners) => listeners.forEach((cb) => cb(null)));
}
