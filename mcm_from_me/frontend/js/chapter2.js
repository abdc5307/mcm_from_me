const productName = document.getElementById("productName");
const productImage = document.getElementById("productImage");
const productStoryTitle = document.getElementById("productStoryTitle");
const productStoryDescription = document.getElementById("productStoryDescription");
const wearPieceButton = document.getElementById("wearPieceButton");

try {
  const product = JSON.parse(sessionStorage.getItem("journeyProduct"));

  if (product?.name) productName.textContent = `${product.name}.`;
  if (product?.story_title) {
    const dot = productStoryTitle.querySelector(".gold-dot");
    productStoryTitle.replaceChildren(dot, document.createTextNode(product.story_title));
  }
  if (product?.story_desc) productStoryDescription.textContent = product.story_desc;
  if (product?.image_url) productImage.src = product.image_url;
} catch (error) {
  console.error("Stored product data is invalid", error);
}

productImage.addEventListener("error", () => {
  const fallbackSrc = productImage.dataset.fallbackSrc;
  if (fallbackSrc && productImage.src !== new URL(fallbackSrc, window.location.origin).href) {
    productImage.src = fallbackSrc;
  }
});

wearPieceButton.addEventListener("click", async () => {
  if (wearPieceButton.disabled) return;

  const sessionId = localStorage.getItem("journeySessionId");
  const product = sessionStorage.getItem("journeyProduct");
  if (!sessionId || !product) {
    window.location.assign(wearPieceButton.dataset.tagScanUrl);
    return;
  }

  wearPieceButton.disabled = true;
  wearPieceButton.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(wearPieceButton.dataset.navigateUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRFToken": window.mcmCsrf.getToken(),
      },
      body: JSON.stringify({
        session_id: sessionId,
        target_chapter: "C3",
      }),
    });
    const data = await response.json();

    if (!response.ok || data.status !== "SUCCESS" || data.currentChapter !== "C3") {
      if (data.errorCode === "E-04") {
        window.location.assign(wearPieceButton.dataset.tagScanUrl);
        return;
      }
      throw new Error(data.message || "Chapter 3 navigation failed");
    }

    window.location.assign(wearPieceButton.dataset.chapter3Url);
  } catch (error) {
    console.error(error);
    window.alert("Chapter 3를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    wearPieceButton.disabled = false;
    wearPieceButton.removeAttribute("aria-busy");
  }
});
