# WiFi Marketing Platform

A fullstack WiFi marketing system with visual drag-and-drop page builder and captive portal.
  git config --global user.email "you@example.com"
  git config --global user.name "Your Name"

## Runtime Topology

- Public domain (no port): `https://solutionai.com.vn`
- Docker Compose frontend published port: `3000`
- Internal frontend process: `127.0.0.1:3000`
- Internal backend process: `127.0.0.1:3001`
- Frontend proxies all `/api/*` requests to backend when `APP_SERVER_MODE=frontend`
- Backend serves API directly when `APP_SERVER_MODE=backend`

## Tech Stack

- **Frontend**: Next.js 14 + React + TypeScript + TailwindCSS
- **Page Builder**: GrapesJS with custom components
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: MinIO (S3-compatible)
- **Cache**: Redis
- **Auth**: JWT

## Environment

Use `.env` (already configured in this project):

```env
APP_DOMAIN=solutionai.com.vn
FRONTEND_PORT=3000
BACKEND_PORT=3001
BACKEND_URL=http://127.0.0.1:3001

NEXT_PUBLIC_APP_URL=https://solutionai.com.vn
NEXT_PUBLIC_API_URL=https://solutionai.com.vn
```

To access from outside without `:3000`, you must put a reverse proxy (Nginx/Cloudflare Tunnel/LB) in front:

- `https://solutionai.com.vn/*` -> `http://127.0.0.1:3000/*`
- `https://solutionai.com.vn/api/*` -> `http://127.0.0.1:3001/api/*`

## Quick Start (Development)

### 1. Start all services

```bash
docker compose up -d
```

This starts frontend, backend, PostgreSQL, Redis, and MinIO.

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Install dependencies

```bash
npm install
```

### 4. Setup database

```bash
npx prisma db push
npm run db:seed
```

### 5. Start backend and frontend

Run in 2 terminals:

Terminal 1 (backend API on 3001):

```bash
npm run dev:backend
```

Terminal 2 (frontend on 3000):

```bash
npm run dev:frontend
```

Open `http://127.0.0.1:3000`

If reverse proxy is configured, open `https://solutionai.com.vn`.

## Build and Run (Production)

### 1. Build once

```bash
npm run build
```

### 2. Start backend and frontend

Run in 2 terminals:

```bash
npm run start:backend
```

```bash
npm run start:frontend
```

Or start both from one command:

```bash
npm run start:all
```

## Restart Services

### Restart app processes (manual)

```bash
pkill -f "next start" || true
pkill -f "next dev" || true
```

Then start again:

```bash
npm run start:backend
npm run start:frontend
```

### Restart infrastructure

```bash
docker compose restart postgres redis minio
```

## Connection Health Checks

### Check PostgreSQL

```bash
node --env-file=.env -e 'const { PrismaClient } = require("@prisma/client"); const prisma = new PrismaClient(); prisma["$queryRawUnsafe"]("SELECT 1").then(() => console.log("DB_OK")).catch((e) => { console.error("DB_FAIL", e.message); process.exitCode = 1; }).finally(async () => prisma["$disconnect"]());'
```

### Check MinIO

```bash
node --env-file=.env -e 'const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3"); const bucket = process.env.MINIO_BUCKET || "wifimarketing"; const endpoint = process.env.MINIO_ENDPOINT || "http://localhost:9000"; const client = new S3Client({ endpoint, region: "us-east-1", forcePathStyle: true, credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin", secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin" } }); client.send(new HeadBucketCommand({ Bucket: bucket })).then(() => console.log("MINIO_OK")).catch((e) => { console.error("MINIO_FAIL", e.name, e.message); process.exitCode = 1; });'
```

If bucket is missing, create it:

```bash
node --env-file=.env -e 'const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3"); const bucket = process.env.MINIO_BUCKET || "wifimarketing"; const endpoint = process.env.MINIO_ENDPOINT || "http://localhost:9000"; const client = new S3Client({ endpoint, region: "us-east-1", forcePathStyle: true, credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin", secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin" } }); client.send(new CreateBucketCommand({ Bucket: bucket })).then(() => console.log("MINIO_BUCKET_CREATED")).catch((e) => { if (e.name === "BucketAlreadyOwnedByYou" || e.name === "BucketAlreadyExists") { console.log("MINIO_BUCKET_ALREADY_EXISTS"); return; } console.error("MINIO_CREATE_FAIL", e.name, e.message); process.exitCode = 1; });'
```

## Current Validation Status

- PostgreSQL: `DB_OK`
- MinIO: `MINIO_OK`

### Default Login

- **Username**: admin
- **Password**: admin123

## Architecture

### Pages

| URL | Description |
|-----|-------------|
| `/admin` | Admin dashboard |
| `/admin/templates` | Template management |
| `/admin/templates/[id]/builder` | Visual page builder |
| `/admin/campaigns` | Campaign management |
| `/admin/media` | Media library |
| `/portal` | Captive portal endpoint |

### API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/login` | Admin authentication |
| GET/POST | `/api/templates` | List/Create templates |
| GET/PUT/DELETE | `/api/templates/[id]` | Template CRUD |
| GET/POST | `/api/campaigns` | List/Create campaigns |
| GET/PUT/DELETE | `/api/campaigns/[id]` | Campaign CRUD |
| POST | `/api/upload` | File upload to MinIO |
| POST | `/api/login` | WiFi login (captive portal) |
| POST | `/api/video-complete` | Video gate completion |
| GET | `/api/portal` | Get portal layout by SSID |
| GET | `/api/dashboard` | Dashboard stats |

### Page Builder Components

- **Text**: Rich text with alignment and styling
- **Image**: With lazy loading and links
- **Button**: WiFi login, link, or scroll actions
- **Video**: Autoplay muted video player
- **Slider**: Image carousel with autoplay
- **Form**: Phone/name/email input for WiFi login
- **Video Gate**: Watch video X seconds before continuing
- **Section**: Container with background
- **Columns**: Grid layout
- **Spacer**: Vertical spacing

### Portal Flow (Mikrotik)

1. User connects to WiFi → Mikrotik redirects to `/portal?mac=XX&ip=XX&ssid=XX`
2. Portal API finds active campaign matching SSID
3. Loads template JSON layout
4. Renders landing page with video gate, slider, form etc
5. User fills form → POST `/api/login`
6. Backend authorizes via Mikrotik API
7. User gets internet access

## Production Build

```bash
npm run build
npm run start:backend
npm run start:frontend
```

Cấu hình domain đang vận hành và Cloudflare Tunnel: [solutionai.com.vn](docs/solutionai-domain-deployment.md).
