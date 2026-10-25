'use strict';
const fs = require('fs');
const path = require('path');
const { runAll } = require('./lib/harness');

for (const file of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) {
    console.log(file);
    require(path.join(__dirname, file));
}

runAll().then(failed => { process.exitCode = failed ? 1 : 0; });
