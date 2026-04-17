/**
 * comparison.js — Comparaison multi-algorithmes AutoMaroc Scheduling
 *
 * Endpoints :
 *   GET  /api/scheduling/algorithms/
 *   POST /api/scheduling/compare/  → { job_ids, algorithms, ranking_metric }
 *   GET  /api/jobs/                → liste OFs actifs
 *   GET  /api/jobs/operations/     → nb opérations par OF
 */

import { schedulingApi, jobsApi, operationsApi } from '../services/api.js';
import { toast }                                  from '../components/toast.js';
import { setState, store }                         from '../utils/state.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ALGOS = [
  {
    value:       'spt',
    label:       'SPT',
    full:        'Shortest Processing Time',
    icon:        '⚡',
    description: 'Jobs les plus courts en premier — réduit le temps moyen.',
    constraint:  null,
    color:       '#378ADD',
  },
  {
    value:       'lpt',
    label:       'LPT',
    full:        'Longest Processing Time',
    icon:        '🏗️',
    description: 'Grosses pièces en priorité — optimise l\'utilisation des postes.',
    constraint:  null,
    color:       '#8B5CF6',
  },
  {
    value:       'edd',
    label:       'EDD',
    full:        'Earliest Due Date',
    icon:        '📅',
    description: 'Par date de livraison — respecte les délais clients.',
    constraint:  null,
    color:       '#1D9E75',
  },
  {
    value:       'johnson',
    label:       'Johnson',
    full:        'Algorithme de Johnson',
    icon:        '🏆',
    description: 'Optimal pour exactement 2 postes en séquence.',
    constraint:  { type: 'exact', ops: 2, msg: '2 opérations exactement' },
    color:       '#F59E0B',
  },
  {
    value:       'cds',
    label:       'CDS',
    full:        'Campbell-Dudek-Smith',
    icon:        '🧮',
    description: 'Généralise Johnson sur 3+ postes (Flow Shop).',
    constraint:  { type: 'min', ops: 3, msg: '3+ opérations minimum' },
    color:       '#06B6D4',
  },
];

const ALGO_MAP   = Object.fromEntries(ALGOS.map(a => [a.value, a]));

const METRICS = [
  { value: 'cmax_minutes',               label: 'Cmax',       sub: 'Makespan total',        icon: '⏱' },
  { value: 'total_flow_time_minutes',    label: 'Flow Time',  sub: 'Temps de passage total', icon: '🔄' },
  { value: 'average_tardiness_minutes',  label: 'Tardiness',  sub: 'Retard moyen',           icon: '⏰' },
];

// ─── État local ───────────────────────────────────────────────────────────────

let _step       = 1;           // 1 | 2
let _jobs       = [];
let _opCounts   = {};          // { jobId → nb ops }
let _selJobs    = new Set();
let _selAlgos   = new Set();
let _metric     = 'cmax_minutes';
let _results    = [];          // tableau classement

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = buildShell();
  await loadJobs();
  renderStep();
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function buildShell() {
  return `
    <!-- HEADER -->
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Comparaison d'algorithmes</h2>
      <p class="text-sm text-gray-500 mt-0.5">Comparez les performances de plusieurs algorithmes sur les mêmes OFs</p>
    </div>

    <!-- STEPPER -->
    <div id="comp-stepper" class="flex items-center gap-0 mb-8"></div>

    <!-- CONTENU ÉTAPE -->
    <div id="comp-body"></div>
  `;
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function renderStepper() {
  const el = document.getElementById('comp-stepper');
  if (!el) return;

  const steps = ['Configuration', 'Résultats'];
  el.innerHTML = steps.map((lbl, i) => {
    const num  = i + 1;
    const done = num < _step;
    const curr = num === _step;
    return `
      ${i > 0 ? `<div class="flex-1 h-0.5 mx-2 transition-all duration-500
                             ${done ? 'bg-[#378ADD]' : 'bg-gray-200'}"></div>` : ''}
      <div class="flex flex-col items-center gap-1.5 shrink-0">
        <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                    transition-all duration-300
                    ${done ? 'bg-[#378ADD] text-white scale-90' :
                      curr ? 'bg-[#378ADD] text-white ring-4 ring-[#378ADD]/20' :
                             'bg-gray-100 text-gray-400'}">
          ${done ? '✓' : num}
        </div>
        <span class="text-xs font-semibold whitespace-nowrap
                     ${curr ? 'text-[#378ADD]' : done ? 'text-gray-600' : 'text-gray-400'}">
          ${lbl}
        </span>
      </div>`;
  }).join('');
}

// ─── Rendu principal ─────────────────────────────────────────────────────────

function renderStep() {
  renderStepper();
  const el = document.getElementById('comp-body');
  if (!el) return;
  el.innerHTML = '';

  if (_step === 1) renderStep1(el);
  else             renderStep2(el);
}

// ─── Chargement OFs ──────────────────────────────────────────────────────────

async function loadJobs() {
  const [rJobs] = await Promise.all([
    jobsApi.list({ page_size: 500 }),
  ]);
  _jobs = toArr(rJobs.data).filter(j => j.is_active);

  // Charge nb opérations en parallèle
  if (_jobs.length > 0) {
    const results = await Promise.all(
      _jobs.map(j => operationsApi.list({ job: j.id, page_size: 200 }))
    );
    results.forEach((r, i) => {
      _opCounts[_jobs[i].id] = toArr(r.data).length;
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ÉTAPE 1 — FORMULAIRE
// ═══════════════════════════════════════════════════════════════════════════

function renderStep1(container) {
  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

      <!-- COL GAUCHE : OFs + Algorithmes -->
      <div class="lg:col-span-2 space-y-5">

        <!-- SÉLECTION OFs -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 class="font-semibold text-gray-800">Ordres de Fabrication</h3>
              <p class="text-xs text-gray-400 mt-0.5">Sélectionnez les OFs à comparer</p>
            </div>
            <div class="flex items-center gap-2">
              <span id="job-sel-count" class="text-xs font-semibold text-[#378ADD]">0 sélectionné(s)</span>
              <button id="btn-sel-all-jobs"
                      class="text-xs text-gray-400 hover:text-gray-700 underline">
                Tout sélectionner
              </button>
            </div>
          </div>
          <div id="jobs-list" class="max-h-64 overflow-y-auto divide-y divide-gray-50 p-2">
            ${_jobs.length === 0
              ? `<p class="text-sm text-gray-400 italic text-center py-8">
                   Aucun OF actif — activez des OFs dans la section Jobs.
                 </p>`
              : _jobs.map(j => jobRow(j)).join('')}
          </div>
        </div>

        <!-- SÉLECTION ALGORITHMES -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 class="font-semibold text-gray-800 mb-1">Algorithmes à comparer</h3>
          <p class="text-xs text-gray-400 mb-4">Sélectionnez au moins 2 algorithmes</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${ALGOS.map(a => algoCard(a)).join('')}
          </div>
        </div>
      </div>

      <!-- COL DROITE : Métrique + Avertissements + Bouton -->
      <div class="space-y-5">

        <!-- MÉTRIQUE -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 class="font-semibold text-gray-800 mb-1">Critère de classement</h3>
          <p class="text-xs text-gray-400 mb-4">Minimiser quel indicateur ?</p>
          <div class="space-y-2">
            ${METRICS.map(m => metricRadio(m)).join('')}
          </div>
        </div>

        <!-- AVERTISSEMENTS DYNAMIQUES -->
        <div id="warnings-box" class="hidden bg-orange-50 border border-orange-200
                                       rounded-2xl p-4 text-sm text-orange-800 space-y-2"></div>

        <!-- RÉSUMÉ SÉLECTION -->
        <div class="bg-gray-50 rounded-2xl border border-gray-100 p-4 text-xs text-gray-600 space-y-1.5">
          <div class="flex justify-between">
            <span>OFs sélectionnés</span>
            <span id="summary-jobs" class="font-semibold text-gray-900">0</span>
          </div>
          <div class="flex justify-between">
            <span>Algorithmes</span>
            <span id="summary-algos" class="font-semibold text-gray-900">0</span>
          </div>
          <div class="flex justify-between">
            <span>Métrique</span>
            <span id="summary-metric" class="font-semibold text-gray-900">Cmax</span>
          </div>
        </div>

        <!-- BOUTON LANCER -->
        <button id="btn-run-compare"
                class="w-full py-3 rounded-xl font-semibold text-sm bg-[#378ADD] text-white
                       hover:bg-[#185FA5] shadow-sm transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed">
          🚀 Lancer la comparaison
        </button>

        <p id="form-err" class="text-xs text-red-500 text-center hidden">
          Sélectionnez au moins 2 algorithmes et 1 OF valide.
        </p>
      </div>
    </div>`;

  bindStep1Events();
}

// ─── Row OF ──────────────────────────────────────────────────────────────────

function jobRow(j) {
  const opCount = _opCounts[j.id] ?? '?';
  const warn    = getJobWarnings(j, opCount);
  const checked = _selJobs.has(j.id);

  return `
    <label for="jcomp-${j.id}"
           class="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all
                  hover:bg-[#EFF6FF]/50 ${warn.length ? 'bg-orange-50/60' : ''}">
      <input type="checkbox" id="jcomp-${j.id}" value="${j.id}"
             class="w-4 h-4 mt-0.5 shrink-0 accent-[#378ADD]"
             ${checked ? 'checked' : ''}>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono font-bold text-xs text-[#378ADD] bg-blue-50
                       px-1.5 py-0.5 rounded">
            ${j.code}
          </span>
          <span class="text-sm font-semibold text-gray-800 truncate">${j.name}</span>
        </div>
        <div class="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
          <span>${opCount} op.</span>
          ${j.total_processing_time ? `<span>· ${fmtMin(j.total_processing_time)}</span>` : ''}
        </div>
        ${warn.length
          ? `<p class="text-xs text-orange-600 font-medium mt-1">
               ⚠ ${warn.join(' · ')}
             </p>`
          : ''}
      </div>
    </label>`;
}

/** Retourne les warnings pour un job selon les algos sélectionnés */
function getJobWarnings(job, opCount) {
  const n    = Number(opCount);
  const msgs = [];
  if (_selAlgos.has('johnson') && !isNaN(n) && n !== 2)
    msgs.push(`Johnson exige 2 ops (cet OF en a ${n})`);
  if (_selAlgos.has('cds') && !isNaN(n) && n < 3)
    msgs.push(`CDS exige 3+ ops (cet OF en a ${n})`);
  return msgs;
}

// ─── Card algorithme ──────────────────────────────────────────────────────────

function algoCard(a) {
  const sel = _selAlgos.has(a.value);
  return `
    <div data-algo-card="${a.value}"
         class="algo-compare-card cursor-pointer rounded-xl border-2 p-3 transition-all duration-150
                ${sel
                  ? 'border-[#378ADD] bg-[#EFF6FF] ring-2 ring-[#378ADD]/15'
                  : 'border-gray-100 bg-white hover:border-gray-300'}">
      <div class="flex items-start gap-2.5">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
             style="background:${a.color}15">
          ${a.icon}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-gray-900">${a.label}</span>
            ${sel
              ? `<span class="w-4 h-4 rounded-full bg-[#378ADD] flex items-center justify-center ml-auto shrink-0">
                   <svg class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                   </svg>
                 </span>`
              : ''}
          </div>
          <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">${a.description}</p>
          ${a.constraint
            ? `<span class="inline-flex items-center gap-1 text-xs font-semibold
                            text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg mt-1.5">
                 ⚠ ${a.constraint.msg}
               </span>`
            : ''}
        </div>
      </div>
    </div>`;
}

// ─── Radio métrique ──────────────────────────────────────────────────────────

function metricRadio(m) {
  const sel = _metric === m.value;
  return `
    <label for="metric-${m.value}"
           class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer
                  transition-all ${sel ? 'border-[#378ADD] bg-[#EFF6FF]' : 'border-gray-100 bg-white hover:border-gray-300'}">
      <input type="radio" id="metric-${m.value}" name="metric" value="${m.value}"
             class="accent-[#378ADD] w-4 h-4 shrink-0" ${sel ? 'checked' : ''}>
      <div>
        <p class="text-sm font-semibold text-gray-800">${m.icon} ${m.label}</p>
        <p class="text-xs text-gray-400">${m.sub}</p>
      </div>
    </label>`;
}

// ─── Événements step 1 ────────────────────────────────────────────────────────

function bindStep1Events() {
  // Checkboxes OFs
  document.querySelectorAll('#jobs-list input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = Number(cb.value);
      cb.checked ? _selJobs.add(id) : _selJobs.delete(id);
      updateSummary();
      refreshJobWarnings();
    });
  });

  // Tout sélectionner
  document.getElementById('btn-sel-all-jobs')?.addEventListener('click', () => {
    _jobs.forEach(j => _selJobs.add(j.id));
    document.querySelectorAll('#jobs-list input[type=checkbox]')
      .forEach(cb => { cb.checked = true; });
    updateSummary();
    refreshJobWarnings();
  });

  // Cards algorithmes
  document.querySelectorAll('.algo-compare-card').forEach(card => {
    card.addEventListener('click', () => {
      const v = card.dataset.algoCard;
      _selAlgos.has(v) ? _selAlgos.delete(v) : _selAlgos.add(v);
      // Re-render cards
      document.querySelectorAll('.algo-compare-card').forEach(c => {
        const a   = ALGO_MAP[c.dataset.algoCard];
        const sel = _selAlgos.has(a.value);
        c.className = `algo-compare-card cursor-pointer rounded-xl border-2 p-3 transition-all duration-150
          ${sel ? 'border-[#378ADD] bg-[#EFF6FF] ring-2 ring-[#378ADD]/15' : 'border-gray-100 bg-white hover:border-gray-300'}`;
        // Tick
        const icon = c.querySelector('.check-icon');
        if (!icon) {
          const nameSpan = c.querySelector('.font-bold');
          if (sel && nameSpan) {
            const tick = document.createElement('span');
            tick.className = 'check-icon w-4 h-4 rounded-full bg-[#378ADD] flex items-center justify-center ml-auto shrink-0';
            tick.innerHTML = `<svg class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>`;
            nameSpan.parentElement.appendChild(tick);
          }
        } else {
          if (!sel) icon.remove();
        }
      });
      updateSummary();
      refreshJobWarnings();
      updateConstraintWarnings();
    });
  });

  // Radios métrique
  document.querySelectorAll('input[name=metric]').forEach(r => {
    r.addEventListener('change', () => {
      _metric = r.value;
      // Mise à jour style visuel des labels
      document.querySelectorAll('input[name=metric]').forEach(x => {
        const lbl = x.closest('label');
        if (!lbl) return;
        const sel = x.value === _metric;
        lbl.className = `flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
          ${sel ? 'border-[#378ADD] bg-[#EFF6FF]' : 'border-gray-100 bg-white hover:border-gray-300'}`;
      });
      updateSummary();
    });
  });

  // Bouton lancer
  document.getElementById('btn-run-compare')?.addEventListener('click', runComparison);

  updateSummary();
}

function updateSummary() {
  const countEl  = document.getElementById('job-sel-count');
  const sumJobs  = document.getElementById('summary-jobs');
  const sumAlgos = document.getElementById('summary-algos');
  const sumMetric= document.getElementById('summary-metric');

  if (countEl)  countEl.textContent  = `${_selJobs.size} sélectionné(s)`;
  if (sumJobs)  sumJobs.textContent  = _selJobs.size;
  if (sumAlgos) sumAlgos.textContent = _selAlgos.size;
  if (sumMetric)sumMetric.textContent= METRICS.find(m => m.value === _metric)?.label ?? '—';

  const btn = document.getElementById('btn-run-compare');
  if (btn) btn.disabled = !canRun();
}

function canRun() {
  if (_selJobs.size === 0)  return false;
  if (_selAlgos.size < 2)   return false;
  // Vérif contraintes bloquantes Johnson
  if (_selAlgos.has('johnson')) {
    for (const id of _selJobs) {
      const n = Number(_opCounts[id] ?? 0);
      if (n !== 2) return false;
    }
  }
  return true;
}

function refreshJobWarnings() {
  // Recolorie les lignes jobs selon les nouvelles contraintes
  document.querySelectorAll('#jobs-list label').forEach(lbl => {
    const cb = lbl.querySelector('input[type=checkbox]');
    if (!cb) return;
    const j    = _jobs.find(x => String(x.id) === String(cb.value));
    if (!j) return;
    const warns = getJobWarnings(j, _opCounts[j.id] ?? '?');
    const wEl   = lbl.querySelector('.text-orange-600');
    if (warns.length && !wEl) {
      const p = document.createElement('p');
      p.className = 'text-xs text-orange-600 font-medium mt-1';
      p.textContent = `⚠ ${warns.join(' · ')}`;
      lbl.querySelector('.flex-1')?.appendChild(p);
    } else if (!warns.length && wEl) {
      wEl.remove();
    } else if (warns.length && wEl) {
      wEl.textContent = `⚠ ${warns.join(' · ')}`;
    }
  });
}

function updateConstraintWarnings() {
  const box    = document.getElementById('warnings-box');
  if (!box) return;
  const warns  = [];
  if (_selAlgos.has('johnson')) warns.push('⚠ Johnson sélectionné — tous les OFs doivent avoir exactement 2 opérations.');
  if (_selAlgos.has('cds'))     warns.push('⚠ CDS sélectionné — les OFs doivent avoir au moins 3 opérations.');

  if (warns.length) {
    box.classList.remove('hidden');
    box.innerHTML = warns.map(w => `<p>${w}</p>`).join('');
  } else {
    box.classList.add('hidden');
  }
}

// ─── Lancer la comparaison ────────────────────────────────────────────────────

async function runComparison() {
  const btn = document.getElementById('btn-run-compare');
  if (!canRun()) {
    document.getElementById('form-err')?.classList.remove('hidden');
    return;
  }
  document.getElementById('form-err')?.classList.add('hidden');

  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Comparaison en cours…'; }

  const payload = {
    job_ids:        [..._selJobs],
    algorithms:     [..._selAlgos],
    ranking_metric: _metric,
  };

  const { data, error } = await schedulingApi.compare(payload);

  if (btn) { btn.disabled = false; btn.innerHTML = '🚀 Lancer la comparaison'; }

  if (error || !data) {
    toast.error('Erreur lors de la comparaison — vérifiez que le backend est actif.');
    return;
  }

  // data = { results: [...], ranking_metric }
  _results = data.results ?? data ?? [];
  _step    = 2;
  renderStep();
}

// ═══════════════════════════════════════════════════════════════════════════
//  ÉTAPE 2 — RÉSULTATS
// ═══════════════════════════════════════════════════════════════════════════

function renderStep2(container) {
  if (_results.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
        <div class="text-4xl mb-3">🤔</div>
        <p class="font-semibold text-gray-700">Aucun résultat disponible</p>
        <button onclick="window.location.reload()"
                class="mt-4 px-4 py-2 rounded-xl bg-[#378ADD] text-white text-sm font-semibold">
          Recommencer
        </button>
      </div>`;
    return;
  }

  // Tri par métrique choisie (croissant = meilleur)
  const sorted = [..._results].sort((a, b) =>
    (a[_metric] ?? Infinity) - (b[_metric] ?? Infinity)
  );
  const best = sorted[0];

  container.innerHTML = `
    <!-- Actions haut -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div>
        <h3 class="font-semibold text-gray-800 text-lg">Résultats de la comparaison</h3>
        <p class="text-xs text-gray-400 mt-0.5">
          Classement par : <strong>${METRICS.find(m => m.value === _metric)?.label ?? _metric}</strong>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button id="btn-back-config"
                class="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200
                       text-gray-600 hover:bg-gray-100 transition-all">
          ← Reconfigurer
        </button>
        <button id="btn-use-best"
                class="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold
                       bg-[#378ADD] text-white hover:bg-[#185FA5] shadow-sm transition-all">
          🚀 Créer un run avec ${ALGO_MAP[best.algorithm]?.label ?? best.algorithm}
        </button>
      </div>
    </div>

    <!-- TABLE CLASSEMENT -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-[#F9FAFB] border-b border-gray-100">
            ${['Rang','Algorithme','Cmax','Flow Time','Retard moy.','Statut']
              .map(h => `<th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">${h}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${sorted.map((res, i) => rankRow(res, i + 1, res === best)).join('')}
        </tbody>
      </table>
    </div>

    <!-- GRAPHE barres groupées -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
      <h3 class="font-semibold text-gray-800 mb-1">Visualisation comparative</h3>
      <p class="text-xs text-gray-400 mb-4">
        Comparaison des 3 métriques par algorithme — valeurs en minutes
      </p>
      <div style="height:280px; position:relative">
        <canvas id="compare-chart"></canvas>
      </div>
    </div>

    <!-- Conseil optimal -->
    ${bestAdvice(best)}
  `;

  // Events
  document.getElementById('btn-back-config')?.addEventListener('click', () => {
    _step = 1; renderStep();
  });
  document.getElementById('btn-use-best')?.addEventListener('click', () => {
    setState('preferredAlgo', best.algorithm);
    window.location.hash = '#/scheduling';
    toast.info(`Algo ${ALGO_MAP[best.algorithm]?.label ?? best.algorithm} pré-sélectionné dans le wizard.`);
  });

  // Graphe
  ensureChartJs().then(() => renderCompareChart(sorted));
}

// ─── Ligne tableau ────────────────────────────────────────────────────────────

function rankRow(res, rank, isBest) {
  const algo     = ALGO_MAP[res.algorithm] || { label: res.algorithm, icon: '📐', color: '#9CA3AF' };
  const success  = res.status === 'success' || (res.status == null && res.cmax_minutes != null);
  const failed   = !success;

  return `
    <tr class="border-b border-gray-50 transition-colors
               ${isBest ? 'bg-[#FFFBEB]' : 'hover:bg-gray-50'}">
      <!-- Rang -->
      <td class="px-5 py-4">
        ${rank === 1
          ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold
                          bg-yellow-100 text-yellow-800 border border-yellow-200">
               🥇 Optimal
             </span>`
          : rank === 2
            ? `<span class="text-sm font-bold text-gray-500">🥈 ${rank}</span>`
            : rank === 3
              ? `<span class="text-sm font-bold text-gray-500">🥉 ${rank}</span>`
              : `<span class="text-sm font-semibold text-gray-400">${rank}</span>`}
      </td>

      <!-- Algorithme -->
      <td class="px-5 py-4">
        <div class="flex items-center gap-2">
          <span class="text-xl">${algo.icon}</span>
          <div>
            <p class="font-bold text-gray-900 text-sm">${algo.label}</p>
            <p class="text-xs text-gray-400">${algo.full ?? ''}</p>
          </div>
        </div>
      </td>

      <!-- Métriques -->
      <td class="px-5 py-4">
        ${metricCell(res.cmax_minutes, _metric === 'cmax_minutes' && isBest)}
      </td>
      <td class="px-5 py-4">
        ${metricCell(res.total_flow_time_minutes, _metric === 'total_flow_time_minutes' && isBest)}
      </td>
      <td class="px-5 py-4">
        ${metricCell(res.average_tardiness_minutes, _metric === 'average_tardiness_minutes' && isBest)}
      </td>

      <!-- Statut -->
      <td class="px-5 py-4">
        ${success
          ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                          bg-green-50 text-green-700 border border-green-100">
               ✓ Succès
             </span>`
          : `<div>
               <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                             bg-red-50 text-red-600 border border-red-100">
                 ✕ Échec
               </span>
               ${res.error_message
                 ? `<p class="text-xs text-red-500 mt-1 max-w-[140px] truncate">${res.error_message}</p>`
                 : ''}
             </div>`}
      </td>
    </tr>`;
}

function metricCell(val, highlight) {
  if (val == null) return `<span class="text-gray-300">—</span>`;
  return `<span class="font-${highlight ? 'extrabold' : 'semibold'}
                   text-${highlight ? '[#1D9E75]' : 'gray-700'}
                   ${highlight ? 'text-base' : 'text-sm'}">
    ${fmtMin(val)}
  </span>`;
}

// ─── Conseil algo optimal ─────────────────────────────────────────────────────

function bestAdvice(best) {
  const a = ALGO_MAP[best.algorithm];
  if (!a) return '';
  return `
    <div class="bg-[#EFF6FF] border border-blue-100 rounded-2xl p-5">
      <div class="flex items-start gap-3">
        <span class="text-2xl">${a.icon}</span>
        <div>
          <h4 class="font-bold text-gray-800 mb-1">
            Recommandation : <span class="text-[#378ADD]">${a.label} — ${a.full}</span>
          </h4>
          <p class="text-sm text-gray-600">${a.description}</p>
          <p class="text-xs text-gray-400 mt-2">
            Cmax obtenu : <strong>${fmtMin(best.cmax_minutes)}</strong>
            ${best.average_tardiness_minutes != null
              ? ` · Retard moyen : <strong>${fmtMin(best.average_tardiness_minutes)}</strong>`
              : ''}
          </p>
        </div>
      </div>
    </div>`;
}

// ─── Graphe barres groupées ───────────────────────────────────────────────────

async function ensureChartJs() {
  if (window.Chart) return;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src   = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function renderCompareChart(sorted) {
  const ctx = document.getElementById('compare-chart');
  if (!ctx || !window.Chart) return;

  const labels   = sorted.map(r => ALGO_MAP[r.algorithm]?.label ?? r.algorithm);
  const colors   = sorted.map(r => ALGO_MAP[r.algorithm]?.color ?? '#9CA3AF');
  const datasets = [
    {
      label:           'Cmax (min)',
      data:            sorted.map(r => r.cmax_minutes ?? 0),
      backgroundColor: colors.map(c => c + 'CC'),
      borderColor:     colors,
      borderWidth:     2,
      borderRadius:    6,
    },
    {
      label:           'Flow Time (min)',
      data:            sorted.map(r => r.total_flow_time_minutes ?? 0),
      backgroundColor: colors.map(c => c + '77'),
      borderColor:     colors,
      borderWidth:     1.5,
      borderRadius:    6,
      borderDash:      [4, 4],
    },
    {
      label:           'Retard moy. (min)',
      data:            sorted.map(r => r.average_tardiness_minutes ?? 0),
      backgroundColor: colors.map(() => '#EF444455'),
      borderColor:     colors.map(() => '#EF4444'),
      borderWidth:     1.5,
      borderRadius:    6,
    },
  ];

  new window.Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display:  true,
          position: 'top',
          labels:   { font: { size: 11 }, boxWidth: 12, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmtMin(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 12 }, color: '#374151' },
        },
        y: {
          grid:  { color: '#F3F4F6' },
          ticks: {
            font: { size: 11 }, color: '#6B7280',
            callback: v => `${v} min`,
          },
          beginAtZero: true,
        },
      },
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toArr(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function fmtMin(min) {
  if (min == null || isNaN(Number(min))) return '—';
  const m = Number(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h}h` : `${h}h ${r}min`;
}
