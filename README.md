# House of Stars

Production-oriented TypeScript monorepo for a Telegram Mini App, private administration panel, and grammY bot.

## Workspace layout

- `apps/miniapp` — mobile-first Next.js Telegram Mini App (port 3000)
- `apps/admin` — desktop-friendly private Next.js admin shell (port 3001)
- `apps/bot` — grammY bot and HTTP health server (port 3002)
- `packages/shared` — shared domain schemas and types
- `packages/database` — Supabase client factories
- `packages/telegram` — Telegram capability interfaces and validation contracts
- `packages/pricing` — pricing contracts
- `packages/wallet-validation` — payout and destination-validation contracts only
- `supabase/migrations` — PostgreSQL schema and Storage policies

## Prerequisites

- Node.js 22 or newer
- pnpm 10
- A Supabase project (or Supabase CLI for local services)
- A Telegram bot token for running the bot

## Local development

1. Run `pnpm install`.
2. Copy `.env.example` to the workspace-root `.env`, then fill in local values. The Mini App, admin server, and bot load this file; never commit it.
3. Apply migrations with your normal Supabase workflow (for example, `supabase db reset` when using the local CLI).
4. Run all applications with `pnpm dev`, or target one with `pnpm --filter @house-of-stars/miniapp dev`, `pnpm --filter @house-of-stars/admin dev`, or `pnpm --filter @house-of-stars/bot dev`.

Next.js exposes only variables prefixed with `NEXT_PUBLIC_` to browser bundles. The service-role key and Telegram bot token are server-only. Do not import `createServiceRoleClient` into Client Components.

## Telegram authentication

The Mini App reads only `Telegram.WebApp.initData` and posts it to `POST /api/auth/telegram`. The backend reconstructs Telegram's sorted data-check string, verifies its HMAC-SHA-256 signature using the server-only bot token, enforces the configured authentication age, parses the signed user object, and upserts that identity in Supabase. `initDataUnsafe` is never used as identity.

Successful authentication sets a signed, one-hour `HttpOnly` application session cookie. Production Mini App cookies are `Secure`, partitioned, and `SameSite=None` so they work when Telegram Web embeds the app cross-site; mutation middleware still enforces same-origin requests. Middleware protects `/api/me` and rejects missing, tampered, future-dated, or expired sessions. Add new authenticated API paths to the middleware matcher when they are introduced.

Set `APP_SESSION_SECRET` to at least 32 random characters. `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` defaults to 300 seconds. Rotating the session secret invalidates all current sessions.

## Quick Sell quoting

The Quick Sell wizard uses persisted, short-lived server quotes. Development defaults are controlled by `QUICK_SELL_MAX_USD`, `QUICK_SELL_COOLDOWN_DAYS`, `QUICK_SELL_QUOTE_TTL_SECONDS`, and `QUICK_SELL_USD_PER_STAR`. Configurable payout assets are supplied through `PAYOUT_ASSETS_JSON`; each entry must name both an asset and its blockchain network. The built-in rates are development placeholders and must be replaced by an approved server-side pricing source before production.

Order confirmation calls a service-role-only PostgreSQL function that locks and consumes the quote while creating the order. The function rechecks ownership, expiry, maximum value, cooldown, and active-order eligibility. It never broadcasts or signs a cryptocurrency transaction.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm db:test`, `pnpm format:check`, and `pnpm build`. The database test applies every migration to an ephemeral embedded PostgreSQL instance and runs the SQL verification suite.

Health endpoints are available at `http://localhost:3000/api/health`, `http://localhost:3001/api/health`, and `http://localhost:3002/health`.

### Opening the Mini App in Telegram

Telegram cannot open `localhost` on your computer as a Mini App and requires a public HTTPS URL. Start the Mini App, expose port 3000 with an HTTPS development tunnel, and set `MINIAPP_URL` to that public URL. Restart the bot, open its chat, and send `/start`; the same URL is also registered as the bot's menu button at startup.

Opening `http://localhost:3000` in an ordinary browser is useful for rendering diagnostics, but it cannot produce authenticated Telegram `initData`. Authentication intentionally succeeds only when Telegram opens the configured HTTPS Mini App URL. The bot token remains server-only and is never a substitute for signed `initData` in the browser.

## Deferred work

Admin authentication/authorization, real pricing, deployment configuration, generated Supabase database types, and payout-provider implementations remain intentionally unimplemented. Cryptocurrency signing/payouts and Telegram Stars processing are explicitly out of scope.
