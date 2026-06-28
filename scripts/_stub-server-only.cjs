// Test-only: neutralize the `server-only` guard so server modules can be
// exercised under tsx/node in standalone scripts. Never imported by app code.
const Module = require("module")
const origResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  if (request === "server-only" || request === "client-only") {
    return require.resolve("./_noop.cjs")
  }
  return origResolve.call(this, request, ...args)
}
