# Security

## Threat model

The platform accepts untrusted input from Telegram clients, ordinary browsers, uploaded files, and private admin browsers. Attackers may forge Telegram identity data, replay requests, enumerate sequential order numbers, alter quotes or wallet destinations, upload hostile files, brute-force admin credentials, trigger duplicate orders or payouts, or attempt to expose server credentials. A compromised service-role credential, Telegram bot token, administrator account, deployment platform, or database owner is outside the protection offered by application-level RLS and must be handled as an infrastructure incident.

Cryptocurrency signing and Telegram Stars payment processing are intentionally absent. No seed phrase, private key, signing key, payout API credential, or Stars transfer workaround belongs in this repository or its frontend environment.

## Mitigations

### Telegram authentication and sessions

- The backend validates `Telegram.WebApp.initData` with Telegram's HMAC construction, constant-time comparison, duplicate-field rejection, a five-minute default age, and future-clock-skew bounds.
- `initDataUnsafe`, URL parameters, usernames, and client-provided Telegram user IDs are never authoritative.
- Application sessions are HMAC-signed and expire after one hour. Mini App production cookies are HttpOnly, Secure, partitioned, and `SameSite=None` because Telegram Web may embed the app cross-site; admin cookies remain `SameSite=Strict`.
- Mutation middleware rejects cross-origin browser requests, providing the Mini App's CSRF boundary independently of its cross-site-compatible session cookie.

### Authorization and ownership

- Mini App APIs derive user identity only from the signed application session and add `user_id` or ownership predicates to every order, quote, sell-session, and evidence lookup.
- Sequential order numbers are display identifiers only. Detail queries combine them with authenticated ownership.
- Admin authentication uses Supabase Auth independently of Telegram. Every protected admin API rechecks membership in `admin_users` using the signed admin subject.
- Admin membership is never accepted from cookies, local storage, query parameters, Telegram usernames, or client booleans.

### Supabase and secrets

- The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` when configured. Service-role credentials are referenced only by server routes, middleware, the bot worker, and server-only packages.
- Application data is accessed through server APIs. The service-role client is never imported by a Client Component.
- RLS is enabled for all sensitive tables. Direct authenticated access is ownership/admin constrained; service-only workflow tables and functions revoke `anon` and `authenticated` access.
- Production browser bundles must be scanned for `SUPABASE_SERVICE_ROLE_KEY`, bot tokens, session secrets, seed phrases, and private keys before release.

### Rate limiting and CSRF

- `consume_api_rate_limit` provides an atomic PostgreSQL-backed fixed-window limiter shared by all instances.
- Telegram authentication is limited per source IP. Authenticated Mini App APIs are limited per hashed session and route. Admin login is limited per source IP; admin APIs are limited per hashed admin session and route.
- Rate-limit identifiers are SHA-256 hashes. Raw session tokens are not stored in the rate-limit table.
- Deploy only behind a trusted proxy that overwrites `X-Real-IP`/`X-Forwarded-For`; otherwise IP-based login limits can be spoofed.

### Uploads and storage

- Evidence is limited to JPEG, PNG, and WebP, eight MiB per file, and non-empty content.
- The backend verifies file signatures instead of trusting filenames or browser MIME declarations, hashes content with SHA-256, and rejects duplicate hashes per order.
- Storage object paths are generated server-side beneath the authenticated application user and owned order.
- The bucket is private. Evidence is returned only through short-lived signed URLs after ownership or admin authorization; permanent public URLs are not used.
- React renders user-visible text with escaping. There is no `dangerouslySetInnerHTML`, dynamic script execution, or user-controlled HTML rendering.

### Quotes, orders, and payouts

- PostgreSQL `NUMERIC` stores monetary values. TypeScript financial arithmetic uses `decimal.js` and decimal-string configuration; final values do not use JavaScript floating-point arithmetic.
- Quote financial terms are immutable. Quotes belong to one user, expire, and are atomically consumed once.
- Order creation functions lock quotes and use unique quote/order constraints to prevent duplicate orders.
- Wallets are parsed by explicitly configured asset/network validators. Successful backend validation is recorded and required before payout queueing.
- Payout queueing runs in one database transaction under an order row lock and verifies approval, settlement availability, wallet validation, positive values, quote consistency, and absence of an existing payout.
- `payouts.order_id` and `payouts.idempotency_key` are unique. Repeating the same queue request returns the existing record; a conflicting key cannot create another payout.
- Payout status transitions are constrained. Queue, broadcast, confirmed, failed, and cancelled milestones create immutable `order_events` directly or through synchronized order status transitions.
- The mock provider never signs or broadcasts transactions.

### Validation, queries, errors, and logs

- Zod validates request bodies and filters. PostgREST query builders and fixed database RPCs are used instead of concatenated SQL.
- Search input is character-restricted before it is placed in PostgREST filter expressions.
- Public API errors are generic. Database codes may be logged for diagnosis, but raw queries, sessions, wallet addresses, evidence paths, bot tokens, and service credentials must not be logged.
- React's normal escaping protects displayed names, statuses, notes, and identifiers against HTML injection.

## Known risks

- Fixed-window rate limiting permits a boundary burst of up to twice the configured limit. Replace it with a sliding-window algorithm if abuse patterns require it.
- IP limits depend on deployment proxy header sanitization. Configure the hosting platform's trusted-proxy behavior before production.
- Image signatures do not fully decode images or detect every polyglot, decompression-bomb, or malicious metadata payload. Add isolated image decoding/re-encoding and malware scanning before accepting high-risk uploads at scale.
- Signed URLs remain usable by anyone who obtains one until their short expiry. Avoid logging or sharing them and keep expiry short.
- Service-role APIs bypass RLS by design; correctness depends on signed-session verification and explicit ownership predicates. Changes to these APIs require security review.
- The notification ledger prevents normal worker retry duplicates, but no external API can guarantee exactly-once delivery across a process crash after Telegram accepts a message and before the database records success.
- Rate-limit rows require periodic operational cleanup after their windows have expired.
- Admin accounts depend on Supabase Auth security. Require strong passwords and enable MFA before production.
- No real payout provider is implemented. Adding one requires isolated key custody, withdrawal allow-lists, transaction simulation, reconciliation, and an independent review.

## Pre-production checklist

- [ ] Apply every migration to a clean staging database and run `pnpm db:test`.
- [ ] Generate independent, high-entropy `APP_SESSION_SECRET` and `ADMIN_SESSION_SECRET` values and rotate any development credentials.
- [ ] Verify no server secret uses a `NEXT_PUBLIC_` prefix.
- [ ] Scan generated browser assets and source maps for service-role keys, bot tokens, session secrets, private keys, mnemonics, and seed material.
- [ ] Confirm the Supabase Storage bucket is private and test cross-user evidence denial.
- [ ] Confirm production signed-URL expiry and disable sensitive URL logging at the proxy/CDN.
- [ ] Configure a trusted proxy to overwrite client IP headers and test rate limits from multiple application instances.
- [ ] Set strict production origins, HTTPS, HSTS, CSP, frame policy compatible with Telegram, `Referrer-Policy`, and `Permissions-Policy` at the deployment edge.
- [ ] Enable Supabase Auth MFA for administrators and establish admin provisioning/removal procedures.
- [ ] Review every service-role query for explicit ownership or admin checks.
- [ ] Test quote expiry, concurrent quote consumption, duplicate order submission, settlement holds, wallet changes, and concurrent payout queue requests against hosted PostgreSQL.
- [ ] Add isolated image re-encoding and malware scanning appropriate to the deployment risk profile.
- [ ] Configure retention/cleanup for rate-limit rows, expired sell sessions, expired quotes, and failed notification attempts.
- [ ] Ensure application logs redact cookies, authorization headers, initData, wallet addresses, signed URLs, evidence paths, and personal information.
- [ ] Back up PostgreSQL and private Storage, and test restoration and incident-response procedures.
- [ ] Do not enable Telegram Stars processing or real cryptocurrency payout execution until separately designed and reviewed.
