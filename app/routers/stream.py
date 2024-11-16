from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.face_service import FaceService
import cv2
import asyncio
from concurrent.futures import ThreadPoolExecutor
import base64

router = APIRouter()

# ThreadPoolExecutor 생성
executor = ThreadPoolExecutor(max_workers=2)

face_service = FaceService()  # 얼굴 서비스 초기화

@router.websocket("/ws/stream")
async def camera_stream(websocket: WebSocket, camera_id: int):
    """WebSocket을 통해 특정 카메라 스트림을 제공합니다."""
    await websocket.accept()
    print(f"Client connected for Camera {camera_id} stream.")

    # 카메라 스트림 열기
    cap = cv2.VideoCapture(camera_id)
    if not cap.isOpened():
        await websocket.send_text("Failed to open camera.")
        await websocket.close()
        return

    frame_count = 0  # 프레임 카운트 초기화

    try:
        while True:
            ret, frame = await asyncio.get_event_loop().run_in_executor(executor, cap.read)
            if not ret:
                await websocket.send_text("Failed to capture frame.")
                break

            frame_count += 1

            if camera_id == 0:  # 첫 번째 카메라만 얼굴 탐지 및 인식 수행
                # 매 프레임마다 얼굴 탐지
                processed_frame = face_service.process_frame(frame, frame_count)
                labels = face_service.previous_labels

                # Unknown이면서 30 프레임마다 얼굴 임베딩 및 검색을 다시 수행 
                if frame_count % 30 == 0:
                    frame_count=0
                    if "Unknown" in labels:
                        face_service.trigger_recognition()

                _, buffer = cv2.imencode('.jpg', processed_frame)
                frame_base64 = base64.b64encode(buffer).decode('utf-8')

                response = {
                    "frame": frame_base64,
                    "label": labels[0] if labels else "None"
                }

            else:
                # 다른 카메라는 처리 없이 그대로 스트리밍
                _, buffer = cv2.imencode('.jpg', frame)
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
                response = {"frame": frame_base64}
            
            await websocket.send_json(response)
            await asyncio.sleep(0.033)  # 약 30 FPS로 스트리밍 유지
    except WebSocketDisconnect:
        print(f"Client disconnected from Camera {camera_id} stream.")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        cap.release()
        await websocket.close()
        if camera_id == 0:
            face_service.close()
