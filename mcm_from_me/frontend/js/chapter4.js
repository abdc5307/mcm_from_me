document.addEventListener("DOMContentLoaded", () => {
  // =====================================================
  // 공통 설정 및 Selection ID 안전 추출
  // =====================================================
  const API_BASE = "/api/product/chapter4";

  function getSafeSelectionId() {
    const rawId =
      localStorage.getItem("selectionId") ||
      localStorage.getItem("journeySelectionId") ||
      document.body.dataset.selectionId;

    if (!rawId || rawId === "null" || rawId === "undefined" || rawId.trim() === "") {
      return "1";
    }
    return rawId;
  }

  const selectionId = getSafeSelectionId();

  const EXTERNAL_ROUTES = {
    "C5-01": () => `/api/ai_story/view/chapter5/discover/${getSafeSelectionId()}/`,
    "C3-01": () => "/chapter3/",
  };

  // =====================================================
  // 화면 섹션
  // =====================================================
  const secReady = document.getElementById("sectionReady");
  const secCamera = document.getElementById("sectionCamera");
  const secReview = document.getElementById("sectionReview");
  const secCamError = document.getElementById("sectionCamError"); // E-06
  const secCamUnavailable = document.getElementById("sectionCamUnavailable"); // E-07
  const secSaveError = document.getElementById("sectionSaveError"); // E-11

  const allSections = [
    secReady,
    secCamera,
    secReview,
    secCamError,
    secCamUnavailable,
    secSaveError,
  ].filter(Boolean);

  function showSection(target) {
    allSections.forEach((sec) =>
      sec.classList.toggle("active", sec === target)
    );
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
      case "C5-01":
        const targetId = getSafeSelectionId();
        window.location.href = `/api/ai_story/view/chapter5/discover/${targetId}/`;
        break;
      case undefined:
        break;
      default:
        if (EXTERNAL_ROUTES[redirectTo]) {
          const route = EXTERNAL_ROUTES[redirectTo];
          window.location.href = typeof route === "function" ? route() : route;
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
  const btnRetake = document.getElementById("btnRetake");
  const btnUsePhoto = document.getElementById("btnUsePhoto");
  const btnFlip = document.getElementById("btnFlip");
  const btnClose = document.getElementById("btnClose");
  const reviewImage = secReview
    ? secReview.querySelector(".review-card img")
    : null;

  // E-06
  const btnOpenSettings = document.querySelector(".open-settings-button");
  const btnContinueWithoutPhoto = document.querySelector(".continue-button");

  // E-07
  const btnRetryCamera = document.querySelector(".retry-button");
  const btnAskStaff = document.querySelector(".ask-staff-button");

  // E-11
  const btnRetrySave = document.getElementById("btnRetry");

  // E-08 / E-09 오버레이, E-10 모달 (camera.html)
  const cameraGuideText = document.getElementById("cameraGuideText");
  const cardE09 = document.getElementById("cardE09");
  const modalE10 = document.getElementById("modalE10");
  const btnUseAnyway = modalE10
    ? modalE10.querySelector(".btn-use-anyway")
    : null;
  const btnRetakeBlurry = modalE10
    ? modalE10.querySelector(".btn-retake")
    : null;

  let currentStream = null;
  let facingMode = "environment";
  let capturedPhotoId = null;
  let pendingPhotoId = null;

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

  async function openCamera() {
    try {
      await getLocalStream();
      resetCameraOverlays();
      await reportCameraPermission("granted");
    } catch (err) {
      console.error("카메라 접근 오류:", err);
      const permission =
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.name === "SecurityError"
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
        showSection(secCamera);
      } else {
        const code =
          data.error?.code || (permission === "denied" ? "E-06" : "E-07");
        showErrorSection(code);
      }
    } catch (err) {
      console.error("camera/open 요청 실패:", err);
      showErrorSection(permission === "denied" ? "E-06" : "E-07");
    }
  }

  // =====================================================
  // E-08 / E-09 오버레이 표시
  // =====================================================
  function setCameraGuideState(state) {
    if (!cameraGuideText || !cardE09) return;

    const defaultDescs = cameraGuideText.querySelectorAll(".default-desc");
    const e08Descs = cameraGuideText.querySelectorAll(".e08-desc");

    cameraGuideText.style.display = state === "dark" ? "none" : "";
    cardE09.style.display = state === "dark" ? "flex" : "none";

    defaultDescs.forEach((desc) => {
      desc.style.display = state === "aligning" ? "none" : "block";
    });

    e08Descs.forEach((desc) => {
      desc.style.display = state === "aligning" ? "block" : "none";
    });
  }

  function resetCameraOverlays() {
    setCameraGuideState("default");
    if (modalE10) modalE10.style.display = "none";
    pendingPhotoId = null;
  }

  function getShotMode() {
    const activeTab = document.querySelector(".camera-tabs .tab.active");
    const map = { front: "FRONT_45", side: "SIDE", detail: "DETAIL" };
    const selectedAngle = activeTab ? activeTab.dataset.angle : "front";
    return map[selectedAngle] || "FRONT_45";
  }

  // =====================================================
  // 촬영 -> 업로드 -> 품질 검사 결과 처리
  // =====================================================
  if (btnShutter) {
    btnShutter.addEventListener("click", () => {
      if (!video || !video.videoWidth) return;

      const MAX_DIMENSION = 1920;
      let targetWidth = video.videoWidth;
      let targetHeight = video.videoHeight;
      if (Math.max(targetWidth, targetHeight) > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(targetWidth, targetHeight);
        targetWidth = Math.round(targetWidth * scale);
        targetHeight = Math.round(targetHeight * scale);
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      canvas
        .getContext("2d")
        .drawImage(video, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (blob) uploadCapture(blob);
        },
        "image/jpeg",
        0.85
      );
    });
  }

  async function uploadCapture(blob) {
    const currentSelectionId = getSafeSelectionId();

    const formData = new FormData();
    formData.append("selection_id", currentSelectionId);
    formData.append("shot_mode", getShotMode());
    formData.append("image", blob, "capture.jpg");

    if (btnShutter) btnShutter.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/capture/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCsrfToken() },
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        capturedPhotoId = data.data?.id ?? data.data?.photo_id ?? null;
        const imageUrl = data.data?.image_url || data.data?.image;

        if (imageUrl) {
          localStorage.setItem("capturedPhotoUrl", imageUrl);
        }

        if (reviewImage && imageUrl) reviewImage.src = imageUrl;

        resetCameraOverlays();
        goTo(data.redirect_to);
      } else {
        handleCaptureFail(
          data.error?.code,
          data.photo_id ?? null,
          data.error?.message
        );
      }
    } catch (err) {
      console.error("사진 업로드 실패:", err);
      alert("사진 업로드 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      if (btnShutter) btnShutter.disabled = false;
    }
  }

  function handleCaptureFail(code, photoId, message) {
    if (code === "E-08") {
      setCameraGuideState("aligning");
    } else if (code === "E-09") {
      setCameraGuideState("dark");
    } else if (code === "E-10") {
      pendingPhotoId = photoId;
      if (modalE10) modalE10.style.display = "flex";
    } else {
      console.warn("처리되지 않은 캡처 에러 코드:", code);
      alert(message || "사진 저장에 실패했습니다. 다시 시도해주세요.");
    }
  }

  // =====================================================
  // 사진 확정(use) / 재촬영(retake)
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
        showErrorSection("E-11");
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
      e.preventDefault();
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
          body: JSON.stringify({ selection_id: getSafeSelectionId() }),
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
          alert("직원 호출이 요청되었습니다.");
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