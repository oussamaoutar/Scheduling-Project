/**
 * demo-data.js -- Donnees de demonstration AutoMaroc Scheduling
 *
 * Activation :
 *   window.DEMO_MODE = true  (dans la console navigateur)
 *
 * Usage :
 *   import { getDemoData, isDemoMode, patchApiWithDemo } from './demo-data.js';
 *   patchApiWithDemo();  // remplace les appels API par les donnees locales
 *
 * Utile pour : demos offline, soutenance, developpement sans backend.
 */

// ─── Verification mode demo ───────────────────────────────────────────────────

export function isDemoMode() {
  return !!window.DEMO_MODE;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DONNEES MOCKEES AUTOMOBILES REALISTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Machines ─────────────────────────────────────────────────────────────────

export const DEMO_MACHINES = [
  {
    id: 1, code: 'PE-01',
    name: 'Presse emboutissage',
    machine_type: 'cutting',
    workstation_number: 1,
    capacity_per_day: 480,
    is_active: true,
    created_at: '2024-01-15T08:00:00Z',
  },
  {
    id: 2, code: 'SR-02',
    name: 'Soudeuse robotisee',
    machine_type: 'assembly',
    workstation_number: 2,
    capacity_per_day: 420,
    is_active: true,
    created_at: '2024-01-15T08:00:00Z',
  },
  {
    id: 3, code: 'CP-03',
    name: 'Cabine peinture',
    machine_type: 'painting',
    workstation_number: 3,
    capacity_per_day: 360,
    is_active: true,
    created_at: '2024-01-15T08:00:00Z',
  },
  {
    id: 4, code: 'PA-04',
    name: 'Poste assemblage',
    machine_type: 'assembly',
    workstation_number: 4,
    capacity_per_day: 480,
    is_active: true,
    created_at: '2024-01-15T08:00:00Z',
  },
  {
    id: 5, code: 'CQ-05',
    name: 'Controle qualite',
    machine_type: 'other',
    workstation_number: 5,
    capacity_per_day: 480,
    is_active: true,
    created_at: '2024-01-15T08:00:00Z',
  },
  {
    id: 6, code: 'LF-06',
    name: 'Ligne finition',
    machine_type: 'packaging',
    workstation_number: 6,
    capacity_per_day: 420,
    is_active: true,
    created_at: '2024-01-15T08:00:00Z',
  },
];

// ─── Jobs (Ordres de Fabrication) ─────────────────────────────────────────────

export const DEMO_JOBS = [
  {
    id: 1, code: 'OF-2024-001',
    name: 'Carrosserie avant',
    description: 'Emboutissage et assemblage de la carrosserie avant - Toyota Corolla',
    quantity: 50, priority: 5,
    release_date: '2024-04-01', due_date: '2024-04-08',
    status: 'in_progress', is_active: true,
    total_processing_time: 195,
    created_at: '2024-04-01T06:00:00Z',
  },
  {
    id: 2, code: 'OF-2024-002',
    name: 'Portes laterales',
    description: 'Fabrication portes avant et arriere - Serie complete 4 portes',
    quantity: 200, priority: 4,
    release_date: '2024-04-01', due_date: '2024-04-10',
    status: 'ready', is_active: true,
    total_processing_time: 175,
    created_at: '2024-04-01T06:00:00Z',
  },
  {
    id: 3, code: 'OF-2024-003',
    name: 'Capot moteur',
    description: 'Emboutissage capot + traitement surface anti-corrosion',
    quantity: 50, priority: 3,
    release_date: '2024-04-02', due_date: '2024-04-12',
    status: 'pending', is_active: true,
    total_processing_time: 150,
    created_at: '2024-04-02T06:00:00Z',
  },
  {
    id: 4, code: 'OF-2024-004',
    name: 'Tableau de bord',
    description: 'Assemblage tableau bord complet - Renault Logan Local',
    quantity: 30, priority: 2,
    release_date: '2024-04-03', due_date: '2024-04-15',
    status: 'pending', is_active: true,
    total_processing_time: 130,
    created_at: '2024-04-03T06:00:00Z',
  },
];

// ─── Operations (Gammes de fabrication) ───────────────────────────────────────

export const DEMO_OPERATIONS = [
  // OF-2024-001 : Carrosserie avant
  { id:1,  job:1, machine:1, sequence_order:1, processing_time_minutes:45, setup_time_minutes:15, transfer_time_minutes:5  },
  { id:2,  job:1, machine:2, sequence_order:2, processing_time_minutes:60, setup_time_minutes:20, transfer_time_minutes:5  },
  { id:3,  job:1, machine:3, sequence_order:3, processing_time_minutes:50, setup_time_minutes:15, transfer_time_minutes:10 },
  { id:4,  job:1, machine:4, sequence_order:4, processing_time_minutes:30, setup_time_minutes:10, transfer_time_minutes:5  },
  { id:5,  job:1, machine:5, sequence_order:5, processing_time_minutes:10, setup_time_minutes:5,  transfer_time_minutes:5  },
  // OF-2024-002 : Portes laterales
  { id:6,  job:2, machine:1, sequence_order:1, processing_time_minutes:35, setup_time_minutes:10, transfer_time_minutes:5  },
  { id:7,  job:2, machine:2, sequence_order:2, processing_time_minutes:55, setup_time_minutes:15, transfer_time_minutes:5  },
  { id:8,  job:2, machine:3, sequence_order:3, processing_time_minutes:45, setup_time_minutes:15, transfer_time_minutes:10 },
  { id:9,  job:2, machine:4, sequence_order:4, processing_time_minutes:25, setup_time_minutes:10, transfer_time_minutes:5  },
  { id:10, job:2, machine:5, sequence_order:5, processing_time_minutes:15, setup_time_minutes:5,  transfer_time_minutes:5  },
  // OF-2024-003 : Capot moteur
  { id:11, job:3, machine:1, sequence_order:1, processing_time_minutes:40, setup_time_minutes:12, transfer_time_minutes:5  },
  { id:12, job:3, machine:2, sequence_order:2, processing_time_minutes:30, setup_time_minutes:10, transfer_time_minutes:5  },
  { id:13, job:3, machine:3, sequence_order:3, processing_time_minutes:50, setup_time_minutes:15, transfer_time_minutes:10 },
  { id:14, job:3, machine:5, sequence_order:4, processing_time_minutes:20, setup_time_minutes:5,  transfer_time_minutes:5  },
  // OF-2024-004 : Tableau de bord
  { id:15, job:4, machine:4, sequence_order:1, processing_time_minutes:55, setup_time_minutes:20, transfer_time_minutes:5  },
  { id:16, job:4, machine:5, sequence_order:2, processing_time_minutes:30, setup_time_minutes:10, transfer_time_minutes:5  },
  { id:17, job:4, machine:6, sequence_order:3, processing_time_minutes:25, setup_time_minutes:10, transfer_time_minutes:5  },
];

// ─── Runs de scheduling ───────────────────────────────────────────────────────

export const DEMO_RUNS = [
  {
    id: 1,
    name: 'Run SPT - April 2024',
    description: 'Ordonnancement SPT sur tous les OFs actifs',
    algorithm: 'spt',
    job_ids: [1, 2, 3, 4],
    status: 'completed',
    created_at: '2024-04-05T14:30:00Z',
    executed_at: '2024-04-05T14:31:02Z',
    result: {
      cmax_minutes: 285,
      total_flow_time_minutes: 920,
      average_tardiness_minutes: 12,
    },
  },
  {
    id: 2,
    name: 'Run EDD - April 2024',
    description: 'Priorite aux dates livraison les plus proches',
    algorithm: 'edd',
    job_ids: [1, 2, 3, 4],
    status: 'completed',
    created_at: '2024-04-05T15:00:00Z',
    executed_at: '2024-04-05T15:01:18Z',
    result: {
      cmax_minutes: 310,
      total_flow_time_minutes: 870,
      average_tardiness_minutes: 5,
    },
  },
];

// ─── Donnees Gantt (pour run SPT) ────────────────────────────────────────────

export const DEMO_GANTT = {
  run_id: 1,
  algorithm: 'spt',
  timeline: { start: 0, end: 285, unit: 'minutes' },
  machines: [
    {
      id: 1, name: 'Presse emboutissage (PE-01)',
      tasks: [
        { job_id:3, label:'OF-2024-003 Op1', start_time:0,   end_time:40,  duration:40, operation_order:1 },
        { job_id:2, label:'OF-2024-002 Op1', start_time:40,  end_time:75,  duration:35, operation_order:1 },
        { job_id:1, label:'OF-2024-001 Op1', start_time:75,  end_time:120, duration:45, operation_order:1 },
      ],
    },
    {
      id: 2, name: 'Soudeuse robotisee (SR-02)',
      tasks: [
        { job_id:3, label:'OF-2024-003 Op2', start_time:40,  end_time:70,  duration:30, operation_order:2 },
        { job_id:2, label:'OF-2024-002 Op2', start_time:75,  end_time:130, duration:55, operation_order:2 },
        { job_id:1, label:'OF-2024-001 Op2', start_time:130, end_time:190, duration:60, operation_order:2 },
      ],
    },
    {
      id: 3, name: 'Cabine peinture (CP-03)',
      tasks: [
        { job_id:3, label:'OF-2024-003 Op3', start_time:70,  end_time:120, duration:50, operation_order:3 },
        { job_id:2, label:'OF-2024-002 Op3', start_time:130, end_time:175, duration:45, operation_order:3 },
        { job_id:1, label:'OF-2024-001 Op3', start_time:190, end_time:240, duration:50, operation_order:3 },
      ],
    },
    {
      id: 4, name: 'Poste assemblage (PA-04)',
      tasks: [
        { job_id:4, label:'OF-2024-004 Op1', start_time:0,   end_time:55,  duration:55, operation_order:1 },
        { job_id:2, label:'OF-2024-002 Op4', start_time:175, end_time:200, duration:25, operation_order:4 },
        { job_id:1, label:'OF-2024-001 Op4', start_time:240, end_time:270, duration:30, operation_order:4 },
      ],
    },
    {
      id: 5, name: 'Controle qualite (CQ-05)',
      tasks: [
        { job_id:4, label:'OF-2024-004 Op2', start_time:55,  end_time:85,  duration:30, operation_order:2 },
        { job_id:3, label:'OF-2024-003 Op4', start_time:120, end_time:140, duration:20, operation_order:4 },
        { job_id:2, label:'OF-2024-002 Op5', start_time:200, end_time:215, duration:15, operation_order:5 },
        { job_id:1, label:'OF-2024-001 Op5', start_time:270, end_time:280, duration:10, operation_order:5 },
      ],
    },
    {
      id: 6, name: 'Ligne finition (LF-06)',
      tasks: [
        { job_id:4, label:'OF-2024-004 Op3', start_time:85,  end_time:110, duration:25, operation_order:3 },
      ],
    },
  ],
  imprevus: [
    { machine_id: 2, start_time: 100, duration: 15, type: 'breakdown', description: 'Panne soudeuse - maintenance curative' },
  ],
  jobs: DEMO_JOBS.map(j => ({ ...j })),
};

// ─── Imprevus ─────────────────────────────────────────────────────────────────

export const DEMO_IMPREVUS = [
  {
    id: 1,
    type: 'breakdown',
    machine: { id:2, code:'SR-02', name:'Soudeuse robotisee' },
    description: 'Defaillance du bras robotise - remplacement servomoteur J3',
    estimated_duration: 120,
    reported_at: '2024-04-05T10:30:00Z',
    is_active: false,
    status: 'resolved',
    impact_level: 'high',
  },
  {
    id: 2,
    type: 'material_shortage',
    machine: { id:3, code:'CP-03', name:'Cabine peinture' },
    description: 'Rupture de stock peinture epoxy blanc Arctic - commande urgente passee',
    estimated_duration: 180,
    reported_at: '2024-04-06T08:00:00Z',
    is_active: true,
    status: 'active',
    impact_level: 'high',
  },
  {
    id: 3,
    type: 'maintenance',
    machine: { id:1, code:'PE-01', name:'Presse emboutissage' },
    description: 'Maintenance preventive trimestrielle - verification hydraulique et outillage',
    estimated_duration: 240,
    reported_at: '2024-04-07T06:00:00Z',
    is_active: false,
    status: 'resolved',
    impact_level: 'low',
  },
];

// ─── Dashboard summary ────────────────────────────────────────────────────────

export const DEMO_DASHBOARD = {
  active_machines:     6,
  total_machines:      6,
  active_jobs:         4,
  total_jobs:          4,
  total_operations:    17,
  scheduling_runs:     2,
  completed_runs:      2,
  active_imprevus:     1,
  job_status_counts: {
    pending:    2,
    ready:      1,
    in_progress:1,
    completed:  0,
    cancelled:  0,
  },
  recent_runs: DEMO_RUNS,
  top_machines: DEMO_MACHINES.slice(0, 5).map(m => ({
    ...m, usage_rate: 0.85,
  })),
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH API -- intercepte les reponses pour injecter les donnees demo
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * patchApiWithDemo()
 * Intercepte window.fetch et retourne les donnees demo pour les endpoints connus.
 * A appeler apres window.DEMO_MODE = true.
 */
export function patchApiWithDemo() {
  if (!isDemoMode()) return;

  const _realFetch = window.fetch.bind(window);

  window.fetch = async function(input, init) {
    const url = String(typeof input === 'string' ? input : input?.url ?? '');

    // Toujours laisser passer les requetes non-API
    if (!url.includes('/api/')) return _realFetch(input, init);

    console.info('[DEMO_MODE] Intercepted:', url);

    // Simulation delai reseau 80-200 ms
    await new Promise(r => setTimeout(r, 80 + Math.random() * 120));

    let body = null;

    if (url.includes('/api/machines/'))              body = paginate(DEMO_MACHINES);
    else if (url.includes('/api/jobs/operations/'))  body = paginate(DEMO_OPERATIONS);
    else if (url.includes('/api/jobs/'))             body = paginate(DEMO_JOBS);
    else if (url.includes('/api/scheduling/runs/') && url.includes('/gantt/'))
                                                      body = DEMO_GANTT;
    else if (url.includes('/api/scheduling/runs/'))  body = paginate(DEMO_RUNS);
    else if (url.includes('/api/scheduling/imprevus/')) body = paginate(DEMO_IMPREVUS);
    else if (url.includes('/api/scheduling/dashboard/')) body = DEMO_DASHBOARD;
    else {
      // Endpoint inconnu en mode demo -> retourne liste vide
      body = paginate([]);
    }

    return new Response(JSON.stringify(body), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  console.info(
    '%c[DEMO_MODE] Actif — donnees simulees automobiles injectees.',
    'color:#1D9E75;font-weight:bold;font-size:13px'
  );
  console.info(
    '%cDesactivation : window.DEMO_MODE = false; location.reload();',
    'color:#6B7280;font-size:12px'
  );
}

// ─── Helper pagination ────────────────────────────────────────────────────────

function paginate(results) {
  return {
    count:    results.length,
    next:     null,
    previous: null,
    results,
  };
}

// ─── Accesseur global ─────────────────────────────────────────────────────────

export function getDemoData() {
  return {
    machines:   DEMO_MACHINES,
    jobs:       DEMO_JOBS,
    operations: DEMO_OPERATIONS,
    runs:       DEMO_RUNS,
    gantt:      DEMO_GANTT,
    imprevus:   DEMO_IMPREVUS,
    dashboard:  DEMO_DASHBOARD,
  };
}
