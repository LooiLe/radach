# 🗺️ Radach Maps (Unlike)

> **Discover popular spots, reviewed by real people. No ads, no algorithms.**

Radach Maps is a full-stack location discovery and trip planning platform. Users can explore spots (restaurants, cafés, attractions), write reviews, attend events, plan itineraries (manual or AI-generated), share journeys, and experience augmented reality navigation — all powered by community-driven content.

**Live site:** [https://unlike.asia](https://unlike.asia)

---

## ✨ Key Features

| Area | Features |
|:-----|:---------|
| **Spots & Discovery** | Browse spots on an interactive map with clustering, category/vibe filtering, full-text search, and proximity-based queries |
| **Reviews & Rankings** | Star ratings with media uploads, expert-verified reviews, automated ranking scores |
| **Events** | Community events with categories, RSVP/likes, recurrence rules, and calendar sync |
| **Journeys** | User-created trail routes with GeoJSON paths, upvotes, and category tagging |
| **Itinerary Planner** | Manual trip planning with drag-and-drop stops + AI-powered itinerary generation (Gemini) |
| **Payments** | Stripe integration for pay-per-generation, credit packs, and subscription tiers (Pro/Unlimited) |
| **Social** | User profiles, friendships, follow system, social feed with posts/comments/likes, notifications |
| **AR View** | Browser-based augmented reality for spot navigation using device sensors and camera |
| **Admin** | Dashboard with analytics, content moderation, spot/event/journey/review management, user roles |
| **Auth** | Email+OTP registration (via Resend), JWT access + refresh tokens, role-based access (USER / ADMIN / SUPER_ADMIN) |

---

## 🛠️ Tech Stack

### Backend
- **Java 25** + **Spring Boot 3.5**
- **Spring Security** — JWT authentication (stateless), BCrypt passwords, role-based authorization
- **Spring Data JPA** — Hibernate ORM with PostgreSQL
- **Flyway** — Database migrations (66 versioned migrations)
- **Bucket4j** — API rate limiting
- **Stripe SDK** — Payments, subscriptions, webhook processing
- **Resend** — Transactional email (OTP verification)
- **Micrometer + Prometheus** — Observability and metrics
- **Spring Boot Actuator** — Health checks and monitoring

### Frontend
- **React 19** + **Vite 8**
- **React Router v7** — Client-side routing
- **Leaflet** + **React Leaflet** — Interactive maps with marker clustering
- **Vanilla CSS** — Custom styling with Figtree/Geom fonts
- **QRCode** — Mobile handoff via QR codes

### Infrastructure
- **PostgreSQL** — Primary database (local dev or Neon Cloud)
- **Nginx** — Reverse proxy, static file serving, SSL termination
- **Let's Encrypt / Certbot** — SSL certificates
- **VPS** — `93.127.194.132` running Ubuntu with systemd service

---

## 📁 Project Structure

```
maps/
├── src/main/java/com/radach/maps/
│   ├── MapsApplication.java          # Entry point (@EnableScheduling, @EnableAsync)
│   ├── config/                        # Security, CORS, rate limiting, web config
│   ├── controller/                    # 34 REST controllers (API endpoints)
│   ├── dto/                           # Request/Response DTOs (44 files)
│   ├── exception/                     # Global exception handler, custom exceptions
│   ├── model/                         # JPA entities (50 files)
│   ├── repository/                    # Spring Data JPA repositories (36 files)
│   ├── security/                      # JWT filter, rate limit filter, security config
│   └── service/                       # Business logic (30 services + tagging subpackage)
├── src/main/resources/
│   ├── application.properties         # Configuration (env-driven)
│   └── db/migration/                  # Flyway migrations (V1–V66)
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Root component with routing
│   │   ├── main.jsx                   # React entry point with AuthProvider
│   │   ├── pages/                     # 27 page components
│   │   ├── components/                # 29 reusable components
│   │   ├── context/                   # AuthContext (JWT + role management)
│   │   └── hooks/                     # Custom hooks (API, AR, sensors)
│   ├── index.html                     # HTML shell
│   ├── vite.config.js                 # Dev server + API proxy config
│   └── package.json                   # Frontend dependencies
├── scripts/
│   ├── scrape_osm_spots.py            # OSM data importer (Python)
│   └── verify_import.py               # Import verification script
├── deploy.ps1                         # Windows deployment script
├── deploy.sh                          # Unix deployment script
├── radach-maps-nginx.conf             # Production Nginx config
├── .env                               # Local dev environment variables
├── .env.production                    # Production environment variables
└── pom.xml                            # Maven build configuration
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|:-----|:--------|
| Java JDK | 25+ |
| Node.js | 18+ |
| PostgreSQL | 14+ |
| Maven | 3.9+ (or use included `mvnw`) |

### 1. Clone & Configure

```bash
git clone <repo-url>
cd maps
```

Copy and configure the environment file:

```bash
cp .env.example .env   # Or edit the existing .env
```

Required environment variables (see `.env` for all):

| Variable | Description |
|:---------|:------------|
| `DATABASE_URL` | JDBC PostgreSQL connection string |
| `DATABASE_USERNAME` | Database user |
| `DATABASE_PASSWORD` | Database password |
| `JWT_SECRET` | JWT signing key (min 32 chars) |
| `RESEND_API_KEY` | Resend API key for email OTP |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode for dev) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `VITE_STADIA_API_KEY` | Stadia Maps tile API key |

### 2. Set Up the Database

```bash
# Create the database and user
sudo -u postgres psql
CREATE DATABASE mapsdb;
CREATE USER mapsuser WITH PASSWORD 'localdevpassword';
GRANT ALL PRIVILEGES ON DATABASE mapsdb TO mapsuser;
\q
```

Flyway will automatically run migrations on first boot.

### 3. Start the Backend

```bash
# From project root
./mvnw spring-boot:run
# Backend starts on http://localhost:8080
```

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
# Frontend starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` and `/uploads/*` to `localhost:8080`.

### 5. (Optional) Stripe Webhooks for Local Dev

```bash
stripe listen --forward-to localhost:8080/api/v1/webhooks/stripe
```

### 6. (Optional) Expose Local Server

```bash
cloudflared tunnel --url http://localhost:5173
```

---

## 🌐 Deployment

The project deploys to a VPS at `93.127.194.132` (domain: `unlike.asia`).

### Deploy Scripts

```powershell
# Windows (PowerShell) — from project root
.\deploy.ps1              # Deploy everything
.\deploy.ps1 -frontend    # Frontend only
.\deploy.ps1 -backend     # Backend only
```

```bash
# Mac / Linux / WSL — from project root
./deploy.sh               # Deploy everything
./deploy.sh frontend      # Frontend only
./deploy.sh backend       # Backend only
```

### What the Deploy Scripts Do

1. **Frontend**: Upload source → `npm ci && npm run build` on VPS → copy `dist/` to `/var/www/radach/` → reload Nginx
2. **Backend**: Upload `src/` + `pom.xml` → `mvnw clean package -DskipTests` on VPS → `systemctl restart radach-maps`

### First-Time VPS Setup

```bash
# Generate SSH key and copy to server
ssh-keygen -t rsa -b 4096
ssh-copy-id root@93.127.194.132

# Upload production env
scp .env.production root@93.127.194.132:/opt/radach-maps/.env
```

### VPS Management

```bash
# SSH into VPS
ssh root@93.127.194.132

# Check app status
systemctl status radach-maps

# View logs
journalctl -u radach-maps -f

# Restart app
systemctl restart radach-maps

# Connect to database
sudo -u postgres psql -d mapsdb
```

---

## 🔑 API Overview

All API endpoints are under `/api/v1/`. Authentication is via `Authorization: Bearer <JWT>` header.

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/v1/auth/register` | Register with email + OTP |
| `POST` | `/api/v1/auth/login` | Login, receive JWT + refresh token |
| `POST` | `/api/v1/auth/refresh` | Refresh access token |
| `GET` | `/api/v1/spots` | List/search spots |
| `GET` | `/api/v1/spots/{id}` | Spot details |
| `GET` | `/api/v1/events` | List events |
| `GET` | `/api/v1/journeys` | List journeys |
| `GET` | `/api/v1/categories` | Spot categories |
| `GET` | `/api/v1/pricing` | Stripe pricing info |
| `GET` | `/api/v1/itineraries/share/{token}` | Shared itinerary (public link) |

### Authenticated Endpoints

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/v1/spots` | Submit a new spot |
| `POST` | `/api/v1/spots/{id}/reviews` | Write a review |
| `POST` | `/api/v1/spots/{id}/save` | Save/unsave a spot |
| `POST` | `/api/v1/events` | Create an event |
| `POST` | `/api/v1/journeys` | Create a journey |
| `GET/POST` | `/api/v1/itineraries/**` | Itinerary CRUD |
| `POST` | `/api/v1/generate` | AI itinerary generation |
| `GET/POST` | `/api/v1/feed/**` | Social feed |
| `GET/POST` | `/api/v1/friends/**` | Friend management |
| `GET/POST` | `/api/v1/follows/**` | Follow/unfollow users |
| `POST` | `/api/v1/upload` | File uploads (images) |
| `GET` | `/api/v1/notifications` | User notifications |
| `POST` | `/api/v1/stripe/checkout` | Create Stripe checkout session |

### Admin Endpoints (ADMIN / SUPER_ADMIN)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/v1/admin/dashboard` | Admin analytics dashboard |
| `PUT` | `/api/v1/admin/spots/{id}/status` | Approve/reject spots |
| `PUT` | `/api/v1/admin/events/{id}/status` | Approve/reject events |
| `PUT` | `/api/v1/admin/reviews/{id}/**` | Moderate reviews |
| `PUT` | `/api/v1/super-admin/users/{id}/role` | Change user roles (SUPER_ADMIN only) |

---

## 🔒 User Roles

| Role | Permissions |
|:-----|:------------|
| `USER` | Standard access: browse, review, create content, plan itineraries |
| `ADMIN` | All USER permissions + content moderation, admin dashboard |
| `SUPER_ADMIN` | All ADMIN permissions + user role management |

To promote a user to admin:
```sql
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'your@email.com';
```

---

## 📝 License

Private — All rights reserved.
