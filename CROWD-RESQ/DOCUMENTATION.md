# CROWD-RESQ — Full Project Documentation

> **CROWD-RESQ** is a real-time crowd monitoring and emergency response system designed for campus environments. It combines a **computer-vision backend** (YOLOv5 person detection, heatmap generation, A\* evacuation path planning) with a **role-based web dashboard** (Next.js) serving Security Guards, Ambulance Services, and Students.

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Repository Structure](#4-repository-structure)
5. [User Roles & Dashboards](#5-user-roles--dashboards)
6. [Authentication System](#6-authentication-system)
7. [Backend — FastAPI Streaming Server (`app.py`)](#7-backend--fastapi-streaming-server-apppy)
8. [Backend — YOLO + Heatmap + A\* Processor (`y_h_A.py`)](#8-backend--yolo--heatmap--a-processor-y_h_apy)
9. [Frontend — Next.js Application](#9-frontend--nextjs-application)
10. [Database Design](#10-database-design)
11. [API Reference](#11-api-reference)
12. [How the Video Feed Works](#12-how-the-video-feed-works)
13. [How to Run the Project](#13-how-to-run-the-project)
14. [Environment Variables](#14-environment-variables)
15. [Troubleshooting](#15-troubleshooting)
16. [Future Scope](#16-future-scope)

---

## 1. Project Summary

### Problem

During events or emergencies on a campus, there is no centralised system for:

- Detecting crowd density in real time.
- Alerting security guards and ambulance services instantly.
- Planning optimal evacuation or access routes through dense crowds.
- Coordinating communication between students, security, and medical teams.

### Solution

CROWD-RESQ addresses this by providing:

| Capability | How |
|---|---|
| **Real-time person detection** | YOLOv5 object detection model running on live or recorded video |
| **Crowd density heatmap** | Accumulated detection + motion data rendered as a JET colour-map overlay |
| **Evacuation / access path** | A\* pathfinding on the warped heatmap cost-grid, projected back onto the camera frame |
| **Role-based dashboards** | Security Guard (live raw feed), Ambulance (processed AI feed with heatmap + path), Student (emergency alerts) |
| **Authentication** | MongoDB-backed signup/signin with bcrypt password hashing and JWT HTTP-only cookies |
| **Emergency alerts** | One-click emergency and medical alert buttons with notification display |

---

## 2. Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **Next.js 15** (App Router) | React-based full-stack framework |
| **React 18** | UI library |
| **TypeScript** | Type-safe JavaScript |
| **Tailwind CSS** | Utility-first CSS framework |
| **shadcn/ui** (40+ components) | Pre-built accessible UI components built on Radix UI |
| **Lucide React** | Icon library |
| **Recharts** | Data visualisation (charts) |
| **Sonner** | Toast notifications |
| **react-hook-form + Zod** | Form handling and validation |

### Backend

| Technology | Purpose |
|---|---|
| **FastAPI** (Python) | REST API + MJPEG streaming server (port 8000) |
| **OpenCV** | Camera capture, image processing, video encoding |
| **YOLOv5 (Ultralytics)** | Person detection model |
| **NumPy** | Array/matrix operations (homography, heatmap) |
| **Uvicorn** | ASGI server for FastAPI |

### Database & Auth

| Technology | Purpose |
|---|---|
| **MongoDB** (Atlas or local) | User data storage |
| **Mongoose** | ODM for MongoDB |
| **bcryptjs** | Password hashing |
| **jsonwebtoken** | JWT token generation & verification |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Student      │  │  Security    │  │  Ambulance   │      │
│  │  Dashboard    │  │  Guard Page  │  │  Dashboard   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│         │    <img src="/stream.mjpg">        │              │
│         │                 │    <img src="/shared/processed.mjpg">
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  NEXT.JS SERVER (port 3000)                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  API Routes:  /api/auth/signup, signin, me, logout │     │
│  │  Middleware:   JWT decode → role-based route guard  │     │
│  └────────────────────────────────────────────────────┘     │
│  Database: MongoDB (Users collection via Mongoose)          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              FASTAPI SERVER — app.py (port 8000)            │
│  ┌──────────────────────────────────────────────┐           │
│  │  /stream/start, /stream/stop, /stream.mjpg   │  ← Raw   │
│  │  /shared/raw.mjpg, /shared/processed.mjpg    │  ← Files │
│  │  /health, /cameras, /camera/set/{index}      │           │
│  └──────────────────────────────────────────────┘           │
│         ▲  Reads output/shared_processed.jpg                │
│         │  Reads output/shared_raw.jpg                      │
└─────────┼───────────────────────────────────────────────────┘
          │
┌─────────┴───────────────────────────────────────────────────┐
│              y_h_A.py — YOLO + Heatmap + A* Processor       │
│  ┌──────────────────────────────────────────────┐           │
│  │  Camera/Video → YOLOv5 → Heatmap → A* Path  │           │
│  │  Writes: output/shared_processed.jpg         │           │
│  │  Writes: output/shared_raw.jpg               │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

1. `y_h_A.py` captures video, runs YOLO detection, generates heatmap + A\* path, and **writes processed frames as JPEG files** to the `output/` folder.
2. `app.py` (FastAPI) reads those JPEG files and serves them as **MJPEG streams** over HTTP. It also provides a direct **raw webcam stream**.
3. The **Next.js frontend** renders `<img>` tags pointing at the MJPEG endpoints, giving a live-updating video feed in the browser with zero JavaScript video decoding.

---

## 4. Repository Structure

```
CROWD-RESQ/
│
├── HOW_TO_RUN.md                          ← Quick-start setup guide
├── DOCUMENTATION.md                       ← This file
│
├── backend-final/
│   └── crowd-management-small-model/
│       ├── app.py                         ← FastAPI streaming server
│       ├── y_h_A.py                       ← YOLO + Heatmap + A* processor
│       ├── yolov5s.pt                     ← YOLOv5-small model weights
│       ├── yolov5su.pt                    ← YOLOv5-small-ultralytics weights
│       ├── output/                        ← Shared JPEG files (auto-created)
│       │   ├── shared_raw.jpg
│       │   └── shared_processed.jpg
│       └── __pycache__/
│
└── crowd-management-/                     ← Next.js frontend application
    ├── app/
    │   ├── page.tsx                        ← Landing page (video background)
    │   ├── layout.tsx                      ← Root layout (ThemeProvider, Inter font)
    │   ├── globals.css                     ← Global styles
    │   ├── signin/page.tsx                 ← Sign-in form
    │   ├── signup/page.tsx                 ← Sign-up form (with role selection)
    │   ├── dashboard/
    │   │   ├── SecurityGuard/page.tsx      ← Security Guard dashboard (live raw feed)
    │   │   ├── ambulance/page.tsx          ← Ambulance dashboard (processed AI feed)
    │   │   └── student/page.tsx            ← Student dashboard (alerts & messaging)
    │   └── api/auth/
    │       ├── signup/route.ts             ← POST — register new user
    │       ├── signin/route.ts             ← POST — authenticate, set JWT cookie
    │       ├── me/route.ts                 ← GET  — get current user from cookie
    │       └── logout/route.ts             ← POST — clear cookie
    ├── lib/
    │   ├── auth.ts                         ← JWT helpers (generate, verify, getAuthUser)
    │   ├── db.ts                           ← MongoDB connection (Mongoose)
    │   ├── utils.ts                        ← Tailwind cn() utility
    │   └── models/User.ts                  ← Mongoose User schema + bcrypt hooks
    ├── middleware.ts                        ← Edge middleware (route protection, role guard)
    ├── components/
    │   ├── theme-provider.tsx              ← next-themes wrapper
    │   └── ui/                             ← 40+ shadcn/ui components
    ├── docs/                               ← Internal design documents
    ├── public/videos/                      ← Background & demo videos
    ├── package.json
    ├── tailwind.config.ts
    └── tsconfig.json
```

---

## 5. User Roles & Dashboards

The system supports three user roles, each with a dedicated dashboard:

### 5.1 Student (`/dashboard/student`)

| Feature | Description |
|---|---|
| Emergency Alert Button | Triggers a security emergency alert (red button) |
| Send Message | Free-text input to describe the situation |
| Notifications | Displays received alerts and confirmations |

The student dashboard is a communication tool — students can signal for help and receive status updates.

### 5.2 Security Guard (`/dashboard/SecurityGuard`)

| Feature | Description |
|---|---|
| **Live Camera Feed** | Displays real-time raw webcam stream from `app.py` (`/stream.mjpg`) |
| Emergency Buttons | Security Emergency + Medical Emergency one-click alerts |
| Send Message | Text input for situational reporting |
| Notifications | Live alert feed |

On page load, the dashboard automatically calls `POST /stream/start` to activate the webcam stream.

### 5.3 Ambulance Service (`/dashboard/ambulance`)

| Feature | Description |
|---|---|
| **Processed Video Feed** | Shows the AI-processed stream (`/shared/processed.mjpg`) with YOLO detections, crowd heatmap overlay, and A\* evacuation path drawn on the frame |
| Dispatch Button | "Dispatch Response Team" action |
| Emergency Notifications | Auto-populated alerts showing crowd count and location |

This dashboard depends on `y_h_A.py` running and writing processed frames.

---

## 6. Authentication System

### Flow

```
1. User visits /signup
   → Fills name, email, password, role (student / SecurityGuard / ambulance)
   → POST /api/auth/signup
   → Server: connects to MongoDB, validates fields, checks duplicate email,
     creates User (password auto-hashed via bcrypt pre-save hook)
   → Redirect to /signin

2. User visits /signin
   → Fills email + password
   → POST /api/auth/signin
   → Server: finds user by email, compares password with bcrypt,
     generates JWT { id, email, role, name }, sets HTTP-only cookie "auth-token" (1 day)
   → Redirect to /dashboard/{role}

3. Protected pages
   → Edge middleware intercepts /dashboard/* routes
   → Reads "auth-token" cookie, decodes JWT payload (base64)
   → If no token → redirect to /signin
   → If wrong role for path → redirect to correct dashboard

4. Dashboard page load
   → Client calls GET /api/auth/me
   → Server verifies JWT, returns { user: { id, name, email, role } }
   → Dashboard renders role-specific content

5. Logout
   → POST /api/auth/logout → clears cookie → redirect to /signin
```

### Security Measures

| Measure | Implementation |
|---|---|
| Password hashing | bcrypt with 10 salt rounds (Mongoose pre-save hook) |
| Token storage | HTTP-only cookie (not accessible via JavaScript, prevents XSS) |
| Token expiry | 1 day |
| Route protection | Server-side middleware + client-side role check |
| Input validation | Mongoose schema validation + API-level field checks |
| Error messages | Generic ("Invalid credentials") to prevent user enumeration |

---

## 7. Backend — FastAPI Streaming Server (`app.py`)

This is a lightweight Python server that handles **camera access** and **MJPEG streaming**.

### Responsibilities

1. **Raw webcam stream** — Opens the camera via OpenCV, encodes frames as JPEG, serves as a multipart MJPEG stream.
2. **Shared file streams** — Reads JPEG files written by `y_h_A.py` and serves them as MJPEG streams (this is how the AI-processed feed reaches the browser).
3. **Camera management** — Detects available cameras, allows runtime switching.
4. **CORS** — Allows the Next.js frontend at `http://localhost:3000`.

### Camera Configuration

| Setting | Value | Notes |
|---|---|---|
| `CAMERA_INDEX` | `1` | Default: Iriun Webcam. `0` = built-in PC webcam |
| `CAMERA_BACKEND` | `cv2.CAP_DSHOW` | DirectShow — required for virtual cameras (Iriun). MSMF fails. |
| Reconnection | After 50 consecutive frame failures | Auto-releases and re-opens the camera |

### Key Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/stream/start` | Start raw webcam capture thread |
| `POST` | `/stream/stop` | Stop raw webcam capture |
| `GET` | `/stream.mjpg` | Raw webcam MJPEG stream |
| `GET` | `/shared/raw.mjpg` | Raw frames from shared file (written by y_h_A.py) |
| `GET` | `/shared/processed.mjpg` | Processed frames from shared file (written by y_h_A.py) |
| `GET` | `/health` | Server health + camera info |
| `GET` | `/cameras` | List all detected cameras |
| `POST` | `/camera/set/{index}` | Switch active camera at runtime |
| `POST` | `/auth/login` | Legacy login (kept for compatibility) |
| `GET/POST` | `/notifications` | List / create notifications |

---

## 8. Backend — YOLO + Heatmap + A\* Processor (`y_h_A.py`)

This is an **interactive script** that performs the heavy AI processing. It runs as a separate process alongside `app.py`.

### Workflow

```
┌──────────────────────┐
│  1. Select Source     │  Webcam (Iriun, index 1) or video file
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  2. Preview Frames   │  User presses 'd' to skip, 's' to select a clear frame
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  3. Click 4 Points   │  User clicks 4 floor corners on the selected frame
└──────────┬───────────┘  (defines the ground plane for bird's-eye homography)
           ▼
┌──────────────────────┐
│  4. Compute          │  Homography matrix H from 4 points → bird's-eye warp
│     Homography       │
└──────────┬───────────┘
           ▼
┌────────────────────────────────────────────┐
│  5. Main Processing Loop (per frame)       │
│                                            │
│  a. Read frame from camera/video           │
│  b. YOLOv5 inference (person detection)    │
│  c. Background subtraction (MOG2)          │
│  d. Accumulate heatmap (detections +       │
│     motion, decayed × 0.95 per frame)      │
│  e. Gaussian blur + normalize heatmap      │
│  f. Apply JET colormap overlay             │
│  g. Warp heatmap to bird's-eye (20×20)     │
│  h. A* pathfinding (bottom-left →          │
│     top-right on cost grid)                │
│  i. Project path back to camera view       │
│  j. Draw green polyline (evacuation route) │
│  k. Annotate person count on frame         │
│  l. Write output/shared_processed.jpg      │
│  m. Write output/shared_raw.jpg            │
│  n. Write to output video (.mp4)           │
└────────────────────────────────────────────┘
           ▼
│  6. Exit on 'q' key or video end           │
```

### Key Parameters

| Parameter | Value | Description |
|---|---|---|
| Model | `yolov5s.pt` | YOLOv5-small, 640px inference |
| Confidence | `0.4` | Minimum detection confidence |
| Person class | `0` | COCO class ID for "person" |
| Heatmap decay | `0.95` | Per-frame exponential decay |
| Gaussian sigma | `15` | Smoothing kernel for heatmap |
| Alpha (overlay) | `0.6` | Blending ratio (frame vs heatmap) |
| Grid size | `20 × 20` | Resolution for A\* cost map |
| Camera backend | `cv2.CAP_DSHOW` | DirectShow (for Iriun compatibility) |
| Camera index | `1` | Default Iriun webcam |

---

## 9. Frontend — Next.js Application

### Page Map

| URL | File | Auth Required | Role |
|---|---|---|---|
| `/` | `app/page.tsx` | No | — |
| `/signin` | `app/signin/page.tsx` | No | — |
| `/signup` | `app/signup/page.tsx` | No | — |
| `/dashboard/student` | `app/dashboard/student/page.tsx` | Yes | `student` |
| `/dashboard/SecurityGuard` | `app/dashboard/SecurityGuard/page.tsx` | Yes | `SecurityGuard` |
| `/dashboard/ambulance` | `app/dashboard/ambulance/page.tsx` | Yes | `ambulance` |

### Landing Page

- Full-screen background video (`/videos/bg.mp4`)
- Centered card with Sign In / Sign Up buttons
- Tagline: *"A platform for students, Security Management, and Ambulance Services"*

### Sign In / Sign Up

- Glassmorphic card over video background
- Sign Up includes a **role selector** (radio group: Student, Security Guard, Ambulance)
- Error and loading states handled inline
- Successful signup redirects to sign-in; successful sign-in redirects to the user's role dashboard

### Dashboard Layout (all roles)

- **Header**: Dashboard title, "Welcome, {name}", logout button
- **Main content**: Role-specific cards in a responsive grid
- **Notifications section**: Alert cards at the bottom

---

## 10. Database Design

### MongoDB — `Users` Collection

| Field | Type | Constraints |
|---|---|---|
| `_id` | `ObjectId` | Auto-generated |
| `name` | `String` | Required |
| `email` | `String` | Required, unique |
| `password` | `String` | Required, bcrypt-hashed (pre-save hook) |
| `role` | `String` | Enum: `student`, `SecurityGuard`, `ambulance` |
| `createdAt` | `Date` | Auto (timestamps: true) |
| `updatedAt` | `Date` | Auto (timestamps: true) |

### Mongoose Model (`lib/models/User.ts`)

- **Pre-save hook**: Automatically hashes the password with `bcrypt.genSalt(10)` before saving.
- **Instance method**: `comparePassword(candidate)` — uses `bcrypt.compare()` for login verification.

---

## 11. API Reference

### Next.js Auth APIs (`/api/auth/*`)

| Method | Endpoint | Request Body | Response | Notes |
|---|---|---|---|---|
| `POST` | `/api/auth/signup` | `{ name, email, password, role }` | `201 { message, user }` | Creates user in MongoDB |
| `POST` | `/api/auth/signin` | `{ email, password }` | `200 { message, user }` + sets cookie | Returns JWT in HTTP-only cookie |
| `GET` | `/api/auth/me` | — | `200 { user }` | Reads JWT from cookie |
| `POST` | `/api/auth/logout` | — | `200 { message }` | Clears cookie |

### FastAPI Streaming APIs (`localhost:8000`)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/stream/start` | Start raw webcam capture |
| `POST` | `/stream/stop` | Stop raw webcam capture |
| `GET` | `/stream.mjpg` | Live raw MJPEG stream |
| `GET` | `/shared/raw.mjpg` | Shared raw JPEG → MJPEG |
| `GET` | `/shared/processed.mjpg` | Shared processed JPEG → MJPEG |
| `GET` | `/health` | `{ ok, camera_index, stream_running, ts }` |
| `GET` | `/cameras` | `{ current, available: [...] }` |
| `POST` | `/camera/set/{index}` | Switch camera, restart stream |
| `POST` | `/auth/login` | Legacy login (fake users) |
| `GET` | `/notifications` | List notifications |
| `POST` | `/notifications` | Create notification |

---

## 12. How the Video Feed Works

### Raw Feed (Security Guard)

```
Camera (Iriun/webcam)
   │
   ▼  cv2.VideoCapture(1, CAP_DSHOW)
app.py _camera_worker thread
   │
   ▼  cv2.imencode(".jpg") → latest_jpeg (in-memory)
_mjpeg_generator()
   │
   ▼  HTTP multipart/x-mixed-replace
GET /stream.mjpg
   │
   ▼  <img src="http://localhost:8000/stream.mjpg">
SecurityGuard/page.tsx
```

### Processed Feed (Ambulance)

```
Camera (Iriun/webcam)
   │
   ▼  cv2.VideoCapture(1, CAP_DSHOW)
y_h_A.py main loop
   │
   ├─ YOLO detection → bounding boxes
   ├─ MOG2 motion → motion mask
   ├─ Heatmap accumulation + JET colormap
   ├─ Homography warp → A* pathfinding
   ├─ Draw path + person count overlay
   │
   ▼  cv2.imwrite("output/shared_processed.jpg")
Disk file
   │
   ▼  app.py reads file on change
_shared_file_mjpeg_generator()
   │
   ▼  HTTP multipart/x-mixed-replace
GET /shared/processed.mjpg
   │
   ▼  <img src="http://localhost:8000/shared/processed.mjpg">
ambulance/page.tsx
```

### Why MJPEG?

- **Zero client-side decoding** — the browser's native `<img>` tag handles it.
- **No WebSocket or JavaScript video player needed** — just a standard HTTP stream.
- **Low latency** — each frame is pushed as soon as it's ready.
- **Universal browser support** — works in all modern browsers.

---

## 13. How to Run the Project

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| pnpm | 8+ | `npm install -g pnpm` |
| Python | 3.10 – 3.11 | [python.org](https://www.python.org/downloads) |
| MongoDB | Atlas (cloud) or local | [mongodb.com/atlas](https://www.mongodb.com/atlas) |

### Step 1: Frontend Setup

```bash
cd crowd-management-
pnpm install
```

Create a `.env` file in `crowd-management-/`:

```env
DB_URL=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>
JWT_SECRET=your-secret-key-here
```

Start the dev server:

```bash
pnpm dev
```

Frontend is now running at **http://localhost:3000**.

### Step 2: Python Backend Setup

```bash
cd backend-final/crowd-management-small-model
python -m venv venv
.\venv\Scripts\Activate.ps1          # Windows
pip install fastapi uvicorn python-multipart ultralytics opencv-python numpy
```

Start the FastAPI server:

```bash
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Backend is now running at **http://localhost:8000**.

### Step 3: Start YOLO Processor (for Ambulance feed)

```bash
python y_h_A.py
```

- Select `1` for webcam or `2` for video file.
- Preview frames: press `d` to skip, `s` to select.
- Click 4 floor corner points on the selected frame.
- Processing starts — frames are written to `output/` and picked up by `app.py`.

### Terminals Summary

| Terminal | Directory | Command |
|---|---|---|
| 1 — Frontend | `crowd-management-/` | `pnpm dev` |
| 2 — API Server | `backend-final/crowd-management-small-model/` | `python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload` |
| 3 — YOLO Processor | `backend-final/crowd-management-small-model/` | `python y_h_A.py` |

### URLs

| Page | URL |
|---|---|
| Landing Page | http://localhost:3000 |
| Sign In | http://localhost:3000/signin |
| Sign Up | http://localhost:3000/signup |
| Security Guard Dashboard | http://localhost:3000/dashboard/SecurityGuard |
| Ambulance Dashboard | http://localhost:3000/dashboard/ambulance |
| Student Dashboard | http://localhost:3000/dashboard/student |
| API Health Check | http://localhost:8000/health |
| API Swagger Docs | http://localhost:8000/docs |

---

## 14. Environment Variables

### Frontend (`crowd-management-/.env`)

| Variable | Required | Description |
|---|---|---|
| `DB_URL` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |

### Backend (`app.py`)

No `.env` file needed — camera settings are configured as constants at the top of `app.py`:

| Constant | Default | Description |
|---|---|---|
| `CAMERA_INDEX` | `1` | Camera device index (0 = built-in, 1 = Iriun) |
| `CAMERA_BACKEND` | `cv2.CAP_DSHOW` | OpenCV capture backend |

Camera can also be switched at runtime via `POST /camera/set/{index}`.

---

## 15. Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| **MSMF error** `-1072875772` | MSMF backend fails with virtual cameras (Iriun) | Already fixed — using `cv2.CAP_DSHOW` |
| **Camera feed black / no image** | Wrong camera index | Call `GET /cameras` to see available cameras, then `POST /camera/set/{correct_index}` |
| **Ambulance feed not showing** | `y_h_A.py` not running | Start it in a third terminal: `python y_h_A.py` |
| **Security Guard feed error** | `app.py` not running | Start the FastAPI server first |
| **"Not authenticated" redirect** | Missing or expired JWT cookie | Sign in again |
| **MongoDB connection error** | Wrong `DB_URL` or network issue | Check `.env` file and MongoDB Atlas network access |
| **`pnpm dev` fails** | Missing dependencies | Run `pnpm install` first |
| **Port 8000 in use** | Another process on the port | Kill it or change the uvicorn port |
| **Iriun webcam not detected** | App not running on phone | Open the Iriun Webcam app on your phone and ensure it's connected |

---

## 16. Future Scope

| Priority | Feature | Description |
|---|---|---|
| **P0** | Live multi-camera support | Stream from multiple cameras simultaneously with a grid view |
| **P0** | Auto alert thresholds | Trigger alerts automatically when crowd density exceeds a configurable limit |
| **P1** | WebSocket upgrade | Replace HTTP polling with WebSocket for real-time stats (lower latency) |
| **P1** | Cross-role messaging | Real-time chat between Students, Security Guards, and Ambulance via database + WebSocket |
| **P1** | GPU acceleration | Enable CUDA for YOLOv5 inference (10×+ speed improvement) |
| **P1** | Mobile responsiveness | Responsive layouts + Progressive Web App (PWA) support |
| **P2** | Analytics dashboard | Historical crowd density charts, peak-hour analysis, incident logs |
| **P2** | Recording & playback | Save detection sessions and replay them later |
| **P2** | Multi-camera heatmap | Aggregate heatmaps from multiple camera angles |
| **P3** | Admin dashboard | User management, system configuration, audit logs |
| **P3** | Docker deployment | Docker Compose for one-command setup of all three services |
| **P3** | Model optimization | YOLOv5-nano, ONNX Runtime, or TensorRT for faster inference on edge devices |

---

*Last updated: February 2026*
