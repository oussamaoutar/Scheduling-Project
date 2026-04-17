/**
 * atelier-config.js -- Configuration extensible des types d'atelier
 *
 * POUR AJOUTER UN NOUVEAU TYPE D'ATELIER :
 *   1. Ajouter une entree dans ATELIER_TYPES ci-dessous.
 *   2. Aucune autre modification nécessaire dans le reste du frontend.
 *      La detection, les badges, et les contraintes seront mis a jour automatiquement.
 *
 * Exemple :
 *   hybrid_shop: {
 *     label:       'Hybrid Shop',
 *     color:       '#8B5CF6',
 *     bg:          '#F5F3FF',
 *     description: 'Melange job shop et flow shop',
 *     constraints: { requires_routing: true, min_machines: 2, max_jobs_per_machine: null },
 *     detect:      (jobs, ops) => ops.some(op => op.sequence_order > 0),
 *   }
 */

// ═══════════════════════════════════════════════════════════════════════════════
//  REGISTRE DES TYPES D'ATELIER
// ═══════════════════════════════════════════════════════════════════════════════

export const ATELIER_TYPES = {

  /**
   * Flow Shop : tous les jobs passent par les memes machines dans le meme ordre.
   * Exemple : ligne d'emboutissage -> soudure -> peinture -> assemblage.
   */
  flow_shop: {
    label:       'Flow Shop',
    color:       '#378ADD',
    bg:          '#EFF6FF',
    border:      '#BFDBFE',
    icon:        '→',
    description: 'Tous les OFs suivent la meme sequence de machines (ex: emboutissage -> soudure -> peinture).',
    constraints: {
      requires_same_sequence: true,
      min_machines:           2,
      algorithms_supported:   ['spt', 'lpt', 'edd', 'johnson', 'cds'],
    },
    detect: (jobs, ops) => {
      if (ops.length === 0) return false;
      // Regrouper les operations par job
      const byJob = {};
      ops.forEach(op => {
        if (!byJob[op.job]) byJob[op.job] = [];
        byJob[op.job].push(op.machine);
      });
      const sequences = Object.values(byJob);
      if (sequences.length < 2) return false;
      // Verifier si toutes les sequences ont les memes machines dans le meme ordre
      const ref = JSON.stringify(sequences[0]);
      return sequences.every(seq => JSON.stringify(seq) === ref);
    },
  },

  /**
   * Job Shop : chaque job a sa propre gamme de fabrication (ordre different).
   * Exemple : voiture A -> peinture d'abord, voiture B -> assemblage d'abord.
   */
  job_shop: {
    label:       'Job Shop',
    color:       '#1D9E75',
    bg:          '#ECFDF5',
    border:      '#A7F3D0',
    icon:        '⊕',
    description: 'Chaque OF a sa propre gamme de fabrication avec un ordre de machines specifique.',
    constraints: {
      requires_same_sequence: false,
      min_machines:           2,
      algorithms_supported:   ['spt', 'lpt', 'edd'],
    },
    detect: (jobs, ops) => {
      if (ops.length === 0) return false;
      const byJob = {};
      ops.forEach(op => {
        if (!byJob[op.job]) byJob[op.job] = [];
        byJob[op.job].push(op.machine);
      });
      const sequences = Object.values(byJob);
      if (sequences.length < 2) return false;
      const ref = JSON.stringify(sequences[0]);
      // Job shop = sequences differentes
      return sequences.some(seq => JSON.stringify(seq) !== ref);
    },
  },

  /**
   * Open Shop : les operations ne sont pas ordonnees -- les machines peuvent etre
   *             visitees dans n'importe quel ordre.
   */
  open_shop: {
    label:       'Open Shop',
    color:       '#F59E0B',
    bg:          '#FFFBEB',
    border:      '#FDE68A',
    icon:        '○',
    description: 'Les operations peuvent etre effectuees dans n\'importe quel ordre sur les machines.',
    constraints: {
      requires_same_sequence: false,
      min_machines:           1,
      algorithms_supported:   ['spt', 'lpt'],
    },
    detect: (jobs, ops) => {
      // Detecte si le champ sequence_order est absent ou toujours 0
      return ops.length > 0 && ops.every(op => !op.sequence_order || op.sequence_order === 0);
    },
  },

  /**
   * Single Machine : un seul poste de travail, sequencement pur.
   */
  single_machine: {
    label:       'Machine unique',
    color:       '#8B5CF6',
    bg:          '#F5F3FF',
    border:      '#DDD6FE',
    icon:        '⚙',
    description: 'Un seul poste de travail. Probleme de sequencement pur.',
    constraints: {
      requires_same_sequence: false,
      min_machines:           1,
      max_machines:           1,
      algorithms_supported:   ['spt', 'lpt', 'edd'],
    },
    detect: (jobs, ops) => {
      const machines = new Set(ops.map(op => op.machine));
      return machines.size === 1;
    },
  },

  /**
   * Parallel Machines : plusieurs machines identiques en parallele.
   */
  parallel_machines: {
    label:       'Machines paralleles',
    color:       '#06B6D4',
    bg:          '#ECFEFF',
    border:      '#A5F3FC',
    icon:        '⋮',
    description: 'Plusieurs machines identiques en parallele -- chaque job est assigne a une seule machine.',
    constraints: {
      requires_same_sequence: false,
      min_machines:           2,
      algorithms_supported:   ['spt', 'lpt', 'edd'],
    },
    detect: () => false, // detection manuelle recommandee
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  DETECTION AUTOMATIQUE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * detectAtelierType(jobs, operations)
 *
 * Analyse les gammes de fabrication et retourne le type d'atelier detecte.
 *
 * @param {Array} jobs       - liste des OFs (objets avec id, code, name)
 * @param {Array} operations - liste des operations (objets avec job, machine, sequence_order)
 * @returns {{ key: string, config: object }} type detecte + sa configuration
 */
export function detectAtelierType(jobs, operations) {
  if (!operations || operations.length === 0) {
    return { key: 'flow_shop', config: ATELIER_TYPES.flow_shop };
  }

  // Ordre de priorite de detection
  const detectionOrder = [
    'single_machine',
    'open_shop',
    'flow_shop',
    'job_shop',
    'parallel_machines',
  ];

  for (const key of detectionOrder) {
    const cfg = ATELIER_TYPES[key];
    if (!cfg?.detect) continue;
    try {
      if (cfg.detect(jobs, operations)) {
        return { key, config: cfg };
      }
    } catch {
      // Ignorer les erreurs de detection
    }
  }

  // Defaut : flow_shop
  return { key: 'flow_shop', config: ATELIER_TYPES.flow_shop };
}

/**
 * getAtelierConfig(key)
 * Retourne la configuration complete d'un type d'atelier.
 * @param {string} key - identifiant du type
 * @returns {object}
 */
export function getAtelierConfig(key) {
  return ATELIER_TYPES[key] ?? ATELIER_TYPES.flow_shop;
}

/**
 * getAllAtelierTypes()
 * Retourne la liste de tous les types d'atelier disponibles.
 * @returns {Array<{key: string, ...config}>}
 */
export function getAllAtelierTypes() {
  return Object.entries(ATELIER_TYPES).map(([key, config]) => ({ key, ...config }));
}

/**
 * isAlgorithmSupported(atelierKey, algorithm)
 * Verifie si un algorithme est supporte par un type d'atelier.
 * @param {string} atelierKey
 * @param {string} algorithm - 'spt' | 'lpt' | 'edd' | 'johnson' | 'cds'
 * @returns {boolean}
 */
export function isAlgorithmSupported(atelierKey, algorithm) {
  const cfg = getAtelierConfig(atelierKey);
  return cfg.constraints?.algorithms_supported?.includes(algorithm) ?? true;
}
