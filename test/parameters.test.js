/**
 * Eleveld 2018 (Br J Anaesth 120:942) reference individual: 35 y, 70 kg, 170 cm,
 * male, no opioid. Published values (3 significant figures):
 * V1 6.28 L, V2 25.5 L, V3 273 L, CL 1.79 L/min, Q3 1.11 L/min.
 * The tolerance is half a unit in the last published digit.
 */
'use strict';
const { test, assert } = require('./lib/harness');
const { loadApp } = require('./lib/load');

const app = loadApp();

test('Eleveld reference individual reproduces the published V1, V2, V3, CL, Q3', () => {
    const patient = app.run(`new Patient('ref', 35, 70, 170, SexType.MALE, AsapsType.CLASS_1_2, OpioidType.NO)`);
    const { pk } = app.get('EleveldPKPDCalculator').getModelParameters(patient);
    const expected = { v1: [6.28, 0.005], v2: [25.5, 0.05], v3: [273, 0.5], cl: [1.79, 0.005], q3: [1.11, 0.005] };
    for (const [name, [value, halfUnit]] of Object.entries(expected)) {
        assert.ok(Math.abs(pk[name] - value) <= halfUnit, `${name}: ${pk[name]} vs published ${value}`);
    }
});

test('rate constants are consistent with volumes and clearances', () => {
    const patient = app.run(`new Patient('x', 55, 82, 175, SexType.FEMALE, AsapsType.CLASS_3_4, OpioidType.YES)`);
    const { pk } = app.get('EleveldPKPDCalculator').getModelParameters(patient);
    const near = (a, b) => Math.abs(a - b) <= 1e-12 * Math.abs(b);
    assert.ok(near(pk.k10, pk.cl / pk.v1) && near(pk.k12, pk.q2 / pk.v1) && near(pk.k21, pk.q2 / pk.v2));
    assert.ok(near(pk.k13, pk.q3 / pk.v1) && near(pk.k31, pk.q3 / pk.v3));
});

test('resolveParameters rejects an out-of-range patient instead of returning bad parameters', () => {
    const patient = app.run(`new Patient('bad', 40, 70, 170, SexType.MALE, AsapsType.CLASS_1_2, OpioidType.NO)`);
    patient.weight = -5;
    assert.throws(() => app.get('EleveldPKPDCalculator').resolveParameters(patient));
});

test('engines keep parameters on the engine and leave the Patient untouched', () => {
    const patient = app.run(`new Patient('p', 40, 70, 170, SexType.MALE, AsapsType.CLASS_1_2, OpioidType.NO)`);
    const before = Object.keys(patient).join();
    for (const name of ['InductionEngine', 'ProtocolEngine', 'AdvancedProtocolEngine', 'MonitoringEngine']) {
        const engine = new (app.get(name))();
        engine.setPatient(patient);
        assert.ok(engine.pkParams && engine.pdParams, `${name} has pk and pd parameters`);
    }
    assert.strictEqual(Object.keys(patient).join(), before);
});
