document.addEventListener("DOMContentLoaded", () => {
    const video = document.getElementById("webcam");
    const canvas = document.getElementById("captureCanvas");
    const btnShutter = document.getElementById("btnShutter");
    const btnFlip = document.getElementById("btnFlip");
    const btnClose = document.getElementById("btnClose");

    let currentStream = null;
    let facingMode = "environment"; // 모바일 기본: 후면 카메라 ("user"는 전면)

    // 1. 카메라 시작 함수
    async function startCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = currentStream;
        } catch (err) {
            console.error("카메라 접근 권한 거부 또는 오류:", err);
            alert("카메라를 사용할 수 없습니다. 권한을 확인해주세요.");
        }
    }

    // 2. 셔터 버튼 클릭 -> 사진 캡처 후 photo_review.html로 이동
    btnShutter.addEventListener("click", () => {
        if (!video.videoWidth) return;

        // 캔버스 크기를 비디오 원본 비율에 맞춤
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 캡처한 이미지를 Data URL(Base64)로 변환 후 localStorage에 저장
        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        localStorage.setItem("capturedPhoto", imageDataUrl);

        // photo_review 페이지로 이동
        window.location.href = "./photo_review.html";
    });

    // 3. 전면/후면 카메라 전환
    btnFlip.addEventListener("click", () => {
        facingMode = (facingMode === "environment") ? "user" : "environment";
        startCamera();
    });

    // 4. 닫기 버튼
    btnClose.addEventListener("click", () => {
        window.location.href = "./camera_ready.html";
    });

    // 실행
    startCamera();
});