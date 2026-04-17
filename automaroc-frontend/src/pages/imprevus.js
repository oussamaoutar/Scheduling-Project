/**
 * imprevus.js — Imprévus & Perturbations (lecture seule)
 *
 * Endpoints :
 *   GET /api/scheduling/imprevus/   (paginé)
 *   GET /api/machines/              (pour le sélecteur)
 */

import { imprevusApi, machinesApi } from '../services/api.js';
import { toast }                    from '../components/toast.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPE_CFG = {
  breakdown:          { label: 'Panne machine',      icon: '⚡', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  material_shortage:  { label: 'Manque matières',    icon: '📦', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  operator_absence:   { label: 'Absence opérateur',  icon: '👤', color: '#EAB308', bg: '#FEFCE8', border: '#FEF08A' },
  quality_issue:      { label: 'Problème qualité',   icon: '🔍', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
  maintenance:        { label: 'Maintenance',         icon: '🔧', color: '#378ADD', bg: '#EFF6FF', border: '#BFDBFE' },
  other:              { label: 'Autre',               icon: '⚫', color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
};

const STATUS_CFG = {
  active:   { label: 'Actif',     cls: 'bg-red-100 text-red-700 border-red-200',       dot: '#EF4444', pulse: true  },
  pending:  { label: 'En attente',cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: '#EAB308', pulse: false },
  resolved: { label: 'Résolu',    cls: 'bg-green-100 text-green-700 border-green-200', dot: '#1D9E75', pulse: false },
};

// ─── État local ───────────────────────────────────────────────────────────────

let _all      = [];   // tous les imprévus chargés
let _machines = [];   // liste machines
let _filtered = [];   // après filtres
let _selected = null; // imprévus sélectionné (panel latéral)

// Filtres
let _fType    = 'all';
let _fMachine = 'all';
let _fStatus  = 'all';
let _fFrom    = '';
let _fTo      = '';

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = buildShell();
  await loadData();
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function buildShell() {
  return `
    <div id="imp-root" class="flex gap-5 h-full">
      <!-- CONTENU PRINCIPAL -->
      <div class="flex-1 min-w-0 overflow-hidden">

        <!-- HEADER -->
        <div class="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Imprévus & Perturbations
              <span id="active-badge" class="hidden px-2.5 py-0.5 text-xs font-bold
                                             bg-red-500 text-white rounded-full animate-pulse">
                0
              </span>
            </h2>
            <p class="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-10.95 4.318A9 9 0 1117.854 5.636"/>
              </svg>
              Lecture seule — données gérées par le système
            </p>
          </div>
          <button onclick="location.reload()"
                  class="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm
                         font-medium border border-gray-200 text-gray-500 hover:bg-gray-100
                         bg-white transition-all">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11
                       11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Rafraîchir
          </button>
        </div>

        <!-- CARTES RÉSUMÉ -->
        <div id="imp-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5"></div>

        <!-- FILTRES -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Type
              </label>
              <select id="f-type"
                      class="${SELECT_CLS}">
                <option value="all">Tous les types</option>
                ${Object.entries(TYPE_CFG).map(([v, c]) =>
                  `<option value="${v}">${c.icon} ${c.label}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Machine
              </label>
              <select id="f-machine" class="${SELECT_CLS}">
                <option value="all">Toutes les machines</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Statut
              </label>
              <select id="f-status" class="${SELECT_CLS}">
                <option value="all">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="pending">En attente</option>
                <option value="resolved">Résolu</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Période
              </label>
              <div class="flex gap-1.5">
                <input type="date" id="f-from" class="${INPUT_CLS} text-xs py-2"
                       title="Du">
                <input type="date" id="f-to"   class="${INPUT_CLS} text-xs py-2"
                       title="Au">
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <span id="filter-count" class="text-xs text-gray-400">Chargement…</span>
            <button id="btn-reset-filters"
                    class="text-xs font-medium text-gray-400 hover:text-gray-700
                           underline transition-all hidden">
              Réinitialiser
            </button>
          </div>
        </div>

        <!-- TABLEAU -->
        <div id="imp-table"></div>
      </div>

      <!-- PANEL LATÉRAL -->
      <div id="imp-panel"
           class="hidden w-[380px] shrink-0 transition-all duration-300">
      </div>
    </div>`;
}

// ─── Chargement ───────────────────────────────────────────────────────────────

async function loadData() {
  setTableSkeleton();

  const [rImp, rMach] = await Promise.all([
    imprevusApi.list({ page_size: 500 }),
    machinesApi.list({ page_size: 500 }),
  ]);

  _all      = toArr(rImp.data);
  _machines = toArr(rMach.data);

  if (rImp.error) {
    toast.error('Backend inaccessible — les imprévus ne peuvent pas être chargés.');
  }

  // Injecter options machines
  const mSel = document.getElementById('f-machine');
  if (mSel) {
    _machines.forEach(m => {
      const opt   = document.createElement('option');
      opt.value   = m.id;
      opt.textContent = `${m.code} — ${m.name}`;
      mSel.appendChild(opt);
    });
  }

  applyFilters();
  renderKpis();
  bindFilterEvents();
}

// ─── Filtres ──────────────────────────────────────────────────────────────────

function bindFilterEvents() {
  const ids = ['f-type', 'f-machine', 'f-status', 'f-from', 'f-to'];
  ids.forEach(id => {
    document.getElementById(id)?.addEventListener('change', onFilterChange);
  });
  document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
}

function onFilterChange() {
  _fType    = document.getElementById('f-type')   ?.value ?? 'all';
  _fMachine = document.getElementById('f-machine') ?.value ?? 'all';
  _fStatus  = document.getElementById('f-status')  ?.value ?? 'all';
  _fFrom    = document.getElementById('f-from')   ?.value ?? '';
  _fTo      = document.getElementById('f-to')     ?.value ?? '';
  applyFilters();
}

function resetFilters() {
  ['f-type','f-machine','f-status','f-from','f-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id.startsWith('f-') && (id === 'f-from' || id === 'f-to') ? '' : 'all';
  });
  _fType = _fMachine = _fStatus = 'all';
  _fFrom = _fTo = '';
  applyFilters();
}

function applyFilters() {
  _filtered = _all.filter(imp => {
    if (_fType    !== 'all' && imp.type   !== _fType)    return false;
    if (_fStatus  !== 'all') {
      const st = normalizeStatus(imp);
      if (st !== _fStatus) return false;
    }
    if (_fMachine !== 'all') {
      const mid = String(imp.machine?.id ?? imp.machine ?? '');
      if (mid !== String(_fMachine)) return false;
    }
    if (_fFrom && imp.reported_at) {
      if (new Date(imp.reported_at) < new Date(_fFrom)) return false;
    }
    if (_fTo && imp.reported_at) {
      if (new Date(imp.reported_at) > new Date(_fTo + 'T23:59:59')) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.reported_at ?? 0) - new Date(a.reported_at ?? 0));

  renderTable();

  const countEl  = document.getElementById('filter-count');
  const resetBtn = document.getElementById('btn-reset-filters');
  const hasFilter= _fType !== 'all' || _fMachine !== 'all' || _fStatus !== 'all' || _fFrom || _fTo;

  if (countEl) countEl.textContent = `${_filtered.length} imprévus affiché(s) sur ${_all.length}`;
  if (resetBtn) hasFilter ? resetBtn.classList.remove('hidden') : resetBtn.classList.add('hidden');
}

function normalizeStatus(imp) {
  if (imp.status) return imp.status;
  if (imp.is_active === true)  return 'active';
  if (imp.is_active === false) return 'resolved';
  return 'pending';
}

// ─── KPIs résumé ─────────────────────────────────────────────────────────────

function renderKpis() {
  const el = document.getElementById('imp-kpis');
  if (!el) return;

  const total     = _all.length;
  const active    = _all.filter(i => normalizeStatus(i) === 'active').length;
  const pannes    = _all.filter(i => i.type === 'breakdown').length;
  const manques   = _all.filter(i => i.type === 'material_shortage').length;

  // Badge actifs dans le header
  const badge = document.getElementById('active-badge');
  if (badge) {
    if (active > 0) {
      badge.textContent = active;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  const cards = [
    {
      label: 'Total imprévus',
      value:  total,
      icon:   '📋',
      color:  '#378ADD',
      bg:     '#EFF6FF',
      sub:    'Tous types confondus',
    },
    {
      label: 'Pannes machine',
      value:  pannes,
      icon:   '⚡',
      color:  '#F59E0B',
      bg:     '#FFFBEB',
      sub:    'Arrêts machine signalés',
    },
    {
      label: 'Manques matières',
      value:  manques,
      icon:   '📦',
      color:  '#378ADD',
      bg:     '#EFF6FF',
      sub:    'Ruptures approvisionnement',
    },
    {
      label: 'Actifs en cours',
      value:  active,
      icon:   '🔴',
      color:  active > 0 ? '#EF4444' : '#1D9E75',
      bg:     active > 0 ? '#FEF2F2' : '#ECFDF5',
      sub:    active > 0 ? 'Nécessitent une attention' : 'Aucun problème actif',
      urgent: active > 0,
    },
  ];

  el.innerHTML = cards.map(c => `
    <div class="bg-white rounded-2xl border shadow-sm p-4 transition-all hover:shadow-md
                ${c.urgent ? 'border-red-200 ring-2 ring-red-50' : 'border-gray-100'}">
      <div class="flex items-start justify-between gap-2 mb-3">
        <p class="text-xs font-semibold text-gray-500 leading-tight">${c.label}</p>
        <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
             style="background:${c.bg}">
          ${c.icon}
        </div>
      </div>
      <p class="text-2xl font-extrabold tabular-nums" style="color:${c.color}">${c.value}</p>
      <p class="text-xs text-gray-400 mt-1">${c.sub}</p>
    </div>`).join('');
}

// ─── Tableau ─────────────────────────────────────────────────────────────────

function setTableSkeleton() {
  const el = document.getElementById('imp-table');
  if (!el) return;
  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      ${[...Array(5)].map(() => `
        <div class="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
          <div class="h-5 bg-gray-100 rounded-full w-24 animate-pulse"></div>
          <div class="h-4 bg-gray-100 rounded w-32 animate-pulse"></div>
          <div class="h-4 bg-gray-100 rounded w-48 animate-pulse ml-auto"></div>
        </div>`).join('')}
    </div>`;
}

function renderTable() {
  const el = document.getElementById('imp-table');
  if (!el) return;

  if (_filtered.length === 0) {
    el.innerHTML = emptyState();
    return;
  }

  const rows = _filtered.map(imp => tableRow(imp)).join('');

  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-[#F9FAFB] border-b border-gray-100">
            ${['Type','Machine','Description','Durée estimée','Impact planning','Statut','Signalé le']
              .map(h => `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500
                                    uppercase tracking-wide whitespace-nowrap">${h}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody id="imp-tbody">${rows}</tbody>
      </table>
    </div>`;

  // Hover + clic
  document.querySelectorAll('#imp-tbody tr[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      const id  = Number(row.dataset.id);
      const imp = _filtered.find(i => i.id === id);
      if (imp) openPanel(imp);
    });
  });
}

function tableRow(imp) {
  const type   = TYPE_CFG[imp.type] || TYPE_CFG.other;
  const status = STATUS_CFG[normalizeStatus(imp)] || STATUS_CFG.pending;
  const machine= imp.machine?.name ?? imp.machine_name ?? '—';
  const mCode  = imp.machine?.code ?? imp.machine_code ?? '';
  const impact = imp.planning_impact ?? imp.impact_level ?? null;
  const isHigh = impact === 'high' || impact === 'affected' || imp.is_active;
  const isActive = _selected?.id === imp.id;

  return `
    <tr data-id="${imp.id}"
        class="border-b border-gray-50 cursor-pointer transition-colors group
               ${isActive ? 'bg-[#EFF6FF]' : 'hover:bg-gray-50/70'}">
      <!-- Type -->
      <td class="px-4 py-3 whitespace-nowrap">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border"
              style="background:${type.bg}; color:${type.color}; border-color:${type.border}">
          ${type.icon} ${type.label}
        </span>
      </td>

      <!-- Machine -->
      <td class="px-4 py-3 whitespace-nowrap">
        ${machine !== '—'
          ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold
                          bg-green-50 text-green-700 border border-green-100">
               ⚙ ${mCode || machine}
             </span>`
          : `<span class="text-gray-300 text-xs">—</span>`}
      </td>

      <!-- Description -->
      <td class="px-4 py-3 max-w-[200px]">
        <p class="text-sm text-gray-700 truncate">${imp.description ?? imp.notes ?? '—'}</p>
      </td>

      <!-- Durée -->
      <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">
        ${fmtMin(imp.estimated_duration ?? imp.duration_minutes)}
      </td>

      <!-- Impact -->
      <td class="px-4 py-3 whitespace-nowrap">
        ${isHigh
          ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                          font-semibold bg-red-50 text-red-600 border border-red-100">
               🔴 Planning affecté
             </span>`
          : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                          font-semibold bg-green-50 text-green-700 border border-green-100">
               ✓ Impact minimal
             </span>`}
      </td>

      <!-- Statut -->
      <td class="px-4 py-3 whitespace-nowrap">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                     font-semibold border ${status.cls}">
          ${status.pulse
            ? `<span class="relative flex h-1.5 w-1.5">
                 <span class="animate-ping absolute h-full w-full rounded-full opacity-75"
                       style="background:${status.dot}"></span>
                 <span class="relative h-1.5 w-1.5 rounded-full"
                       style="background:${status.dot}"></span>
               </span>`
            : `<span class="w-1.5 h-1.5 rounded-full"
                     style="background:${status.dot}"></span>`}
          ${status.label}
        </span>
      </td>

      <!-- Date -->
      <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
        ${fmtDateTime(imp.reported_at ?? imp.created_at)}
      </td>
    </tr>`;
}

// ─── État vide ────────────────────────────────────────────────────────────────

function emptyState() {
  const noFilter = _fType === 'all' && _fMachine === 'all' && _fStatus === 'all' && !_fFrom && !_fTo;
  if (noFilter && _all.length === 0) {
    // Aucun imprévus du tout → état idéal
    return `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
        <!-- SVG usine avec check vert -->
        <svg class="mx-auto mb-4" width="120" height="96" viewBox="0 0 120 96" fill="none">
          <!-- Bâtiment usine -->
          <rect x="10" y="45" width="100" height="46" rx="4" fill="#F3F4F6" stroke="#E5E7EB" stroke-width="1.5"/>
          <!-- Cheminées -->
          <rect x="22" y="30" width="12" height="18" rx="2" fill="#E5E7EB"/>
          <rect x="44" y="35" width="12" height="13" rx="2" fill="#E5E7EB"/>
          <!-- Toit -->
          <path d="M8 48L60 20L112 48" stroke="#D1D5DB" stroke-width="2" fill="none"/>
          <!-- Portes / fenêtres -->
          <rect x="22" y="60" width="14" height="18" rx="2" fill="#D1FAE5"/>
          <rect x="52" y="58" width="16" height="10" rx="2" fill="#BFDBFE"/>
          <rect x="82" y="58" width="16" height="10" rx="2" fill="#BFDBFE"/>
          <!-- Engrenage -->
          <circle cx="90" cy="36" r="14" fill="#ECFDF5" stroke="#6EE7B7" stroke-width="2"/>
          <text x="90" y="41" text-anchor="middle" font-size="14">✓</text>
        </svg>
        <p class="font-bold text-gray-700 text-lg mb-1">Aucun imprévus en cours</p>
        <p class="text-sm text-gray-400">L'usine tourne normalement — Aucune perturbation signalée.</p>
        <div class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#ECFDF5] border
                    border-green-100 rounded-xl text-sm font-semibold text-[#1D9E75]">
          ✅ Production nominale
        </div>
      </div>`;
  }
  // Filtre actif → aucun résultat
  return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center">
      <div class="text-4xl mb-3">🔍</div>
      <p class="font-semibold text-gray-700 mb-1">Aucun résultat pour ces filtres</p>
      <button onclick="document.getElementById('btn-reset-filters')?.click()"
              class="mt-3 text-sm text-[#378ADD] underline hover:text-[#185FA5]">
        Réinitialiser les filtres
      </button>
    </div>`;
}

// ─── Panel latéral ────────────────────────────────────────────────────────────

function openPanel(imp) {
  _selected = imp;
  renderTable();   // Recolore la ligne sélectionnée

  const panel = document.getElementById('imp-panel');
  if (!panel) return;
  panel.classList.remove('hidden');

  const type    = TYPE_CFG[imp.type] || TYPE_CFG.other;
  const status  = STATUS_CFG[normalizeStatus(imp)] || STATUS_CFG.pending;
  const machine = _machines.find(m =>
    String(m.id) === String(imp.machine?.id ?? imp.machine)
  );

  // Historique (autres imprévus de la même machine)
  const history = _all
    .filter(i =>
      i.id !== imp.id &&
      String(i.machine?.id ?? i.machine) === String(imp.machine?.id ?? imp.machine)
    )
    .sort((a, b) => new Date(b.reported_at ?? 0) - new Date(a.reported_at ?? 0))
    .slice(0, 4);

  panel.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm h-full
                flex flex-col overflow-hidden sticky top-4">

      <!-- En-tête panel -->
      <div class="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
             style="background:${type.bg}">
          ${type.icon}
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-gray-900 text-sm leading-tight">${type.label}</h3>
          <p class="text-xs text-gray-400 mt-0.5">${fmtDateTime(imp.reported_at ?? imp.created_at)}</p>
        </div>
        <button id="close-panel"
                class="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Corps scrollable -->
      <div class="flex-1 overflow-y-auto p-5 space-y-5">

        <!-- Statut + Impact -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                       font-semibold border ${status.cls}">
            ${status.pulse
              ? `<span class="w-1.5 h-1.5 rounded-full animate-ping"
                       style="background:${status.dot}"></span>`
              : `<span class="w-1.5 h-1.5 rounded-full"
                       style="background:${status.dot}"></span>`}
            ${status.label}
          </span>
          ${imp.is_active
            ? `<span class="px-2.5 py-1 rounded-full text-xs font-semibold
                            bg-red-50 text-red-600 border border-red-100">
                 🔴 Planning affecté
               </span>`
            : `<span class="px-2.5 py-1 rounded-full text-xs font-semibold
                            bg-green-50 text-green-700 border border-green-100">
                 ✓ Impact minimal
               </span>`}
        </div>

        <!-- Description -->
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
          <p class="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
            ${imp.description ?? imp.notes ?? 'Aucune description disponible.'}
          </p>
        </div>

        <!-- Durée + Métriques -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
            <p class="text-lg font-extrabold text-gray-900">
              ${fmtMin(imp.estimated_duration ?? imp.duration_minutes)}
            </p>
            <p class="text-xs text-gray-400 mt-0.5">Durée estimée</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
            <p class="text-lg font-extrabold text-gray-900">
              ${fmtDate(imp.start_time ?? imp.reported_at)}
            </p>
            <p class="text-xs text-gray-400 mt-0.5">Début</p>
          </div>
        </div>

        <!-- Machine concernée -->
        ${machine
          ? `<div>
               <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                 Machine concernée
               </p>
               <div class="bg-[#ECFDF5] border border-green-100 rounded-xl p-3">
                 <div class="flex items-center gap-2 mb-2">
                   <span class="font-mono font-bold text-xs text-[#1D9E75] bg-white
                                px-1.5 py-0.5 rounded border border-green-200">
                     ${machine.code}
                   </span>
                   <span class="text-sm font-semibold text-gray-800">${machine.name}</span>
                   <span class="ml-auto text-xs text-gray-500">${machine.machine_type ?? ''}</span>
                 </div>
                 <p class="text-xs text-gray-500">
                   Capacité normale :
                   <strong class="text-gray-800">${fmtMin(machine.capacity_per_day)}/jour</strong>
                 </p>
                 <p class="text-xs text-gray-500 mt-0.5">
                   Poste n°${machine.workstation_number ?? '—'}
                 </p>
               </div>
             </div>`
          : imp.machine
            ? `<div>
                 <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                   Machine concernée
                 </p>
                 <span class="text-sm text-gray-700">
                   ${imp.machine?.name ?? imp.machine_name ?? `ID ${imp.machine}`}
                 </span>
               </div>`
            : ''}

        <!-- Historique machine -->
        ${history.length > 0
          ? `<div>
               <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                 Historique sur cette machine
               </p>
               <div class="space-y-2">
                 ${history.map(h => {
                   const ht = TYPE_CFG[h.type] || TYPE_CFG.other;
                   const hs = STATUS_CFG[normalizeStatus(h)] || STATUS_CFG.pending;
                   return `
                     <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-gray-50
                                 border border-gray-100">
                       <span class="text-base shrink-0 mt-0.5">${ht.icon}</span>
                       <div class="flex-1 min-w-0">
                         <p class="text-xs font-semibold text-gray-700">${ht.label}</p>
                         <p class="text-xs text-gray-400 mt-0.5">${fmtDate(h.reported_at)}</p>
                       </div>
                       <span class="text-xs font-medium shrink-0 px-1.5 py-0.5 rounded-full border ${hs.cls}">
                         ${hs.label}
                       </span>
                     </div>`;
                 }).join('')}
               </div>
             </div>`
          : ''}

      </div>

      <!-- Footer panel -->
      <div class="px-5 py-4 border-t border-gray-100 bg-[#FFFBEB]">
        <div class="flex items-start gap-2 text-xs text-amber-700">
          <svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p>
            Ces données sont <strong>gérées par le système</strong>.
            Pour replanifier, utilisez le module
            <a href="#/scheduling" class="font-bold underline text-[#378ADD]">Scheduling</a>.
          </p>
        </div>
      </div>
    </div>`;

  document.getElementById('close-panel')?.addEventListener('click', closePanel);
}

function closePanel() {
  _selected = null;
  const panel = document.getElementById('imp-panel');
  if (panel) panel.classList.add('hidden');
  renderTable();   // Enlève la surbrillance
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

function fmtDate(str) {
  if (!str) return '—';
  try { return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(new Date(str)); }
  catch { return str; }
}

function fmtDateTime(str) {
  if (!str) return '—';
  try {
    return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date(str));
  } catch { return str; }
}

// ─── CSS constants ────────────────────────────────────────────────────────────

const SELECT_CLS = `w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50
  focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD] transition-all`;

const INPUT_CLS = `w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50
  focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD] transition-all`;
