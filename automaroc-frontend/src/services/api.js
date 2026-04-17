/**
 * api.js — Couche de communication AutoMaroc Scheduling
 * Base URL : http://127.0.0.1:8000/api/
 *
 * Structure :
 *   fetchAPI(path, options)         — requête générique avec retry + message d'erreur lisible
 *   fetchPaginated(path)            — GET liste paginée → retourne data.results[]
 *
 *   MachineAPI   → /api/machines/
 *   JobAPI       → /api/jobs/
 *   OperationAPI → /api/jobs/operations/
 *   SchedulingAPI→ /api/scheduling/runs/ + endpoints spéciaux
 *   ImprevuAPI   → /api/scheduling/imprevus/   (⚠ module futur côté backend)
 *   HistoriqueAPI→ /api/scheduling/historique/ (⚠ module futur côté backend)
 *
 *   showToast(message, type)        — notification UI (success|error|info|warning)
 *   showLoading(containerId)        — spinner dans un conteneur
 *   hideLoading(containerId)        — retire le spinner
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = 'http://127.0.0.1:8000/api/';

// Délai de retry en ms
const RETRY_DELAY_MS = 500;

// ─── Extraction d'un message d'erreur lisible depuis la réponse Django ────────

function extractErrorMessage(body) {
  if (!body) return 'Erreur inconnue.';

  // Django REST Framework retourne souvent { detail: "..." }
  if (typeof body === 'string') return body;
  if (body.detail) return String(body.detail);

  // Erreurs de validation champ par champ : { field: ["msg"] }
  const fieldErrors = Object.entries(body)
    .filter(([, v]) => v && v !== Object(v) || Array.isArray(v))
    .map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' | ');
  if (fieldErrors) return fieldErrors;

  // Clés non_field_errors
  if (body.non_field_errors) {
    return Array.isArray(body.non_field_errors)
      ? body.non_field_errors.join(' ')
      : String(body.non_field_errors);
  }

  return JSON.stringify(body);
}

// ─── Requête générique avec retry ─────────────────────────────────────────────

/**
 * fetchAPI(path, options?)
 *   - path   : chemin relatif à BASE_URL (ex: 'machines/', 'jobs/1/')
 *   - options: options fetch standard (method, body, headers, …)
 *
 * Comportement :
 *   - status >= 400 → lit le body JSON, extrait le message, throw Error
 *   - erreur réseau → 1 retry après RETRY_DELAY_MS, puis throw "Impossible de joindre le serveur"
 *   - 204 No Content → retourne null
 *
 * @returns {Promise<any>} corps JSON décodé, ou null si 204
 */
export async function fetchAPI(path, options = {}) {
  const url = BASE_URL + path;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // ─── Timeout 10 s via AbortController ────────────────────────────────────
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10_000);

  const config = { ...options, headers, signal: controller.signal };

  async function attempt() {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    // 204 No Content (DELETE, …)
    if (response.status === 204) return null;

    // Lecture du corps JSON
    let body;
    try { body = await response.json(); } catch { body = null; }

    if (!response.ok) {
      // ── Gestion globale par code HTTP ────────────────────────────────────
      _handleHttpError(response.status, body);

      const message = extractErrorMessage(body) || `Erreur HTTP ${response.status}`;
      throw new Error(message);
    }

    return body;
  }

  try {
    return await attempt();
  } catch (err) {
    clearTimeout(timeoutId);

    // Timeout (AbortError)
    if (err.name === 'AbortError') {
      showToast('La requête prend trop de temps — vérifiez votre connexion.', 'warning');
      throw new Error('Timeout — requête annulée après 10 s.');
    }

    // Erreur réseau → retry une fois
    if (err instanceof TypeError) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      try {
        return await attempt();
      } catch (retryErr) {
        if (retryErr.name === 'AbortError') {
          showToast('La requête prend trop de temps — vérifiez votre connexion.', 'warning');
        }
        throw new Error(
          'Impossible de joindre le serveur. ' +
          'Vérifiez que le backend Django tourne sur http://127.0.0.1:8000'
        );
      }
    }

    // Erreur HTTP déjà traitée → propagée
    throw err;
  }
}

// ─── Gestion des codes HTTP ────────────────────────────────────────────────────

// Évite les doublons de bannières 401
let _session401Shown = false;

function _handleHttpError(status, body) {
  switch (status) {
    case 401:
      if (!_session401Shown) {
        _session401Shown = true;
        _showSessionExpiredBanner();
      }
      break;
    case 403:
      showToast('Accès non autorisé — droits insuffisants.', 'error');
      break;
    case 404:
      showToast('Ressource introuvable (404).', 'warning');
      break;
    case 500:
    case 502:
    case 503:
      showToast(`Erreur serveur (${status}) — réessayez dans quelques instants.`, 'error');
      break;
    default:
      break;
  }
}

/** Bannière persistante "Session expirée" (remplace le contenu de la topbar) */
function _showSessionExpiredBanner() {
  // Ne pas doubler
  if (document.getElementById('am-session-banner')) return;

  const banner = document.createElement('div');
  banner.id    = 'am-session-banner';
  Object.assign(banner.style, {
    position:       'fixed',
    top:            '0',
    left:           '0',
    right:          '0',
    zIndex:         '99999',
    background:     '#DC2626',
    color:          '#fff',
    padding:        '12px 20px',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            '12px',
    fontSize:       '14px',
    fontWeight:     '600',
    fontFamily:     'Inter, system-ui, sans-serif',
    boxShadow:      '0 4px 16px rgba(0,0,0,.25)',
  });

  banner.innerHTML = `
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
    <span>Session expirée — veuillez vous reconnecter.</span>
    <button onclick="window.location.reload()"
            style="background:rgba(255,255,255,.2); border:none; color:#fff; cursor:pointer;
                   padding:6px 16px; border-radius:8px; font-weight:700; font-size:13px;
                   font-family:Inter,system-ui,sans-serif;">
      Recharger
    </button>
    <button onclick="document.getElementById('am-session-banner').remove(); window._session401Shown=false;"
            style="background:none; border:none; color:rgba(255,255,255,.7); cursor:pointer;
                   font-size:20px; line-height:1; padding:0 4px;">
      ×
    </button>`;

  document.body.prepend(banner);
}

// ─── Liste paginée ────────────────────────────────────────────────────────────

/**
 * fetchPaginated(path)
 *   Effectue un GET et retourne uniquement `data.results`.
 *   Si la réponse n'est pas paginée (tableau direct), retourne le tableau tel quel.
 *
 * @returns {Promise<Array>}
 */
export async function fetchPaginated(path) {
  const data = await fetchAPI(path);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

// ─── MachineAPI ───────────────────────────────────────────────────────────────
// Endpoint : /api/machines/
// Champs écriture : code, name, machine_type, workstation_number, capacity_per_day, is_active
// machine_type   : cutting | drilling | milling | turning | assembly | painting | packaging | other
// Champs lecture  : + id, created_at, updated_at

export const MachineAPI = {
  /** Retourne toutes les machines (results[]) */
  getAll: (params = '') =>
    fetchPaginated('machines/' + (params ? `?${params}` : '')),

  /** Retourne une machine par ID */
  getById: (id) =>
    fetchAPI(`machines/${id}/`),

  /** Crée une machine — body: { code, name, machine_type, workstation_number, capacity_per_day, is_active } */
  create: (data) =>
    fetchAPI('machines/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Modifie partiellement une machine (PATCH) */
  update: (id, data) =>
    fetchAPI(`machines/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** Supprime une machine (renvoie null si succès) */
  delete: (id) =>
    fetchAPI(`machines/${id}/`, { method: 'DELETE' }),
};

// ─── JobAPI ───────────────────────────────────────────────────────────────────
// Endpoint : /api/jobs/
// Champs écriture : code, name, description, quantity, priority (1-5),
//                   release_date, due_date, status, is_active
// status         : draft | ready | in_progress | completed | cancelled
// Champs lecture  : + id, total_processing_time, created_at, updated_at

export const JobAPI = {
  /** Retourne tous les jobs (results[]) */
  getAll: (params = '') =>
    fetchPaginated('jobs/' + (params ? `?${params}` : '')),

  /** Retourne un job par ID */
  getById: (id) =>
    fetchAPI(`jobs/${id}/`),

  /** Crée un job */
  create: (data) =>
    fetchAPI('jobs/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Modifie partiellement un job (PATCH) */
  update: (id, data) =>
    fetchAPI(`jobs/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** Supprime un job */
  delete: (id) =>
    fetchAPI(`jobs/${id}/`, { method: 'DELETE' }),
};

// ─── OperationAPI ─────────────────────────────────────────────────────────────
// Endpoint : /api/jobs/operations/   ← namespace jobs, PAS /api/operations/
// Champs écriture : job, machine, sequence_order, processing_time_minutes,
//                   setup_time_minutes, transfer_time_minutes, notes
// Champs lecture  : + id, machine_code, machine_name, total_time_minutes, created_at, updated_at
//
// Contraintes backend :
//   • machine unique par job
//   • sequence_order unique par job
//   • job et machine doivent être actifs

export const OperationAPI = {
  /** Retourne toutes les opérations (results[]) */
  getAll: (params = '') =>
    fetchPaginated('jobs/operations/' + (params ? `?${params}` : '')),

  /** Retourne une opération par ID */
  getById: (id) =>
    fetchAPI(`jobs/operations/${id}/`),

  /** Crée une opération */
  create: (data) =>
    fetchAPI('jobs/operations/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Modifie partiellement une opération (PATCH) */
  update: (id, data) =>
    fetchAPI(`jobs/operations/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** Supprime une opération */
  delete: (id) =>
    fetchAPI(`jobs/operations/${id}/`, { method: 'DELETE' }),

  /** Filtre par job (résultats paginés → results[]) */
  filterByJob: (jobId) =>
    fetchPaginated(`jobs/operations/?job=${jobId}`),

  /** Filtre par machine (résultats paginés → results[]) */
  filterByMachine: (machineId) =>
    fetchPaginated(`jobs/operations/?machine=${machineId}`),
};

// ─── SchedulingAPI ────────────────────────────────────────────────────────────
// Endpoint principal : /api/scheduling/runs/
// Champs écriture   : name, algorithm, objective, job_ids[], notes
// algorithm         : spt | lpt | edd | johnson | cds
// objective         : minimize_cmax | minimize_tardiness | balance_load
// status (lecture)  : draft | running | completed | failed
//
// Workflow d'ordonnancement :
//   1. createRun({ name, algorithm, objective, job_ids?, notes? })
//   2. executeRun(id)
//   3. getRunSummary(id) / getRunGantt(id) / getRunKpis(id)
//
// Comparaison :
//   compare({ job_ids?, algorithms, ranking_metric })
//   ranking_metric : cmax_minutes | total_flow_time_minutes | average_tardiness_minutes

export const SchedulingAPI = {
  // ── CRUD des runs ──────────────────────────────────────────────────────────

  /** Liste tous les runs (results[]) — params ex: 'status=completed&ordering=-created_at' */
  getRuns: (params = '') =>
    fetchPaginated('scheduling/runs/' + (params ? `?${params}` : '')),

  /** Détail d'un run */
  getRunById: (id) =>
    fetchAPI(`scheduling/runs/${id}/`),

  /**
   * Crée un run (status=draft)
   * @param {{ name: string, algorithm: string, objective: string, job_ids?: number[], notes?: string }} data
   */
  createRun: (data) =>
    fetchAPI('scheduling/runs/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Modifie partiellement un run (PATCH) — utile pour annoter notes */
  updateRun: (id, data) =>
    fetchAPI(`scheduling/runs/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** Supprime un run */
  deleteRun: (id) =>
    fetchAPI(`scheduling/runs/${id}/`, { method: 'DELETE' }),

  // ── Actions spéciales ──────────────────────────────────────────────────────

  /**
   * Lance l'algorithme sur un run existant.
   * POST /api/scheduling/runs/{id}/execute/
   * @returns Le run mis à jour (status=completed ou failed)
   */
  executeRun: (id) =>
    fetchAPI(`scheduling/runs/${id}/execute/`, { method: 'POST', body: '{}' }),

  // ── Résultats ──────────────────────────────────────────────────────────────

  /**
   * Résumé complet d'un run (run, kpis, sequence, machine_statistics, …)
   * GET /api/scheduling/runs/{id}/summary/
   */
  getRunSummary: (id) =>
    fetchAPI(`scheduling/runs/${id}/summary/`),

  /**
   * Données Gantt structurées
   * GET /api/scheduling/runs/{id}/gantt/
   * → { run_id, run_name, algorithm, timeline, machines[], jobs[], raw_items[] }
   *   timeline : { start_time, end_time, total_duration }  (en minutes)
   *   machines[].tasks[]: { operation_id, start_time, end_time, duration, label, … }
   */
  getRunGantt: (id) =>
    fetchAPI(`scheduling/runs/${id}/gantt/`),

  /**
   * KPIs d'un run
   * GET /api/scheduling/runs/{id}/kpis/
   * → { kpis: { cmax_minutes, total_flow_time_minutes, average_tardiness_minutes,
   *              average_flow_time_minutes, late_jobs_count, on_time_jobs_count, … } }
   */
  getRunKpis: (id) =>
    fetchAPI(`scheduling/runs/${id}/kpis/`),

  // ── Dashboard, catalogue, comparaison ─────────────────────────────────────

  /**
   * Tableau de bord global
   * GET /api/scheduling/dashboard/
   * → { counters: { machines, active_machines, jobs, active_jobs, operations,
   *                 schedule_runs, completed_runs },
   *     recent_runs: [{…}] }
   */
  getDashboard: () =>
    fetchAPI('scheduling/dashboard/'),

  /**
   * Catalogue d'algorithmes disponibles avec leurs contraintes
   * GET /api/scheduling/algorithms/
   * → [{ code, label, category, implemented, constraints: { flow_shop_required,
   *       exact_machine_count, minimum_machine_count } }]
   */
  getAlgorithms: () =>
    fetchAPI('scheduling/algorithms/'),

  /**
   * Comparaison multi-algorithmes
   * POST /api/scheduling/compare/
   * @param {{ job_ids?: number[], algorithms: string[], ranking_metric?: string }} data
   * → { ranking_metric, job_count, results: [{ algorithm, rank, status,
   *       result_metrics: { cmax_minutes, … }, error_message? }] }
   */
  compare: (data) =>
    fetchAPI('scheduling/compare/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── ImprevuAPI ───────────────────────────────────────────────────────────────
// ⚠ Endpoint non encore implémenté dans le backend actuel.
// Endpoint cible : /api/scheduling/imprevus/
//
// types possibles : 'panne_machine' | 'manque_matieres' | 'absence_operateur' | 'autre'
//
// Quand le backend sera prêt, ces appels fonctionneront sans modification du front.

export const ImprevuAPI = {
  /** Tous les imprévus (results[]) */
  getAll: () =>
    fetchPaginated('scheduling/imprevus/'),

  /** Imprévus filtrés par machine */
  getByMachine: (machineId) =>
    fetchPaginated(`scheduling/imprevus/?machine=${machineId}`),

  /**
   * Imprévus filtrés par type
   * @param {'panne_machine'|'manque_matieres'|'absence_operateur'|'autre'} type
   */
  getByType: (type) =>
    fetchPaginated(`scheduling/imprevus/?type=${type}`),

  /** Crée un imprévus */
  create: (data) =>
    fetchAPI('scheduling/imprevus/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Modifie un imprévus (PATCH) */
  update: (id, data) =>
    fetchAPI(`scheduling/imprevus/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** Supprime un imprévus */
  delete: (id) =>
    fetchAPI(`scheduling/imprevus/${id}/`, { method: 'DELETE' }),
};

// ─── HistoriqueAPI ────────────────────────────────────────────────────────────
// ⚠ Endpoint non encore implémenté dans le backend actuel.
// Endpoint cible : /api/scheduling/historique/
//
// Quand le backend sera prêt, ces appels fonctionneront sans modification du front.

export const HistoriqueAPI = {
  /**
   * Historique d'une machine sur N jours
   * GET /api/scheduling/historique/?machine={id}&days={n}
   * @param {number} machineId
   * @param {number} [days=30]
   */
  getByMachine: (machineId, days = 30) =>
    fetchAPI(`scheduling/historique/?machine=${machineId}&days=${days}`),

  /**
   * Statistiques agrégées d'une machine
   * GET /api/scheduling/historique/stats/?machine={id}
   * @param {number} machineId
   */
  getStats: (machineId) =>
    fetchAPI(`scheduling/historique/stats/?machine=${machineId}`),
};

// ─── Utilitaires UI ───────────────────────────────────────────────────────────

/**
 * showToast(message, type='info')
 * Affiche une notification flottante auto-dismiss après 4s.
 * @param {string}  message
 * @param {'success'|'error'|'info'|'warning'} type
 */
export function showToast(message, type = 'info') {
  // Assure qu'un conteneur de toasts existe
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none',
    });
    document.body.appendChild(container);
  }

  // Couleurs par type
  const PALETTE = {
    success: { bg: '#1D9E75', icon: '✓' },
    error:   { bg: '#E24B4A', icon: '✕' },
    warning: { bg: '#BA7517', icon: '⚠' },
    info:    { bg: '#378ADD', icon: 'ℹ' },
  };
  const { bg, icon } = PALETTE[type] || PALETTE.info;

  // Création du toast
  const toast = document.createElement('div');
  toast.setAttribute('role', 'alert');
  Object.assign(toast.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 18px',
    borderRadius: '12px',
    background: bg,
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
    minWidth: '240px',
    maxWidth: '360px',
    pointerEvents: 'auto',
    opacity: '0',
    transform: 'translateY(12px)',
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    cursor: 'pointer',
  });

  toast.innerHTML = `
    <span style="font-size:18px;line-height:1">${icon}</span>
    <span style="flex:1">${message}</span>
    <span style="opacity:.7;font-size:18px;line-height:1" aria-label="Fermer">×</span>
  `;

  // Fermeture au clic
  toast.addEventListener('click', () => dismiss());

  container.appendChild(toast);

  // Animation d'entrée
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
  });

  // Auto-dismiss après 4s
  let dismissTimer = setTimeout(dismiss, 4000);

  function dismiss() {
    clearTimeout(dismissTimer);
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 280);
  }
}

/**
 * showLoading(containerId)
 * Injecte un spinner centré dans l'élément identifié par `containerId`.
 * Sauvegarde le contenu existant pour le restaurer via hideLoading.
 * @param {string} containerId — valeur de l'attribut id de l'élément cible
 */
export function showLoading(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // Sauvegarde du contenu existant
  if (!el.dataset.prevContent) {
    el.dataset.prevContent = el.innerHTML;
  }

  el.innerHTML = `
    <div style="
      display:flex; align-items:center; justify-content:center;
      padding:48px; flex-direction:column; gap:12px;
    " aria-live="polite" aria-busy="true">
      <div style="
        width:36px; height:36px; border:3px solid #e5e7eb;
        border-top-color:#378ADD; border-radius:50%;
        animation:spin .7s linear infinite;
      "></div>
      <p style="font-size:13px;color:#9ca3af;font-family:Inter,system-ui,sans-serif">
        Chargement…
      </p>
    </div>
  `;

  // Injecte le keyframe une seule fois
  if (!document.getElementById('api-spin-style')) {
    const style = document.createElement('style');
    style.id = 'api-spin-style';
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }
}

/**
 * hideLoading(containerId)
 * Retire le spinner et restaure le contenu précédent (si disponible).
 * @param {string} containerId — valeur de l'attribut id de l'élément cible
 */
export function hideLoading(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (el.dataset.prevContent !== undefined) {
    el.innerHTML = el.dataset.prevContent;
    delete el.dataset.prevContent;
  }
}

// ─── Wrapper safeCall : toutes les méthodes retournent { data, error } ─────────
//
// Les pages font :  const { data, error } = await machinesApi.list(...)
// fetchAPI throw en cas d'erreur — safeCall() intercepte et normalise.
//
// list() accepte :
//   - une string    : 'page_size=200&is_active=true'
//   - un objet      : { page_size: 200, is_active: true }
//   - rien          : ''

function toQueryString(params) {
  if (!params) return '';
  if (typeof params === 'string') return params;
  if (typeof params === 'object') {
    return Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }
  return '';
}

async function safeCall(fn, ...args) {
  try {
    const data = await fn(...args);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: { detail: err.message } };
  }
}

// Crée un proxy api dont chaque méthode retourne { data, error }
// et dont list() accepte objet ou string.
function makeSafeApi(rawApi, extraMethods = {}) {
  const merged = { ...rawApi, ...extraMethods };

  const handler = {};

  for (const [key, fn] of Object.entries(merged)) {
    if (typeof fn !== 'function') continue;

    if (key === 'getAll' || key === 'list') {
      // list(params?) — params peut être string ou objet
      handler[key] = (params) => safeCall(fn, toQueryString(params));
    } else {
      handler[key] = (...args) => safeCall(fn, ...args);
    }
  }

  // Alias list ↔ getAll (les deux doivent exister)
  if (handler.getAll && !handler.list) handler.list  = handler.getAll;
  if (handler.list   && !handler.getAll) handler.getAll = handler.list;

  // Alias patch → update
  if (handler.update && !handler.patch) handler.patch = handler.update;

  return handler;
}

export const machinesApi   = makeSafeApi(MachineAPI);
export const jobsApi       = makeSafeApi(JobAPI);
export const operationsApi = makeSafeApi(OperationAPI);

// schedulingApi avec alias sémantiques supplémentaires
export const schedulingApi = makeSafeApi(SchedulingAPI, {
  list:       (...a) => SchedulingAPI.getRuns(...a),
  get:        (...a) => SchedulingAPI.getRunById(...a),
  create:     (...a) => SchedulingAPI.createRun(...a),
  patch:      (...a) => SchedulingAPI.updateRun(...a),
  delete:     (...a) => SchedulingAPI.deleteRun(...a),
  execute:    (...a) => SchedulingAPI.executeRun(...a),
  dashboard:  ()     => SchedulingAPI.getDashboard(),
  algorithms: ()     => SchedulingAPI.getAlgorithms(),
  compare:    (...a) => SchedulingAPI.compare(...a),
  summary:    (...a) => SchedulingAPI.getRunSummary(...a),
  gantt:      (...a) => SchedulingAPI.getRunGantt(...a),
  kpis:       (...a) => SchedulingAPI.getRunKpis(...a),
});

export const imprevusApi   = makeSafeApi(ImprevuAPI,   { list: (...a) => ImprevuAPI.getAll(...a) });
export const historiqueApi = makeSafeApi(HistoriqueAPI, { list: (p)   => HistoriqueAPI.getByMachine(p) });

// toast & loaders raccourcis
export const toast = {
  success: (msg) => showToast(msg, 'success'),
  error:   (msg) => showToast(msg, 'error'),
  info:    (msg) => showToast(msg, 'info'),
  warning: (msg) => showToast(msg, 'warning'),
};

// ─── Export par défaut ────────────────────────────────────────────────────────

export default {
  fetchAPI,
  fetchPaginated,
  safeCall,
  MachineAPI,    machinesApi,
  JobAPI,        jobsApi,
  OperationAPI,  operationsApi,
  SchedulingAPI, schedulingApi,
  ImprevuAPI,    imprevusApi,
  HistoriqueAPI, historiqueApi,
  showToast, toast,
  showLoading,
  hideLoading,
};

