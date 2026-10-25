/**
 * Loads the app's classic <script> files into one vm context, in index.html order,
 * so the engines can be tested in Node without a browser.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_FILES = [
    'js/models.js',
    'js/eleveld-pk-pd.js',
    'js/integrator.js',
    'js/pk-engine-base.js',
    'js/induction-engine.js',
    'js/protocol-engine.js',
    'js/advanced-protocol-engine.js',
    'js/monitoring-engine.js'
];

/** @param {{root?: string, files?: string[]}} options root: repo (or snapshot) directory to load from */
function loadApp({ root = ROOT, files = DEFAULT_FILES } = {}) {
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {}, info() {} },
        Math, Date, window: {},
        setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 1; }, clearTimeout() {}
    });
    for (const file of files) {
        const full = path.join(root, file);
        if (!fs.existsSync(full)) continue;
        vm.runInContext(fs.readFileSync(full, 'utf8'), context, { filename: file });
    }
    // top-level class declarations live in the context's lexical scope, not on the global
    const get = (name) => vm.runInContext(name, context);
    return { context, get, run: (code) => vm.runInContext(code, context) };
}

module.exports = { loadApp, ROOT };
