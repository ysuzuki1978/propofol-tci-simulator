/**
 * Negative control: the exact-solution comparison must reject a unit error.
 * A rate given per hour where the system expects per minute is 60 times too large.
 * Each case first checks that the correct units pass at the same tolerance, so a
 * failure of the flagged case cannot come from a comparison that is simply too strict.
 */
'use strict';
const { test, assert, maxRelativeError } = require('./lib/harness');
const { loadApp } = require('./lib/load');
const { exactTrajectory } = require('./lib/exact');

const app = loadApp();
const TOL = 1e-6;

test('a rate in mg/h fed as mg/min (60x) is detected against the same record that otherwise passes', () => {
    const patient = app.run(`new Patient('t', 40, 70, 170, SexType.MALE, AsapsType.CLASS_1_2, OpioidType.NO)`);
    const { pk } = app.get('EleveldPKPDCalculator').getModelParameters(patient);
    const flat = { v1: pk.v1, v2: pk.v2, v3: pk.v3, cl: pk.cl, q2: pk.q2, q3: pk.q3, ke0: pk.ke0 };
    const options = { durationMin: 60, sampleMin: 0.1, dtMin: 0.1 };

    const monitoring = new (app.get('MonitoringEngine'))();
    monitoring.setPatient(patient);
    monitoring.addDoseEvent(new (app.get('DoseEvent'))(0, 100, 300));        // 100 mg bolus + 300 mg/h
    const engineCe = Array.from(monitoring.runSimulation(60).effectSiteConcentrations);

    const right = exactTrajectory([{ timeMin: 0, bolusMg: 100, rateMgPerMin: 300 / 60 }], flat, options).map(s => s.ce);
    const wrong = exactTrajectory([{ timeMin: 0, bolusMg: 100, rateMgPerMin: 300 }], flat, options).map(s => s.ce);

    assert.ok(maxRelativeError(right, engineCe) < TOL, 'control: the engine at correct units passes');
    // `wrong` is what an engine that took mg/h as mg/min would have produced
    const error = maxRelativeError(right, wrong);
    assert.ok(error > 10, `60x rate error must be flagged, got relative error ${error}`);
});

test('an integrator fed the hourly number as per-minute is flagged against the exact solution', () => {
    const patient = app.run(`new Patient('t', 40, 70, 170, SexType.MALE, AsapsType.CLASS_1_2, OpioidType.NO)`);
    const { pk } = app.get('EleveldPKPDCalculator').getModelParameters(patient);
    const flat = { v1: pk.v1, v2: pk.v2, v3: pk.v3, cl: pk.cl, q2: pk.q2, q3: pk.q3, ke0: pk.ke0 };
    const exact = exactTrajectory([{ timeMin: 0, bolusMg: 100, rateMgPerMin: 5 }], flat,
        { durationMin: 30, sampleMin: 0.1, dtMin: 0.1 }).map(s => s.ce);
    const Integrator = app.get('PKIntegrator');
    const step = (rate) => {
        let state = { a1: 100, a2: 0, a3: 0, ce: 0 };
        const out = [0];
        for (let i = 0; i < 300; i++) { state = Integrator.rk4Step(state, pk, rate, 0.1); out.push(state.ce); }
        return out;
    };
    assert.ok(maxRelativeError(exact, step(300 / 60)) < TOL, 'control: mg/min passes');
    assert.ok(maxRelativeError(exact, step(300)) > 10, 'mg/h given as mg/min is flagged');
});
