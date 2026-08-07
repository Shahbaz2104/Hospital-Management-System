MASTER PROMPT — Build a Modern Hospital Management System
Objective

Build a production-quality Hospital Management System (HMS) that can be used by hospitals, clinics, diagnostic centers, and medical institutions.

The application should look like enterprise software instead of a student project.

Everything should be modular, scalable, secure, responsive, and written using modern best practices.

Tech Stack

Frontend

Next.js 15 (App Router)
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod
TanStack Table
React Query
Framer Motion
Recharts
Lucide Icons

Backend

Next.js API Routes
Prisma ORM
MongoDB
JWT Authentication
bcrypt
Role Based Access Control (RBAC)

Packages

Prisma
React Query
Axios
Zod
React Hook Form
Date-fns
Cloudinary
Nodemailer
PDF Generator
QR Code Generator
Excel Export
Design Requirements

Design should resemble

Modern ERP
Hospital ERP
AdminLTE quality
Clean
Professional
Minimal
White
Blue accents
Responsive
Dashboard focused

No colorful cards.

Use glassmorphism only lightly.

Everything should feel premium.

User Roles

Implement complete Role Based Authentication.

Roles

Super Admin
Hospital Admin
Doctor
Nurse
Receptionist
Pharmacist
Laboratory Technician
Accountant
Patient

Every role has different permissions.

Never expose unauthorized pages.

Protect API routes.

Authentication

Implement

Login

Register

Forgot Password

Reset Password

JWT Authentication

Refresh Token

Role Middleware

Protected Routes

Session Expiration

Profile Management

Password Change

Dashboard

After login show dashboard.

Dashboard contains

Hospital Statistics

Today's Patients

Today's Appointments

Doctors Available

Pending Lab Reports

Pending Bills

Revenue

Recent Admissions

Recent Discharges

Emergency Patients

Bed Availability

Medicine Stock Alerts

Upcoming Appointments

Charts

Revenue chart

Patient growth

Monthly admissions

Department statistics

Appointment trends

Sidebar Modules

Dashboard

Patients

Doctors

Appointments

Departments

Rooms

Beds

Admissions

Discharges

Billing

Payments

Insurance

Laboratory

Radiology

Pharmacy

Medicine Inventory

Nurses

Reception

Staff

HR

Payroll

Reports

Notifications

Settings

Audit Logs

Profile

Patient Module

Patient Registration

Generate Patient ID

Emergency Contact

Medical History

Allergies

Blood Group

Height

Weight

Insurance Information

Documents Upload

Previous Diseases

Current Medication

Vaccination History

Patient Timeline

Search

Filters

Patient Profile

Patient Dashboard

Doctor Module

Doctor CRUD

Specialization

Qualification

Experience

Department

Schedule

Availability

Consultation Fee

Doctor Profile

Patients Assigned

Appointments

Leave Management

Appointment System

Book Appointment

Online Appointment

Walk-in Appointment

Doctor Availability

Calendar View

Drag and Drop

Appointment Status

Cancelled

Completed

Pending

Missed

Appointment Reminder

SMS Ready

Email Ready

OPD Module

Token Generation

Queue Management

Doctor Consultation

Vitals

Prescription

Diagnosis

Follow Up

Print Slip

IPD Module

Patient Admission

Ward Allocation

Bed Allocation

Transfer Patient

Discharge Patient

Discharge Summary

Hospital Stay Timeline

Bed Management

ICU

General Ward

Private Room

Semi Private

Operation Theatre

Bed Status

Occupied

Reserved

Cleaning

Available

Live Bed Dashboard

Department Module

Create Department

Assign Doctors

Department Statistics

Head of Department

Department Revenue

Nurse Module

Assigned Patients

Medication Schedule

Vitals Entry

Shift Management

Patient Notes

Task Completion

Laboratory Module

Lab Test Categories

Create Tests

Assign Tests

Collect Samples

Lab Report

Upload Report PDF

Result Entry

Patient Lab History

Radiology Module

X-Ray

MRI

CT Scan

Ultrasound

Upload Reports

View Reports

Appointment Scheduling

Pharmacy Module

Medicine CRUD

Medicine Categories

Manufacturers

Expiry Tracking

Stock Alerts

Low Inventory

Purchase Orders

Medicine Sales

Prescription Verification

Barcode Support

Inventory Module

Medical Equipment

Suppliers

Purchases

Stock In

Stock Out

Maintenance Schedule

Warranty

Assets

Billing Module

Invoice Generation

Payment Tracking

Discount

Tax

Insurance Claim

Partial Payments

Pending Bills

Refund

Invoice PDF

Insurance Module

Insurance Companies

Policy Information

Claim Requests

Approval Status

Coverage Details

HR Module

Employees

Attendance

Leaves

Departments

Salary

Payroll

Designation

Performance

Payroll Module

Salary Calculation

Bonuses

Deductions

Generate Payslip

Download PDF

Reports Module

Patient Reports

Revenue Reports

Doctor Reports

Appointment Reports

Medicine Reports

Inventory Reports

Admission Reports

Export PDF

Export Excel

Print Reports

Notification Module

In App Notifications

Email Notifications

Appointment Reminder

Medicine Alert

Stock Alert

Emergency Alert

Settings Module

Hospital Information

Logo

Theme

SMTP

Cloudinary

Tax

Currency

Working Hours

Appointment Duration

Departments

Emergency Module

Emergency Registration

Critical Patients

Priority Queue

Ambulance

Emergency Doctors

Emergency Timeline

Medical Records

Doctor Notes

Diagnosis

Prescription

Lab Reports

Radiology Reports

Files

Images

Timeline

Complete Medical History

Prescription Module

Medicine Selection

Dosage

Duration

Frequency

Instructions

Doctor Signature

Download PDF

Print

QR Verification

Search

Global Search

Patients

Doctors

Medicines

Invoices

Appointments

Departments

Fast Search

Analytics

Total Revenue

Monthly Revenue

Daily Patients

Patient Growth

Doctor Performance

Bed Utilization

Medicine Usage

Department Revenue

Hospital Occupancy

File Upload

Cloudinary

Upload

Images

PDF

Medical Records

Reports

Profile Images

Audit Logs

Every important action should be logged.

Example

Patient Created

Doctor Deleted

Medicine Updated

Invoice Generated

Login

Logout

Role Changed

UI Requirements

Use

Cards

Tables

Dialogs

Drawers

Sheets

Tabs

Accordions

Badges

Charts

Pagination

Breadcrumbs

Search

Filters

Loading Skeletons

Empty States

Error Pages

Toast Notifications

Confirmation Dialogs

Database Models

Create proper Prisma schema.

Models should include

User

Role

Permission

Patient

Doctor

Department

Appointment

Admission

Discharge

Room

Bed

Prescription

Medicine

Inventory

Supplier

Purchase

LaboratoryTest

RadiologyTest

Invoice

Payment

Insurance

Employee

Attendance

Payroll

Notification

MedicalRecord

AuditLog

Settings

Hospital

EmergencyCase

API Standards

RESTful APIs

Validation

Pagination

Filtering

Sorting

Searching

Error Handling

Rate Limiting

Logging

Reusable Services

Reusable Repository Layer

Folder Structure
app/

components/

hooks/

lib/

actions/

services/

repositories/

types/

validators/

constants/

utils/

prisma/

public/

styles/

Follow feature-based architecture with clear separation of concerns.

Additional Features

Dark Mode

Multi Hospital Support

Hospital Branding

QR Code Patient Card

Barcode Medicine

CSV Import

Excel Export

PDF Export

Dashboard Widgets

Recent Activities

Calendar

Announcements

Role Management

Permission Management

Backup System

Activity Logs

Responsive Mobile Dashboard

Offline Ready (PWA)

Keyboard Shortcuts

Accessibility (WCAG)

Performance

Implement

Lazy Loading

Server Components

Image Optimization

Pagination

Infinite Scroll where appropriate

Caching

React Query

Optimistic Updates

Memoization

Code Splitting

Security

Sanitize inputs

CSRF protection

JWT authentication

Password hashing

Role authorization

Secure headers

Rate limiting

Environment variables

Server-side validation

Code Quality

Write clean, reusable, enterprise-level code.

Use:

TypeScript everywhere
Strict typing
Reusable components
SOLID principles
Feature-based architecture
Repository pattern
Service layer
Custom hooks
Server Actions where appropriate
Proper error handling
Meaningful comments only where necessary

Avoid duplicated code.

Seed Data

Generate realistic seed data for:

150 Patients
30 Doctors
20 Nurses
10 Departments
100 Medicines
500 Appointments
200 Invoices
100 Admissions
50 Lab Reports

Use realistic names, contact information, and medical data.

Final Deliverable

The project should:

Build successfully with zero TypeScript errors.
Pass ESLint with no warnings.
Include a complete Prisma schema and seed script.
Have responsive layouts for desktop, tablet, and mobile.
Support role-based access for all user types.
Use reusable UI components and clean architecture.
Be production-ready with realistic workflows and polished UX suitable for a professional portfolio or a technical interview demonstration.