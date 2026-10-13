You are a senior fullstack architect and engineer. Build a production-ready system for a WiFi Marketing platform with a visual Page Builder and Captive Portal.

## 🎯 GOAL

Create a fullstack application that includes:

1. Visual drag-and-drop Page Builder (like Webflow/Elementor)
2. Admin dashboard to manage templates and campaigns
3. Portal endpoint `/portal` for Mikrotik redirect
4. Rendering engine to display landing pages dynamically
5. Mobile-first responsive design
6. Media storage using MinIO (S3-compatible)
7. Database using PostgreSQL

---

## 🧱 TECH STACK (MANDATORY)

### Frontend:

* React (Next.js preferred)
* TypeScript
* TailwindCSS (for fast responsive UI)
* Component-based architecture

### Page Builder:

* Use GrapesJS as the core editor
* Extend with custom components:

  * Text
  * Image
  * Button
  * Video
  * Slider (auto-play)
  * Form (phone input)
  * Video Gate (watch before continue)

### Backend:

* Node.js (Express or NestJS)
* PostgreSQL (via Prisma ORM)
* Redis (optional for caching)
* REST API

### Storage:

* MinIO (S3-compatible)
* Upload API for images/videos

---

## 🧠 CORE ARCHITECTURE

### 1. Page Builder System

* Builder outputs JSON layout (NOT raw HTML)
* Example structure:

{
"type": "page",
"children": [
{
"type": "video_gate",
"props": {
"video_url": "https://cdn/video.mp4",
"skip_after": 5
}
},
{
"type": "slider",
"props": {
"images": ["a.jpg", "b.jpg"],
"delay": 1000
}
},
{
"type": "form",
"props": {
"fields": ["phone"]
}
}
]
}

---

### 2. Renderer Engine

* Convert JSON → React components

* Each component must be:

  * Responsive (mobile-first)
  * Lightweight
  * Optimized for captive portal

* Slider should use Swiper.js

* Video should autoplay muted

* Lazy load images

---

### 3. Admin Dashboard

Create UI for:

* Templates (CRUD)
* Campaigns (CRUD)
* Assign template to SSID
* Preview template
* Publish / Draft

---

### 4. Database Schema (PostgreSQL)

Tables:

templates:

* id
* name
* layout_json (JSONB)
* status (draft/published)
* created_at

campaigns:

* id
* name
* ssid
* template_id
* start_time
* end_time

wifi_users:

* id
* mac
* ip
* phone
* created_at

logs:

* id
* mac
* campaign_id
* login_time

---

### 5. MinIO Integration

* Upload API:
  POST /upload
* Store:
  images
  videos
* Return public URL

---

### 6. Portal Endpoint (CRITICAL)

Create route:

GET /portal

It must:

* Accept query params from Mikrotik:
  mac, ip, ssid, link-login, link-orig
* Determine campaign based on SSID
* Load correct template
* Render landing page dynamically
* Pass params to frontend

---

### 7. Video Gate Logic

* User must watch video X seconds before continuing
* Store session (in memory or Redis)
* Prevent bypass:

  * API: POST /video-complete
  * Block login if not watched

---

### 8. Mikrotik Login Flow

* POST /api/login
* Backend calls Mikrotik:
  http://<mikrotik-ip>/login

---

### 9. Mobile Optimization (IMPORTANT)

* All components must:

  * be responsive
  * use flex/grid
  * support small screens
* Avoid heavy JS
* Load under 2 seconds

---

### 10. UI Requirements

* Clean modern UI (like SaaS dashboard)
* Drag-and-drop builder
* Live preview
* Dark/light mode optional

---

## 🚀 DELIVERABLES

Generate:

1. Full project structure
2. Backend API code
3. Prisma schema
4. React frontend (admin + portal)
5. GrapesJS integration
6. Renderer engine
7. MinIO upload service
8. Sample template JSON
9. Instructions to run locally

---

## ⚠️ CONSTRAINTS

* Must be modular and scalable
* Must support multiple templates
* Must support mobile-first rendering
* Must avoid storing raw HTML
* Must be optimized for captive portal (low latency)

---

## 🎯 OUTPUT FORMAT

* Provide full code (multi-file structure)
* Explain key parts briefly
* Ensure code is runnable

---

Build the system step-by-step with clean architecture.

