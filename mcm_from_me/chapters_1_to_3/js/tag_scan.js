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
let stream = null;
let facingMode = "environment";
let torchOn = false;

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
  cameraScreen.classList.add("open");
  cameraScreen.setAttribute("aria-hidden", "false");
  document.body.classList.add("camera-open");
  await startCamera();
});

$("closeCameraButton").addEventListener("click", () => {
  stopCamera();
  resetPreview();
  errorBox.hidden = true;
  cameraScreen.classList.remove("open");
  cameraScreen.setAttribute("aria-hidden", "true");
  document.body.classList.remove("camera-open");
});

$("retryCameraButton").addEventListener("click", startCamera);
$("switchCameraButton").addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  resetPreview();
  await startCamera();
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
  if (document.hidden && open) stopCamera();
  if (!document.hidden && open && !stream) startCamera();
});
