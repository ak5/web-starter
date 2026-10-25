# Cloudflare Email Sending

The API Worker sends transactional mail through its native `EMAIL` binding.
Local development and CI capture mail through `EMAIL_MOCK_URL`. Each consuming
app must configure its own account, verified sender domain, and sender address.
Rebranding the starter does not onboard a domain or enable billing.

## Account and domain prerequisites

1. Use the consuming app's Cloudflare account with **Workers Paid** billing and
   **Email Sending enabled**. Open https://dash.cloudflare.com/, select that
   account, then Compute → Email Service → Email Sending. Enablement and any new
   billing agreement are manual owner actions; do not assume a deployed Worker
   means this service is ready.
2. Onboard the app's actual sender domain, managed by Cloudflare DNS. Use the
   exact records shown during onboarding: `cf-bounce` MX and SPF, plus DKIM and
   DMARC. Preserve the root domain's MX records and existing inbound mail. Keep exactly one DMARC TXT record per hostname. A shared domain policy applies
   to every sender, including an existing mailbox provider. Keep its reporting
   addresses and policy unless deliberately changing them; `rua` is optional.
   Use `p=reject` only after each legitimate sender passes aligned SPF or DKIM.
3. Wait until the sender domain is verified. A domain or parent domain used by
   another app does not prove this app's configured sender is ready.
4. Give the deployment token **Email Sending:Edit** on that account, alongside
   the usual Worker, route, KV, and R2 permissions. Native runtime sending needs
   no email API token and no email credential in Worker secrets.

An unactivated account can return HTTP 403 with
`email.sending.error.email.sending_disabled`. Check billing, service enablement,
domain verification, and token permissions rather than repeatedly deploying.
Runtime logs intentionally expose only a redacted event, transport, and code.

## Worker configuration

`packages/api/wrangler.jsonc` declares this binding at the top level for production
and under `env.development` / `env.staging` for enabled non-production environments (bindings are not inherited):

```json
{
	"send_email": [{ "name": "EMAIL", "allowed_sender_addresses": ["sender@example.com"] }],
	"vars": { "PUBLIC_EMAIL_FROM": "sender@example.com" }
}
```

Set the GitHub repository or Environment variable `EMAIL_FROM` to the app's
verified sender (for example `sender@example.com`). Deploy and preview workflows
replace `__EMAIL_FROM__` in both the allowlist and `PUBLIC_EMAIL_FROM`; they must
agree. `EMAIL_FROM` is independent of `PROD_DOMAIN`, so the sender can use a
verified parent domain while the app runs on a subdomain. Unconfigured deploys
fail with a setup message rather than choosing an unverified sender. If staging uses a different sender, onboard that domain
and update its binding and variable too. Regenerate bindings with `pnpm cf-typegen`.
Leave `EMAIL_MOCK_URL` unset in deployed environments. **Staging and branch
previews send real mail** unless deliberately mocked or restricted. For controlled
validation, add `allowed_destination_addresses` with only intended test recipients
in staging; remove the restriction only when the app is ready for normal mail.
Never test with invented inboxes on real domains.

## Verify delivery before activation

Open a feature PR into `main`, verify its preview, then merge to hosted dev. Promote
the qualified SHA manually through the enabled environments. Deploys run
through GitHub Actions. Before merging into `main`, complete account/domain setup
and review whether non-production environments must restrict recipients.

In a configured environment, trigger an application signup, verification resend,
or password recovery for an intended, consented inbox. Confirm that the actual
application message arrives, its sender is correct, and its code/link works.
For an existing account, use `AK5_API_URL=https://api.example.com pnpm cli
forgot-password <intended-recipient>` (`--type admin` for an admin account).
Repeat on production after the release. HTTP 200, a native `messageId`, REST
`queued`, and provider acceptance alone do not verify inbox delivery. Public
password recovery deliberately gives the same response for existing and unknown
accounts, including when delivery fails; it is not a mail-health probe.

If no configured live deployment/domain exists, run local transport and failure
tests and report the missing setup explicitly. Keep any working email-provider
account and credentials until replacement delivery is verified; this migration
must not cancel accounts or revoke credentials.

## Diagnostics outside Workers

`pnpm email:test` captures a rendered verification template in the local mock.
For an explicit REST diagnostic, set `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` in the process environment (never commit them), then run:

```bash
pnpm email:test --real --to intended-recipient@example.com --from sender@example.com
```

The manual `email-delivery` workflow uses the selected GitHub Environment's
`CLOUDFLARE_ACCOUNT_ID` variable and `CLOUDFLARE_API_TOKEN` secret with
Email Sending:Edit. It sends one diagnostic
email, not an application recovery message; inbox confirmation is still required.
The REST endpoint is
`POST https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/email/sending/send`
with Bearer auth. REST accepts `from` as a string or `{address, name}`; the native
binding uses `{email, name}` and returns `{messageId}`. Keep REST credentials out
of the deployed runtime.

## Data processing

Cloudflare processes recipient addresses and transactional message content,
including verification and recovery links. Each consuming app must name
Cloudflare Email Service in its privacy notice/processor disclosure and review
its own data-processing agreement. The starter contains no product privacy
notice to publish unchanged. Application failure logs must never include
recipients, message bodies, auth links, credentials, or raw provider errors.

References: [Cloudflare onboarding](https://developers.cloudflare.com/email-service/get-started/send-emails/),
[Worker API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/),
[REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/),
[send binding restrictions](https://developers.cloudflare.com/email-service/configuration/send-bindings/).
