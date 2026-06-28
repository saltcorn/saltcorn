---
name: tsc-build-dist-conflict
description: Spurious TS5055 "overwrite input file" after run-tests, fixed by cleaning dist
metadata:
  type: project
---

After `saltcorn run-tests <pkg>` compiles a package's `dist/`, a subsequent root `npm run tsc` (which uses `tsc --build` over the `tsconfig.ref.json` project-reference graph) can fail with many `TS5055: Cannot write file '.../dist/**/*.d.ts' because it would overwrite input file` errors. This is a build-state conflict between the two compile entry points, NOT a real type error.

**Why:** run-tests compiles dist in a way that the incremental `tsc --build` then treats the emitted `.d.ts` as inputs.

**How to apply:** Ignore it as a code signal. To get a clean build, delete the affected `dist/` dirs and stale `*.tsbuildinfo` first: `rm -rf packages/<pkg>/dist && find packages -maxdepth 2 -name '*.tsbuildinfo' -delete`, then `npm run tsc`. A clean `tsc --build` exiting 0 is the authoritative "compiles" check; test suites (which do their own clean compile) are authoritative for correctness. Relevant to [[esm-saltcorn-data-conversion]] and the common-code ESM conversion.
