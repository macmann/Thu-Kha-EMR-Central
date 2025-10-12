# Patient Portal Setup Guide

This guide walks through configuring the Thu Kha patient portal for demos or pilots. It covers base configuration, branding, SMS delivery, and bilingual content tips so that care teams can launch with confidence.

## 1. Quick Start Checklist

1. **Install dependencies**
   ```bash
   npm install
   cd patient-portal && npm install
   ```
2. **Apply database migrations**
   ```bash
   npm run migrate:deploy
   ```
3. **Load demo-friendly data**
   ```bash
   npm run seed:csv
   npm run seed:demo
   ```
   The `seed:demo` script provisions a reusable patient (`+95 9 7777 8888`) with linked clinic records, visits, invoices, and appointments so you can log into the portal immediately via OTP.
4. **Start the API** (from the repository root)
   ```bash
   npm run dev:api
   ```
5. **Start the patient portal**
   ```bash
   cd patient-portal
   npm run dev
   ```
6. Visit `http://localhost:3000`, enter the demo phone number, and follow the OTP prompts to explore the portal.

## 2. Branding & White-Label Options

Update `TenantConfiguration` and `tenant.portalBranding` values to align with your clinic’s identity:

- **Logo** – Upload an SVG or PNG to a public bucket (or the `patient-portal/public` directory) and set `tenantConfiguration.logo` to its URL.
- **Colors** – The `portalBranding.primaryColor` and `portalBranding.accentColor` keys drive Tailwind theme tokens. Pick accessible color pairs (contrast ratio ≥ 4.5:1).
- **Copy** – Customize marketing copy, hero banners, and footer contact info in `patient-portal/app/(public)` routes or via CMS integrations if you have one.
- **Feature toggles** – Set `tenant.enabledForPatientPortal` and `tenant.enabledForPatientBooking` to expose booking widgets or keep them hidden while you iterate.

Demo seeds already showcase two branded clinics (`Sunrise Family Clinic` and `Riverside Specialty Center`) as reference implementations.

## 3. SMS Provider Configuration

1. Choose an SMS gateway (e.g., Twilio, Wavecell, Telenor).
2. Populate the following environment variables for the API service:
   - `SMS_PROVIDER` – Identifier used by your messaging module.
   - `SMS_API_KEY` / `SMS_API_SECRET` – Credentials issued by the provider.
   - `SMS_DEFAULT_SENDER` – Short code or phone number patients will see.
3. Verify that the OTP service points to your provider (see `src/services/sms` if you extend the default implementation).
4. Run end-to-end tests with a staging number before enabling production traffic.

> [!TIP]
> Some Myanmar carriers throttle international senders. If you notice delays, request a local short code and register template messages early.

## 4. Bilingual Content Tips

- Use `react-i18next` namespaces (already wired into the portal) to supply both English and Burmese strings.
- Start with shared keys in `patient-portal/public/locales/en/common.json` and `.../my/common.json` to guarantee parity.
- Keep Burmese copy concise—mobile layouts reserve limited space.
- When transliterating names, store both spellings on the `GlobalPatient` record so clinic staff and patients see the context they expect.
- For SMS, favor Unicode delivery so that Myanmar text renders consistently across devices.

## 5. Production Hardening

- Configure HTTPS for both the API and Next.js deployments.
- Enable monitoring for OTP failure rates and high-latency SMS deliveries.
- Rotate demo credentials after testing and rely on patient self-registration flows in production.
- Audit clinic consent scopes regularly to respect patient privacy preferences.

Following these steps will leave you with a polished, branded portal that mirrors realistic clinic data out of the box.
