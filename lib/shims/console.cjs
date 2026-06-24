// Shim de Node 'console' para el bundle del navegador (lo requiere wollok-ts).
const c = globalThis.console;
module.exports = c;
module.exports.log = c.log.bind(c);
module.exports.warn = c.warn.bind(c);
module.exports.error = c.error.bind(c);
module.exports.assert = c.assert.bind(c);
