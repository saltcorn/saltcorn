# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Saltcorn is an extensible open-source no-code database application builder. This monorepo contains the core platform: web server, CLI, data layer, plugin system, visual builders, and mobile app tooling. It uses **npm workspaces** with all packages under `packages/`.

## Common Commands

### Install & Build
```bash
npm install --legacy-peer-deps
npm run tsc                    # TypeScript compilation (required after changes to .ts files)
```

### Development Server
```bash
saltcorn dev:serve             # Auto-restarts on file changes, rebuilds TypeScript and React/Svelte bundles
saltcorn dev:build             # Build optimized bundles for builder/filemanager/workflow-editor (before PRs)
saltcorn dev:build builder     # Build only a specific component
```

### Running Tests
```bash
saltcorn run-tests                        # Run all tests (resets schema, loads fixtures first)
saltcorn run-tests saltcorn-data          # Run tests for a specific package (matches packages/ dir name)
saltcorn run-tests server                 # Server route tests
saltcorn run-tests saltcorn-data -t 'Table' # Run tests matching a name pattern
saltcorn run-tests saltcorn-data -c       # With coverage
```
Valid package names: `saltcorn-data`, `server`, `saltcorn-markup`, `saltcorn-builder`, `saltcorn-sbadmin2`, `common-code`, `view-queries`

Do not run tests by running jest directly. Always use `saltcorn run-tests [package-name]`. Never run tests by running node, calling the jest file. When you run tests, you MUST use `saltcorn run-tests`.

the `saltcorn` command is in $PATH, so there is no need to use npx to run this. Just run 
`saltcorn [subcommand]`

### Linting & Formatting
```bash
npm run lint                   # ESLint
npm run lint:fix               # ESLint with auto-fix
# Prettier (run before PRs):
git ls-files | grep -v builder_bundle | xargs prettier --write
```

## Architecture

### Package Dependency Layers (bottom to top)

```
@saltcorn/types          - TypeScript interfaces and abstract model definitions
@saltcorn/db-common      - Database abstraction (Where clauses, SQL builders, tenant mgmt)
@saltcorn/postgres       - PostgreSQL driver (pg, connection pooling, schema-per-tenant)
@saltcorn/sqlite         - SQLite driver
@saltcorn/plain-date     - Date handling
@saltcorn/common-code    - Shared relation-finding logic
@saltcorn/markup         - HTML tag builders, form/table/layout rendering (TypeScript)
@saltcorn/data           - Core models and business logic (Table, Field, View, Page, etc.)
@saltcorn/admin-models   - Tenant, Backup, Snapshot models
@saltcorn/plugins-loader - Plugin installation (npm/git/local) and loading
@saltcorn/base-plugin    - Built-in view templates (list, show, edit, feed, filter, room) and field types
@saltcorn/server         - Express HTTP server, routes, middleware, auth
@saltcorn/cli            - oclif-based CLI commands
```

### Key Concepts

**Database abstraction**: At startup, `saltcorn-data/db/index.ts` dynamically selects PostgreSQL or SQLite based on environment (`PGHOST` → Postgres, `SQLITE_FILEPATH` → SQLite). Both implement the same `DbExportsType` interface from `db-common`. Multi-tenancy uses PostgreSQL schema isolation.

**State system**: `saltcorn-data/db/state.ts` maintains an in-memory cache of all Tables, Views, Pages, Fields, Plugins, Types, ViewTemplates, Actions, and configuration. Access via `getState()` (current tenant) or `getRootState()`.

**Plugin system**: Plugins export an object with: `sc_plugin_api_version`, `types` (field types), `viewtemplates`, `actions`, `fieldviews`, `headers` (CSS/JS), `routes`, `layoutComponents`. The base plugin (`saltcorn-data/base-plugin/`) provides all built-in functionality.

**View rendering flow**: Route (`server/routes/view.js`) → loads View from DB → checks `min_role` auth → calls `view.run(state, query, user)` → view template (from plugin) renders data using Table/Field models → returns HTML via markup layer.

**Layout JSON**: Pages and views store layout as nested JSON (`{ above: [...], besides: [...] }`). The builder generates this; the markup layer renders it.

### UI Component Packages

| Package | Framework | Build Tool |
|---------|-----------|------------|
| `saltcorn-builder` | React + Craft.js | Webpack |
| `workflow-editor` | React + @xyflow/react | Webpack |
| `filemanager` | Svelte | Rollup |

### Core Models (`packages/saltcorn-data/models/`)

- **Table** - Schema management, CRUD operations, CSV import/export, triggers, constraints
- **Field** - Column definitions, type system, validation, calculated/stored expressions
- **View** - Configuration-driven data rendering using view templates from plugins
- **Page** - Layout-based pages that can embed views
- **Trigger** - Event-driven actions (insert/update/delete/user events)
- **User** - Auth, roles, 2FA, API tokens
- **Workflow/WorkflowRun/WorkflowStep** - Multi-step automation state machines
- **Expression** - JavaScript expression evaluation for calculated fields, filters, conditions
- **File** - File storage (local or S3)
- **Plugin** - Plugin metadata and lifecycle

### Server Routes (`packages/server/routes/`)

Main routes: `admin.js`, `tables.js`, `fields.js`, `viewedit.js`, `pageedit.js`, `plugins.js`, `view.js`, `page.js`, `api.js`, `scapi.js`

### Testing Details

- **saltcorn-data tests** (`packages/saltcorn-data/tests/`): TypeScript, use ts-jest, run with `--runInBand`
- **server tests** (`packages/server/tests/`): JavaScript, use supertest for HTTP assertions
- Test helpers: `packages/server/auth/testhelp.js` (login cookies, assertions), `packages/saltcorn-data/tests/mocks.ts`
- Tests reset the DB schema and load fixtures before running (`db/reset_schema`, `db/fixtures`)
- CI runs tests against both PostgreSQL and SQLite
- `run-tests` compiles TypeScript first, then resets schema/fixtures, then runs jest

### Environment Variables for Testing

```
PGHOST, PGUSER, PGDATABASE, PGPASSWORD  # PostgreSQL connection
SQLITE_FILEPATH                          # Use SQLite instead of Postgres
SALTCORN_SESSION_SECRET                  # Required for sessions
SALTCORN_JWT_SECRET                      # Required for JWT auth
SALTCORN_MULTI_TENANT=true               # Enable multi-tenant mode
```

### Migrations

Located in `packages/saltcorn-data/migrations/`, named by timestamp (e.g., `202005141503.js`). Run sequentially on startup. Applied per-tenant in multi-tenant setups.

### Roles and ownership

Each user in saltcorn had a role set by the user's role_id 1-100. Lower roles are more powerful with 1 being the admin role 
and 100 being the role of unauthenticated user (public). Tables, views and pages have a "minimal role" to access/read/write 1-100 and the user's 
role_id has to be less than or this minimal role to access.

Tables can have ownership by field (key to user) or formula. If this is satisfied, the user can access the row even if they do not meet the minimal 
role to read or write. But if they do meet the minimal role criteria for the table as a whole, they can access all rows. Therefore a user who has a role_id less than or equal to the minimum role to read (or write) can read (or write, respectively) all roles even if ownership is set. Ownership only determines access for users with a role_id greater than the minumum role to read (or write).

### Looking for vulnerabilities

A saltcorn server with a test application may be running locally at:

URL: http://example.com:3000/auth/login
Login (role user): user@foo.com
Password: GFeggwrwq45fjn

you can login at http://example.com:3000/auth/login

The saltcorn config file is located at /home/tomn/.config/.saltcorn - this has database access credentials if you need them.

The server has a cache of metadata, such as tables, fields and views. To reload it send the SIGHUP signal to the saltcorn process.

The application build consists of the fixtures as defined in packages/saltcorn-data/db/fixtures.ts

you can use this to test any vunerability

If you find a vulnerability, you should write a test that asserts that the 
vulnerability is not present. That is, if the system is currently vulnerable, you should 
write a test that fails, so it will only pass when the vulnerability is later fixed. Do not try to fix the vulnerability, unless you are explicitly asked to.

This test can be added in two different places, depending on whether a python or a JavaScript test is most suited. 

The python security tests are in the folder infosec-scan/py-sectest. They use the class SaltcornSession from scsession.py to make sure a server is running.

The Javascript tests for the server code are in packages/server/tests. They use the supertest framework to run the application.

A JavaScript test is preferred if this is simple; only use a Python test if it is simpler than the Javascript test
