/**
 * Exact solution of the 3-compartment + effect-site system by a matrix exponential.
 *
 * Adapted from validation/lib/exact.js of anesthesia-triad-simulator v0.8.6
 * (commit 48f6305, same author, MIT): expm() and the written-out standard
 * system are taken from there; the trajectory driver is simplified to what this
 * app needs. The matrix is built from volumes and clearances, not from the rate
 * constants the code under test uses, so the check is independent of it.
 *
 * With the state y and a constant infusion u over an interval,
 *     y(t + h) = exp(M h) [y(t); u],   M = [[A, b], [0, 0]]
 * which is exact for a piecewise-constant infusion with boluses added at their
 * instants. State order: a1, a2, a3 (mg), ce (ug/mL).
 */
'use strict';

const zeros = (n, m = n) => Array.from({ length: n }, () => new Array(m).fill(0));
const identity = (n) => zeros(n).map((row, i) => { row[i] = 1; return row; });

function multiply(a, b) {
    const n = a.length, m = b[0].length, inner = b.length;
    const out = zeros(n, m);
    for (let i = 0; i < n; i++) {
        for (let k = 0; k < inner; k++) {
            const aik = a[i][k];
            if (aik === 0) continue;
            for (let j = 0; j < m; j++) out[i][j] += aik * b[k][j];
        }
    }
    return out;
}

const maxAbs = (a) => a.reduce((m, row) => row.reduce((r, x) => Math.max(r, Math.abs(x)), m), 0);

/** exp(M) by scaling and squaring with a Taylor series on the scaled matrix. */
function expm(matrix) {
    const n = matrix.length;
    const norm = matrix.reduce((m, row) => Math.max(m, row.reduce((s, x) => s + Math.abs(x), 0)), 0);
    const squarings = norm > 0.5 ? Math.ceil(Math.log2(norm / 0.5)) : 0;
    const scale = Math.pow(2, -squarings);
    const scaled = matrix.map(row => row.map(x => x * scale));

    let term = identity(n);
    let sum = identity(n);
    for (let k = 1; k <= 30; k++) {
        term = multiply(term, scaled).map(row => row.map(x => x / k));
        sum = sum.map((row, i) => row.map((x, j) => x + term[i][j]));
        if (maxAbs(term) < 1e-20 * maxAbs(sum)) break;
    }
    for (let i = 0; i < squarings; i++) sum = multiply(sum, sum);
    return sum;
}

/** The system matrices from volumes (L), clearances (L/min) and ke0 (1/min). */
function standardSystem(pk) {
    const k10 = pk.cl / pk.v1, k12 = pk.q2 / pk.v1, k21 = pk.q2 / pk.v2;
    const k13 = pk.q3 / pk.v1, k31 = pk.q3 / pk.v3;
    const A = [
        [-(k10 + k12 + k13), k21, k31, 0],
        [k12, -k21, 0, 0],
        [k13, 0, -k31, 0],
        [pk.ke0 / pk.v1, 0, 0, -pk.ke0]
    ];
    return { A, b: [1, 0, 0, 0] };
}

/**
 * The state at each sample time for a dose record.
 * events: [{ timeMin, bolusMg?, rateMgPerMin? }]; a rate holds until the next event that sets one.
 * Event times and sample times must lie on the grid of `dtMin`.
 * Returns [{ t, cp, ce }].
 */
function exactTrajectory(events, pk, { durationMin, sampleMin, dtMin }) {
    const { A, b } = standardSystem(pk);
    const n = 4;
    const augmented = zeros(n + 1);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) augmented[i][j] = A[i][j];
        augmented[i][n] = b[i];
    }
    const grid = (minutes) => Math.round(minutes / dtMin);
    const sorted = [...events].sort((p, q) => p.timeMin - q.timeMin).map(e => ({ ...e, step: grid(e.timeMin) }));
    const sampleSteps = grid(sampleMin);
    const lastStep = grid(durationMin);

    const instants = new Set([0, lastStep]);
    for (let s = 0; s <= lastStep; s += sampleSteps) instants.add(s);
    for (const e of sorted) if (e.step <= lastStep) instants.add(e.step);
    const order = [...instants].sort((p, q) => p - q);

    const propagators = new Map();
    const propagator = (steps) => {
        if (!propagators.has(steps)) propagators.set(steps, expm(augmented.map(row => row.map(x => x * steps * dtMin))));
        return propagators.get(steps);
    };

    let y = new Array(n).fill(0);
    let rate = 0;
    let next = 0;
    const samples = [];
    for (let idx = 0; idx < order.length; idx++) {
        const step = order[idx];
        while (next < sorted.length && sorted[next].step <= step) {
            const e = sorted[next];
            if (e.bolusMg) y[0] += e.bolusMg;
            if (e.rateMgPerMin !== undefined) rate = e.rateMgPerMin;
            next++;
        }
        if (step % sampleSteps === 0) samples.push({ t: step * dtMin, cp: y[0] / pk.v1, ce: y[3] });
        if (idx + 1 < order.length) {
            const E = propagator(order[idx + 1] - step);
            const z = [...y, rate];
            y = y.map((_, i) => E[i].reduce((s, e, j) => s + e * z[j], 0));
        }
    }
    return samples;
}

module.exports = { expm, standardSystem, exactTrajectory };
