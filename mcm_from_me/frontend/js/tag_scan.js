const $ = (id) => document.getElementById(id);
const scanButton = $("scanButton");
const cameraScreen = $("cameraScreen");
const video = $("cameraVideo");
const canvas = $("cameraCanvas");
const preview = $("cameraPreview");
const thumbnail = $("cameraThumbnail");
const captureButton = $("captureButton");
const retakeButton = $("retakeButton");
const flashButton = $("flashButton");
const errorBox = $("cameraError");
const devTestTagButton = $("devTestTagButton");
const hamburgerButton = document.querySelector(".menu-button");
let stream = null;
let facingMode = "environment";
let torchOn = false;
let recognitionGeneration = 0;
let nfcAbortController = null;
let verifyingTag = false;

function setHamburgerButtonVisible(visible) {
  if (!hamburgerButton) return;
  hamburgerButton.hidden = !visible;
  hamburgerButton.style.display = visible ? "" : "none";
}

function stopTagRecognition() {
  recognitionGeneration += 1;
  nfcAbortController?.abort();
  nfcAbortController = null;
}

function normalizeTagCode(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    return String(parsed.tag_code || parsed.tagCode || text).trim();
  } catch {
    return text;
  }
}

async function verifyProductTag(tagCode) {
  const normalizedTagCode = normalizeTagCode(tagCode);
  if (!normalizedTagCode || verifyingTag) return;

  const sessionId = localStorage.getItem("journeySessionId");
  if (!sessionId) {
    window.location.assign(document.body.dataset.errorE04Url);
    return;
  }

  verifyingTag = true;
  stopTagRecognition();

  try {
    const response = await fetch(document.body.dataset.verifyUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        tag_code: normalizedTagCode,
      }),
    });
    const data = await response.json();

    if (response.ok && data.status === "SUCCESS" && data.nextScreen === "C2-07" && data.product) {
      sessionStorage.setItem("journeyProduct", JSON.stringify(data.product));
      stopCamera();
      window.location.assign(document.body.dataset.chapter2Url);
      return;
    }

    const errorUrl = {
      "E-02": document.body.dataset.errorE02Url,
      "E-03": document.body.dataset.errorE03Url,
      "E-04": document.body.dataset.errorE04Url,
    }[data.errorCode] || document.body.dataset.errorE04Url;
    window.location.assign(errorUrl);
  } catch (error) {
    console.error("Product verification failed", error);
    window.location.assign(document.body.dataset.errorE04Url);
  }
}

async function startQrRecognition(generation) {
  if ("BarcodeDetector" in window) {
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      if (formats.includes("qr_code")) {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });

        const detectFrame = async () => {
          if (generation !== recognitionGeneration || !stream || verifyingTag) return;
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
              const codes = await detector.detect(video);
              if (codes[0]?.rawValue) {
                await verifyProductTag(codes[0].rawValue);
                return;
              }
            } catch (error) {
              console.error("QR recognition failed", error);
            }
          }
          window.setTimeout(detectFrame, 180);
        };

        detectFrame();
        return true;
      }
    } catch (error) {
      console.error("Native QR detector initialization failed", error);
    }
  }

  if (typeof window.jsQR !== "function") return false;

  const qrCanvas = document.createElement("canvas");
  const qrContext = qrCanvas.getContext("2d", { willReadFrequently: true });
  if (!qrContext) return false;

  const detectFrame = async () => {
    if (generation !== recognitionGeneration || !stream || verifyingTag) return;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth) {
      try {
        const scanWidth = Math.min(video.videoWidth, 640);
        const scanHeight = Math.round(scanWidth * video.videoHeight / video.videoWidth);
        qrCanvas.width = scanWidth;
        qrCanvas.height = scanHeight;
        qrContext.drawImage(video, 0, 0, scanWidth, scanHeight);
        const frame = qrContext.getImageData(0, 0, scanWidth, scanHeight);
        const code = window.jsQR(frame.data, scanWidth, scanHeight, {
          inversionAttempts: "attemptBoth",
        });

        if (code?.data) {
          await verifyProductTag(code.data);
          return;
        }
      } catch (error) {
        console.error("QR fallback recognition failed", error);
      }
    }

    window.setTimeout(detectFrame, 180);
  };

  detectFrame();
  return true;
}

async function startNfcRecognition(generation) {
  if (!("NDEFReader" in window)) return false;

  try {
    const reader = new NDEFReader();
    nfcAbortController = new AbortController();
    await reader.scan({ signal: nfcAbortController.signal });
    reader.addEventListener("reading", async (event) => {
      if (generation !== recognitionGeneration || verifyingTag) return;
      for (const record of event.message.records) {
        if (!record.data) continue;
        const encoding = record.encoding || "utf-8";
        const tagCode = new TextDecoder(encoding).decode(record.data);
        if (normalizeTagCode(tagCode)) {
          await verifyProductTag(tagCode);
          return;
        }
      }
    });
    return true;
  } catch (error) {
    if (error.name !== "AbortError") console.error("NFC recognition failed", error);
    return false;
  }
}

async function startTagRecognition() {
  stopTagRecognition();
  verifyingTag = false;
  const generation = recognitionGeneration;
  const [qrAvailable, nfcAvailable] = await Promise.all([
    startQrRecognition(generation),
    startNfcRecognition(generation),
  ]);

  if (!qrAvailable && !nfcAvailable) {
    if (devTestTagButton) {
      devTestTagButton.hidden = false;
      showError("자동 인식을 지원하지 않는 개발 환경입니다. 아래 테스트 태그로 백엔드 연동을 확인할 수 있습니다.");
    } else {
      showError("이 브라우저에서는 NFC/QR 자동 인식을 지원하지 않습니다.");
    }
  }
}

async function startCamera() {
  stopCamera();
  errorBox.hidden = true;
  if (!navigator.mediaDevices?.getUserMedia) {
    showError("이 브라우저에서는 카메라 기능을 지원하지 않습니다.");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    const torchSupported = Boolean(stream.getVideoTracks()[0]?.getCapabilities?.().torch);
    flashButton.disabled = !torchSupported;
    flashButton.style.opacity = torchSupported ? "1" : ".35";
  } catch (error) {
    const denied = error.name === "NotAllowedError" || error.name === "SecurityError";
    showError(denied
      ? "카메라 권한이 차단되었습니다. 브라우저 설정에서 권한을 허용해 주세요."
      : "카메라를 실행할 수 없습니다. 다른 앱에서 사용 중인지 확인해 주세요.");
  }
}

function stopCamera() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  torchOn = false;
  flashButton.setAttribute("aria-pressed", "false");
}

function showError(message) {
  $("cameraErrorMessage").textContent = message;
  errorBox.hidden = false;
}

function resetPreview() {
  preview.classList.remove("visible");
  preview.removeAttribute("src");
  retakeButton.hidden = true;
  captureButton.disabled = false;
}

scanButton.addEventListener("click", async () => {
  setHamburgerButtonVisible(false);
  cameraScreen.classList.add("open");
  cameraScreen.setAttribute("aria-hidden", "false");
  document.body.classList.add("camera-open");
  await startCamera();
  if (stream) await startTagRecognition();
});

$("closeCameraButton").addEventListener("click", () => {
  stopCamera();
  stopTagRecognition();
  resetPreview();
  errorBox.hidden = true;
  cameraScreen.classList.remove("open");
  cameraScreen.setAttribute("aria-hidden", "true");
  document.body.classList.remove("camera-open");
  setHamburgerButtonVisible(true);
});

$("retryCameraButton").addEventListener("click", async () => {
  await startCamera();
  if (stream) await startTagRecognition();
});
devTestTagButton?.addEventListener("click", async () => {
  devTestTagButton.disabled = true;
  await verifyProductTag(devTestTagButton.dataset.tagCode);
});
$("switchCameraButton").addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  resetPreview();
  await startCamera();
  if (stream) await startTagRecognition();
});

flashButton.addEventListener("click", async () => {
  const track = stream?.getVideoTracks()[0];
  if (!track?.getCapabilities?.().torch) return;
  try {
    torchOn = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    flashButton.setAttribute("aria-pressed", String(torchOn));
  } catch { torchOn = false; }
});

captureButton.addEventListener("click", () => {
  if (!stream || !video.videoWidth) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (facingMode === "user") {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const image = canvas.toDataURL("image/jpeg", .9);
  preview.src = image;
  thumbnail.src = image;
  preview.classList.add("visible");
  thumbnail.style.display = "block";
  retakeButton.hidden = false;
  captureButton.disabled = true;
});

retakeButton.addEventListener("click", resetPreview);
document.querySelectorAll(".camera-step").forEach((step) => {
  step.addEventListener("click", () => {
    document.querySelectorAll(".camera-step").forEach((item) => item.classList.remove("active"));
    step.classList.add("active");
    $("cameraGuideText").textContent = step.dataset.guide;
  });
});

document.addEventListener("visibilitychange", () => {
  const open = cameraScreen.classList.contains("open");
  if (document.hidden && open) {
    stopCamera();
    stopTagRecognition();
  }
  if (!document.hidden && open && !stream) {
    startCamera().then(() => {
      if (stream) startTagRecognition();
    });
  }
});

// 개발 환경에서 실제 fixture의 태그 값으로 백엔드 연동을 확인할 때 사용합니다.
document.addEventListener("mcm:tag-code", (event) => verifyProductTag(event.detail));
