const previewImage = document.getElementById("piecePreview");
const storyHeading = document.getElementById("storyHeading");
const storyDescription = document.getElementById("storyDescription");
const chapter3Page = document.querySelector(".chapter3-page");
const chapter3Intro = document.getElementById("chapter3Intro");
const stylePreview = document.getElementById("stylePreview");
const configuration = document.getElementById("configuration");
const styleResult = document.getElementById("styleResult");
const resultPreview = document.getElementById("resultPreview");

const selectedStyle = {
  carry: "crossbody",
  detail: "rocket-charm",
};

const storyCopy = {
  "top-handle|basic-charm": "탑 핸들의 단정한 균형과<br>베이직 참의 절제된 디테일이<br>클래식한 실루엣을 가장 선명하게 보여줍니다.",
  "top-handle|rocket-charm": "탑 핸들의 클래식한 균형에<br>로켓 참의 경쾌한 에너지를 더해<br>새로운 출발을 위한 장면을 완성했습니다.",
  "crossbody|basic-charm": "크로스바디의 자유로운 움직임과<br>베이직 참의 담백한 디테일로<br>매일의 여정을 편안하게 이어갑니다.",
  "crossbody|rocket-charm": "크로스바디의 자유로움에<br>로켓 참의 에너지를 더했습니다.<br>당신만의 방식으로 새로운 여정을 시작해 보세요.",
};

function updatePreview() {
  const isCrossbody = selectedStyle.carry === "crossbody";
  previewImage.src = isCrossbody
    ? "../images/Ella_Boston_bag_cross.png"
    : "../images/Small_Ella_Boston_Bag.jpg";
  previewImage.classList.toggle("piece-preview--crossbody", isCrossbody);
  previewImage.classList.toggle("piece-preview--top-handle", !isCrossbody);
  previewImage.alt = `${isCrossbody ? "Crossbody" : "Top handle"} 스타일의 Ella Boston Bag`;
  storyHeading.textContent = "Your story begins with a classic.";
  storyDescription.innerHTML = storyCopy[`${selectedStyle.carry}|${selectedStyle.detail}`];
}

document.querySelectorAll(".option-group").forEach((group) => {
  const groupName = group.dataset.optionGroup;
  const options = group.querySelectorAll(".style-option");

  options.forEach((option) => {
    option.addEventListener("click", () => {
      options.forEach((item) => {
        item.classList.remove("selected");
        item.setAttribute("aria-pressed", "false");
      });

      option.classList.add("selected");
      option.setAttribute("aria-pressed", "true");
      selectedStyle[groupName] = option.dataset.value;
      updatePreview();
    });
  });
});

document.getElementById("nextStepButton").addEventListener("click", () => {
  const isCrossbody = selectedStyle.carry === "crossbody";
  resultPreview.src = isCrossbody
    ? "../images/Ella_Boston_bag_cross.png"
    : "../images/Small_Ella_Boston_Bag.jpg";
  resultPreview.classList.toggle("result-image--crossbody", isCrossbody);
  resultPreview.classList.toggle("result-image--top-handle", !isCrossbody);
  resultPreview.alt = `${isCrossbody ? "Crossbody" : "Top handle"} 스타일로 완성된 Ella Boston Bag`;

  document.getElementById("summaryCarry").textContent = isCrossbody
    ? "Crossbody"
    : "Top Handle";
  document.getElementById("summaryDetail").textContent =
    selectedStyle.detail === "rocket-charm" ? "ROCKET CHARM" : "BASIC CHARM";

  const carryText = isCrossbody ? "크로스바디의 자유로움" : "탑 핸들의 단정한 균형";
  const detailText = selectedStyle.detail === "rocket-charm"
    ? "로켓 참의 에너지를"
    : "베이직 참의 절제된 디테일을";
  document.getElementById("resultStoryText").innerHTML =
    `당신은 클래식한 구조에 ${carryText}과<br>` +
    `${detailText} 더했습니다.<br>` +
    "익숙한 형태를 자신만의 방식으로 변화시킨<br>" +
    "이 스타일은 새로운 여정을 향해 나아가는 당신을<br>" +
    "닮았습니다.";

  chapter3Intro.hidden = true;
  stylePreview.hidden = true;
  configuration.hidden = true;
  styleResult.hidden = false;
  chapter3Page.classList.add("result-view");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
