document.addEventListener("DOMContentLoaded", () => {
    const video = document.getElementById("webcam");
    const canvas = document.getElementById("captureCanvas");
    const btnShutter = document.getElementById("btnShutter");
    const btnFlip = document.getElementById("btnFlip");
    const btnClose = document.getElementById("btnClose");

    // 에러 UI 요소
    const overlayE08 = document.getElementById("overlayE08");
    const cardE09 = document.getElementById("cardE09");
    const modalE10 = document.getElementById("modalE10");
    const cameraPage = document.querySelector(".camera-page");

    let currentStream = null;
    let facingMode = "environment";

    // 모든 에러 UI 초기화
    function resetErrorUI() {
        if (overlayE08) overlayE08.classList.remove("active");
        if (cardE09) cardE09.classList.remove("active");
        if (modalE10) modalE10.classList.remove("active");
        if (cameraPage) cameraPage.classList.remove("state-e08");
    }

    // 카메라 시작
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

    // -----------------------------------------------------------------
    // [핵심] 사진 에러 검사 함수 (프레임 이탈 / 어두움 / 흐림)
    // -----------------------------------------------------------------
    function checkPhotoErrors(ctx, width, height) {
        // 1. 밝기 검사 (E-09)
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        let colorSum = 0;

        for (let i = 0; i < data.length; i += 32) { // 샘플링 연산
            colorSum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        const brightness = colorSum / (data.length / 32);

        // 테스트용 조건 (실제 개발 시 백엔드 응답이나 요구사항 수치에 맞춰 변경)
        const isOutOfFrame = false; // E-08 조건
        const isTooDark = brightness < 40; // E-09 조건 (밝기 기준치 미달)
        const isBlurry = false; // E-10 조건

        if (isOutOfFrame) return "E08";
        if (isTooDark) return "E09";
        if (isBlurry) return "E10";

        return "NONE"; // 에러 없음
    }

    // 셔터 클릭 이벤트
    btnShutter.addEventListener("click", () => {
        if (!video.videoWidth || video.videoWidth === 0) return;

        resetErrorUI();

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        
        try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 1단계: 에러 검사 실행
            const errorType = checkPhotoErrors(ctx, canvas.width, canvas.height);

            // 2단계: 에러 조건 걸리면 UI 띄우고 페이지 이동 중단(return)
            if (errorType === "E08") {
                if (overlayE08) overlayE08.classList.add("active");
                if (cameraPage) cameraPage.classList.add("state-e08");
                return; // 페이지 이동 중단
            } 
            else if (errorType === "E09") {
                if (cardE09) cardE09.classList.add("active");
                return; // 페이지 이동 중단
            } 
            else if (errorType === "E10") {
                if (modalE10) modalE10.classList.add("active");
                return; // 페이지 이동 중단
            }

            // 3단계: 에러가 전혀 없을 때만 정상 저장 및 이동
            saveAndNavigate();

        } catch (err) {
            console.error("캡처 및 검사 중 오류:", err);
        }
    });

    // 사진 저장 및 이동 공통 함수
    function saveAndNavigate() {
        try {
            const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
            localStorage.setItem("capturedPhoto", imageDataUrl);
            
            // 이동하려는 파일명이 프로젝트 구조와 맞는지 확인하세요.
            window.location.href = "./photo_review.html"; 
        } catch (e) {
            console.error("localStorage 저장 실패:", e);
        }
    }

    // E-10 (흐림) 모달 버튼 이벤트
    if (modalE10) {
        const btnUseAnyway = modalE10.querySelector(".btn-use-anyway");
        const btnRetake = modalE10.querySelector(".btn-retake");

        if (btnUseAnyway) {
            btnUseAnyway.addEventListener("click", () => {
                saveAndNavigate(); // 강제 진행
            });
        }
        if (btnRetake) {
            btnRetake.addEventListener("click", () => {
                resetErrorUI(); // 모달 닫고 재촬영
            });
        }
    }

    // 카메라 전환 & 닫기
    btnFlip.addEventListener("click", () => {
        facingMode = (facingMode === "environment") ? "user" : "environment";
        startCamera();
    });

    btnClose.addEventListener("click", () => {
        window.location.href = "./camera_ready.html";
    });

    startCamera();
});