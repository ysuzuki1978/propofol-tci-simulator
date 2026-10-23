/**
 * Touch interaction for the app's three Chart.js charts: zoom and pan on the
 * time axis, a time cursor, and an HTML legend that reads the values at the
 * cursor.
 *
 * One finger: drag to pan when zoomed in, drag to move the cursor when not. A
 * tap puts the cursor there. Two fingers: pinch to zoom about the midpoint,
 * and move the midpoint to pan. Double-tap, double-click or "Fit" go back to
 * the whole record. Ctrl+wheel (a trackpad pinch arrives as one) zooms about
 * the pointer, and a horizontal wheel pans.
 *
 * This file owns the visible window and the cursor and nothing else. It never
 * draws a curve: it sets the x scale's min and max, fits the concentration
 * axes to what is inside the window, and lets Chart.js draw. The charts' data
 * and the calculation behind them are not touched.
 *
 * The x axis is either a category axis (labels are clock times; the position
 * is the index) or a linear one (labels are seconds). Both are handled in the
 * scale's own units, `x`, and `xAt(i)` converts a sample index to them.
 *
 * `host` must have `touch-action: pan-y`: vertical scrolling stays with the
 * browser, and every horizontal move and pinch comes here.
 */

class ChartInteraction {
    /**
     * @param {object} o
     * @param {HTMLElement} o.host        element wrapping the canvas (position: relative)
     * @param {() => Chart|null} o.getChart
     * @param {string[]} [o.fitAxes]      y axes refitted to the window while zoomed
     * @param {(x:number, i:number) => string} [o.formatX]  label for the readout
     * @param {string} [o.latest]         what the readout says while the cursor is unset
     * @param {number} [o.minSpan]        narrowest window, in x units
     */
    constructor({ host, getChart, fitAxes = ['y'], formatX = (x) => String(x), latest = 'Latest', minSpan = null }) {
        this.host = host;
        this.getChart = getChart;
        this.fitAxes = fitAxes;
        this.formatX = formatX;
        this.latest = latest;
        this.minSpanOverride = minSpan;

        /** null is the whole record; otherwise {min, max} in x units. */
        this.view = null;
        /** null follows the newest sample; otherwise an x position. */
        this.cursor = null;

        this.pointers = new Map();
        this.drag = null;
        this.pinch = null;
        this.lastTap = null;

        this.buildDom();
        this.bindPointers();
    }

    // ------------------------------------------------------------------ DOM

    buildDom() {
        const { host } = this;

        this.legendEl = document.createElement('div');
        this.legendEl.className = 'chart-legend';
        host.parentNode.insertBefore(this.legendEl, host);

        this.cursorEl = document.createElement('div');
        this.cursorEl.className = 'chart-cursor';
        this.cursorEl.hidden = true;
        this.cursorEl.setAttribute('aria-hidden', 'true');
        host.appendChild(this.cursorEl);

        const tools = document.createElement('div');
        tools.className = 'chart-tools';
        tools.innerHTML = `
            <div class="chart-readout">
                <span class="chart-readout-main" data-role="readout"></span>
                <span class="chart-hint">Pinch to zoom &middot; drag to pan &middot; double-tap to reset</span>
            </div>
            <span class="chart-zoom">
                <button type="button" class="zoom-btn" data-role="out" aria-label="Zoom out">&minus;</button>
                <button type="button" class="zoom-btn" data-role="in" aria-label="Zoom in">+</button>
                <button type="button" class="zoom-btn zoom-fit" data-role="fit" aria-label="Show the whole record" disabled>Fit</button>
            </span>`;
        host.parentNode.insertBefore(tools, host.nextSibling);
        this.readoutEl = tools.querySelector('[data-role="readout"]');
        this.fitBtn = tools.querySelector('[data-role="fit"]');
        tools.querySelector('[data-role="in"]').addEventListener('click', () => this.step(0.5));
        tools.querySelector('[data-role="out"]').addEventListener('click', () => this.step(2));
        this.fitBtn.addEventListener('click', () => this.reset());

        this.legendEl.addEventListener('click', (event) => {
            const chip = event.target.closest('.legend-chip');
            if (!chip) return;
            const chart = this.getChart();
            if (!chart) return;
            const i = Number(chip.dataset.index);
            chart.setDatasetVisibility(i, !chart.isDatasetVisible(i));
            this.apply();
        });
    }

    // --------------------------------------------------------------- domain

    isCategory(chart) {
        return chart.scales.x.type === 'category';
    }

    /** The x position of sample `i`, in the scale's own units. */
    xAt(chart, i) {
        return this.isCategory(chart) ? i : Number(chart.data.labels[i]);
    }

    /** The whole record, or null when there is not yet a line to zoom. */
    domain(chart = this.getChart()) {
        const n = chart?.data?.labels?.length ?? 0;
        if (n < 2) return null;
        return { min: this.xAt(chart, 0), max: this.xAt(chart, n - 1) };
    }

    minSpan(chart, d) {
        const wanted = this.minSpanOverride ?? (this.isCategory(chart) ? 8 : 10);
        return Math.min(wanted, d.max - d.min);
    }

    /** The window to draw, inside the record. */
    window() {
        const chart = this.getChart();
        const d = chart && this.domain(chart);
        if (!d) return null;
        if (!this.view) return d;
        const lo = this.minSpan(chart, d);
        const span = Math.min(Math.max(this.view.max - this.view.min, lo), d.max - d.min);
        const min = Math.min(Math.max(this.view.min, d.min), d.max - span);
        return { min, max: min + span };
    }

    isZoomed() {
        const chart = this.getChart();
        const d = chart && this.domain(chart);
        const w = d && this.window();
        return !!w && w.max - w.min < d.max - d.min - 1e-9;
    }

    set(min, max) {
        const chart = this.getChart();
        const d = chart && this.domain(chart);
        if (!d) return;
        const span = Math.min(Math.max(max - min, this.minSpan(chart, d)), d.max - d.min);
        const lo = Math.min(Math.max(min, d.min), d.max - span);
        this.view = span >= d.max - d.min - 1e-9 ? null : { min: lo, max: lo + span };
        this.apply();
    }

    reset() {
        this.view = null;
        this.apply();
    }

    /** Scales the window by `factor` (<1 zooms in), keeping `anchor` where it is on screen. */
    zoomBy(factor, anchor) {
        const w = this.window();
        if (!w) return;
        const span = w.max - w.min;
        const frac = span > 0 ? (anchor - w.min) / span : 0.5;
        const next = span * factor;
        this.set(anchor - frac * next, anchor - frac * next + next);
    }

    step(factor) {
        const w = this.window();
        if (w) this.zoomBy(factor, (w.min + w.max) / 2);
    }

    /** Forgets the zoom and the cursor: the data behind the chart is new. */
    clear() {
        this.view = null;
        this.cursor = null;
    }

    // ---------------------------------------------------------------- apply

    /**
     * Pushes the window onto the chart, fits the concentration axes to it, and
     * refreshes the legend values and the cursor line. Call it whenever the
     * chart's data has changed, and once after a chart is created.
     */
    sync() {
        const chart = this.getChart();
        if (!chart) return;
        this.buildLegend(chart);
        this.apply();
    }

    /** The cheap update for a chart that is fed continuously: the window only moves when zoomed. */
    refresh() {
        const chart = this.getChart();
        if (!chart) return;
        if (this.isZoomed()) {
            this.apply();
        } else {
            this.drawCursor(chart);
            this.drawValues(chart);
        }
    }

    apply() {
        const chart = this.getChart();
        if (!chart) return;
        const zoomed = this.isZoomed();
        const w = this.window();
        const scales = chart.options.scales;

        if (zoomed) {
            scales.x.min = w.min;
            scales.x.max = w.max;
        } else {
            scales.x.min = undefined;
            scales.x.max = undefined;
        }
        for (const id of this.fitAxes) {
            if (!scales[id]) continue;
            scales[id].max = zoomed ? this.peakIn(chart, id, w) * 1.08 : undefined;
        }
        chart.update('none');

        this.fitBtn.disabled = !zoomed;
        this.drawCursor(chart);
        this.drawValues(chart);
    }

    /** The tallest visible point on one y axis inside the window. */
    peakIn(chart, axisId, w) {
        const n = chart.data.labels.length;
        let peak = 0;
        chart.data.datasets.forEach((set, k) => {
            if ((set.yAxisID || 'y') !== axisId || !chart.isDatasetVisible(k)) return;
            for (let i = 0; i < n; i++) {
                const x = this.xAt(chart, i);
                const y = typeof set.data[i] === 'object' && set.data[i] !== null ? set.data[i].y : set.data[i];
                if (x >= w.min && x <= w.max && Number.isFinite(y) && y > peak) peak = y;
            }
        });
        return peak > 0 ? peak : 1;
    }

    // --------------------------------------------------------------- legend

    buildLegend(chart) {
        const signature = chart.data.datasets.map(d => d.label).join('|');
        if (this.legendEl.dataset.signature !== signature) {
            this.legendEl.innerHTML = chart.data.datasets.map((set, i) => `
                <button type="button" class="legend-chip" data-index="${i}" aria-pressed="true">
                    <span class="legend-swatch${set.borderDash ? ' dashed' : ''}" style="--swatch:${set.borderColor}"></span>
                    <span class="legend-name">${set.label}</span>
                    <span class="legend-value" data-role="value"></span>
                    <span class="legend-unit">${set.unit ?? ''}</span>
                </button>`).join('');
            this.legendEl.dataset.signature = signature;
        }
    }

    /** Index of the sample nearest the cursor, or the newest while it is unset. */
    cursorIndex(chart) {
        const n = chart.data.labels.length;
        if (!n) return -1;
        if (this.cursor === null) return n - 1;
        let lo = 0;
        let hi = n - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (this.xAt(chart, mid) < this.cursor) lo = mid + 1; else hi = mid;
        }
        return lo > 0 && this.cursor - this.xAt(chart, lo - 1) < this.xAt(chart, lo) - this.cursor ? lo - 1 : lo;
    }

    drawValues(chart) {
        const i = this.cursorIndex(chart);
        this.legendEl.querySelectorAll('.legend-chip').forEach((chip) => {
            const k = Number(chip.dataset.index);
            const set = chart.data.datasets[k];
            const on = chart.isDatasetVisible(k);
            chip.classList.toggle('off', !on);
            chip.setAttribute('aria-pressed', String(on));
            const raw = i >= 0 && set ? set.data[i] : undefined;
            const y = typeof raw === 'object' && raw !== null ? raw.y : raw;
            const text = on && Number.isFinite(y)
                ? (set.digits === undefined ? y.toPrecision(3) : y.toFixed(set.digits)) : '';
            chip.querySelector('[data-role="value"]').textContent = text;
        });
        this.readoutEl.textContent = i < 0 ? '' : this.cursor === null
            ? `${this.latest}: ${this.formatX(this.xAt(chart, i), i)}`
            : `Cursor: ${this.formatX(this.xAt(chart, i), i)}`;
    }

    drawCursor(chart) {
        const el = this.cursorEl;
        const area = chart.chartArea;
        const w = this.window();
        if (this.cursor === null || !area || !w || this.cursor < w.min || this.cursor > w.max) {
            el.hidden = true;
            return;
        }
        el.hidden = false;
        el.style.left = `${chart.canvas.offsetLeft + chart.scales.x.getPixelForValue(this.cursor)}px`;
        el.style.top = `${chart.canvas.offsetTop + area.top}px`;
        el.style.height = `${area.bottom - area.top}px`;
    }

    setCursor(x) {
        const chart = this.getChart();
        if (!chart) return;
        const d = this.domain(chart);
        if (!d) return;
        // Snap to a sample so the line, the readout and the values agree.
        this.cursor = x === null ? null : this.xAt(chart, this.cursorIndexFor(chart, Math.min(Math.max(x, d.min), d.max)));
        this.drawCursor(chart);
        this.drawValues(chart);
    }

    cursorIndexFor(chart, x) {
        const saved = this.cursor;
        this.cursor = x;
        const i = this.cursorIndex(chart);
        this.cursor = saved;
        return i;
    }

    // ------------------------------------------------------------- pointers

    area() {
        const chart = this.getChart();
        if (!chart?.chartArea) return null;
        const rect = chart.canvas.getBoundingClientRect();
        const { left, right } = chart.chartArea;
        return right > left ? { left: rect.left + left, width: right - left } : null;
    }

    /** The x position under a screen x, from the current window. */
    xUnder(clientX) {
        const a = this.area();
        const w = this.window();
        if (!a || !w) return null;
        const frac = Math.min(Math.max((clientX - a.left) / a.width, 0), 1);
        return w.min + frac * (w.max - w.min);
    }

    bindPointers() {
        const host = this.host;
        const TAP_SLOP = 8;
        const DOUBLE_TAP_MS = 320;
        const DOUBLE_TAP_PX = 32;

        const dist = () => {
            const [a, b] = [...this.pointers.values()];
            return Math.hypot(a.x - b.x, a.y - b.y);
        };
        const midX = () => {
            const [a, b] = [...this.pointers.values()];
            return (a.x + b.x) / 2;
        };
        const startDrag = (x, y, moved) => {
            const w = this.window();
            this.drag = { x, y, min: w ? w.min : 0, span: w ? w.max - w.min : 0, moved, scrub: false };
        };

        host.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            host.setPointerCapture(e.pointerId);
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.pointers.size === 1) {
                startDrag(e.clientX, e.clientY, false);
            } else if (this.pointers.size === 2) {
                // A second finger turns whatever the first was doing into a pinch.
                this.drag = null;
                const w = this.window();
                const a = this.area();
                this.pinch = w && a ? {
                    span: w.max - w.min, dist: Math.max(dist(), 1), anchor: this.xUnder(midX())
                } : null;
            }
        });

        host.addEventListener('pointermove', (e) => {
            if (!this.pointers.has(e.pointerId)) return;
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this.pinch && this.pointers.size >= 2) {
                const a = this.area();
                if (!a) return;
                const span = this.pinch.span * this.pinch.dist / Math.max(dist(), 1);
                // The x that was under the midpoint at the start stays under
                // it now, which is both the zoom centre and the pan.
                const frac = Math.min(Math.max((midX() - a.left) / a.width, 0), 1);
                this.set(this.pinch.anchor - frac * span, this.pinch.anchor - frac * span + span);
                return;
            }

            if (!this.drag || this.pointers.size !== 1) return;
            const dx = e.clientX - this.drag.x;
            const dy = e.clientY - this.drag.y;
            if (!this.drag.moved && Math.hypot(dx, dy) > TAP_SLOP) this.drag.moved = true;
            if (!this.drag.moved) return;

            if (this.isZoomed()) {
                const a = this.area();
                if (!a) return;
                const min = this.drag.min - (dx / a.width) * this.drag.span;
                this.set(min, min + this.drag.span);
            } else {
                // Nothing to pan, so the finger moves the cursor. Only once the
                // move is mostly sideways, so starting a vertical page scroll
                // on the chart does not drag the cursor along with it.
                if (!this.drag.scrub && Math.abs(dx) > Math.abs(dy)) this.drag.scrub = true;
                if (this.drag.scrub) {
                    const x = this.xUnder(e.clientX);
                    if (x !== null) this.setCursor(x);
                }
            }
        });

        const finish = (e) => {
            if (!this.pointers.has(e.pointerId)) return;
            const wasTap = this.drag && !this.drag.moved && e.type === 'pointerup';
            this.pointers.delete(e.pointerId);
            if (this.pointers.size < 2) this.pinch = null;
            if (this.pointers.size === 0) {
                this.drag = null;
                if (wasTap) tap(e);
            } else if (this.pointers.size === 1) {
                // One finger of a pinch is still down; it pans from where it
                // is now rather than jumping back to where the first started.
                const [rest] = this.pointers.values();
                startDrag(rest.x, rest.y, true);
            }
        };
        host.addEventListener('pointerup', finish);
        host.addEventListener('pointercancel', finish);

        const tap = (e) => {
            const now = e.timeStamp;
            const last = this.lastTap;
            if (last && now - last.at < DOUBLE_TAP_MS
                && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_TAP_PX) {
                this.lastTap = null;
                this.reset();
                return;
            }
            this.lastTap = { at: now, x: e.clientX, y: e.clientY };
            const x = this.xUnder(e.clientX);
            if (x !== null) this.setCursor(x);
        };

        host.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const x = this.xUnder(e.clientX);
                if (x !== null) this.zoomBy(Math.exp(e.deltaY * 0.01), x);
            } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && this.isZoomed()) {
                e.preventDefault();
                const a = this.area();
                const w = this.window();
                if (!a || !w) return;
                const shift = (e.deltaX / a.width) * (w.max - w.min);
                this.set(w.min + shift, w.max + shift);
            }
        }, { passive: false });
    }
}

/** Touch screens get no tooltip: it outlives the touch and covers the curves. */
ChartInteraction.COARSE_POINTER = typeof window !== 'undefined'
    && window.matchMedia('(pointer: coarse)').matches;

if (typeof window !== 'undefined') {
    window.ChartInteraction = ChartInteraction;
}
