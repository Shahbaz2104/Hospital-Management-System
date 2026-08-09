# BUGS.md — Consolidated Bug Report & Execution Plan

> Full read-through of the project: all API routes, services, validators, feature components, prisma schema, seed, auth, and middleware.
> Status: **complete** — all 33 findings fixed and pushed (P0 batch `890f75a`, P1 batch `853ba0d` + `4f391a5`, P2 batch `15c24e7`).

## P0 — Security / data-integrity (fix first)

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| 1 | **JWT secret mismatch** — middleware verifies with `process.env.JWT_ACCESS_SECRET ?? ""` but app uses derived secret (`lib/env.ts:60-65`). Role gate + login redirect dead when secret not explicitly set | `middleware.ts:54` | Role gate & login redirects silently disabled; inconsistent authz |
| 2 | **Patient IDOR** — `patients:read`/`records:read`/`appointments:read` routes never scope to actor; any patient reads all patients/records/appointments | `app/api/patients/*`, `records/*`, `appointments/*` | Patient privacy hole |
| 3 | **Privilege escalation** — HOSPITAL_ADMIN can create SUPER_ADMIN; weaker password policy (`min(8)` vs regex) | `app/api/users/route.ts` | Account takeover |
| 4 | **Reset token leaked to logs** — condition inverted; logs full reset URL when email IS delivered (prod) | `app/api/auth/forgot-password/route.ts:27-29` | Account takeover via logs |
| 5 | **SMTP password returned to client + stored plaintext** | `services/settings.ts:54-61,104` | Credential leak |
| 6 | **Open redirect** via unvalidated `?from=` (accepts absolute URLs) | `login-form.tsx:41` | Phishing |
| 7 | **Over-refund** — partial refunds compare vs original amount; $100 can be refunded $200 total | `services/billing.ts:296-341` | Money loss |
| 8 | **Lost-update races** — `recordPayment`, pharmacy stock decrement read outside transaction | `billing.ts:253-294`, `pharmacy.ts:356-417` | Money/stock drift |
| 9 | **`$transaction` fails on standalone MongoDB** (replica set required) — billing, pharmacy, admissions, HR, master-data all use them | `services/*` (11 call sites) | Runtime crash on local Mongo (Atlas is fine) |
| 10 | **Password reset twice → 500** (unique constraint P2002, not upsert) | `services/auth.ts:103-112` | 500 on forgot-password repeat |

## P1 — Functional bugs users hit

| # | Bug | Location |
|---|-----|----------|
| 11 | **Emergency triage sorts alphabetically** (`YELLOW > RED`) — wrong ER priority | `services/emergency.ts:45-48` |
| 12 | **Admissions status filter ignored** (query param dropped) | `app/api/admissions/route.ts:7-11` |
| 13 | **OPD print-slip crashes** — `date + "T00:00:00"` on already-ISO date → Invalid Date → blank popup | `opd-queue.tsx:115` |
| 14 | **Notification spam** — mark-all-read → alerts recreated + appointment **email every 30s** while page open | `services/notifications.ts:52-64`, bell/pages poll |
| 15 | **Nav ↔ middleware ↔ permission mismatches** — PATIENT blocked from own patients/appointments/records by middleware; Emergency hidden from DOCTOR; NURSE 403 on Rooms/Nurses; ACCOUNTANT 403 on Payroll; LAB_TECHNICIAN 403 on Radiology | `constants/nav.ts`, `middleware.ts`, `constants/permissions.ts` |
| 16 | **req.json() w/o catch → 500 instead of 400** (17+ routes) | billing/pharmacy/hr/emergency/users |
| 17 | **Audit-log page 500 on one malformed `meta`** | `app/api/audit-logs/route.ts:41` |
| 18 | **Duplicate audit entries** (route + service both log) — all create routes | many files |
| 19 | **Seed attendance loop is infinite-ish** — ~180 rows all for 1 employee; re-seed crashes (P2002) | `prisma/seed.ts:502-524` |
| 20 | **Reports totals use truncated 500-row subset** (gender/revenue sums wrong) | `services/reports.ts:47-111` — **FIXED** `4f391a5` (aggregate queries) |
| 21 | **Unawaited `logAudit`** (fire-and-forget) can drop audit rows in serverless | settings/prescriptions/pharmacy/billing — **FIXED** `4f391a5` (all `await`ed) |
| 22 | **Calendar pageSize 500 clamped to 100** — month view silently incomplete | `lib/pagination.ts` vs appointments-page |
| 23 | **Insurance policy auto-number never persisted to patient** (`undefined` write) | `services/billing.ts:427-459` |
| 24 | **Departments PATCH validates `code` but never saves it** | `services/master-data.ts:69-76` |
| 25 | **Lab results accept tests not on the order** | `services/diagnostics.ts:155-187` |
| 26 | **Global search leaks PII to every role** (incl. PATIENT) + unbounded `limit` | `app/api/search/route.ts`, `services/search.ts` |

## P2 — Cleanup / edge cases

| # | Bug | Location |
|---|-----|----------|
| 27 | **QR "verification" forgeable** (no signature); verify endpoint 401'd by middleware (not public as designed); HTML unescaped | `services/prescriptions.ts:224-228`, `app/api/prescriptions/verify/route.ts` — **FIXED** `15c24e7` (HMAC-signed QR `s`, verified on check, page escaped, middleware exempt) |
| 28 | **Multi-tenant: settings/HR target first hospital**, lists ignore `hospitalId` | `services/settings.ts:32,72,97,112`, list routes — **FIXED** `15c24e7` (settings + HR resolve hospital from `actor.hospitalId`) |
| 29 | **Sequence counters break past 9999** (string compare) — all `nextXxx()` helpers | 12+ services — **FIXED** `15c24e7` (`lib/sequences.ts` numeric max; 20 call sites) |
| 30 | **Null-role crash** — `user.role.rolePermissions` deref without check | `session.ts:77`, `auth.ts:24` — **FIXED** `15c24e7` (empty permissions + UNASSIGNED role name) |
| 31 | **`listMedicines` ignores `status` filter** | `services/pharmacy.ts:54-69` — resolved: `Medicine` has no `status` field (only `active`); the `15c24e7` "fix" added a `where.status` that would 500 on Prisma unknown-arg, removed and dead param dropped from route+service (no UI uses it) |
| 32 | **DATABASE_URL normalize edge** (trailing path) | `lib/env.ts:34-39` — **FIXED** `15c24e7` (strip trailing slash, test trimmed base) |
| 33 | Minor: missing GET handlers, user-menu shows Settings for all roles, roles/permissions catalog exposed to patients, dangling hospital ref, login doesn't revoke old refresh tokens | misc — **FIXED** `15c24e7` (9 detail GETs added; user-menu Settings gated to SUPER_ADMIN/HOSPITAL_ADMIN; roles/permissions routes guarded `users:read`; `issueSession` revokes prior refresh tokens) |

## Verified OK (not bugs)
- All mutating routes guarded; notifications scoped to user; date handling consistent; typecheck/lint/build green.

---

# Execution Plan

## Phase 0 — Documentation (this file + PROGRESS.md updated)

## Phase 1 — P0 fixes (commit batch 1)
1. JWT secret — single shared secret helper module, imported by middleware + app; verify middleware role gate locally
2. Patient IDOR — scope patients/records/appointments/consultations queries to actor when `roleName === "PATIENT"`; staff keep hospital-wide view
3. Privilege escalation — block SUPER_ADMIN creation from `users` route (only in seed); align password regex with auth route
4. Reset-token log leak — fix inverted condition in forgot-password
5. SMTP password — mask on read; investigate env-based override for plaintext storage
6. Open redirect — validate `?from=` is same-origin relative path in login-form
7. Over-refund — track cumulative refunds per payment; cap at paid amount
8. Races — move stock/recordPayment read-modify-write inside transactions
9. Reset twice → 500 — upsert in `services/auth.ts`
10. Transactions on standalone Mongo — document requirement; confirm prod (Atlas) unaffected

## Phase 2 — P1 fixes (commit batch 2)
11. Triage severity ordering
12. Admissions filter
13. OPD print-slip date
14. Notification dedupe + email suppression
15. Nav/middleware/permissions alignment
16. `req.json().catch()` → 400
17. Audit-meta JSON guard
18. Dedupe audit logs
19. Seed attendance fix
20. Reports via aggregation
21. `await logAudit`
22. Calendar cap raise
23. Insurance number persist
24. Dept code write
25. Lab test validation
26. Search scoping + limit cap

## Phase 3 — Verify + deploy
- `npx tsc --noEmit`, lint, `npm run build`
- Browser smoke-test: login → booking → billing → notifications → OPD print → emergency queue

## Phase 4 — P2 fixes (commit batch 3, then final verify + push)
27. QR signature + middleware exemption — ✅ `15c24e7`
28. Hospital scoping — ✅ `15c24e7`
29. Sequence counters — ✅ `15c24e7`
30. Null-role guard — ✅ `15c24e7`
31. Status filter — ✅ `15c24e7`
32. Env edge — ✅ `15c24e7`
33. Misc — ✅ `15c24e7`

Each batch = one commit + push (auto-deploys to Vercel). All batches pushed: `890f75a` (P0), `853ba0d` (P1), `4f391a5` (P1 follow-up), `15c24e7` (P2).
