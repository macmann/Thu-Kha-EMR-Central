# Patient Portal Feature Highlights

The patient portal pairs with Thu Kha EMR to deliver a secure, mobile-friendly experience for patients. Use this overview when introducing the portal to clinicians, operations leads, or prospective partners.

## Authentication & Security
- Passwordless OTP login with rate-limited verification to prevent abuse.
- Device fingerprinting hooks so clinics can recognize trusted devices.
- Consent-aware data access—only clinics that the patient has approved will surface records.

## Unified Health Timeline
- Recent visits consolidated with doctor notes, diagnoses, and prescribed medications.
- Lab results grouped by encounter with reference ranges and trend cues.
- Downloadable summaries to simplify referrals or specialist check-ins.

## Appointments & Booking
- Clinic-aware scheduling that respects provider availability and blackout windows.
- Status-aware cards (Scheduled, Completed, Cancelled) with reminders when enabled.
- One-click reschedule requests that alert front-desk teams through the EMR inbox.

## Billing Transparency
- Itemized invoices with service codes, discounts, taxes, and payment receipts.
- Outstanding balance alerts plus quick links to clinic payment instructions.
- Optional integration hooks for online payments or mobile wallet proof-of-payment uploads.

## Communication & Engagement
- SMS and in-app notification pipeline for appointment reminders or lab-ready alerts.
- Bilingual content powered by `react-i18next`, enabling English and Burmese parity out of the box.
- Configurable announcements so clinics can broadcast vaccine drives, holiday hours, or policy updates.

## Accessibility Considerations
- Responsive layout built with Tailwind CSS ensures usability on low-cost Android devices.
- High-contrast themes and font scaling support readability for older patients.
- Offline-friendly caching (Next.js App Router + service worker) keeps recent data available during spotty connectivity.

These pillars are reflected in the demo data loaded by `npm run seed:demo`, making it easy to showcase end-to-end flows during stakeholder demos.
