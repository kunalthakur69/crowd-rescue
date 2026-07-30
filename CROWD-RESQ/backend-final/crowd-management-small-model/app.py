# app.py  — Simplified backend: raw camera stream + shared file streams
# -----------------------------------------------------------------------
# Install:
#   pip install fastapi uvicorn python-multipart opencv-python numpy
#
# Run:
#   python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
#
# Endpoints:
#   POST  /stream/start        — start raw webcam capture
#   POST  /stream/stop         — stop raw webcam capture
#   GET   /stream.mjpg         — raw webcam MJPEG stream
#   GET   /shared/raw.mjpg     — raw stream from shared file (written by y_h_A.py)
#   GET   /shared/processed.mjpg — processed stream from shared file (written by y_h_A.py)
#   GET   /health              — health check
#   GET   /cameras             — list available cameras
#   POST  /camera/set/{index}  — switch camera

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
import time
import threading
import os

import cv2


app = FastAPI(title="CROWD-RESQ Backend")

# ✅ Allow Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # change if your Next runs elsewhere
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- CAMERA INDEX CONFIG --------------------
# Default to index 1 (Iriun Webcam). Index 0 is usually the built-in PC webcam.
# Change this or use POST /camera/set to switch at runtime.
# Using CAP_DSHOW (DirectShow) backend — MSMF fails with virtual cameras like Iriun.
CAMERA_INDEX = 1
CAMERA_BACKEND = cv2.CAP_DSHOW  # DirectShow works with Iriun; MSMF does not


def _detect_cameras(max_index: int = 5) -> List[Dict]:
    """Probe camera indices 0..max_index and return which ones are available."""
    available = []
    for idx in range(max_index):
        test_cap = cv2.VideoCapture(idx, CAMERA_BACKEND)
        if test_cap.isOpened():
            w = int(test_cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(test_cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            ok, _ = test_cap.read()
            available.append({"index": idx, "resolution": f"{w}x{h}", "readable": ok})
            test_cap.release()
    return available


# -------------------- OPTIONAL: old auth DB kept but NOT used --------------------
FAKE_USERS = {
    "ansh": {"password": "1234", "name": "Ansh", "role": "student"},
    "admin": {"password": "admin", "name": "Admin", "role": "admin"},
}
TOKENS: Dict[str, str] = {}
NOTIFICATIONS: List[dict] = []


# -------------------- RAW MJPEG STREAM (webcam from API) --------------------
cap = None
cap_lock = threading.Lock()

latest_jpeg: Optional[bytes] = None
jpeg_lock = threading.Lock()

stream_running = False
stream_thread = None


def _camera_worker(camera_index: int = 0):
    """Continuously read webcam frames and keep latest JPEG in memory."""
    global cap, latest_jpeg, stream_running

    with cap_lock:
        cap = cv2.VideoCapture(camera_index, CAMERA_BACKEND)
        if not cap.isOpened():
            print(f"[RAW] Cannot open camera {camera_index}")
            stream_running = False
            return

    fail_count = 0
    MAX_FAILS = 50  # reconnect after 50 consecutive failures

    while stream_running:
        with cap_lock:
            ok, frame = cap.read()

        if not ok or frame is None:
            fail_count += 1
            if fail_count >= MAX_FAILS:
                print(f"[RAW] {fail_count} consecutive failures, reconnecting camera {camera_index}...")
                with cap_lock:
                    if cap is not None:
                        cap.release()
                    cap = cv2.VideoCapture(camera_index, CAMERA_BACKEND)
                fail_count = 0
                time.sleep(1)
            else:
                time.sleep(0.02)
            continue

        fail_count = 0

        cv2.putText(frame, "RAW LIVE", (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        ok, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if ok:
            with jpeg_lock:
                latest_jpeg = jpg.tobytes()

        time.sleep(0.01)

    with cap_lock:
        if cap is not None:
            cap.release()


def _mjpeg_generator():
    boundary = "frame"
    while True:
        with jpeg_lock:
            frame = latest_jpeg

        if frame is None:
            time.sleep(0.02)
            continue

        yield (
            b"--" + boundary.encode() + b"\r\n"
            b"Content-Type: image/jpeg\r\n"
            b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
            + frame + b"\r\n"
        )
        time.sleep(0.03)


# -------------------- SHARED FILE STREAMS (connect with y_h_A.py) --------------------
# y_h_A.py should write these continuously:
SHARED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(SHARED_DIR, exist_ok=True)
SHARED_RAW_JPG = os.path.join(SHARED_DIR, "shared_raw.jpg")
SHARED_PROCESSED_JPG = os.path.join(SHARED_DIR, "shared_processed.jpg")


def _shared_file_mjpeg_generator(file_path: str):
    boundary = "frame"
    last_mtime = 0.0

    while True:
        if os.path.exists(file_path):
            try:
                mtime = os.path.getmtime(file_path)
                if mtime != last_mtime:
                    last_mtime = mtime
                    with open(file_path, "rb") as f:
                        frame = f.read()

                    if frame:
                        yield (
                            b"--" + boundary.encode() + b"\r\n"
                            b"Content-Type: image/jpeg\r\n"
                            b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
                            + frame + b"\r\n"
                        )
            except:
                pass

        time.sleep(0.03)


# --- Models ---
class LoginBody(BaseModel):
    username: str
    password: str


class NotificationBody(BaseModel):
    message: str


# -------------------- Base APIs --------------------
@app.get("/health")
def health():
    return {"ok": True, "camera_index": CAMERA_INDEX, "stream_running": stream_running, "ts": int(time.time())}


@app.get("/cameras")
def list_cameras():
    """Probe available cameras and return their indices + resolutions."""
    cams = _detect_cameras()
    return {"current": CAMERA_INDEX, "available": cams}


@app.post("/camera/set/{index}")
def set_camera(index: int):
    """Switch the active camera index. Restarts raw stream if it was running."""
    global CAMERA_INDEX, stream_running, stream_thread
    if index < 0 or index > 10:
        raise HTTPException(status_code=400, detail="Camera index must be 0-10")

    # Verify camera exists
    test = cv2.VideoCapture(index, CAMERA_BACKEND)
    if not test.isOpened():
        raise HTTPException(status_code=404, detail=f"No camera found at index {index}")
    test.release()

    old_index = CAMERA_INDEX
    CAMERA_INDEX = index

    # Restart raw stream if it was running
    was_running = stream_running
    if stream_running:
        stream_running = False
        time.sleep(0.5)
        stream_running = True
        stream_thread = threading.Thread(target=_camera_worker, args=(CAMERA_INDEX,), daemon=True)
        stream_thread.start()

    return {
        "ok": True,
        "old_index": old_index,
        "new_index": CAMERA_INDEX,
        "restarted": was_running,
    }


# (Kept for compatibility; public anyway)
@app.post("/auth/login")
def login(body: LoginBody):
    user = FAKE_USERS.get(body.username)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = f"token_{body.username}_{int(time.time())}"
    TOKENS[token] = body.username
    return {"token": token, "user": {"username": body.username, "name": user["name"], "role": user["role"]}}


@app.get("/notifications")
def get_notifications():
    return {"count": len(NOTIFICATIONS), "items": NOTIFICATIONS}


@app.post("/notifications")
def create_notification(body: NotificationBody):
    notif = {"id": len(NOTIFICATIONS) + 1, "message": body.message, "by": "public", "ts": int(time.time())}
    NOTIFICATIONS.append(notif)
    return {"created": True, "notification": notif}


# -------------------- RAW Stream APIs (PUBLIC) --------------------
@app.post("/stream/start")
def start_stream():
    global stream_running, stream_thread
    if stream_running:
        return {"ok": True, "status": "already_running"}

    stream_running = True
    stream_thread = threading.Thread(target=_camera_worker, args=(CAMERA_INDEX,), daemon=True)
    stream_thread.start()
    return {"ok": True, "status": "started", "camera_index": CAMERA_INDEX}


@app.post("/stream/stop")
def stop_stream():
    global stream_running
    stream_running = False
    return {"ok": True, "status": "stopping"}


@app.get("/stream.mjpg")
def stream_mjpg():
    return StreamingResponse(_mjpeg_generator(), media_type="multipart/x-mixed-replace; boundary=frame")


# -------------------- SHARED FILE STREAM ENDPOINTS (PUBLIC) --------------------
@app.get("/shared/raw.mjpg")
def shared_raw():
    return StreamingResponse(_shared_file_mjpeg_generator(SHARED_RAW_JPG),
                             media_type="multipart/x-mixed-replace; boundary=frame")


@app.get("/shared/processed.mjpg")
def shared_processed():
    return StreamingResponse(_shared_file_mjpeg_generator(SHARED_PROCESSED_JPG),
                             media_type="multipart/x-mixed-replace; boundary=frame")


