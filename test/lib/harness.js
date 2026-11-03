/**
 * Minimal test harness (no dependencies; runs on any Node the app supports).
 * test(name, fn) registers; run.js executes and sets the exit code.
 */
'use strict';
const assert = require('assert');

const registry = [];
const test = (name, fn) => registry.push({ name, fn });

/** Largest |computed - reference| / reference over points where the reference is not negligible. */
function maxRelativeError(reference, computed) {
    assert.strictEqual(computed.length, reference.length, 'series differ in length');
    const peak = reference.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    const floor = Math.max(peak * 1e-8, 1e-10);
    let worst = 0;
    for (let i = 0; i < reference.length; i++) {
        if (Math.abs(reference[i]) <= floor) continue;
        worst = Math.max(worst, Math.abs(computed[i] - reference[i]) / Math.abs(reference[i]));
    }
    return worst;
}

function assertRelative(actual, expected, tolerance, label) {
    const error = Math.abs(actual - expected) / Math.abs(expected);
    assert.ok(error <= tolerance, `${label}: ${actual} vs ${expected} (relative ${error.toExponential(2)} > ${tolerance})`);
}

async function runAll() {
    let failed = 0;
    for (const { name, fn } of registry) {
        try {
            await fn();
            console.log(`  ok    ${name}`);
        } catch (error) {
            failed++;
            console.log(`  FAIL  ${name}\n        ${String(error.message).split('\n').join('\n        ')}`);
        }
    }
    console.log(`\n${registry.length - failed} passed, ${failed} failed, ${registry.length} total`);
    return failed;
}

module.exports = { test, runAll, maxRelativeError, assertRelative, assert };
