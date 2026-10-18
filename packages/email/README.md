# @ak5/email

React Email templates + Cloudflare Email Sending through a native Worker binding.
Dev/CI use a local mock. See [sender setup](../../docs/operations/email-sending.md)
for manual account/domain onboarding and live inbox verification.

## Templates

| Template        | Subject                  | Triggered by                  |
| --------------- | ------------------------ | ----------------------------- |
| `VerifyEmail`   | "Verify Email"           | Registration, resend          |
| `ResetPassword` | "Reset Password"         | Forgot-password (web + admin) |
| `LoginWith`     | "Account Access Attempt" | Magic-link reauth             |
| `InviteAccount` | "You are invited"        | Admin-created account invite  |

Each template's prop interface is exported (`VerifyEmailProps`, etc.) and
re-exported from the package barrel.

## API

```ts
import { sendTemplate, renderTemplate, sendEmail, type EmailConfig } from '@ak5/email';

const config: EmailConfig = {
	email: env.EMAIL,
	fromAddress: env.PUBLIC_EMAIL_FROM,
	fromName: 'Your app'
};

// One-shot render + send
await sendTemplate(config, 'VerifyEmail', recipient, { pin, appUrl });

// Or render to HTML separately (e.g. for preview / archival)
const { html, subject } = await renderTemplate('VerifyEmail', { pin, appUrl });
await sendEmail(config, recipient, subject, html, logger);
```

## Dev servers

```bash
pnpm --filter @ak5/email preview   # React Email preview (port 8354)
pnpm --filter @ak5/email mock      # mock send endpoint (port 8355)
```

The mock captures every email sent in dev. Endpoints:

- `GET /emails` — list captured
- `GET /emails/to/:address/pin` — extract PIN
- `GET /emails/to/:address/magic-link` — extract magic-link URL/token
- `DELETE /emails` — clear buffer

The `@ak5/cli` integrates with the mock via `pnpm cli emails …`.

## Test delivery

Run a local mock delivery test:

```bash
pnpm --filter @ak5/email mock
pnpm --filter @ak5/email test:send --to test@example.com --mock-url http://localhost:8355
curl http://localhost:8355/emails/to/test%40example.com/pin
```

Use `pnpm email:test --real --to intended-recipient@example.com --from sender@example.com`
for an explicit Cloudflare REST diagnostic outside Workers. It requires process
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` with Email Sending:Edit. The
manual `email-delivery` workflow runs this diagnostic too. Neither verifies the
application delivery path; follow the setup guide to check an actual application
message in a consented inbox.

## Failure contract

Sending resolves `true` only after mock capture (`success: true`) or a native
`messageId`. Missing bindings, missing IDs, network errors, and provider rejections
throw `EmailDeliveryError`. Redacted structured failure events contain only
`event`, `transport`, and `code`. Never log recipients, body, links, or raw errors.
Authenticated sends await delivery; public recovery settles failures in the
background without changing its response. `pnpm test:unit` includes transport,
REST diagnostic, and caller failure tests.

## Adding a template

1. Create `src/templates/your-template.tsx` exporting the React component as
   default + a props interface.
2. Register in `src/send.ts` `TEMPLATE_REGISTRY` with a subject.
3. Add to the `TemplateProps` type.
4. Re-export from `src/index.ts`.
5. Update this README's table.
