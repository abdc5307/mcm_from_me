const previewImage = document.getElementById("piecePreview");
const resultPreview = document.getElementById("resultPreview");
const storyDescription = document.getElementById("storyDescription");
const resultStoryText = document.getElementById("resultStoryText");
const chapter3Page = document.querySelector(".chapter3-page");
const chapter3Intro = document.getElementById("chapter3Intro");
const stylePreview = document.getElementById("stylePreview");
const configuration = document.getElementById("configuration");
const styleResult = document.getElementById("styleResult");
const nextStepButton = document.getElementById("nextStepButton");
const completeStyleButton = document.getElementById("completeStyleButton");
const styleError = document.getElementById("styleError");
const summaryError = document.getElementById("summaryError");
const configurationPieceName = document.getElementById("configurationPieceName");
const summaryPiece = document.getElementById("summaryPiece");
const summaryCarry = document.getElementById("summaryCarry");
const summaryDetail = document.getElementById("summaryDetail");
const summaryMoment = document.getElementById("summaryMoment");

const selectedStyle = { carry: null, detail: null };
const displayNames = {
  TOP_HANDLE: "탑 핸들",
  CROSSBODY: "크로스바디",
  BASIC_CHARM: "베이직 참",
  ROCKET_CHARM: "로켓 참",
};
const summaryDisplayNames = {
  TOP_HANDLE: "Top Handle",
  CROSSBODY: "Crossbody",
  BASIC_CHARM: "Basic Charm",
  ROCKET_CHARM: "Rocket Charm",
};
const fallbackNarration = {
  "TOP_HANDLE|BASIC_CHARM": "탑 핸들의 단정한 균형과 베이직 참의 절제된 디테일이 클래식한 실루엣을 완성합니다.",
  "TOP_HANDLE|ROCKET_CHARM": "탑 핸들의 클래식한 균형에 로켓 참의 경쾌한 에너지를 더했습니다.",
  "CROSSBODY|BASIC_CHARM": "크로스바디의 자유로운 움직임과 베이직 참의 담백한 디테일로 여정을 편안하게 이어갑니다.",
  "CROSSBODY|ROCKET_CHARM": "크로스바디의 자유로움에 로켓 참의 에너지를 더해 당신만의 새로운 여정을 완성합니다.",
};

let product = null;
let selectedMoment = null;
let currentNarration = storyDescription.textContent.trim();
let currentImageUrl = previewImage.src;
let optionRequestGeneration = 0;
let savingStyle = false;

function readStoredProduct() {
  try {
    return JSON.parse(sessionStorage.getItem("journeyProduct"));
  } catch (error) {
    console.error("Stored product data is invalid", error);
    return null;
  }
}

function formatMoment(value) {
  if (!value) return "-";
  return value.toLowerCase().split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function showError(target, message) {
  target.textContent = message;
  target.hidden = false;
}

function clearError(target) {
  target.hidden = true;
  target.textContent = "";
}

function setPreviewMode(carry) {
  const isCrossbody = carry === "CROSSBODY";
  previewImage.classList.toggle("piece-preview--crossbody", isCrossbody);
  previewImage.classList.toggle("piece-preview--top-handle", !isCrossbody);
  resultPreview.classList.toggle("result-image--crossbody", isCrossbody);
  resultPreview.classList.toggle("result-image--top-handle", !isCrossbody);
}

function setProductImage(url, carry = selectedStyle.carry) {
  if (!url) return;
  currentImageUrl = url;
  setPreviewMode(carry);
  previewImage.src = url;
}

function localImageForCarry(carry) {
  return carry === "CROSSBODY"
    ? document.body.dataset.crossbodyImage
    : document.body.dataset.topHandleImage;
}

function handleImageError(event) {
  const image = event.currentTarget;
  const fallback = image.dataset.fallbackSrc || document.body.dataset.topHandleImage;
  if (image.src !== new URL(fallback, window.location.origin).href) image.src = fallback;
}

previewImage.addEventListener("error", handleImageError);
resultPreview.addEventListener("error", handleImageError);

function updateNextStepState() {
  nextStepButton.disabled = !(selectedStyle.carry && selectedStyle.detail) || savingStyle;
}

function updateOptionDom(groupName, value) {
  const group = document.querySelector(`[data-option-group="${groupName}"]`);
  group.querySelectorAll(".style-option").forEach((option) => {
    const selected = option.dataset.value === value;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-pressed", String(selected));
  });
}

async function updateCombinationPreview() {
  if (selectedStyle.carry) setProductImage(localImageForCarry(selectedStyle.carry));
  if (!selectedStyle.carry || !selectedStyle.detail) {
    storyDescription.textContent = selectedStyle.carry
      ? `${displayNames[selectedStyle.carry]} 스타일에 어울리는 디테일을 선택해 주세요.`
      : currentNarration;
    return;
  }

  const combinationKey = `${selectedStyle.carry}|${selectedStyle.detail}`;
  const fallbackCopy = fallbackNarration[combinationKey];
  currentNarration = fallbackCopy;
  storyDescription.textContent = fallbackCopy;
  const generation = ++optionRequestGeneration;

  const carryOption = document.querySelector(`[data-option-group="carry"] [data-value="${selectedStyle.carry}"]`);
  const detailOption = document.querySelector(`[data-option-group="detail"] [data-value="${selectedStyle.detail}"]`);

  try {
    const response = await fetch(document.body.dataset.styleSelectUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRFToken": window.mcmCsrf.getToken(),
      },
      body: JSON.stringify({
        carry: carryOption.dataset.aiValue,
        detail: detailOption.dataset.aiValue,
      }),
    });
    const data = await response.json();
    if (generation !== optionRequestGeneration) return;

    if (!response.ok || data.status !== "success" || !data.data) return;
    if (data.data.image_url) setProductImage(data.data.image_url);
    if (data.data.ai_narration) {
      currentNarration = data.data.ai_narration;
      storyDescription.textContent = currentNarration;
    }
  } catch (error) {
    console.error("Style combination preview failed", error);
  }
}

document.querySelectorAll(".option-group").forEach((group) => {
  const groupName = group.dataset.optionGroup;
  group.querySelectorAll(".style-option").forEach((option) => {
    option.addEventListener("click", async () => {
      selectedStyle[groupName] = option.dataset.value;
      updateOptionDom(groupName, selectedStyle[groupName]);
      clearError(styleError);
      updateNextStepState();
      await updateCombinationPreview();
    });
  });
});

function fillSummary() {
  summaryPiece.textContent = product?.name || "MCM Piece";
  summaryCarry.textContent = summaryDisplayNames[selectedStyle.carry] || "-";
  summaryDetail.textContent = summaryDisplayNames[selectedStyle.detail] || "-";
  summaryMoment.textContent = formatMoment(selectedMoment);
  resultStoryText.textContent = currentNarration || fallbackNarration[`${selectedStyle.carry}|${selectedStyle.detail}`];
  resultPreview.src = currentImageUrl;
  setPreviewMode(selectedStyle.carry);
}

function showSummary() {
  fillSummary();
  chapter3Intro.hidden = true;
  stylePreview.hidden = true;
  configuration.hidden = true;
  styleResult.hidden = false;
  chapter3Page.classList.add("result-view");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveStyle(action) {
  const sessionId = localStorage.getItem("journeySessionId");
  if (!sessionId || !selectedStyle.carry || !selectedStyle.detail) return null;

  const response = await fetch(document.body.dataset.styleSaveUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRFToken": window.mcmCsrf.getToken(),
    },
    body: JSON.stringify({
      session_id: sessionId,
      carry_option: selectedStyle.carry,
      detail_option: selectedStyle.detail,
      action,
    }),
  });
  const data = await response.json();
  if (!response.ok || data.status !== "SUCCESS") {
    const error = new Error(data.message || "Style save failed");
    error.code = data.errorCode;
    throw error;
  }
  return data;
}

nextStepButton.addEventListener("click", async () => {
  if (savingStyle || !selectedStyle.carry || !selectedStyle.detail) return;
  savingStyle = true;
  updateNextStepState();
  clearError(styleError);

  try {
    const data = await saveStyle("SUMMARY");
    if (data.nextScreen !== "C3-SUMMARY") throw new Error("Unexpected summary state");
    sessionStorage.setItem("journeyStyle", JSON.stringify({
      ...selectedStyle,
      image_url: currentImageUrl,
      narration: currentNarration,
    }));
    showSummary();
  } catch (error) {
    console.error(error);
    showError(styleError, error.code === "E-05"
      ? "This option is not available for your piece. Choose another option."
      : "Your style could not be saved. Please try again.");
  } finally {
    savingStyle = false;
    updateNextStepState();
  }
});

completeStyleButton.addEventListener("click", async () => {
  if (savingStyle) return;
  savingStyle = true;
  completeStyleButton.disabled = true;
  clearError(summaryError);

  try {
    const data = await saveStyle("COMPLETE");
    if (data.nextScreen !== "C4-01") throw new Error("Unexpected next chapter");
    window.location.assign(document.body.dataset.chapter4Url);
  } catch (error) {
    console.error(error);
    showError(summaryError, error.code === "E-05"
      ? "This option is not available for your piece."
      : "Your completed style could not be confirmed. Please try again.");
    savingStyle = false;
    completeStyleButton.disabled = false;
  }
});

async function initializeChapter3() {
  const sessionId = localStorage.getItem("journeySessionId");
  if (!sessionId) {
    window.location.assign(document.body.dataset.tagScanUrl);
    return;
  }

  try {
    const statusUrl = new URL(document.body.dataset.sessionStatusUrl, window.location.origin);
    statusUrl.searchParams.set("session_id", sessionId);
    const response = await fetch(statusUrl, { headers: { Accept: "application/json" } });
    const data = await response.json();
    const session = data.session;

    if (!response.ok || data.status !== "RESUME_AVAILABLE" || !session?.product_name) {
      window.location.assign(document.body.dataset.tagScanUrl);
      return;
    }

    product = readStoredProduct() || {
      id: session.product_id,
      name: session.product_name,
      image_url: document.body.dataset.topHandleImage,
    };
    selectedMoment = session.selected_moment;
    configurationPieceName.textContent = product.name;
    summaryPiece.textContent = product.name;
    if (product.image_url) setProductImage(product.image_url);

    if (session.carry_option && session.detail_option) {
      selectedStyle.carry = session.carry_option;
      selectedStyle.detail = session.detail_option;
      updateOptionDom("carry", selectedStyle.carry);
      updateOptionDom("detail", selectedStyle.detail);

      try {
        const storedStyle = JSON.parse(sessionStorage.getItem("journeyStyle"));
        if (storedStyle?.image_url) currentImageUrl = storedStyle.image_url;
        if (storedStyle?.narration) currentNarration = storedStyle.narration;
      } catch (error) {
        console.error("Stored style data is invalid", error);
      }

      await updateCombinationPreview();
      if (session.last_active_screen === "C3-SUMMARY") showSummary();
    }

    updateNextStepState();
  } catch (error) {
    console.error("Chapter 3 initialization failed", error);
    showError(styleError, "Journey information could not be loaded. Please try again.");
  }
}

initializeChapter3();
