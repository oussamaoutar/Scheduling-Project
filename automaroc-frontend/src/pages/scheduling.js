/**
 * scheduling.js — Ordonnancements (Scheduling Runs)
 *
 * GET/POST  /api/scheduling/runs/
 * GET/PATCH /api/scheduling/runs/{id}/
 * DELETE    /api/scheduling/runs/{id}/
 * POST      /api/scheduling/runs/{id}/execute/
 * GET       /api/jobs/                          (pour la sélection d'OFs)
 * GET       /api/jobs/operations/?job={id}      (pour le nb d'opérations par OF)
 */

import { schedulingApi, jobsApi, operationsApi } from '../services/api.js';
import { openModal, closeModal }                 from '../components/modal.js';
import { toast }                                 from '../components/toast.js';

// ─── Algorithmes ──────────────────────────────────────────────────────────────

const ALGOS = [
  {
    value:       'spt',
    label:       'SPT',
    full:        'Shortest Processing Time',
    icon:        '⚡',
    description: "Traite les jobs les plus courts en premier. Minimise le temps de cycle moyen et r\u00E9duit le nombre de jobs en attente dans l'atelier.",
    constraint:  null,
    color:       'blue',
  },
  {
    value:       'lpt',
    label:       'LPT',
    full:        'Longest Processing Time',
    icon:        '🏗️',
    description: "Traite les grosses pi\u00E8ces en priorit\u00E9. Optimise l'utilisation des postes et laisse les finitions l\u00E9g\u00E8res pour la fin.",
    constraint:  null,
    color:       'purple',
  },
  {
    value:       'edd',
    label:       'EDD',
    full:        'Earliest Due Date',
    icon:        '📅',
    description: 'Ordonne les OFs par date de livraison croissante. Garantit le respect maximal des délais clients — essentiel en automotive.',
    constraint:  null,
    color:       'green',
  },
  {
    value:       'johnson',
    label:       'Johnson',
    full:        'Algorithme de Johnson',
    icon:        '🏆',
    description: 'Solution optimale garantie pour exactement 2 postes en séquence (ex : Presse → Soudure). Minimise le makespan Cmax.',
    constraint:  { type: 'exact', ops: 2,  label: '⚠ Requiert exactement 2 postes de travail' },
    color:       'orange',
  },
  {
    value:       'cds',
    label:       'CDS',
    full:        'Campbell-Dudek-Smith',
    icon:        '🧮',
    description: "\u00C9tend Johnson \u00E0 3 postes ou plus via des r\u00E9ductions successives. Proche de l'optimal pour les ateliers multi-postes.",
    constraint:  { type: 'min',   ops: 3,  label: '⚠ Requiert au moins 3 postes de travail' },
    color:       'teal',
  },
];

const ALGO_MAP = Object.fromEntries(ALGOS.map(a => [a.value, a]));

const STATUS_CFG = {
  pending:   { label: 'En attente', cls: 'bg-gray-100 text-gray-600',         dot: '#9CA3AF', pulse: false },
  running:   { label: 'En cours',   cls: 'bg-blue-100 text-blue-700',          dot: '#3B82F6', pulse: true  },
  completed: { label: 'Terminé',    cls: 'bg-[#ECFDF5] text-[#065F46]',        dot: '#1D9E75', pulse: false },
  failed:    { label: 'Échec',      cls: 'bg-red-50 text-red-600',             dot: '#EF4444', pulse: false },
};

// ─── État local ───────────────────────────────────────────────────────────────

let _runs      = [];
let _jobs      = [];
let _opCounts  = {};   // { jobId → nb opérations }

// Wizard
let _step      = 1;
let _wName     = '';
let _wDesc     = '';
let _wAlgo     = '';
let _wJobIds   = new Set();

// Polling
let _pollTimer = null;

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = buildShell();
  bindEvents(container);
  await loadAll();
}

// ─── Chargement ───────────────────────────────────────────────────────────────

async function loadAll() {
  setSkeleton();

  const [rRuns, rJobs] = await Promise.all([
    schedulingApi.list({ page_size: 200 }),
    jobsApi.list({ page_size: 500 }),
  ]);

  _runs = toArr(rRuns.data);
  _jobs = toArr(rJobs.data).filter(j => j.is_active);

  // Chargement nb opérations par job (Promise.all)
  if (_jobs.length) {
    await loadOpCounts();
  }

  renderRuns();
  startPollingIfNeeded();
}

async function loadOpCounts() {
  const results = await Promise.all(
    _jobs.map(j => operationsApi.list({ job: j.id, page_size: 200 }))
  );
  results.forEach((r, i) => {
    const arr = toArr(r.data);
    _opCounts[_jobs[i].id] = arr.length;
  });
}

async function reloadRuns() {
  const { data } = await schedulingApi.list({ page_size: 200 });
  _runs = toArr(data);
  renderRuns();
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function buildShell() {
  return `
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Ordonnancements</h2>
        <p id="sched-subtitle" class="text-sm text-gray-500 mt-1">Chargement…</p>
      </div>
      <button id="btn-new-run"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                     bg-[#378ADD] text-white hover:bg-[#185FA5] shadow-sm transition-all shrink-0">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
        </svg>
        Créer un run
      </button>
    </div>
    <div id="runs-content"></div>
  `;
}

function bindEvents(c) {
  c.querySelector('#btn-new-run')?.addEventListener('click', openWizard);
  window.addEventListener('automaroc:refresh', loadAll);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function setSkeleton() {
  const el = document.getElementById('runs-content');
  if (!el) return;
  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      ${[...Array(4)].map(() => `
        <div class="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
          <div class="h-4 bg-gray-100 rounded w-36 animate-pulse"></div>
          <div class="h-5 bg-gray-100 rounded-full w-16 animate-pulse"></div>
          <div class="h-4 bg-gray-100 rounded w-24 animate-pulse ml-auto"></div>
        </div>`).join('')}
    </div>`;
}

// ─── Rendu tableau des runs ───────────────────────────────────────────────────

function renderRuns() {
  const el = document.getElementById('runs-content');
  if (!el) return;

  const sub = document.getElementById('sched-subtitle');
  if (sub) {
    const done = _runs.filter(r => r.status === 'completed').length;
    sub.textContent = `${_runs.length} run(s) — ${done} complété(s)`;
  }

  if (_runs.length === 0) {
    el.innerHTML = `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
        <div class="text-5xl mb-3">🚀</div>
        <p class="font-semibold text-gray-700 mb-1">Aucun run d'ordonnancement</p>
        <p class="text-sm text-gray-400 mb-5">Lancez votre premier ordonnancement avec le wizard.</p>
        <button onclick="document.getElementById('btn-new-run')?.click()"
                class="inline-flex items-center gap-2 px-5 py-2.5 bg-[#378ADD] text-white
                       rounded-xl text-sm font-semibold hover:bg-[#185FA5] transition-all">
          + Créer un run
        </button>
      </div>`;
    return;
  }

  const sorted = [..._runs].sort((a, b) =>
    new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0));

  const rows = sorted.map(run => {
    const s    = STATUS_CFG[run.status] || STATUS_CFG.pending;
    const algo = ALGO_MAP[run.algorithm] || { label: run.algorithm ?? '—', icon: '📐', color: 'gray' };
    const jobs = run.jobs?.length ?? run.selected_jobs?.length ?? '—';
    const isCompleted = run.status === 'completed';
    const isRunning   = run.status === 'running';
    const isPending   = run.status === 'pending';
    const isFailed    = run.status === 'failed';

    return `
      <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors group" data-run-id="${run.id}">
        <!-- Nom -->
        <td class="px-5 py-4">
          <p class="font-semibold text-gray-800 text-sm">${run.name ?? `Run #${run.id}`}</p>
          ${run.description ? `<p class="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">${run.description}</p>` : ''}
        </td>

        <!-- Algorithme -->
        <td class="px-5 py-4 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold
                       ${algoBadgeCls(algo.color)}">
            ${algo.icon} ${algo.label}
          </span>
          <p class="text-xs text-gray-400 mt-0.5">${algo.full ?? ''}</p>
        </td>

        <!-- OFs -->
        <td class="px-5 py-4 text-center">
          <span class="font-semibold text-gray-700">${jobs}</span>
          <span class="text-xs text-gray-400 ml-0.5">OF(s)</span>
        </td>

        <!-- Statut -->
        <td class="px-5 py-4 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}">
            ${s.pulse
              ? `<span class="relative flex h-2 w-2"><span class="animate-ping absolute h-full w-full rounded-full bg-blue-400 opacity-75"></span><span class="relative h-2 w-2 rounded-full bg-blue-500"></span></span>`
              : `<span class="w-1.5 h-1.5 rounded-full" style="background:${s.dot}"></span>`}
            ${s.label}
          </span>
          ${isCompleted && run.cmax_minutes != null
            ? `<p class="text-xs text-[#1D9E75] font-semibold mt-0.5">Cmax : ${fmtMin(run.cmax_minutes)}</p>`
            : ''}
        </td>

        <!-- Date -->
        <td class="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
          ${fmtDateTime(run.created_at)}
        </td>

        <!-- Actions -->
        <td class="px-5 py-4 whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            ${(isPending || isFailed) ? `
              <button data-execute="${run.id}" title="Exécuter"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                             bg-[#378ADD] text-white hover:bg-[#185FA5] transition-all">
                ▶ Exécuter
              </button>` : ''}
            ${isCompleted ? `
              <button data-gantt="${run.id}" title="Voir Gantt"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                             border border-[#378ADD] text-[#378ADD] hover:bg-[#EFF6FF] transition-all">
                📊 Gantt
              </button>
              <button data-kpis="${run.id}" title="Voir KPIs"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                             border border-[#1D9E75] text-[#1D9E75] hover:bg-[#ECFDF5] transition-all">
                📈 KPIs
              </button>` : ''}
            ${isRunning ? `
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                           font-semibold bg-blue-50 text-blue-600 animate-pulse">
                ⏳ Calcul…
              </span>` : ''}
            <button data-delete-run="${run.id}" title="Supprimer"
                    class="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50
                           transition-all opacity-0 group-hover:opacity-100">
              ${iTrash()}
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-[#F9FAFB] border-b border-gray-100">
            ${['Nom du run','Algorithme','OFs','Statut','Créé le','Actions'].map((h, i) =>
              `<th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide
                          ${i === 5 ? 'text-right' : ''}">${h}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // Bind actions
  el.querySelectorAll('[data-execute]').forEach(btn => {
    btn.addEventListener('click', () => executeRun(Number(btn.dataset.execute)));
  });
  el.querySelectorAll('[data-gantt]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `#/gantt?run=${btn.dataset.gantt}`;
    });
  });
  el.querySelectorAll('[data-kpis]').forEach(btn => {
    btn.addEventListener('click', () => showKpis(Number(btn.dataset.kpis)));
  });
  el.querySelectorAll('[data-delete-run]').forEach(btn => {
    btn.addEventListener('click', () => deleteRun(Number(btn.dataset.deleteRun)));
  });
}

// ─── Exécution + Polling ──────────────────────────────────────────────────────

async function executeRun(id) {
  const { error } = await schedulingApi.execute(id);
  if (error) {
    toast.error('Impossible de lancer le run : ' + (error.detail || 'Erreur serveur'));
    return;
  }
  toast.info('Calcul en cours…');
  await reloadRuns();
  startPollingIfNeeded();
}

function startPollingIfNeeded() {
  const hasRunning = _runs.some(r => r.status === 'running' || r.status === 'pending');
  if (!hasRunning) { stopPolling(); return; }
  if (_pollTimer) return;  // déjà en cours
  _pollTimer = setInterval(async () => {
    await reloadRuns();
    const stillRunning = _runs.some(r => r.status === 'running' || r.status === 'pending');
    if (!stillRunning) {
      stopPolling();
      const done = _runs.find(r => r.status === 'completed');
      if (done) toast.success(`Run "${done.name ?? `#${done.id}`}" terminé ! Cmax : ${fmtMin(done.cmax_minutes)}`);
    }
  }, 2000);
}

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

// ─── KPIs modal ──────────────────────────────────────────────────────────────

async function showKpis(id) {
  const { data, error } = await schedulingApi.kpis(id);
  if (error) { toast.error('Impossible de charger les KPIs'); return; }

  const run  = _runs.find(r => r.id === id);
  const kpis = data?.kpis ?? data ?? {};

  const rows = [
    ['Makespan (Cmax)',      fmtMin(run?.cmax_minutes ?? kpis.cmax_minutes)],
    ['Flux total',           fmtMin(run?.total_flow_time_minutes   ?? kpis.total_flow_time_minutes)],
    ['Retard moyen',         fmtMin(run?.average_tardiness_minutes ?? kpis.average_tardiness_minutes)],
    ['Taux utilisation',     kpis.utilization_rate ? `${(kpis.utilization_rate * 100).toFixed(1)} %` : '—'],
    ['Nb OFs traités',       kpis.jobs_count ?? '—'],
    ['Nb opérations',        kpis.operations_count ?? '—'],
  ].map(([k, v]) => `
    <div class="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <span class="text-sm text-gray-500">${k}</span>
      <span class="text-sm font-bold text-gray-900">${v}</span>
    </div>`).join('');

  openModal({
    title:   `KPIs — ${run?.name ?? `Run #${id}`}`,
    size:    'sm',
    content: `
      <div class="mb-3 flex items-center gap-2">
        ${algoChip(run?.algorithm)}
        <span class="text-xs text-gray-400">${fmtDateTime(run?.created_at)}</span>
      </div>
      <div class="bg-gray-50 rounded-xl px-4 py-2">${rows}</div>`,
    confirmLabel: 'Voir le Gantt',
    onConfirm: () => { closeModal(); window.location.hash = `#/gantt?run=${id}`; },
  });
}

// ─── Suppression ──────────────────────────────────────────────────────────────

async function deleteRun(id) {
  const run = _runs.find(r => r.id === id);
  if (!confirm(`Supprimer le run "${run?.name ?? `#${id}`}" ?`)) return;
  const { error } = await schedulingApi.delete(id);
  if (error) { toast.error('Suppression impossible : ' + (error.detail || '')); return; }
  toast.success('Run supprimé.');
  await reloadRuns();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WIZARD CRÉATION
// ═══════════════════════════════════════════════════════════════════════════════

function openWizard() {
  _step    = 1;
  _wName   = '';
  _wDesc   = '';
  _wAlgo   = '';
  _wJobIds = new Set();

  openModal({
    title:      'Nouveau run d\'ordonnancement',
    size:       'lg',
    hideFooter: true,   // Le wizard gère ses propres boutons dans le body
    content:    wizardFullContent(),
    onClose:    () => { /* rien */ },
  });

  setTimeout(bindWizardEvents, 30);
}

// ─── Contenu wizard ───────────────────────────────────────────────────────────

/**
 * wizardFullContent() — tout le wizard dans un seul bloc HTML :
 * stepper + contenu étape + boutons navigation.
 * Utilisé par openModal({ hideFooter: true, content: wizardFullContent() })
 */
function wizardFullContent() {
  return `
    <div id="wizard-wrap">
      ${wizardContent()}
      <div class="mt-6 pt-4 border-t border-gray-100">
        ${wizardFooter()}
      </div>
    </div>`;
}

function wizardContent() {
  return `
    <!-- Stepper -->
    <div class="flex items-center gap-0 mb-8">
      ${[['1','Informations'],['2','Algorithme'],['3','Sélection OFs']].map(([n, lbl], i) => {
        const num  = i + 1;
        const done = num < _step;
        const curr = num === _step;
        return `
          ${i > 0 ? `<div class="flex-1 h-px ${done ? 'bg-[#378ADD]' : 'bg-gray-200'} transition-colors"></div>` : ''}
          <div class="flex flex-col items-center gap-1 shrink-0">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                        ${done ? 'bg-[#378ADD] text-white' :
                          curr ? 'bg-[#378ADD] text-white ring-4 ring-[#378ADD]/20' :
                                 'bg-gray-100 text-gray-400'}">
              ${done ? '✓' : n}
            </div>
            <span class="text-xs font-medium whitespace-nowrap
                         ${curr ? 'text-[#378ADD]' : done ? 'text-gray-600' : 'text-gray-400'}">
              ${lbl}
            </span>
          </div>`;
      }).join('')}
    </div>

    <!-- Contenu étape -->
    <div id="wizard-step-body">
      ${_step === 1 ? step1HTML() : _step === 2 ? step2HTML() : step3HTML()}
    </div>`;
}

function wizardFooter() {
  return `
    <div class="flex items-center justify-between w-full">
      <button id="wiz-back"
              class="px-4 py-2 rounded-xl text-sm font-medium text-gray-500
                     hover:bg-gray-100 transition-all ${_step === 1 ? 'invisible' : ''}">
        ← Retour
      </button>
      <div class="flex items-center gap-2">
        <button id="wiz-cancel" class="px-4 py-2 rounded-xl text-sm font-medium text-gray-500
                                        hover:bg-gray-100 transition-all">
          Annuler
        </button>
        <button id="wiz-next"
                class="px-5 py-2 rounded-xl text-sm font-semibold bg-[#378ADD] text-white
                       hover:bg-[#185FA5] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          ${_step === 3 ? '🚀 Créer le run' : 'Suivant →'}
        </button>
      </div>
    </div>`;
}

// ─── Étape 1 — Informations ───────────────────────────────────────────────────

function step1HTML() {
  return `
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">
          Nom du run *
        </label>
        <input id="w-name" type="text" value="${_wName}"
               placeholder="Ex: Ordonnancement semaine 18 — SPT"
               class="${INPUT_CLS}"/>
        <p class="text-xs text-gray-400 mt-1">Un nom descriptif pour retrouver facilement ce run.</p>
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">
          Description <span class="font-normal text-gray-400">(optionnelle)</span>
        </label>
        <textarea id="w-desc" rows="3" class="${INPUT_CLS}"
                  placeholder="Contexte, objectif particulier, notes…">${_wDesc}</textarea>
      </div>
      <div id="step1-err" class="text-xs text-red-500 hidden">Le nom du run est obligatoire.</div>
    </div>`;
}

// ─── Étape 2 — Algorithme ─────────────────────────────────────────────────────

function step2HTML() {
  return `
    <div>
      <p class="text-sm text-gray-500 mb-4">
        Sélectionnez l'algorithme d'ordonnancement adapté à votre configuration d'atelier.
      </p>
      <div class="grid grid-cols-1 gap-3">
        ${ALGOS.map(a => algoCard(a)).join('')}
      </div>
      <div id="step2-err" class="text-xs text-red-500 mt-3 hidden">Veuillez sélectionner un algorithme.</div>
    </div>`;
}

function algoCard(a) {
  const selected = _wAlgo === a.value;
  const colorMap = {
    blue:   { ring: 'ring-[#378ADD]', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    purple: { ring: 'ring-purple-400', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    green:  { ring: 'ring-[#1D9E75]', badge: 'bg-green-50 text-green-700 border-green-200' },
    orange: { ring: 'ring-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
    teal:   { ring: 'ring-teal-400',   badge: 'bg-teal-50 text-teal-700 border-teal-200' },
    gray:   { ring: 'ring-gray-300',   badge: 'bg-gray-100 text-gray-600 border-gray-200' },
  };
  const col = colorMap[a.color] || colorMap.gray;

  return `
    <div data-algo="${a.value}"
         class="algo-card cursor-pointer rounded-xl border-2 p-4 transition-all duration-150
                ${selected
                  ? `border-[#378ADD] bg-[#EFF6FF] ${col.ring} ring-2`
                  : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'}">
      <div class="flex items-start gap-3">
        <div class="text-2xl mt-0.5 shrink-0">${a.icon}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-gray-900 text-sm">${a.label}</span>
            <span class="text-xs text-gray-400">— ${a.full}</span>
            ${selected
              ? `<span class="ml-auto shrink-0 w-5 h-5 rounded-full bg-[#378ADD] flex items-center justify-center">
                   <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                   </svg>
                 </span>`
              : ''}
          </div>
          <p class="text-xs text-gray-500 mt-1 leading-relaxed">${a.description}</p>
          ${a.constraint
            ? `<div class="mt-2 flex items-center gap-1.5 text-xs font-semibold
                          text-orange-700 bg-orange-50 border border-orange-100 px-2.5 py-1.5 rounded-lg">
                 ${a.constraint.label}
               </div>`
            : ''}
        </div>
      </div>
    </div>`;
}

// ─── Étape 3 — Sélection OFs ─────────────────────────────────────────────────

function step3HTML() {
  const algo = ALGO_MAP[_wAlgo];

  const items = _jobs.map(j => {
    const opCount = _opCounts[j.id] ?? '?';
    const warn    = getJobWarning(j, algo, opCount);
    const checked = _wJobIds.has(j.id);
    const hasErr  = warn?.type === 'error';
    const hasWarn = warn?.type === 'warn';

    return `
      <label for="jcheck-${j.id}"
             class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                    ${hasErr  ? 'border-red-200 bg-red-50'    :
                      hasWarn ? 'border-orange-200 bg-orange-50' :
                                'border-gray-100 bg-white hover:border-[#378ADD]/40 hover:bg-[#EFF6FF]/30'}">
        <input type="checkbox" id="jcheck-${j.id}" value="${j.id}"
               class="w-4 h-4 rounded mt-0.5 shrink-0 accent-[#378ADD]"
               ${checked ? 'checked' : ''}
               ${hasErr ? 'disabled' : ''}>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono font-bold text-xs text-[#378ADD] bg-blue-50 px-1.5 py-0.5 rounded">
              ${j.code}
            </span>
            <span class="text-sm font-semibold text-gray-800 truncate">${j.name}</span>
          </div>
          <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>${opCount} opération(s)</span>
            ${j.total_processing_time ? `<span>· ${fmtMin(j.total_processing_time)}</span>` : ''}
            ${j.due_date ? `<span>· Due : ${fmtDate(j.due_date)}</span>` : ''}
          </div>
          ${warn ? `
            <p class="text-xs font-medium mt-1.5 flex items-center gap-1
                      ${hasErr ? 'text-red-600' : 'text-orange-600'}">
              ${hasErr ? '🔴' : '🟠'} ${warn.msg}
            </p>` : ''}
        </div>
      </label>`;
  }).join('');

  const allValid   = canSubmit();
  const selCount   = _wJobIds.size;

  return `
    <div>
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-gray-500">
          Sélectionnez les OFs à inclure dans ce run.
          ${algo?.constraint
            ? `<br><span class="text-orange-600 font-medium text-xs">${algo.constraint.label}</span>`
            : ''}
        </p>
        <div class="flex items-center gap-2">
          <span id="sel-count" class="text-xs font-semibold text-[#378ADD]">
            ${selCount} sélectionné(s)
          </span>
          <button id="btn-select-all" class="text-xs text-gray-400 hover:text-gray-700 underline">
            Tout sélectionner
          </button>
        </div>
      </div>

      <div id="jobs-checklist" class="space-y-2 max-h-72 overflow-y-auto pr-1">
        ${_jobs.length === 0
          ? `<p class="text-sm text-gray-400 italic text-center py-8">
               Aucun OF actif disponible. Activez des OFs dans la section Jobs.
             </p>`
          : items}
      </div>

      <div id="step3-err" class="text-xs text-red-500 mt-2 hidden">
        Sélectionnez au moins un OF compatible avec l'algorithme choisi.
      </div>

      ${!allValid && _wJobIds.size > 0
        ? `<div class="mt-3 flex items-center gap-2 text-xs font-semibold text-red-600
                       bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">
             🚫 Certains OFs ne respectent pas les contraintes de l'algorithme <strong>${_wAlgo.toUpperCase()}</strong>.
             Désélectionnez-les ou choisissez un autre algorithme.
           </div>`
        : ''}
    </div>`;
}

function getJobWarning(job, algo, opCount) {
  if (!algo?.constraint) return null;
  const n = Number(opCount);
  if (isNaN(n)) return null;
  const { type, ops } = algo.constraint;
  if (type === 'exact' && n !== ops)
    return { type: 'error', msg: `Cet OF a ${n} opération(s) — ${algo.label} exige exactement ${ops}.` };
  if (type === 'min' && n < ops)
    return { type: 'warn', msg: `Cet OF a ${n} opération(s) — ${algo.label} recommande ${ops}+.` };
  return null;
}

function canSubmit() {
  if (_wJobIds.size === 0) return false;
  const algo = ALGO_MAP[_wAlgo];
  if (!algo?.constraint) return true;
  // Au moins un job sélectionné sans erreur bloquante
  for (const id of _wJobIds) {
    const j  = _jobs.find(x => x.id === id);
    const w  = getJobWarning(j, algo, _opCounts[id] ?? 0);
    if (w?.type === 'error') return false;
  }
  return true;
}

// ─── Événements wizard ────────────────────────────────────────────────────────

function bindWizardEvents() {
  document.getElementById('wiz-cancel')?.addEventListener('click', closeModal);
  document.getElementById('wiz-back')  ?.addEventListener('click', wizardBack);
  document.getElementById('wiz-next')  ?.addEventListener('click', wizardNext);

  // Algo cards
  document.querySelectorAll('.algo-card').forEach(card => {
    card.addEventListener('click', () => {
      _wAlgo = card.dataset.algo;
      refreshWizardBody();
    });
  });

  // Job checkboxes
  bindCheckboxes();

  // Select all
  document.getElementById('btn-select-all')?.addEventListener('click', () => {
    const algo = ALGO_MAP[_wAlgo];
    _jobs
      .filter(j => {
        const w = getJobWarning(j, algo, _opCounts[j.id] ?? 0);
        return !w || w.type !== 'error';
      })
      .forEach(j => _wJobIds.add(j.id));
    refreshWizardBody();
    bindWizardEvents();
  });
}

function bindCheckboxes() {
  document.querySelectorAll('#jobs-checklist input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = Number(cb.value);
      cb.checked ? _wJobIds.add(id) : _wJobIds.delete(id);
      const sc = document.getElementById('sel-count');
      if (sc) sc.textContent = `${_wJobIds.size} sélectionné(s)`;
      // rafraîchir le bouton submit
      const btn = document.getElementById('wiz-next');
      if (btn) btn.disabled = _step === 3 && !canSubmit();
    });
  });
}

function refreshWizardBody() {
  // Algo sélectionné : on re-render juste le body de l'étape courante
  const stepBody = document.getElementById('wizard-step-body');
  if (stepBody) {
    stepBody.innerHTML = _step === 1 ? step1HTML() : _step === 2 ? step2HTML() : step3HTML();
  }
  bindWizardEvents();
}

function wizardBack() {
  if (_step <= 1) return;
  _step--;
  refreshWizardContent();
}

function wizardNext() {
  if (_step === 1) {
    const name = document.getElementById('w-name')?.value?.trim();
    if (!name) {
      document.getElementById('step1-err')?.classList.remove('hidden');
      return;
    }
    _wName = name;
    _wDesc = document.getElementById('w-desc')?.value?.trim() ?? '';
    _step  = 2;
  } else if (_step === 2) {
    if (!_wAlgo) {
      document.getElementById('step2-err')?.classList.remove('hidden');
      return;
    }
    _step = 3;
  } else if (_step === 3) {
    if (!canSubmit()) {
      document.getElementById('step3-err')?.classList.remove('hidden');
      return;
    }
    submitRun();
    return;
  }
  refreshWizardContent();
}

function refreshWizardContent() {
  // Réinjecte tout le wizard dans .am-modal-body
  const modalBody = document.querySelector('.am-modal-body');
  if (modalBody) {
    modalBody.innerHTML = wizardFullContent();
  }
  setTimeout(bindWizardEvents, 30);
}

// ─── Soumission du run ────────────────────────────────────────────────────────

async function submitRun() {
  const btn = document.getElementById('wiz-next');
  if (btn) { btn.disabled = true; btn.textContent = 'Création…'; }

  const payload = {
    name:        _wName,
    description: _wDesc || undefined,
    algorithm:   _wAlgo,
    jobs:        [..._wJobIds],   // tableau d'IDs
  };

  const { data, error } = await schedulingApi.create(payload);

  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = '🚀 Créer le run'; }
    const msg = Object.entries(error)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' | ');
    toast.error(msg || 'Erreur lors de la création du run.');
    return;
  }

  closeModal();
  toast.success(`Run "${_wName}" créé ! Cliquez sur "Exécuter" pour lancer le calcul.`);
  _runs.unshift(data);
  renderRuns();

  // Propose d'exécuter immédiatement
  setTimeout(() => {
    const execBtn = document.querySelector(`[data-execute="${data.id}"]`);
    if (execBtn) {
      execBtn.classList.add('ring-2', 'ring-offset-1', 'ring-[#378ADD]', 'animate-bounce');
      setTimeout(() => execBtn.classList.remove('ring-2', 'ring-offset-1', 'ring-[#378ADD]', 'animate-bounce'), 2000);
    }
  }, 300);
}

// ─── Helpers visuels ─────────────────────────────────────────────────────────

function algoBadgeCls(color) {
  const map = {
    blue:   'bg-blue-50 text-blue-700 border border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border border-purple-100',
    green:  'bg-green-50 text-green-700 border border-green-100',
    orange: 'bg-orange-50 text-orange-700 border border-orange-100',
    teal:   'bg-teal-50 text-teal-700 border border-teal-100',
    gray:   'bg-gray-100 text-gray-600 border border-gray-200',
  };
  return map[color] || map.gray;
}

function algoChip(algo) {
  const a = ALGO_MAP[algo];
  if (!a) return '';
  return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold
                        ${algoBadgeCls(a.color)}">${a.icon} ${a.label}</span>`;
}

function fmtMin(min) {
  if (min == null || isNaN(Number(min))) return '—';
  const m = Number(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h}h` : `${h}h ${r}min`;
}

function fmtDateTime(str) {
  if (!str) return '—';
  try {
    return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(str));
  } catch { return str; }
}

function fmtDate(str) {
  if (!str) return '—';
  try { return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(new Date(str)); }
  catch { return str; }
}

function toArr(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function iTrash() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7
             m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
  </svg>`;
}

const INPUT_CLS = `w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50
  focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD]
  transition-all placeholder:text-gray-300`;
