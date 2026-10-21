# CareLink — Healthcare Coordination Platform

> A full-stack, role-based healthcare coordination platform enabling patients, doctors, and administrators to manage appointments, medical records, and cross-hospital record sharing with patient-controlled consent.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Motivation & Problem Statement](#motivation--problem-statement)
3. [System Architecture](#system-architecture)
4. [Technology Stack](#technology-stack)
5. [Features](#features)
6. [Data Models](#data-models)
7. [API Reference](#api-reference)
8. [Security Design](#security-design)
9. [Hospital Record Transfer Workflow](#hospital-record-transfer-workflow)
10. [Project Structure](#project-structure)
11. [Setup & Installation](#setup--installation)
12. [Demo Credentials](#demo-credentials)
13. [Scripts Reference](#scripts-reference)
14. [Limitations & Future Work](#limitations--future-work)

---

## Project Overview

**CareLink** is a minimum viable product (MVP) for a healthcare coordination system. It provides:

- A **React 18** single-page application for patients, doctors, and admins.
- A **Node.js / Express** REST API backed by **MongoDB** via Mongoose.
- **JWT-based authentication** with role-aware access control.
- A patient-consent driven **cross-hospital medical record sharing** mechanism.

The frontend is built with **Vite** and uses **Lucide React** for icons and vanilla CSS for styling. The backend is a modular Express server using **Helmet**, **CORS**, **Morgan**, and **express-rate-limit** for production-readiness.

---

## Motivation & Problem Statement

In many healthcare ecosystems, patient records are siloed within individual hospitals or clinics. When a patient transfers care or seeks a second opinion at a different institution, they must manually collect and carry their own records — a process that is error-prone, time-consuming, and potentially unsafe.

CareLink addresses this by providing:

- A **unified patient record** accessible from a single authenticated account.
- A **formal, auditable request-approve-revoke workflow** for sharing records between hospitals.
- **Patient sovereignty**: the patient explicitly approves and can revoke record access at any time.
- **Source attribution**: imported records always retain the originating hospital, clinician, and recorded date — preventing provenance loss.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Browser                             │
│   React 18 SPA  (Vite dev server · http://localhost:5173)  │
│   ┌──────────┐  ┌────────────┐  ┌───────────────────────┐ │
│   │  Auth    │  │ Dashboard  │  │  Record Share UI       │ │
│   │  Login / │  │ Patient /  │  │  Request · Approve ·  │ │
│   │  Register│  │ Doctor /   │  │  Import · Revoke      │ │
│   └──────────┘  │ Admin      │  └───────────────────────┘ │
│                 └────────────┘                             │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTP / JSON  (JWT Bearer token)
                           ▼
┌────────────────────────────────────────────────────────────┐
│              Express API  (http://localhost:4000/api)       │
│                                                            │
│  /auth        /doctors      /appointments                  │
│  /records     /hospitals    /shares                        │
│                                                            │
│  Middleware: helmet · cors · morgan · rate-limit · JWT     │
└──────────────────────────┬─────────────────────────────────┘
                           │ Mongoose ODM
                           ▼
┌────────────────────────────────────────────────────────────┐
│                  MongoDB (local or Atlas)                   │
│                                                            │
│  Collections: users · appointments · medicalrecords        │
│               hospitals · recordshares                     │
└────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | Component-based UI framework |
| React DOM | 18.3.1 | DOM rendering |
| Vite | 6.0.7 | Build tool and dev server |
| @vitejs/plugin-react | 4.3.4 | JSX transform and HMR |
| Lucide React | 0.468.0 | SVG icon library |
| TypeScript | 5.7.2 | Type safety (configured) |
| Vanilla CSS | — | Custom design system, no framework |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 18+ | JavaScript runtime |
| Express | 4.21.2 | HTTP server and routing |
| Mongoose | 8.9.5 | MongoDB object modelling |
| MongoDB | 6+ | Document database |
| jsonwebtoken | 9.0.2 | JWT signing and verification |
| bcryptjs | 2.4.3 | Password hashing |
| helmet | 8.0.0 | HTTP security headers |
| cors | 2.8.5 | Cross-origin resource sharing |
| morgan | 1.10.0 | HTTP request logging |
| express-rate-limit | 7.5.0 | Brute-force protection on auth routes |
| dotenv | 16.4.7 | Environment variable loading |
| nodemon | 3.1.9 | Dev auto-reload |

### Tooling

| Tool | Purpose |
|---|---|
| concurrently | Run API and frontend dev servers simultaneously |
| npm workspaces (manual prefix) | Independent dependency trees per sub-project |

---

## Features

### Authentication & Authorisation
- **Register / Login** with email and password.
- Passwords hashed with **bcrypt** (10 rounds).
- Stateless **JWT** tokens (Bearer scheme); tokens carry `id`, `role`, and `hospital`.
- **Role-based access control** (RBAC): three roles — `patient`, `doctor`, `admin`.
- Rate-limited auth endpoint: 30 requests per 15-minute window to prevent brute-force attacks.

### Patient Dashboard
- View and edit personal profile: name, phone, date of birth, blood type, allergies.
- View upcoming, completed, and cancelled appointments.
- Access full medical history grouped by hospital.
- Manage incoming record-share requests: approve or reject clinician requests.
- Revoke previously approved record access.

### Doctor Dashboard
- Search and view their patient list.
- Create, view, and manage appointments.
- Create, view, and categorise medical records for their patients.
- Initiate cross-hospital record transfer requests targeting a patient by email.
- Import newly available patient records once a share is approved.

### Administrator Dashboard
- View all users, hospitals, and records across the system.
- Seed demo data for testing purposes.

### Doctor Directory
- Public-facing (authenticated) doctor list.
- Filter by **specialty** and search by **name**.

### Appointment Management
- Book appointments with a chosen doctor, date, and reason.
- Appointment types: **In person** or **Video visit**.
- Status lifecycle: `upcoming` → `completed` / `cancelled`.

### Medical Record Management
- Record categories: `Visit summary`, `Lab result`, `Prescription`, `Imaging`, `Other`.
- Each record stores: title, category, summary (max 2 000 chars), recording date, responsible doctor, and owning hospital.
- Imported records additionally store: source hospital, source record reference, import timestamp, and importing clinician — preserving full provenance.

### Cross-Hospital Record Sharing
See [Hospital Record Transfer Workflow](#hospital-record-transfer-workflow) for the full walkthrough.

---

## Data Models

### User

| Field | Type | Notes |
|---|---|---|
| name | String | Required, max 100 chars |
| email | String | Required, unique, lowercase |
| passwordHash | String | bcrypt hash |
| role | String (enum) | `patient` · `doctor` · `admin` |
| phone | String | Optional |
| dateOfBirth | Date | Patients |
| bloodType | String | Patients |
| allergies | [String] | Patients |
| specialty | String | Doctors |
| credentials | String | Doctors |
| hospital | ObjectId → Hospital | Doctors & admins |

### Hospital

| Field | Type | Notes |
|---|---|---|
| name | String | Required, unique |

### Appointment

| Field | Type | Notes |
|---|---|---|
| patient | ObjectId → User | Required |
| doctor | ObjectId → User | Required |
| date | Date | Required |
| reason | String | Max 500 chars |
| type | String (enum) | `In person` · `Video visit` |
| status | String (enum) | `upcoming` · `completed` · `cancelled` |

### MedicalRecord

| Field | Type | Notes |
|---|---|---|
| patient | ObjectId → User | Required |
| doctor | ObjectId → User | Responsible clinician |
| title | String | Required |
| category | String (enum) | Visit summary · Lab result · Prescription · Imaging · Other |
| summary | String | Max 2 000 chars |
| hospital | ObjectId → Hospital | Owning hospital |
| sourceHospital | ObjectId → Hospital | Set on imported records |
| sourceRecord | ObjectId → MedicalRecord | Unique per hospital (prevents duplicates) |
| importedThrough | ObjectId → RecordShare | Audit link |
| importedBy | ObjectId → User | Importing clinician |
| recordedAt | Date | Original record date |

**Indexes:** `(patient, hospital, recordedAt)` for efficient dashboard queries; unique partial index on `(hospital, sourceRecord)` to prevent duplicate imports.

### RecordShare

| Field | Type | Notes |
|---|---|---|
| patient | ObjectId → User | Required |
| sourceHospital | ObjectId → Hospital | Hospital that owns the records |
| targetHospital | ObjectId → Hospital | Hospital requesting access |
| requestedBy | ObjectId → User | Clinician who initiated the request |
| status | String (enum) | `requested` · `approved` · `rejected` · `revoked` |
| approvedAt | Date | Set when patient approves |
| rejectedAt | Date | Set when patient rejects |
| revokedAt | Date | Set when patient revokes |
| lastImportedAt | Date | Updated on each import |
| lastImportedBy | ObjectId → User | Last clinician to run import |

**Index:** `(patient, sourceHospital, targetHospital, status)` for consent lookups.

---

## API Reference

All routes are prefixed with `/api`. Protected routes require the `Authorization: Bearer <token>` header.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | No | Create a new account |
| POST | `/login` | No | Obtain a JWT |
| GET | `/me` | Yes | Get current user profile |
| PATCH | `/me` | Yes | Update current user profile |

### Doctors — `/api/doctors`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List all doctors (filter by `specialty`, `name`) |

### Appointments — `/api/appointments`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List appointments for the current user |
| POST | `/` | Patient | Book a new appointment |
| PATCH | `/:id` | Yes | Update appointment status |

### Medical Records — `/api/records`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List records for the current user or a patient (doctor) |
| POST | `/` | Doctor | Create a new medical record |

### Hospitals — `/api/hospitals`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List all hospitals |

### Record Shares — `/api/shares`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/request` | Doctor | Request record access for a patient |
| GET | `/incoming` | Patient | View pending/active share requests |
| POST | `/:id/approve` | Patient | Approve a share request |
| POST | `/:id/reject` | Patient | Reject a share request |
| POST | `/:id/revoke` | Patient | Revoke an approved share |
| POST | `/:id/import` | Doctor | Import available records from approved share |
| GET | `/outgoing` | Doctor | View shares initiated by the doctor's hospital |

### Health Check

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | Returns `{ status: 'ok', service: 'CareLink API' }` |

---

## Security Design

| Concern | Mechanism |
|---|---|
| Credential storage | bcrypt password hashing (never stored in plaintext) |
| Session management | Stateless JWT; no server-side session state |
| Transport | CORS restricted to `CLIENT_ORIGIN` env variable |
| HTTP headers | `helmet` sets Content-Security-Policy, X-Frame-Options, etc. |
| Brute-force protection | `express-rate-limit` on `/api/auth` (30 req / 15 min) |
| Input sanitisation | Mongoose schema validation + `trim` + `maxlength` constraints |
| Role enforcement | Middleware checks `req.user.role` on every protected route |
| Duplicate import prevention | Unique partial index on `(hospital, sourceRecord)` in MongoDB |

---

## Hospital Record Transfer Workflow

```
Clinician (Target Hospital)         Patient              Source Hospital
        │                              │                        │
        │── POST /shares/request ──▶   │                        │
        │   (patient email, source     │                        │
        │    hospital)                 │                        │
        │                             │◀── status: requested ──│
        │                             │                        │
        │                        [Reviews request]             │
        │                             │                        │
        │                             │── POST /shares/:id/approve ──▶
        │                             │                        │
        │◀── status: approved ────────│                        │
        │                             │                        │
        │── POST /shares/:id/import ─▶│                        │
        │   (copies records with       │                        │
        │    provenance metadata)      │                        │
        │                             │                        │
        │   [Can re-import as new     │                        │
        │    records are added]        │                        │
        │                             │                        │
        │                        [Patient revokes]             │
        │                             │                        │
        │                             │── POST /shares/:id/revoke ──▶
        │                             │   (future imports blocked;  │
        │                             │    existing copies retained)│
```

**Key rules enforced by the system:**

1. A share request is unique per `(patient, sourceHospital, targetHospital)` combination while `status` is `requested` or `approved`.
2. Only the patient identified by the email in the request can approve or reject.
3. Import operations are idempotent: the `(hospital, sourceRecord)` unique index prevents duplicate records even if import is run multiple times.
4. Revocation is soft: already-imported copies remain at the target hospital; only future imports are blocked.
5. Imported records carry `sourceHospital`, `sourceRecord`, `importedThrough`, `importedBy`, and the original `recordedAt` — full audit trail.

---

## Project Structure

```
CareLink/
├── package.json                  # Root scripts (dev, build, install:all)
├── .gitignore
├── README.md
│
├── frontend/                     # React 18 SPA (Vite)
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── main.jsx              # React root mount
│       ├── App.jsx               # All pages & routing logic
│       ├── styles.css            # Global design system
│       ├── auth.css              # Authentication page styles
│       └── sharing.css          # Record sharing UI styles
│
└── backend/                      # Express REST API
    ├── server.js                 # App entry point, middleware, route mounting
    ├── seed.js                   # Demo data seeder
    ├── .env.example              # Environment variable template
    ├── package.json
    └── src/
        ├── middleware/
        │   └── auth.js           # JWT verification middleware
        ├── models/
        │   ├── User.js
        │   ├── Hospital.js
        │   ├── Appointment.js
        │   ├── MedicalRecord.js
        │   └── RecordShare.js
        └── routes/
            ├── auth.js
            ├── doctors.js
            ├── appointments.js
            ├── records.js
            ├── hospitals.js
            └── shares.js
```

---

## Setup & Installation

### Prerequisites

- **Node.js** 18 or higher
- **MongoDB** 6 or higher (local installation or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier)

### Steps

```bash
# 1. Clone the repository
git clone <repository-url>
cd CareLink

# 2. Install all dependencies (root + backend + frontend)
npm run install:all

# 3. Configure the backend environment
cp backend/.env.example backend/.env
# Edit backend/.env and set:
#   MONGODB_URI=mongodb://localhost:27017/carelink
#   JWT_SECRET=your-strong-secret-here
#   CLIENT_ORIGIN=http://localhost:5173   (optional, defaults to this)

# 4. (Optional) Seed demo data
npm run seed --prefix backend

# 5. Start both servers
npm run dev
```

| Service | URL |
|---|---|
| Frontend (React SPA) | http://localhost:5173 |
| Backend API | http://localhost:4000/api |
| Health check | http://localhost:4000/api/health |

> **Note:** The API starts without MongoDB if `MONGODB_URI` is not set, but all database-dependent routes will fail. The frontend includes built-in demo data that works without a database connection.

---

## Demo Credentials

After running `npm run seed --prefix backend`, use these credentials:

| Role | Email | Password | Hospital |
|---|---|---|---|
| Patient | `alex.morgan@carelink.demo` | `CareLinkDemo123!` | — |
| Doctor | *(seeded clinician email)* | `CareLinkDemo123!` | Northstar General Hospital |
| Doctor | *(seeded clinician email)* | `CareLinkDemo123!` | Lakeview Medical Center |

The seed creates:
- **Northstar General Hospital** — source hospital with patient records.
- **Lakeview Medical Center** — receiving hospital for cross-hospital transfer demo.
- Sample clinician accounts attached to each hospital.
- A demo patient (`alex.morgan@carelink.demo`) with pre-existing records at Northstar.

> ⚠️ **Do not use demo credentials in production.** Provision verified hospital and clinician accounts through a trusted administrator workflow.

---

## Scripts Reference

| Command | Description |
|---|---|
| `npm run dev` | Start API and frontend concurrently (development) |
| `npm run server` | Start only the backend API (`nodemon`) |
| `npm run client` | Start only the frontend Vite dev server |
| `npm run build` | Build the frontend production bundle |
| `npm run install:all` | Install dependencies for root, backend, and frontend |
| `npm run seed --prefix backend` | Seed demo hospitals, clinicians, and patient into MongoDB |

---

## Limitations & Future Work

| Area | Current State | Potential Improvement |
|---|---|---|
| File attachments | Records store text summaries only | Add binary file upload (e.g., PDFs, DICOM images) via S3 or GridFS |
| Notifications | Dashboard polling only | WebSocket or push notification for real-time alerts |
| Audit logging | Implicit via MongoDB timestamps | Dedicated immutable audit log collection |
| Search | Basic name/specialty filter | Full-text search with Atlas Search or Elasticsearch |
| Admin tooling | Minimal admin dashboard | Full user/hospital lifecycle management |
| Testing | No automated tests | Unit tests (Vitest), integration tests (Supertest) |
| Deployment | Local development only | Docker Compose, CI/CD pipeline, HTTPS/TLS |
| FHIR compliance | Proprietary schema | Align record schema with HL7 FHIR R4 standard |
| Two-factor auth | Not implemented | TOTP-based 2FA for clinical accounts |
| Pagination | Not implemented | Cursor-based pagination on list endpoints |
