# CrowdResQ — Local Setup Guide

## Prerequisites

| Tool    | Version                | Download                         |
| ------- | ---------------------- | -------------------------------- |
| Node.js | 18+                    | https://nodejs.org               |
| pnpm    | 8+                     | `npm install -g pnpm`            |
| Python  | 3.10 – 3.11            | https://www.python.org/downloads |
| MongoDB | Atlas (cloud) or local | https://www.mongodb.com/atlas    |
| Git     | any                    | https://git-scm.com              |

---

## Project Structure

```
crowd-resq-updated/
├── crowd-management-/          ← Next.js frontend (port 3000)
├── backend-final/
│   └── crowd-management-small-model/
│       ├── app.py              ← FastAPI MJPEG streaming server (port 8000)
│       ├── y_h_A.py            ← YOLO + Heatmap + A* processor (writes shared JPGs)
│       ├── yolov5s.pt          ← YOLOv5 model weights
│       └── dataset/test_video/ ← Sample test videos
└── HOW_TO_RUN.md               ← This file
```

---

## Step 1 — Clone / Open the Project

```bash
cd "D:\cohort web dev\projects\next-projects\crowd-resq-updated"
```

---

## Step 2 — Setup the Next.js Frontend

### 2.1 Install dependencies

```bash
cd crowd-management-
npm install
```

### 2.2 Configure environment variables

Create a `.env` file in the `crowd-management-/` folder (if not already present):

```env
DB_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/crowdResqDB
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

> Replace `<username>`, `<password>`, and `<cluster>` with your MongoDB Atlas credentials.

### 2.3 Start the frontend dev server

```bash
npm dev
```

Frontend will be available at: **http://localhost:3000**

---

## Step 3 — Setup the Python Backend (FastAPI)

### 3.1 Navigate to the backend folder

```bash
cd backend-final/crowd-management-small-model
```

### 3.2 Create a virtual environment (recommended)

```bash
python -m venv venv
```

Activate it:

- **Windows (PowerShell):**
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
- **Windows (CMD):**
  ```cmd
  venv\Scripts\activate.bat
  ```
- **macOS / Linux:**
  ```bash
  source venv/bin/activate
  ```

### 3.3 Install Python dependencies

```bash
pip install fastapi uvicorn python-multipart ultralytics opencv-python numpy
```

### 3.4 Start the FastAPI server

```bash
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

> ⚠️ **Common mistake:** Do NOT include `.py` in the command.  
> ❌ `python -m uvicorn app.py:app` → Error  
> ✅ `python -m uvicorn app:app` → Correct

> ⚠️ **Make sure your terminal is inside the `backend-final/crowd-management-small-model/` directory** before running this command.

Backend will be available at: **http://localhost:8000**  
Swagger docs at: **http://localhost:8000/docs**

---

## Step 4 — Run the YOLO Processor (y_h_A.py)

This script captures video (webcam or file), runs YOLO detection, generates heatmaps with A\* pathfinding, and writes shared JPG frames that the FastAPI server serves as MJPEG streams.

### 4.1 Open a new terminal and navigate to the backend folder

```bash
cd backend-final/crowd-management-small-model
```

Activate the virtual environment (same as Step 3.2).

### 4.2 Run the processor

```bash
python y_h_A.py
```

### 4.3 Follow the interactive prompts

1. **Select input source:**
   - Enter `1` for **Webcam**
   - Enter `2` for **Video file** — then provide a path, e.g.:
     ```
     dataset/test_video/contentvideo.mp4
     ```

2. **Select a frame:** Press `s` to select a clear frame, `d` to skip, `q` to quit.

3. **Click 4 ground points:** Click 4 floor corners in the displayed window for homography calibration, then press any key.

4. Processing begins — the script writes `shared_raw.jpg` and `shared_processed.jpg` to the `output/` folder continuously.

### Available test videos

```
dataset/test_video/
├── contentvideo.mp4
├── People Walking Free Stock Footage, Royalty-Free No Copyright Content.mp4
├── People Walking Inside Shopping Mall Stock Footage.mp4
├── pexels-timo-volz-5544073 (1080p).mp4
└── The CCTV People Demo 2.mp4
```

---

## Step 5 — Open the Application

Once all three services are running, open your browser:

| Page               | URL                                           | Description                                |
| ------------------ | --------------------------------------------- | ------------------------------------------ |
| Home / Landing     | http://localhost:3000                         | Landing page                               |
| Sign In            | http://localhost:3000/signin                  | Login page                                 |
| Sign Up            | http://localhost:3000/signup                  | Registration page                          |
| Security Guard     | http://localhost:3000/dashboard/SecurityGuard | Raw + AI-processed live feeds, crowd stats |
| Ambulance          | http://localhost:3000/dashboard/ambulance     | AI-processed feed with evacuation path     |
| Student            | http://localhost:3000/dashboard/student       | Emergency alerts & messaging               |
| API Health Check   | http://localhost:8000/health                  | Backend health endpoint                    |
| API Docs (Swagger) | http://localhost:8000/docs                    | Interactive API documentation              |

---

## Summary — What to Run (3 Terminals)

| Terminal | Directory                                     | Command                                                         |
| -------- | --------------------------------------------- | --------------------------------------------------------------- |
| 1        | `crowd-management-/`                          | `pnpm dev`                                                      |
| 2        | `backend-final/crowd-management-small-model/` | `python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload` |
| 3        | `backend-final/crowd-management-small-model/` | `python y_h_A.py`                                               |

---

## Troubleshooting

| Problem                                          | Solution                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| `Could not import module "app.py"`               | Remove `.py` → use `app:app` not `app.py:app`                                      |
| `Could not import module "app"`                  | Make sure terminal is in `backend-final/crowd-management-small-model/`             |
| `ModuleNotFoundError: No module named 'fastapi'` | Run `pip install fastapi uvicorn python-multipart ultralytics opencv-python numpy` |
| YOLO backend not reachable from frontend         | Ensure FastAPI is running on port 8000                                             |
| CORS error in browser console                    | Backend allows `http://localhost:3000` — ensure frontend runs on port 3000         |
| Video feed shows black / nothing                 | Make sure `y_h_A.py` is running and writing to `output/` folder                    |
| Webcam busy / not found                          | Close other apps using the camera; use a video file instead (option 2)             |
| MongoDB connection error                         | Check `DB_URL` in `.env` — ensure Atlas cluster is accessible                      |
| Port 8000 already in use                         | Kill the old process: `netstat -ano                                                | findstr :8000`then`taskkill /PID <pid> /F` |
