/**
 * gantt-chart.js — Composant diagramme de Gantt Canvas HTML5
 *
 * Usage :
 *   import { GanttChart } from './gantt-chart.js';
 *   const chart = new GanttChart('my-canvas-id');
 *   chart.render(ganttData);  // ganttData = réponse API /runs/{id}/gantt/
 */

// ─── Palette de couleurs pour les OFs ────────────────────────────────────────

const JOB_COLORS = [
  '#378ADD', '#1D9E75', '#8B5CF6', '#F59E0B', '#EF4444',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#EAB308', '#0EA5E9', '#22C55E',
];

// ─── Dimensions & style ───────────────────────────────────────────────────────

const AXIS_LEFT   = 150;   // largeur colonne noms machines
const AXIS_BOTTOM = 36;    // hauteur axe temps
const ROW_H       = 52;    // hauteur d'une ligne machine
const HEADER_H    = 28;    // hauteur en-tête
const PADDING     = 12;    // padding interne des barres
const FONT        = '12px Inter, system-ui, sans-serif';
const FONT_SMALL  = '11px Inter, system-ui, sans-serif';
const FONT_BOLD   = 'bold 12px Inter, system-ui, sans-serif';

// ─── Classe GanttChart ────────────────────────────────────────────────────────

export class GanttChart {
  /**
   * @param {string} canvasId  — id du <canvas>
   */
  constructor(canvasId) {
    this._canvasId  = canvasId;
    this._canvas    = null;
    this._ctx       = null;
    this._data      = null;       // dernière ganttData rendue
    this._jobColors = {};
    this._tasks     = [];         // liste plate pour les tooltips
    this._imprevus  = [];         // { machineIndex, startTime, duration }
    this._tooltip   = null;       // { x, y, task } | null
    this._scale     = 1;          // px par minute
    this._hoverTask = null;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
  }

  // ─── Rendu principal ─────────────────────────────────────────────────────────

  render(ganttData) {
    this._data     = ganttData;
    this._tasks    = [];
    this._imprevus = [];
    this._jobColors = {};

    const canvas = document.getElementById(this._canvasId);
    if (!canvas) { console.warn('[GanttChart] canvas not found:', this._canvasId); return; }
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');

    // Palette couleurs par job_id
    const jobIds = [...new Set(
      (ganttData.machines ?? []).flatMap(m => (m.tasks ?? []).map(t => t.job_id))
    )];
    jobIds.forEach((id, i) => {
      this._jobColors[id] = JOB_COLORS[i % JOB_COLORS.length];
    });

    const machines       = ganttData.machines ?? [];
    const totalDuration  = ganttData.timeline?.end ?? this._computeEnd(machines);
    const numMachines    = machines.length;

    // Dimensions canvas
    const containerW = canvas.parentElement?.clientWidth || 900;
    const rawW       = Math.max(containerW, 600);
    const rawH       = HEADER_H + numMachines * ROW_H + AXIS_BOTTOM + 8;

    // DPI-aware (Retina)
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = rawW * dpr;
    canvas.height = rawH * dpr;
    canvas.style.width  = rawW + 'px';
    canvas.style.height = rawH + 'px';
    this._ctx.scale(dpr, dpr);

    this._rawW         = rawW;
    this._rawH         = rawH;
    this._numMachines  = numMachines;
    this._totalDur     = totalDuration;
    this._scale        = (rawW - AXIS_LEFT - 20) / Math.max(totalDuration, 1);

    const ctx = this._ctx;
    ctx.clearRect(0, 0, rawW, rawH);

    // Fond
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, rawW, rawH);

    this.drawGrid(totalDuration, machines);
    this.drawAxes(machines, totalDuration);

    // Barres + imprévus
    machines.forEach((m, mi) => {
      (m.tasks ?? []).forEach(task => {
        this.drawTask(mi, task, this._scale, this._jobColors[task.job_id] ?? '#9CA3AF');
        this._tasks.push({ ...task, machineIndex: mi, machineName: m.name });
      });
      // Imprévus de cette machine si injectés
      this._imprevus
        .filter(iv => iv.machineIndex === mi)
        .forEach(iv => this.drawImprevu(mi, iv.startTime, iv.duration));
    });

    // Events hover (remove old first)
    canvas.removeEventListener('mousemove',  this._onMouseMove);
    canvas.removeEventListener('mouseleave', this._onMouseLeave);
    canvas.addEventListener('mousemove',     this._onMouseMove);
    canvas.addEventListener('mouseleave',    this._onMouseLeave);
  }

  // ─── Grille ──────────────────────────────────────────────────────────────────

  drawGrid(totalDuration, machines) {
    const ctx = this._ctx;
    const h   = HEADER_H + (machines?.length ?? this._numMachines) * ROW_H;

    // Lignes horizontales (séparation entre machines)
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= (machines?.length ?? this._numMachines); i++) {
      const y = HEADER_H + i * ROW_H;
      ctx.beginPath();
      ctx.moveTo(AXIS_LEFT, y);
      ctx.lineTo(this._rawW - 8, y);
      ctx.stroke();
    }

    // Colonnes verticales toutes les 10 min
    const step = this._chooseStep(totalDuration);
    ctx.strokeStyle = '#F3F4F6';
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);

    for (let t = 0; t <= totalDuration; t += step) {
      const x = AXIS_LEFT + t * this._scale;
      ctx.beginPath();
      ctx.moveTo(x, HEADER_H);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Zone de fond alternée par machine
    (machines ?? []).forEach((_, i) => {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.015)';
        ctx.fillRect(AXIS_LEFT, HEADER_H + i * ROW_H, this._rawW - AXIS_LEFT - 8, ROW_H);
      }
    });
  }

  // ─── Axes ────────────────────────────────────────────────────────────────────

  drawAxes(machines, totalDuration) {
    const ctx  = this._ctx;
    const step = this._chooseStep(totalDuration);

    // ── Fond colonne noms ────────────────────────────────────────────────────
    ctx.fillStyle = '#F9FAFB';
    ctx.fillRect(0, 0, AXIS_LEFT, this._rawH);

    // Bordure droite
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(AXIS_LEFT, 0);
    ctx.lineTo(AXIS_LEFT, this._rawH);
    ctx.stroke();

    // ── Noms des machines ─────────────────────────────────────────────────────
    ctx.font      = FONT_BOLD;
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'right';
    (machines ?? []).forEach((m, i) => {
      const y   = HEADER_H + i * ROW_H + ROW_H / 2;
      const lbl = m.name?.length > 18 ? m.name.slice(0, 16) + '…' : (m.name ?? '—');
      ctx.fillText(lbl, AXIS_LEFT - 10, y + 5);
    });

    // ── En-tête "Machine" ─────────────────────────────────────────────────────
    ctx.font      = FONT_SMALL;
    ctx.fillStyle = '#9CA3AF';
    ctx.textAlign = 'right';
    ctx.fillText('Machine', AXIS_LEFT - 10, HEADER_H - 8);

    // ── Axe temps (bas) ───────────────────────────────────────────────────────
    const yBase = HEADER_H + (machines?.length ?? this._numMachines) * ROW_H;

    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(AXIS_LEFT, yBase);
    ctx.lineTo(this._rawW - 8, yBase);
    ctx.stroke();

    ctx.font      = FONT_SMALL;
    ctx.fillStyle = '#6B7280';
    ctx.textAlign = 'center';

    for (let t = 0; t <= totalDuration; t += step) {
      const x = AXIS_LEFT + t * this._scale;
      // tick
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(x, yBase);
      ctx.lineTo(x, yBase + 5);
      ctx.stroke();
      // label
      ctx.fillText(this._fmtMin(t), x, yBase + 20);
    }

    // Label axe "Temps (min)"
    ctx.fillStyle = '#9CA3AF';
    ctx.textAlign = 'left';
    ctx.font      = FONT_SMALL;
    ctx.fillText('Temps (min)', AXIS_LEFT + 4, yBase + 32);
  }

  // ─── Barre tâche ─────────────────────────────────────────────────────────────

  drawTask(machineIndex, task, scale, color) {
    const ctx = this._ctx;
    const x   = AXIS_LEFT + task.start_time * scale;
    const y   = HEADER_H + machineIndex * ROW_H + PADDING / 2;
    const w   = Math.max(task.duration * scale - 2, 4);
    const h   = ROW_H - PADDING;
    const r   = 6;

    // Ombre légère
    ctx.shadowColor   = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur    = 4;
    ctx.shadowOffsetY = 2;

    // Rectangle arrondi
    ctx.fillStyle = color;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    // Reflet haut
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    // Bordure
    ctx.strokeStyle = this._darken(color, 20);
    ctx.lineWidth   = 1;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.stroke();

    // Label (si assez large)
    if (w > 30) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font      = w > 60 ? FONT_BOLD : FONT_SMALL;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur  = 2;
      const lbl = task.label ?? `T${task.operation_order}`;
      const maxChars = Math.floor(w / 7);
      const display  = lbl.length > maxChars ? lbl.slice(0, maxChars - 1) + '…' : lbl;
      ctx.fillText(display, x + w / 2, y + h / 2 + 4);
      ctx.shadowBlur = 0;
    }
  }

  // ─── Zone imprévus hachurée ───────────────────────────────────────────────────

  drawImprevu(machineIndex, startTime, duration) {
    const ctx = this._ctx;
    const x   = AXIS_LEFT + startTime * this._scale;
    const y   = HEADER_H + machineIndex * ROW_H + 2;
    const w   = Math.max(duration * this._scale - 2, 6);
    const h   = ROW_H - 4;

    // Fond rouge transparent
    ctx.fillStyle = 'rgba(239,68,68,0.15)';
    ctx.fillRect(x, y, w, h);

    // Motif hachures diagonales
    ctx.strokeStyle = 'rgba(239,68,68,0.5)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 4]);
    const spacing = 8;
    for (let d = -h; d < w + h; d += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d + h, y + h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Bordure rouge
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Icône ⚠ si assez large
    if (w > 20) {
      ctx.fillStyle = '#EF4444';
      ctx.font      = '12px serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠', x + w / 2, y + h / 2 + 4);
    }
  }

  /**
   * Injecte des imprévus sur la timeline avant re-render.
   * @param {Array<{machineIndex, startTime, duration}>} imprevus
   */
  addImprevus(imprevus) {
    this._imprevus = imprevus;
    if (this._data) this.render(this._data);   // re-render avec zones hachurées
  }

  // ─── Tooltip ─────────────────────────────────────────────────────────────────

  showTooltip(task, x, y) {
    this._removeTooltip();

    const el = document.createElement('div');
    el.id = 'gantt-tooltip';
    el.style.cssText = `
      position:fixed; z-index:9999; pointer-events:none;
      background:#1F2937; color:#fff; border-radius:10px;
      padding:10px 14px; font-family:Inter,system-ui,sans-serif;
      font-size:12px; line-height:1.6; white-space:nowrap;
      box-shadow:0 8px 24px rgba(0,0,0,0.25);
    `;

    const dur  = task.duration ?? (task.end_time - task.start_time);
    el.innerHTML = `
      <div style="font-weight:700;font-size:13px;margin-bottom:4px">${task.label ?? '—'}</div>
      <div>🕐 <b>Début :</b> ${this._fmtMin(task.start_time)}</div>
      <div>🕑 <b>Fin :</b>   ${this._fmtMin(task.end_time)}</div>
      <div>⏱ <b>Durée :</b>  ${this._fmtMinFull(dur)}</div>
      ${task.machineName ? `<div style="margin-top:4px;color:#9CA3AF">⚙ ${task.machineName}</div>` : ''}
    `;

    document.body.appendChild(el);
    this._positionTooltip(el, x, y);
    this._tooltipEl = el;
  }

  _positionTooltip(el, cx, cy) {
    const rect = this._canvas.getBoundingClientRect();
    let left = rect.left + cx + 14;
    let top  = rect.top  + cy - 10;

    // Évite le débordement droite
    if (left + 200 > window.innerWidth)  left = rect.left + cx - 210;
    if (top  + 120 > window.innerHeight) top  = rect.top  + cy - 120;

    el.style.left = left + 'px';
    el.style.top  = top  + 'px';
  }

  _removeTooltip() {
    const old = document.getElementById('gantt-tooltip');
    if (old) old.remove();
    this._tooltipEl = null;
  }

  // ─── Hover ───────────────────────────────────────────────────────────────────

  _onMouseMove(e) {
    const rect  = this._canvas.getBoundingClientRect();
    const dpr   = window.devicePixelRatio || 1;
    const cx    = (e.clientX - rect.left);
    const cy    = (e.clientY - rect.top);

    // Coordonnées dans le canvas non-DPI
    const mx = cx;
    const my = cy;

    // Cherche quelle tâche est sous la souris
    const hit = this._tasks.find(task => {
      const tx = AXIS_LEFT + task.start_time * this._scale;
      const ty = HEADER_H + task.machineIndex * ROW_H + PADDING / 2;
      const tw = Math.max(task.duration * this._scale - 2, 4);
      const th = ROW_H - PADDING;
      return mx >= tx && mx <= tx + tw && my >= ty && my <= ty + th;
    });

    if (hit && hit !== this._hoverTask) {
      this._hoverTask = hit;
      this.showTooltip(hit, cx, cy);
      this._canvas.style.cursor = 'crosshair';
    } else if (!hit && this._hoverTask) {
      this._hoverTask = null;
      this._removeTooltip();
      this._canvas.style.cursor = 'default';
    } else if (hit && this._tooltipEl) {
      this._positionTooltip(this._tooltipEl, cx, cy);
    }
  }

  _onMouseLeave() {
    this._hoverTask = null;
    this._removeTooltip();
  }

  // ─── Export PNG ───────────────────────────────────────────────────────────────

  exportPNG(filename = 'gantt-automaroc.png') {
    if (!this._canvas) return;
    const link    = document.createElement('a');
    link.download = filename;
    link.href     = this._canvas.toDataURL('image/png', 1.0);
    link.click();
  }

  // ─── Helpers privés ──────────────────────────────────────────────────────────

  _roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _chooseStep(total) {
    if (total <= 60)  return 10;
    if (total <= 180) return 20;
    if (total <= 480) return 60;
    return 120;
  }

  _fmtMin(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${m}min`;
  }

  _fmtMinFull(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}min`);
    return parts.length ? parts.join(' ') : '0min';
  }

  _darken(hex, amount = 20) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r   = Math.max(0, (num >> 16) - amount);
    const g   = Math.max(0, ((num >> 8) & 0xFF) - amount);
    const b   = Math.max(0, (num & 0xFF) - amount);
    return `rgb(${r},${g},${b})`;
  }

  _computeEnd(machines) {
    let end = 0;
    (machines ?? []).forEach(m =>
      (m.tasks ?? []).forEach(t => { if (t.end_time > end) end = t.end_time; })
    );
    return end || 60;
  }

  /** Retourne la carte couleur job_id → couleur */
  get jobColors() { return { ...this._jobColors }; }
}
