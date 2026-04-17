/**
 * jobs.js — Ordres de Fabrication (OFs)
 *
 * GET    /api/jobs/                     → liste paginée
 * GET    /api/jobs/operations/?job={id} → opérations d'un job
 * POST   /api/jobs/                     → créer
 * PATCH  /api/jobs/{id}/               → modifier
 * DELETE /api/jobs/{id}/               → supprimer
 *
 * Champs : id, code, name, quantity, priority (1-5), release_date,
 *          due_date, status, is_active, total_processing_time (ro)
 */

import { jobsApi, operationsApi }                 from '../services/api.js';
import { openModal, closeModal, confirmModal }     from '../components/modal.js';
import { toast }                                  from '../components/toast.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUSES = [
  { value: '',            label: 'Tous les statuts' },
  { value: 'draft',       label: '📋 Brouillon'     },
  { value: 'ready',       label: '✅ Prêt'           },
  { value: 'in_progress', label: '⚡ En cours'      },
  { value: 'completed',   label: '🏁 Terminé'       },
  { value: 'cancelled',   label: '❌ Annulé'        },
];

const PRIORITIES = [
  { value: '',  label: 'Toutes priorités'  },
  { value: '1', label: '🔴 1 — Urgente'   },
  { value: '2', label: '🟠 2 — Haute'     },
  { value: '3', label: '🟡 3 — Normale'   },
  { value: '4', label: '🟢 4 — Basse'     },
  { value: '5', label: '⚪ 5 — Très basse' },
];

const STATUS_CFG = {
  draft:       { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-600',           pulse: false },
  ready:       { label: 'Prêt',       cls: 'bg-blue-100 text-blue-700',            pulse: false },
  in_progress: { label: 'En cours',   cls: 'bg-[#EFF6FF] text-[#1D4ED8]',         pulse: true  },
  completed:   { label: 'Terminé',    cls: 'bg-[#ECFDF5] text-[#065F46]',         pulse: false },
  cancelled:   { label: 'Annulé',     cls: 'bg-red-50 text-red-600',              pulse: false },
};

const PRIORITY_CFG = {
  1: { label: 'Urgente',    cls: 'bg-red-100 text-red-700',       dot: '#EF4444' },
  2: { label: 'Haute',      cls: 'bg-orange-100 text-orange-700', dot: '#F97316' },
  3: { label: 'Normale',    cls: 'bg-yellow-100 text-yellow-700', dot: '#EAB308' },
  4: { label: 'Basse',      cls: 'bg-green-100 text-green-700',   dot: '#22C55E' },
  5: { label: 'Très basse', cls: 'bg-gray-100 text-gray-500',     dot: '#9CA3AF' },
};

// ─── État local ───────────────────────────────────────────────────────────────

let _all      = [];
let _filtered = [];
let _search   = '';
let _status   = '';
let _priority = '';
let _selected = null;   // job affiché dans le panel
let _panelOps = [];     // opérations du panel

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function render(container) {
  // Inject panel styles once
  injectStyles();
  container.innerHTML = buildShell();
  bindShellEvents(container);
  await load();
}

// ─── Chargement ───────────────────────────────────────────────────────────────

async function load() {
  showSkeleton();
  const { data, error } = await jobsApi.list({ page_size: 500 });

  if (error) {
    toast.error('Chargement des OFs impossible : ' + (error.detail || 'Backend inaccessible'));
    _all = [];
  } else {
    _all = Array.isArray(data) ? data : (data?.results ?? []);
  }

  applyFilters();
  updateSubtitle();
}

function applyFilters() {
  const q = _search.toLowerCase().trim();
  _filtered = _all.filter(j => {
    const matchQ = !q || j.code?.toLowerCase().includes(q) || j.name?.toLowerCase().includes(q);
    const matchS = !_status   || j.status        === _status;
    const matchP = !_priority || String(j.priority) === _priority;
    return matchQ && matchS && matchP;
  });
  updateResetBtn();
  renderTable();
}

function updateSubtitle() {
  const el = document.getElementById('jobs-subtitle');
  if (!el) return;
  const active = _all.filter(j => j.is_active).length;
  el.textContent = `${_all.length} ordres de fabrication — ${active} actifs`;
}

function updateResetBtn() {
  const btn = document.getElementById('btn-reset-filters');
  if (!btn) return;
  const hasFilter = _search || _status || _priority;
  btn.classList.toggle('hidden', !hasFilter);
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function buildShell() {
  const statusOpts  = STATUSES.map(s =>
    `<option value="${s.value}">${s.label}</option>`).join('');
  const priorityOpts = PRIORITIES.map(p =>
    `<option value="${p.value}">${p.label}</option>`).join('');

  return `
    <!-- HEADER -->
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Ordres de Fabrication</h2>
        <p id="jobs-subtitle" class="text-sm text-gray-500 mt-1">Chargement…</p>
      </div>
      <button id="btn-new-job"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                     bg-[#378ADD] text-white hover:bg-[#185FA5] shadow-sm transition-all shrink-0">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
        </svg>
        Nouvel OF
      </button>
    </div>

    <!-- FILTRES -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5
                flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-[200px]">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="j-search" type="search" placeholder="Rechercher par code ou nom…"
               class="${INPUT_SM} pl-9"/>
      </div>
      <select id="j-status"   class="${INPUT_SM} min-w-[160px]">${statusOpts}</select>
      <select id="j-priority" class="${INPUT_SM} min-w-[160px]">${priorityOpts}</select>
      <button id="btn-reset-filters" hidden
              class="hidden text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2
                     transition-colors whitespace-nowrap">
        ✕ Réinitialiser
      </button>
    </div>

    <!-- LAYOUT principal + panel latéral -->
    <div class="relative flex gap-5">
      <!-- Table wrapper -->
      <div id="jobs-table-wrap" class="flex-1 min-w-0 transition-all duration-300"></div>

      <!-- Panel latéral -->
      <div id="job-panel" class="job-panel hidden">
        <div id="job-panel-inner" class="job-panel-inner bg-white rounded-2xl border border-gray-100
             shadow-lg overflow-hidden flex flex-col h-full">
          <!-- Contenu panel injecté dynamiquement -->
        </div>
      </div>
    </div>

    <!-- Overlay panel mobile -->
    <div id="panel-overlay" class="hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
         style="display:none"></div>
  `;
}

// ─── Événements shell ────────────────────────────────────────────────────────

function bindShellEvents(container) {
  container.querySelector('#btn-new-job')
    ?.addEventListener('click', () => openJobModal());

  let debounce;
  container.querySelector('#j-search')?.addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { _search = e.target.value; applyFilters(); }, 220);
  });

  container.querySelector('#j-status')?.addEventListener('change', e => {
    _status = e.target.value; applyFilters();
  });
  container.querySelector('#j-priority')?.addEventListener('change', e => {
    _priority = e.target.value; applyFilters();
  });

  container.querySelector('#btn-reset-filters')?.addEventListener('click', () => {
    _search = ''; _status = ''; _priority = '';
    container.querySelector('#j-search').value   = '';
    container.querySelector('#j-status').value   = '';
    container.querySelector('#j-priority').value = '';
    applyFilters();
  });

  document.getElementById('panel-overlay')
    ?.addEventListener('click', closePanel);

  window.addEventListener('automaroc:refresh', load);
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function showSkeleton() {
  const el = document.getElementById('jobs-table-wrap');
  if (!el) return;
  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      ${[...Array(6)].map(() => `
        <div class="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
          <div class="h-5 bg-gray-100 rounded-lg w-16 animate-pulse"></div>
          <div class="h-4 bg-gray-100 rounded w-40 animate-pulse"></div>
          <div class="h-5 bg-gray-100 rounded-full w-20 animate-pulse"></div>
          <div class="h-4 bg-gray-100 rounded w-24 animate-pulse ml-auto"></div>
        </div>`).join('')}
    </div>`;
}

// ─── Rendu tableau ────────────────────────────────────────────────────────────

function renderTable() {
  const wrap = document.getElementById('jobs-table-wrap');
  if (!wrap) return;

  if (_filtered.length === 0) {
    wrap.innerHTML = emptyState();
    return;
  }

  const rows = _filtered.map(j => {
    const s = STATUS_CFG[j.status] || STATUS_CFG.draft;
    const p = PRIORITY_CFG[j.priority] || PRIORITY_CFG[3];
    const isSelected = _selected?.id === j.id;

    return `
      <tr data-id="${j.id}"
          class="job-row border-b border-gray-50 cursor-pointer transition-colors duration-150
                 ${isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-gray-50'}">

        <!-- Code -->
        <td class="px-5 py-3.5 whitespace-nowrap">
          <span class="font-mono font-bold text-[#378ADD] bg-blue-50 px-2 py-0.5 rounded-lg text-xs">
            ${j.code ?? '—'}
          </span>
        </td>

        <!-- Nom -->
        <td class="px-5 py-3.5 max-w-[200px]">
          <p class="font-semibold text-gray-800 text-sm truncate">${j.name ?? '—'}</p>
        </td>

        <!-- Qté -->
        <td class="px-5 py-3.5 text-center text-sm text-gray-600 whitespace-nowrap">
          ${j.quantity ?? '—'}
        </td>

        <!-- Priorité -->
        <td class="px-5 py-3.5 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.cls}">
            <span class="w-1.5 h-1.5 rounded-full" style="background:${p.dot}"></span>
            ${p.label}
          </span>
        </td>

        <!-- Dates -->
        <td class="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
          ${j.release_date ? `<span class="font-medium text-gray-600">${fmtDate(j.release_date)}</span>` : '<span class="text-gray-300">—</span>'}
          <span class="mx-1 text-gray-300">→</span>
          ${j.due_date ? `<span class="font-semibold text-gray-800">${fmtDate(j.due_date)}</span>` : '<span class="text-gray-300">—</span>'}
        </td>

        <!-- Temps total -->
        <td class="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">
          ${fmtMin(j.total_processing_time)}
        </td>

        <!-- Statut -->
        <td class="px-5 py-3.5 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}">
            ${s.pulse ? `<span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>` : ''}
            ${s.label}
          </span>
        </td>

        <!-- Actif -->
        <td class="px-5 py-3.5 text-center">
          <span class="inline-block w-8 h-4 rounded-full transition-colors
                       ${j.is_active ? 'bg-[#1D9E75]' : 'bg-gray-200'}">
            <span class="block w-3 h-3 rounded-full bg-white shadow mt-0.5 transition-transform
                         ${j.is_active ? 'translate-x-4' : 'translate-x-0.5'}"></span>
          </span>
        </td>

        <!-- Actions -->
        <td class="px-5 py-3.5 whitespace-nowrap">
          <div class="flex items-center justify-end gap-1">
            <button data-edit="${j.id}" title="Modifier"
                    class="p-1.5 rounded-lg text-gray-400 hover:text-[#378ADD] hover:bg-[#378ADD]/10 transition-all">
              ${iEdit()}
            </button>
            <button data-ops="${j.id}" title="Voir opérations"
                    class="p-1.5 rounded-lg text-gray-400 hover:text-[#1D9E75] hover:bg-[#1D9E75]/10 transition-all">
              ${iOps()}
            </button>
            <button data-delete="${j.id}" title="Supprimer"
                    class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
              ${iDelete()}
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-[#F9FAFB] border-b border-gray-100 text-left">
            ${['Code','Nom','Qté','Priorité','Dates','Tps total','Statut','Actif','Actions']
              .map(h => `<th class="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide
                              ${h === 'Actions' ? 'text-right' : ''}">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
        ${_filtered.length} OF(s) affiché(s) sur ${_all.length}
      </div>
    </div>`;

  // Bind row actions
  wrap.querySelectorAll('.job-row').forEach(tr => {
    const id = Number(tr.dataset.id);
    const job = _all.find(j => j.id === id);

    // Clic ligne → panel (sauf boutons)
    tr.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      openPanel(job);
    });
    tr.querySelector(`[data-edit="${id}"]`)  ?.addEventListener('click', e => { e.stopPropagation(); openJobModal(job); });
    tr.querySelector(`[data-ops="${id}"]`)   ?.addEventListener('click', e => { e.stopPropagation(); openPanel(job); });
    tr.querySelector(`[data-delete="${id}"]`)?.addEventListener('click', e => { e.stopPropagation(); deleteJob(job); });
  });
}

// ─── Panel latéral ───────────────────────────────────────────────────────────

async function openPanel(job) {
  if (!job) return;
  _selected = job;

  // Réhighlight row
  document.querySelectorAll('.job-row').forEach(tr => {
    tr.classList.toggle('bg-[#EFF6FF]', Number(tr.dataset.id) === job.id);
    tr.classList.toggle('hover:bg-gray-50', Number(tr.dataset.id) !== job.id);
  });

  const panel = document.getElementById('job-panel');
  const inner = document.getElementById('job-panel-inner');
  if (!panel || !inner) return;

  // Show panel with skeleton
  panel.classList.remove('hidden');
  panel.style.display = '';
  inner.innerHTML = panelSkeleton(job);

  // Show overlay on mobile
  const overlay = document.getElementById('panel-overlay');
  if (window.innerWidth < 768 && overlay) {
    overlay.style.display = 'block';
    overlay.classList.remove('hidden');
  }

  // Bind panel close
  inner.querySelector('#btn-panel-close')?.addEventListener('click', closePanel);
  inner.querySelector('#btn-panel-edit') ?.addEventListener('click', () => openJobModal(job));
  inner.querySelector('#btn-panel-sched')?.addEventListener('click', () => {
    window.location.hash = '#/scheduling';
  });

  // Load operations
  const { data, error } = await operationsApi.list({ job: job.id, page_size: 100 });
  _panelOps = error ? [] : (Array.isArray(data) ? data : (data?.results ?? []));

  inner.innerHTML = panelContent(job, _panelOps);

  // Re-bind after re-render
  inner.querySelector('#btn-panel-close')?.addEventListener('click', closePanel);
  inner.querySelector('#btn-panel-edit') ?.addEventListener('click', () => openJobModal(job));
  inner.querySelector('#btn-panel-sched')?.addEventListener('click', () => {
    window.location.hash = '#/scheduling';
  });
}

function closePanel() {
  _selected = null;
  const panel   = document.getElementById('job-panel');
  const overlay = document.getElementById('panel-overlay');
  if (panel)   panel.classList.add('hidden');
  if (overlay) { overlay.style.display = 'none'; overlay.classList.add('hidden'); }
  document.querySelectorAll('.job-row').forEach(tr => {
    tr.classList.remove('bg-[#EFF6FF]');
    tr.classList.add('hover:bg-gray-50');
  });
}

function panelSkeleton(job) {
  const s = STATUS_CFG[job.status] || STATUS_CFG.draft;
  return `
    <div class="flex items-start justify-between p-5 border-b border-gray-100">
      <div>
        <span class="font-mono text-xs font-bold text-[#378ADD] bg-blue-50 px-2 py-0.5 rounded">${job.code}</span>
        <h3 class="font-bold text-gray-900 mt-1 text-base">${job.name}</h3>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${s.cls}">${s.label}</span>
      </div>
      <button id="btn-panel-close" class="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-5 space-y-4">
      ${[...Array(4)].map(() => `<div class="h-4 bg-gray-100 rounded animate-pulse w-3/4"></div>`).join('')}
      <div class="mt-4 space-y-2">
        ${[...Array(3)].map(() => `<div class="h-10 bg-gray-100 rounded-xl animate-pulse"></div>`).join('')}
      </div>
    </div>`;
}

function panelContent(job, ops) {
  const s = STATUS_CFG[job.status] || STATUS_CFG.draft;
  const p = PRIORITY_CFG[job.priority] || PRIORITY_CFG[3];

  const kvRows = [
    ['Quantité',          job.quantity ?? '—'],
    ['Priorité',          `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${p.cls}">${p.label}</span>`],
    ['Date de lancement', job.release_date ? fmtDate(job.release_date) : '—'],
    ['Date due',          job.due_date     ? `<span class="font-semibold">${fmtDate(job.due_date)}</span>` : '—'],
    ['Temps total',       `<span class="font-semibold text-[#378ADD]">${fmtMin(job.total_processing_time)}</span>`],
    ['Actif',             job.is_active
      ? '<span class="text-[#1D9E75] font-medium">✓ Oui</span>'
      : '<span class="text-gray-400">Non</span>'],
  ].map(([k, v]) => `
    <div class="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
      <span class="text-xs text-gray-500 shrink-0 w-36">${k}</span>
      <span class="text-xs font-medium text-gray-800 text-right">${v}</span>
    </div>`).join('');

  // Séquence opérations
  const opsHtml = ops.length === 0
    ? `<p class="text-xs text-gray-400 italic">Aucune opération définie pour cet OF.</p>`
    : ops.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
        .map((op, i) => `
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-gray-700">
                  ${op.sequence_order ?? i + 1}. ${op.name || op.operation_name || 'Opération'}
                </span>
                <span class="text-xs text-[#378ADD] font-semibold">${fmtMin(op.processing_time_minutes ?? op.processing_time)}</span>
              </div>
              <div class="flex items-center gap-3 mt-1">
                <span class="text-xs text-gray-400">
                  🏭 ${op.machine_name || op.machine?.name || 'Machine N/A'}
                </span>
                ${(op.setup_time_minutes ?? op.setup_time) ? `<span class="text-xs text-gray-400">⏱ Setup: ${fmtMin(op.setup_time_minutes ?? op.setup_time)}</span>` : ''}
              </div>
            </div>
            ${i < ops.length - 1 ? `
              <svg class="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>` : ''}
          </div>`).join('');

  return `
    <!-- Panel header -->
    <div class="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
      <div>
        <span class="font-mono text-xs font-bold text-[#378ADD] bg-blue-50 px-2 py-0.5 rounded">${job.code}</span>
        <h3 class="font-bold text-gray-900 mt-2 text-base leading-tight">${job.name}</h3>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-2 ${s.cls}">
          ${s.pulse ? `<span class="relative flex h-2 w-2">
            <span class="animate-ping absolute h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span class="relative h-2 w-2 rounded-full bg-blue-500"></span>
          </span>` : ''}
          ${s.label}
        </span>
      </div>
      <button id="btn-panel-close" title="Fermer"
              class="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all mt-0.5">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Panel body -->
    <div class="flex-1 overflow-y-auto p-5 space-y-6">

      <!-- Informations -->
      <div>
        <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Informations</h4>
        <div class="bg-gray-50 rounded-xl px-3 py-1">${kvRows}</div>
      </div>

      <!-- Gamme opératoire -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Gamme opératoire
            ${ops.length ? `<span class="ml-1.5 px-1.5 py-0.5 bg-[#378ADD] text-white rounded-full text-[10px]">${ops.length}</span>` : ''}
          </h4>
          ${ops.length ? `<span class="text-xs text-gray-400">${fmtMin(ops.reduce((s, o) => s + (o.processing_time_minutes ?? o.processing_time ?? 0), 0))} total</span>` : ''}
        </div>
        <div class="space-y-2">${opsHtml}</div>
      </div>
    </div>

    <!-- Panel footer -->
    <div class="shrink-0 p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
      <button id="btn-panel-edit"
              class="flex-1 py-2 rounded-xl text-sm font-semibold border border-gray-200
                     hover:bg-white hover:border-[#378ADD] hover:text-[#378ADD]
                     text-gray-600 transition-all text-center">
        ✏️ Modifier
      </button>
      <button id="btn-panel-sched"
              class="flex-1 py-2 rounded-xl text-sm font-semibold
                     bg-[#378ADD] text-white hover:bg-[#185FA5] transition-all text-center">
        🚀 Scheduling
      </button>
    </div>`;
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function emptyState() {
  const isFiltered = _search || _status || _priority;
  return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
      <div class="text-4xl mb-3">📋</div>
      <p class="font-semibold text-gray-700 mb-1">
        ${isFiltered ? 'Aucun OF ne correspond aux filtres' : 'Aucun ordre de fabrication'}
      </p>
      <p class="text-sm text-gray-400 mb-5">
        ${isFiltered ? 'Essayez de modifier vos critères de recherche.' : 'Créez votre premier ordre de fabrication.'}
      </p>
      ${!isFiltered ? `
        <button onclick="document.getElementById('btn-new-job')?.click()"
                class="inline-flex items-center gap-2 px-5 py-2.5 bg-[#378ADD] text-white
                       rounded-xl text-sm font-semibold hover:bg-[#185FA5] transition-all">
          + Nouvel OF
        </button>` : ''}
    </div>`;
}

// ─── Modal formulaire ─────────────────────────────────────────────────────────

function openJobModal(job = null) {
  const isEdit = !!job;

  const statusOpts = STATUSES.filter(s => s.value).map(s =>
    `<option value="${s.value}" ${job?.status === s.value ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  const prioOpts = PRIORITIES.filter(p => p.value).map(p =>
    `<option value="${p.value}" ${String(job?.priority) === p.value ? 'selected' : ''}>${p.label}</option>`
  ).join('');

  const content = `
    <form id="job-form" class="space-y-5" novalidate>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

        <!-- COL GAUCHE -->
        <div class="space-y-4">
          <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Identification</h4>

          ${fld('code', 'Code OF *', 'text', job?.code ?? '', 'Ex: OF-2024-001')}
          ${fld('name', 'Désignation *', 'text', job?.name ?? '', 'Ex: Châssis avant série A')}
          ${fld('quantity', 'Quantité à produire', 'number', job?.quantity ?? 1, '1', 'min="1" step="1"')}

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Priorité</label>
            <select name="priority" class="${SEL_CLS}">
              <option value="">— Choisir —</option>
              ${prioOpts}
            </select>
          </div>
        </div>

        <!-- COL DROITE -->
        <div class="space-y-4">
          <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Planification</h4>

          ${fld('release_date', 'Date de lancement', 'date', job?.release_date ?? '')}
          <div>
            ${fld('due_date', 'Date de livraison due *', 'date', job?.due_date ?? '')}
            <p class="text-xs text-gray-400 mt-1">Doit être postérieure à la date de lancement</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Statut</label>
            <select name="status" class="${SEL_CLS}">
              <option value="draft"  ${(!job || job.status === 'draft')  ? 'selected' : ''}>📋 Brouillon</option>
              <option value="ready"  ${job?.status === 'ready'           ? 'selected' : ''}>✅ Prêt</option>
              <option value="in_progress" ${job?.status === 'in_progress'? 'selected' : ''}>⚡ En cours</option>
              <option value="completed"   ${job?.status === 'completed'  ? 'selected' : ''}>🏁 Terminé</option>
              <option value="cancelled"   ${job?.status === 'cancelled'  ? 'selected' : ''}>❌ Annulé</option>
            </select>
          </div>

          <!-- Toggle actif -->
          <div class="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div>
              <p class="text-sm font-semibold text-gray-700">OF actif</p>
              <p class="text-xs text-gray-400">Inclus dans les ordonnancements</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" name="is_active" id="toggle-job-active" class="sr-only peer"
                     ${job?.is_active !== false ? 'checked' : ''}>
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#1D9E75]
                          peer-focus:ring-2 peer-focus:ring-[#1D9E75]/30
                          after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                          after:bg-white after:border after:rounded-full after:h-5 after:w-5
                          after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- Note backend -->
      <div class="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <svg class="w-4 h-4 text-[#378ADD] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-xs text-blue-700 leading-relaxed">
          Le <strong>temps total de traitement</strong> est calculé automatiquement par le backend à partir des opérations associées à cet OF.
        </p>
      </div>

      <!-- Erreurs -->
      <div id="job-form-errors" class="space-y-1"></div>
    </form>`;

  openModal({
    title:        isEdit ? `Modifier — ${job.code}` : 'Nouvel Ordre de Fabrication',
    size:         'lg',
    content,
    confirmLabel: isEdit ? 'Enregistrer les modifications' : 'Créer l\'OF',
    onConfirm:    () => handleSubmit(isEdit, job?.id),
  });
}

// ─── Soumission ───────────────────────────────────────────────────────────────

async function handleSubmit(isEdit, id) {
  const form = document.getElementById('job-form');
  if (!form) return;

  const fd  = new FormData(form);
  const raw = Object.fromEntries(fd);

  const payload = {
    code:         (raw.code ?? '').trim().toUpperCase(),
    name:         (raw.name ?? '').trim(),
    quantity:     Number(raw.quantity) || 1,
    priority:     raw.priority ? Number(raw.priority) : null,
    status:       raw.status || 'draft',
    release_date: raw.release_date || null,
    due_date:     raw.due_date     || null,
    is_active:    !!form.querySelector('#toggle-job-active')?.checked,
  };

  // Validation locale
  const errs = [];
  if (!payload.code) errs.push('Le code OF est obligatoire.');
  if (!payload.name) errs.push('La désignation est obligatoire.');
  if (payload.release_date && payload.due_date && payload.due_date <= payload.release_date)
    errs.push('La date de livraison doit être postérieure à la date de lancement.');

  const errBox = document.getElementById('job-form-errors');
  if (errs.length) {
    if (errBox) errBox.innerHTML = errs.map(e =>
      `<p class="text-xs text-red-600 flex items-center gap-1">
         <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
           <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
         </svg>${e}
       </p>`).join('');
    return;
  }
  if (errBox) errBox.innerHTML = '';

  const { data, error } = isEdit
    ? await jobsApi.patch(id, payload)
    : await jobsApi.create(payload);

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
  closePanel();
  toast.success(isEdit
    ? `OF "${data?.name || payload.name}" mis à jour.`
    : `OF "${payload.code}" créé avec succès.`);
  await load();
}

// ─── Suppression ──────────────────────────────────────────────────────────────

function deleteJob(job) {
  confirmModal({
    title:        'Supprimer l\'OF',
    message:      `Supprimer <strong>${job.name}</strong> (${job.code}) ? Les opérations associées seront aussi supprimées. Cette action est irréversible.`,
    confirmLabel: 'Supprimer',
    danger:       true,
    onConfirm: async () => {
      const { error } = await jobsApi.delete(job.id);
      closeModal();
      if (error) {
        toast.error('Impossible de supprimer : ' + (error.detail || ''));
        return;
      }
      if (_selected?.id === job.id) closePanel();
      toast.success(`OF "${job.name}" supprimé.`);
      await load();
    },
  });
}

// ─── Styles injectés ─────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('jobs-page-styles')) return;
  const s = document.createElement('style');
  s.id = 'jobs-page-styles';
  s.textContent = `
    .job-panel {
      width: 380px;
      min-width: 380px;
      max-height: calc(100vh - 200px);
      position: sticky;
      top: 80px;
      align-self: flex-start;
    }
    .job-panel-inner {
      max-height: calc(100vh - 200px);
    }
    @media (max-width: 1024px) {
      .job-panel {
        position: fixed;
        top: 0; right: 0;
        width: 90vw;
        max-width: 400px;
        height: 100dvh;
        max-height: 100dvh;
        z-index: 40;
        border-radius: 0;
        border-left: 1px solid #e5e7eb;
      }
      .job-panel-inner { max-height: 100dvh; border-radius: 0; }
    }
  `;
  document.head.appendChild(s);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_SM  = `text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50
  focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD] transition`;

const INPUT_CLS = `w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50
  focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD]
  transition-all placeholder:text-gray-300`;

const SEL_CLS = INPUT_CLS;

function fld(name, label, type, value, placeholder = '', extra = '') {
  return `
    <div>
      <label for="jf-${name}" class="block text-sm font-medium text-gray-700 mb-1.5">${label}</label>
      <input id="jf-${name}" name="${name}" type="${type}" value="${value}"
             placeholder="${placeholder}" ${extra} class="${INPUT_CLS}"/>
    </div>`;
}

function fmtDate(str) {
  if (!str) return '—';
  try {
    return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(new Date(str));
  } catch { return str; }
}

function fmtMin(min) {
  if (min == null || isNaN(Number(min))) return '—';
  const m = Number(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h}h` : `${h}h ${r}min`;
}

function iEdit() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
             m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
  </svg>`;
}

function iOps() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101
             m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
  </svg>`;
}

function iDelete() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7
             m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
  </svg>`;
}
