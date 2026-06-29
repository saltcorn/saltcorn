#!/usr/bin/env node
// Required via NODE_OPTIONS=--require .../trc-stack-hook.js
// Intercepts ts-runtime-checks Error throws and logs the full stack to stdout
// so the source file and line number are visible even when the test runner
// only re-prints error.message.
"use strict";

const OrigError = global.Error;

function TrcError(msg) {
  const err = new OrigError(msg);
  if (typeof msg === "string" && msg.startsWith("Expected ")) {
    console.log("[trc] " + (err.stack || msg));
  }
  return err;
}
TrcError.prototype = OrigError.prototype;
TrcError.captureStackTrace = OrigError.captureStackTrace;
TrcError.stackTraceLimit = OrigError.stackTraceLimit;

global.Error = TrcError;
