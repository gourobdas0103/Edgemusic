# 🎵 EdgeMusic — Serverless Cloud Audio & Podcast Streamer

A full-stack, serverless personal cloud audio player and podcast streamer built entirely on the **Cloudflare Developer Platform**, combining **Cloudflare Workers**, **Cloudflare D1 (SQL)**, **Cloudflare R2 (Object Storage)**, and **Static Assets**.

---

## 🌟 Overview & Features

* **Full-Stack CRUD Architecture:**
  * **Create:** Upload `.mp3`/`.wav` audio tracks directly to Cloudflare R2 object storage while recording title, artist, genre, and duration metadata in Cloudflare D1.
  * **Read & Stream:** Query track collections from D1 with instant search; stream audio with native HTTP `Range` request support (enabling scrubbing, seeking, and pause/resume).
  * **Update:** In-place editing of track titles, artists, and genre categories in the D1 database.
  * **Delete:** Atomically remove records from Cloudflare D1 and destroy associated binary audio files in Cloudflare R2.
* **Zero Egress Audio Delivery:** Leverages **Cloudflare R2** to eliminate bandwidth and egress charges.
* **Modern Spotify-Style UI:** Responsive, dark-mode web player featuring real-time playback scrubber, volume control, search filtering, and upload modals.
* **Automated CI/CD Pipeline:** Fully configured GitHub Actions workflow (`.github/workflows/deploy.yml`) deploying to Cloudflare Workers on `git push`.

---

## 🏗️ Architecture & Cloudflare Stack

```text
┌────────────────────────────────────────────────────────┐
│             Web Client (Static Assets)                 │
│      Now Playing Bar • Playlist Table • Upload Modal   │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST API
                            ▼
┌────────────────────────────────────────────────────────┐
│             Cloudflare Worker (Compute & API)          │
│   /api/tracks (CRUD)  •  /api/stream/:key (HTTP Range) │
└─────────────┬────────────────────────────┬─────────────┘
              │ SQL Queries                │ Byte Streams
              ▼                            ▼
┌───────────────────────────┐  ┌─────────────────────────┐
│   Cloudflare D1 (SQLite)  │  │   Cloudflare R2 Storage │
│   Track Metadata & Info   │  │   Binary Audio Files    │
└───────────────────────────┘  └─────────────────────────┘
```

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Edge Compute** | Cloudflare Workers | Serverless REST API & Audio streaming proxy |
| **Relational Database** | Cloudflare D1 | Serverless SQLite storing track metadata |
| **Object Storage** | Cloudflare R2 | S3-compatible audio file storage (\$0 egress) |
| **Frontend Hosting** | Cloudflare Workers Static Assets | High-performance CDN asset delivery |
| **CI/CD Automation** | GitHub Actions | Automated build & deploy on push |

---

## 🚀 Local Development Setup

### Prerequisites
* **Node.js** (v18 or v20 LTS recommended)
* **npm** (bundled with Node.js)

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize the Local D1 Database
Wrangler simulates both Cloudflare D1 and Cloudflare R2 locally without requiring any cloud credentials:
```bash
npx wrangler d1 execute edgemusic-db --local --file=./schema.sql
```

### 3. Start Local Development Server
```bash
npx wrangler dev
```

Visit **`http://localhost:8787`** in your browser.
* Click **"+ Upload Audio"** to add an audio file.
* Test playback, scrubbing, editing, and deleting!

---

## ☁️ Deployment to Cloudflare

### 1. Authenticate with Cloudflare
```bash
npx wrangler login
```

### 2. Provision Remote Cloudflare Resources
```bash
# Create remote D1 database
npx wrangler d1 create edgemusic-db

# Create remote R2 storage bucket
npx wrangler r2 bucket create edgemusic-tracks
```

Copy the generated `database_id` from the output and update your `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "edgemusic-db"
database_id = "<YOUR_GENERATED_DATABASE_ID>"
```

### 3. Run Remote Database Migrations
```bash
npx wrangler d1 execute edgemusic-db --remote --file=./schema.sql
```

### 4. Deploy Live
```bash
npx wrangler deploy
```

Your application will be live at `https://edgemusic.<your-subdomain>.workers.dev`!

---

## 🔄 GitHub Actions CI/CD Setup

To enable automatic deployment whenever you push to GitHub:
1. Navigate to your GitHub repository: **Settings ➔ Secrets and variables ➔ Actions**.
2. Add the following secrets:
   * **`CLOUDFLARE_API_TOKEN`**: A Cloudflare API token with `Edit Cloudflare Workers` permissions (create from Cloudflare Dashboard ➔ My Profile ➔ API Tokens).
   * **`CLOUDFLARE_ACCOUNT_ID`**: Your Cloudflare Account ID (found on the Workers Overview page).
3. Any push to `main` will automatically build and deploy the application.

---

## 📜 License
MIT License. Built for DevOps & Cloud Exploration Internship Task 5.
