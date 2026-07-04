# WMS — Deployment Guide

A one-command Docker stack: Nginx + Laravel (PHP-FPM 8.4) + MySQL 8.4 + Redis + queue worker + Next.js.

## Prerequisites

- Docker + Docker Compose v2
- Ports free: 8000 (API), 3000 (frontend), 3306 (MySQL), 6379 (Redis)

## First run

```bash
# 1. From the project root
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# 2. Build and start the stack
docker compose up -d --build

# 3. Install PHP deps (first time only)
docker compose exec app composer install

# 4. Generate the app key
docker compose exec app php artisan key:generate

# 5. Run migrations + seed (creates RBAC, admin user, sample data)
docker compose exec app php artisan migrate --seed

# 6. Link storage for invoice PDFs
docker compose exec app php artisan storage:link
```

Open:
- Frontend: http://localhost:3000
- API: http://localhost:8000/api

## Login

The seeder creates two accounts (change the passwords immediately in production):

| Role  | Email            | Password |
|-------|------------------|----------|
| Admin | admin@wms.test   | password |
| Clerk | clerk@wms.test   | password |

## Common commands

```bash
docker compose logs -f app          # tail API logs
docker compose exec app php artisan migrate:fresh --seed   # reset DB
docker compose exec app php artisan queue:work             # run worker manually
docker compose exec mysql mysql -uwms -psecret wms         # DB shell
docker compose down                 # stop
docker compose down -v              # stop + wipe DB volume
```

## Production notes

- Set `APP_ENV=production`, `APP_DEBUG=false`, and strong DB/Redis passwords in `backend/.env`.
- Put the whole stack behind Cloudflare or an ALB terminating TLS; Nginx listens on 80 internally.
- Point `SANCTUM_STATEFUL_DOMAINS` and `FRONTEND_URL` at your real frontend domain.
- Switch `FILESYSTEM_DISK=s3` and fill the `AWS_*` vars to store invoice PDFs on S3-compatible storage.
- Supervisor equivalent is the `queue` service (`restart: unless-stopped`); scale it with `docker compose up -d --scale queue=3`.
- Run `php artisan config:cache route:cache` in your image build for production.

## Health

- API health endpoint: http://localhost:8000/up
- MySQL healthcheck is built into compose; `queue` and `app` wait for it.
