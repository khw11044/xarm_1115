import cv2
import time
import asyncio

# 카메라 스트림 관리를 위한 변수
camera_streams = {}

def open_camera(camera_id):
    """특정 카메라 ID로 카메라를 열고 스트림을 시작합니다."""
    if camera_id in camera_streams:
        print(f"Camera {camera_id} is already open.")
        return camera_streams[camera_id]
    
    cap = cv2.VideoCapture(camera_id)
    if not cap.isOpened():
        print(f"Cannot open camera {camera_id}")
        return None

    camera_streams[camera_id] = cap
    print(f"Camera {camera_id} opened.")
    return cap

def close_camera(camera_id):
    """특정 카메라 ID로 카메라를 닫고 스트림을 중지합니다."""
    cap = camera_streams.get(camera_id)
    if cap and cap.isOpened():
        cap.release()
        print(f"Camera {camera_id} closed.")
        del camera_streams[camera_id]
    else:
        print(f"Camera {camera_id} is not open.")

def get_camera_frame(camera_id):
    """특정 카메라 ID의 현재 프레임을 캡처하여 반환합니다."""
    cap = camera_streams.get(camera_id)
    if not cap or not cap.isOpened():
        print(f"Camera {camera_id} is not open.")
        return None
    
    ret, frame = cap.read()
    if not ret:
        print(f"Failed to capture frame from camera {camera_id}.")
        return None

    # 프레임 좌우 반전
    return cv2.flip(frame, 1)
