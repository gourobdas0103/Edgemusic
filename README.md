
# 🎵 EdgeMusic — Serverless Cloud Audio & Podcast Streamer

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare%20D1-F38020?logo=sqlite&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Cloudflare R2](https://img.shields.io/badge/Storage-Cloudflare%20R2-F38020?logo=icloud&logoColor=white)](https://developers.cloudflare.com/r2/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **PearlThoughts DevOps Internship — Task 5 Submission**
> An edge-native, production-ready Spotify-style audio and podcast streamer built entirely on Cloudflare's serverless ecosystem (**Workers**, **D1 SQL Database**, **R2 Object Storage**, and **Static Assets**) with end-to-end automated **GitHub Actions CI/CD**.

---

## 🌐 1. Live Deliverables & Submission Links

| Deliverable | URL | Description | Status |
|---|---|---|---|
| **🚀 Live Application** | [https://edgemusic.gourobdas0103.workers.dev](https://edgemusic.gourobdas0103.workers.dev) | Globally distributed production application on Cloudflare Edge | **Live & Verified** ✅ |
| **📹 Loom Video Demo** | [https://www.loom.com/share/9b93cbae770c4bc69172ef2818234cc4](https://www.loom.com/share/9b93cbae770c4bc69172ef2818234cc4) | End-to-end architecture walkthrough & feature demonstration | **Completed** ✅ |
| **💻 GitHub Repository** | [https://github.com/gourobdas0103/Edgemusic](https://github.com/gourobdas0103/Edgemusic) | Source code, D1 schema, Wrangler configuration, and CI/CD workflow | **Public & Passing** ✅ |

---

## 🌟 2. Feature Matrix: Local vs. Cloudflare Production

| Feature | Local Development (`wrangler dev`) | Cloudflare Edge Production |
|---|---|---|
| **Edge Compute** | Local Miniflare / workerd runtime | Cloudflare Global Anycast Edge Network (330+ cities) |
| **Relational Database** | Local SQLite `.wrangler/state/v3/d1` | Cloudflare D1 Serverless SQL (`edgemusic-db`) |
| **Binary Audio Storage** | Local filesystem simulation in `.wrangler` | Cloudflare R2 Zero-Egress Storage (`edgemusic-tracks`) |
| **Frontend Delivery** | Local Static Asset server | Cloudflare Global CDN Static Asset Caching |
| **Audio Seeking / Scrubbing** | HTTP `Range` request emulation | Distributed HTTP 206 Partial Content byte-range delivery |
| **Deployment Mode** | Hot-reloading CLI watcher | Automated GitHub Actions CI/CD upon push to `main` |

---

## ⚡ 3. System Architecture

```
                                  +---------------------------------------+
                                  |         Client Web Browser            |
                                  |    Responsive Dark Mode Spotify UI    |
                                  +-------------------+-------------------+
                                                      |
                                        HTTPS Requests (Global Anycast)
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |        Cloudflare Static Assets       |
                                  |    HTML5 / CSS3 / ES6 Audio Engine    |
                                  +-------------------+-------------------+
                                                      |
                                             API Calls / Streaming
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |       Cloudflare Worker Router        |
                                  |    (V8 Engine Serverless REST API)    |
                                  +---------+-------------------+---------+
                                            |                   |
                                SQL Queries |                   | Binary Streams (HTTP 206)
                                            v                   v
                              +--------------------+     +--------------------+
                              |   Cloudflare D1    |     |   Cloudflare R2    |
                              |  (Serverless SQL)  |     |  (Object Storage)  |
                              |   Track Metadata   |     |  Raw Audio Files   |
                              +--------------------+     +--------------------+
```

### Key Architectural Capabilities:
1. **Zero-Egress Audio Delivery:** Binary `.mp3` and `.wav` tracks are saved in Cloudflare R2, eliminating traditional AWS S3 data-transfer egress fees.
2. **Byte-Range Audio Scrubbing:** The Worker implements HTTP `Range` header parsing (`bytes=start-end`) returning HTTP `206 Partial Content`. This allows instant seeking to any point in an audio file without downloading the whole file first.
3. **Persistent SQL Layer:** Relational metadata (track title, artist, genre, duration in seconds, creation timestamp) is queried through Cloudflare D1 with prepared SQL statements to prevent SQL injection.

---

## 📂 4. Repository Structure & Component Roles

```text
edgemusic/
├── .github/
│   └── workflows/
│       └── deploy.yml            # Automated GitHub Actions CI/CD deployment pipeline
├── public/
│   ├── index.html                # Responsive Spotify-style dark-mode interface
│   ├── style.css                 # Custom glassmorphism and modern Spotify dark styling
│   └── app.js                    # Audio player logic, seek scrubber, and CRUD client
├── src/
│   └── index.js                  # Cloudflare Worker API router & HTTP Range stream proxy
├── .gitignore                    # Excludes node_modules, .wrangler, and build caches
├── package.json                  # Scripts (dev, deploy, db:init) and Wrangler dependency
├── README.md                     # Complete project documentation and challenges report
├── schema.sql                    # Cloudflare D1 relational SQLite schema definition
└── wrangler.toml                 # Cloudflare bindings for Worker, Assets, D1, and R2
```

---

## 🛠️ 5. REST API Specification

| Method | Endpoint | Description | Request Body | Response Status | Storage Target |
|---|---|---|---|---|---|
| `GET` | `/api/tracks` | Fetch list of all uploaded tracks | None | `200 OK` (JSON array) | Cloudflare D1 |
| `POST` | `/api/tracks` | Upload new audio file + metadata | `multipart/form-data` (`title`, `artist`, `genre`, `duration`, `file`) | `201 Created` (JSON) | Cloudflare R2 + D1 |
| `GET` | `/api/stream/:key` | Stream binary audio (with seeking) | `Range` HTTP header (optional) | `206 Partial Content` or `200 OK` | Cloudflare R2 |
| `PUT` | `/api/tracks/:id` | Update track title, artist, or genre | `application/json` (`title`, `artist`, `genre`) | `200 OK` (JSON) | Cloudflare D1 |
| `DELETE`| `/api/tracks/:id` | Permanently delete track and binary | None | `200 OK` (JSON) | Cloudflare R2 + D1 |

---

## 💾 6. Database Schema & Storage Design

### D1 Relational Schema (`schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    genre TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    r2_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Cloudflare Resource Identifiers
- **Worker Name:** `edgemusic`
- **D1 Database Name:** `edgemusic-db`
- **D1 Database ID:** `393e730b-9a2e-4b88-b5c2-cf85532a4d4e`
- **R2 Bucket Name:** `edgemusic-tracks`
- **Cloudflare Account ID:** `356484aacdbf0861d309e6ca750a74cb`

---

## 📊 7. DevOps Challenges & Solutions Matrix

During this assessment, several real-world cloud and DevOps engineering hurdles were diagnosed, troubleshot, and resolved:

| # | Challenge Encountered | Root Cause | Technical Resolution Applied | Key DevOps Takeaway |
|---|---|---|---|---|
| **1** | **PowerShell Execution Policy Error** (`PSSecurityException`) | Windows default policy blocked execution of unsigned `.ps1` wrapper scripts for `npm` and `wrangler`. | Ran `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` to permit local scripting. | Understand host platform constraints when configuring developer workstations. |
| **2** | **R2 Activation Requirement** (`Error 10042`) | R2 bucket creation failed via CLI because account had not activated the R2 service in the dashboard. | Navigated to Cloudflare Dashboard > Subscriptions and activated R2 entitlement prior to CLI bucket creation. | Cloud CLI tools require prerequisite service onboarding before resource provisioning. |
| **3** | **First-Time Subdomain Provisioning** | Wrangler required registering a unique `*.workers.dev` subdomain before initial publish. | Completed interactive registration of `gourobdas0103.workers.dev` during deployment. | First-time cloud account setups require organization/subdomain namespace binding. |
| **4** | **Negative DNS Caching (`NXDOMAIN`)** | User visited newly published domain before edge DNS finished propagating; Chrome/Windows cached NXDOMAIN. | Flushed host resolver cache (`chrome://net-internals/#dns`) and validated direct edge resolution via `nslookup edgemusic.gourobdas0103.workers.dev 1.1.1.1`. | Understand DNS TTL and negative caching behaviors when spinning up dynamic edge infrastructure. |
| **5** | **CI/CD Authentication Failures** | Initial GitHub Actions runs failed because repository secrets were not configured. | Configured `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub Repository Secrets. | Automations require zero-trust machine-to-machine authentication credentials. |
| **6** | **Missing Least-Privilege Permissions on API Token** | Default Workers API Token template lacked D1 database and R2 storage privileges. | Created a scoped custom API Token granting `Workers Scripts: Edit`, `D1: Edit`, and `Workers R2 Storage: Edit`. | Practice the Principle of Least Privilege while ensuring all bound resources have write entitlements. |
| **7** | **D1 Database ID Mismatch in Git** | Commit 1 contained placeholder `database_id = "local-edgemusic-db"`, causing Cloudflare to reject deployments. | Committed real Cloudflare D1 UUID (`393e730b-9a2e-4b88-b5c2-cf85532a4d4e`) in `wrangler.toml` (Commit 2). | Configuration as Code must reflect provisioned cloud resources for CI/CD consistency. |

---

## 🚀 8. How to Run & Deploy

### Local Development
```bash
# 1. Clone the repository
git clone https://github.com/gourobdas0103/Edgemusic.git
cd Edgemusic

# 2. Install dependencies
npm install

# 3. Initialize local D1 database
npm run db:init:local

# 4. Start local development server
npm run dev
```

### Cloud Provisioning & Deployment
```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Provision D1 Database and R2 Bucket
npx wrangler d1 create edgemusic-db
npx wrangler r2 bucket create edgemusic-tracks

# 3. Apply schema to remote D1 Database
npm run db:init:remote

# 4. Deploy live application
npm run deploy
```

---

## 🤖 9. Automated CI/CD (GitHub Actions)

Every push to the `main` branch automatically triggers `.github/workflows/deploy.yml`:
1. Spins up an `ubuntu-latest` runner.
2. Checks out code and installs Node.js 20.
3. Runs `npm ci` for deterministic dependency tree.
4. Executes `cloudflare/wrangler-action@v3` using injected secrets (`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`).
5. Publishes updated assets, Worker code, and bindings to production.

---


## 📜 License
MIT License. Built for DevOps & Cloud Exploration Internship Task 5.
**Author:** Gourob Das ([@gourobdas0103](https://github.com/gourobdas0103))
**Role:** DevOps Engineering Intern
**Organization:** PearlThoughts
**Repository:** `https://github.com/gourobdas0103/Edgemusic`
**Branch:** `task5-gourobdas0103`
**Submission Date:** 16 November 2026
