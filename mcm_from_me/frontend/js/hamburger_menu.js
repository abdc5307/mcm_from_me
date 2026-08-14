const chapterItems = document.querySelectorAll(".chapter-item");

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
