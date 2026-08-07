const momentCards = document.querySelectorAll(".moment-card");
const continueButton = document.getElementById("continueButton");

momentCards.forEach((card) => {
  card.addEventListener("click", () => {
    momentCards.forEach((item) => {
      item.classList.remove("selected");
      item.setAttribute("aria-pressed", "false");
    });

    card.classList.add("selected");
    card.setAttribute("aria-pressed", "true");
    continueButton.hidden = false;
  });
});
