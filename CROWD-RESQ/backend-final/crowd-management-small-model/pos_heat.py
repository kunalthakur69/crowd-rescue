import cv2
import numpy as np
import torch
import os
from datetime import datetime
import heapq

# ---------- A* Pathfinding ----------
def astar(cost_map, start, end):
    rows, cols = cost_map.shape
    open_set = [(0, start)]
    came_from = {}
    g_score = {start: 0}

    def heuristic(a, b):
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    while open_set:
        _, current = heapq.heappop(open_set)
        if current == end:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            return path[::-1]

        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            neighbor = (current[0] + dx, current[1] + dy)
            if 0 <= neighbor[0] < rows and 0 <= neighbor[1] < cols:
                tentative_g = g_score[current] + cost_map[neighbor]
                if neighbor not in g_score or tentative_g < g_score[neighbor]:
                    g_score[neighbor] = tentative_g
                    f_score = tentative_g + heuristic(neighbor, end)
                    heapq.heappush(open_set, (f_score, neighbor))
                    came_from[neighbor] = current
    return []

# ----- Function to let user click 4 points -----
def get_four_points_from_image(image):
    points = []

    def mouse_handler(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            if len(points) < 4:
                points.append((x, y))
                print(f"📍 Point {len(points)}: ({x}, {y})")

    clone = image.copy()
    cv2.namedWindow("Select 4 ground points")
    cv2.setMouseCallback("Select 4 ground points", mouse_handler)

    print("🖱️ Please click 4 points on the ground in this order:")
    print("   1. Top-left")
    print("   2. Top-right")
    print("   3. Bottom-right")
    print("   4. Bottom-left")
    print("🔔 Press any key after selecting 4 points to continue.")

    while True:
        temp = clone.copy()
        for p in points:
            cv2.circle(temp, p, 5, (0, 255, 0), -1)
        cv2.imshow("Select 4 ground points", temp)
        if cv2.waitKey(1) & 0xFF != 255 and len(points) == 4:
            break
    cv2.destroyWindow("Select 4 ground points")
    return points

# ---------- Select Input Source ----------
while True:
    print("📷 Select input source:")
    print("  1 - Webcam")
    print("  2 - Video file")
    choice = input("Enter your choice (1 or 2): ").strip()

    if choice == "1":
        video_path = 0
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print("❌ Error: Webcam not found. Please check your camera and try again.")
            continue
        source_info = "webcam"
        break

    elif choice == "2":
        video_path = input("📂 Enter the video path (in quotes, e.g., \"F:\\Crowd Management\\video.mp4\"): ").strip('"')
        if not os.path.exists(video_path):
            print(f"❌ Error: The video path does not exist: {video_path}")
            continue
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"❌ Error: Could not open video: {video_path}")
            continue
        source_info = "video"
        break

    else:
        print("❗ Invalid choice. Please enter 1 for webcam or 2 for video.")

# ---------- Output Directory ----------
output_dir = r'F:\Crowd Management\data_ansh\output'
os.makedirs(output_dir, exist_ok=True)

# ---------- Unique Output File ----------
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
output_filename = f"heatmap_output_with_path_{timestamp}.mp4"
output_path = os.path.join(output_dir, output_filename)

# ---------- Load YOLOv5 Model ----------
print("🧠 Loading YOLOv5 model...")
model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)
model.conf = 0.4
model.classes = [0]  # Person class only

# ---------- Video Properties ----------
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = cap.get(cv2.CAP_PROP_FPS) or 25.0

# ---------- Video Writer ----------
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

# ---------- Background Subtractor ----------
fgbg = cv2.createBackgroundSubtractorMOG2(history=1500, varThreshold=16, detectShadows=False)

# ---------- Heatmap Accumulator ----------
heatmap_acc = np.zeros((height, width), dtype=np.float32)
alpha = 0.6
sigma = 15

# ---------- Get First Frame and Ask for 4 Points ----------
print("📸 Capturing initial frame for point selection...")
while True:
    ret, first_frame = cap.read()
    if not ret:
        print("❌ Failed to capture frame. Retrying...")
        continue

    ground_points = get_four_points_from_image(first_frame)
    print(f"✅ Selected ground points: {ground_points}")

    # For videos, reset to start
    if source_info == "video":
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    break

# # 🖱️ Get 4 user-defined ground points
# ground_points = get_four_points_from_image(first_frame)
# print(f"✅ Selected ground points: {ground_points}")

# # Reset video stream to start again from the beginning
# cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

frame_index = 0

print("🚀 Processing started. Press 'q' to stop (for webcam)...")

while True:
    ret, frame = cap.read()
    if not ret:
        print("🛑 End of video.")
        break

    frame_index += 1
    print(f"🔄 Processing frame {frame_index}...")

    # ---------- YOLO Detection ----------
    results = model(frame)
    detections = results.xyxy[0].cpu().numpy()

    # ---------- Motion Detection ----------
    fgmask = fgbg.apply(frame)
    motion_mask = cv2.threshold(fgmask, 200, 255, cv2.THRESH_BINARY)[1]
    motion_mask = cv2.medianBlur(motion_mask, 5)

    heatmap_acc *= 0.95
    for *xyxy, conf, cls in detections:
        x1, y1, x2, y2 = map(int, xyxy)
        heatmap_acc[y1:y2, x1:x2] += 1

    heatmap_acc += (motion_mask / 255.0) * 0.5

    # ---------- Generate Heatmap Overlay ----------
    blurred = cv2.GaussianBlur(heatmap_acc, (0, 0), sigma)
    norm = cv2.normalize(blurred, None, 0, 255, cv2.NORM_MINMAX)
    heatmap_color = cv2.applyColorMap(norm.astype(np.uint8), cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(frame, alpha, heatmap_color, 1 - alpha, 0)

    # ---------- Calculate Dynamic Ambulance Path ----------
    grid_size = 20
    grid_h, grid_w = grid_size, grid_size
    resized_cost = cv2.resize(norm, (grid_w, grid_h))
    cost_map = resized_cost.astype(np.float32) + 1  # Avoid 0 cost

    start = (grid_h - 1, 0)    # bottom-left
    mid = (0, grid_w - 1)      # top-right (injured)
    end = (0, 0)               # top-left (exit)

    path1 = astar(cost_map, start, mid)
    path2 = astar(cost_map, mid, end)
    full_path = path1 + path2

    for i in range(len(full_path) - 1):
        y1, x1 = full_path[i]
        y2, x2 = full_path[i + 1]
        pt1 = (int((x1 + 0.5) * width / grid_w), int((y1 + 0.5) * height / grid_h))
        pt2 = (int((x2 + 0.5) * width / grid_w), int((y2 + 0.5) * height / grid_h))
        cv2.circle(overlay, pt1, 2, (0,255,0), -1)
        if i % 5 == 0:
            cv2.arrowedLine(overlay, pt1, pt2, (0,255,0), 2 , tipLength=0.4)

    # ---------- Show Info ----------
    person_count = len(detections)
    cv2.putText(overlay, f'People: {person_count}', (15, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

    out.write(overlay)

    if source_info == "webcam":
        cv2.imshow("Live Feed", overlay)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("🛑 Exit signal received (q pressed).")
            break

cap.release()
out.release()
cv2.destroyAllWindows()
print(f"\n✅ Hybrid heatmap + dynamic path video saved to: {output_path}")
