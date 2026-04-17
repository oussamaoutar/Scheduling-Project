/**
 * historique.js — Historique des machines (lecture seule)
 *
 * Endpoints :
 *   GET /api/scheduling/historique/?machine={id}&days={n}
 *   GET /api/scheduling/historique/stats/?machine={id}   (statistiques agrégées)
 *   GET /api/machines/                                    (sélecteur)
 *   GET /api/scheduling/imprevus/?machine={id}            (timeline événements)
 */

import { machinesApi, historiqueApi, imprevusApi } from '../services/api.js';
import { HistoriqueAPI }                            from '../services/api.js';
import { toast }                                    from '../components/toast.js';

// ─── Types d'événements ───────────────────────────────────────────────────────

const EVT_CFG = {
  breakdown:        { label: 'Panne machine',     icon: '⚡', color: '#EF4444', bg: '#FEF2F2' },
  material_shortage:{ label: 'Manque matières',   icon: '📦', color: '#F59E0B', bg: '#FFFBEB' },
  operator_absence: { label: 'Absence opérateur', icon: '👤', color: '#EAB308', bg: '#FEFCE8' },
  quality_issue:    { label: 'Problème qualité',  icon: '🔍', color: '#8B5CF6', bg: '#F5F3FF' },
  maintenance:      { label: 'Maintenance',        icon: '🔧', color: '#378ADD', bg: '#EFF6FF' },
  other:            { label: 'Autre',              icon: '⚫', color: '#6B7280', bg: '#F9FAFB' },
};

const STATUS_CFG = {
  active:   { label: 'Actif',      cls: 'text-red-600 bg-red-50 border-red-100' },
  resolved: { label: 'Résolu',     cls: 'text-green-700 bg-green-50 border-green-100' },
  pending:  { label: 'En attente', cls: 'text-yellow-700 bg-yellow-50 border-yellow-100' },
};

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90, custom: null };

// ─── État local ───────────────────────────────────────────────────────────────

let _machines    = [];
let _machineId   = null;
let _machine     = null;
let _period      = '30d';
let _customFrom  = '';
let _customTo    = '';
let _histData    = null;
let _imprevus    = [];
let _lineChart   = null;
let _donutChart  = null;

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = buildShell();
  await loadMachines();
  bindEvents();
  renderEmptyState();
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function buildShell() {
  return `
    <!-- HEADER -->
    <div class="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Historique des machines</h2>
        <p class="text-sm text-gray-400 mt-0.5">Analyse des performances et pannes</p>
      </div>
      <!-- Note lecture seule -->
      <div class="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200
                  rounded-xl text-xs text-amber-700 shrink-0 max-w-xs">
        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Données gérées par le backend • Vue en lecture seule
      </div>
    </div>

    <!-- SÉLECTEURS -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
      <div class="flex flex-wrap items-end gap-3">
        <!-- Machine -->
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Machine
          </label>
          <select id="sel-machine" class="${SEL_CLS}">
            <option value="">— Sélectionnez une machine —</option>
          </select>
        </div>

        <!-- Période -->
        <div class="min-w-[160px]">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Période
          </label>
          <select id="sel-period" class="${SEL_CLS}">
            <option value="7d">7 derniers jours</option>
            <option value="30d" selected>30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="custom">Personnalisée</option>
          </select>
        </div>

        <!-- Dates personnalisées -->
        <div id="custom-dates" class="hidden flex items-end gap-2">
          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1.5">Du</label>
            <input type="date" id="date-from" class="${INP_CLS} text-xs py-2">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1.5">Au</label>
            <input type="date" id="date-to" class="${INP_CLS} text-xs py-2">
          </div>
        </div>

        <!-- Bouton charger -->
        <button id="btn-load-hist"
                class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#378ADD] text-white
                       hover:bg-[#185FA5] shadow-sm transition-all disabled:opacity-50
                       disabled:cursor-not-allowed shrink-0" disabled>
          📊 Charger l'historique
        </button>
      </div>
    </div>

    <!-- ZONE CONTENU -->
    <div id="hist-content"></div>
  `;
}

// ─── Chargement machines ──────────────────────────────────────────────────────

async function loadMachines() {
  const { data } = await machinesApi.list({ page_size: 500 });
  _machines = toArr(data);

  const sel = document.getElementById('sel-machine');
  if (!sel) return;

  _machines
    .filter(m => m.is_active)
    .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''))
    .forEach(m => {
      const opt   = document.createElement('option');
      opt.value   = m.id;
      opt.textContent = `${m.code} — ${m.name} (${m.machine_type ?? '?'})`;
      sel.appendChild(opt);
    });
}

// ─── Événements ───────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('sel-machine')?.addEventListener('change', e => {
    _machineId = e.target.value ? Number(e.target.value) : null;
    _machine   = _machines.find(m => m.id === _machineId) ?? null;
    const btn  = document.getElementById('btn-load-hist');
    if (btn) btn.disabled = !_machineId;
    if (!_machineId) renderEmptyState();
  });

  document.getElementById('sel-period')?.addEventListener('change', e => {
    _period = e.target.value;
    const cd = document.getElementById('custom-dates');
    if (cd) _period === 'custom' ? cd.classList.remove('hidden') : cd.classList.add('hidden');
  });

  document.getElementById('btn-load-hist')?.addEventListener('click', loadHistorique);
}

// ─── Chargement historique ────────────────────────────────────────────────────

async function loadHistorique() {
  if (!_machineId) return;

  const btn = document.getElementById('btn-load-hist');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Chargement…'; }

  // Calcul paramètre days ou plage dates
  let days   = PERIOD_DAYS[_period] ?? 30;
  let params = `machine=${_machineId}&days=${days}`;

  if (_period === 'custom') {
    _customFrom = document.getElementById('date-from')?.value ?? '';
    _customTo   = document.getElementById('date-to')?.value   ?? '';
    if (!_customFrom || !_customTo) {
      toast.error('Veuillez renseigner une date de début et de fin.');
      if (btn) { btn.disabled = false; btn.textContent = '📊 Charger l\'historique'; }
      return;
    }
    // Calcul nb jours
    const diff = Math.ceil(
      (new Date(_customTo) - new Date(_customFrom)) / (1000 * 60 * 60 * 24)
    );
    params = `machine=${_machineId}&days=${Math.max(diff, 1)}&from=${_customFrom}&to=${_customTo}`;
    days   = diff;
  }

  destroyCharts();

  // Requêtes parallèles
  const [rHist, rImp] = await Promise.all([
    safeCall(() => HistoriqueAPI.getByMachine(_machineId, days)),
    imprevusApi ? imprevusApi.list({ machine: _machineId, page_size: 200 }) : Promise.resolve({ data: null }),
  ]);

  if (btn) { btn.disabled = false; btn.textContent = '📊 Charger l\'historique'; }

  _histData  = rHist.data;
  _imprevus  = toArr(rImp.data)
    .filter(i => String(i.machine?.id ?? i.machine) === String(_machineId))
    .sort((a, b) => new Date(b.reported_at ?? 0) - new Date(a.reported_at ?? 0));

  renderContent();
}

// ─── Rendu principal ─────────────────────────────────────────────────────────

function renderContent() {
  const el = document.getElementById('hist-content');
  if (!el) return;

  const hist  = _histData ?? {};
  const kpis  = hist.kpis ?? hist.stats ?? {};
  const daily = toArr(hist.daily_data ?? hist.days ?? []);

  el.innerHTML = `
    <!-- MACHINE INFO -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-xl shrink-0">⚙️</div>
        <div class="flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono font-bold text-xs text-[#378ADD] bg-blue-50
                         px-2 py-0.5 rounded border border-blue-100">
              ${_machine?.code ?? '?'}
            </span>
            <span class="font-bold text-gray-900">${_machine?.name ?? '—'}</span>
            <span class="text-xs text-gray-400">${_machine?.machine_type ?? ''}</span>
            <span class="ml-auto text-xs font-medium text-gray-500">
              ${periodLabel()} · Poste n°${_machine?.workstation_number ?? '—'}
            </span>
          </div>
          <p class="text-xs text-gray-400 mt-0.5">
            Capacité nominale : <strong>${fmtMin(_machine?.capacity_per_day)}/jour</strong>
          </p>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div id="hist-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5"></div>

    <!-- GRAPHES -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
      <!-- Ligne disponibilité -->
      <div class="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-semibold text-gray-800 mb-1">Disponibilité journalière</h3>
        <p class="text-xs text-gray-400 mb-4">
          Taux de disponibilité (%) — points rouges = jours avec pannes
        </p>
        <div style="height:220px; position:relative">
          <canvas id="chart-line"></canvas>
        </div>
      </div>
      <!-- Donut répartition -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-semibold text-gray-800 mb-1">Répartition du temps</h3>
        <p class="text-xs text-gray-400 mb-4">Sur la période sélectionnée</p>
        <div class="flex items-center justify-center" style="height:160px">
          <canvas id="chart-donut"></canvas>
        </div>
        <div id="donut-legend" class="mt-4 space-y-1.5"></div>
      </div>
    </div>

    <!-- TIMELINE ÉVÉNEMENTS -->
    <div id="hist-timeline"></div>
  `;

  renderKpis(kpis);
  ensureChartJs().then(() => {
    renderLineChart(daily);
    renderDonutChart(kpis);
  });
  renderTimeline();
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

function renderKpis(kpis) {
  const el = document.getElementById('hist-kpis');
  if (!el) return;

  const dispo      = kpis.availability_rate  ?? kpis.taux_disponibilite    ?? null;
  const nbPannes   = kpis.breakdown_count    ?? _imprevus.filter(i => i.type === 'breakdown').length;
  const totalArret = kpis.total_downtime     ?? kpis.duree_totale_arret     ?? null;
  const avgArret   = kpis.avg_downtime       ?? kpis.duree_moyenne_panne    ??
    (nbPannes > 0 && totalArret != null ? Math.round(totalArret / nbPannes) : null);

  const pct      = dispo != null ? Math.round(dispo * 100) : null;
  const dispoGood= pct != null && pct >= 90;

  const cards = [
    {
      label:  'Disponibilité',
      icon:   '📈',
      color:  dispoGood ? '#1D9E75' : pct != null && pct >= 70 ? '#F59E0B' : '#EF4444',
      bg:     dispoGood ? '#ECFDF5' : pct != null && pct >= 70 ? '#FFFBEB' : '#FEF2F2',
      render: () => {
        if (pct == null) return `<span class="text-2xl font-extrabold text-gray-300">—</span>`;
        return `
          <p class="text-2xl font-extrabold" style="color:${dispoGood ? '#1D9E75' : pct >= 70 ? '#F59E0B' : '#EF4444'}">
            ${pct} %
          </p>
          <div class="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700"
                 style="width:${pct}%; background:${dispoGood ? '#1D9E75' : pct >= 70 ? '#F59E0B' : '#EF4444'}">
            </div>
          </div>`;
      },
      sub: 'Taux de disponibilité',
    },
    {
      label:  'Pannes',
      icon:   '⚡',
      color:  nbPannes > 0 ? '#EF4444' : '#1D9E75',
      bg:     nbPannes > 0 ? '#FEF2F2' : '#ECFDF5',
      render: () => `<p class="text-2xl font-extrabold" style="color:${nbPannes > 0 ? '#EF4444' : '#1D9E75'}">${nbPannes}</p>`,
      sub: 'Arrêts sur la période',
    },
    {
      label:  'Durée totale arrêt',
      icon:   '⏱',
      color:  '#F59E0B',
      bg:     '#FFFBEB',
      render: () => `<p class="text-2xl font-extrabold text-[#F59E0B]">${fmtMin(totalArret)}</p>`,
      sub: `${nbPannes} panne(s) cumulée(s)`,
    },
    {
      label:  'Durée moy./panne',
      icon:   '📐',
      color:  '#8B5CF6',
      bg:     '#F5F3FF',
      render: () => `<p class="text-2xl font-extrabold text-[#8B5CF6]">${fmtMin(avgArret)}</p>`,
      sub: 'Moyenne par événement',
    },
  ];

  el.innerHTML = cards.map(c => `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
      <div class="flex items-start justify-between gap-2 mb-3">
        <p class="text-xs font-semibold text-gray-500 leading-tight">${c.label}</p>
        <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
             style="background:${c.bg}">
          ${c.icon}
        </div>
      </div>
      ${c.render()}
      <p class="text-xs text-gray-400 mt-1.5">${c.sub}</p>
    </div>`).join('');
}

// ─── Chart.js lazy ────────────────────────────────────────────────────────────

async function ensureChartJs() {
  if (window.Chart) return;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src   = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function destroyCharts() {
  _lineChart?.destroy();  _lineChart  = null;
  _donutChart?.destroy(); _donutChart = null;
}

// ─── Graphe ligne ─────────────────────────────────────────────────────────────

function renderLineChart(daily) {
  const ctx = document.getElementById('chart-line');
  if (!ctx || !window.Chart) return;

  // Si pas de données daily, générer des données mock pour la démo
  const data = daily.length > 0 ? daily : generateMockDaily(PERIOD_DAYS[_period] ?? 30);

  const labels = data.map(d => fmtDate(d.date ?? d.day));
  const values = data.map(d => {
    const r = d.availability ?? d.disponibilite ?? d.rate;
    return r != null ? Math.round(r * (r <= 1 ? 100 : 1)) : null;
  });

  // Points rouges pour les jours avec pannes
  const pointColors = data.map(d =>
    (d.breakdown_count ?? d.pannes ?? 0) > 0 ? '#EF4444' : '#378ADD'
  );
  const pointRadius = data.map(d =>
    (d.breakdown_count ?? d.pannes ?? 0) > 0 ? 6 : 3
  );

  _lineChart = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label:           'Disponibilité (%)',
        data:            values,
        borderColor:     '#378ADD',
        backgroundColor: 'rgba(55,138,221,0.10)',
        pointBackgroundColor: pointColors,
        pointBorderColor:     pointColors,
        pointRadius:          pointRadius,
        pointHoverRadius:     8,
        fill:            true,
        tension:         0.35,
        borderWidth:     2,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const i = items[0].dataIndex;
              return labels[i];
            },
            label: (item) => ` Disponibilité : ${item.raw ?? '—'} %`,
            afterLabel: (item) => {
              const d = data[item.dataIndex];
              const n = d.breakdown_count ?? d.pannes ?? 0;
              return n > 0 ? ` ⚡ ${n} panne(s)` : '';
            },
          },
        },
      },
      scales: {
        x: {
          grid:  { display: false },
          ticks: { font: { size: 10 }, color: '#9CA3AF', maxTicksLimit: 10 },
        },
        y: {
          min: 0, max: 100,
          grid:  { color: '#F3F4F6' },
          ticks: {
            font: { size: 11 }, color: '#6B7280',
            callback: v => `${v} %`,
          },
        },
      },
    },
  });
}

// ─── Graphe donut ─────────────────────────────────────────────────────────────

function renderDonutChart(kpis) {
  const ctx = document.getElementById('chart-donut');
  if (!ctx || !window.Chart) return;

  const days  = PERIOD_DAYS[_period] ?? 30;
  const cap   = (_machine?.capacity_per_day ?? 480) * days;  // minutes totales théoriques

  // Données depuis l'API ou estimation locale
  const prod  = kpis.production_time  ?? kpis.temps_production  ??
    Math.round(cap * (kpis.availability_rate ?? 0.80));
  const panne = kpis.downtime         ?? kpis.temps_panne        ??
    _imprevus.reduce((s, i) => s + (i.estimated_duration ?? 0), 0);
  const maint = kpis.maintenance_time ?? kpis.temps_maintenance  ?? Math.round(cap * 0.05);
  const idle  = Math.max(0, cap - prod - panne - maint);

  const vals  = [prod, panne, maint, idle].map(v => Math.max(0, v));
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const labels= ['Production', 'Panne', 'Maintenance', 'Inactivité'];
  const colors= ['#1D9E75', '#EF4444', '#F59E0B', '#9CA3AF'];

  _donutChart = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data:            vals,
        backgroundColor: colors,
        borderColor:     '#fff',
        borderWidth:     3,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx =>
              ` ${ctx.label} : ${fmtMin(ctx.raw)} (${Math.round(ctx.raw / total * 100)} %)`,
          },
        },
      },
    },
  });

  // Légende custom
  const legend = document.getElementById('donut-legend');
  if (legend) {
    legend.innerHTML = labels.map((l, i) => {
      const pct = Math.round(vals[i] / total * 100);
      return `
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm shrink-0"
                  style="background:${colors[i]}"></span>
            <span class="text-gray-600">${l}</span>
          </div>
          <div class="flex items-center gap-2 text-right">
            <span class="text-gray-400">${fmtMin(vals[i])}</span>
            <span class="font-semibold text-gray-800 w-8">${pct} %</span>
          </div>
        </div>`;
    }).join('');
  }
}

// ─── Timeline événements ──────────────────────────────────────────────────────

function renderTimeline() {
  const el = document.getElementById('hist-timeline');
  if (!el) return;

  if (_imprevus.length === 0 && !_histData?.events?.length) {
    el.innerHTML = `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div class="text-3xl mb-2">✅</div>
        <p class="font-semibold text-gray-700">Aucun événement sur cette période</p>
        <p class="text-sm text-gray-400 mt-1">La machine a fonctionné sans perturbation signalée.</p>
      </div>`;
    return;
  }

  // Fusionne imprévus + événements du historique si disponibles
  const events = [
    ..._imprevus,
    ...toArr(_histData?.events ?? []).filter(e =>
      !_imprevus.find(i => i.id === e.id)
    ),
  ].sort((a, b) => new Date(b.reported_at ?? b.date ?? 0) - new Date(a.reported_at ?? a.date ?? 0));

  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 class="font-semibold text-gray-800">Timeline des événements</h3>
        <span class="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
          ${events.length} événement(s)
        </span>
      </div>

      <div class="divide-y divide-gray-50">
        ${events.map(e => timelineItem(e)).join('')}
      </div>
    </div>`;
}

function timelineItem(evt) {
  const type   = EVT_CFG[evt.type] || EVT_CFG.other;
  const st     = evt.is_active  ? 'active' :
                 evt.status === 'resolved' ? 'resolved' : 'pending';
  const status = STATUS_CFG[st] || STATUS_CFG.pending;

  return `
    <div class="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
      <!-- Icône -->
      <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 mt-0.5"
           style="background:${type.bg}">
        ${type.icon}
      </div>

      <!-- Détails -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-semibold text-gray-800">${type.label}</span>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs
                       font-semibold border ${status.cls}">
            ${status.label}
          </span>
        </div>
        <p class="text-xs text-gray-500 mt-0.5 truncate">
          ${evt.description ?? evt.notes ?? 'Aucune description.'}
        </p>
      </div>

      <!-- Durée + Date -->
      <div class="shrink-0 text-right">
        <p class="text-sm font-bold text-gray-700">
          ${fmtMin(evt.estimated_duration ?? evt.duration_minutes)}
        </p>
        <p class="text-xs text-gray-400 mt-0.5">
          ${fmtDateTime(evt.reported_at ?? evt.date ?? evt.created_at)}
        </p>
      </div>
    </div>`;
}

// ─── État vide initial ────────────────────────────────────────────────────────

function renderEmptyState() {
  const el = document.getElementById('hist-content');
  if (!el) return;

  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
      <!-- SVG machine -->
      <svg class="mx-auto mb-5" width="110" height="90" viewBox="0 0 110 90" fill="none">
        <!-- Corps machine -->
        <rect x="15" y="28" width="80" height="52" rx="8" fill="#F3F4F6" stroke="#E5E7EB" stroke-width="1.5"/>
        <!-- Panneau de contrôle -->
        <rect x="24" y="36" width="28" height="32" rx="4" fill="#E5E7EB"/>
        <!-- Boutons -->
        <circle cx="32" cy="44" r="4" fill="#1D9E75"/>
        <circle cx="44" cy="44" r="4" fill="#378ADD"/>
        <rect x="28" y="52" width="20" height="3" rx="1.5" fill="#D1D5DB"/>
        <rect x="28" y="58" width="14" height="3" rx="1.5" fill="#D1D5DB"/>
        <!-- Bras mécanique -->
        <rect x="60" y="36" width="12" height="28" rx="4" fill="#E5E7EB"/>
        <rect x="68" y="50" width="18" height="8" rx="3" fill="#D1D5DB"/>
        <!-- Engrenage -->
        <circle cx="87" cy="18" r="12" fill="#ECFDF5" stroke="#6EE7B7" stroke-width="1.5"/>
        <text x="87" y="23" text-anchor="middle" fill="#1D9E75" font-size="12" font-weight="bold">?</text>
        <!-- Base -->
        <rect x="20" y="78" width="70" height="6" rx="3" fill="#E5E7EB"/>
      </svg>
      <p class="font-bold text-gray-700 text-lg mb-1">Sélectionnez une machine</p>
      <p class="text-sm text-gray-400 max-w-xs mx-auto">
        Choisissez une machine dans le sélecteur ci-dessus pour visualiser son historique de performances.
      </p>
    </div>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Génère des données journalières fictives pour la demo offline */
function generateMockDaily(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d    = new Date();
    d.setDate(d.getDate() - i);
    const rand = 0.75 + Math.random() * 0.25;
    const pann = Math.random() > 0.85 ? 1 : 0;
    days.push({
      date:             d.toISOString().slice(0, 10),
      availability:     pann ? rand * 0.6 : rand,
      breakdown_count:  pann,
    });
  }
  return days;
}

function periodLabel() {
  if (_period === 'custom') return `${_customFrom} → ${_customTo}`;
  return { '7d': '7 derniers jours', '30d': '30 derniers jours', '90d': '90 derniers jours' }[_period] ?? '';
}

async function safeCall(fn) {
  try   { return { data: await fn(), error: null }; }
  catch { return { data: null, error: true }; }
}

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
  try { return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'short' }).format(new Date(str)); }
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

const SEL_CLS = `w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50
  focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD] transition-all`;

const INP_CLS = `w-full px-3 border border-gray-200 rounded-xl bg-gray-50
  focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD] transition-all`;
