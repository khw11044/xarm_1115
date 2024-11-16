// WebSocket 연결 설정
let socket = new WebSocket("ws://localhost:8000/ws");
let camera1WebSocket, camera2WebSocket; // 카메라 스트리밍 WebSocket

// 텍스트 박스 복귀 타이머
let resetTimer;

// 오디오 스트림 변수
let audioStream = null;
let isMicOn = false; // 마이크 상태 추적

// 얼굴 감지 관련 변수
let cur_label = "None"; // 초기값은 None으로 설정
let noFaceTimer = null; // 얼굴 감지 타이머
let countdownInterval = null; // 카운트다운 인터벌
const NO_FACE_TIMEOUT = 3000; // 3초
const COUNTDOWN_SECONDS = 3; // 3초 카운트다운

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
            isMicOn = true;
            console.log("Audio stream started");
        } catch (error) {
            console.error("Error accessing audio:", error);
            audioToggle.checked = false;
        }
    } else {
        if (audioStream) {
            let tracks = audioStream.getTracks();
            tracks.forEach(track => track.stop());
            console.log("Audio stream stopped");
        }
        isMicOn = false;
        audioStream = null;
    }
}

// 첫 번째 카메라 WebSocket 연결 및 이벤트 처리
document.getElementById('camera1-toggle').addEventListener('change', async function () {
    const camera1Feed = document.getElementById('camera1-feed');
    const faceLabelContainer = document.getElementById('face-label');
    const countdownTimer = document.getElementById('countdown-timer');
    let ws;

    if (this.checked) {
        try {
            ws = new WebSocket(`ws://${window.location.host}/ws/stream?camera_id=0`);

            ws.onopen = function () {
                console.log('WebSocket connection opened for Camera 1');
            };

            ws.onmessage = function (event) {
                const data = JSON.parse(event.data);

                const imageBlob = new Blob([Uint8Array.from(atob(data.frame), c => c.charCodeAt(0))], { type: 'image/jpeg' });
                const imageUrl = URL.createObjectURL(imageBlob);
                camera1Feed.src = imageUrl;

                if (data.label !== "None") {
                    if (cur_label !== data.label) {
                        cur_label = data.label;
                        resetNoFaceTimer();
                        countdownTimer.textContent = "";

                        if (cur_label === "Unknown") {
                            faceLabelContainer.textContent = `고객님 첫 방문을 환영합니다.`;
                            addBotMessage("환영합니다. 고객님! 저는 아이스크림 토핑 AI 주문 접수원입니다.");
                            addBotMessage("회원가입을 하시면 더 많은 혜택이 있어요. 회원가입하시겠어요?");
                        } else {
                            faceLabelContainer.textContent = `${cur_label} 고객님 재방문을 환영합니다.`;
                            addBotMessage(`고객님, 다시 뵙게 되어 반갑습니다! 주문하시겠어요?`);
                        }
                    }
                } else {
                    startNoFaceTimer();
                }
            };

            ws.onclose = function () {
                console.log('WebSocket connection closed for Camera 1');
            };

            ws.onerror = function (error) {
                console.error('WebSocket error for Camera 1:', error);
                camera1Feed.src = '';
                this.checked = false;
            };

            this.ws = ws;
        } catch (error) {
            console.error('Error opening WebSocket for Camera 1:', error);
            this.checked = false;
        }
    } else {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            camera1Feed.src = '';
            faceLabelContainer.textContent = "Detected Face: None";
            countdownTimer.textContent = "";
        }
    }
});

function startNoFaceTimer() {
    if (noFaceTimer) return;

    let countdown = COUNTDOWN_SECONDS;
    const countdownTimer = document.getElementById('countdown-timer');

    noFaceTimer = setTimeout(async () => {
        if (cur_label === "Unknown") {
            await deleteUnknownSession();
        }
        clearChat();
        document.getElementById('face-label').textContent = "Detected Face: None";
        cur_label = "None";
        countdownTimer.textContent = "";
    }, NO_FACE_TIMEOUT);

    countdownInterval = setInterval(() => {
        countdown -= 1;
        countdownTimer.textContent = `로그아웃까지 ${countdown}초`;

        if (countdown < 0) {
            clearInterval(countdownInterval);
            countdownTimer.textContent = "";
        }
    }, 1000);
}

function resetNoFaceTimer() {
    if (noFaceTimer) {
        clearTimeout(noFaceTimer);
        noFaceTimer = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

function clearChat() {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
}

async function deleteUnknownSession() {
    try {
        const response = await fetch("/chatbot/delete_session", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ session_id: "Unknown" })
        });

        if (!response.ok) {
            throw new Error("Failed to delete session");
        }

        console.log("Unknown User chatHistory deleted successfully.");
    } catch (error) {
        console.error("Error deleting Unknown session:", error);
    }
}

async function saveAIMessageToSQL(message) {
    try {
        const response = await fetch("/chatbot/save_message", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ session_id: cur_label, message: message })
        });

        if (!response.ok) {
            throw new Error("Failed to save message to SQL");
        }

        console.log("Message saved to SQL successfully.");
    } catch (error) {
        console.error("Error saving message to SQL:", error);
    }
}

function addBotMessage(text) {
    const chatBox = document.getElementById("chat-box");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message bot`;
    messageDiv.textContent = text;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    saveAIMessageToSQL(text);
}

async function sendMessage() {
    const userInput = document.getElementById("user-input");
    const message = userInput.value.trim();

    if (message) {
        addMessage("user", message);
        userInput.value = "";

        try {
            const response = await fetch("/chatbot/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    question: message,
                    session_id: cur_label
                })
            });

            if (!response.ok) {
                throw new Error("서버 응답 실패");
            }

            const data = await response.json();
            addMessage("bot", data.answer);
        } catch (error) {
            console.error("Error:", error);
            addMessage("bot", "에러가 발생했습니다. 다시 시도해주세요.");
        }
    }
}

function addMessage(sender, text) {
    const chatBox = document.getElementById("chat-box");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function handleKeyPress(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}
