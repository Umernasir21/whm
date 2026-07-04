# Contributing & Onboarding — WMS

Welcome. This guide gets a new developer productive on the WMS in ~15 minutes.

## 1. Stack at a glance

| Layer | Tech | Location |
|---|---|---|
| Backend | Laravel 12, PHP 8.2+, Sanctum | `backend/` |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind | `frontend/` |
| DB | MySQL 8 in prod; SQLite for tests | `backend/database/` |

## 2. First-time setup

```bash
# Backend
cd backend
composer install
cp .env.example .env
php artisan key:generate
# point DB_* at a MySQL 8 database (or use the Docker stack — see docs/DEPLOYMENT.md)
php artisan migrate --seed
php artisan serve                # http://localhost:8000

# Frontend
cd ../frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
npm run dev                      # http://localhost:3000
```

## 3. Seeded logins (dev only — change before production)

| Email | Password | Role | Can delete? | Sees logs? |
|---|---|---|---|---|
| `admin@wms.com` | `Admin@Wms2025` | super_admin | ✅ | ✅ |
| `abdullah@wms.com` | `Abdullah#7412` | staff | ❌ | ❌ |
| `arsum@wms.com` | `Arsum#5309Xy` | staff | ❌ | ❌ |
| `jawed@wms.com` | `Jawed#8621Qz` | staff | ❌ | ❌ |

## 4. Key screens

| Route | Purpose |
|---|---|
| `/sales-orders` | Full SO flow (create, ship, invoice, label) |
| `/purchase-orders` | PO create grid + list |
| `/console` | Multi-module data console (inventory, vendors, returns, …) |
| `/activity-logs` | **Admin-only** audit trail |

## 5. Architecture rules (please follow)

- **Money is stored as integer cents** and cast via `App\Casts\Money`. Enter/return dollars at the edges; never do float math on money in the DB.
- **Business logic lives in services** (`app/Services`), not controllers. Controllers validate (FormRequest or inline) and delegate.
- **Every write is transactional** where it spans multiple rows (see `SalesOrderService`, `InventoryService`).
- **Document numbers** come from `SequenceService` (gapless, row-locked). Never hand-roll SO/PO/INV/RMA numbers.
- **Auditing is automatic**: add `use App\Models\Concerns\LogsActivity;` to a model and creates/updates/deletes are recorded with the acting user. Don't log by hand.
- **Access control**:
  - Only admins delete — enforced globally by the `admin.deletes` middleware. Don't add per-controller delete bypasses.
  - Admin-only screens/endpoints use the `admin.only` middleware (e.g. activity logs, login history).
  - Per-feature permissions are checked via `$user->hasPermission('module.action')`.
- **Migrations must be portable** (MySQL + SQLite). Guard MySQL-only DDL (`FULLTEXT`, `MODIFY ENUM`) behind `DB::getDriverName() === 'mysql'`. Prefer `SUBSTR(...)` over `DATE_FORMAT`, correlated subqueries over `HAVING` without `GROUP BY`, and join names in PHP instead of `CONCAT`.

## 6. Running tests

```bash
cd backend
vendor/bin/phpunit --testdox        # runs against in-memory SQLite
```
`tests/Feature/AccessControlTest.php` covers the delete/log/attribution rules and the SO cost-basis math. **Add a test with every behavioural change.**

Frontend type safety:
```bash
cd frontend
npx tsc --noEmit
```

## 7. Branch & PR flow

1. Branch off `main`: `git checkout -b feat/<short-name>`.
2. Keep commits focused; run `phpunit` + `tsc` before pushing.
3. Open a PR; describe what changed and how you verified it.
4. Never commit `.env`, `vendor/`, `node_modules/`, or a real database.

## 8. Where to read next

- [`GAP_ANALYSIS.md`](GAP_ANALYSIS.md) — what's built vs. the backlog.
- [`REQUIREMENTS_TRACEABILITY.md`](REQUIREMENTS_TRACEABILITY.md) — every original requirement → code.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — deeper design notes.
