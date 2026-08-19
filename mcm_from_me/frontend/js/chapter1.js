const momentCards = document.querySelectorAll(".moment-card");
const continueButton = document.getElementById("continueButton");
const momentValues = {
  "urban-escape": "URBAN_ESCAPE",
  "new-journey": "NEW_JOURNEY",
  "creative-flow": "CREATIVE_FLOW",
  "midnight-move": "MIDNIGHT_MOVE",
};
let selectedMoment = null;

momentCards.forEach((card) => {
  card.addEventListener("click", () => {
    momentCards.forEach((item) => {
      item.classList.remove("selected");
      item.setAttribute("aria-pressed", "false");
    });

    card.classList.add("selected");
    card.setAttribute("aria-pressed", "true");
    selectedMoment = momentValues[card.dataset.moment];
    continueButton.hidden = false;
  });
});

continueButton.addEventListener("click", async () => {
  if (!selectedMoment || continueButton.disabled) return;

  const sessionId = localStorage.getItem("journeySessionId");
  if (!sessionId) {
    window.alert("Journey session을 찾을 수 없습니다. Landing에서 다시 시작해 주세요.");
    return;
  }

  continueButton.disabled = true;
  continueButton.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(continueButton.dataset.saveUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        moment: selectedMoment,
      }),
    });
    const data = await response.json();

    if (!response.ok || data.status !== "SUCCESS" || data.nextScreen !== "C2-01") {
      throw new Error(data.message || "Moment save failed");
    }

    window.location.assign(continueButton.dataset.nextUrl);
  } catch (error) {
    console.error(error);
    window.alert("Moment를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    continueButton.disabled = false;
    continueButton.removeAttribute("aria-busy");
  }
});
