/**
 * gantt.js — Page Diagramme de Gantt AutoMaroc
 *
 * Endpoints :
 *   GET /api/scheduling/runs/                → liste des runs (sélecteur)
 *   GET /api/scheduling/runs/{id}/gantt/     → données Gantt
 *   GET /api/scheduling/runs/{id}/kpis/      → métriques de performance
 *   GET /api/scheduling/imprevus/?run={id}   → imprévus associés au run
 */

import { GanttChart }               from '../components/gantt-chart.js';
import { schedulingApi, imprevusApi } from '../services/api.js';
import { toast }                       from '../components/toast.js';

// ─── État local ───────────────────────────────────────────────────────────────

let _chart      = null;   // instance GanttChart
let _runs       = [];
let _currentId  = null;
let _ganttData  = null;
let _hasImprevu = false;

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = buildShell();
  await loadRuns();

  // Si URL contient ?run=X → pré-sélection automatique
  const urlRun = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('run');
  if (urlRun) {
    const sel = document.getElementById('run-selector');
    if (sel) sel.value = urlRun;
    await loadGantt(Number(urlRun));
  }

  bindEvents();
}

// ─── Shell HTML ───────────────────────────────────────────────────────────────

function buildShell() {
  return `
    <!-- HEADER -->
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Diagramme de Gantt</h2>
        <p id="gantt-subtitle" class="text-sm text-gray-500 mt-0.5">Visualisation du planning d'ordonnancement</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button id="btn-export-png" disabled
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       border border-gray-200 text-gray-500 bg-white hover:border-gray-300
                       disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export PNG
        </button>
        <button id="btn-replan" disabled
                class="hidden items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       bg-orange-50 border border-orange-200 text-orange-700
                       hover:bg-orange-100 disabled:opacity-40 transition-all">
          🔄 Replanifier
        </button>
      </div>
    </div>

    <!-- SÉLECTEUR DE RUN -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Run d'ordonnancement
          </label>
          <select id="run-selector"
                  class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 focus:border-[#378ADD]
                         transition-all">
            <option value="">— Sélectionnez un run —</option>
          </select>
        </div>
        <button id="btn-load-gantt"
                class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#378ADD] text-white
                       hover:bg-[#185FA5] transition-all disabled:opacity-50 shadow-sm shrink-0">
          📊 Charger le Gantt
        </button>
      </div>
      <div id="run-info" class="hidden mt-3 pt-3 border-t border-gray-100"></div>
    </div>

    <!-- ZONE GANTT -->
    <div id="gantt-area" class="hidden">

      <!-- Légende -->
      <div id="gantt-legend"
           class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4
                  flex flex-wrap items-center gap-3 overflow-x-auto">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Légende :</span>
      </div>

      <!-- Canvas wrapper (scroll horizontal sur mobile) -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div class="overflow-x-auto">
          <canvas id="gantt-canvas" style="min-width:600px; display:block;"></canvas>
        </div>
      </div>

      <!-- KPIs -->
      <div id="gantt-kpis" class="hidden"></div>

      <!-- Imprévus détectés -->
      <div id="imprevu-banner" class="hidden mt-4"></div>
    </div>

    <!-- État vide initial -->
    <div id="gantt-empty"
         class="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
      <div class="text-5xl mb-3">📊</div>
      <p class="font-semibold text-gray-700 mb-1">Aucun Gantt chargé</p>
      <p class="text-sm text-gray-400">Sélectionnez un run et cliquez sur "Charger le Gantt"</p>
    </div>
  `;
}

// ─── Événements ───────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('btn-load-gantt')?.addEventListener('click', () => {
    const sel = document.getElementById('run-selector');
    const id  = Number(sel?.value);
    if (!id) { toast.error('Sélectionnez un run.'); return; }
    loadGantt(id);
  });

  document.getElementById('btn-export-png')?.addEventListener('click', () => {
    _chart?.exportPNG(`gantt-run-${_currentId}.png`);
    toast.success('Export PNG téléchargé.');
  });

  document.getElementById('btn-replan')?.addEventListener('click', () => {
    window.location.hash = '#/scheduling';
    toast.info('Créez un nouveau run pour replanifier.');
  });
}

// ─── Chargement liste des runs ────────────────────────────────────────────────

async function loadRuns() {
  const { data } = await schedulingApi.list({ page_size: 200 });
  _runs = toArr(data).filter(r => r.status === 'completed');

  const sel = document.getElementById('run-selector');
  if (!sel) return;

  _runs
    .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))
    .forEach(run => {
      const opt    = document.createElement('option');
      opt.value    = run.id;
      const algo   = run.algorithm?.toUpperCase() ?? '?';
      opt.textContent = `${run.name ?? `Run #${run.id}`}  [${algo}]  — ${fmtDate(run.created_at)}`;
      sel.appendChild(opt);
    });

  if (_runs.length === 0) {
    sel.innerHTML = '<option value="">Aucun run complété disponible</option>';
  }
}

// ─── Chargement Gantt ────────────────────────────────────────────────────────

async function loadGantt(id) {
  _currentId = id;
  const btn  = document.getElementById('btn-load-gantt');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Chargement…'; }

  // Requêtes parallèles
  const [rGantt, rKpis, rImprevus] = await Promise.all([
    schedulingApi.gantt(id),
    schedulingApi.kpis(id),
    imprevusApi ? imprevusApi.list({ run: id, page_size: 50 }) : Promise.resolve({ data: null }),
  ]);

  if (btn) { btn.disabled = false; btn.textContent = '📊 Charger le Gantt'; }

  if (rGantt.error || !rGantt.data) {
    toast.error('Impossible de charger le Gantt — vérifiez que le backend est lancé.');
    return;
  }

  _ganttData = rGantt.data;
  const imprevus = toArr(rImprevus.data).filter(i => i.is_active !== false);
  _hasImprevu    = imprevus.length > 0;

  // Affiche la zone Gantt, cache l'état vide
  document.getElementById('gantt-empty')?.classList.add('hidden');
  document.getElementById('gantt-area')?.classList.remove('hidden');

  // Info run
  showRunInfo(id);

  // Rendu du canvas
  _chart = new GanttChart('gantt-canvas');
  _chart.render(_ganttData);

  // Overlay imprévus
  if (_hasImprevu) {
    const machines = _ganttData.machines ?? [];
    const imprevuOverlays = imprevus.map(iv => ({
      machineIndex: machines.findIndex(m => m.id === (iv.machine?.id ?? iv.machine)),
      startTime:    iv.start_offset_minutes ?? 0,
      duration:     iv.estimated_duration   ?? 30,
    })).filter(iv => iv.machineIndex >= 0);
    _chart.addImprevus(imprevuOverlays);
  }

  // Légende
  renderLegend(_ganttData, imprevus);

  // KPIs
  if (!rKpis.error && rKpis.data) {
    renderKpis(rKpis.data, id);
  }

  // Bannière imprévus
  renderImprevu(imprevus);

  // Activer boutons
  const exportBtn = document.getElementById('btn-export-png');
  const replanBtn = document.getElementById('btn-replan');
  if (exportBtn) exportBtn.disabled = false;
  if (replanBtn) {
    replanBtn.disabled = false;
    if (_hasImprevu) { replanBtn.classList.remove('hidden'); replanBtn.classList.add('inline-flex'); }
    else             { replanBtn.classList.add('hidden'); }
  }

  toast.success(`Gantt chargé — ${((_ganttData.machines ?? []).flatMap(m => m.tasks ?? [])).length} opérations sur ${(_ganttData.machines ?? []).length} machines.`);
}

// ─── Info run ─────────────────────────────────────────────────────────────────

function showRunInfo(id) {
  const run = _runs.find(r => r.id === id);
  const el  = document.getElementById('run-info');
  if (!el || !run) return;

  const ALGO = {
    spt: { icon: '⚡', label: 'SPT' }, lpt: { icon: '🏗️', label: 'LPT' },
    edd: { icon: '📅', label: 'EDD' }, johnson: { icon: '🏆', label: 'Johnson' },
    cds: { icon: '🧮', label: 'CDS' },
  };
  const a = ALGO[run.algorithm] || { icon: '📐', label: run.algorithm ?? '?' };

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <span class="font-semibold text-gray-800">${run.name ?? `Run #${id}`}</span>
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-[#378ADD] border border-blue-100">
        ${a.icon} ${a.label}
      </span>
      ${run.cmax_minutes != null
        ? `<span class="text-xs font-semibold text-[#1D9E75]">Cmax : ${fmtMin(run.cmax_minutes)}</span>`
        : ''}
      <span class="text-xs text-gray-400 ml-auto">${fmtDateTime(run.created_at)}</span>
    </div>`;
}

// ─── Légende ──────────────────────────────────────────────────────────────────

function renderLegend(ganttData, imprevus) {
  const el = document.getElementById('gantt-legend');
  if (!el || !_chart) return;

  const colorMap = _chart.jobColors;
  const jobs     = ganttData.jobs ?? [];

  // On construit un map job_id → nom depuis ganttData.jobs si disponible
  const jobNames = {};
  jobs.forEach(j => { jobNames[j.id] = j.name ?? j.code ?? `OF #${j.id}`; });

  // Couleurs utilisées dans les machines (ordre d'apparition)
  const usedIds = [...new Set(
    (ganttData.machines ?? []).flatMap(m => (m.tasks ?? []).map(t => t.job_id))
  )];

  const items = usedIds.map(jid => `
    <div class="flex items-center gap-1.5 shrink-0">
      <span class="w-3.5 h-3.5 rounded" style="background:${colorMap[jid] ?? '#9CA3AF'}"></span>
      <span class="text-xs text-gray-600 font-medium">${jobNames[jid] ?? `OF #${jid}`}</span>
    </div>`).join('');

  const imprevuItem = _hasImprevu
    ? `<div class="flex items-center gap-1.5 ml-4 shrink-0 border-l border-gray-200 pl-4">
         <span class="w-3.5 h-3.5 rounded border border-red-400 bg-red-100"></span>
         <span class="text-xs font-semibold text-red-600">⚠ Imprévus</span>
       </div>`
    : '';

  el.innerHTML = `
    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Légende :</span>
    ${items}
    ${imprevuItem}`;
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

function renderKpis(kpisData, runId) {
  const el = document.getElementById('gantt-kpis');
  if (!el) return;

  const data = kpisData?.kpis ?? kpisData ?? {};
  const run  = _runs.find(r => r.id === runId);

  const metrics = [
    {
      label:  'Makespan (Cmax)',
      value:  data.cmax_minutes ?? run?.cmax_minutes,
      fmt:    fmtMin,
      icon:   '⏱',
      note:   'Durée totale du planning',
      thresh: null,   // toujours neutre
    },
    {
      label:  'Flux total',
      value:  data.total_flow_time_minutes ?? run?.total_flow_time_minutes,
      fmt:    fmtMin,
      icon:   '🔄',
      note:   'Somme des temps de passage',
      thresh: null,
    },
    {
      label:  'Retard moyen',
      value:  data.average_tardiness_minutes ?? run?.average_tardiness_minutes,
      fmt:    fmtMin,
      icon:   '⚠',
      note:   'Tardiness moyenne des OFs',
      thresh: v => v === 0 ? 'green' : v < 30 ? 'orange' : 'red',
    },
    {
      label:  'OFs en retard',
      value:  data.late_jobs_count,
      fmt:    v => `${v ?? 0}`,
      icon:   '🔴',
      note:   'Nb de jobs dépassant la due date',
      thresh: v => v === 0 ? 'green' : v < 3 ? 'orange' : 'red',
    },
    {
      label:  'OFs à temps',
      value:  data.on_time_jobs_count,
      fmt:    v => `${v ?? 0}`,
      icon:   '✅',
      note:   'Respect des délais clients',
      thresh: v => v > 0 ? 'green' : 'orange',
    },
  ].filter(m => m.value != null);

  if (metrics.length === 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');

  const colorCls = {
    green:  { badge: 'bg-green-50 text-green-700 border-green-100',   val: 'text-[#1D9E75]' },
    orange: { badge: 'bg-orange-50 text-orange-700 border-orange-100', val: 'text-orange-600' },
    red:    { badge: 'bg-red-50 text-red-700 border-red-100',          val: 'text-red-600' },
    neutral:{ badge: 'bg-blue-50 text-blue-700 border-blue-100',       val: 'text-[#378ADD]' },
  };

  el.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 class="font-semibold text-gray-800 mb-4">
        Métriques de performance
        <span class="text-xs font-normal text-gray-400 ml-2">— Run #${runId}</span>
      </h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        ${metrics.map(m => {
          const level = m.thresh ? m.thresh(m.value) : 'neutral';
          const cls   = colorCls[level] || colorCls.neutral;
          return `
            <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:shadow-sm transition-all">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xl">${m.icon}</span>
                <span class="text-xs px-2 py-0.5 rounded-full border font-semibold ${cls.badge}">
                  ${level === 'green' ? '✓' : level === 'red' ? '!' : '~'}
                </span>
              </div>
              <p class="text-2xl font-extrabold ${cls.val} tabular-nums">${m.fmt(m.value)}</p>
              <p class="text-xs font-semibold text-gray-700 mt-1">${m.label}</p>
              <p class="text-xs text-gray-400 mt-0.5">${m.note}</p>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── Bannière imprévus ───────────────────────────────────────────────────────

function renderImprevu(imprevus) {
  const el = document.getElementById('imprevu-banner');
  if (!el) return;

  if (!_hasImprevu) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');

  el.innerHTML = `
    <div class="bg-red-50 border border-red-200 rounded-2xl p-5">
      <div class="flex items-start gap-3">
        <span class="text-2xl mt-0.5">⚠️</span>
        <div class="flex-1">
          <h4 class="font-semibold text-red-800 mb-1">
            ${imprevus.length} imprévus détectés sur ce planning
          </h4>
          <p class="text-sm text-red-600 mb-3">
            Des zones hachurées rouges sont visibles sur le Gantt.
            Il est recommandé de relancer un ordonnancement.
          </p>
          <div class="flex flex-wrap gap-2">
            ${imprevus.slice(0, 4).map(iv => `
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs
                           font-semibold bg-red-100 text-red-700 border border-red-200">
                🔴 ${iv.machine?.name ?? iv.machine_name ?? 'Machine'} 
                   · ${fmtMin(iv.estimated_duration ?? 0)}
              </span>`).join('')}
            ${imprevus.length > 4
              ? `<span class="text-xs font-medium text-red-500 self-center">+${imprevus.length - 4} autres…</span>`
              : ''}
          </div>
        </div>
        <button onclick="window.location.hash='#/scheduling'"
                class="shrink-0 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold
                       hover:bg-red-700 transition-all">
          🔄 Replanifier
        </button>
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
