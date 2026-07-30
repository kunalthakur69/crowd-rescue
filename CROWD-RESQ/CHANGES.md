# CROWD-RESQ — Changes Log

> **Date:** February 14, 2026  
> **Scope:** Backend API (`app.py`) + Frontend SecurityGuard Dashboard (`page.tsx`)

---

## Summary

The AI detection video feed on the SecurityGuard dashboard was completely non-functional. Multiple missing/mismatched API endpoints, a blocking dependency on homography calibration, and incorrect stream URLs were the root causes. A new **Crowd Density Heatmap** feature was also added.

---

## Problems Found (Before)

### Backend (`backend-final/crowd-management-small-model/app.py`)

| # | Issue | Detail |
|---|-------|--------|
| 1 | **Missing `/start` endpoint** | Frontend called `POST /start` but backend only had `POST /stream/processed/start` |
| 2 | **Missing `/stop` endpoint** | Frontend called `POST /stop` but backend only had `POST /stream/processed/stop` |
| 3 | **`/health` missing `running` field** | Frontend checked `data.running` from `/health`, but backend only returned `{"ok": true, "ts": ...}` — no `running` status |
| 4 | **Missing `/latest` endpoint** | Frontend polled `GET /latest` every second for live detection counts/FPS — endpoint did not exist |
| 5 | **`_processed_worker` blocked without homography** | The YOLO processing thread required 4 ground points via `POST /vision/points` before doing *anything*. Without those points, the stream just showed a static "POST /vision/points" text and never ran YOLO |
| 6 | **No heatmap-only endpoint** | No way to get a standalone crowd density heatmap image or stream |
| 7 | **Processed frames not written to shared files** | The in-memory processed stream (`/stream.processed.mjpg`) and shared-file stream (`/shared/processed.mjpg`) were independent — processed frames were not written to `output/shared_processed.jpg` |
| 8 | **No FPS tracking** | The backend never calculated or reported frames-per-second |

### Frontend (`crowd-management-/app/dashboard/SecurityGuard/page.tsx`)

| # | Issue | Detail |
|---|-------|--------|
| 1 | **Wrong video stream URL** | AI detection feed used `${YOLO_API}/shared/processed.mjpg` (reads from disk files written by `y_h_A.py`), which only works when `y_h_A.py` is running separately |
| 2 | **Raw feed always displayed** | When detection was not running, the "Original Feed" tab still tried to load an `<img>` from the backend (broken image) |
| 3 | **No heatmap visualization** | No heatmap card existed on the dashboard |

---

## Changes Made (After)

### 1. Backend — `backend-final/crowd-management-small-model/app.py`

#### a. New global state for detection data & heatmap

**Previously:**
```python
proc_running = False
proc_thread = None

latest_proc_jpeg: Optional[bytes] = None
proc_jpeg_lock = threading.Lock()
```

**Now:**
```python
proc_running = False
proc_thread = None

latest_proc_jpeg: Optional[bytes] = None
proc_jpeg_lock = threading.Lock()

# ---- Detection data tracking (served via /latest) ----
latest_detection_lock = threading.Lock()
latest_detection_info: Dict = {
    "ready": False,
    "ts": None,
    "fps": None,
    "counts": {},
    "detections": [],
}

# ---- Heatmap-only image (served via /heatmap, /heatmap.mjpg) ----
latest_heatmap_jpeg: Optional[bytes] = None
heatmap_jpeg_lock = threading.Lock()
```

#### b. `_processed_worker` rewritten

**Previously:**
- Blocked entirely if homography points (`H`, `H_INV`) were not set
- Did not track FPS
- Did not populate any detection data dict
- Did not generate a standalone heatmap
- Did not write frames to shared output files

**Now:**
- Runs YOLO detection **immediately** regardless of whether homography points are set
- A* pathfinding overlay is only drawn when homography points are available (graceful degradation)
- Calculates and reports FPS
- Populates `latest_detection_info` every frame (served via `GET /latest`)
- Generates a standalone heatmap image (70% heatmap, 30% original) and stores it in `latest_heatmap_jpeg`
- Writes processed overlay + raw frames to `output/shared_processed.jpg` and `output/shared_raw.jpg` for backward compatibility

#### c. `/health` updated

**Previously:**
```python
@app.get("/health")
def health():
    return {"ok": True, "ts": int(time.time())}
```

**Now:**
```python
@app.get("/health")
def health():
    return {"ok": True, "running": proc_running, "ts": int(time.time())}
```

#### d. New endpoints added

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/start` | Start the YOLO detection stream (alias for `/stream/processed/start`) |
| `POST` | `/stop` | Stop the YOLO detection stream (alias for `/stream/processed/stop`) |
| `GET` | `/latest` | Returns JSON with `ready`, `ts`, `fps`, `counts`, `detections` |
| `GET` | `/heatmap` | Returns the latest heatmap as a single JPEG image |
| `GET` | `/heatmap.mjpg` | Live MJPEG stream of the standalone crowd density heatmap |

---

### 2. Frontend — `crowd-management-/app/dashboard/SecurityGuard/page.tsx`

#### a. Added `Flame` icon import

```tsx
import { Bell, Send, LogOut, AlertTriangle, Play, Square, Video, Users, Flame } from "lucide-react";
```

#### b. Fixed AI detection video feed URL

**Previously:**
```tsx
<img src={`${YOLO_API}/shared/processed.mjpg`} ... />
```

**Now:**
```tsx
<img src={`${YOLO_API}/stream.processed.mjpg`} ... />
```

This uses the in-memory MJPEG stream (faster, no dependency on `y_h_A.py`).

#### c. Raw feed shows placeholder when detection is off

**Previously:** Always rendered an `<img>` tag pointing at `/shared/raw.mjpg`, resulting in a broken image when no feed was available.

**Now:** Shows a "Start detection to see the raw feed" placeholder when `yoloRunning` is false.

#### d. New "Crowd Density Heatmap" card added

A full-width (`md:col-span-2`) card was added between the Crowd Detection Stats card and the Emergency Alerts card. It contains:

- A live MJPG stream from `${YOLO_API}/heatmap.mjpg` when detection is running
- A placeholder with "Start Detection" button when detection is off
- A color legend bar: **Blue** (Low) → **Green** (Medium) → **Yellow** (High) → **Red** (Critical)

---

## API Endpoint Reference (Complete)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check + `running` status |
| `POST` | `/start` | Start YOLO detection |
| `POST` | `/stop` | Stop YOLO detection |
| `GET` | `/latest` | Latest detection data (JSON) |
| `GET` | `/heatmap` | Single JPEG heatmap snapshot |
| `GET` | `/heatmap.mjpg` | Live heatmap MJPEG stream |
| `GET` | `/stream.mjpg` | Raw webcam MJPEG stream |
| `GET` | `/stream.processed.mjpg` | Processed (YOLO overlay) MJPEG stream |
| `GET` | `/shared/raw.mjpg` | Raw stream from shared file |
| `GET` | `/shared/processed.mjpg` | Processed stream from shared file |
| `POST` | `/stream/start` | Start raw webcam capture |
| `POST` | `/stream/stop` | Stop raw webcam capture |
| `POST` | `/stream/processed/start` | Start processed YOLO stream |
| `POST` | `/stream/processed/stop` | Stop processed YOLO stream |
| `POST` | `/vision/points` | Set 4 homography ground points (enables A* path) |

---

## How to Run

```bash
# Terminal 1 — Backend (port 8000)
cd backend-final/crowd-management-small-model
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend (port 3000)
cd crowd-management-
pnpm dev
```

1. Open `http://localhost:3000` and sign in as a **SecurityGuard**
2. Click **Start Detection** on the dashboard
3. The AI Detection feed, Crowd Detection Stats, and Crowd Density Heatmap will activate
