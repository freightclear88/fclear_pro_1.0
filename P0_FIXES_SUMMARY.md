# FreightClear Pro — P0 Fixes Summary

## Fix 1: Remove Replit OIDC Hard Dependency

**File changed:** `server/replitAuth.ts`

**Problem:** The server threw immediately on startup when `REPLIT_DOMAINS` was not set, making the app undeployable outside Replit.

**Fix:** Replaced the `openid-client`/Replit OIDC setup with `passport-local` backed by the existing `bcrypt` User model.
- Removed `REPLIT_DOMAINS` guard and all `openid-client` imports.
- Registered a `LocalStrategy` that looks up users by email and verifies bcrypt passwords.
- `setupAuth()` now sets up session, passport, serialize/deserialize, a GET `/api/login` redirect, and a proper session-destroying logout. POST `/api/login` continues to be handled by `routes.ts` (the existing bcrypt handler).

**Also fixed:** Two `REPLIT_DOMAINS` references in `routes.ts` (email notification helpers):
- `sendInvoiceNotification` — now uses `process.env.APP_URL || "http://localhost:5000"`
- `sendUserInvitationEmail` — same fallback

**Required env vars:**
| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | PostgreSQL connection string (already required) |
| `SESSION_SECRET` | Express-session secret |
| `APP_URL` | Public base URL for email links (e.g. `https://freightclear.ai`) |

---

## Fix 2: ISF $35 Charge Disabled

**File changed:** `server/routes.ts`

**Problem:** The ISF submission routes charged a $35 filing fee even though no real CBP/ABI filing system is wired up. Charging customers for a service not yet delivered.

**Fix:** Set `filingFee` to `0.00` and `paymentRequired` to `false` in all three ISF handler paths:
1. `POST /api/isf/filings/:id/submit` — submit response now returns `amount: 0.00, paymentRequired: false`
2. `POST /api/isf/create` (draft creation) — `filingFee: 0.00`
3. `POST /api/isf/create` (submit path) — `filingFee: 0.00`

Each disabled charge has a comment: *"ISF charge disabled: set to $0 until real CBP/ABI filing is implemented. Do not re-enable without wiring up actual ABI submission to CBP."*

**To re-enable:** Remove/update those comments and restore the fee once `xmlIntegrator` or ABI filing is connected to CBP.

---

## Fix 3: Google Cloud Storage

**File created:** `server/cloudStorage.ts`

**Class:** `StorageService` with:
- `uploadFile(buffer, destination, mimetype): Promise<string>` — uploads to GCS when `GOOGLE_CLOUD_BUCKET` is set; otherwise writes to `./uploads/` as a fallback.
- `getFileUrl(path): string` — returns a `https://storage.googleapis.com/...` URL (GCS) or `/uploads/<basename>` (local).

Also exports standalone `uploadFile` and `getFileUrl` helpers.

**File changed:** `server/routes.ts`
- Added `import { storageService, uploadFile as gcsUploadFile } from './cloudStorage'`
- In `POST /api/documents/upload` (primary upload handler): after AI extraction, reads the multer temp file and uploads to cloud storage, then updates the document DB record's `filePath` with the stored path. Failure is non-fatal (local file is retained).

**Required env vars:**
| Var | Purpose |
|-----|---------|
| `GOOGLE_CLOUD_BUCKET` | GCS bucket name. Omit to use local `./uploads/` fallback |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCS service account JSON (standard GCP env var) |

---

## Fix 4: Recurring Billing

**File changed:** `server/routes.ts`

**Added:** `export async function checkAndChargeRenewals(): Promise<void>`

Logic:
1. Queries all users via `storage.getAllUsers()`
2. Filters for `subscriptionStatus === 'active'` AND `nextBillingDate <= now` AND stored Authorize.net `customerProfileId`/`paymentProfileId`
3. For each overdue user: charges via `CreateTransactionRequest` using the stored customer payment profile (no card re-entry needed)
4. On success: advances `nextBillingDate` by one billing cycle, updates `lastPaymentDate`, `subscriptionEndDate`, resets `paymentFailureCount`, records a `PaymentTransaction`
5. On failure: increments `paymentFailureCount` (caller can implement retry/dunning logic on top)

**Usage:** Import and call on a schedule:
```typescript
import { checkAndChargeRenewals } from './routes';

// e.g. daily at 2am
cron.schedule('0 2 * * *', () => checkAndChargeRenewals().catch(console.error));
```

**Required env vars:**
| Var | Purpose |
|-----|---------|
| `AUTHORIZENET_API_LOGIN_ID` | Authorize.net API login ID |
| `AUTHORIZENET_TRANSACTION_KEY` | Authorize.net transaction key |
| `NODE_ENV` | Set to `production` to use live Authorize.net endpoint |

---

## All Required Env Vars (Combined)

| Var | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL |
| `SESSION_SECRET` | Yes | Express session signing |
| `APP_URL` | Recommended | Public base URL for email links |
| `GOOGLE_CLOUD_BUCKET` | Optional | GCS bucket; omit for local file storage |
| `GOOGLE_APPLICATION_CREDENTIALS` | If GCS | Path to GCP service account key file |
| `AUTHORIZENET_API_LOGIN_ID` | Yes (billing) | Authorize.net merchant credentials |
| `AUTHORIZENET_TRANSACTION_KEY` | Yes (billing) | Authorize.net merchant credentials |
| `NODE_ENV` | Recommended | `production` enables live payment endpoints |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Yes (email) | Nodemailer SMTP config |
