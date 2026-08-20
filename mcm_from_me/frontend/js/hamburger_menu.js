const chapterItems = document.querySelectorAll(".chapter-item");
const chapterLinks = document.querySelectorAll(".chapter-link");
const homeLink = document.querySelector(".home-link");
const resumeButton = document.querySelector(".resume-button");
const advisorLink = document.querySelector(".advisor-link");

function navigateParent(url) {
  window.parent.location.assign(url);
}

function chapterUrl(chapterNumber, lastActiveScreen = "") {
  if (chapterNumber === 2 && lastActiveScreen === "C2-01") {
    return document.body.dataset.tagScanUrl;
  }

  return document.body.dataset[`chapter${chapterNumber}Url`];
}

function screenUrl(lastActiveScreen) {
  if (lastActiveScreen === "C2-01") return document.body.dataset.tagScanUrl;
  const chapterNumber = Number.parseInt(lastActiveScreen?.match(/^C(\d)/)?.[1], 10);
  return chapterUrl(chapterNumber, lastActiveScreen);
}

async function postJourneyAction(url, body) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRFToken": window.mcmCsrf.getToken(),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}

function getActiveJourneySessionId() {
  try {
    if (window.parent === window || window.parent.document.body.dataset.journeyActive !== "true") {
      return null;
    }

    return window.parent.localStorage.getItem("journeySessionId");
  } catch (error) {
    console.error("Journey session context could not be read", error);
    return null;
  }
}

function isParentJourneyActive() {
  try {
    return window.parent !== window && window.parent.document.body.dataset.journeyActive === "true";
  } catch (error) {
    console.error("Journey session context could not be read", error);
    return false;
  }
}

function getStoredJourneySessionId() {
  try {
    if (window.parent === window) return null;
    return window.parent.localStorage.getItem("journeySessionId");
  } catch (error) {
    console.error("Journey session context could not be read", error);
    return null;
  }
}

function updateChapterProgress(currentChapter) {
  const currentNumber = Number.parseInt(currentChapter?.replace("C", ""), 10);
  if (!Number.isInteger(currentNumber) || currentNumber < 1 || currentNumber > 5) return;

  chapterItems.forEach((item, index) => {
    const chapterNumber = index + 1;
    item.classList.remove(
      "chapter-item--complete",
      "chapter-item--current",
      "chapter-item--locked",
    );
    item.removeAttribute("aria-current");

    if (chapterNumber < currentNumber) {
      item.classList.add("chapter-item--complete");
    } else if (chapterNumber === currentNumber) {
      item.classList.add("chapter-item--current");
      item.setAttribute("aria-current", "step");
    } else {
      item.classList.add("chapter-item--locked");
    }
  });
}

async function syncChapterProgress() {
  const sessionId = getActiveJourneySessionId();
  if (!sessionId) return;

  try {
    const statusUrl = new URL(document.body.dataset.sessionStatusUrl, window.location.origin);
    statusUrl.searchParams.set("session_id", sessionId);
    const response = await fetch(statusUrl, {
      headers: { Accept: "application/json" },
    });
    const data = await response.json();

    if (response.ok && data.status === "RESUME_AVAILABLE") {
      updateChapterProgress(data.session?.current_chapter);
    }
  } catch (error) {
    console.error("Journey progress sync failed", error);
  }
}

syncChapterProgress();

homeLink?.addEventListener("click", () => {
  navigateParent(document.body.dataset.landingUrl);
});

chapterLinks.forEach((link) => {
  link.addEventListener("click", async () => {
    if (link.disabled) return;

    const sessionId = getActiveJourneySessionId();
    if (!sessionId) {
      navigateParent(document.body.dataset.errorE01Url);
      return;
    }

    const chapterNumber = Number.parseInt(link.dataset.chapter, 10);
    link.disabled = true;

    try {
      const { response, data } = await postJourneyAction(document.body.dataset.navigateUrl, {
        session_id: sessionId,
        target_chapter: `C${chapterNumber}`,
        navigation_only: true,
      });

      if (data.errorCode === "E-14") {
        navigateParent(document.body.dataset.errorE14Url);
        return;
      }
      if (!response.ok || data.status !== "SUCCESS") {
        navigateParent(document.body.dataset.errorE01Url);
        return;
      }

      navigateParent(chapterUrl(chapterNumber, data.lastActiveScreen));
    } catch (error) {
      console.error("Chapter navigation failed", error);
      navigateParent(document.body.dataset.errorE01Url);
    } finally {
      link.disabled = false;
    }
  });
});

resumeButton?.addEventListener("click", async () => {
  if (resumeButton.disabled) return;

  // 상황 1: 이미 특정 챕터 화면 위에 오버레이로 열린 경우 -> 메뉴만 닫고 현재 화면 유지
  if (isParentJourneyActive()) {
    try {
      window.parent.closeMenu?.();
    } catch (error) {
      console.error("Failed to close journey menu overlay", error);
    }
    return;
  }

  // 상황 2: 홈/외부 페이지에서 진입한 경우 -> 저장된 마지막 진행 지점으로 이동
  const sessionId = getStoredJourneySessionId();
  if (!sessionId) {
    navigateParent(document.body.dataset.chapter1Url);
    return;
  }

  resumeButton.disabled = true;
  try {
    const { response, data } = await postJourneyAction(document.body.dataset.resumeUrl, {
      session_id: sessionId,
    });
    const destination = screenUrl(data.lastActiveScreen);

    if (!response.ok || data.status !== "SUCCESS" || !destination) {
      navigateParent(document.body.dataset.errorE01Url);
      return;
    }
    navigateParent(destination);
  } catch (error) {
    console.error("Journey resume failed", error);
    navigateParent(document.body.dataset.errorE01Url);
  } finally {
    resumeButton.disabled = false;
  }
});

advisorLink?.addEventListener("click", () => {
  navigateParent(document.body.dataset.errorE01Url);
});
