# React + Vite

## Account email and Google sign-in

The `create-mother`, `create-staff`, and dedicated `password-reset` Edge Functions share the Brevo sender configured by these Supabase secrets:

- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME` (optional)
- `DASMOM_APP_URL` (optional, defaults to `https://dasmom.vercel.app/`)

Deploy the functions after setting those secrets, including `google-account-check` and `password-reset`. Password reset links always target `https://dasmom.vercel.app/reset-password`. In Supabase Authentication, enable the Google provider with the Google OAuth client ID and secret, and add the deployed DasMom URL plus the Supabase callback URL to the Google OAuth client's authorized redirect URIs. The login UI checks the entered email against an existing DasMom account before starting OAuth; Google must return that same email. Supabase identity linking must remain enabled so the Google identity is attached to the existing Auth user rather than creating a second application account.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
