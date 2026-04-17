/**
 * validators.js — Validation des formulaires avec les vrais champs Django
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

export function required(value, label = 'Ce champ') {
  const v = value === null || value === undefined ? '' : String(value).trim();
  return v === '' ? `${label} est obligatoire.` : null;
}

export function minLength(value, min, label = 'Ce champ') {
  if (value && String(value).length < min)
    return `${label} doit contenir au moins ${min} caractères.`;
  return null;
}

export function maxLength(value, max, label = 'Ce champ') {
  if (value && String(value).length > max)
    return `${label} ne doit pas dépasser ${max} caractères.`;
  return null;
}

export function isPositiveInt(value, label = 'Ce champ') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1)
    return `${label} doit être un entier positif.`;
  return null;
}

export function isPositiveOrZeroInt(value, label = 'Ce champ') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0)
    return `${label} doit être un entier ≥ 0.`;
  return null;
}

export function inRange(value, min, max, label = 'Ce champ') {
  const n = Number(value);
  if (isNaN(n) || n < min || n > max)
    return `${label} doit être entre ${min} et ${max}.`;
  return null;
}

/**
 * Valide un objet de données selon un schéma.
 * @param {object} data
 * @param {object} rules  { fieldName: [(value) => string|null] }
 * @returns {{ valid: boolean, errors: object }}
 */
export function validate(data, rules) {
  const errors = {};
  let valid = true;
  for (const [field, fieldRules] of Object.entries(rules)) {
    for (const rule of fieldRules) {
      const err = rule(data[field]);
      if (err) { errors[field] = err; valid = false; break; }
    }
  }
  return { valid, errors };
}

// ─── Schémas alignés sur les modèles Django ───────────────────────────────────

/**
 * Machine
 * Fields: code, name, machine_type, workstation_number, capacity_per_day, is_active
 */
export const machineSchema = {
  code:               [(v) => required(v, 'Le code')],
  name:               [(v) => required(v, 'Le nom')],
  machine_type:       [(v) => required(v, 'Le type')],
  workstation_number: [(v) => required(v, 'Le numéro de poste'), (v) => isPositiveInt(v, 'Le numéro de poste')],
  capacity_per_day:   [(v) => required(v, 'La capacité'), (v) => isPositiveInt(v, 'La capacité')],
};

/**
 * Job
 * Fields: code, name, quantity, priority (1–5), release_date, due_date, status, is_active
 */
export const jobSchema = {
  code:     [(v) => required(v, 'Le code')],
  name:     [(v) => required(v, 'Le nom')],
  quantity: [(v) => isPositiveInt(v, 'La quantité')],
  priority: [(v) => required(v, 'La priorité'), (v) => inRange(v, 1, 5, 'La priorité')],
};

/**
 * Operation
 * Fields: job, machine, sequence_order, processing_time_minutes,
 *         setup_time_minutes, transfer_time_minutes, notes
 */
export const operationSchema = {
  job:                     [(v) => required(v, 'Le job')],
  machine:                 [(v) => required(v, 'La machine')],
  sequence_order:          [(v) => required(v, 'L\'ordre'), (v) => isPositiveInt(v, 'L\'ordre')],
  processing_time_minutes: [(v) => required(v, 'Le temps opératoire'), (v) => isPositiveInt(v, 'Le temps opératoire')],
  setup_time_minutes:      [(v) => isPositiveOrZeroInt(v, 'Le temps de réglage')],
  transfer_time_minutes:   [(v) => isPositiveOrZeroInt(v, 'Le temps de transfert')],
};

/**
 * Schedule Run (création)
 * Fields: name, algorithm, objective, job_ids (optionnel), notes
 */
export const scheduleRunSchema = {
  name:      [(v) => required(v, 'Le nom du run')],
  algorithm: [(v) => required(v, 'L\'algorithme')],
  objective: [(v) => required(v, 'L\'objectif')],
};
