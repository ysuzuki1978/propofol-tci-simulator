/**
 * The four engines against the exact (matrix exponential) solution of the same
 * 3-compartment + effect-site system, and against each other.
 * Tolerance: 1e-6 relative on Cp and Ce.
 */
'use strict';
const { test, assert, maxRelativeError } = require('./lib/harness');
const { loadApp } = require('./lib/load');
const { exactTrajectory } = require('./lib/exact');

const TOL = 1e-6;
const app = loadApp();
const patient = () => app.run(`new Patient('t', 40, 70, 170, SexType.MALE, AsapsType.CLASS_1_2, OpioidType.NO)`);
const pkOf = (p) => {
    const { pk } = app.get('EleveldPKPDCalculator').getModelParameters(p);
    return { v1: pk.v1, v2: pk.v2, v3: pk.v3, cl: pk.cl, q2: pk.q2, q3: pk.q3, ke0: pk.ke0 };
};
const engine = (name) => { const e = new (app.get(name))(); e.setPatient(patient()); return e; };
const doseEvent = (t, bolus, rate) => new (app.get('DoseEvent'))(t, bolus, rate);

// Dose record used for the monitoring engine and the exact replay:
// bolus + 300 mg/h at 0, 20 mg + 200 mg/h at 30, 10 mg bolus at 45 (rate unchanged), stop at 60.
const RECORD = [
    { t: 0, bolus: 100, perHour: 300 }, { t: 30, bolus: 20, perHour: 200 },
    { t: 45, bolus: 10, perHour: 200 }, { t: 60, bolus: 0, perHour: 0 }
];
const recordAsExactEvents = RECORD.map(e => ({ timeMin: e.t, bolusMg: e.bolus, rateMgPerMin: e.perHour / 60 }));

test('monitoring engine: Cp and Ce match exact over bolus, rate changes, a later bolus and stop (every 0.1 min)', () => {
    const e = engine('MonitoringEngine');
    RECORD.forEach(r => e.addDoseEvent(doseEvent(r.t, r.bolus, r.perHour)));
    const result = e.runSimulation(120);
    const exact = exactTrajectory(recordAsExactEvents, pkOf(patient()), { durationMin: 120, sampleMin: 0.1, dtMin: 0.1 });
    assert.strictEqual(exact.length, result.plasmaConcentrations.length);
    assert.ok(maxRelativeError(exact.map(s => s.cp), Array.from(result.plasmaConcentrations)) < TOL, 'Cp');
    assert.ok(maxRelativeError(exact.map(s => s.ce), Array.from(result.effectSiteConcentrations)) < TOL, 'Ce');
});

test('induction engine: Cp and Ce match exact for bolus + infusion (0.01 min steps, 20 min)', () => {
    const e = new (app.get('InductionEngine'))();
    const p = patient();
    e.start(p, 100, 300);
    const cp = [e.getPlasmaConcentration()], ce = [e.getEffectSiteConcentration()];
    for (let i = 0; i < 2000; i++) { e.updateSimulation(); cp.push(e.getPlasmaConcentration()); ce.push(e.getEffectSiteConcentration()); }
    e.stop();
    const exact = exactTrajectory([{ timeMin: 0, bolusMg: 100, rateMgPerMin: 5 }], pkOf(p), { durationMin: 20, sampleMin: 0.01, dtMin: 0.01 });
    assert.ok(maxRelativeError(exact.map(s => s.cp), cp) < TOL, 'Cp');
    assert.ok(maxRelativeError(exact.map(s => s.ce), ce) < TOL, 'Ce');
});

test('protocol engine: simulateBolusAndContinuous matches exact Ce at 1, 5, 20, 60 min', () => {
    const e = engine('ProtocolEngine');
    const exact = exactTrajectory([{ timeMin: 0, bolusMg: 100, rateMgPerMin: 5 }], pkOf(patient()), { durationMin: 60, sampleMin: 1, dtMin: 0.1 });
    for (const t of [1, 5, 20, 60]) {
        const reference = exact.find(s => Math.abs(s.t - t) < 1e-9).ce;
        assert.ok(Math.abs(e.simulateBolusAndContinuous(100, 300, t) - reference) / reference < TOL, `Ce at ${t} min`);
    }
});

/** Replays the rates a step-down engine recorded (rate at a time point applies to the step after it). */
function replay(timeSeries, bolusMg, durationMin, pk) {
    const events = [];
    let last = null;
    for (const point of timeSeries) {
        if (point.infusionRate !== last) { events.push({ timeMin: point.time, rateMgPerMin: point.infusionRate / 60 }); last = point.infusionRate; }
    }
    events[0].bolusMg = bolusMg;
    return exactTrajectory(events, pk, { durationMin, sampleMin: 0.1, dtMin: 0.1 });
}

test('protocol engine: generateCompleteProtocol (with step-downs) matches exact replay of its own rates', () => {
    const e = engine('ProtocolEngine');
    const result = e.generateCompleteProtocol(100, 300);
    assert.ok(result.dosageAdjustments.length >= 1, 'scenario must contain a step-down');
    const exact = replay(result.timeSeriesData, 100, 120, pkOf(patient()));
    assert.ok(maxRelativeError(exact.map(s => s.ce), result.timeSeriesData.map(d => d.ce)) < TOL, 'Ce');
    assert.ok(maxRelativeError(exact.map(s => s.cp), result.timeSeriesData.map(d => d.plasma)) < TOL, 'Cp');
});

test('advanced protocol engine: step-down simulation matches exact replay of its own rates', () => {
    const e = engine('AdvancedProtocolEngine');
    e.updateSettings({ simulationDuration: 120 });
    const series = e.simulateAdvancedStepDownProtocol(100, 600, 1.0);
    assert.ok(series.some(d => d.adjustmentNumber > 0), 'scenario must contain a step-down');
    const exact = replay(series, 100, 120, pkOf(patient()));
    assert.ok(maxRelativeError(exact.map(s => s.ce), series.map(d => d.ce)) < TOL, 'Ce');
    assert.ok(maxRelativeError(exact.map(s => s.cp), series.map(d => d.plasma)) < TOL, 'Cp');
});

test('the four engines agree with each other on Ce for the same constant-rate dose (1, 5, 20 min)', () => {
    const p = patient();
    const protocol = engine('ProtocolEngine');
    const monitoring = engine('MonitoringEngine');
    monitoring.addDoseEvent(doseEvent(0, 100, 300));
    const mon = monitoring.runSimulation(60);
    const advanced = engine('AdvancedProtocolEngine');
    advanced.updateSettings({ simulationDuration: 20 });
    const adv = advanced.simulateAdvancedStepDownProtocol(100, 300, 3.0);   // threshold 3.6: no step-down
    const induction = new (app.get('InductionEngine'))();
    induction.start(p, 100, 300);
    const ind = [induction.getEffectSiteConcentration()];
    for (let i = 0; i < 2000; i++) { induction.updateSimulation(); ind.push(induction.getEffectSiteConcentration()); }
    induction.stop();
    for (const t of [1, 5, 20]) {
        const values = [
            protocol.simulateBolusAndContinuous(100, 300, t),
            mon.effectSiteConcentrations[Math.round(t / 0.1)],
            adv[Math.round(t / 0.1)].ce,
            ind[Math.round(t / 0.01)]
        ];
        const spread = (Math.max(...values) - Math.min(...values)) / values[0];
        assert.ok(spread < TOL, `Ce spread at ${t} min: ${spread.toExponential(2)} (${values.join(', ')})`);
    }
});
