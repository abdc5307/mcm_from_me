document.addEventListener("DOMContentLoaded", () => {
    // =====================================================
    // 공통 설정
    // =====================================================
    const API_BASE = "/api/product/chapter4";
    const selectionId = document.body.dataset.selectionId; // chapter4.html의 data-selection-id 참고

    // TODO: redirect_to 코드 -> 실제 URL 매핑. 프로젝트 라우팅에 맞게 값 교체해주세요.
    const EXTERNAL_ROUTES = {
        "C5-01": `/api/ai_story/view/chapter5/discover/${selectionId}/`,
        "C3-01": "/chapter3/",
    };

    // =====================================================
    // 화면 섹션
    // =====================================================
    const secReady = document.getElementById("sectionReady");
    const secCamera = document.getElementById("sectionCamera");
    const secReview = document.getElementById("sectionReview");
    const secCamError = document.getElementById("sectionCamError");             // E-06
    const secCamUnavailable = document.getElementById("sectionCamUnavailable"); // E-07
    const secSaveError = document.getElementById("sectionSaveError");           // E-11

    const allSections = [secReady, secCamera, secReview, secCamError, secCamUnavailable, secSaveError]
        .filter(Boolean);

    function showSection(target) {
        allSections.forEach((sec) => sec.classList.toggle("active", sec === target));
    }

    function showErrorSection(code) {
        stopLocalStream();
        if (code === "E-06") showSection(secCamError);
        else if (code === "E-07") showSection(secCamUnavailable);
        else if (code === "E-11") showSection(secSaveError);
        else console.warn("처리되지 않은 에러 코드:", code);
    }

    // redirect_to 코드에 따른 화면 전환/이동 공통 처리
    function goTo(redirectTo) {
        switch (redirectTo) {
            case "C4-05":
                showSection(secCamera);
                openCamera();
                break;
            case "C4-09":
                showSection(secReview);
                break;
            case null:
            case undefined:
                break; // 응답이 null이면 현재 화면 유지 (예: ask_staff)
            default:
                if (EXTERNAL_ROUTES[redirectTo]) {
                    window.location.href = EXTERNAL_ROUTES[redirectTo];
                } else {
                    console.warn("매핑되지 않은 redirect_to 값:", redirectTo);
                }
        }
    }

    // =====================================================
    // 요소 참조
    // =====================================================
    const video = document.getElementById("webcam");
    const canvas = document.getElementById("captureCanvas");
    const btnOpenCamera = document.getElementById("btnOpenCamera");
    const btnShutter = document.getElementById("btnShutter");
    const btnRetake = document.getElementById("btnRetake");     // 리뷰 화면 RETAKE
    const btnUsePhoto = document.getElementById("btnUsePhoto"); // 리뷰 화면 USE THIS PHOTO
    const btnFlip = document.getElementById("btnFlip");
    const btnClose = document.getElementById("btnClose");
    const reviewImage = secReview ? secReview.querySelector(".review-card img") : null;

    // E-06 (업로드된 파일 기준 — id 없이 class만 있음)
    const btnOpenSettings = document.querySelector(".open-settings-button");
    const btnContinueWithoutPhoto = document.querySelector(".continue-button");

    // E-07
    const btnRetryCamera = document.querySelector(".retry-button");
    const btnAskStaff = document.querySelector(".ask-staff-button");

    // E-11 (업로드된 파일 기준 — id="btnRetry")
    const btnRetrySave = document.getElementById("btnRetry");

    // E-08 / E-09 오버레이, E-10 모달 (camera.html)
    const cameraGuideText = document.getElementById("cameraGuideText");
    const cardE09 = document.getElementById("cardE09");
    const modalE10 = document.getElementById("modalE10");
    const btnUseAnyway = modalE10 ? modalE10.querySelector(".btn-use-anyway") : null;
    const btnRetakeBlurry = modalE10 ? modalE10.querySelector(".btn-retake") : null;

    let currentStream = null;
    let facingMode = "environment";
    let capturedPhotoId = null; // /capture/ 성공 시 받은 photo_id (리뷰 화면에서 사용)
    let pendingPhotoId = null;  // E-10(블러)로 실패했지만 서버에 저장된 photo_id

    // =====================================================
    // 공통 fetch 유틸
    // =====================================================
    function getCsrfToken() {
        const match = document.cookie.match(/csrftoken=([^;]+)/);
        return match ? match[1] : "";
    }

    function jsonHeaders() {
        return {
            "Content-Type": "application/json",
            "X-CSRFToken": getCsrfToken(),
        };
    }

    // =====================================================
    // 카메라 스트림 (로컬 미디어)
    // =====================================================
    async function getLocalStream() {
        const constraints = {
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
        };
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (video) video.srcObject = currentStream;
    }

    function stopLocalStream() {
        if (currentStream) {
            currentStream.getTracks().forEach((track) => track.stop());
            currentStream = null;
        }
    }

    // "OPEN CAMERA" / retry(E-07) / retake 후 재진입 시 공통 진입점
    // 1) 브라우저에 실제 권한 요청 -> 2) 결과를 백엔드에 보고해서 E-06/E-07 여부 확정
    async function openCamera() {
        try {
            await getLocalStream();
            resetCameraOverlays();
            await reportCameraPermission("granted");
        } catch (err) {
            console.error("카메라 접근 오류:", err);
            const permission =
                err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || err.name === "SecurityError"
                    ? "denied"
                    : "unavailable";
            await reportCameraPermission(permission);
        }
    }

    async function reportCameraPermission(permission) {
        try {
            const res = await fetch(`${API_BASE}/camera/open/`, {
                method: "POST",
                headers: jsonHeaders(),
                body: JSON.stringify({ camera_permission: permission }),
            });
            const data = await res.json();

            if (res.ok) {
                showSection(secCamera); // granted, 스트림은 이미 연결됨
            } else {
                const code = data.error?.code || (permission === "denied" ? "E-06" : "E-07");
                showErrorSection(code);
            }
        } catch (err) {
            console.error("camera/open 요청 실패:", err);
            // 네트워크 오류 시에도 로컬 판정으로 최소한의 폴백 처리
            showErrorSection(permission === "denied" ? "E-06" : "E-07");
        }
    }

    // =====================================================
    // E-08 / E-09 오버레이 표시 (백엔드 응답 기반, 폴링 없음)
    // =====================================================
    function setCameraGuideState(state) {
        // state: "default" | "aligning"(E-08) | "dark"(E-09)
        if (!cameraGuideText || !cardE09) return;

        // 변경점 1: querySelectorAll을 사용하여 관련 클래스를 가진 '모든' 요소를 찾습니다.
        const defaultDescs = cameraGuideText.querySelectorAll(".default-desc");
        const e08Descs = cameraGuideText.querySelectorAll(".e08-desc");

        // 컨테이너 표시 여부 설정
        cameraGuideText.style.display = state === "dark" ? "none" : "";
        cardE09.style.display = state === "dark" ? "flex" : "none";

        // 변경점 2: forEach를 돌면서 영어/한국어 문구를 모두 끄고 켭니다.
        defaultDescs.forEach((desc) => {
            desc.style.display = state === "aligning" ? "none" : "block"; // E-08일 땐 숨김
        });

        e08Descs.forEach((desc) => {
            desc.style.display = state === "aligning" ? "block" : "none"; // E-08일 때만 노출
        });
    }

    function resetCameraOverlays() {
        setCameraGuideState("default");
        if (modalE10) modalE10.style.display = "none";
        pendingPhotoId = null;
    }

    function getShotMode() {
    // 활성화된(.active) 탭 버튼을 찾습니다.
    const activeTab = document.querySelector(".camera-tabs .tab.active");
    const map = { front: "FRONT_45", side: "SIDE", detail: "DETAIL" };
    
    // 활성화된 탭이 있으면 data-angle 값을 읽고, 없으면 기본값 "front"를 줍니다.
    const selectedAngle = activeTab ? activeTab.dataset.angle : "front";
    
    return map[selectedAngle] || "FRONT_45";
}

    // =====================================================
    // 촬영 -> 업로드 -> 품질 검사 결과 처리
    // =====================================================
    if (btnShutter) {
        btnShutter.addEventListener("click", () => {
            if (!video || !video.videoWidth) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                (blob) => {
                    if (blob) uploadCapture(blob);
                },
                "image/jpeg",
                0.9
            );
        });
    }

    async function uploadCapture(blob) {
        const formData = new FormData();
        formData.append("selection_id", selectionId);
        formData.append("shot_mode", getShotMode());
        formData.append("image", blob, "capture.jpg");

        if (btnShutter) btnShutter.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/capture/`, {
                method: "POST",
                headers: { "X-CSRFToken": getCsrfToken() }, // FormData는 Content-Type 자동 설정됨
                body: formData,
            });
            const data = await res.json();

            if (res.ok && data.status === "success") {
                capturedPhotoId = data.data?.id ?? data.data?.photo_id ?? null;
                // 시리얼라이저 이미지 필드명이 다르면 아래 한 줄만 맞춰주세요.
                const imageUrl = data.data?.image_url || data.data?.image;
                if (reviewImage && imageUrl) reviewImage.src = imageUrl;

                resetCameraOverlays();
                goTo(data.redirect_to); // 보통 "C4-09"
            } else {
                handleCaptureFail(data.error?.code, data.photo_id ?? null);
            }
        } catch (err) {
            console.error("사진 업로드 실패:", err);
            alert("사진 업로드 중 오류가 발생했습니다. 다시 시도해주세요.");
        } finally {
            if (btnShutter) btnShutter.disabled = false;
        }
    }

    function handleCaptureFail(code, photoId) {
        if (code === "E-08") {
            setCameraGuideState("aligning");
        } else if (code === "E-09") {
            setCameraGuideState("dark");
        } else if (code === "E-10") {
            pendingPhotoId = photoId;
            if (modalE10) modalE10.style.display = "flex";
        } else {
            console.warn("알 수 없는 캡처 에러 코드:", code);
        }
    }

    // =====================================================
    // 사진 확정(use) / 재촬영(retake) — E-10 모달, 리뷰 화면 공통 사용
    // =====================================================
    async function confirmPhotoAction(photoId, action) {
        try {
            const res = await fetch(`${API_BASE}/photo/${photoId}/action/`, {
                method: "POST",
                headers: jsonHeaders(),
                body: JSON.stringify({ action }),
            });
            const data = await res.json();

            if (res.ok && data.status === "success") {
                goTo(data.redirect_to);
            } else if (action === "use") {
                showErrorSection("E-11"); // use 저장 실패 -> E-11
            }
        } catch (err) {
            console.error("사진 처리 요청 실패:", err);
            if (action === "use") showErrorSection("E-11");
        }
    }

    // E-10 모달 버튼
    if (btnUseAnyway) {
        btnUseAnyway.addEventListener("click", () => {
            if (modalE10) modalE10.style.display = "none";
            if (pendingPhotoId) confirmPhotoAction(pendingPhotoId, "use");
        });
    }
    if (btnRetakeBlurry) {
        btnRetakeBlurry.addEventListener("click", () => {
            if (modalE10) modalE10.style.display = "none";
            if (pendingPhotoId) confirmPhotoAction(pendingPhotoId, "retake");
            resetCameraOverlays();
        });
    }

    // 리뷰 화면 버튼
    if (btnUsePhoto) {
        btnUsePhoto.addEventListener("click", (e) => {
            e.preventDefault(); // <a> 기본 이동 막고 API 응답에 따라 이동
            if (capturedPhotoId) confirmPhotoAction(capturedPhotoId, "use");
        });
    }
    if (btnRetake) {
        btnRetake.addEventListener("click", () => {
            if (capturedPhotoId) confirmPhotoAction(capturedPhotoId, "retake");
        });
    }

    // =====================================================
    // "OPEN CAMERA" 진입
    // =====================================================
    if (btnOpenCamera) {
        btnOpenCamera.addEventListener("click", () => {
            openCamera();
        });
    }

    // =====================================================
    // E-06 버튼
    // =====================================================
    if (btnOpenSettings) {
        btnOpenSettings.addEventListener("click", () => {
            // 브라우저 설정 화면은 JS로 직접 열 수 없어 안내만 노출.
            // 사용자가 브라우저 설정에서 권한을 이미 허용으로 바꿨을 수도 있으니,
            // 안내 후 곧바로 카메라를 한 번 더 시도한다.
            alert("브라우저 설정에서 카메라 권한을 허용한 뒤 확인을 눌러주세요.");
            openCamera();
        });
    }
    if (btnContinueWithoutPhoto) {
        btnContinueWithoutPhoto.addEventListener("click", async () => {
            try {
                const res = await fetch(`${API_BASE}/camera/continue-without-photo/`, {
                    method: "POST",
                    headers: jsonHeaders(),
                    body: JSON.stringify({ selection_id: selectionId }),
                });
                const data = await res.json();
                if (res.ok) {
                    goTo(data.redirect_to);
                } else {
                    alert("진행 중 오류가 발생했습니다. 다시 시도해주세요.");
                }
            } catch (err) {
                console.error("continue-without-photo 요청 실패:", err);
            }
        });
    }

    // =====================================================
    // E-07 버튼
    // =====================================================
    async function callCameraRetry(action) {
        try {
            const res = await fetch(`${API_BASE}/camera/retry/`, {
                method: "POST",
                headers: jsonHeaders(),
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (res.ok) {
                if (data.redirect_to) {
                    goTo(data.redirect_to);
                } else if (action === "ask_staff") {
                    alert("직원 호출이 요청되었습니다."); // redirect_to: null -> 현재 화면 유지
                }
            }
        } catch (err) {
            console.error("camera/retry 요청 실패:", err);
        }
    }
    if (btnRetryCamera) {
        btnRetryCamera.addEventListener("click", () => callCameraRetry("retry"));
    }
    if (btnAskStaff) {
        btnAskStaff.addEventListener("click", () => callCameraRetry("ask_staff"));
    }

    // =====================================================
    // E-11 버튼
    // =====================================================
    if (btnRetrySave) {
        btnRetrySave.addEventListener("click", () => {
            if (capturedPhotoId) confirmPhotoAction(capturedPhotoId, "use");
        });
    }

    // =====================================================
    // 카메라 부가 기능
    // =====================================================
    if (btnFlip) {
        btnFlip.addEventListener("click", async () => {
            facingMode = facingMode === "environment" ? "user" : "environment";
            stopLocalStream();
            try {
                await getLocalStream();
            } catch (err) {
                console.error("카메라 전환 실패:", err);
            }
        });
    }

    if (btnClose) {
        btnClose.addEventListener("click", () => {
            stopLocalStream();
            resetCameraOverlays();
            showSection(secReady);
        });
    }
});
