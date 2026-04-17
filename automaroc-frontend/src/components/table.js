/**
 * table.js — Composant tableau générique
 *
 * Usage :
 *   import { createTable, renderTable } from './table.js';
 *
 *   // Option A : crée l'élément et tu l'insères toi-même
 *   const tableEl = createTable({ columns, data, onRowClick, actions });
 *   container.appendChild(tableEl);
 *
 *   // Option B : shorthand — nettoie le container et insère
 *   renderTable(container, { columns, data, onRowClick, actions });
 *
 * Config :
 *   columns  : [{ key, label, render?, sortable?, width? }]
 *   data     : [] (tableau d'objets)
 *   actions  : (row) => html string | null
 *   onRowClick: (row) => void | null
 *   loading  : bool
 *   emptyMessage   : string (override texte vide)
 *   emptyIcon      : svg string (override icône vide)
 *   rowClass       : (row) => string
 *   id             : string (ID unique pour le tri d'état)
 */

// ─── Injection de styles une seule fois ───────────────────────────────────────

const STYLES = `
  .am-table-wrap {
    width: 100%;
    overflow-x: auto;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #fff;
  }
  .am-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .am-table thead tr {
    background: #F9FAFB;
    border-bottom: 1px solid #e5e7eb;
  }
  .am-table th {
    padding: 10px 14px;
    text-align: left;
    font-size: 11.5px;
    font-weight: 600;
    color: #6B7280;
    letter-spacing: .4px;
    text-transform: uppercase;
    white-space: nowrap;
    user-select: none;
  }
  .am-table th.sortable { cursor: pointer; }
  .am-table th.sortable:hover { color: #378ADD; }
  .am-table th .sort-icon {
    display: inline-flex; align-items: center;
    margin-left: 4px; opacity: .35; transition: opacity .15s;
    vertical-align: middle;
  }
  .am-table th.sorted .sort-icon { opacity: 1; color: #378ADD; }

  .am-table td {
    padding: 11px 14px;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
  }
  .am-table tbody tr:last-child td { border-bottom: none; }
  .am-table tbody tr {
    transition: background .12s;
  }
  .am-table tbody tr.clickable { cursor: pointer; }
  .am-table tbody tr:hover { background: #F9FAFB; }

  /* Action buttons */
  .am-table .action-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 30px;
    border: none; background: transparent; cursor: pointer;
    border-radius: 8px; color: #9ca3af;
    transition: color .15s, background .15s;
  }
  .am-table .action-btn:hover.edit   { color: #378ADD; background: #EFF6FF; }
  .am-table .action-btn:hover.delete { color: #E24B4A; background: #FEF2F2; }
  .am-table .action-btn:hover.view   { color: #1D9E75; background: #ECFDF5; }
  .am-table .action-btn svg { width: 15px; height: 15px; pointer-events: none; }

  /* Empty state */
  .am-table-empty {
    padding: 52px 24px;
    text-align: center;
    color: #9ca3af;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .am-table-empty svg { margin: 0 auto 12px; opacity: .45; }
  .am-table-empty p  { font-size: 14px; font-weight: 500; margin: 0 0 4px; color: #6b7280; }
  .am-table-empty small { font-size: 12px; color: #9ca3af; }

  /* Skeleton */
  .am-skeleton-row td { padding: 12px 14px; }
  .am-skeleton-cell {
    height: 16px; border-radius: 6px;
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

function injectStyles() {
  if (document.getElementById('am-table-styles')) return;
  const s = document.createElement('style');
  s.id = 'am-table-styles';
  s.textContent = STYLES;
  document.head.appendChild(s);
}

// ─── État de tri global (par id de table) ────────────────────────────────────

const _sortState = {};   // { [tableId]: { key, dir: 'asc'|'desc' } }

// ─── API principale ───────────────────────────────────────────────────────────

/**
 * createTable(config) → HTMLElement (wrapper div)
 */
export function createTable(config) {
  injectStyles();

  const {
    id           = 'table-' + Math.random().toString(36).slice(2),
    columns      = [],
    data         = [],
    actions      = null,
    onRowClick   = null,
    loading      = false,
    emptyMessage = 'Aucun résultat',
    emptyIcon    = null,
    rowClass     = null,
  } = config;

  const wrap = document.createElement('div');
  wrap.className = 'am-table-wrap';

  const table = document.createElement('table');
  table.className = 'am-table';
  table.id = id;

  // ── THEAD ──────────────────────────────────────────────────────────────────
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  columns.forEach((col) => {
    const th = document.createElement('th');
    if (col.width) th.style.width = col.width;

    const sortState = _sortState[id];
    const isSorted  = sortState?.key === col.key;
    const sortDir   = isSorted ? sortState.dir : 'asc';

    if (col.sortable) {
      th.classList.add('sortable');
      if (isSorted) th.classList.add('sorted');

      const arrow = isSorted
        ? (sortDir === 'asc' ? '↑' : '↓')
        : '↕';

      th.innerHTML = `${col.label}<span class="sort-icon">${arrow}</span>`;
      th.addEventListener('click', () => {
        const prev = _sortState[id];
        const dir  = prev?.key === col.key && prev.dir === 'asc' ? 'desc' : 'asc';
        _sortState[id] = { key: col.key, dir };
        // Re-render le contenu trié
        const sorted = sortData([...data], col.key, dir);
        const newBody = buildTbody(sorted, columns, actions, onRowClick, rowClass);
        table.querySelector('tbody').replaceWith(newBody);
        // Met à jour les headers
        table.querySelectorAll('th.sortable').forEach((t) => t.classList.remove('sorted'));
        th.classList.add('sorted');
        th.querySelector('.sort-icon').textContent = dir === 'asc' ? '↑' : '↓';
      });
    } else {
      th.textContent = col.label;
    }

    headRow.appendChild(th);
  });

  // Colonne actions si fournie
  if (actions) {
    const thAct = document.createElement('th');
    thAct.style.width = '80px';
    thAct.style.textAlign = 'right';
    thAct.textContent = 'Actions';
    headRow.appendChild(thAct);
  }

  thead.appendChild(headRow);
  table.appendChild(thead);

  // ── TBODY ──────────────────────────────────────────────────────────────────
  if (loading) {
    table.appendChild(buildSkeleton(columns, actions));
  } else if (!data || data.length === 0) {
    table.appendChild(buildEmpty(columns, actions, emptyMessage, emptyIcon));
  } else {
    table.appendChild(buildTbody(data, columns, actions, onRowClick, rowClass));
  }

  wrap.appendChild(table);
  return wrap;
}

/**
 * renderTable(container, config)
 * Raccourci : vide le container et insère le tableau.
 */
export function renderTable(container, config) {
  if (!container) return;
  container.innerHTML = '';
  container.appendChild(createTable(config));
}

// ─── Builders internes ────────────────────────────────────────────────────────

function buildTbody(data, columns, actions, onRowClick, rowClass) {
  const tbody = document.createElement('tbody');

  data.forEach((row) => {
    const tr = document.createElement('tr');
    if (onRowClick) tr.classList.add('clickable');
    if (rowClass) {
      const extra = rowClass(row);
      if (extra) tr.classList.add(...extra.split(' '));
    }

    // Cellules de données
    columns.forEach((col) => {
      const td = document.createElement('td');
      const raw = col.key.split('.').reduce((o, k) => o?.[k], row);
      td.innerHTML = col.render ? col.render(raw, row) : (raw ?? '—');
      tr.appendChild(td);
    });

    // Cellule actions
    if (actions) {
      const tdAct = document.createElement('td');
      tdAct.style.textAlign = 'right';
      tdAct.style.whiteSpace = 'nowrap';
      tdAct.innerHTML = actions(row);
      tr.appendChild(tdAct);
    }

    // Clic sur ligne (mais pas sur les boutons d'action)
    if (onRowClick) {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.action-btn')) return;
        onRowClick(row);
      });
    }

    tbody.appendChild(tr);
  });

  return tbody;
}

function buildEmpty(columns, actions, message, customIcon) {
  const colspan = columns.length + (actions ? 1 : 0);
  const tbody   = document.createElement('tbody');
  const tr      = document.createElement('tr');
  const td      = document.createElement('td');
  td.colSpan    = colspan;

  const icon = customIcon || `
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.2">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M3 9h18M9 21V9"/>
    </svg>`;

  td.innerHTML = `
    <div class="am-table-empty">
      ${icon}
      <p>${message}</p>
      <small>Aucune donnée à afficher pour le moment</small>
    </div>`;

  tr.appendChild(td);
  tbody.appendChild(tr);
  return tbody;
}

function buildSkeleton(columns, actions, rows = 5) {
  const colspan = columns.length + (actions ? 1 : 0);
  const tbody   = document.createElement('tbody');

  for (let i = 0; i < rows; i++) {
    const tr = document.createElement('tr');
    tr.className = 'am-skeleton-row';

    for (let j = 0; j < colspan; j++) {
      const td  = document.createElement('td');
      const w   = j === colspan - 1 && actions ? '60px' : `${60 + Math.random() * 30}%`;
      td.innerHTML = `<div class="am-skeleton-cell" style="width:${w}"></div>`;
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  return tbody;
}

// ─── Utilitaire de tri ────────────────────────────────────────────────────────

function sortData(data, key, dir) {
  return data.sort((a, b) => {
    const va = key.split('.').reduce((o, k) => o?.[k], a) ?? '';
    const vb = key.split('.').reduce((o, k) => o?.[k], b) ?? '';

    if (va === vb) return 0;

    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), 'fr');

    return dir === 'asc' ? cmp : -cmp;
  });
}

// ─── Boutons action helpers (utilisables dans config.actions) ──────────────────

/**
 * actionBtn(type, title, onclick)
 * type: 'edit' | 'delete' | 'view'
 * Retourne une string HTML de bouton icon-only.
 */
export function actionBtn(type, title = '', onclick = '') {
  const icons = {
    edit:   `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
    delete: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
    view:   `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`,
  };

  return `
    <button class="action-btn ${type}" title="${title}"
            onclick="${onclick}" type="button">
      ${icons[type] || ''}
    </button>`;
}
