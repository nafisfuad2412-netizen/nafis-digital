# Nafis Digital — Cloudflare Pages

A multi-page website with Cloudflare Pages Functions, D1, and Cloudflare Access.
The `public` folder is the Pages build output; `functions` contains the API.
Local preview data, passwords, leads, and unpublished client reports are not included.

## Before connecting

The static site can be built immediately, but **the contact form and admin panel
will not work until D1 and Cloudflare Access are configured**. Do not use this
repository's older Node/SQLite localhost server as a public backend. The old
localhost admin password and local inquiries do not transfer automatically.

## 1. Connect the GitHub branch

1. In Cloudflare, open **Workers & Pages**, create an application, and choose
   **Pages → Connect to Git**.
2. Select `nafisfuad2412-netizen/nafis-digital` and the `cloudflare-ready` branch.
3. Framework preset: **None**. Build command: leave blank (or use `exit 0` if a
   command is required). Build output directory: `public`. Root directory: `/`.
4. Deploy. This creates a Pages URL. The public website is viewable, while the
   admin API fails closed until Access is configured.

The `functions` folder is at the repository root. Pages detects it during Git
builds. `_routes.json` directs only `/api/*` and `/uploads/*` through Functions.

## 2. Create and connect the D1 database

1. In Cloudflare, create a D1 database named `nafis-digital`.
2. Open the database's SQL console and run the contents of `schema.sql`.
   Run it once on a new, empty database. Back up existing data before repeating.
3. In the Pages project, open **Settings → Bindings → Add → D1 database**.
   Set the binding name to **DB** and select the new database.
4. Bind the production environment and redeploy for the binding to take effect.

The schema seeds the three existing case studies and the website's initial
content. Screenshot files are not included; upload each verified image in the
admin panel after setup. Image uploads are limited to 900 KB each.

## 3. Configure the separate admin sign-in

The online admin uses Cloudflare Access, not the localhost password. Cloudflare
Access must be configured and tested before using the panel. Cloudflare's current
Zero Trust onboarding asks for payment details even on its free plan; verify
the displayed plan and charges in your account before completing signup.

1. Set up Cloudflare Zero Trust. Create **one** self-hosted Access application
   with public destinations covering the same website hostname and these paths:
   `/admin.html`, `/api/session`, and `/api/admin/*`. Leave `/api/public`,
   `/api/contact`, and published `/uploads/*` available to the public.
2. Create an Access allow policy for the administrator's email address only.
   Enable the Cloudflare identity provider or set up one-time PIN login.
   Enable MFA through the identity provider or Cloudflare Access as appropriate.
3. In the Pages production environment, set:
   - `CF_ACCESS_TEAM_DOMAIN` — e.g. `your-team.cloudflareaccess.com`
   - `CF_ACCESS_AUD` — the Access application's audience (AUD) tag
   - `ADMIN_EMAIL` — the admin's allowed email (defaults to
     `nafisfuad2412@gmail.com` if omitted).
4. Redeploy, visit `/admin.html`, and complete the Cloudflare Access login.
   All three protected paths must be covered by the **same** Access app so
   the application token's audience matches. Cloudflare's `pages.dev` Access
   behavior and preview aliases require extra care; verify on your actual
   production hostname, and repeat the policy for a custom domain if added.
5. In a private browser window, verify that `/api/admin/dashboard` returns
   no private data and that Cloudflare prompts for authentication when
   opening `/admin.html`. Verify your own login and test each admin function.

The function independently verifies the Access JWT signature, issuer, audience,
expiry, and allowed email on private requests. A missing configuration, invalid
token, or unauthorized identity is denied. The sign-out button signs out of
Cloudflare Access, which may also sign you out of other Access applications.

## 4. Configure email notifications

New inquiries are stored in D1 even when email is not configured or fails. To
send notifications to `nafisfuad2412@gmail.com`, add these private server-side
variables to the Pages production environment:

- `RESEND_API_KEY` — add as an encrypted **secret**.
- `NAFIS_MAIL_FROM` — a sender accepted by Resend, such as a verified-domain
  address. Never put an API key in source files, GitHub, or browser code.

Redeploy and send a real test. In the admin lead view, `accepted` means the
email provider accepted the request; it does not guarantee inbox delivery.
HTTP and network failures are recorded without deleting the inquiry. Email is
not configured or verified by the source code alone.

## Important launch checks

- The three campaign report screenshots are currently placeholders. Check
  permissions and anonymize client/account information before publishing them.
- Verify the definition of the six website results before describing them as
  purchases.
- Choose a retention/deletion policy and finalize the privacy policy.
- Add a verified domain, canonical URLs, sitemap, and production SEO metadata.
- Test desktop, mobile, video/audio, contact, administrator access, public data
  isolation, uploads, email delivery, backups, and Cloudflare resource limits.
- Keep Cloudflare Access and the D1 admin endpoints protected on every hostname
  and preview deployment. Consider disabling unneeded preview deployments.
- Free-plan limits apply to Functions and D1; usage over those limits can stop
  dynamic requests until the quota resets.

## Test locally

Node.js 24 or newer is required for the test harness.

```
npm test
```

The tests simulate D1 using SQLite and validate signed test Access tokens; they
do not replace an actual deployed Cloudflare test.

Documentation:
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/pages/functions/pricing/
