# Video Feed Flow — Security Guard & Ambulance Dashboards

## Overview

The system provides **two live MJPEG video streams** to different dashboards, powered by a YOLO + Heatmap + A\* pathfinding backend:

1. **YOLO Backend** (`backend-final/crowd-management-small-model/app.py`) — FastAPI server that serves raw camera feed and AI-processed frames (written by `y_h_A.py`).
2. **Next.js Frontend — Security Guard** (`app/dashboard/SecurityGuard/page.tsx`) — Displays both the **live raw camera feed** and the **AI-processed stream** with crowd detection stats.
3. **Next.js Frontend — Ambulance** (`app/dashboard/ambulance/page.tsx`) — Displays the **AI-processed feed** with heatmap overlay and optimal evacuation path.

### Stream Mapping

| Dashboard      | Stream Endpoint              | Content                                      |
| -------------- | ---------------------------- | -------------------------------------------- |
| Security Guard | `GET /shared/raw.mjpg`       | Live raw camera feed (original)              |
| Security Guard | `GET /shared/processed.mjpg` | AI detection + heatmap + A\* path overlay    |
| Ambulance      | `GET /shared/processed.mjpg` | AI detection + heatmap + A\* evacuation path |

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                              │
│                                                                    │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │  Security Guard Dashboard   │  │    Ambulance Dashboard      │  │
│  │                             │  │                             │  │
│  │  Tab 1: AI Detection        │  │  Processed Video Feed       │  │
│  │  <img> ← /shared/processed │  │  <img> ← /shared/processed │  │
│  │                             │  │  (Heatmap + A* Path)        │  │
│  │  Tab 2: Raw Camera          │  │                             │  │
│  │  <img> ← /shared/raw       │  └─────────────────────────────┘  │
│  │                             │                                   │
│  │  Stats: Poll /latest        │                                   │
│  │  Start/Stop: /start /stop   │                                   │
│  └─────────────────────────────┘                                   │
└────────────────────┬───────────────────────────────────────────────┘
                     │ HTTP (localhost:8000)
┌────────────────────▼───────────────────────────────────────────────┐
│            app.py — FastAPI Backend (port 8000)                     │
│                                                                    │
│   Reads shared JPG files written by y_h_A.py:                      │
│     output/shared_raw.jpg       → GET /shared/raw.mjpg             │
│     output/shared_processed.jpg → GET /shared/processed.mjpg       │
│                                                                    │
│   Also supports direct webcam streams:                             │
│     POST /stream/start → GET /stream.mjpg (raw)                   │
│     POST /stream/processed/start → GET /stream.processed.mjpg     │
└────────────────────▲───────────────────────────────────────────────┘
                     │ Writes JPG files to output/
┌────────────────────┴───────────────────────────────────────────────┐
│            y_h_A.py — Standalone Processing Script                 │
│                                                                    │
│  ┌──────────┐   ┌──────────┐   ┌─────────────────────────────┐    │
│  │ Webcam / │──▶│ YOLOv5   │──▶│ Heatmap + Motion Detection  │    │
│  │ Video    │   │ Detect   │   │ + A* Pathfinding            │    │
│  └──────────┘   └──────────┘   └──────────┬──────────────────┘    │
│                                            │                       │
│                      cv2.imwrite() ────────┤                       │
│                      → shared_raw.jpg      │                       │
│                      → shared_processed.jpg│                       │
└────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### 1. Page Load (Frontend)

```
User opens /dashboard/SecurityGuard
         │
         ▼
   Auth check (GET /api/auth/me)
         │
         ├── Not authenticated → redirect to /signin
         │
         ▼
   YOLO health check (GET http://localhost:8000/health)
         │
         ├── Backend reachable → set yoloRunning = data.running
         └── Backend unreachable → show error message
```

### 2. Starting Detection

```
User clicks "Start Detection" button
         │
         ▼
   POST http://localhost:8000/start
         │
         ▼
   Backend spawns a worker thread (_worker_loop)
         │
         ├── Load YOLOv5 model (custom weights or pretrained yolov5s)
         ├── Open video file with OpenCV
         └── Begin processing loop
```

### 3. Backend Processing Loop (Worker Thread)

```
┌─────────────────── LOOP ───────────────────┐
│                                             │
│  1. Read frame from video (cap.read())      │
│     └── If end of video → loop back to 0    │
│                                             │
│  2. Convert BGR → RGB                       │
│                                             │
│  3. Run YOLOv5 inference (model(rgb))       │
│     └── Returns bounding boxes + classes    │
│                                             │
│  4. Parse detections:                       │
│     └── class name, confidence, xyxy coords │
│     └── Count per class                     │
│                                             │
│  5. Annotate frame (draw bboxes + labels)   │
│                                             │
│  6. Encode annotated frame as JPEG          │
│                                             │
│  7. Update shared state (thread-safe):      │
│     └── _latest = {ts, fps, counts, dets}   │
│     └── _latest_jpeg = jpeg bytes           │
│                                             │
│  8. Sleep 1ms → next frame                  │
└─────────────────────────────────────────────┘
```

### 4. MJPEG Stream Delivery (`GET /stream`)

```
Browser <img src="http://localhost:8000/stream">
         │
         ▼
   StreamingResponse (multipart/x-mixed-replace)
         │
         ▼
   Generator loop:
     ┌───────────────────────────────────┐
     │ Read _latest_jpeg from shared state│
     │ Yield as MJPEG frame boundary     │
     │ Sleep 30ms (~33 fps max)          │
     └───────────────────────────────────┘
         │
         ▼
   Browser renders each JPEG frame
   as a continuously updating image
```

### 5. Stats Polling (`GET /latest`)

```
Frontend setInterval (every 1 second)
         │
         ▼
   GET http://localhost:8000/latest
         │
         ▼
   Response JSON:
   {
     "ready": true,
     "ts": 1739500000,
     "fps": 12.5,
     "counts": { "person": 23 },
     "detections": [
       { "cls": "person", "conf": 0.87, "xyxy": [100, 200, 300, 400] },
       ...
     ]
   }
         │
         ▼
   Frontend updates:
     → People Detected count
     → FPS display
     → Class breakdown badges
     → High Crowd Density alert (>50 people)
```

### 6. Stopping Detection

```
User clicks "Stop" button
         │
         ▼
   POST http://localhost:8000/stop
         │
         ▼
   Backend sets _running = False
         │
         ▼
   Worker thread exits loop → releases video capture
   Frontend clears polling interval
   Stream <img> is replaced with placeholder UI
```

---

## API Endpoints (app.py — port 8000)

| Method | Endpoint                  | Description                                      |
| ------ | ------------------------- | ------------------------------------------------ |
| GET    | `/health`                 | Returns `{ ok, ts }`                             |
| POST   | `/start`                  | Starts the detection worker thread               |
| POST   | `/stop`                   | Stops the detection worker thread                |
| GET    | `/latest`                 | Returns latest detection stats as JSON           |
| GET    | `/shared/raw.mjpg`        | **Live raw camera MJPEG stream** (from y_h_A.py) |
| GET    | `/shared/processed.mjpg`  | **Processed MJPEG stream** — heatmap + A\* path  |
| POST   | `/stream/start`           | Start direct webcam raw stream                   |
| GET    | `/stream.mjpg`            | Direct webcam MJPEG (alternative to shared)      |
| POST   | `/vision/points`          | Set 4 ground plane points for homography         |
| POST   | `/stream/processed/start` | Start direct webcam processed stream             |
| GET    | `/stream.processed.mjpg`  | Direct processed MJPEG (alternative to shared)   |
| GET    | `/docs`                   | FastAPI Swagger UI (auto-generated)              |

---

## Frontend Components

### Security Guard Dashboard — Video Feed Card (Two Views)

| View         | Source                                        | Type          |
| ------------ | --------------------------------------------- | ------------- |
| AI Detection | `http://localhost:8000/shared/processed.mjpg` | MJPEG `<img>` |
| Raw Camera   | `http://localhost:8000/shared/raw.mjpg`       | MJPEG `<img>` |

- Toggle between views using "AI Detection" / "Original Feed" buttons
- Start/Stop buttons appear only on the AI Detection view
- Both views are **live MJPEG streams** from the backend (no local video files)

### Security Guard Dashboard — Crowd Detection Stats Card

- **People Detected** — total count from `detectionData.counts`
- **FPS** — inference speed from the backend
- **Detected Classes** — badges showing each class and count
- **High Crowd Density Alert** — red alert when count exceeds 50

### Ambulance Dashboard — Processed Video Feed Card

| Source                                        | Type          |
| --------------------------------------------- | ------------- |
| `http://localhost:8000/shared/processed.mjpg` | MJPEG `<img>` |

- Displays the AI-processed stream with **heatmap overlay** and **A\* evacuation path**
- Live status badge indicates streaming state
- Feature badges: "Heatmap Overlay", "A\* Evacuation Path"

---

## File Locations

```
crowd-resq-updated/
├── backend-final/
│   └── crowd-management-small-model/
│       ├── app.py                    ← FastAPI server (serves MJPEG streams)
│       ├── y_h_A.py                  ← YOLO + Heatmap + A* processor
│       ├── yolov5s.pt                ← YOLOv5 model weights
│       ├── dataset/test_video/       ← Test videos for processing
│       └── output/                   ← Shared JPG files (raw + processed)
│
└── crowd-management-/
    ├── app/dashboard/
    │   ├── SecurityGuard/page.tsx     ← Security Guard dashboard (raw + processed feeds)
    │   ├── ambulance/page.tsx         ← Ambulance dashboard (processed feed)
    │   └── student/page.tsx           ← Student dashboard
    └── docs/
        └── VIDEO_FEED_FLOW.md         ← This document
```

---

## How to Run

1. **Start the FastAPI backend (app.py):**

   ```bash
   cd backend-final/crowd-management-small-model
   python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Start the YOLO processor (y_h_A.py) in a separate terminal:**

   ```bash
   cd backend-final/crowd-management-small-model
   python y_h_A.py
   # Select webcam (1) or video file (2) when prompted
   # Click 4 ground points for homography calibration
   ```

3. **Start Next.js frontend:**

   ```bash
   cd crowd-management-
   pnpm dev
   ```

4. **Open dashboards:**
   - Security Guard: http://localhost:3000/dashboard/SecurityGuard
   - Ambulance: http://localhost:3000/dashboard/ambulance

---

## CORS Configuration

The YOLO backend allows requests from the Next.js dev server:

```python
allow_origins=["http://localhost:3000"]
```

If deploying to a different domain, update this in `yolo_api.py`.

---

## Troubleshooting

| Issue                        | Cause                  | Fix                                           |
| ---------------------------- | ---------------------- | --------------------------------------------- |
| "YOLO backend not reachable" | Backend not running    | Start uvicorn server on port 8000             |
| Stream loads but no video    | Worker not started     | Click "Start Detection" or call `POST /start` |
| `ModuleNotFoundError`        | Missing Python package | `pip install ultralytics pandas seaborn tqdm` |
| Video file not found         | Wrong path in config   | Check `SOURCE_VIDEO` in `yolo_api.py`         |
| CORS error in browser        | Origin not allowed     | Add your frontend URL to `allow_origins`      |
