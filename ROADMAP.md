# ROADMAP.md — Three-Axis Improvement Plan

> **Status:** proposed · not started
> **Scope:** frontend · backend · database
> **Baseline:** `main` @ `f893d9b`, working tree has 47 modified + 2 untracked files (see Phase 1)
> **Related:** [`BUGS.md`](./BUGS.md) (round 1 — 33 findings, all fixed) · [`PROGRESS.md`](./PROGRESS.md) · [`project.md`](./project.md)

---

## How to read this document

Every finding below was **verified against the code**, not inferred. Claims carry `file:line`
references so they can be re-checked. Where a claim came from an automated tool, the command is shown.

Phase order is dependency-driven, not severity-driven. Phase 3 (re-audit) sits *before* the fix
phases on purpose — its findings fold into them rather than becoming a separate cleanup pass.

---

## Part 1 — New findings that change priority

### P0 — The installed Next.js is critically vulnerable

```
$ npm audit --audit-level=critical
```

| Package | Severity | Advisory | Range | Platform |
| --- | --- | --- | --- | --- |
| `next` 15.5.23 | **critical** | [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) — unauth RCE in Image Optimization API when AVIF files are used | `>=10.0.0 <15.5.24` | all |
| `next` 15.5.23 | **critical** | [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) — unauth RCE on Windows-hosted servers | `>=13.4.0 <15.5.24` | Windows |
| `proxy-addr` | **critical** | IP spoofing via IPv4-mapped IPv6 trust subnet | — | — |

**Total: 30 vulnerabilities (2 critical, 22 high, 6 moderate).**

High-severity set: `@modelcontextprotocol/sdk`, `@next/eslint-plugin-next`, `@prisma/config`,
`@ts-morph/common`, `axios`, `brace-expansion`, `braces`, `deepmerge-ts`, `eslint-config-next`,
`fast-glob`, `fast-uri`, `js-yaml`, `micromatch`, `nanoid`, `nodemailer`, `postcss`, `prisma`,
`shadcn`, `sharp`, `source-map-js`, `ts-morph`, `undici`.

**Fix for both Next.js criticals is a patch bump: `15.5.23` → `15.5.24`.**

### P0 — Zero tests, no test runner, no CI

```
$ ls -d __tests__ tests test e2e          # (no test dirs)
$ grep -c '"test"' package.json           # 0
$ ls -d .github .gitlab .circleci          # (no CI)
```

There is no test infrastructure of any kind. The only verification is 8 ad-hoc scripts in `scripts/`
(`audit-api.ts`, `e2e-auth.ts`, `ui-verify*.ts`, `backup.ts`, `generate-icons.ts`). `README.md`
claims "production-grade"; `project.md` requires "production-ready".

### P1 — `AGENTS.md` is stale and unfollowable

It instructs reading `node_modules/next/dist/docs/` and cites
`node_modules/next/dist/server/lib/generate-agent-files.js` as the verification source. **Neither
path exists** in this install (Next 15.5.23):

```
$ ls node_modules/next/dist/docs                    # No such file or directory
$ ls node_modules/next/dist/server/lib/generate-agent-files.js   # No such file or directory
```

The "This is NOT the Next.js you know" warning is therefore **unsubstantiated** for this install.
Do not chase it. `AGENTS.md` needs correcting.

### Verified clean

- No hardcoded secrets in tracked source (grepped for `sk_live`/`sk_test`/`password=`/`AKIA…`)
- `.env` is correctly gitignored and untracked

---

## Part 2 — Method: skill → workstream mapping

| Skill | Axis | What it contributes |
| --- | --- | --- |
| `security-reviewer` | all | CVSS-rated findings, `npm audit`, secrets scan, mandatory manual auth review |
| `test-master` | all | Test strategy — happy **and** error paths, no order-dependent tests, CI coverage gates |
| `sql-pro` | DB | Index rationale, aggregation over truncated scans, covering indexes |
| `api-designer` | BE | RFC 7807 errors, OpenAPI 3.1, pagination consistency, versioning |
| `nextjs-developer` | BE/FE | `not-found.tsx` / `global-error.tsx`, `next/image`, `next.config.ts` |
| `impeccable` | FE | **Operate mode** → `audit → harden → clarify → adapt → polish` |

`impeccable`'s own routing text classifies this project as **Operate**:

> *"The visitor completes a task. App UI, dashboards, editors, admin, settings, tools. Scanability,
> consistency, native expectations, and the real usage scene outrank expression. Brand lives in
> precise details."*

That is the target — not a bolder palette.

---

## Part 3 — Execution phases

### Phase 0 — Dependency security triage ✅ **COMPLETE**
**Axis:** BE/DB · **Completed 2026-10-08** · **Risk incurred: very low**

- [x] Bump `next` → `^15.5.27` (installed 15.5.27) — clears **both** critical Next.js RCEs
- [x] `npm audit fix` for non-breaking transitive fixes
- [x] Bump `nodemailer` `^9.0.5` → `^10.0.16` — clears **5** advisories (2 high DoS + 3 moderate).
      Our surface is only `createTransport()` + `sendMail()`, unchanged in v10. `tsc --noEmit` exit 0.
- [x] Move `shadcn` from `dependencies` → `devDependencies` — it is a **scaffolding CLI with zero
      runtime imports** (verified). This removed `proxy-addr` (critical), `@modelcontextprotocol/sdk`,
      `express`, `@ts-morph/*`, `braces`, `fast-glob`, `micromatch` from the production tree entirely.
- [x] `npm audit fix --force` **correctly avoided** — it downgrades `exceljs` 4→3 (breaking) to clear
      the `uuid` advisory. See accepted risks below.
- [x] Gates: `tsc --noEmit` exit 0 · `npm run lint` **0 errors / 12 pre-existing warnings** · `npm run build` success

**Result — all-deps audit: 30 → 16 findings; critical 2 → 0.**

| | before | after |
| --- | --- | --- |
| critical | 2 | **0** ✅ |
| high | 22 | 13 |
| moderate | 6 | 3 |
| **prod-only** | — | **0 critical, 0 high-exploitable** |

#### Accepted risks (documented, not fixed)

| Package | Sev | Why accepted |
| --- | --- | --- |
| `next` / `postcss` | moderate/high | Only fix is `next@16.4.0` — **semver-major**, deferred to a dedicated migration. `postcss` is build-time CSS processing, not request-path. |
| `prisma`, `@prisma/config`, `deepmerge-ts` | high | Build-time CLI only. Verified **zero** imports in our source. Fix would pin `prisma` *backwards* to 6.12.0. |
| `exceljs` → `uuid` | moderate | `uuid` is a build-time dep inside exceljs. Clearing it requires exceljs 3 (breaking). `exceljs` is imported at `services/reports.ts:1` for Excel export only. |
| `shadcn` + `@shadcn/registry` | high | Now `devDependencies`; not shipped to the server. Fix would downgrade to `shadcn@1.0.0` (major). |
| `eslint-config-next`, `@next/eslint-plugin-next` | high | Lint-time only. Fix would downgrade to 14.2.35 (major). |

**Verify:** `npm audit --audit-level=critical` → clean. Re-checked at Phase 9.

---

### Phase 1 — Land the uncommitted WIP
**Axis:** BE/DB · **Unblocks every later phase**

Working tree: 47 modified + 2 untracked (`lib/db/selects.ts`, `lib/html-escape.ts`). Adds
`hospitalId` to Doctor/Nurse/Room/Bed/Department, 9 new indexes, and required JWT secrets.
**No database has these indexes yet** — the `2026-08-09` backup predates them.

- [ ] `npx prisma db push`
- [ ] `npx tsc --noEmit` → `npm run lint` → `npm run build`
- [ ] **Restore HEAD's `lib/sequences.ts` doc comment.**
      The *algorithm* is unchanged (both versions iterate `load()` and take the numeric max; all 32
      call sites are unbounded — verified 0 use `take:`). But the new comment instructs future
      callers to pass `findMany({ take: 100 })`, which is precisely the bug HEAD's comment warned
      against (BUGS.md #29, "fixed" in `15c24e7`). Keep the code, restore the comment.
- [ ] README: JWT secrets are now **required**, no DB-derived fallback. This is a breaking boot-time change.

**Verify:** the 9 new indexes appear in `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma`
output (e.g. `[+] Index User_hospitalId_idx on ({"hospitalId":1})`).

---

### Phase 2 — Test & CI foundation
**Axis:** all · **Skill:** `test-master`

`test-master` mandates error-path coverage and forbids order-dependent tests.

- [ ] **Runner: Vitest** — native TS/ESM, no Next config needed (lighter than Jest for this stack)
- [ ] `MongoMemoryReplSet` is **already a devDependency** — reuse it; it is how `scripts/audit-api.ts` boots today. Replica set is **mandatory** (`$transaction`).
- [ ] `npm test`, `npm run test:watch`, coverage thresholds

First suites, highest-risk-first:

1. **Pure unit** — `nextSeq`, `escapeHtml`/`escapeHref`, `signHmac`, `hasPermission`/`can`,
   invoice math (discount / tax / cumulative refund cap), emergency triage sort order
2. **Service integration** (memory replica set) — `listMedicines` tenant scoping,
   `recordPayment` refund cap, `admit`/`transfer`/`discharge` bed invariants,
   `requirePermission` negative matrix
3. **API** — promote the existing 929-line `scripts/audit-api.ts` into real Vitest integration
   tests instead of a bespoke runner

- [ ] `.github/workflows/ci.yml`: lint → typecheck → test → build → `db:verify`. **First CI in the project.**

**Verify:** `npm test` green; a deliberate break fails the build.

---

### Phase 3 — Re-audit → `BUGS.md` round 2
**Axis:** all · **Must precede the fix phases**

Findings already confirmed during this read (all post-date round 1's 33):

| Sev | Finding | Location |
| --- | --- | --- |
| **P0** | `Patient.userId` unindexed **and not unique** — patient-portal auth is a full collection scan; two `Patient` rows can share one `User` | `prisma/schema.prisma` |
| **P0** | Tenant leak — 9 list functions return cross-hospital data | `master-data.ts` ×4, `pharmacy.ts` ×5 |
| **P0** | 2 critical Next.js RCEs | `package.json` |
| **P0** | Zero tests / no CI | repo-wide |
| **P1** | Drag-and-drop hardcodes `startTime: "09:00"` | `components/features/appointments/appointment-calendar.tsx:78` |
| **P1** | `STATUS_BADGE` light-only (`bg-amber-100` etc.) — invisible in dark mode | `appointment-calendar.tsx` |
| **P1** | 11 × `hsl(var(--…))` against OKLCH tokens → invalid CSS, charts unstyled | `dashboard-overview.tsx:225,228,235,252`; `analytics-page.tsx:61,114,131,167,207,224,241` |
| **P1** | Missing `not-found.tsx` + `global-error.tsx` (`project.md` requires "Error Pages") | `app/` |
| **P1** | `next.config.ts` empty — `X-Powered-By` leaks, no image config | `next.config.ts` |
| **P1** | 3 incompatible list response shapes; no OpenAPI spec; errors not RFC 7807 | `lib/http.ts`, all routes |
| **P2** | 19 inline `z.object` duplicate 6 of 14 `/validators` files | 14 components |
| **P2** | `setSessionCookies` dead code | `lib/auth/session.ts:39` (0 callers) |
| **P2** | local `esc()` duplicates `lib/html-escape.ts` | `app/api/prescriptions/verify/route.ts:11` |
| **P2** | `Phone` imported, never used | `constants/nav.ts` |
| **P2** | `.eyebrow` + `cn-toast` defined/referenced, zero consumers | `app/globals.css`, `components/ui/sonner.tsx` |

- [ ] Write `BUGS.md` round 2 with severities
- [ ] Fold P0/P1 fixes into Phases 4–8

---

### Phase 4 — Frontend
**Axis:** FE · **Skill:** `impeccable` (Operate mode)

Ordered as `impeccable` routes it: `audit` → fix defects → `harden` → `distill`/`adapt` → `clarify`/`optimize`.

#### 4a — `audit` (defects before aesthetics)

- [ ] Replace 11 `hsl(var(--…))` → `var(--…)`.
      Use `dashboard-overview.tsx:78`'s correct inline `oklch(...)` as the pattern.
- [ ] Delete duplicate `PageHeader` from `components/features/users/users-page.tsx:111-248`;
      keep the one in `app/(dashboard)/users/page.tsx:14` (matches how `/dashboard` and `/profile`
      are correctly structured — feature components contain no header)
- [ ] `STATUS_BADGE` → semantic tokens with dark variants
- [ ] `settings-page.tsx:135` `<img>` → `next/image`.
      *(The other two `<img>` are data-URI QR inside `document.write` print HTML — correctly not `next/image` candidates.)*

#### 4b — Design-system coherence: kill the teal→indigo split

8 files still carry `#0E7C6B` ×15 and `#0f172a` ×14 plus slate-500-era hexes (`#e2e8f0` ×24).
`/analytics` was skipped **entirely** by redesign commit `f893d9b`.

- [ ] `components/features/analytics/analytics-page.tsx` (full teal palette)
- [ ] `components/features/auth/auth-shell.tsx` hero `#12141D`
- [ ] `app/icon.svg`, `app/manifest.ts` colors
- [ ] 7 print/PDF templates (`.head{background:#0E7C6B}`, `.mono`, `.link`)
- [ ] Move all to the OKLCH token set in `app/globals.css`

#### 4c — `harden`

- [ ] Add `app/not-found.tsx`, `app/global-error.tsx`
- [ ] `next.config.ts`: `poweredByHeader: false`, `images` config
- [ ] Replace 14 bare `confirm()` calls across 12 files with an `AlertDialog` primitive
      (unstyled, blocks the event loop, untestable, breaks the design language)

#### 4d — `distill` + `adapt`

- [ ] Collapse the **two parallel table systems** — TanStack `DataTable` (used by 4 of 31 pages)
      vs 27 hand-rolled tables. Migrate to one.
- [ ] Extract one `<NavItems>` shared by `sidebar.tsx` + `mobile-nav.tsx` (currently duplicated
      with divergent classes and missing badges)
- [ ] 9 dead shadcn primitives — wire up `calendar` (replace native `<Input type="date">`) or delete
- [ ] Unify 3 tab idioms: view-switcher / status-filter / hand-rolled chip row

#### 4e — `clarify` + `optimize`

- [ ] 19 inline Zod schemas → import from `/validators`
- [ ] Consolidate mutation strategy: `refetch()` ×41, `invalidateQueries` ×27, `useMutation` ×14
      → one `useMutation` + `invalidateQueries`
- [ ] Query-key factory for the ~68 ad-hoc keys; add `placeholderData: keepPreviousData`
- [ ] Debounce `global-search.tsx` (fires per keystroke past 2 chars, unlike `DataTable`'s 300 ms)
- [ ] Route 3 `escapeHtml` implementations to `lib/html-escape.ts`
- [ ] Delete `.eyebrow`, `cn-toast`, and 5 unused `public/` boilerplate SVGs
      (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`)

---

### Phase 5 — Backend / API
**Axis:** BE · **Skills:** `api-designer`, `nextjs-developer`

#### 5a — Errors → RFC 7807

`lib/http.ts` `fail()` returns `{success:false, error, details}`. Adopt
`application/problem+json` with stable `type` URIs and an `errors[]` field map. One file — all
176 handlers inherit it.

#### 5b — One response shape for lists

Currently three: `{items, meta:{page,pageSize,total,totalPages}}`, `{items}`,
`{items,total,unread}`. `api-designer` requires pagination on **all** collections; most lists are
unpaginated `findMany` with an implicit 100/500 cap.

#### 5c — Fix polymorphic PATCH bodies

`admissions/[id]` (transfer/discharge), `appointments/[id]` (status/reschedule),
`lab-orders/[id]`, `radiology-orders/[id]` branch on body shape instead of distinct resources.
Two of them validate status against hardcoded arrays instead of a Zod validator.

#### 5d — Collapse 4 authorization sources into 1

`constants/nav.ts` · `middleware.ts ROUTE_ROLES` · `lib/auth/can.ts` · `user-menu.tsx SETTINGS_ROLES`.
DB permissions are the only **enforced** set; the other three already drifted (BUGS.md #15).
Generate nav + middleware tables **from** `constants/permissions.ts`.

#### 5e — `nextjs-developer` conformance

- [ ] Error boundaries (with 4c)
- [ ] `generateMetadata` for the 31 pages that lack it
- [ ] Server Actions where `actions/` was intended

#### 5f — Rate limiting

`lib/rate-limit.ts` is an in-process `Map` — ineffective on serverless/multi-instance. Move to a
shared store or document the single-instance constraint.
Also: `middleware.ts`'s role gate is **skipped** for refresh-token-only sessions.

#### 5g — OpenAPI

Generate `openapi.yaml` from the Zod validators + `lib/http.ts`; lint with
`npx @redocly/cli lint openapi.yaml`.

---

### Phase 6 — Database & multi-tenancy
**Axis:** DB · **Skill:** `sql-pro`, adapted to MongoDB

#### 6a — Tenant-scope the 9 leaking functions

Add `actor: Actor` + `if (actor.hospitalId) where.hospitalId = actor.hospitalId`, copying the proven
pattern at `services/clinical.ts:28`, `services/records.ts:12`, `services/inventory.ts:32`.

| File | Function | Line |
| --- | --- | --- |
| `services/master-data.ts` | `listDepartments(search)` | 20 |
| `services/master-data.ts` | `listDoctors(search)` | 92 |
| `services/master-data.ts` | `listNurses(search)` | 187 |
| `services/master-data.ts` | `listRooms(search)` | 247 |
| `services/pharmacy.ts` | `listMedicines(filters)` | 34 |
| `services/pharmacy.ts` | `listSuppliers(activeOnly)` | 78 |
| `services/pharmacy.ts` | `listPurchaseOrders(filters)` | 96 |
| `services/pharmacy.ts` | `listStockTransactions(filters)` | 206 |
| `services/pharmacy.ts` | `listSales(filters)` | 268 |

Then thread the actor through their route callers (2 services + ~6 routes).
Verify with the Phase 2 API tests.

#### 6b — Composite unique constraints

Convert to `(hospitalId, x)`: `Medicine.name` · `Department.name` · `Department.code` ·
`LabTest.name` · `LabTest.code` · `Room.number` · `Bed.number` · `Supplier.name` ·
`InsuranceCompany.name` · `InsuranceCompany.code` · `MedicalEquipment.code` ·
`Employee.employeeNo` · `Patient.patientNo`.
(`Hospital.slug` stays global — it is the tenant key.)

> ⚠️ Must **drop the single-field unique index before creating the compound one**.
> Single-hospital demo data → no collisions expected.

#### 6c — Add the 37 missing FK indexes

`sql-pro`: index every FK you filter or join by. Priority order:

`AuditLog.userId` · `Patient.userId` (+ `@unique`) · `EmergencyCase.patientId` ·
`EmergencyCase.assignedDoctorId` · `Bed.roomId` · `Bed.patientId` · `Bed.currentAdmissionId` ·
`Admission.bedId` · `Admission.doctorId` · `Invoice.admissionId` · `Invoice.appointmentId` ·
`Invoice.consultationId` · `Invoice.insurancePolicyId` · `Invoice.issuedById` ·
`Prescription.consultationId` · `Prescription.appointmentId` · `Payment.refundOfId` ·
`Payment.receivedById` · HR `*ById` set (`Attendance.recordedById`, `Leave.approverId`,
`Payroll.paidById`, `PerformanceReview.reviewerId`) · `Supplier.supplierId` (equipment + POs) ·
`Appointment.departmentId` · `MedicalRecord.doctorId` · `LabOrder.doctorId` ·
`RadiologyOrder.doctorId` · `Department.headDoctorId` · tenant `hospitalId` indexes on remaining models

#### 6d — Aggregation discipline

Round-1 bug #20 was reports summing a truncated 500-row subset — fixed with aggregation. Apply the
same rule to every new query: **never sum a `findMany` page.** MongoDB has no FK, so
`onDelete: Cascade` is advisory only and never enforced by the database.

#### 6e — `RefreshToken` TTL + rotation index

- [ ] TTL index on `expiresAt` — expired tokens accumulate forever (confirmed absent from the
      backup's index metadata)
- [ ] Index `replacedByToken` — token-replacement-chain revocation currently walks unindexed

#### 6f — 13 JSON-in-String columns

`LabOrder.tests`/`.results`, `Prescription.items`, `Consultation.vitals`,
`RadiologyOrder.reports`, `PurchaseOrder.items`, `MedicineSale.items`, `AuditLog.meta`,
`EmergencyCase.vitals`, `MedicalRecord.files`, `Patient.documents`, `Doctor.schedule`.
Unqueryable and unindexable. At minimum: validate shapes at the DB boundary, and add coverage for
lab results (abnormal-value queries).

> **Documented limitation, not fixed in this plan:** `nextSeq` generators are **global**, so
> `PT-0001` does not restart per hospital. Per-tenant sequencing is a separate refactor; cosmetic
> with one hospital.

---

### Phase 7 — Boundary closure
**Axis:** BE · **Scope: pragmatic (no new repository layer)**

`services/` already acts as the domain layer — 82 of 90 routes call it, only 32 reach for Prisma
directly. Decision: close the gap, don't add a layer.

- [ ] Delete the 5 empty dirs `actions/` `hooks/` `types/` `utils/` `repositories/`
      — **verified 0 files tracked by git**, so zero-risk local cleanup.
      Also drop the stale `"hooks": "@/hooks"` alias from `components.json`
- [ ] Delete `setSessionCookies` (dead code, 0 callers)
- [ ] Route 3 `escapeHtml` implementations to `lib/html-escape.ts`
- [ ] **Decide per function, do not blanket-delete.** The dead `listPatients` /
      `listAppointments` / `listDepartments` / `listDoctors` / `listNurses` / `listRooms` get
      **wired up** by Phase 6a / 7b rather than deleted
- [ ] Move the ~18 read-heavy detail GETs out of the 32 routes importing `db` directly:
      `patients/[id]` · `appointments/[id]` · `rooms/[id]` · `departments/[id]` · `doctors/[id]` ·
      `nurses/[id]` · `lab-orders/[id]` · `radiology-orders/[id]` · `medicines/[id]` ·
      `purchase-orders/[id]` · `equipment/[id]` · `hr/employees/[id]` · `hr/leaves/[id]` ·
      `billing/claims/[id]` · `billing/companies/[id]` · `notifications/[id]` ·
      `prescriptions/[id]` · `beds/[bedId]`
- [ ] Fix `AGENTS.md` (stale file references — see Part 1)

---

### Phase 8 — Drift gate
**Axis:** DB · **Replaces the "migrations baseline" workstream**

**SQL migrations are impossible on MongoDB.** Verified:

```
$ npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
Error: Rendering to a script is not supported on MongoDB.
```

There is no `prisma/migrations/` and there never can be. The real risk is **index drift**, which
already bit this project — the `2026-08-09` backup is missing 9 indexes that exist in the schema.

The datamodel diff (without `--script`) **does** work on MongoDB and emits index-level detail:

```
[+] Unique index `Hospital_slug_key` on ({"slug":1})
[+] Index `User_hospitalId_idx` on ({"hospitalId":1})
```

- [ ] `scripts/check-schema-drift.ts` — run
      `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma`;
      non-empty output = database has drifted from the committed schema → `exit 1`
- [ ] `npm run db:verify`
- [ ] Wire into Phase 2's CI
- [ ] README: the setup step becomes `db:push && db:verify`, plus the replica-set requirement

**Verify:** before Phase 1's `db push`, the 9 new indexes must report as missing.

---

### Phase 9 — Gates & documentation

- [ ] After **every** phase: `npx tsc --noEmit` · `npm run lint` · `npm run test` · `npm run build`
- [ ] Update `BUGS.md` (round 2 results)
- [ ] Update `README.md` (JWT secret requirement, `db:verify`, replica set)
- [ ] Update `PROGRESS.md` — **it has no entry for redesign commit `f893d9b`**, which is precisely
      why the teal residue survived three commits
- [ ] Correct `AGENTS.md`
- [ ] Commit per phase in the existing `type(scope): summary` style

---

## Part 4 — Open questions

1. **Phase 4d (table consolidation)** is the largest frontend item — migrating 27 hand-rolled tables
   to `DataTable` is a big diff. Include it, or stop at fixing `DataTable`'s known gaps and leave
   the tables alone?
2. **Phase 6b** touches unique indexes on a live Atlas database. Add a `--dry-run` index-check
   step first, or proceed and rely on `npm run db:backup`?

---

## Part 5 — Verification commands

```bash
# per-phase gates
npx tsc --noEmit                 # typecheck
npm run lint                     # eslint
npm run test                     # vitest (after Phase 2)
npm run build                    # production build
npm run db:verify                # schema drift gate (after Phase 8)

# targeted checks
npm audit --audit-level=critical # expect 0 after Phase 0
npx prisma validate              # schema sanity
npx tsx scripts/audit-api.ts     # RBAC negative matrix (needs a prior build)
```

---

## Part 6 — Project conventions

- **Working directory has a trailing space** after the folder name. Quote it:
  `cd "/.../Hospital Managment System "`. The `workdir` tool param trims the space — do not rely
  on it for this directory.
- **MongoDB must be a replica set** (Atlas, or `mongodb-memory-server` for dev/tests). The app uses
  Prisma `$transaction` in billing, pharmacy, admissions, HR, and master-data. A standalone
  `mongod` crashes on those operations.
- **Branch:** `main`.
- Schema evolves via `prisma db push` only — no migrations (see Phase 8).