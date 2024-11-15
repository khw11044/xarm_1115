import sounddevice as sd
import numpy as np
import asyncio
import speech_recognition as sr
import whisper
from concurrent.futures import ThreadPoolExecutor
from fastapi import WebSocket
from queue import Queue
import torch
from starlette.websockets import WebSocketState


# 볼륨 데이터를 WebSocket으로 전송
async def start_audio_stream(websocket: WebSocket):
    loop = asyncio.get_event_loop()
    executor = ThreadPoolExecutor(max_workers=1)

    def audio_callback(indata, frames, time, status):
        volume_norm = np.linalg.norm(indata) * 20  # 볼륨 크기 계산
        volume_percentage = min(volume_norm, 100)  # 0~100 사이로 정규화

        # WebSocket 상태 확인 후 비동기 전송
        loop.run_in_executor(executor, send_volume, websocket, volume_percentage)

    def send_volume(websocket: WebSocket, volume_percentage: float):
        if websocket.application_state == WebSocketState.CONNECTED:
            loop.create_task(websocket.send_text(f"volume:{int(volume_percentage)}"))
        else:
            print("WebSocket disconnected, cannot send volume data.")

    try:
        with sd.InputStream(callback=audio_callback):
            while websocket.application_state == WebSocketState.CONNECTED:
                await asyncio.sleep(0.1)  # 스트림 유지 및 전송 주기
    except Exception as e:
        print(f"Audio stream error: {e}")


# 음성 인식을 수행하고 텍스트 결과를 WebSocket으로 전송
async def start_speech_recognition(websocket: WebSocket):
    loop = asyncio.get_event_loop()
    data_queue = Queue()
    recorder = sr.Recognizer()
    source = sr.Microphone(sample_rate=16000)

    # 주변 소음에 따라 에너지 임계값을 자동으로 조정
    recorder.energy_threshold = 500
    recorder.dynamic_energy_threshold = True
    recorder.dynamic_energy_adjustment_damping = 0.3  # 보정 속도 조정 (낮을수록 빠름)
    
    # 초기 소음 보정
    with source:
        recorder.adjust_for_ambient_noise(source, duration=1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    audio_model = whisper.load_model("base", device=device)

    def record_callback(_, audio: sr.AudioData):
        data = audio.get_raw_data()
        data_queue.put(data)

    recorder.listen_in_background(source, record_callback, phrase_time_limit=3)

    try:
        while websocket.application_state == WebSocketState.CONNECTED:
            if not data_queue.empty():
                audio_data = b''.join(data_queue.queue)
                data_queue.queue.clear()

                audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
                result = audio_model.transcribe(audio_np, language="korean")
                text = result['text'].strip()

                if websocket.application_state == WebSocketState.CONNECTED:
                    await websocket.send_text(f"text:{text}")
            await asyncio.sleep(0.1)
    except Exception as e:
        if websocket.application_state == WebSocketState.CONNECTED:
            await websocket.send_text(f"error:{str(e)}")
        print(f"Speech recognition error: {e}")