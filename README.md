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
- MongoDB (local or Atlas)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
#   - fill in DATABASE_URL, JWT secrets, Cloudinary, SMTP

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
| `npm run db:seed`  | Seed the database with realistic demo data |

## Roles

Super Admin · Hospital Admin · Doctor · Nurse · Receptionist · Pharmacist · Laboratory Technician · Accountant · Patient

Every role has granular permissions enforced on both the UI (route guards) and the API (authorization middleware).

## Modules

Dashboard · Patients · Doctors · Nurses · Staff · Appointments · OPD · IPD · Departments · Rooms & Beds · Laboratory · Radiology · Pharmacy · Medicine Inventory · Billing · Payments · Insurance · Admission & Discharge · HR · Payroll · Reports · Notifications · Emergency · Medical Records · Prescriptions · Analytics · Audit Logs · Settings

## Database Models

User, Role, Permission, Patient, Doctor, Department, Appointment, Admission, Discharge, Room, Bed, Prescription, Medicine, Inventory, Supplier, Purchase, LaboratoryTest, RadiologyTest, Invoice, Payment, Insurance, Employee, Attendance, Payroll, Notification, MedicalRecord, AuditLog, Settings, Hospital, EmergencyCase.

## Design

Enterprise ERP look — clean, professional, minimal, white with blue accents, responsive across desktop / tablet / mobile. Dashboard-focused with Recharts analytics. Live progress and decisions are tracked in [`PROGRESS.md`](./PROGRESS.md).

## Motion

- **Lenis smooth scrolling** across the app (`components/providers/lenis-provider.tsx`)
- **GSAP + ScrollTrigger** viewport reveals (`components/motion/reveal.tsx`, `stagger.tsx`)
- **anime.js v4** character-level text reveals (`components/motion/animated-text.tsx`)
- **Magnetic micro-interactions** for CTAs (`components/motion/magnetic.tsx`) + quiet `card-hover` transitions
- Everything respects `prefers-reduced-motion`

## Progress Tracking

See [`PROGRESS.md`](./PROGRESS.md) for a running log of build steps, decisions, and phase status.