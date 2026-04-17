/**
 * operations.js — Opérations & Gammes opératoires
 *
 * GET    /api/jobs/operations/        → liste paginée
 * GET    /api/jobs/                   → pour les selects
 * GET    /api/machines/               → pour les selects
 * POST   /api/jobs/operations/        → créer
 * PATCH  /api/jobs/operations/{id}/   → modifier
 * DELETE /api/jobs/operations/{id}/   → supprimer
 *
 * Champs : id, job, machine, sequence_order,
 *          processing_time_minutes, setup_time_minutes, transfer_time_minutes
 */

import { operationsApi, jobsApi, machinesApi } from '../services/api.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { toast }                              from '../components/toast.js';

// ─── État local ───────────────────────────────────────────────────────────────

let _ops      = [];   // toutes les opérations
let _jobs     = [];   // tous les jobs
let _machines = [];   // toutes les machines

let _filterJob     = '';
let _filterMachine = '';
let _view          = 'list';   // 'list' | 'byJob'

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = buildShell();
  bindEvents(container);
  await loadAll();
}

// ─── Chargement parallèle ─────────────────────────────────────────────────────

async function loadAll() {
  setLoading(true);

  const [rOps, rJobs, rMachines] = await Promise.all([
    operationsApi.list({ page_size: 500 }),
    jobsApi.list({ page_size: 500 }),
    machinesApi.list({ page_size: 500 }),
  ]);

  const errs = [rOps, rJobs, rMachines]
    .filter(r => r.error)
    .map(r => r.error?.detail);

  if (errs.length) {
    toast.error('Erreur chargement : ' + (errs[0] || 'Backend inaccessible'));
  }

  _ops      = toArr(rOps.data);
  _jobs     = toArr(rJobs.data);
  _machines = toArr(rMachines.data);

  setLoading(false);
  populateSelects();
  renderContent();
  updateSubtitle();
}

async function reloadOps() {
  const { data, error } = await operationsApi.list({ page_size: 500 });
  if (error) { toast.error('Rechargement impossible'); return; }
  _ops = toArr(data);
  renderContent();
  updateSubtitle();
}

function toArr(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function buildShell() {
  return `
    <!-- HEADER -->
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Opérations & Gammes</h2>
        <p id="ops-subtitle" class="text-sm text-gray-500 mt-1">Chargement…</p>
      </div>
      <button id="btn-new-op"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                     bg-[#378ADD] text-white hover:bg-[#185FA5] shadow-sm transition-all shrink-0">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
        </svg>
        Nouvelle opération
      </button>
    </div>

    <!-- FILTRES -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5
                flex flex-wrap items-center gap-3">
      <select id="f-job"     class="${SEL}" style="min-width:200px">
        <option value="">🗂 Tous les OFs</option>
      </select>
      <select id="f-machine" class="${SEL}" style="min-width:200px">
        <option value="">⚙️ Toutes les machines</option>
      </select>

      <div class="flex-1"></div>

      <!-- Toggle vue -->
      <div class="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
        <button id="btn-view-list"  title="Vue liste"
                class="view-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                       font-medium transition-all bg-white shadow text-[#378ADD]">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          </svg>
          Liste
        </button>
        <button id="btn-view-job"   title="Vue par OF"
                class="view-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                       font-medium transition-all text-gray-500">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2
                     m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2
                     M7 7h10"/>
          </svg>
          Par OF
        </button>
      </div>
    </div>

    <!-- CONTENU -->
    <div id="ops-content"></div>
  `;
}

// ─── Binding événements ───────────────────────────────────────────────────────

function bindEvents(container) {
  container.querySelector('#btn-new-op')
    ?.addEventListener('click', () => openOpModal());

  container.querySelector('#f-job')?.addEventListener('change', e => {
    _filterJob = e.target.value; renderContent();
  });
  container.querySelector('#f-machine')?.addEventListener('change', e => {
    _filterMachine = e.target.value; renderContent();
  });

  container.querySelector('#btn-view-list')?.addEventListener('click', () => setView('list'));
  container.querySelector('#btn-view-job') ?.addEventListener('click', () => setView('byJob'));

  window.addEventListener('automaroc:refresh', loadAll);
}

function setView(v) {
  _view = v;
  ['list','job'].forEach(n => {
    const btn = document.getElementById(`btn-view-${n}`);
    if (!btn) return;
    const active = (n === 'list' && v === 'list') || (n === 'job' && v === 'byJob');
    btn.className = `view-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
      font-medium transition-all ${active ? 'bg-white shadow text-[#378ADD]' : 'text-gray-500'}`;
  });
  renderContent();
}

// ─── Populate selects ─────────────────────────────────────────────────────────

function populateSelects() {
  const fJob = document.getElementById('f-job');
  const fMac = document.getElementById('f-machine');

  if (fJob) {
    _jobs.forEach(j => {
      const o = document.createElement('option');
      o.value = j.id;
      o.textContent = `${j.code} — ${j.name}`;
      fJob.appendChild(o);
    });
  }

  if (fMac) {
    _machines.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = `${m.code} — ${m.name}`;
      fMac.appendChild(o);
    });
  }
}

// ─── Filtrage ─────────────────────────────────────────────────────────────────

function filtered() {
  return _ops.filter(op => {
    const jId = op.job?.id ?? op.job;
    const mId = op.machine?.id ?? op.machine;
    const matchJ = !_filterJob     || String(jId) === String(_filterJob);
    const matchM = !_filterMachine || String(mId) === String(_filterMachine);
    return matchJ && matchM;
  });
}

// ─── Sous-titre ───────────────────────────────────────────────────────────────

function updateSubtitle() {
  const el = document.getElementById('ops-subtitle');
  if (!el) return;
  const jobCount = new Set(_ops.map(o => o.job?.id ?? o.job)).size;
  el.textContent = `${_ops.length} opérations — ${jobCount} OF(s) configurés`;
}

// ─── Loading state ────────────────────────────────────────────────────────────

function setLoading(on) {
  const el = document.getElementById('ops-content');
  if (!el || !on) return;
  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      ${[...Array(5)].map(() => `
        <div class="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
          <div class="h-5 bg-gray-100 rounded-lg  w-16 animate-pulse"></div>
          <div class="h-5 bg-gray-100 rounded-lg  w-20 animate-pulse"></div>
          <div class="h-6 bg-gray-100 rounded-full w-6 animate-pulse"></div>
          <div class="h-4 bg-gray-100 rounded     w-16 animate-pulse ml-auto"></div>
        </div>`).join('')}
    </div>`;
}

// ─── Rendu principal ─────────────────────────────────────────────────────────

function renderContent() {
  const el = document.getElementById('ops-content');
  if (!el) return;
  const data = filtered();
  if (data.length === 0) { el.innerHTML = emptyState(); return; }
  el.innerHTML = _view === 'list' ? buildListView(data) : buildByJobView(data);
  bindRowActions(el);
}

// ─── Vue LISTE ────────────────────────────────────────────────────────────────

function buildListView(ops) {
  const sorted = [...ops].sort((a, b) => {
    const ja = jobName(a.job); const jb = jobName(b.job);
    if (ja !== jb) return ja.localeCompare(jb, 'fr');
    return (a.sequence_order ?? 0) - (b.sequence_order ?? 0);
  });

  const rows = sorted.map(op => {
    const proc  = Number(op.processing_time_minutes ?? 0);
    const setup = Number(op.setup_time_minutes       ?? 0);
    const trans = Number(op.transfer_time_minutes    ?? 0);
    const total = proc + setup + trans;
    const j     = resolveJob(op.job);
    const m     = resolveMachine(op.machine);

    return `
      <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors group">
        <td class="px-5 py-3.5 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-[#378ADD]
                       rounded-full text-xs font-bold font-mono border border-blue-100">
            ${j?.code ?? '—'}
          </span>
          ${j ? `<p class="text-xs text-gray-400 mt-0.5 truncate max-w-[120px]">${j.name}</p>` : ''}
        </td>
        <td class="px-5 py-3.5 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#ECFDF5] text-[#065F46]
                       rounded-full text-xs font-bold font-mono border border-green-100">
            ${m?.code ?? '—'}
          </span>
          ${m ? `<p class="text-xs text-gray-400 mt-0.5 truncate max-w-[120px]">${m.name}</p>` : ''}
        </td>
        <td class="px-5 py-3.5 text-center">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                       bg-gray-100 text-gray-700 border border-gray-200">
            ${op.sequence_order ?? '—'}
          </span>
        </td>
        <td class="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">${fmtMin(proc)}</td>
        <td class="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">${setup ? fmtMin(setup) : '—'}</td>
        <td class="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">${trans ? fmtMin(trans) : '—'}</td>
        <td class="px-5 py-3.5 whitespace-nowrap">
          <span class="font-bold text-sm text-gray-800">${fmtMin(total)}</span>
        </td>
        <td class="px-5 py-3.5 whitespace-nowrap">
          <div class="flex items-center justify-end gap-1
                      opacity-0 group-hover:opacity-100 transition-opacity">
            <button data-edit="${op.id}" title="Modifier"
                    class="p-1.5 rounded-lg text-gray-400 hover:text-[#378ADD]
                           hover:bg-[#378ADD]/10 transition-all">
              ${iEdit()}
            </button>
            <button data-delete="${op.id}" title="Supprimer"
                    class="p-1.5 rounded-lg text-gray-400 hover:text-red-500
                           hover:bg-red-50 transition-all">
              ${iDelete()}
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-[#F9FAFB] border-b border-gray-100">
            ${['OF','Machine','N°','Traitement','Setup','Transfert','Total',''].map(h =>
              `<th class="px-5 py-3 text-left text-xs font-semibold text-gray-500
                          uppercase tracking-wide whitespace-nowrap ${!h ? 'text-right' : ''}">${h}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
        ${filtered().length} opération(s) affichée(s)
      </div>
    </div>`;
}

// ─── Vue PAR JOB ─────────────────────────────────────────────────────────────

function buildByJobView(ops) {
  // Grouper par job
  const groups = new Map();
  ops.forEach(op => {
    const jId = String(op.job?.id ?? op.job ?? 'unknown');
    if (!groups.has(jId)) groups.set(jId, []);
    groups.get(jId).push(op);
  });

  const cards = [...groups.entries()].map(([jId, jobOps]) => {
    const j = resolveJob(jId) || { code: jId, name: '—' };
    const sorted = [...jobOps].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
    const totalMin = sorted.reduce((s, o) =>
      s + (Number(o.processing_time_minutes ?? 0)) +
          (Number(o.setup_time_minutes       ?? 0)) +
          (Number(o.transfer_time_minutes    ?? 0)), 0);

    // Détection type atelier
    const atelierBadge = detectAtelier(sorted);

    // Séquence visuelle
    const seq = sorted.map((op, i) => {
      const m = resolveMachine(op.machine);
      const proc = Number(op.processing_time_minutes ?? 0);
      return `
        <div class="flex items-center gap-1.5 shrink-0">
          <div class="bg-white border border-gray-200 rounded-xl px-3 py-2 text-center
                      hover:border-[#378ADD] hover:shadow-sm transition-all cursor-default min-w-[100px]">
            <p class="text-xs font-bold text-gray-800">${m?.code ?? '—'}</p>
            <p class="text-xs text-gray-500 mt-0.5 truncate max-w-[90px]">${m?.name ?? ''}</p>
            <p class="text-[11px] font-semibold text-[#378ADD] mt-1">${fmtMin(proc)}</p>
            ${op.setup_time_minutes ? `<p class="text-[10px] text-gray-400">+${fmtMin(Number(op.setup_time_minutes))} setup</p>` : ''}
          </div>
          ${i < sorted.length - 1 ? `
            <svg class="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <!-- Card header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div class="flex items-center gap-3 min-w-0">
            <span class="font-mono font-bold text-xs text-[#378ADD] bg-blue-50 px-2 py-1 rounded-lg shrink-0">
              ${j.code}
            </span>
            <div class="min-w-0">
              <p class="font-semibold text-gray-800 text-sm truncate">${j.name}</p>
              <p class="text-xs text-gray-400 mt-0.5">
                ${sorted.length} opération(s) — ${fmtMin(totalMin)} total
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${atelierBadge}
            <button data-new-op-for="${jId}" title="Ajouter une opération"
                    class="p-1.5 rounded-lg text-gray-400 hover:text-[#378ADD]
                           hover:bg-[#378ADD]/10 transition-all">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Séquence visuelle scrollable -->
        <div class="px-5 py-4 overflow-x-auto">
          <div class="flex items-start gap-1.5 min-w-max">
            ${seq || `<p class="text-sm text-gray-400 italic">Aucune opération</p>`}
          </div>
        </div>

        <!-- Operations edit list -->
        <div class="border-t border-gray-50 px-5 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          ${sorted.map(op => {
            const m = resolveMachine(op.machine);
            return `
              <div class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 group">
                <span class="text-xs text-gray-600">
                  <span class="font-bold text-gray-800 mr-1">${op.sequence_order ?? '?'}.</span>
                  ${m?.name ?? '—'}
                </span>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button data-edit="${op.id}" title="Modifier"
                          class="p-1 rounded text-gray-400 hover:text-[#378ADD] transition-colors">
                    ${iEdit()}
                  </button>
                  <button data-delete="${op.id}" title="Supprimer"
                          class="p-1 rounded text-gray-400 hover:text-red-500 transition-colors">
                    ${iDelete()}
                  </button>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  return `<div class="space-y-4">${cards}</div>`;
}

function detectAtelier(sortedOps) {
  const machines = sortedOps.map(o => String(o.machine?.id ?? o.machine));
  const unique   = new Set(machines).size;
  const isFlow   = unique === machines.length;   // chaque machine différente — peut être flow shop

  if (sortedOps.length <= 1)
    return badge('gray',   '⚙️ Machine unique');
  if (isFlow)
    return badge('blue',   '🔀 Flow Shop');
  return badge('violet', '🔄 Job Shop');
}

function badge(color, text) {
  const cls = {
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    green:  'bg-green-50 text-green-700 border-green-100',
    gray:   'bg-gray-100 text-gray-600 border-gray-200',
  }[color] || 'bg-gray-100 text-gray-600';
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                        border ${cls}">${text}</span>`;
}

// ─── Bind actions depuis le DOM ───────────────────────────────────────────────

function bindRowActions(el) {
  el.querySelectorAll('[data-edit]').forEach(btn => {
    const op = _ops.find(o => o.id === Number(btn.dataset.edit));
    btn.addEventListener('click', () => openOpModal(op));
  });
  el.querySelectorAll('[data-delete]').forEach(btn => {
    const op = _ops.find(o => o.id === Number(btn.dataset.delete));
    btn.addEventListener('click', () => deleteOp(op));
  });
  el.querySelectorAll('[data-new-op-for]').forEach(btn => {
    const jId = btn.dataset.newOpFor;
    const job = resolveJob(jId);
    btn.addEventListener('click', () => openOpModal(null, job));
  });
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function emptyState() {
  const isFiltered = _filterJob || _filterMachine;
  return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
      <div class="text-4xl mb-3">🔗</div>
      <p class="font-semibold text-gray-700 mb-1">
        ${isFiltered ? 'Aucune opération ne correspond' : 'Aucune opération définie'}
      </p>
      <p class="text-sm text-gray-400 mb-5">
        ${isFiltered ? 'Modifiez vos filtres.' : 'Configurez les gammes opératoires de vos OFs.'}
      </p>
      ${!isFiltered ? `
        <button onclick="document.getElementById('btn-new-op')?.click()"
                class="inline-flex items-center gap-2 px-5 py-2.5 bg-[#378ADD] text-white
                       rounded-xl text-sm font-semibold hover:bg-[#185FA5] transition-all">
          + Nouvelle opération
        </button>` : ''}
    </div>`;
}

// ─── Modal formulaire ─────────────────────────────────────────────────────────

function openOpModal(op = null, preselJob = null) {
  const isEdit  = !!op;
  const curJobId = op?.job?.id ?? op?.job ?? preselJob?.id ?? '';
  const curMacId = op?.machine?.id ?? op?.machine ?? '';

  // Options jobs
  const jobOpts = _jobs.map(j =>
    `<option value="${j.id}"
       data-active="${j.is_active}"
       ${String(j.id) === String(curJobId) ? 'selected' : ''}>
       ${j.code} — ${j.name}${!j.is_active ? ' ⚠' : ''}
     </option>`
  ).join('');

  // Options machines : actives en vert, inactives désactivées barrées
  const macOpts = _machines.map(m =>
    `<option value="${m.id}"
       ${!m.is_active ? 'disabled' : ''}
       data-active="${m.is_active}"
       ${String(m.id) === String(curMacId) ? 'selected' : ''}>
       ${m.is_active ? '' : '⛔ '}${m.code} — ${m.name}${!m.is_active ? ' (inactive)' : ''}
     </option>`
  ).join('');

  const content = `
    <form id="op-form" class="space-y-4" novalidate>

      <!-- OF + Machine -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Ordre de Fabrication *</label>
          <select name="job" id="op-job" class="${SEL_CLS}">
            <option value="">— Sélectionner un OF —</option>
            ${jobOpts}
          </select>
          <p id="job-warn" class="hidden text-xs text-orange-600 mt-1 flex items-center gap-1">
            ⚠️ Cet OF est inactif.
          </p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Machine *</label>
          <select name="machine" id="op-machine" class="${SEL_CLS}">
            <option value="">— Sélectionner une machine —</option>
            ${macOpts}
          </select>
          <p id="mac-warn" class="hidden text-xs text-red-600 mt-1">
            🔴 Cette machine est inactive.
          </p>
        </div>
      </div>

      <!-- Ordre séquence -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">Ordre de séquence *</label>
        <input name="sequence_order" id="op-seq" type="number" min="1" step="1"
               value="${op?.sequence_order ?? nextSeqOrder(curJobId)}"
               class="${INPUT_CLS}" placeholder="1"/>
        <p class="text-xs text-gray-400 mt-1">Position de cette opération dans la gamme (1 = première)</p>
      </div>

      <!-- Temps -->
      <div class="grid grid-cols-3 gap-3">
        ${timeField('processing_time_minutes','Tps traitement *', op?.processing_time_minutes ?? '')}
        ${timeField('setup_time_minutes',     'Tps setup',        op?.setup_time_minutes     ?? 0)}
        ${timeField('transfer_time_minutes',  'Tps transfert',    op?.transfer_time_minutes  ?? 0)}
      </div>

      <!-- Preview total -->
      <div class="bg-[#EFF6FF] border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
        <span class="text-sm text-blue-700">Temps total estimé</span>
        <span id="time-total" class="text-lg font-bold text-[#378ADD]">—</span>
      </div>

      <!-- Erreurs -->
      <div id="op-form-errors" class="space-y-1"></div>
    </form>`;

  openModal({
    title:        isEdit ? `Modifier l'opération` : 'Nouvelle opération',
    size:         'md',
    content,
    confirmLabel: isEdit ? 'Enregistrer' : 'Créer',
    onConfirm:    () => handleSubmit(isEdit, op?.id),
  });

  // Bind live preview + warnings
  setTimeout(() => {
    bindFormEvents();
    updateTimePreview();
  }, 50);
}

function timeField(name, label, value) {
  return `
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1.5">${label}</label>
      <div class="relative">
        <input name="${name}" type="number" min="0" step="1" value="${value}"
               class="${INPUT_CLS} pr-10 time-input" placeholder="0"/>
        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
          min
        </span>
      </div>
    </div>`;
}

function bindFormEvents() {
  // Warnings job inactif
  document.getElementById('op-job')?.addEventListener('change', e => {
    const j = resolveJob(e.target.value);
    const warn = document.getElementById('job-warn');
    if (warn) warn.classList.toggle('hidden', !j || j.is_active !== false);
    updateSeqSuggestion(e.target.value);
  });

  // Warning machine inactive
  document.getElementById('op-machine')?.addEventListener('change', e => {
    const m = resolveMachine(e.target.value);
    const warn = document.getElementById('mac-warn');
    if (warn) warn.classList.toggle('hidden', !m || m.is_active !== false);
  });

  // Preview temps total
  document.querySelectorAll('.time-input').forEach(inp =>
    inp.addEventListener('input', updateTimePreview));
}

function updateTimePreview() {
  const get = name => Number(document.querySelector(`[name="${name}"]`)?.value ?? 0) || 0;
  const total = get('processing_time_minutes') + get('setup_time_minutes') + get('transfer_time_minutes');
  const el = document.getElementById('time-total');
  if (el) el.textContent = total ? fmtMin(total) : '—';
}

function updateSeqSuggestion(jobId) {
  if (!jobId) return;
  const next = nextSeqOrder(jobId);
  const el = document.getElementById('op-seq');
  if (el && !el.value) el.value = next;
}

function nextSeqOrder(jobId) {
  if (!jobId) return 1;
  const existing = _ops
    .filter(o => String(o.job?.id ?? o.job) === String(jobId))
    .map(o => o.sequence_order ?? 0);
  return existing.length ? Math.max(...existing) + 1 : 1;
}

// ─── Soumission ───────────────────────────────────────────────────────────────

async function handleSubmit(isEdit, id) {
  const form = document.getElementById('op-form');
  if (!form) return;

  const fd  = new FormData(form);
  const raw = Object.fromEntries(fd);

  const payload = {
    job:                     raw.job     ? Number(raw.job)     : null,
    machine:                 raw.machine ? Number(raw.machine) : null,
    sequence_order:          raw.sequence_order ? Number(raw.sequence_order) : null,
    processing_time_minutes: raw.processing_time_minutes ? Number(raw.processing_time_minutes) : null,
    setup_time_minutes:      Number(raw.setup_time_minutes)     || 0,
    transfer_time_minutes:   Number(raw.transfer_time_minutes)  || 0,
  };

  const errBox = document.getElementById('op-form-errors');
  const errs   = [];

  // ── Validations frontend ──────────────────────────────────────────────────
  if (!payload.job)                  errs.push("L'OF est obligatoire.");
  if (!payload.machine)              errs.push("La machine est obligatoire.");
  if (!payload.sequence_order)       errs.push("L'ordre de séquence est obligatoire (≥ 1).");
  if (!payload.processing_time_minutes || payload.processing_time_minutes <= 0)
    errs.push("Le temps de traitement doit être > 0.");

  // Machine inactive
  const selMac = resolveMachine(payload.machine);
  if (selMac && selMac.is_active === false)
    errs.push("⚠️ Cette machine est inactive. Sélectionnez une machine active.");

  // OF inactif
  const selJob = resolveJob(payload.job);
  if (selJob && selJob.is_active === false)
    errs.push("⚠️ Cet OF est inactif.");

  if (!isEdit && payload.job && payload.machine) {
    // Même machine déjà dans le même job
    const macConflict = _ops.find(o =>
      String(o.job?.id ?? o.job)     === String(payload.job) &&
      String(o.machine?.id ?? o.machine) === String(payload.machine));
    if (macConflict)
      errs.push(`🔀 Cette machine est déjà à la position ${macConflict.sequence_order} de cet OF.`);

    // Même sequence_order dans le même job
    const seqConflict = _ops.find(o =>
      String(o.job?.id ?? o.job) === String(payload.job) &&
      o.sequence_order === payload.sequence_order);
    if (seqConflict)
      errs.push(`⚡ L'ordre ${payload.sequence_order} est déjà utilisé dans cet OF (machine : ${resolveMachine(seqConflict.machine)?.code ?? '?'}).`);
  }

  if (errs.length) {
    if (errBox) errBox.innerHTML = errs.map(e =>
      `<p class="text-xs text-red-600 flex items-start gap-1.5 bg-red-50 px-3 py-2 rounded-lg">
         <svg class="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
           <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1
              0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
         </svg>${e}
       </p>`).join('');
    return;
  }
  if (errBox) errBox.innerHTML = '';

  const { error } = isEdit
    ? await operationsApi.patch(id, payload)
    : await operationsApi.create(payload);

  if (error) {
    const msgs = Object.entries(error)
      .filter(([k]) => k !== 'detail')
      .map(([k, v]) => `<p class="text-xs text-red-600">• ${k} : ${Array.isArray(v) ? v.join(', ') : v}</p>`)
      .join('');
    if (errBox) errBox.innerHTML = msgs ||
      `<p class="text-xs text-red-600">• ${error.detail || 'Erreur serveur'}</p>`;
    return;
  }

  closeModal();
  toast.success(isEdit ? 'Opération mise à jour.' : 'Opération créée avec succès.');
  await reloadOps();
}

// ─── Suppression ──────────────────────────────────────────────────────────────

function deleteOp(op) {
  if (!op) return;
  const m = resolveMachine(op.machine);
  const j = resolveJob(op.job);
  confirmModal({
    title:        'Supprimer l\'opération',
    message:      `Supprimer l'opération <strong>${op.sequence_order ?? '?'}</strong>
                   (${m?.name ?? '—'}) du job <strong>${j?.code ?? '?'}</strong> ?`,
    confirmLabel: 'Supprimer',
    danger:       true,
    onConfirm: async () => {
      const { error } = await operationsApi.delete(op.id);
      closeModal();
      if (error) { toast.error('Impossible de supprimer : ' + (error.detail || '')); return; }
      toast.success('Opération supprimée.');
      await reloadOps();
    },
  });
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

function resolveJob(ref) {
  if (!ref) return null;
  if (typeof ref === 'object') return ref;
  return _jobs.find(j => String(j.id) === String(ref)) ?? null;
}

function resolveMachine(ref) {
  if (!ref) return null;
  if (typeof ref === 'object') return ref;
  return _machines.find(m => String(m.id) === String(ref)) ?? null;
}

function jobName(ref) {
  const j = resolveJob(ref);
  return j ? `${j.code} ${j.name}` : String(ref ?? '');
}

// ─── Helpers visuels ─────────────────────────────────────────────────────────

function fmtMin(min) {
  if (min == null || isNaN(Number(min))) return '—';
  const m = Number(min);
  if (m === 0) return '0 min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h}h` : `${h}h ${r}min`;
}

const SEL = `text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50
  focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD] transition`;

const INPUT_CLS = `w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50
  focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD]
  transition-all placeholder:text-gray-300`;

const SEL_CLS = INPUT_CLS;

function iEdit() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
             m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
  </svg>`;
}
function iDelete() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7
             m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
  </svg>`;
}
