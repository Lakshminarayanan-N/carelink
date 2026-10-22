# CareLink — Healthcare Coordination & Cross-Facility Record Platform

> An enterprise full-stack healthcare coordination system engineered with zero-trust data isolation between clinical facilities, patient-governed record transfers, brute-force defense, and central administrator oversight.

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Live Deployments](#live-deployments)
3. [Core Security Architecture](#core-security-architecture)
4. [Role-Based Portals](#role-based-portals)
5. [Hospital Data Isolation & Transfer Protocol](#hospital-data-isolation--transfer-protocol)
6. [Technology Stack](#technology-stack)
7. [API Reference](#api-reference)
8. [Database Schema](#database-schema)
9. [Local PC Development & Setup](#local-pc-development--setup)
10. [System Access Accounts](#system-access-accounts)
11. [Project Structure](#project-structure)

---

## Platform Overview

**CareLink** is a production-grade healthcare coordination and inter-hospital medical records platform providing:

- **Strict Hospital Data Isolation**: Each hospital and clinic functions within an isolated chart repository. One facility cannot access another facility's records without patient consent or formal inter-facility transfer.
- **Bi-Directional Cross-Hospital Transfer Protocol**: Participating hospitals can both request patient charts from peer institutions and dispatch/send records directly to receiving hospitals.
- **Patient Sovereignty**: Patients review and authorize all chart requests before records leave any medical facility, and can revoke consent at any time.
- **Central Super Administrator Console**: System-wide oversight to monitor records across all hospitals, inspect real-time transfer audit logs, enroll new clinical facilities, and govern user accounts.
- **High-Security Authentication & Universal Logout**: Brute-force account lockout (5 failed attempts locks the account for 15 minutes), live password entropy analysis, TLS 1.3 encryption, and prominent logout controls on every screen.

---

## Live Deployments

| Component | URL | Status |
| :--- | :--- | :--- |
| **Web Application** | [frontend-five-rosy-ccuw13vq3y.vercel.app](https://frontend-five-rosy-ccuw13vq3y.vercel.app) | Live |
| **REST API Server** | [backend-nine-beta-29.vercel.app/api](https://backend-nine-beta-29.vercel.app/api) | Live |
| **API Health Check** | [backend-nine-beta-29.vercel.app/api/health](https://backend-nine-beta-29.vercel.app/api/health) | Live |
| **Database Cluster** | MongoDB Atlas (Cluster 0, AWS) | Connected |

---

## Core Security Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Zero-Trust Web Client                         │
│  React 18 · Vite · Dynamic API Routing · Brute-Force Defense UI        │
│  ┌─────────────────────────┬────────────────────────────────────────┐  │
│  │   Universal Topbar      │ [Secure Log Out] Button on Every View  │  │
│  └─────────────────────────┴────────────────────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ Patient Portal  │  │ Hospital / Clinic   │  │ Super Admin Console │ │
│  │ Personal Charts │  │ Facility Isolation  │  │ System-Wide Audit   │ │
│  │ Consent Manager │  │ Request & Send Hub  │  │ All Facilities/Logs │ │
│  └─────────────────┘  └─────────────────────┘  └─────────────────────┘ │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS / TLS 1.3 (Bearer JWT)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     CareLink Express Secure API                        │
│                                                                        │
│  Middleware Pipeline:                                                  │
│  ├── Helmet (Security Headers & CSP)                                   │
│  ├── CORS (Cross-Origin Protection)                                    │
│  ├── Rate Limiter (Brute-force protection & Trust Proxy validation)   │
│  ├── Serverless Database Connection Manager                            │
│  └── JWT Authentication & Role-Based Authorization Guard               │
│                                                                        │
│  Route Enforcements:                                                   │
│  ├── /api/auth       → Lockout tracking & credential verification      │
│  ├── /api/records    → Strict hospital isolation (req.user.hospital)   │
│  ├── /api/shares     → Cross-hospital Request & Send protocols         │
│  ├── /api/admin      → Full-system metrics, audit feeds & directories  │
│  └── /api/hospitals  → Facility lifecycle management                   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Mongoose ODM (TLS / Connection Pool)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      MongoDB Atlas Cloud Cluster                       │
│  Collections: users · hospitals · medicalrecords · recordshares        │
│               appointments                                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Role-Based Portals

### 1. Patient Portal
- **Health Records**: Personal medical history including consultations, laboratory workups, prescriptions, and radiology imaging.
- **Provider Scheduling**: Browse clinicians across medical specialties and schedule appointments.
- **Data Sharing Consents**: View pending requests from external hospitals, grant approval with immediate chart transfer, decline requests, or revoke active access.

### 2. Hospital & Clinic Portal
- **Facility Isolation**: Clinicians and records staff can only access charts created within their facility or formally transferred.
- **Request Records Protocol**: Initiate requests for patient charts held at another healthcare institution.
- **Send Records Protocol**: Directly dispatch patient records from this facility to another partner hospital or clinic.
- **Inbound Authorization**: Authorize and release records requested by partner healthcare institutions.

### 3. Super Administrator Console
- **System KPIs**: Live totals for registered hospitals, patients, clinicians, medical records, and network transfers.
- **Cross-Hospital Records**: View and filter medical records across all healthcare institutions in the network.
- **Transfer Audit Feed**: Real-time log of every inter-hospital chart request, approval, and revocation.
- **Hospital Directory**: Facility enrollment, member counts, and organization management.
- **User Accounts**: System-wide identity and access management.

---

## Hospital Data Isolation & Transfer Protocol

To comply with patient privacy and healthcare data regulations, CareLink enforces:

1. **Isolation at the Query Level**:
   Every database query in `/api/records` automatically injects `{ hospital: req.user.hospital }` when requested by hospital staff or clinicians. Attempting to pass or access another hospital's ID returns `403 Forbidden`.
2. **Provenance Preservation**:
   When records are transferred between hospitals via `/api/shares/send` or an approved request, the copied records store:
   - `hospital`: The receiving hospital.
   - `sourceHospital`: The originating institution.
   - `sourceRecord`: Foreign key to original record.
   - `importedThrough`: Reference to the transfer agreement.
   - `importedBy`: User identity who initiated the transfer.
3. **Soft Revocation**:
   If a patient revokes a transfer, copies already entered into the receiving hospital's medical chart remain preserved (for medical-legal chart integrity), but all future synchronizations are permanently blocked.

---

## Technology Stack

- **Frontend**: React 18, Vite, Lucide React icons, Custom Healthcare Design System (CSS).
- **Backend**: Node.js, Express 4, Mongoose 8, Helmet, CORS, Morgan, express-rate-limit, bcryptjs, jsonwebtoken.
- **Database**: MongoDB Atlas 8.0 (Replica Set).
- **Cloud Hosting**: Vercel Serverless Functions (API) & Vercel Edge Network (Web).

---

## API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new patient account.
- `POST /api/auth/login` — Sign in with brute-force lockout protection (5 failed attempts locks for 15 minutes).
- `GET /api/auth/me` — Retrieve current authenticated session and facility association.
- `PATCH /api/auth/me` — Update profile or change password.

### Medical Records (`/api/records`)
- `GET /api/records` — Fetch records scoped strictly to user role (Patients get their own, Hospitals get only their facility records, Admins get all).
- `POST /api/records` — Create a new clinical chart entry (Clinicians/Staff locked to their facility).

### Cross-Hospital Transfers (`/api/shares`)
- `GET /api/shares` — List transfer requests involving the user or facility.
- `POST /api/shares` — Request patient records from another hospital.
- `POST /api/shares/send` — Dispatch patient records directly to another hospital.
- `PATCH /api/shares/:id/approve` — Authorize a record transfer (Patient or Source Hospital).
- `PATCH /api/shares/:id/reject` — Decline a record transfer.
- `PATCH /api/shares/:id/revoke` — Revoke active record access.
- `POST /api/shares/:id/sync` — Synchronize new records under an approved transfer.

### Super Administration (`/api/admin`)
- `GET /api/admin/stats` — Central network statistics.
- `GET /api/admin/records` — All medical records across all hospitals (supports facility filter).
- `GET /api/admin/shares` — Audit feed of all inter-hospital transfers.
- `GET /api/admin/hospitals` — Hospital directory with registered staff counts.
- `GET /api/admin/users` — System-wide user directory.

---

## System Access Accounts

**Master Password for Verified Accounts**: `CareLink123!`

| Portal | Organization / Name | Account Email |
| :--- | :--- | :--- |
| **Patient Portal** | Alex Morgan | `alex.morgan@carelink.org` |
| **Patient Portal** | Sarah Jenkins | `sarah.jenkins@carelink.org` |
| **Hospital Portal (Facility 1)** | Northstar General Hospital | `records@northstarhealth.org` |
| **Hospital Portal (Facility 2)** | Lakeview Medical Center | `clinical@lakeviewhealth.org` |
| **Hospital Portal (Facility 3)** | Apex Health Institute | `records@apexhealth.org` |
| **Hospital Portal (Facility 4)** | St. Jude Wellness Center | `intake@stjudewellness.org` |
| **Clinician Portal** | Dr. Maya Chen (Cardiology) | `dr.chen@northstarhealth.org` |
| **Clinician Portal** | Dr. Priya Nair (Dermatology) | `dr.nair@lakeviewhealth.org` |
| **Super Admin Console** | System Administrator | `admin@carelink.org` |

---

## Local PC Development & Setup

### Prerequisites
- Node.js 18+
- npm 9+

### Running on your local machine:

1. **Install dependencies**:
   ```powershell
   npm run install:all
   ```

2. **Verify Environment Configurations**:
   - `backend/.env` is pre-configured with MongoDB Atlas, JWT secret, and port 4000.
   - `frontend/.env` is pre-configured to communicate with the local or cloud API.

3. **Start the Platform**:
   ```powershell
   npm run dev
   ```
   - Frontend runs on: `http://localhost:5173`
   - Backend API runs on: `http://localhost:4000/api`

4. **Build Production Bundle**:
   ```powershell
   npm run build
   ```

---

## Project Structure

```
CareLink/
├── package.json                  # Root scripts (dev, build, install:all)
├── README.md                     # Official system documentation
├── .gitignore
│
├── frontend/                     # React 18 Single-Page Application
│   ├── .env                      # Local frontend environment
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── main.jsx              # Application bootstrap & CSS imports
│       ├── App.jsx               # Role-based workspace & portal routing
│       ├── styles.css            # Base UI tokens & layout styling
│       ├── security.css          # High-security authentication & portal styling
│       └── sharing.css           # Inter-hospital transfer styling
│
└── backend/                      # Node.js Express REST API
    ├── server.js                 # Serverless connection manager & route mounting
    ├── seed.js                   # Database initialization script
    ├── .env                      # Environment variables & Atlas connection
    ├── package.json
    ├── vercel.json               # Serverless function configuration
    └── src/
        ├── middleware/
        │   └── auth.js           # JWT verification & role authorization guards
        ├── models/
        │   ├── User.js           # Accounts, brute-force counters & roles
        │   ├── Hospital.js       # Registered healthcare institutions
        │   ├── MedicalRecord.js  # Medical charts with provenance tags
        │   ├── RecordShare.js    # Inter-hospital transfer agreements
        │   └── Appointment.js    # Clinical visit schedules
        └── routes/
            ├── auth.js           # Authentication, lockout, and password controls
            ├── records.js        # Strict hospital-isolated chart operations
            ├── shares.js         # Inter-hospital transfer & dispatch engine
            ├── admin.js          # Super Admin oversight and audit feeds
            ├── hospitals.js      # Hospital directory operations
            ├── doctors.js        # Clinician registry
            └── appointments.js   # Visit management
```
