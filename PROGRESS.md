# HMS Build Progress Log

> Running log for building the Hospital Management System.
> Every phase, decision, command, and verification is recorded here in chronological order.

**Project root:** `/home/shahbaz/Desktop/Pojects to upload to github/Hospital Managment System `
**Base spec:** `project.md` (1008-line master prompt)
**Updated:** continuously during the build

---

## Phase Status Overview

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 0 | Scaffolding, deps, folder structure, base layout | DONE |
| 1 | Auth, Users, RBAC, Security, Audit Logs | DONE |
| 2 | Master data (Departments, Doctors, Nurses, Rooms/Beds) | DONE |
| 3 | Patients & Appointments (OPD/IPD) | DONE (incl. consultations, live bed dashboard) |
| 4 | Laboratory & Radiology | DONE (orders, catalog, results, reports, printable output) |
| 5 | Pharmacy & Inventory | DONE (medicines, dispensing, purchase orders, stock ledger, equipment, suppliers) |
| 6 | Billing, Payments, Insurance | DONE |
| 7 | HR & Payroll | DONE (employees, attendance, leaves, reviews, payroll runs + payslip PDF, staff roster) |
| 8 | Reports, Analytics, Notifications | DONE (7 report types + PDF/Excel/print, analytics charts, Notification model + bell + page, lazy alerts + SMTP email) |
| 9 | Emergency, Global Search, Settings | DONE (triage queue + ambulance + timeline, standalone prescriptions w/ PDF+QR verify, medical records, settings page, unified search) |
| 10 | Polish: PWA, a11y, perf, seed, final gates | PENDING |

### Global gates (all phases)
- `npm run typecheck` (`tsc --noEmit`) → zero TypeScript errors
- `npm run lint` → no warnings
- `npm run build` → succeeds

---

## Chronological Log

### Session 1 — Phase 0 start (project setup)

**2026-08-07**

1. **Read `project.md`** — confirmed the build spec (see README summary), 9 roles, ~35 modules, full schema, seed data. Directory contained only the spec; no prior code.

2. **Environment check**
   - Node `v24.12.0`, npm `11.6.2`, pnpm `10.27.0` available (no bun).
   - Project dir is empty except `project.md`.

3. **Decisions (confirmed with user)**
   - Scope: **Complete everything** (all modules, all features).
   - Credentials: user will supply Mongo URL, JWT secrets, Cloudinary, SMTP when phases need them.
   - Package manager: **npm** (user chose).
   - Delivery: **phase-by-phase**, review checkpoints between phases.

4. **Scaffold attempt 1** — `create-next-app` inside the target dir FAILED:
   - The workdir parameter strips the trailing space from the folder name (`...Hospital Managment System `) → `FileSystem.access` not found.
   - Direct run with folder name also failed npm naming restrictions (spaces + capitals).
   - **Fix:** scaffolded into sibling temp dir `hospital-management-system`, then `rsync -a` moved everything (incl. dotfiles & node_modules) into the final folder, temp dir removed.

5. **Scaffold result** — created `next@16.3.0` (latest). **Downgraded to Next 15** to match spec:
   - `package.json`: `next: "^15.5.4"`, `eslint-config-next: "^15.5.4"` → resolved `next@15.5.23`.

6. **Git**
   - `git init -b main` successful in the project folder.
   - Global identity detected: `Shahbaz2104 <shahbaz21042005@gmail.com>`.

7. **README.md** — replaced the create-next-app boilerplate with the project README (stack, setup, scripts, roles, modules, models, design, progress link).

8. **PROGRESS.md** — this file, created.

### Session 2 — Phase 0 continued (deps, UI kit, motion, shell)

9. **Dependencies installed** (runtime):
   `@prisma/client`, `@tanstack/react-query`, `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `zod`, `recharts`, `framer-motion`, `lucide-react`, `date-fns`, `axios`, `bcryptjs`, `jose`, `nodemailer`, `qrcode`, `exceljs`, `pdf-lib`, `cloudinary`, `clsx`, `tailwind-merge`, `class-variance-authority`, `sonner`, `next-themes`
10. **Dependencies installed (dev)**: `prisma@7.9.1`, `tsx`, `@types/bcryptjs`, `@types/nodemailer`, `@types/qrcode`.
11. **shadcn/ui init** — v3 CLI (`radix` base, `nova` preset). Layout: no `src/` dir, aliases `@/*`, css vars on.
12. **shadcn components added** (27): button, input, card, table, dialog, sheet, dropdown-menu, avatar, badge, tabs, accordion, separator, skeleton, select, sonner, label, textarea, breadcrumb, tooltip, alert, checkbox, form*, pagination, popover, scroll-area, switch, radio-group. `*form.tsx` CLI stalled (registered but never downloaded) → created manually (canonical RHF wrapper).
13. **Folder structure** (feature-based, per spec): `app/`, `components/{ui,shared,data,features,layout,providers,theme,motion}`, `hooks/`, `lib/{db,motion}`, `actions/`, `services/`, `repositories/`, `validators/`, `constants/`, `utils/`, `types/`, `prisma/`, `scripts/`, `public/`.
14. **`.env.example`** created — Mongo URL, JWT secrets (+expiry), Cloudinary, SMTP, seed password, rate-limit. Copied to `.env`.
15. **`lib/env.ts`** — zod-validated env access (fails fast on missing/invalid vars).
16. **Providers** — `ThemeProvider` (next-themes), `QueryProvider` (React Query), `LenisProvider` (smooth scroll). Root `app/layout.tsx` updated: HMS metadata, fonts (Geist), `<Toaster>` (sonner).
17. **Shell UI** — `AppShell` = collapsible `Sidebar` (desktop) + `Topbar` (global search, notifications, theme toggle) + `MobileNav` (sheet drawer). `constants/nav.ts` drives all nav (all modules from spec). `PageHeader` shared component. Placeholder dashboard with stat cards + chart skeletons.
18. `app/page.tsx` → `redirect("/dashboard")`.

19. **Motion stack** (user request: GSAP + Lenis + anime.js, award-winning UI):
    - Installed `gsap@3.15.0`, `@gsap/react@2.1.2`, `lenis@1.3.26`, `animejs@4.5.0`. (`@animejs/react` NOT on npm → own wrapper.)
    - `components/providers/lenis-provider.tsx` — `ReactLenis root`, quiet lerp (0.09) + autoRaf.
    - `lib/motion/gsap.ts` — registers ScrollTrigger once; exports `gsap`, `usePrefersReducedMotion`, `EASE`.
    - Motion kit (`components/motion/`):
      - `Reveal` — scroll-triggered fade/rise (once), reduced-motion safe.
      - `Stagger` — staggered entrance for `[data-stagger-item]` children.
      - `Magnetic` — pointer-follow micro-interaction for buttons/CTAs.
      - `AnimatedText` — anime.js v4 character-level text reveal (used on dashboard title).
    - `app/globals.css` — theme shifted to **enterprise blue primary** (`oklch(0.546 0.245 262.881)` ≈ #2563eb), blue chart ramp, Lenis CSS, `card-hover` micro-interaction, `::selection`, thin scrollbars, reduced-motion global guard.
    - Dashboard applies Stagger (stat cards), Reveal (sections), `card-hover`.

20. **Phase 0 gates**
    - `npm run lint` — after fixing: removed stale Next 16 `eslint.config.mjs` (extension + spread issues) → replaced with **FlatCompat** pattern. Unused-import warnings cleared (sidebar, nav, app-shell). **0 problems.**
    - `npx tsc --noEmit` — **clean**.
    - `npm run build` — **succeeds** (6 pages, static). Next.js auto-set `jsx: preserve` in tsconfig.
    - `npm run dev` — boots (Next 15.5.23), `/dashboard` responds HTTP 200.

21. **Known advisories** (documented, not auto-fixed — would force breaking upgrades):
    - `postcss` (bundled by next) + `sharp` — Next 15 will keep vulnerability until Next 16; spec pins Next 15 → leave.
    - `uuid` in `exceljs` (moderate) — tracked; revisit in Billing/Reports export phase.

### Session 3 — UI/UX polish pass (committed `c8ec713`)

**2026-08-08**

22. **Shared design language** — refined across the app:
    - `app/globals.css` — `.data-table` utility (tinted header, row hover, dividers), `.card-hover` micro-interaction, `.fade-in` animation.
    - `components/ui/table.tsx` — TableHead (uppercase micro-type, tinted bg, tracking), TableCell (`px-4 py-3`), TableRow hover.
    - `components/data/data-table.tsx` — SearchX empty state, "Showing X–Y of Z" footer, shadow wrapper, `bg-muted/40` header.
    - `components/shared/stat-card.tsx` — gradient icon tile + ring, hover glow, group-hover icon scale.
    - `components/shared/page-header.tsx` — border-b; `components/ui/button.tsx` — default shadow + hover lift; `components/ui/input.tsx` — smooth focus/hover transitions; `components/layout/sidebar.tsx` — active accent bar + font-semibold.
    - `data-table` class applied to 5 raw tables (lab, pharmacy, inventory ×2, +1).

23. **Gate**: typecheck + lint + build green. Committed `c8ec713` "ui: refine shared design language across tables, stat cards, nav".

### Session 4 — Phase 6: Billing, Payments, Insurance (backend + 2 pages)

**2026-08-08**

24. **Schema** (`prisma/schema.prisma`, validated + client regenerated):
    - New models: `InsuranceCompany`, `InsurancePolicy`, `Invoice`, `InvoiceItem` (own `createdAt`), `Payment` (self-ref `PaymentRefund`, NoAction on delete/update), `InsuranceClaim` (`invoiceId @unique @db.ObjectId`).
    - Back-relations on Patient/Appointment/Consultation/Admission/User; User's claim relations named `"ClaimSubmittedBy"`/`"ClaimDecidedBy"`.
    - Invoice money flow: subtotal → discount (FIXED/PERCENT) → tax → insuranceCoverage → total; status PENDING/PARTIAL/PAID/REFUNDED/CANCELLED.

25. **`validators/billing.ts`** — zod: invoiceItem, createInvoice, recordPayment, refund, insuranceCompany, insurancePolicy (policyNumber optional), createClaim, claimDecision.

26. **`services/billing.ts`** — `nextNumber` (INV-/PAY-/CLM-/POL-/IC-XXXX), `computeInvoiceTotals`, invoice status calc; list/create/cancel invoice; list/record payment (overpayment guard); refund (negative payment linked via `refundOfId`); `revenueStats` (today/month/outstanding/pending); insurance companies/policies CRUD; claims: create (validates policy + coverage), decide (APPROVED → auto-payment via INSURANCE method + claim PAID). `createInsurancePolicy` also writes patient.insuranceProvider/insuranceNumber. Audit actions: INVOICE_CREATED/CANCELLED, PAYMENT_RECORDED/REFUNDED, INSURANCE_COMPANY_CREATED/UPDATED, INSURANCE_POLICY_CREATED, INSURANCE_CLAIM_SUBMITTED/DECIDED.

27. **API** — `app/api/billing/*`: `invoices` GET/POST + `[id]` GET/PATCH(cancel), `payments` GET/POST + `payments/refund` POST, `claims` GET/POST + `[id]` PATCH(decide), `companies` GET/POST + `[id]` PATCH, `policies` GET/POST, `summary` GET. All behind `requirePermission` (billing/payments/insurance read/manage).

28. **UI**:
    - `components/features/billing/billing-page.tsx` — stat cards, status tabs, search, invoice table, CreateInvoiceDialog (useFieldArray items, patient/policy selects, live discount/tax/insurance totals), InvoiceDetailDialog (items, payments, refund, cancel, print via `window.open` + print CSS), RecordPaymentDialog, RefundDialog.
    - `components/features/billing/payments-page.tsx` — method tabs, search, collected/refunded/net stat cards.
    - Wrappers `app/(dashboard)/billing/page.tsx` + `payments/page.tsx` with permission guards (nav/perms were already wired).

29. **`services/pharmacy.ts` + `app/api/medicines/route.ts`** — added `search` param.

### Session 5 — Scroll fix, sticky navbar, global search

**2026-08-08**

30. **Scroll bug root cause** — `AppShell` scrolled an inner div while Lenis ran in `root` mode → the window never scrolled (wheel appeared dead, GSAP ScrollTrigger broken).
31. **Fix** — `AppShell` is now a `"use client"` window-scroll layout: `min-h-svh` wrapper, sticky `Sidebar` + sticky `Topbar`, content column with `md:pl-64 | md:pl-16` + `transition-[padding-left]`; sidebar collapse state lifted into AppShell; sidebar nav marked `data-lenis-prevent` so its own wheel scrolling works; Lenis keeps `root: true`. GSAP ScrollTrigger + wheel scrolling work again.
32. **Global search** — `components/layout/global-search.tsx`: Popover + React Query (debounced, enabled ≥2 chars) hitting `/patients`, `/doctors`, `/medicines`, `/billing/invoices` in parallel; grouped results navigate to `/patients/[id]`, `/doctors/[id]`, `/pharmacy`, `/billing`; Enter opens first result, Esc closes. Wired into `topbar.tsx` (replaces the decorative input).

### Session 6 — Verification (typecheck/lint/build + browser)

**2026-08-08**

33. **Gates** — `npm run typecheck` clean; `npm run lint` 0 errors (2 pre-existing warnings in `scripts/`); `npm run build` succeeds.
34. **API smoke** — `POST /api/auth/login` via curl on `http://localhost:3001` → 200 (Ayesha Rahman, SUPER_ADMIN). Dev server on :3001 (port 3000 holds a stale server from an earlier session — now broken because `.next` was rebuilt; ignore/kill it).
35. **Browser verification** (`verify-fix.mts`, Playwright) — found the dev server hydrates slowly on first compile (earlier "login dead" reports were this flake, not an app bug; script now waits for hydration before interacting). Verified:
    - Login → redirects to `/dashboard`.
    - Wheel scroll moves the window (0 → 886px on a tall page; Lenis + ScrollTrigger fine).
    - Sidebar collapse 256px → 64px with content reflow.
    - Global search: typing "Ayesha" opens results popover and fires `/api/patients?search=Ayesha` + `/api/billing/invoices?search=Ayesha`.
    - `/billing` and `/payments` render their billing content.
36. **Uncommitted** — Phase 6, scroll/search fixes, and `verify-fix.mts` (temp) are NOT yet committed; last commit remains `c8ec713`.

---

## Session milestones
- [x] Scaffold + Next 15 downgrade + git init + README + PROGRESS
- [x] Deps, shadcn UI kit, folder structure, envs
- [x] Motion stack (GSAP/Lenis/anime.js) wired into shell
- [x] ESLint + typecheck + build + dev boot green
- [x] Phase 1 — Auth, Users, RBAC, Security, Audit Logs
- [x] Phase 2 — Master data (Departments, Doctors, Nurses, Rooms/Beds)
- [x] Phase 3 (core) — Patient detail, OPD queue + token slips, calendar view, IPD admissions/transfers/discharges
- [x] Phase 3 (complete) — Consultations (vitals + prescriptions + diagnosis), live bed dashboard w/ patient names
- [x] Phase 4 — Laboratory (catalog, orders, sample flow, results w/ flags, printable report) + Radiology (orders, scheduling, findings, attachments, printable report)
- [x] UI/UX pass — fixed sidebar (content scrolls, nav stays), dashboard charts (7-day area, bed donut, animated status bar), animated stat counters
- [x] Phase 5 — Pharmacy (10 medicines, categories, expiry & low-stock alerts, dispense w/ printable receipt, purchase orders → stock in) + Inventory (6 equipment w/ warranty/maintenance, suppliers, stock ledger)
- [x] UI/UX polish — shared table/card/button/input design language (commit `c8ec713`)
- [x] Phase 6 (backend + 2 pages) — Billing (invoices, discounts/tax, payments, refunds, revenue stats) + Payments + Insurance (companies, policies, claims w/ auto-payment on approval)
- [x] Scroll fix — AppShell window-scroll layout, sticky sidebar/topbar, collapse state, Lenis root preserved
- [x] Global search — patients/doctors/medicines/invoices popover in topbar
- [x] Browser verification — login, scroll, collapse, search, /billing, /payments (Playwright)
- [x] Phase 6 (insurance UI) — companies/policies/claims management page (approve/reject)
- [x] Phase 7 — HR & Payroll: employees CRUD (w/ user+role creation), attendance (mark + monthly stats), leaves (approve/reject), performance reviews, payroll runs (generate / mark paid / payslip PDF), /staff roster
- [ ] Browser verification of Phase 7 pages — blocked this session: `next start` did not come up within the verify scripts (in-memory mongo `prisma db push` hang + `next start` no-response in this environment); gates + live seed against Atlas passed instead

| ID | Decision | Rationale |
| -- | -------- | --------- |
| D1 | npm (not pnpm/bun) | User choice |
| D2 | Next.js 15.5 instead of scaffolded 16.x | Spec pins Next.js 15 |
| D3 | Trailing-space folder is final root | stdout path confirmed; all tool calls must quote the path |
| D4 | No `src/` dir — feature folders at root | Matches `project.md` folder structure spec |
| D5 | Auto-generated Patient ID, QR card, etc. | Per spec (Patient Module) |
| D6 | npm for all package operations | User choice |
| D7 | shadcn v3 CLI, `radix` base + `nova` preset | Current stable registry (components.json: `style: radix-nova`) |
| D8 | Motion: Lenis (lerp 0.09, root) + GSAP ScrollTrigger + anime.js v4 | User request; quiet premium motion, reduced-motion respected |
| D9 | Enterprise blue primary (`#2563eb`-ish oklch) on white | Spec: "White / Blue accents", ERP look |
| D10 | Env vars validated via `lib/env.ts` (zod, fail-fast) | Prevents silent misconfig in prod |
| D11 | ESLint via FlatCompat (`next/core-web-vitals`, `next/typescript`) | eslint-config-next@15 ships legacy-shape configs |
| D12 | Keep Next 15 (advisory gaps accepted) | Spec pins Next.js 15; fixes would require breaking Next 16 |
| TBD | MongoDB + Prisma relation/transaction strategy | Docs under sub-agents — verify against `node_modules/next`. @ its DISCLAIMER edition | |
| D13 | Invoice number prefix `INV-XXXX` (PAY-/CLM-/POL-/IC-) | Human-friendly, sequence-based IDs |
| D14 | Insurance coverage as an invoice-level amount (covered by policy) | Bill shows patient share vs insurer share; claim ties to invoice |
| D15 | Claim APPROVED auto-records an INSURANCE payment | Keeps AR correct without double entry |
| D16 | Money always formatted `$X.XX` via shared `money()` helper | Consistent presentation + avoids float display bugs |
| D17 | Standalone `Prescription` model + page (PDF + QR) | User choice — spec's Prescription Module |
| D18 | Notifications: in-app + best-effort SMTP email | No-op/log when SMTP env unset |
| D19 | Backup via `npm run db:backup` (mongodump); single-hospital branding via Settings | User choice; schema already multi-tenant-ready |
| D20 | Minimal PWA (manifest + service worker, offline shell) | User choice — no full offline data sync |
| D21 | Full spec-scale seed data | User choice — slower seeding, realistic demo |

> New decisions appended as the build proceeds.

---

## Remaining Work Plan (approved 2026-08-08)

Build order; each phase: schema → validate/generate → validators → services → API → UI → gates (typecheck/lint/build) → browser check → commit → PROGRESS.md update.

1. **Phase 6b — Insurance UI** — `/insurance` page (Companies / Policies / Claims tabs; approve/reject → auto-pays invoice). Reuses existing `app/api/billing/*`.
2. **Phase 7 — HR & Payroll** — extend `Employee`; new `Attendance`, `Leave`, `Payroll` (+ optional `PerformanceReview`) models; `/hr` (Employees / Attendance / Leaves tabs), `/staff` (roster), `/payroll` (runs, generate-for-month, mark paid, payslip PDF via pdf-lib).
3. **Phase 8 — Reports, Analytics, Notifications** — `/reports` tabs (patients, revenue, doctors, appointments, medicines, inventory, admissions) with date filters + PDF/Excel/print; `/analytics` (revenue, growth, doctor perf, bed utilization, medicine usage, occupancy); new `Notification` model + topbar bell (wired) + `/notifications`; auto-notify on low stock/expiry/appointment/emergency; best-effort SMTP email (no-op if unset).
4. **Phase 9 — Emergency, Settings, Records, Prescriptions, Search** — new `EmergencyCase` + `/emergency` (triage queue, ambulance, doctors, timeline); `/settings` (hospital info, logo, hours, appointment duration, tax, currency, SMTP/Cloudinary); new `MedicalRecord` + `/records`; **standalone `Prescription` model** + `/prescriptions` (PDF + QR verification); global search + appointments/departments.
5. **Phase 10 — Polish** — Cloudinary uploads (logo, patient image, report files); minimal PWA (`manifest.ts` + SW); `/`-shortcut + a11y/perf pass; **full spec-scale seed** (150 patients, 30 doctors, 20 nurses, 10 depts, 100 medicines, 500 appointments, 200 invoices, 100 admissions, 50 lab reports); `npm run db:backup` (mongodump); final gates + browser verification + README/PROGRESS final update.

**Decisions:** D17 standalone Prescription model (user); D18 in-app + best-effort email (user); D19 backup script + single hospital branding (user); D20 minimal PWA (user); D21 full spec-scale seed (user).

### Session 7 — Phase 6b: Insurance page UI

**2026-08-08**

37. **`components/features/billing/insurance-page.tsx`** — three-tab insurance module:
    - **Companies** — table (code, coverage %, phone/email, active badge) + create/edit dialogs (zod `insuranceCompanySchema`, coverage auto-default 80%, toggles `active`).
    - **Policies** — table (policy number, patient, company, coverage %, validity window, status) + create dialog (patient + active-company selects; selecting a company auto-fills its coverage %; policy number optional → auto-generated `POL-XXXX`).
    - **Claims** — stat cards (submitted / approved payouts / rejected) + table with Approve/Reject buttons → `decideClaim` (approval auto-records an INSURANCE payment and marks the claim PAID).
    - Wrapper `app/(dashboard)/insurance/page.tsx` with `requirePermission("insurance:read")`.
38. **Typing fix** — `z.coerce.date()` on optional policy dates fought RHF's resolver typing (input `unknown` vs output `Date`). Changed `validFrom/validTo` in `insurancePolicySchema` to plain optional strings (Prisma accepts ISO strings for DateTime) — RHF stays fully string-typed.
39. **Gates** — typecheck clean; lint 0 errors (2 pre-existing warnings in `scripts/`); build succeeds. **Phase 6 is now complete** (billing + payments + insurance).
40. **Uncommitted** — insurance page + validator change + PROGRESS.md; commit follows. Remaining: Phases 7–10 (see Remaining Work Plan above).

### Session 8 — Phase 7: HR & Payroll

**2026-08-08**

41. **Schema** (`prisma/schema.prisma`, validated + client regenerated):
    - `Employee` extended: `employmentType` (FULL_TIME/PART_TIME/CONTRACT/INTERN), `allowances`, `gender`, `birthDate`, `address`, `emergencyContact`, `bankName`, `bankAccountNo`, `bankIfsc`, `hospitalId`, back-relations.
    - New models: `Attendance` (date as `YYYY-MM-DD` string, `@@unique([employeeId, date])`), `Leave` (`leaveNo` LV-XXXX, PENDING/APPROVED/REJECTED, approver), `Payroll` (`month` `YYYY-MM`, snapshots basic/allowances/bonus/overtime/deductions, `@@unique([employeeId, month])`, GENERATED/PAID), `PerformanceReview` (period, rating 1–5).
    - User back-relations: `attendanceRecorded` / `leavesApproved` / `payrollPaid` / `performanceReviews`.
42. **`validators/hr.ts`** — employee (create: password required; update: partial), attendanceMark (bulk entries), leave (+decision), payrollGenerate (month + per-employee overrides), payrollMarkPaid (ids), performanceReview.
43. **`services/hr.ts`** — `nextNumber` EMP/LV; employees list/create (transaction: user + role + employee)/update/delete; attendance list/mark (upsert per employee+date)/stats (groupBy month); leaves list/create (auto day count)/decide; reviews list/create; payroll generate (all ACTIVE employees, snapshots, skips existing month)/list/stats/markPaid (bulk)/**payslip PDF via pdf-lib** (A4, hospital branding, earnings/deductions table, net pay, status). Audit: EMPLOYEE_CREATED/UPDATED/DELETED, ATTENDANCE_MARKED, LEAVE_CREATED/DECIDED, PAYROLL_GENERATED/PAID, PERFORMANCE_REVIEW_CREATED.
44. **API** — `app/api/hr/*`: `employees` GET/POST + `[id]` GET/PATCH/DELETE, `attendance` GET/POST + `attendance/stats`, `leaves` GET/POST + `[id]` PATCH(decide), `reviews` GET/POST, `payroll` GET/POST(generate) + `payroll/stats` + `payroll/mark-paid` POST + `payroll/[id]/payslip` GET (application/pdf). All behind `requirePermission` (hr/payroll read/manage). Routes stay audit-free (services log).
45. **UI**:
    - `components/features/hr/hr-page.tsx` → `/hr` — stat cards (total/active/on-leave/pending leaves), 4 tabs: **Employees** (search, status filter, full create/edit dialog incl. role select + bank fields, delete), **Attendance** (quick mark: date/status/employee or "all employees" toggle + clock in/out, monthly summary per employee, records list), **Leaves** (status filter, create dialog, Approve/Reject), **Reviews** (star rating, create dialog).
    - `components/features/hr/staff-page.tsx` → `/staff` — roster grid grouped by department (avatar, role, contact, join date, status badge).
    - `components/features/hr/payroll-page.tsx` → `/payroll` — month picker, stat cards (net payout/paid/pending/slips), Generate for month, bulk checkbox + Mark paid, payslip PDF download, status tabs.
46. **Seed** — `seedHr()`: 6 employees from existing demo users (upsert on employeeNo), 180 attendance records for the current month via batched `createMany` (deleteMany first — MongoDB has no `skipDuplicates`), 2 leaves (LV-0001 pending, LV-0002 approved), 6 payroll records for the current month (one PAID).
47. **Gates** — typecheck clean; lint 0 errors (2 pre-existing warnings in `scripts/`); build succeeds (`/hr`, `/staff`, `/payroll` compiled).
48. **Browser verification — BLOCKED** this session: `scripts/ui-verify-hr.ts` (in-memory mongo) hung at `prisma db push`; `scripts/ui-verify-hr-live.ts` (`next start` on the real Atlas DB) never came up. Both scripts kept in `scripts/` for a later session. Live seed against Atlas verified the data layer end-to-end (6 employees, 180 attendance, 2 leaves, 6 payrolls).
49. **Uncommitted** — Phase 7 + seed + PROGRESS.md; commit follows. Remaining: Phases 8–10 (see Remaining Work Plan above).

### Session 9 — Phase 8: Reports, Analytics, Notifications

**2026-08-08**

50. **Schema** — new `Notification` model (userId, title, message, type: SYSTEM/STOCK_ALERT/EXPIRY_ALERT/APPOINTMENT/EMERGENCY/BILLING/HR, entity/entityId, read/readAt, hospitalId, createdAt); `User.notifications` back-relation. Validated + client regenerated.
51. **`validators/notifications.ts`** — `markNotificationReadSchema` ({ read: true }).
52. **`services/notifications.ts`**:
    - `notify()` — targets by userId or role list (optionally + hospitalId), **dedupes per entity** via unread-`entity`/`entityId` lookup, optional best-effort `sendEmail` (SMTP configured in this `.env`, so emails fire for real).
    - `listNotifications` (unread-only filter + pagination), `unreadCount`, `markRead`, `markAllRead` (ownership-scoped to the actor).
    - `runAlerts()` — lazy alert pipeline: low stock (`stock ≤ reorderLevel`), medicines expiring within 30 days (both → PHARMACIST/HOSPITAL_ADMIN/SUPER_ADMIN), today's CONFIRMED appointments → their doctor (in-app + email reminder). Returns counts of what was checked.
53. **`services/reports.ts`** — `ReportResult` shape (type/title/columns/rows/summary) shared by UI + exporters; `runReport(type, {from,to})` with 7 types: patients (new/gender/age/OPD-vs-admitted), revenue (billed/collected/outstanding per method), doctors (appointments/consultations/revenue), appointments (status/type/month splits), medicines (units/revenue/stock/reorder), inventory (equipment status/category/maintenance next), admissions (avg stay/occupancy). Exporters: `exportReportPdf` (pdf-lib, header + summary + paginated table, right-aligned numerics) and `exportReportExcel` (exceljs, styled header/summary/table with auto column widths).
54. **`services/analytics.ts`** — `analyticsOverview()`: monthly revenue/patients/appointments (6 mo), growth %, payment-method split, doctor performance (top 8), bed status + 14-day occupancy trend (admission overlaps per day), medicine usage (30 d), appointment status split.
55. **API** — `app/api/notifications` GET (runs `runAlerts()` lazily, lists; `unread=`, `page`, `pageSize`) + PATCH (mark all read); `notifications/[id]` PATCH (mark read); `notifications/unread` GET (bell polling); `app/api/reports` GET (validated type + range); `app/api/reports/export` GET (`pdf`|`excel`, binary attachment download); `app/api/analytics` GET. Middleware: added `/notifications` to ROUTE_ROLES (all staff); `/reports` + `/analytics` already present.
56. **UI**:
    - `components/layout/notification-bell.tsx` → topbar — unread badge polled every 30s, popover with latest 8 (icons per type, click-to-read, mark-all-read, "View all" → `/notifications`).
    - `components/features/notifications/notifications-page.tsx` → `/notifications` — stat cards (unread/total/read), All|Unread tabs, per-item mark read, mark-all-read, type-styled icons, read timestamps.
    - `components/features/reports/reports-page.tsx` → `/reports` — 7 type tabs, from/to date inputs, summary stat cards (+ extras), data-table, Print (new-window HTML), Excel + PDF export via blob download.
    - `components/features/analytics/analytics-page.tsx` → `/analytics` — recharts (v3, matching dashboard styling): revenue area, patients/appointments bars, payment-method donut, doctor performance bars, bed-status donut, 14-day occupancy area, medicine usage bars, appointment-status bars.
57. **Seed** — `seedNotifications()`: 5 idempotent demo notifications across admin/doctor/pharmacist/hospital accounts (SYSTEM, STOCK_ALERT, EXPIRY_ALERT, APPOINTMENT, HR) with staggered createdAt; re-ran full seed against Atlas.
58. **Gates** — typecheck clean; lint 0 errors (2 pre-existing warnings in `scripts/` — untouched); build succeeds with `/reports`, `/analytics`, `/notifications` + 3 new API routes compiled.
59. **Smoke test (live Atlas)** — analytics overview (5-month bucket zero-revenue month behavior OK), revenue report + PDF (1339 B) + Excel (6747 B) exports, runAlerts lazily created a real "Low stock: Ibuprofen" alert, list/unread/mark-all-read round-trip (5 → 0 unread). Browser verification still blocked by the same environment issue as Phase 7 (next start doesn't come up here).
60. **Uncommitted** — Phase 8 + seed + PROGRESS.md; commit follows. Remaining: Phases 9–10 (see Remaining Work Plan above).

### Session 10 — Phase 9: Emergency, Records, Prescriptions, Settings, Search

**2026-08-08**

61. **Schema** — new models (validated + client regenerated):
    - `EmergencyCase` (caseNo ER-XXXX, patientId nullable → walk-in name/phone/age/gender for unregistered casualties, triageLevel RED|ORANGE|YELLOW|GREEN, vitals JSON, status WAITING|IN_PROGRESS|STABILIZED|TRANSFERRED|ADMITTED|DISCHARGED, assignedDoctorId, ambulance fields requested/dispatchedAt/etaMinutes/notes, optional admittedAsAdmissionId one-to-one → Admission) + `EmergencyEvent` (type STATUS|AMBULANCE|DOCTOR|ADMISSION|NOTE, note, createdBy).
    - `MedicalRecord` (recordNo MR-XXXX, type PRESCRIPTION|DIAGNOSIS|LAB|RADIOLOGY|ADMISSION|OPD|GENERAL, title/summary/doctorId, optional entityType/entityId link-back).
    - `Prescription` (prescriptionNo RX-XXXX, patient/doctor/consultationId/appointmentId, items JSON, diagnosis/notes, status ACTIVE|COMPLETED|CANCELLED, issuedAt, hospital relation for branding).
    - Back-relations on User (emergencyCases/emergencyEvents), Doctor (emergencyCases/medicalRecords/prescriptions), Patient (3×), Consultation (prescriptionDocs — renamed because the legacy JSON `prescriptions` field owns the name), Admission (emergencyCase), Hospital (prescriptions).
62. **Permissions** — added `emergency:manage`, `records:manage`, `prescriptions:manage` to the PermissionKey union + ALL_PERMISSIONS; granted: DOCTOR (all 3), NURSE (emergency/records manage), PHARMACIST (prescriptions manage). Existing `settings:manage`, `prescriptions:read/create`, `records:read`, `emergency:read` reused.
63. **Validators** — `validators/emergency.ts` (create with patient-or-walkin refine, update, ambulance dispatch, event), `records.ts` (create), `prescriptions.ts` (items array min 1, status), `settings.ts` (hospital fields incl. working hours + duration, SMTP, alert thresholds).
64. **Services**:
    - `services/emergency.ts` — list (status/triage filters + search, sorted triage-desc/oldest-first, status counts), create (auto ER-XXXX, opening event, auto-dispatch when requested, EMERGENCY notification to DOCTOR/NURSE/ADMIN), update (status/triage/doctor → status event), dispatchAmbulance (ETA + AMBULANCE event), addEvent/listEvents; audit all mutations.
    - `services/records.ts` — list (patient/type/search), create (MR-XXXX), getPatientRecords.
    - `services/prescriptions.ts` — list/create (RX-XXXX), status update, **PDF via pdf-lib** (A4, hospital branding, items table w/ column widths + page overflow, notes, embedded **QR code** via `qrcode` → payload `{v, rx, id}`) and **verify** (public route renders an HTML verification card — no session required, minimal PII).
    - `services/settings.ts` — settings key/value store overrides (SMTP + alert thresholds via the existing `Settings` KV model) + hospital-level fields on the `Hospital` row; all persisted with audits.
    - `services/search.ts` — unified global search across patients, doctors, appointments, medicines, departments, employees → `{id, label, sub, href}`.
65. **API** — `emergency` GET/POST, `emergency/[id]` GET/PATCH, `emergency/[id]/ambulance` POST, `emergency/[id]/events` GET/POST; `records` GET/POST, `records/patient/[patientId]` GET; `prescriptions` GET/POST (+pharmacy notification on issue), `prescriptions/[id]` GET/PATCH, `prescriptions/[id]/pdf` GET (inline PDF), `prescriptions/verify` GET (public HTML verification); `settings` GET/PATCH, `settings/smtp` PATCH, `settings/notifications` PATCH; `search` GET. Middleware: added NURSE to `/records`.
66. **UI**:
    - `components/features/emergency/emergency-page.tsx` → `/emergency` — stat cards (waiting/in-progress/ambulance), status filter chips, triage-dot queue rows w/ vitals badges, **CaseDrawer** (status/triage/doctor selects that update live, vitals, ambulance panel, timeline with inline event add), **CreateCaseDialog** (patient select XOR walk-in fields, triage, vitals grid, ambulance toggle), **AmbulanceDialog** (ETA + notes).
    - `components/features/records/records-page.tsx` → `/records` — type tabs, debounced search, record list w/ type badges, **CreateRecordDialog** (patient/type/doctor/title/summary).
    - `components/features/prescriptions/prescriptions-page.tsx` → `/prescriptions` — status stat cards, list w/ item preview, inline status select, PDF download, **CreatePrescriptionDialog** (patient/doctor/diagnosis + dynamic medicine rows w/ dose/frequency/duration from the medicines catalog).
    - `components/features/settings/settings-page.tsx` → `/settings` — 3 tabs: **Hospital** (identity, logo URL, currency, tax, timezone, working hours, appointment duration), **SMTP** (host/port/user/pass/from/TLS), **Alerts** (low-stock threshold, expiry window, reminder lead time, email toggle).
    - `components/layout/global-search.tsx` — replaced the 4-endpoint fan-out with the unified `/api/search` (also matches appointments, departments, staff); keep-per-entity icons.
67. **Seed** — `seedPhase9()` (idempotent): 3 emergency cases (RED w/ dispatched ambulance + timeline events, ORANGE waiting, YELLOW stabilized walk-in), 4 medical records across types, 2 prescriptions (QR-verifiable). Full seed re-ran against Atlas.
68. **Gates** — typecheck clean; lint 0 errors (2 pre-existing `scripts/` warnings); build succeeds with `/emergency`, `/records`, `/prescriptions`, `/settings` + 12 new API routes.
69. **Smoke test (live Atlas)** — case list + counts, ambulance dispatch (ETA persisted), timeline event add, record create/delete round-trip (MR-0005), prescription PDF render (4159 B), **QR verify round-trip** (true), status update + restore, settings overview + hospital save, search "Zara" → patient + appointment hits.
70. **Uncommitted** — Phase 9 + seed + PROGRESS.md; commit follows. Remaining: Phase 10 (polish — see Remaining Work Plan above).

---

## Conventions & Notes

- **Working directory**: contains a trailing space after the folder name. Use `cd "/.../Hospital Managment System "` (quoted) for bash. The `workdir` tool param trims the space → do not rely on it for this dir.
- **Branch**: `main` (fresh repo).
- **Typecheck** = `npx tsc --noEmit`.
- **Lint** = `npm run lint`.
- **AGENTS.md note** (auto-added by `next dev`): this Next.js version may differ from training data — consult `node_modules/next/dist/docs/` before writing code.

---

## Pending Phase 0 tasks

- [x] `npm install` to re-resolve Next 15 on top of scaffolded 16 lockfile
- [x] Install libs: gsap, @gsap/react, lenis, animejs, shadcn/ui (+ theme), react-query, RHF+zod, recharts, framer-motion, prisma, jose, bcryptjs, etc.
- [x] `init shadcn` (components.json), base UI kit (27 components)
- [x] Folder structure (feature-based) + `.env.example`
- [x] Root layout, sidebar shell, topbar, theme toggle, toasts
- [x] Motion kit (Reveal / Stagger / Magnetic / AnimatedText) wired into dashboard
- [x] Gate: typecheck + lint + build + dev boot