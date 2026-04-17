/**
 * dashboard.js — Tableau de bord AutoMaroc Scheduling
 *
 * Endpoints :
 *   GET /api/scheduling/dashboard/  → { counters, recent_runs, active_imprevus? }
 *   GET /api/scheduling/imprevus/   → liste imprévus (fallback si absent du dashboard)
 *   GET /api/jobs/                  → pour analyse types d'atelier
 *   GET /api/jobs/operations/       → pour l'analyse gammes
 *   GET /api/machines/              → top 5 capacité
 *
 * Chart.js chargé via CDN si absent.
 */

import { schedulingApi, jobsApi, machinesApi, operationsApi, imprevusApi }
  from '../services/api.js';
import { renderAtelierBadge } from '../components/atelier-badge.js';
import { toast }              from '../components/toast.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ALGO_MAP = {
  spt:     { label: 'SPT',     icon: '⚡', color: '#378ADD' },
  lpt:     { label: 'LPT',     icon: '🏗️', color: '#8B5CF6' },
  edd:     { label: 'EDD',     icon: '📅', color: '#1D9E75' },
  johnson: { label: 'Johnson', icon: '🏆', color: '#F59E0B' },
  cds:     { label: 'CDS',     icon: '🧮', color: '#06B6D4' },
};

const STATUS_COLORS = {
  draft:       '#9CA3AF',
  ready:       '#378ADD',
  in_progress: '#F59E0B',
  completed:   '#1D9E75',
  cancelled:   '#EF4444',
};

const STATUS_LABELS = {
  draft: 'Brouillon', ready: 'Prêt',
  in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé',
};

const IMPREVU_TYPES = {
  breakdown:       { icon: '🔴', label: 'Panne machine'    },
  material_shortage:{ icon: '🟠', label: 'Manque matière'  },
  quality_issue:   { icon: '🟡', label: 'Problème qualité' },
  maintenance:     { icon: '🔵', label: 'Maintenance'      },
  other:           { icon: '⚫', label: 'Autre'            },
};

// Shift actif selon l'heure
function getActiveShift() {
  const h = new Date().getHours();
  if (h >= 6  && h < 14) return { label: 'Shift matin',  color: '#1D9E75', icon: '🌅' };
  if (h >= 14 && h < 22) return { label: 'Shift soir',   color: '#378ADD', icon: '🌆' };
  return                         { label: 'Shift nuit',   color: '#8B5CF6', icon: '🌙' };
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function render(container) {
  const shift = getActiveShift();
  container.innerHTML = buildShell(shift);
  renderSkeleton();
  await loadData(shift);
}

// ─── Chargement parallèle ─────────────────────────────────────────────────────

async function loadData(shift) {
  // Toutes les requêtes en parallèle — chacune est protégée individuellement
  const safe = fn => fn.catch ? fn.catch(() => ({ data: null, error: true })) : Promise.resolve({ data: null, error: true });

  const dashFn = typeof schedulingApi.dashboard === 'function'
    ? schedulingApi.dashboard()
    : Promise.resolve({ data: null, error: null });

  const [rDash, rJobs, rMachines, rOps, rImprevus] = await Promise.all([
    safe(dashFn),
    safe(jobsApi.list({ page_size: 500 })),
    safe(machinesApi.list({ page_size: 500 })),
    safe(operationsApi.list({ page_size: 1000 })),
    safe(imprevusApi ? imprevusApi.list({ page_size: 20 }) : Promise.resolve({ data: null })),
  ]);

  // Extraire les données disponibles (peut être null si API down)
  const counters   = rDash.data?.counters    || {};
  const recentRuns = toArr(rDash.data?.recent_runs);
  const jobs       = toArr(rJobs.data);
  const machines   = toArr(rMachines.data);
  const ops        = toArr(rOps.data);

  // Compteurs depuis les listes directes si dashboard indisponible
  if (Object.keys(counters).length === 0 && jobs.length === 0 && (rDash.error || !rDash.data)) {
    // Backend entièrement inaccessible — on affiche quand même les sections vides
  } else if (Object.keys(counters).length === 0) {
    // Dashboard endpoint absent, on calcule depuis les listes
    counters.machines      = machines.length;
    counters.active_machines = machines.filter(m => m.is_active).length;
    counters.jobs          = jobs.length;
    counters.active_jobs   = jobs.filter(j => j.is_active).length;
    counters.operations    = ops.length;
  }

  // Imprévus depuis dashboard ou endpoint dédié
  let imprevus = toArr(rDash.data?.active_imprevus ?? rDash.data?.imprevus ?? rImprevus.data)
    .filter(i => i.is_active !== false)
    .slice(0, 5);

  // Toujours afficher, même à vide
  renderAll(counters, recentRuns, jobs, machines, ops, imprevus, shift);
}

// ─── Shell HTML ───────────────────────────────────────────────────────────────

function buildShell(shift) {
  const today = new Date().toLocaleDateString('fr-MA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return `
    <!-- HEADER -->
    <div class="mb-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Tableau de bord</h2>
        <p class="text-sm text-gray-500 mt-0.5 capitalize">${today}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style="background:${shift.color}15; color:${shift.color}; border-color:${shift.color}30">
          ${shift.icon} ${shift.label}
        </span>
        <button onclick="location.reload()"
                class="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                title="Rafraîchir">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581
                     m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ZONES injectées dynamiquement -->
    <div id="dash-kpis"></div>
    <div id="dash-charts" class="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5"></div>
    <div id="dash-runs"  class="mt-5"></div>
    <div id="dash-imprevus" class="mt-5"></div>
    <div id="dash-atelier" class="mt-5"></div>
  `;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function renderSkeleton() {
  const kpiEl = document.getElementById('dash-kpis');
  if (kpiEl) kpiEl.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      ${[...Array(6)].map(() =>
        `<div class="bg-white rounded-2xl border border-gray-100 shadow-sm h-28 animate-pulse bg-gradient-to-br from-gray-50 to-gray-100"></div>`
      ).join('')}
    </div>`;
}

// ─── Rendu principal ─────────────────────────────────────────────────────────

function renderAll(counters, recentRuns, jobs, machines, ops, imprevus, shift) {
  renderKpis(counters, imprevus);
  renderCharts(jobs, machines);
  renderRecentRuns(recentRuns);
  renderImprevus(imprevus);
  renderAtelierSection(jobs, ops);
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

function renderKpis(c, imprevus) {
  const el = document.getElementById('dash-kpis');
  if (!el) return;

  const activeImprevus = imprevus.filter(i => i.is_active !== false).length;

  const cards = [
    {
      label: 'Machines actives',
      value: `${c.active_machines ?? 0}`,
      sub:   `sur ${c.machines ?? 0} total`,
      icon:  iconGear(),
      color: '#378ADD',
      bg:    '#EFF6FF',
      id:    'kpi-machines',
    },
    {
      label: 'OFs actifs',
      value: `${c.active_jobs ?? 0}`,
      sub:   `sur ${c.jobs ?? 0} total`,
      icon:  iconList(),
      color: '#1D9E75',
      bg:    '#ECFDF5',
      id:    'kpi-jobs',
    },
    {
      label: 'Opérations',
      value: `${c.operations ?? 0}`,
      sub:   'gammes configurées',
      icon:  iconLink(),
      color: '#8B5CF6',
      bg:    '#F5F3FF',
      id:    'kpi-ops',
    },
    {
      label: 'Runs lancés',
      value: `${c.schedule_runs ?? 0}`,
      sub:   'ordonnancements',
      icon:  iconPlay(),
      color: '#F59E0B',
      bg:    '#FFFBEB',
      id:    'kpi-runs',
    },
    {
      label: 'Runs complétés',
      value: `${c.completed_runs ?? 0}`,
      sub:   `${c.schedule_runs ? Math.round(((c.completed_runs ?? 0) / c.schedule_runs) * 100) : 0} %`,
      icon:  iconCheck(),
      color: '#1D9E75',
      bg:    '#ECFDF5',
      id:    'kpi-completed',
    },
    {
      label: 'Imprévus actifs',
      value: `${activeImprevus}`,
      sub:   activeImprevus > 0 ? '⚠ Attention requise' : 'Aucun problème',
      icon:  iconAlert(),
      color: activeImprevus > 0 ? '#EF4444' : '#1D9E75',
      bg:    activeImprevus > 0 ? '#FEF2F2' : '#ECFDF5',
      id:    'kpi-imprevus',
      urgent: activeImprevus > 0,
    },
  ];

  el.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      ${cards.map(card => `
        <div class="bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all
                    ${card.urgent ? 'border-red-200 ring-2 ring-red-100 animate-pulse' : 'border-gray-100'}">
          <div class="flex items-start justify-between gap-2 mb-3">
            <p class="text-xs font-semibold text-gray-500 leading-tight">${card.label}</p>
            <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                 style="background:${card.bg}; color:${card.color}">
              ${card.icon}
            </div>
          </div>
          <p id="${card.id}" class="text-2xl font-extrabold tabular-nums"
             style="color:${card.color}">0</p>
          <p class="text-xs text-gray-400 mt-1">${card.sub}</p>
        </div>`
      ).join('')}
    </div>`;

  // Animate counters
  cards.forEach(card => {
    const target = parseInt(card.value) || 0;
    animateCounter(card.id, target);
  });
}

function animateCounter(id, target, duration = 600) {
  const el = document.getElementById(id);
  if (!el || target === 0) { if (el) el.textContent = '0'; return; }
  const start    = performance.now();
  const tick = (now) => {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3);   // ease-out cubic
    el.textContent = Math.floor(ease * target).toString();
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target.toString();
  };
  requestAnimationFrame(tick);
}

// ─── Charts ───────────────────────────────────────────────────────────────────

async function renderCharts(jobs, machines) {
  const el = document.getElementById('dash-charts');
  if (!el) return;

  el.innerHTML = `
    <!-- Donut statuts OFs -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 class="font-semibold text-gray-800 mb-1 text-sm">Répartition statuts OFs</h3>
      <p class="text-xs text-gray-400 mb-4">Distribution des ordres de fabrication</p>
      <div class="flex items-center justify-center h-48">
        <canvas id="chart-donut" style="max-height:180px"></canvas>
      </div>
      <div id="donut-legend" class="flex flex-wrap justify-center gap-3 mt-3"></div>
    </div>

    <!-- Barres machines -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 class="font-semibold text-gray-800 mb-1 text-sm">Top 5 machines — Capacité journalière</h3>
      <p class="text-xs text-gray-400 mb-4">En minutes par jour</p>
      <div style="height:180px; position:relative">
        <canvas id="chart-bars"></canvas>
      </div>
    </div>`;

  await ensureChartJs();
  renderDonut(jobs);
  renderBars(machines);
}

async function ensureChartJs() {
  if (window.Chart) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function renderDonut(jobs) {
  const ctx = document.getElementById('chart-donut');
  if (!ctx || !window.Chart) return;

  // Comptage par statut
  const counts = {};
  jobs.forEach(j => {
    const s = j.status || 'draft';
    counts[s] = (counts[s] || 0) + 1;
  });

  const statuses = Object.keys(counts).filter(s => counts[s] > 0);
  if (statuses.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="flex items-center justify-center h-48 text-gray-300 text-sm">
        Aucun OF chargé
      </div>`;
    return;
  }

  const data   = statuses.map(s => counts[s]);
  const colors = statuses.map(s => STATUS_COLORS[s] || '#9CA3AF');
  const labels = statuses.map(s => STATUS_LABELS[s] || s);
  const total  = data.reduce((a, b) => a + b, 0);

  new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor:     '#fff',
        borderWidth:     3,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label} : ${ctx.raw} (${Math.round(ctx.raw / total * 100)} %)`,
          },
        },
      },
    },
  });

  // Légende custom
  const legend = document.getElementById('donut-legend');
  if (legend) {
    legend.innerHTML = statuses.map((s, i) => `
      <div class="flex items-center gap-1.5 text-xs text-gray-600">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${colors[i]}"></span>
        ${labels[i]} <span class="font-semibold text-gray-900">${data[i]}</span>
      </div>`).join('');
  }
}

function renderBars(machines) {
  const ctx = document.getElementById('chart-bars');
  if (!ctx || !window.Chart) return;

  const top5 = [...machines]
    .filter(m => m.is_active && m.capacity_per_day > 0)
    .sort((a, b) => (b.capacity_per_day ?? 0) - (a.capacity_per_day ?? 0))
    .slice(0, 5);

  if (top5.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="flex items-center justify-center h-44 text-gray-300 text-sm">
        Aucune machine active
      </div>`;
    return;
  }

  new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: top5.map(m => m.code ?? m.name),
      datasets: [{
        label: 'Capacité (min/jour)',
        data:  top5.map(m => m.capacity_per_day ?? 0),
        backgroundColor: top5.map((_, i) => `hsl(${215 - i * 15}, 70%, ${55 + i * 4}%)`),
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#6B7280' },
        },
        y: {
          grid: { color: '#F3F4F6' },
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

// ─── Runs récents ─────────────────────────────────────────────────────────────

function renderRecentRuns(runs) {
  const el = document.getElementById('dash-runs');
  if (!el) return;

  const recent = [...runs]
    .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))
    .slice(0, 5);

  const runStatusCfg = {
    pending:   { label: 'En attente', cls: 'bg-gray-100 text-gray-600' },
    running:   { label: 'En cours',   cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Terminé',    cls: 'bg-green-100 text-green-700' },
    failed:    { label: 'Échec',      cls: 'bg-red-50 text-red-600' },
  };

  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 class="font-semibold text-gray-800">Derniers ordonnancements</h3>
          <p class="text-xs text-gray-400 mt-0.5">${recent.length} run(s) récent(s)</p>
        </div>
        <a href="#/scheduling"
           class="text-xs font-semibold text-[#378ADD] hover:underline transition-all">
          Voir tout →
        </a>
      </div>

      ${recent.length === 0
        ? `<div class="px-5 py-10 text-center text-gray-400 text-sm">
             <div class="text-3xl mb-2">🚀</div>
             Aucun run lancé — créez votre premier ordonnancement.
           </div>`
        : `<div class="divide-y divide-gray-50">
            ${recent.map(run => {
              const algo   = ALGO_MAP[run.algorithm] || { label: run.algorithm, icon: '📐', color: '#9CA3AF' };
              const status = runStatusCfg[run.status] || runStatusCfg.pending;
              const isCompleted = run.status === 'completed';

              return `
                <div class="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <!-- Algo icon -->
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl
                               bg-gray-50 border border-gray-100">
                    ${algo.icon}
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-800 truncate">
                      ${run.name ?? `Run #${run.id}`}
                    </p>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold"
                            style="background:${algo.color}15; color:${algo.color}">
                        ${algo.label}
                      </span>
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.cls}">
                        ${status.label}
                      </span>
                      ${isCompleted && run.cmax_minutes != null
                        ? `<span class="text-xs text-[#1D9E75] font-semibold">
                             Cmax : ${fmtMin(run.cmax_minutes)}
                           </span>`
                        : ''}
                    </div>
                  </div>

                  <!-- Gantt button -->
                  <div class="shrink-0">
                    ${isCompleted
                      ? `<a href="#/gantt?run=${run.id}"
                             class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                                    font-semibold border border-[#378ADD] text-[#378ADD]
                                    hover:bg-[#EFF6FF] transition-all">
                           📊 Gantt
                         </a>`
                      : `<span class="text-xs text-gray-400">${fmtDateTime(run.created_at)}</span>`}
                  </div>
                </div>`;
            }).join('')}
          </div>`}
    </div>`;
}

// ─── Imprévus actifs ─────────────────────────────────────────────────────────

function renderImprevus(imprevus) {
  const el = document.getElementById('dash-imprevus');
  if (!el) return;

  const active = imprevus.filter(i => i.is_active !== false);

  el.innerHTML = `
    <div class="bg-white rounded-2xl border ${active.length > 0 ? 'border-red-200' : 'border-gray-100'} shadow-sm overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b ${active.length > 0 ? 'border-red-100 bg-red-50' : 'border-gray-100'}">
        <div class="flex items-center gap-2">
          ${active.length > 0
            ? `<span class="relative flex h-3 w-3">
                 <span class="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75"></span>
                 <span class="relative h-3 w-3 rounded-full bg-red-500"></span>
               </span>`
            : `<span class="w-3 h-3 rounded-full bg-[#1D9E75]"></span>`}
          <h3 class="font-semibold ${active.length > 0 ? 'text-red-700' : 'text-gray-800'}">
            Imprévus actifs
          </h3>
          ${active.length > 0
            ? `<span class="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold">
                 ${active.length}
               </span>`
            : ''}
        </div>
        <a href="#/imprevus"
           class="text-xs font-semibold ${active.length > 0 ? 'text-red-600' : 'text-[#378ADD]'} hover:underline">
          Voir tous →
        </a>
      </div>

      ${active.length === 0
        ? `<div class="px-5 py-6 flex items-center gap-3">
             <div class="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center text-xl">✅</div>
             <div>
               <p class="font-semibold text-[#065F46] text-sm">Aucun imprévus en cours</p>
               <p class="text-xs text-[#1D9E75] mt-0.5">Usine opérationnelle — Production nominale</p>
             </div>
           </div>`
        : `<div class="divide-y divide-gray-50">
             ${active.map(imp => {
               const t = IMPREVU_TYPES[imp.type] || IMPREVU_TYPES.other;
               return `
                 <div class="flex items-start gap-3 px-5 py-3.5 hover:bg-red-50/40 transition-colors">
                   <span class="text-xl mt-0.5 shrink-0">${t.icon}</span>
                   <div class="flex-1 min-w-0">
                     <p class="text-sm font-semibold text-gray-800">${t.label}</p>
                     <div class="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-500">
                       ${imp.machine_name || imp.machine?.name
                         ? `<span>⚙️ ${imp.machine_name || imp.machine?.name}</span>`
                         : ''}
                       ${imp.estimated_duration
                         ? `<span>⏱ ${fmtMin(imp.estimated_duration)}</span>`
                         : ''}
                       ${imp.description
                         ? `<span class="truncate max-w-[200px]">· ${imp.description}</span>`
                         : ''}
                     </div>
                   </div>
                   <span class="shrink-0 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                     Actif
                   </span>
                 </div>`;
             }).join('')}
           </div>`}
    </div>`;
}

// ─── Analyse types d'atelier ──────────────────────────────────────────────────

function renderAtelierSection(jobs, ops) {
  const el = document.getElementById('dash-atelier');
  if (!el) return;

  if (jobs.length === 0 || ops.length === 0) {
    el.innerHTML = '';
    return;
  }

  // Grouper opérations par job
  const opsByJob = {};
  ops.forEach(op => {
    const jId = String(op.job?.id ?? op.job ?? 'x');
    if (!opsByJob[jId]) opsByJob[jId] = [];
    opsByJob[jId].push(op);
  });

  // Classifie chaque job
  const typeCounts = { flow_shop: 0, job_shop: 0, single_machine: 0, unknown: 0 };

  jobs.forEach(j => {
    const jOps = opsByJob[String(j.id)] ?? [];
    if (jOps.length === 0) { typeCounts.unknown++; return; }
    if (jOps.length === 1) { typeCounts.single_machine++; return; }

    // Flow shop = toutes les machines différentes dans cet OF
    const machineIds = jOps.map(o => String(o.machine?.id ?? o.machine));
    const isFlow     = new Set(machineIds).size === machineIds.length;
    typeCounts[isFlow ? 'flow_shop' : 'job_shop']++;
  });

  const detected = [
    { type: 'flow_shop',       count: typeCounts.flow_shop,       label: 'Flow Shop' },
    { type: 'job_shop',        count: typeCounts.job_shop,        label: 'Job Shop'  },
    { type: 'single_machine',  count: typeCounts.single_machine,  label: 'Machine unique' },
  ].filter(t => t.count > 0);

  const dominantType = detected.sort((a, b) => b.count - a.count)[0]?.type ?? 'flow_shop';

  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h3 class="font-semibold text-gray-800">Types d'ateliers détectés</h3>
          <p class="text-xs text-gray-400 mt-0.5">
            Analyse automatique des gammes opératoires de ${jobs.length} OF(s)
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">Dominant :</span>
          ${renderAtelierBadge(dominantType)}
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        ${detected.map(t => {
          const pct = jobs.length > 0 ? Math.round((t.count / jobs.length) * 100) : 0;
          return `
            <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div class="flex items-center justify-between mb-2">
                ${renderAtelierBadge(t.type, { size: 'sm' })}
                <span class="text-lg font-bold text-gray-800">${t.count}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div class="h-1.5 rounded-full transition-all duration-700"
                     style="width:${pct}%; background:#378ADD"></div>
              </div>
              <p class="text-xs text-gray-400 mt-1">${pct} % des OFs</p>
            </div>`;
        }).join('')}
      </div>

      ${typeCounts.unknown > 0
        ? `<p class="text-xs text-gray-400 mt-3">
             ${typeCounts.unknown} OF(s) sans opérations configurées — non comptabilisés.
           </p>`
        : ''}

      <div class="mt-4 flex items-center gap-2 bg-[#EFF6FF] border border-blue-100 rounded-xl px-4 py-3">
        <svg class="w-4 h-4 text-[#378ADD] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-xs text-blue-700">
          <strong>Conseil :</strong> Pour un Flow Shop, utilisez <strong>SPT</strong>, <strong>EDD</strong> ou 
          <strong>Johnson</strong> (2 postes) / <strong>CDS</strong> (3+ postes).
          Pour Job Shop, préférez <strong>EDD</strong> ou <strong>SPT</strong>.
        </p>
      </div>
    </div>`;
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

function fmtDateTime(str) {
  if (!str) return '—';
  try {
    return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(str));
  } catch { return str; }
}

// ─── Icons SVG ────────────────────────────────────────────────────────────────

function iconGear() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066
             c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924
             0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724
             0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066
             c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426
             -1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37
             .996.608 2.296.07 2.572-1.065z"/>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>`;
}

function iconList() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
             M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
  </svg>`;
}

function iconLink() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101
             m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
  </svg>`;
}

function iconPlay() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132
             a1 1 0 000-1.664z"/>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`;
}

function iconCheck() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`;
}

function iconAlert() {
  return `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333
             -2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
  </svg>`;
}
