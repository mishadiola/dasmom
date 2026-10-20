# React + Vite

## Account email and Google sign-in

The `create-mother`, `create-staff`, and dedicated `password-reset` Edge Functions share the Brevo sender configured by these Supabase secrets:

- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME` (optional)
- `DASMOM_APP_URL` (optional, defaults to `https://dasmom.vercel.app/`)

Deploy the functions after setting those secrets, including `google-account-check` and `password-reset`. Password reset links always target `https://dasmom.vercel.app/reset-password`. In Supabase Authentication, enable the Google provider with the Google OAuth client ID and secret, and add the deployed DasMom URL plus the Supabase callback URL to the Google OAuth client's authorized redirect URIs. The login UI checks the entered email against an existing DasMom account before starting OAuth; Google must return that same email. Supabase identity linking must remain enabled so the Google identity is attached to the existing Auth user rather than creating a second application account.

Mother welcome emails and the patient registration screen link to the Android installer at the public `dasmom-apk/app-release.apk` object in Supabase Storage. Keep this bucket public and replace that object when publishing a new APK.

The mother chatbot loads postpartum appointments from `postpartum_visits`; delivery records remain in `deliveries`. These are separate tables in the current schema.

## Postpartum visit schedule

The `postpartum_visits` migration enables RLS and creates four visits for every new delivery: 24 hours, 3 days, 7 days, and 6 weeks after birth. Run the migration before deploying `postpartum-delivery-email`. That Edge Function uses the existing Brevo secrets to send the mother her congratulations and schedule; the delivery workflow reports a mail failure without discarding the recorded delivery or its visits.

## Visit rescheduling notifications

Apply `20261012145000_visit_rescheduling_metadata.sql` before deploying the frontend and `visit-reschedule-email`. The migration adds dedicated rescheduling metadata to prenatal visits, postpartum visits, and maternal/newborn vaccination records; existing clinical and general notes are left unchanged. The notification function uses the existing `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and optional `BREVO_SENDER_NAME` secrets configured for the other email functions. Rescheduling changes only the selected visit's scheduled date and rescheduling metadata; no prenatal rebalance or schedule-shifting function is called.

## Mother visit reminders (Android)

The Android mother app stores reminder schedules and add/reschedule alert history in the on-device SQLite database `dasmom_visit_notifications`. It reads the existing `prenatal_visits`, `postpartum_visits`, `newborns`, and `vaccinations` records, then schedules 7-day, 3-day, and 1-day reminders for prenatal, postpartum, maternal vaccination, and newborn vaccination appointments using Capacitor Local Notifications. Realtime visit additions and date changes also create a local alert. Reminder dates use the `Asia/Manila` calendar and are set for 9:00 AM local time; Android can deliver scheduled reminders without network access or the app running.

Build the mother-only Android web bundle with `npm run build:android`, then run `npx cap sync android`. This build excludes staff/admin routes and their page bundles; `npm run build` continues to produce the full website.

Android reboot recovery is supplied by the Local Notifications plugin's boot receivers. Notification permission is required, and Android may delay alerts when battery restrictions apply or when exact-alarm access is unavailable. If the app is force-stopped in Android settings, the operating system may not deliver alarms until the app is launched again. The mother dashboard reports permission, sync, and scheduling failures; reminders are counted as active only after the native pending-notification list confirms them.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Android mother offline access

The Android build opens on the mother login and does not expose staff/admin routes; the web app's staff/admin routes are unchanged. Supabase auth sessions are persisted through `@aparajita/capacitor-secure-storage`, which encrypts Android values with AES-GCM using a key held by Android Keystore. Passwords are never saved. Users upgrading from the older WebView-storage build must sign in online once; browser-stored sessions are not read or migrated. Thereafter, a previously signed-in mother can reopen the app offline using the last server-validated mother profile only while that account's secure Supabase session remains on the device. Server-side revocation, deactivation, and appointment changes cannot be detected until the device reconnects.

After the mother's authorized records are successfully downloaded, the app saves the assembled patient record in the app-private SQLite database `dasmom_mother_records`. Mother screens load that saved record when offline and refresh it from Supabase on launch or when connectivity returns. The database is keyed to the authenticated mother's own ID, other accounts' saved records are removed when switching accounts, and an explicit logout clears the local session, saved profile, patient record, and that mother's reminder schedules. Mother records are not stored in browser localStorage or an HTTP cache. The SQLite file uses Android's app-private storage; it is not separately SQLCipher-encrypted.

Offline access is available only after at least one successful online sign-in and record sync on that device. A newly installed app cannot authenticate a mother or display records for the first time without internet access. Reminder delivery is still handled by Android's native notification scheduler and requires notification permission.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
