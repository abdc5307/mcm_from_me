const enterButton = document.querySelector(".btn-enter");

enterButton?.addEventListener("click", async () => {
  if (enterButton.disabled) return;

  enterButton.disabled = true;
  enterButton.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(enterButton.dataset.sessionInitUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = await response.json();

    if (!response.ok || data.status !== "NEW_SESSION" || !data.sessionId) {
      throw new Error("Journey session creation failed");
    }

    localStorage.setItem("journeySessionId", data.sessionId);
    window.location.assign(enterButton.dataset.chapter1Url);
  } catch (error) {
    console.error(error);
    window.alert("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    enterButton.disabled = false;
    enterButton.removeAttribute("aria-busy");
  }
});
