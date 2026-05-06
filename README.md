# Dokkimi Demo SPA

A React single-page app that demonstrates Dokkimi's namespace routing, traffic
interception, and UI e2e testing. Use this repo as a working example of how to
write `.dokkimi/` test definitions for a browser-based application.

## Scenarios

Select a scenario from the top tabs.

### 1. Routing Test (`data-testid="tab-routing"`)

Enter a service name + endpoint, click submit, see the raw response headers and
body. Useful for smoke-verifying that requests from an embedded UI get the
`X-Dokkimi-Routed-Through-Namespace: true` header.

Key selectors: `routing-service-input`, `routing-endpoint-input`,
`routing-submit`, `routing-result`, `routing-status`, `routing-response-body`,
`routing-error`.

### 2. DB Query Harness (`data-testid="tab-db"`)

Drives a Postgres database through traffic-tester. Every button issues a
`POST /query` to traffic-tester with an embedded SQL command; traffic-tester
executes it and returns the rows, which the page renders.

This is the scenario the Dokkimi UI e2e tests drive (see
[`.dokkimi/demo-spa/`](.dokkimi/demo-spa/)).

Key selectors:

| Element                    | `data-testid`                                         |
| -------------------------- | ----------------------------------------------------- |
| Backend config disclosure  | `db-config-details`                                   |
| traffic-tester host input  | `db-traffic-tester-input`                             |
| postgres conn-string input | `db-pg-conn-input`                                    |
| "List Users" button        | `db-list-users`                                       |
| "List Posts" button        | `db-list-posts`                                       |
| Users list container       | `db-users-list`                                       |
| Posts list container       | `db-posts-list`                                       |
| Individual user name       | `db-user-name-${id}`                                  |
| Individual post title      | `db-post-title-${id}`                                 |
| Individual post row        | `db-post-row-${id}`                                   |
| "Create Post" title input  | `db-create-title`                                     |
| "Create Post" body input   | `db-create-body`                                      |
| "Create Post" submit       | `db-create-submit`                                    |
| Create success message     | `db-create-success` (carries `data-post-id`)          |
| Error by scope             | `db-error-users`, `db-error-posts`, `db-error-create` |

Defaults:

- traffic-tester host: `traffic-tester`
- postgres conn-string: `postgresql://dokkimi:dokkimi@postgres-db:5432/dokkimi`

Both match what the `.dokkimi/demo-spa/` fixture deploys, so the e2e tests run
without any config input. During standalone `yarn dev` you can override via
the disclosed inputs (or by setting `window.__DOKKIMI_TRAFFIC_TESTER_URL` /
`window.__DOKKIMI_PG_CONN` in `index.html`).

## Building

### Development (standalone)

```bash
yarn install
yarn dev
```

### Production Build

```bash
yarn build
```

### Docker Build

```bash
docker build -t demo-spa:latest .
```

## Running e2e in Dokkimi

Six UI e2e definitions live under
[`.dokkimi/demo-spa/definitions/`](.dokkimi/demo-spa/definitions/):

| File                       | What it covers                                                                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list-users-ui-e2e.yaml`   | Happy-path read. Switches tab, clicks List Users, extracts names, asserts the outbound `SELECT` reached traffic-tester.                                                                               |
| `create-post-ui-e2e.yaml`  | Full write path. Fills the form, submits, extracts the new post ID from the success message, and verifies the row via a DB query step.                                                                |
| `failure-ui-timeline.yaml` | Deliberate failure. Submits an empty title; asserts the validation error rendered and that no HTTP call left the browser. Populates the UI timeline's failed-sub-step rendering for `dokkimi inspect`. |
| `chain-ui-e2e.yaml`        | Chained backend calls. UI POSTs to traffic-tester, which forwards to downstream-svc, which queries postgres. Exercises inter-service traffic correlation.                                             |
| `parallel-ui-e2e.yaml`     | Parallel fan-out. A single click fires three concurrent fetch() calls, verifying the inter-service traffic shows exactly three independent POSTs.                                                     |
| `ui-substep-timeout.yaml`  | Per-sub-step `timeoutMs` overrides. Verifies the timeout plumbing works correctly for each UI action kind.                                                                                            |

Prerequisites:

1. Docker daemon running.
2. A Kubernetes cluster Dokkimi is pointed at (`dokkimi config`).
3. Built + pushed images:
   - `demo-spa:latest` (built from this repo)
   - `ghcr.io/dokkimi/traffic-tester:latest`
   - `ghcr.io/dokkimi/test-agent:latest`

Run one:

```bash
dokkimi run .dokkimi/demo-spa/definitions/list-users-ui-e2e.yaml
```

Or the whole set:

```bash
dokkimi run .dokkimi/demo-spa
```

After the run completes, inspect the correlated timeline:

```bash
dokkimi inspect
```

Drill in to the UI step and pick **"UI Timeline"** — you'll see each sub-step
(`visit`, `click`, `waitFor`, `extract`, `screenshot`) with the downstream HTTP
and DB events correlated by timestamp window.

## Validating the definitions

```bash
dokkimi validate .dokkimi/demo-spa
```

Checks all definitions against `@dokkimi/definition-validator`, including the
UI-action schema (sub-step kinds, extract sources, selector requirements).
