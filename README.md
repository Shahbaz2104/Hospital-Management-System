# Hospital Management System

A production-grade, enterprise-style Hospital Management System (HMS) for hospitals, clinics, and diagnostic centers. Built with modern best practices — clean architecture, role-based access control, and a premium, minimal UI.

## Tech Stack

| Layer      | Technology |
| ---------- | ---------- |
| Framework  | Next.js 15 (App Router), TypeScript |
| Styling    | Tailwind CSS 4, shadcn/ui |
| State      | React Query (Server State), React Hook Form + Zod (Forms) |
| Motion     | GSAP + ScrollTrigger, Lenis smooth scroll, anime.js v4 text |
| UI         | Framer Motion, Recharts, Lucide Icons, TanStack Table |
| Database   | MongoDB via Prisma ORM |
| Auth       | JWT (Access + Refresh tokens), bcryptjs, RBAC |
| Integrations | Cloudinary (files), Nodemailer (email), PDF / Excel / QR export |

## Getting Started

### Prerequisites
- Node.js >= 20
- npm
- MongoDB — **Atlas (replica set) required**: the app uses Prisma `$transaction` (billing, pharmacy stock, admissions, HR). A standalone local `mongod` will crash on those operations; use `mongodb-memory-server` (dev/tests) or Atlas (prod).

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
#   - fill in DATABASE_URL, JWT secrets, Cloudinary, SMTP, Stripe (optional)

# 3. Generate Prisma client + push schema
npx prisma generate
npx prisma db push

# 4. Seed the database with demo data
npm run db:seed

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `npm run dev`      | Start the development server (Turbopack) |
| `npm run build`    | Production build                        |
| `npm run start`    | Serve the production build              |
| `npm run lint`     | Run ESLint                              |
| `npm run typecheck`| TypeScript check (`tsc --noEmit`)       |
| `npm run db:push`    | Push schema changes to the database      |
| `npm run db:seed`    | Seed the database with realistic demo data |
| `npm run db:backup`  | Dump the database to `backups/<timestamp>/dump.gz` (mongodump) |

## Roles

Super Admin · Hospital Admin · Doctor · Nurse · Receptionist · Pharmacist · Laboratory Technician · Accountant · Patient

Every role has granular permissions enforced on both the UI (route guards) and the API (authorization middleware).

## Modules

Dashboard · Patients · Doctors · Nurses · Staff · Appointments · OPD · IPD · Departments · Rooms & Beds · Laboratory · Radiology · Pharmacy · Medicine Inventory · Billing · Payments · Insurance · Admission & Discharge · HR · Payroll · Reports · Notifications · Emergency · Medical Records · Prescriptions · Analytics · Audit Logs · Settings

## Phase Status

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 0 | Scaffolding, deps, folder structure, base layout, motion stack | DONE |
| 1 | Auth, Users, RBAC, Security, Audit Logs | DONE |
| 2 | Master data (Departments, Doctors, Nurses, Rooms/Beds) | DONE |
| 3 | Patients & Appointments (OPD/IPD) | DONE |
| 4 | Laboratory & Radiology | DONE |
| 5 | Pharmacy & Inventory | DONE |
| 6 | Billing, Payments, Insurance | DONE |
| 7 | HR & Payroll | DONE |
| 8 | Reports & Analytics | DONE |
| 9 | Emergency, Medical Records, Search, Settings, Prescriptions | DONE |
| 10 | Polish — Cloudinary uploads, PWA, a11y/perf, spec-scale seed, backups, Stripe payment automation | DONE |

## Online Payments (Stripe)

Billing supports fully automated payments when Stripe is configured:

- **Pay online** — creates a Stripe Checkout session per invoice (partial payments supported); the webhook (`/api/webhooks/stripe`) marks the payment complete and recomputes invoice status.
- **Payment links** — copy a shareable link for any invoice with a balance.
- **Automated refunds** — refunding a CARD payment issues a Stripe Refund; the refund syncs back via webhook as a negative payment row.
- **Receipts** — every completed payment has a branded A4 PDF receipt.

Setup: set `STRIPE_SECRET_KEY` (secret key) and `STRIPE_WEBHOOK_SECRET` (from `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe`) in `.env`. Without keys the payment UI degrades gracefully (503 "Stripe is not configured").

## Cloudinary

File uploads (hospital logo, medical-record attachments) are proxied through `POST /api/upload` with purpose-based size/type limits. Set `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` in `.env`; without them upload UI reports the service as not configured.

## Database Models

User, Role, Permission, Patient, Doctor, Department, Appointment, Admission, Discharge, Room, Bed, Prescription, Medicine, Inventory, Supplier, Purchase, LaboratoryTest, RadiologyTest, Invoice, InvoiceItem, Payment, InsuranceCompany, InsurancePolicy, InsuranceClaim, Employee, Attendance, Payroll, Notification, MedicalRecord, AuditLog, Settings, Hospital, EmergencyCase.

## Design

"The Ward Board" identity — the system reads like a hospital ward board: scrub-teal primary on a clinical-paper canvas (dark mode: night ward with monitor-mint), **Space Grotesk** display face paired with IBM Plex Sans, and IBM Plex Mono for every data readout. Structure follows chart-sheet rules: mono section stamps (FINANCE, CLINICAL…), hairline rules, and token-style identifiers. Responsive across desktop / tablet / mobile, with reduced-motion fallbacks. Live progress and decisions are tracked in [`PROGRESS.md`](./PROGRESS.md).

## Motion

- **Lenis smooth scrolling** across the app (`components/providers/lenis-provider.tsx`)
- **GSAP + ScrollTrigger** viewport reveals (`components/motion/reveal.tsx`, `stagger.tsx`)
- **anime.js v4** character-level text reveals (`components/motion/animated-text.tsx`)
- **Magnetic micro-interactions** for CTAs (`components/motion/magnetic.tsx`) + quiet `card-hover` transitions
- Everything respects `prefers-reduced-motion`

## Progress Tracking

See [`PROGRESS.md`](./PROGRESS.md) for a running log of build steps, decisions, and phase status.