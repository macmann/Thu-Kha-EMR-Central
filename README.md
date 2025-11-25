# Thu Kha (သုခ) EMR  

## Project Overview
Thu Kha (သုခ) EMR is a reference implementation of an electronic medical record platform. It aligns with the BRD by offering patient lookup, visit tracking, clinical insights, and revenue-cycle tooling behind a JSON API protected by JWT authentication and rate limiting.

## Features
- **Authentication & access control** – JWT authentication with role-based authorization, password rotation flows, and rate-limited sensitive endpoints keep data access controlled for every staff persona. 
- **Patient management** – Fuzzy name search, patient registration, and detailed summaries bundle recent visits, diagnoses, medications, labs, vitals, and masked contact details for quick chart reviews.
- **Appointment scheduling** – Availability rules, blackout periods, overlap checks, and lifecycle transitions (including automatic visit creation when completing appointments) power reliable outpatient scheduling.
- **Clinical documentation & insights** – Visit encounters capture diagnoses, prescriptions, labs, and structured observations, while analytics endpoints surface patient-level summaries, lab-based cohorts, and latest visits.
- **Pharmacy & inventory operations** – Electronic prescribing with allergy checking, dispensing workflows, FEFO stock allocation, low-stock dashboards, invoice OCR (via OpenAI), and inventory adjustments cover the dispensary loop end-to-end.
- **Billing & revenue cycle** – Invoice creation, itemized adjustments, payment posting, automated totals, receipt generation, and pharmacy charge capture streamline point-of-sale and claims processes.
- **Reporting & dashboards** – Operational reports deliver patient and provider totals, department-level visit stats, top diagnoses, lab utilization, and rolling visit trends for leadership visibility.
- **Developer tooling** – TypeScript services, Prisma data models, and an OpenAPI contract make it straightforward to extend the API or integrate external agents.

## Installation & Setup

### Prerequisites
- Node.js 20+ and npm
- A PostgreSQL database (Neon, local Postgres, or compatible)
- `openssl` (or similar) to generate a `JWT_SECRET`
- Optional: an OpenAI API key for automated invoice scanning (`OPENAI_API_KEY`)
- Optional: a MongoDB deployment for observation note image storage

### Steps
1. **Clone and install dependencies**
   ```bash
   git clone <repo-url>
   cd EMR
   npm install
   ```
2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in database credentials (`DATABASE_URL`, `DIRECT_URL`), the observation image store connection (`MONGODB_URI` and optional `MONGODB_DB`), `JWT_SECRET`, rate-limit settings, and optional `OPENAI_API_KEY`/`OPENAI_INVOICE_MODEL` values.
3. **Provision the database** – Ensure the target PostgreSQL instance is running and reachable from your development machine.
4. **Apply migrations and seed demo data**
   ```bash
   npm run migrate:deploy
   npm run seed:csv
   npm run seed:demo
   ```
5. **Start the development servers**
   ```bash
   npm run dev
   ```
   The API is available at `http://localhost:8080` and the Vite-powered web client at `http://localhost:5173`.

### Creating additional clinics

Initial seed data provisions a single clinic and automatically links all active IT Administrators and Administrative Assistants to it. If you need to register another clinic later on, run the CLI helper and pass the clinic name (plus any admin email addresses that should receive access immediately):

```bash
npm run tenant:create -- --name "Downtown Clinic" --code downtown --admin admin@example.com
```

You can repeat `--admin` to associate multiple staff members. The command creates the clinic, ensures the slug/code is unique, and then grants the listed users access with their existing roles. IT Administrators without a clinic membership will see a "No clinics available" banner until they are assigned to at least one clinic.

## Neon PostgreSQL Setup
Provision a PostgreSQL instance on [Neon](https://neon.tech) and set the `DATABASE_URL` and `DIRECT_URL` in `.env` (include `sslmode=require` for both). Enable the required extensions:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
```

## Migrations & Seeding
Run the database migrations and load the demo CSV data any time you need to refresh your environment:
```bash
npm run migrate:deploy
npm run seed:csv
```

> [!NOTE]
> The custom `migrate:deploy` script automatically clears a previously failed
> `20250501000000_system_admin_role` migration (Prisma error `P3009`) before
> reapplying migrations. This ensures environments that encountered the earlier
> failure can recover without manual `prisma migrate resolve` commands.

## Staff Walkthrough
Try the scheduling workflow after seeding demo data:
1. Create an appointment for **Dr Tan** today from **10:00–10:30**.
2. Attempt to create another appointment for the same provider and timeslot — the system should block the double booking.
3. Mark the original appointment as complete and verify that the visit appears in the visit list.

## API Docs
The OpenAPI specification is served at `/api/docs/openapi.json`.

### Multi-tenant API access (Render deploy)

The Render deployment expects every request to include a clinic/tenant context. Use
the tenant code as the subdomain so requests are routed to the correct clinic:

```bash
curl -X GET "https://<tenant-code>.thu-kha-emr-saas.onrender.com/api/doctors"
```

Replace `<tenant-code>` with the clinic code you provisioned (for example,
`downtown` when created via `npm run tenant:create -- --code downtown`). The same
subdomain pattern applies to all API endpoints and the web client
(`https://<tenant-code>.thu-kha-emr-saas.onrender.com`).

If you cannot reach a tenant-specific subdomain (for example, while testing behind
certain proxies), include the tenant code explicitly using either the
`x-tenant-code` header or a `tenant`/`tenantCode` query string parameter:

```bash
curl -H "x-tenant-code: downtown" \
  "https://thu-kha-emr-saas.onrender.com/api/doctors"
```

## Deploying to Render
1. Create a new Web Service and connect this repository.
2. Configure environment variables:
   - `DATABASE_URL` (with `sslmode=require`)
   - `DIRECT_URL` (with `sslmode=require`)
   - `JWT_SECRET`
   - `RATE_LIMIT_WINDOW_MIN`
   - `RATE_LIMIT_MAX`
   - `MONGODB_URI`
   - `MONGODB_DB` (optional)
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. The start command now runs the Prisma seed automatically, so the default
   `sysadmin@example.com` user (and baseline data) is provisioned on first boot.

## Security Notes
- TLS is enforced by using `sslmode=require` for database connections.
- `express-rate-limit` protects patient and auth endpoints.
- Patient contact details are masked in logs and API responses.

## CSP & Nonce Setup (Dev vs Prod)
- Every incoming request receives a new 128-bit nonce in [`src/index.ts`](src/index.ts). The value is stored on `res.locals.cspNonce` and injected into the `%CSP_NONCE%` placeholder inside the built Vite HTML so inline tags that remain can opt in via `nonce="%CSP_NONCE%"`.
- Helmet enforces a request-scoped CSP that limits scripts and styles to `'self'` plus the generated nonce. `'unsafe-eval'` is appended only while developing to keep Vite HMR working; production responses omit it and block inline execution outright. Image and font sources are restricted to same-origin or data URIs, frames are disabled, and connections are limited to the app origin plus HTTPS/WebSocket endpoints.
- The Express fallback now reads `dist_client/index.html`, replaces `%CSP_NONCE%` with the runtime nonce, and serves the rendered HTML while `express.static` continues handling asset URLs without auto-injecting the HTML shell.
- `/manifest.webmanifest` is returned with the `application/manifest+json` MIME type so Lighthouse's PWA checks continue to pass under the tightened CSP.
