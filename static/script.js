// WebSocket 연결 설정
let socket = new WebSocket("ws://localhost:8000/ws");
let camera1WebSocket, camera2WebSocket; // 카메라 스트리밍 WebSocket

// 텍스트 박스 복귀 타이머
let resetTimer;

// 오디오 스트림 변수
let audioStream = null;
let isMicOn = false; // 마이크 상태 추적

// WebSocket 메시지 처리
socket.onmessage = function(event) {
    const data = event.data;

    if (!isMicOn) return; // 마이크가 OFF 상태일 때 데이터 무시

    if (data.startsWith("volume:")) {
        const volume = parseInt(data.split(":")[1], 10);
        const volumeDisplay = document.getElementById("volume-display");
        volumeDisplay.textContent = "Volume: " + volume + "%";

        const volumeBar = document.getElementById("volume-bar");
        volumeBar.style.width = volume + "%";

        // 텍스트 입력 박스 경계선 강조
        const userInput = document.getElementById("user-input");
        if (volume >= 20) {
            userInput.classList.add("active");

            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                userInput.classList.remove("active");
            }, 1000);
        }
    } else if (data.startsWith("text:")) {
        const text = data.split(":")[1];
        const userInput = document.getElementById("user-input");
        userInput.value = text;
    }
};

// WebSocket 연결 성공
socket.onopen = function() {
    console.log("WebSocket connected");
};

// WebSocket 연결 종료
socket.onclose = function() {
    console.log("WebSocket connection closed.");
};

socket.onerror = function(error) {
    console.error("WebSocket error:", error);
};

// 마이크 On/Off 스위치 토글
async function toggleAudio() {
    const audioToggle = document.getElementById("toggle-recognition");

    if (audioToggle.checked) {
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            isMicOn = true; // 마이크 상태 설정
            console.log("Audio stream started");
        } catch (error) {
            console.error("Error accessing audio:", error);
            audioToggle.checked = false; // 에러 발생 시 스위치 OFF로 복구
        }
    } else {
        if (audioStream) {
            let tracks = audioStream.getTracks();
            tracks.forEach(track => track.stop()); // 오디오 스트림 중지
            console.log("Audio stream stopped");
        }
        isMicOn = false; // 마이크 상태 해제
        audioStream = null;
    }
}

// 카메라 ON/OFF 토글
function toggleCamera(cameraId) {
    const isOn = document.getElementById(`camera${cameraId}-toggle`).checked;
    const feedElement = document.getElementById(`camera${cameraId}-feed`);

    if (isOn) {
        if (cameraId === 1) {
            camera1WebSocket = startStreamWebSocket(cameraId-1, feedElement);
        } else if (cameraId === 2) {
            camera2WebSocket = startStreamWebSocket(cameraId, feedElement);
        }
    } else {
        if (cameraId === 1 && camera1WebSocket) {
            camera1WebSocket.close();
            feedElement.src = ""; // 검은 화면
        } else if (cameraId === 2 && camera2WebSocket) {
            camera2WebSocket.close();
            feedElement.src = ""; // 검은 화면
        }
    }
}

// WebSocket을 통해 카메라 스트림 시작
function startStreamWebSocket(cameraId, feedElement) {
    const websocket = new WebSocket(`ws://${location.host}/ws/stream?camera_id=${cameraId}`);

    websocket.onmessage = (event) => {
        const blob = new Blob([event.data], { type: "image/jpeg" });
        const objectURL = URL.createObjectURL(blob);

        feedElement.src = objectURL;

        feedElement.onload = () => {
            URL.revokeObjectURL(objectURL); // 메모리 누수 방지
        };
    };

    websocket.onclose = () => {
        console.log(`Camera ${cameraId} stream stopped.`);
    };

    websocket.onerror = (error) => {
        console.error(`Camera ${cameraId} WebSocket error:`, error);
    };

    return websocket;
}

// 메시지 전송 및 RAG 응답 처리
async function sendMessage() {
    const userInput = document.getElementById("user-input");
    const message = userInput.value.trim();

    if (message) {
        addMessage("user", message);
        userInput.value = ""; // 입력 필드 초기화

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ question: message })
            });

            if (!response.ok) {
                throw new Error("서버 응답 실패");
            }

            const data = await response.json();
            addMessage("bot", data.answer); // RAG 응답 추가
        } catch (error) {
            console.error("Error:", error);
            addMessage("bot", "에러가 발생했습니다. 다시 시도해주세요.");
        }
    }
}

// 메시지를 chat-box에 추가하는 함수
function addMessage(sender, text) {
    const chatBox = document.getElementById("chat-box");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Enter 키로 메시지 전송
function handleKeyPress(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}
