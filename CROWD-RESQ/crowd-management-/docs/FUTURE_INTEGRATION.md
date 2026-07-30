# Future Integration & Feature Roadmap

> CrowdResQ — AI-Powered Crowd Management System

---

## Table of Contents

1. [Live Camera Integration](#1-live-camera-integration)
2. [Multi-Camera Support](#2-multi-camera-support)
3. [Smart Alert System](#3-smart-alert-system)
4. [Heatmap & Analytics Dashboard](#4-heatmap--analytics-dashboard)
5. [Cross-Role Communication](#5-cross-role-communication)
6. [WebSocket Upgrade](#6-websocket-upgrade)
7. [Recording & Playback](#7-recording--playback)
8. [Mobile Responsiveness](#8-mobile-responsiveness)
9. [Backend Optimizations](#9-backend-optimizations)
10. [UI/UX Improvements](#10-uiux-improvements)
11. [Deployment & Scaling](#11-deployment--scaling)
12. [Priority Matrix](#12-priority-matrix)

---

## 1. Live Camera Integration

### Current State

- Backend reads from a recorded `.mp4` video file
- `SOURCE_VIDEO = r"dataset\test_video\original_crowd.mp4"`

### Required Changes

**Backend only** — zero frontend changes needed.

```python
# yolo_api.py — switch source

# Webcam (device index)
SOURCE_VIDEO = 0                    # default camera
SOURCE_VIDEO = 1                    # second camera

# IP Camera (RTSP)
SOURCE_VIDEO = "rtsp://admin:pass@192.168.1.100:554/stream"

# HTTP stream
SOURCE_VIDEO = "http://192.168.1.100:8080/video"
```

**Additional backend changes:**

- Remove video loop-back logic (`cap.set(CAP_PROP_POS_FRAMES, 0)`) — live cameras don't end
- Add reconnection logic if camera disconnects
- Add configurable resolution: `cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)`

**Suggested: Allow source selection via API**

```python
class StartBody(BaseModel):
    source: Optional[str] = None  # override default video source

@app.post("/start")
def start(body: StartBody):
    source = body.source or SOURCE_VIDEO
    # pass source to worker thread
```

**Frontend addition:**

```tsx
// Optional: dropdown to select camera source before starting
<Select onValueChange={setSelectedSource}>
  <SelectItem value="0">Webcam</SelectItem>
  <SelectItem value="rtsp://...">IP Camera - Gate 1</SelectItem>
  <SelectItem value="rtsp://...">IP Camera - Gate 2</SelectItem>
</Select>
```

---

## 2. Multi-Camera Support

### Problem

Currently only one video source can run at a time.

### Solution

Run multiple worker threads, each with its own camera source.

**Backend:**

```python
# New endpoints
POST /cameras                  → Add a camera source
GET  /cameras                  → List active cameras
GET  /cameras/{id}/stream      → MJPEG stream for specific camera
GET  /cameras/{id}/latest      → Stats for specific camera
DELETE /cameras/{id}           → Stop and remove camera
```

**Frontend UI:**

```
┌─────────────────────────────────────────────┐
│  Camera Grid (2x2 or 3x3)                  │
│  ┌──────────┐  ┌──────────┐                │
│  │ Gate 1   │  │ Gate 2   │                │
│  │ 23 people│  │ 8 people │                │
│  └──────────┘  └──────────┘                │
│  ┌──────────┐  ┌──────────┐                │
│  │ Corridor │  │ Exit     │                │
│  │ 45 people│  │ 12 people│                │
│  └──────────┘  └──────────┘                │
│                                             │
│  Click any camera to expand full-screen     │
└─────────────────────────────────────────────┘
```

**UI Components needed:**

- Camera grid layout (responsive 1→2→4 columns)
- Fullscreen camera view (click to expand)
- Camera management panel (add/remove/rename)
- Per-camera stats overlay

---

## 3. Smart Alert System

### Current State

- Red alert when crowd > 50 (frontend-only, hardcoded)
- Manual emergency/medical alert buttons

### Proposed Features

#### 3a. Configurable Thresholds

```tsx
// Admin-configurable alert levels
{
  "warning":  30,   // yellow alert
  "danger":   50,   // orange alert
  "critical": 100   // red alert + auto-notify
}
```

**UI: Alert Configuration Panel**

```
┌──────────────────────────────────┐
│ Alert Thresholds                 │
│                                  │
│ Warning Level:  [===30===]       │
│ Danger Level:   [===50===]       │
│ Critical Level: [===100==]       │
│                                  │
│ Auto-notify ambulance: [✓]      │
│ Auto-notify admin:     [✓]      │
│ Sound alert:           [✓]      │
└──────────────────────────────────┘
```

#### 3b. Automatic Notifications

- **Push notifications** to all roles when threshold exceeded
- **Sound alerts** on the SecurityGuard dashboard
- **Auto-trigger** ambulance dashboard when medical emergency detected
- **Email/SMS integration** via Twilio or SendGrid

#### 3c. Anomaly Detection

- Detect **sudden crowd surges** (count jumps by >20 in 5 seconds)
- Detect **stampede patterns** (rapid directional movement)
- Detect **fights/unusual behavior** (require custom YOLO training)

**Backend endpoint:**

```python
GET /alerts           → List active alerts
POST /alerts/config   → Update thresholds
WS /alerts/live       → WebSocket for real-time alert push
```

---

## 4. Heatmap & Analytics Dashboard

### Crowd Density Heatmap

Overlay a heatmap on the video showing where people cluster.

**Backend addition:**

```python
@app.get("/heatmap")
def heatmap():
    # Generate heatmap from detection coordinates
    # Return as image or coordinate data
```

**Frontend UI:**

```
┌─────────────────────────────────────────────┐
│  Heatmap View                               │
│  ┌───────────────────────────────────────┐  │
│  │  ██████                               │  │
│  │  ████████░░                           │  │
│  │  ██████████░░░░   ░░                  │  │
│  │  ████████░░░░                         │  │
│  │  ██████░░          ░░░               │  │
│  └───────────────────────────────────────┘  │
│  🔴 High density  🟡 Medium  🟢 Low        │
└─────────────────────────────────────────────┘
```

### Historical Analytics

```
┌─────────────────────────────────────────────┐
│  Crowd Analytics                            │
│                                             │
│  📊 Line chart: Crowd count over time       │
│  📊 Bar chart: Peak hours today             │
│  📊 Comparison: Today vs yesterday          │
│  📊 Average crowd density per zone          │
│                                             │
│  Time range: [Today ▼] [Gate 1 ▼]          │
└─────────────────────────────────────────────┘
```

**Requires:**

- Database (MongoDB/PostgreSQL) to store historical detection data
- New backend endpoint: `POST /history` to save snapshots
- Charting library: `recharts` (already compatible with shadcn)

---

## 5. Cross-Role Communication

### Current State

- Each role (Student, SecurityGuard, Ambulance) has isolated dashboards
- Messages are simulated (console.log only)

### Proposed: Real-Time Messaging

**Database schema:**

```
messages {
  id, from_role, from_user, to_role,
  message, type (text|alert|emergency),
  location, timestamp, read
}
```

**Backend endpoints:**

```
POST /api/messages           → Send a message
GET  /api/messages?role=...  → Get messages for a role
WS   /api/messages/live      → WebSocket for real-time messages
```

**UI: Unified notification center across all dashboards**

```
┌──────────────────────────────────┐
│ 🔔 Notifications          [3]   │
│ ─────────────────────────────    │
│ 🔴 EMERGENCY: Gate 2 overcrowded│
│    from: SecurityGuard · 2m ago  │
│ ─────────────────────────────    │
│ 🟡 Medical help needed Bldg A   │
│    from: Student · 5m ago        │
│ ─────────────────────────────    │
│ ✅ Ambulance dispatched          │
│    from: Ambulance · 5m ago      │
└──────────────────────────────────┘
```

---

## 6. WebSocket Upgrade

### Current State

- Frontend polls `GET /latest` every 1 second (HTTP polling)
- MJPEG stream already works in real-time

### Problem

Polling creates unnecessary HTTP overhead and has 1-second latency.

### Solution: WebSocket for stats

**Backend:**

```python
from fastapi import WebSocket

@app.websocket("/ws/stats")
async def ws_stats(websocket: WebSocket):
    await websocket.accept()
    while True:
        with _state_lock:
            data = dict(_latest)
        await websocket.send_json(data)
        await asyncio.sleep(0.5)
```

**Frontend:**

```tsx
useEffect(() => {
  const ws = new WebSocket("ws://localhost:8000/ws/stats");
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.ready) setDetectionData(data);
  };
  return () => ws.close();
}, []);
```

**Benefits:**

- Lower latency (500ms → real-time)
- Less HTTP overhead
- Bidirectional communication ready for future features

---

## 7. Recording & Playback

### Record Detection Sessions

```python
# Backend: save annotated frames as video
@app.post("/record/start")
@app.post("/record/stop")
@app.get("/recordings")          → List saved recordings
@app.get("/recordings/{id}")     → Playback a recording
```

### Frontend UI

```
┌──────────────────────────────────┐
│ 🔴 Recording... (00:12:34)      │
│ [Stop Recording]                 │
│                                  │
│ Past Recordings:                 │
│ ┌──────────────────────────────┐ │
│ │ 2026-02-14 14:30 · 12 min   │ │
│ │ Peak: 67 people · Gate 1    │ │
│ │ [Play] [Download] [Delete]  │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

---

## 8. Mobile Responsiveness

### Current Issues

- Dashboard grid doesn't adapt well to small screens
- Video stream aspect ratio breaks on mobile
- Buttons too small for touch targets

### Fixes

```tsx
// Responsive grid
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

// Video container
<div className="aspect-video w-full max-h-[60vh]">

// Touch-friendly buttons
<Button size="lg" className="min-h-[48px] min-w-[48px]">

// Bottom navigation for mobile
<nav className="fixed bottom-0 left-0 right-0 md:hidden
                bg-white border-t flex justify-around py-2">
  <button>📹 Stream</button>
  <button>📊 Stats</button>
  <button>🚨 Alert</button>
  <button>💬 Messages</button>
</nav>
```

### PWA Support

- Add `manifest.json` for installable web app
- Service worker for offline alert history
- Push notifications via Web Push API

---

## 9. Backend Optimizations

### 9a. GPU Acceleration

```python
# Force GPU inference if available
model = torch.hub.load('ultralytics/yolov5', 'yolov5s')
model.to('cuda' if torch.cuda.is_available() else 'cpu')
```

### 9b. Frame Skipping

```python
# Process every Nth frame to reduce CPU load
SKIP_FRAMES = 2  # process every 2nd frame

frame_count = 0
while True:
    ok, frame = cap.read()
    frame_count += 1
    if frame_count % SKIP_FRAMES != 0:
        continue  # skip this frame
    # ... run inference
```

### 9c. Resolution Scaling

```python
# Downscale before inference, upscale for display
small = cv2.resize(frame, (640, 480))
results = model(small)
# Scale detections back to original resolution
```

### 9d. Model Optimization

```python
# Use smaller model for faster inference
model = torch.hub.load('ultralytics/yolov5', 'yolov5n')  # nano = fastest

# Or export to TensorRT / ONNX for production
# yolov5s.onnx → 2-3x faster inference
```

### 9e. Async Worker with asyncio

Replace threading with `asyncio` + `concurrent.futures` for better resource management:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)

async def run_detection():
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, _process_frame, frame)
```

---

## 10. UI/UX Improvements

### 10a. Status Bar

```
┌─────────────────────────────────────────────────────┐
│ 🟢 AI Online · 12.5 FPS · 23 detected · Gate 1     │
└─────────────────────────────────────────────────────┘
```

A persistent top bar showing system status at a glance.

### 10b. Dark Mode Stream Overlay

```tsx
// Overlay stats directly on the video stream
<div className="relative">
  <img src={streamUrl} />
  <div
    className="absolute top-2 left-2 bg-black/60 text-white
                  rounded px-2 py-1 text-xs"
  >
    🟢 LIVE · 12.5 FPS · 23 people
  </div>
  <div
    className="absolute top-2 right-2 bg-red-600/80 text-white
                  rounded px-2 py-1 text-xs animate-pulse"
  >
    ⚠ HIGH DENSITY
  </div>
</div>
```

### 10c. Skeleton Loading States

```tsx
// While waiting for first frame
{
  !detectionData && yoloRunning && (
    <div
      className="aspect-video animate-pulse bg-gray-200 rounded-md
                  flex items-center justify-center"
    >
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      <span className="ml-2 text-sm text-gray-500">Loading AI model...</span>
    </div>
  );
}
```

### 10d. Crowd Gauge Widget

```
     ┌────────────────┐
     │   CROWD LEVEL  │
     │                │
     │   ┌────────┐   │
     │   │ 🔴🔴🔴 │   │
     │   │ 🟡🟡🟡 │   │
     │   │ 🟢🟢🟢 │   │
     │   └────────┘   │
     │    67 / 100     │
     │    DANGER       │
     └────────────────┘
```

Use `<Progress>` component with color-coded thresholds.

### 10e. Fullscreen Mode

```tsx
<Button onClick={() => videoRef.current?.requestFullscreen()}>
  <Maximize className="h-4 w-4" /> Fullscreen
</Button>
```

### 10f. Admin Dashboard

A new role with:

- System-wide stats across all cameras
- User management
- Alert configuration
- Historical data & reports export (CSV/PDF)

---

## 11. Deployment & Scaling

### Docker Compose

```yaml
version: "3.8"
services:
  frontend:
    build: ./crowd-management-
    ports: ["3000:3000"]
    depends_on: [yolo-backend]

  yolo-backend:
    build: ./yolo-backend
    ports: ["8000:8000"]
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    volumes:
      - ./yolo-backend/dataset:/app/dataset

  mongodb:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongo-data:/data/db"]

volumes:
  mongo-data:
```

### Environment Variables

```env
# .env.local (frontend)
NEXT_PUBLIC_YOLO_API=http://localhost:8000

# .env (backend)
WEIGHTS_PATH=runs/train/.../best.pt
SOURCE_VIDEO=0
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Production Checklist

- [ ] HTTPS for both frontend and backend
- [ ] Rate limiting on API endpoints
- [ ] Authentication for YOLO API (API key or JWT)
- [ ] Error handling & graceful degradation
- [ ] Health check monitoring (uptime alerts)
- [ ] Log aggregation (detection events → database)

---

## 12. Priority Matrix

| Priority | Feature                       | Effort | Impact |
| -------- | ----------------------------- | ------ | ------ |
| 🔴 P0    | Live camera integration       | Low    | High   |
| 🔴 P0    | Configurable alert thresholds | Low    | High   |
| 🟡 P1    | WebSocket for real-time stats | Medium | High   |
| 🟡 P1    | Cross-role messaging          | Medium | High   |
| 🟡 P1    | GPU acceleration              | Low    | High   |
| 🟡 P1    | Mobile responsiveness         | Medium | Medium |
| 🟢 P2    | Multi-camera grid             | High   | High   |
| 🟢 P2    | Heatmap overlay               | Medium | Medium |
| 🟢 P2    | Historical analytics          | High   | Medium |
| 🟢 P2    | Recording & playback          | Medium | Medium |
| 🔵 P3    | Admin dashboard               | High   | Medium |
| 🔵 P3    | Docker deployment             | Medium | Low    |
| 🔵 P3    | PWA support                   | Medium | Low    |

---

## Recommended Implementation Order

```
Phase 1 (Now)
  ✅ Live video stream working
  ✅ Crowd detection stats on dashboard
  → Add live camera support (1 line change)
  → Add configurable thresholds

Phase 2 (Next Sprint)
  → WebSocket stats upgrade
  → Cross-role real-time messaging
  → GPU acceleration + frame skipping
  → Mobile responsive layout

Phase 3 (Future)
  → Multi-camera grid
  → Heatmap + analytics dashboard
  → Recording & playback
  → Admin panel

Phase 4 (Production)
  → Docker deployment
  → HTTPS + API auth
  → Monitoring & logging
  → PWA support
```
