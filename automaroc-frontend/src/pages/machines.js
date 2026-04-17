/**
 * machines.js — Machines & Postes de travail
 *
 * GET  /api/machines/          → liste paginée
 * POST /api/machines/          → créer
 * PATCH /api/machines/{id}/    → modifier
 * DELETE /api/machines/{id}/   → supprimer
 *
 * Champs : id, code, name, machine_type, description,
 *          workstation_number, capacity_per_day, is_active
 */

import { machinesApi }                        from '../services/api.js';
import { openModal, confirmModal, closeModal } from '../components/modal.js';
import { toast }                              from '../components/toast.js';

// ─── Types de machines ────────────────────────────────────────────────────────

const MACHINE_TYPES = [
  { value: '',          label: 'Tous les types',  icon: '🏭', badge: 'bg-gray-100 text-gray-600'    },
  { value: 'cutting',   label: 'Découpe',          icon: '✂️', badge: 'bg-blue-100 text-blue-700'    },
  { value: 'drilling',  label: 'Perçage',          icon: '🔩', badge: 'bg-orange-100 text-orange-700' },
  { value: 'milling',   label: 'Fraisage',         icon: '⚙️', badge: 'bg-violet-100 text-violet-700' },
  { value: 'turning',   label: 'Tournage',         icon: '🔄', badge: 'bg-sky-100 text-sky-700'       },
  { value: 'assembly',  label: 'Assemblage',       icon: '🔧', badge: 'bg-green-100 text-green-700'   },
  { value: 'painting',  label: 'Peinture',         icon: '🎨', badge: 'bg-purple-100 text-purple-700' },
  { value: 'packaging', label: 'Emballage',        icon: '📦', badge: 'bg-yellow-100 text-yellow-700' },
  { value: 'other',     label: 'Autre',            icon: '🏗️', badge: 'bg-gray-100 text-gray-600'    },
];

const TYPE_MAP = Object.fromEntries(MACHINE_TYPES.filter(t => t.value).map(t => [t.value, t]));

// ─── État local ───────────────────────────────────────────────────────────────

let _all      = [];   // toutes les machines chargées
let _filtered = [];   // après filtres
let _search   = '';
let _typeFilter = '';
let _statusFilter = '';
let _view     = 'table';   // 'table' | 'cards'

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = buildShell();
  bindEvents(container);
  await load();
}

// ─── Chargement API ───────────────────────────────────────────────────────────

async function load() {
  setLoading(true);
  const { data, error } = await machinesApi.list({ page_size: 500 });
  setLoading(false);

  if (error) {
    toast.error('Erreur chargement machines : ' + (error.detail || 'Backend inaccessible'));
    _all = [];
  } else {
    _all = Array.isArray(data) ? data : (data?.results ?? []);
  }

  applyFilters();
  updateSubtitle();
}

// ─── Filtres ──────────────────────────────────────────────────────────────────

function applyFilters() {
  const q = _search.toLowerCase().trim();
  _filtered = _all.filter(m => {
    const matchSearch = !q || m.code?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q);
    const matchType   = !_typeFilter   || m.machine_type === _typeFilter;
    const matchStatus = !_statusFilter
      || (_statusFilter === 'active'   &&  m.is_active)
      || (_statusFilter === 'inactive' && !m.is_active);
    return matchSearch && matchType && matchStatus;
  });
  renderContent();
}

function updateSubtitle() {
  const el = document.getElementById('machines-subtitle');
  if (!el) return;
  const active = _all.filter(m => m.is_active).length;
  el.textContent = `${_all.length} machines — ${active} actives`;
}

// ─── Shell HTML ───────────────────────────────────────────────────────────────

function buildShell() {
  const typeOptions = MACHINE_TYPES.map(t =>
    `<option value="${t.value}">${t.icon} ${t.label}</option>`
  ).join('');

  return `
    <!-- HEADER -->
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Machines & Postes de travail</h2>
        <p id="machines-subtitle" class="text-sm text-gray-500 mt-1">Chargement…</p>
      </div>
      <button id="btn-new-machine"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                     bg-[#378ADD] text-white hover:bg-[#185FA5] shadow-sm transition-all shrink-0">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
        </svg>
        Nouvelle machine
      </button>
    </div>

    <!-- FILTRES -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5
                flex flex-wrap items-center gap-3">

      <!-- Recherche -->
      <div class="relative flex-1 min-w-[200px]">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="m-search" type="search" placeholder="Rechercher par code ou nom…"
               class="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50
                      focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD] transition"/>
      </div>

      <!-- Type -->
      <select id="m-type"
              class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50
                     focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD]
                     transition min-w-[160px]">
        ${typeOptions}
      </select>

      <!-- Statut -->
      <select id="m-status"
              class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50
                     focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD]
                     transition min-w-[140px]">
        <option value="">Tous les statuts</option>
        <option value="active">✅ Actives</option>
        <option value="inactive">⛔ Inactives</option>
      </select>

      <!-- Spacer -->
      <div class="flex-1 hidden sm:block"></div>

      <!-- Toggle vue -->
      <div class="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
        <button id="btn-view-table" title="Vue tableau"
                class="view-btn px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                       bg-white shadow text-[#378ADD]">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 10h18M3 14h18M3 6h18M3 18h18"/>
          </svg>
        </button>
        <button id="btn-view-cards" title="Vue cartes"
                class="view-btn px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-gray-500">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0
                     012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0
                     012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0
                     01-2 2h-2a2 2 0 01-2-2v-2z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- CONTENU (table ou cards) -->
    <div id="machines-content"></div>
  `;
}

// ─── Événements ───────────────────────────────────────────────────────────────

function bindEvents(container) {
  // Bouton nouvelle machine
  container.querySelector('#btn-new-machine')
    ?.addEventListener('click', () => openMachineModal());

  // Recherche (debounce 220ms)
  let debounce;
  container.querySelector('#m-search')?.addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { _search = e.target.value; applyFilters(); }, 220);
  });

  // Filtre type
  container.querySelector('#m-type')?.addEventListener('change', e => {
    _typeFilter = e.target.value; applyFilters();
  });

  // Filtre statut
  container.querySelector('#m-status')?.addEventListener('change', e => {
    _statusFilter = e.target.value; applyFilters();
  });

  // Toggle vue
  container.querySelector('#btn-view-table')?.addEventListener('click', () => setView('table'));
  container.querySelector('#btn-view-cards')?.addEventListener('click', () => setView('cards'));

  // Refresh global
  window.addEventListener('automaroc:refresh', load);
}

function setView(v) {
  _view = v;
  const tBtn = document.getElementById('btn-view-table');
  const cBtn = document.getElementById('btn-view-cards');
  if (tBtn && cBtn) {
    tBtn.className = `view-btn px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
      v === 'table' ? 'bg-white shadow text-[#378ADD]' : 'text-gray-500'
    }`;
    cBtn.className = `view-btn px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
      v === 'cards' ? 'bg-white shadow text-[#378ADD]' : 'text-gray-500'
    }`;
  }
  renderContent();
}

// ─── Rendu contenu ────────────────────────────────────────────────────────────

function renderContent() {
  const el = document.getElementById('machines-content');
  if (!el) return;

  if (_filtered.length === 0) {
    el.innerHTML = emptyState();
    return;
  }

  el.innerHTML = _view === 'table' ? buildTable() : buildCards();

  // Attacher les handlers actions
  _filtered.forEach(m => {
    el.querySelector(`[data-edit="${m.id}"]`)  ?.addEventListener('click', () => openMachineModal(m));
    el.querySelector(`[data-delete="${m.id}"]`)?.addEventListener('click', () => deleteMachine(m));
  });
}

function setLoading(on) {
  const el = document.getElementById('machines-content');
  if (!el) return;
  if (on) {
    el.innerHTML = `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        ${[...Array(5)].map(() => `
          <div class="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
            <div class="h-4 bg-gray-100 rounded w-20 animate-pulse"></div>
            <div class="h-4 bg-gray-100 rounded w-36 animate-pulse"></div>
            <div class="h-6 bg-gray-100 rounded-full w-24 animate-pulse"></div>
            <div class="h-4 bg-gray-100 rounded w-12 animate-pulse ml-auto"></div>
          </div>`).join('')}
      </div>`;
  }
}

// ─── Vue TABLEAU ──────────────────────────────────────────────────────────────

function buildTable() {
  const rows = _filtered.map(m => `
    <tr class="hover:bg-gray-50 transition-colors group">
      <td class="px-5 py-3.5 whitespace-nowrap">
        <span class="font-mono font-bold text-[#378ADD] bg-blue-50 px-2 py-0.5 rounded-lg text-sm">
          ${m.code ?? '—'}
        </span>
      </td>
      <td class="px-5 py-3.5">
        <span class="font-semibold text-gray-800 text-sm">${m.name ?? '—'}</span>
        ${m.description ? `<p class="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">${m.description}</p>` : ''}
      </td>
      <td class="px-5 py-3.5 whitespace-nowrap">${typeBadge(m.machine_type)}</td>
      <td class="px-5 py-3.5 text-center">
        <span class="font-mono font-semibold text-gray-700 text-sm">${m.workstation_number ?? '—'}</span>
      </td>
      <td class="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">
        ${formatCap(m.capacity_per_day)}
      </td>
      <td class="px-5 py-3.5 whitespace-nowrap">${statusBadge(m.is_active)}</td>
      <td class="px-5 py-3.5 whitespace-nowrap">
        <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button data-edit="${m.id}" title="Modifier"
                  class="p-1.5 rounded-lg text-gray-400 hover:text-[#378ADD] hover:bg-[#378ADD]/10 transition-all">
            ${iconEdit()}
          </button>
          <button data-delete="${m.id}" title="Supprimer"
                  class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
            ${iconDelete()}
          </button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-[#F9FAFB] border-b border-gray-100">
            <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
            <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
            <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
            <th class="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Poste N°</th>
            <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Capacité/jour</th>
            <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
            <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">${rows}</tbody>
      </table>
      <div class="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
        ${_filtered.length} machine(s) affichée(s)
      </div>
    </div>`;
}

// ─── Vue CARTES ───────────────────────────────────────────────────────────────

function buildCards() {
  const cards = _filtered.map(m => {
    const t = TYPE_MAP[m.machine_type] || { icon: '🏭', label: 'Autre', badge: 'bg-gray-100 text-gray-600' };
    return `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md
                  hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">

        <!-- En-tête carte -->
        <div class="p-5 pb-4 flex items-start justify-between gap-3">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl
                      bg-gradient-to-br from-gray-50 to-gray-100 shrink-0">
            ${t.icon}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-mono text-xs font-bold text-[#378ADD] mb-0.5">${m.code ?? ''}</p>
            <h3 class="font-bold text-gray-900 text-sm leading-tight truncate">${m.name ?? '—'}</h3>
          </div>
          ${statusDot(m.is_active)}
        </div>

        <!-- Corps -->
        <div class="px-5 pb-4 flex-1 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-400">Type</span>
            ${typeBadge(m.machine_type)}
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-400">Poste N°</span>
            <span class="font-mono font-semibold text-gray-700">${m.workstation_number ?? '—'}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-400">Capacité/jour</span>
            <span class="font-semibold text-gray-700">${formatCap(m.capacity_per_day)}</span>
          </div>
        </div>

        <!-- Footer actions -->
        <div class="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
          <span class="text-xs ${m.is_active ? 'text-[#1D9E75]' : 'text-gray-400'} font-medium">
            ${m.is_active ? '● Active' : '○ Inactive'}
          </span>
          <div class="flex gap-1">
            <button data-edit="${m.id}" title="Modifier"
                    class="p-1.5 rounded-lg text-gray-400 hover:text-[#378ADD] hover:bg-[#378ADD]/10 transition-all">
              ${iconEdit()}
            </button>
            <button data-delete="${m.id}" title="Supprimer"
                    class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
              ${iconDelete()}
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${cards}
    </div>`;
}

// ─── État vide ────────────────────────────────────────────────────────────────

function emptyState() {
  const isFiltered = _search || _typeFilter || _statusFilter;
  return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
        <svg class="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066
                   c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924
                   0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724
                   0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066
                   c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756
                   -2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608
                   2.296.07 2.572-1.065z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
      <p class="font-semibold text-gray-700 mb-1">
        ${isFiltered ? 'Aucune machine ne correspond aux filtres' : 'Aucune machine enregistrée'}
      </p>
      <p class="text-sm text-gray-400 mb-5">
        ${isFiltered ? 'Essayez de modifier votre recherche ou vos filtres.' : 'Créez votre premier poste de travail.'}
      </p>
      ${!isFiltered ? `
        <button onclick="document.getElementById('btn-new-machine')?.click()"
                class="inline-flex items-center gap-2 px-5 py-2.5 bg-[#378ADD] text-white
                       rounded-xl text-sm font-semibold hover:bg-[#185FA5] transition-all">
          + Nouvelle machine
        </button>` : ''}
    </div>`;
}

// ─── Modal formulaire ─────────────────────────────────────────────────────────

function openMachineModal(machine = null) {
  const isEdit = !!machine;

  const typeOptions = MACHINE_TYPES.filter(t => t.value).map(t =>
    `<option value="${t.value}" ${machine?.machine_type === t.value ? 'selected' : ''}>
      ${t.icon} ${t.label}
    </option>`
  ).join('');

  const content = `
    <form id="machine-form" class="space-y-4" novalidate>

      <!-- Code + Nom -->
      <div class="grid grid-cols-2 gap-3">
        ${fld('code', 'Code machine *', 'text', machine?.code ?? '', 'Ex: M001', 'Obligatoire')}
        ${fld('name', 'Nom du poste *',  'text', machine?.name ?? '', 'Ex: Fraiseuse CNC', 'Obligatoire')}
      </div>

      <!-- Type -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">Type de machine</label>
        <select name="machine_type" class="${INPUT_CLS}">
          <option value="">— Sélectionner un type —</option>
          ${typeOptions}
        </select>
      </div>

      <!-- N° poste + Capacité -->
      <div class="grid grid-cols-2 gap-3">
        ${fld('workstation_number', 'N° de poste *', 'number', machine?.workstation_number ?? '', '1', 'Obligatoire', 'min="1" step="1"')}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Capacité/jour *</label>
          <div class="relative">
            <input name="capacity_per_day" type="number" min="0" step="1"
                   value="${machine?.capacity_per_day ?? 480}"
                   class="${INPUT_CLS} pr-16" placeholder="480"/>
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
              min/j
            </span>
          </div>
          <p class="text-xs text-gray-400 mt-1">480 min = 8h standard</p>
        </div>
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea name="description" rows="2" class="${INPUT_CLS}"
                  placeholder="Notes optionnelles…">${machine?.description ?? ''}</textarea>
      </div>

      <!-- Toggle statut -->
      <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div>
          <p class="text-sm font-semibold text-gray-700">Machine active</p>
          <p class="text-xs text-gray-400">Disponible pour l'ordonnancement</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" name="is_active" id="toggle-active" class="sr-only peer"
                 ${machine?.is_active !== false ? 'checked' : ''}>
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2
                      peer-focus:ring-[#378ADD]/30 rounded-full peer
                      peer-checked:after:translate-x-full peer-checked:after:border-white
                      after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                      after:bg-white after:border-gray-300 after:border after:rounded-full
                      after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1D9E75]">
          </div>
        </label>
      </div>

      <!-- Erreurs -->
      <div id="form-errors" class="space-y-1"></div>
    </form>`;

  openModal({
    title:        isEdit ? `Modifier — ${machine.code}` : 'Nouvelle machine',
    size:         'md',
    content,
    confirmLabel: isEdit ? 'Enregistrer les modifications' : 'Créer la machine',
    onConfirm:    () => handleSubmit(isEdit, machine?.id),
  });
}

// ─── Soumission formulaire ────────────────────────────────────────────────────

async function handleSubmit(isEdit, id) {
  const form = document.getElementById('machine-form');
  if (!form) return;

  // Collecte
  const fd = new FormData(form);
  const raw = Object.fromEntries(fd);

  const payload = {
    code:               (raw.code ?? '').trim().toUpperCase(),
    name:               (raw.name ?? '').trim(),
    machine_type:       raw.machine_type || null,
    description:        (raw.description ?? '').trim() || '',
    workstation_number: raw.workstation_number ? Number(raw.workstation_number) : null,
    capacity_per_day:   raw.capacity_per_day ? Number(raw.capacity_per_day) : 480,
    is_active:          !!form.querySelector('#toggle-active')?.checked,
  };

  // Validation locale
  const errs = [];
  if (!payload.code)   errs.push('Le code machine est obligatoire.');
  if (!payload.name)   errs.push('Le nom du poste est obligatoire.');
  if (payload.workstation_number == null || payload.workstation_number < 1)
    errs.push('Le numéro de poste doit être ≥ 1.');
  if (payload.capacity_per_day < 0)
    errs.push('La capacité doit être un nombre positif.');

  const errBox = document.getElementById('form-errors');
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

  // Appel API
  const { data, error } = isEdit
    ? await machinesApi.patch(id, payload)
    : await machinesApi.create(payload);

  if (error) {
    // Erreurs de validation Django champ par champ
    const msgs = Object.entries(error)
      .filter(([k]) => k !== 'detail')
      .map(([k, v]) => `<p class="text-xs text-red-600">• ${k} : ${Array.isArray(v) ? v.join(', ') : v}</p>`)
      .join('');
    if (errBox) errBox.innerHTML = msgs || `<p class="text-xs text-red-600">• ${error.detail || 'Erreur serveur'}</p>`;
    return;
  }

  closeModal();
  toast.success(isEdit ? `Machine "${data?.name || payload.name}" mise à jour.` : `Machine "${payload.code}" créée avec succès.`);
  await load();
}

// ─── Suppression ──────────────────────────────────────────────────────────────

function deleteMachine(m) {
  confirmModal({
    title:        'Supprimer la machine',
    message:      `Supprimer <strong>${m.name}</strong> (${m.code}) ? Cette action est irréversible et supprimera toutes les opérations associées.`,
    confirmLabel: 'Supprimer',
    danger:       true,
    onConfirm: async () => {
      const { error } = await machinesApi.delete(m.id);
      closeModal();
      if (error) {
        toast.error('Impossible de supprimer : ' + (error.detail || 'opérations liées ?'));
        return;
      }
      toast.success(`Machine "${m.name}" supprimée.`);
      await load();
    },
  });
}

// ─── Helpers visuels ──────────────────────────────────────────────────────────

const INPUT_CLS = `w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50
  focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD]
  transition-all placeholder:text-gray-300`;

function fld(name, label, type, value, placeholder = '', hint = '', extra = '') {
  return `
    <div>
      <label for="f-${name}" class="block text-sm font-medium text-gray-700 mb-1.5">${label}</label>
      <input id="f-${name}" name="${name}" type="${type}" value="${value}"
             placeholder="${placeholder}" ${extra} class="${INPUT_CLS}"/>
      ${hint ? `<p class="text-xs text-gray-400 mt-1">${hint}</p>` : ''}
    </div>`;
}

function typeBadge(type) {
  const t = TYPE_MAP[type];
  if (!t) return `<span class="text-xs text-gray-400">—</span>`;
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${t.badge}">
    ${t.icon} ${t.label}
  </span>`;
}

function statusBadge(active) {
  return active
    ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold
                   bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
         <span class="w-1.5 h-1.5 rounded-full bg-[#1D9E75]"></span> Active
       </span>`
    : `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold
                   bg-gray-50 text-gray-500 border border-gray-200">
         <span class="w-1.5 h-1.5 rounded-full bg-gray-300"></span> Inactive
       </span>`;
}

function statusDot(active) {
  return `<div class="w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
    active ? 'bg-[#1D9E75]' : 'bg-gray-300'
  }"></div>`;
}

function formatCap(min) {
  if (min == null || isNaN(min)) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}min`);
  return parts.length ? parts.join(' ') : `${min}min`;
}

function iconEdit() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
             m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
  </svg>`;
}

function iconDelete() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7
             m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
  </svg>`;
}
