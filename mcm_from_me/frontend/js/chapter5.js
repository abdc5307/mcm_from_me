// =====================================================
// 공통 유틸
// =====================================================
const API_BASE_CH5 = "/api/ai_story";
const STATIC_FALLBACK_IMG = "/static/images/story_card_img.png";

function getCsrfToken() {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    "X-CSRFToken": getCsrfToken(),
  };
}

// =====================================================
// [Processing] 로딩 화면 (0% 멈춤 방지 및 안전 타이머)
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  const overlay =
    document.getElementById("processingOverlay") ||
    document.querySelector(".processing-overlay, .loading-screen");
  if (!overlay) return;

  const progressEl =
    document.getElementById("progressNumber") ||
    overlay.querySelector(".progress-num, .percent, h2, span");
  const selectionId =
    localStorage.getItem("journeySelectionId") ||
    localStorage.getItem("selectionId") ||
    document.body.dataset.selectionId ||
    "1";

  let percent = 0;

  const interval = setInterval(() => {
    if (percent < 100) {
      percent += Math.floor(Math.random() * 8) + 5;
      if (percent > 100) percent = 100;
      if (progressEl) {
        progressEl.textContent = percent;
      }
    } else {
      clearInterval(interval);
      overlay.style.transition = "opacity 0.4s ease";
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.style.display = "none";
      }, 400);
    }
  }, 80);

  fetch(`${API_BASE_CH5}/chapter5/generate/`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ selection_id: selectionId }),
  })
    .catch((err) => {
      console.warn("AI 생성 API 호출 실패 (무시하고 화면 표시):", err);
    })
    .finally(() => {
      setTimeout(() => {
        clearInterval(interval);
        if (progressEl) progressEl.textContent = "100%";
        overlay.style.opacity = "0";
        setTimeout(() => {
          overlay.style.display = "none";
        }, 300);
      }, 1500);
    });
});

// =====================================================
// [Discover] 카드 목록 로드 + CHOOSE / STILL DECIDING + E-11 연동
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  const discoverContainer = document.querySelector(".discover-container");
  const swiperWrapper = document.getElementById("discoverSwiperWrapper");
  if (!discoverContainer || !swiperWrapper) return; // discover 페이지가 아니면 종료

  const urlParts = window.location.pathname.split("/").filter(Boolean);
  const idFromUrl = urlParts[urlParts.length - 1];

  const selectionId =
    !isNaN(idFromUrl) && idFromUrl
      ? idFromUrl
      : localStorage.getItem("journeySelectionId") ||
        localStorage.getItem("selectionId") ||
        document.body.dataset.selectionId;
  const btnChoose = document.getElementById("btnChooseJourney");
  const btnStill = document.getElementById("btnStillDeciding");

  let activeCardId = null;
  let swiperInstance = null;

  // E-11 에러 화면 표시 함수
  function showSaveError() {
    const secSaveError = document.getElementById("sectionSaveError");
    if (!secSaveError) {
      alert("카드 저장에 실패했습니다. (E-11)");
      return;
    }

    secSaveError.style.display = "flex";
    secSaveError.style.position = "fixed";
    secSaveError.style.top = "0";
    secSaveError.style.left = "0";
    secSaveError.style.width = "100vw";
    secSaveError.style.height = "100vh";
    secSaveError.style.zIndex = "99999";

    // e11_journey_save_Failed.html 내부의 RETRY 버튼 연결
    const btnRetry = secSaveError.querySelector("#btnRetry, .btn-retry, .retry-btn, button");
    if (btnRetry) {
      btnRetry.onclick = (e) => {
        e.preventDefault();
        secSaveError.style.display = "none";
      };
    }
  }

  async function loadCards() {
    try {
      const res = await fetch(`${API_BASE_CH5}/chapter5/cards/${selectionId}/`);
      const data = await res.json();
      console.log("chapter5/cards 응답 원본:", data);

      const cards = data.cards || data.data || data.results || [];
      if (cards.length === 0) {
        console.warn("카드 목록이 비어있습니다. selection_id:", selectionId);
      }
      renderCards(cards);
    } catch (err) {
      console.error("스토리 카드 조회 실패:", err);
    }
  }

  function renderCards(cards) {
    if (!cards || cards.length === 0) {
      swiperWrapper.innerHTML = "";
      return;
    }

    const localCapturedPhoto = localStorage.getItem("capturedPhotoUrl");

    swiperWrapper.innerHTML = cards
      .map((card, index) => {
        const imageUrl =
          card.image_url ||
          card.image ||
          card.card_image ||
          localCapturedPhoto ||
          STATIC_FALLBACK_IMG;

        const titleText = card.title || `My MCM Story Card #${index + 1}`;
        const descText = card.card_text || card.description || "";
        const captionText = card.caption || "LATEST CHAPTER";

        return `
            <div class="swiper-slide discover-card" data-card-id="${card.id}">
                <div class="discover-card-media">
                    <img
                        src="${imageUrl}"
                        alt="${titleText}"
                        class="discover-card-img"
                        onerror="this.onerror=null; this.src='${STATIC_FALLBACK_IMG}';"
                    />
                    <div class="discover-card-overlay"></div>
                </div>
                <div class="discover-card-body">
                    <span class="discover-card-caption">${captionText}</span>
                    <h3 class="discover-card-title">${titleText}</h3>
                    <p class="discover-card-desc">${descText}</p>
                </div>
            </div>`;
      })
      .join("");

    activeCardId = cards[0]?.id ?? null;
    const dotsElement = document.querySelector(".discover-dots");

    if (cards.length <= 1) {
      discoverContainer.classList.add("is-single");
      if (dotsElement) dotsElement.style.display = "none";

      if (swiperInstance) {
        swiperInstance.destroy(true, true);
        swiperInstance = null;
      }
    } else {
      discoverContainer.classList.remove("is-single");
      if (dotsElement) dotsElement.style.display = "block";

      if (swiperInstance) swiperInstance.destroy(true, true);
      swiperInstance = new Swiper(".discover-swiper", {
        slidesPerView: "auto",
        centeredSlides: true,
        spaceBetween: 16,
        loop: false,
        watchOverflow: true,
        observer: true,
        observeParents: true,
        pagination: {
          el: ".discover-dots",
          clickable: true,
        },
        on: {
          slideChangeTransitionEnd(sw) {
            const activeSlide = sw.slides[sw.activeIndex];
            if (activeSlide?.dataset.cardId) {
              activeCardId = activeSlide.dataset.cardId;
            }
          },
        },
      });
    }
  }

  // CHOOSE THIS JOURNEY 클릭 시 처리
  if (btnChoose) {
    btnChoose.addEventListener("click", async () => {
      if (!activeCardId) {
        showSaveError();
        return;
      }

      btnChoose.disabled = true;

      try {
        const res = await fetch(
          `${API_BASE_CH5}/chapter5/card/${activeCardId}/select/`,
          {
            method: "POST",
            headers: jsonHeaders(),
            body: JSON.stringify({ action: "choose" }),
          },
        );

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.status !== "error") {
          window.location.href = `${API_BASE_CH5}/view/chapter5/result/${selectionId}/`;
        } else {
          console.warn("카드 선택 실패 응답:", data);
          showSaveError();
        }
      } catch (err) {
        console.error("카드 선택 통신 에러:", err);
        showSaveError();
      } finally {
        btnChoose.disabled = false;
      }
    });
  }

  if (btnStill) {
    btnStill.addEventListener("click", () => {
      window.location.href = `${API_BASE_CH5}/view/chapter5/hesitation/${selectionId}/`;
    });
  }

  loadCards();
});

// =====================================================
// [Still Deciding] 옵션 토글 & SUBMIT TO AI
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  const optionBtns = document.querySelectorAll(".still-option-btn");
  optionBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      optionBtns.forEach((b) => {
        if (b !== btn) b.classList.remove("is-active");
      });
      btn.classList.toggle("is-active");
    });
  });

  const submitBtn = document.getElementById("submitBtn");
  if (!submitBtn) return;

  const urlParts = window.location.pathname.split("/").filter(Boolean);
  const idFromUrl = urlParts[urlParts.length - 1];
  const selectionId =
    !isNaN(idFromUrl) && idFromUrl
      ? idFromUrl
      : localStorage.getItem("selectionId") ||
        localStorage.getItem("journeySelectionId") ||
        document.body.dataset.selectionId;

  submitBtn.addEventListener("click", async () => {
    const activeOption = document.querySelector(".still-option-btn.is-active");
    if (!activeOption) {
      alert("망설인 이유를 하나 선택해주세요.");
      return;
    }
    const reason = activeOption.dataset.option;

    submitBtn.disabled = true;
    try {
      const hesitationRes = await fetch(
        `${API_BASE_CH5}/chapter5/hesitation/`,
        {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({ selection_id: selectionId, reason }),
        },
      );
      const hesitationData = await hesitationRes.json();
      if (!hesitationRes.ok) throw new Error("hesitation 저장 실패");

      const hesitationId = hesitationData.data?.id || hesitationData.id;
      window.location.href = `${API_BASE_CH5}/view/chapter5/analysis/${hesitationId}/`;
    } catch (err) {
      console.error("제출 실패:", err);
      alert("처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      submitBtn.disabled = false;
    }
  });
});

// =====================================================
// [Result / Still Result 공통] COMPLETE MY JOURNEY, 하단 탭
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  const btnComplete = document.getElementById("btnCompleteJourney");
  const btnConnectAdviser = document.getElementById("btnConnectAdviser");
  const btnShare = document.getElementById("btnShare");
  const btnViewDetails = document.getElementById("btnViewDetails");

  if (!btnComplete && !btnConnectAdviser && !btnShare && !btnViewDetails) return;

  const ds = document.body.dataset;

  if (btnComplete) {
    btnComplete.addEventListener("click", async () => {
      try {
        await fetch(`${API_BASE_CH5}/chapter5/complete/${ds.selectionId}/`, {
          method: "POST",
          headers: jsonHeaders(),
        });
      } catch (err) {
        console.error("journey complete 요청 실패:", err);
      } finally {
        window.location.href = "/final/";
      }
    });
  }

  if (btnConnectAdviser) {
    btnConnectAdviser.addEventListener("click", () => {
      alert("상담원 연결이 요청되었습니다. 잠시만 기다려주세요.");
    });
  }

  if (btnShare) {
    btnShare.addEventListener("click", async () => {
      const shareData = {
        title: "MCM FROM ME",
        text: "나만의 MCM 스토리 카드를 확인해보세요!",
        url: window.location.href,
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          console.log("공유 취소/실패", err);
        }
      } else {
        try {
          await navigator.clipboard.writeText(window.location.href);
          alert("링크가 클립보드에 복사되었습니다.");
        } catch (err) {
          alert("해당 브라우저에서는 공유 기능을 지원하지 않습니다.");
        }
      }
    });
  }

  if (btnViewDetails) {
    btnViewDetails.addEventListener("click", () => {
      window.location.href = "/preparing/";
    });
  }
});

// =====================================================
// [Result] 최종 화면 실제 사진, 배경화면 및 4개 키워드 동적 렌더링
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  const resultContainer = document.querySelector(".result-choose-container");
  if (!resultContainer) return;

  const selectionId = document.body.dataset.selectionId;
  const localPhoto = localStorage.getItem("capturedPhotoUrl");

  function applyResultPhoto(photoUrl) {
    if (!photoUrl) return;

    const imgEl =
      document.getElementById("resultCardImg") ||
      document.querySelector(".result-card-img");
    if (imgEl) {
      imgEl.src = photoUrl;
    }

    resultContainer.style.backgroundImage = `url('${photoUrl}')`;
    resultContainer.style.backgroundSize = "cover";
    resultContainer.style.backgroundPosition = "center";
    resultContainer.style.backgroundRepeat = "no-repeat";
  }

  if (localPhoto) {
    applyResultPhoto(localPhoto);
  }

  if (!selectionId) return;

  try {
    const res = await fetch(`/api/ai_story/chapter5/final/${selectionId}/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const json = await res.json();

    if (json.status === "success" && json.data) {
      const data = json.data;

      const serverPhotoUrl = data.image_url || localPhoto || STATIC_FALLBACK_IMG;
      applyResultPhoto(serverPhotoUrl);

      function setKeywordHtml(element, text) {
        if (!element || !text) return;
        const words = String(text).trim().split(" ");
        if (words.length >= 2) {
          const lastWord = words.pop();
          const firstPart = words.join(" ");
          element.innerHTML = `<span>${firstPart}</span><span>${lastWord}</span>`;
        } else {
          element.innerHTML = `<span>${text}</span>`;
        }
      }

      const info = data.selection_info || data.keywords || data;
      const keywordItems = document.querySelectorAll(
        ".result-choose-keywords .keyword-item"
      );

      if (keywordItems.length >= 4) {
        const prodName = info.product_name || info.product || "ELLA BOSTON BAG";
        setKeywordHtml(keywordItems[0], prodName);

        const momentName =
          info.moment_name || info.journey_mood || info.moment || "NEW JOURNEY";
        setKeywordHtml(keywordItems[1], momentName);

        const styleName =
          info.styling_type || info.carry_mode || info.style || "CROSSBODY";
        setKeywordHtml(keywordItems[2], styleName);

        const charmName =
          info.charm_name || info.accessory || info.charm || "ROCKET CHARM";
        setKeywordHtml(keywordItems[3], charmName);
      }

      console.log("최종 키워드 및 배경 렌더링 완료:", info);
    }
  } catch (err) {
    console.error("최종 결과 데이터를 불러오는데 실패했습니다:", err);
  }
});

// =====================================================
// [Still Result] AI 분석 및 추천 제품 동적 렌더링
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  const stillResultContainer = document.querySelector(".still-result-container");
  if (!stillResultContainer) return;

  const urlParts = window.location.pathname.split("/").filter(Boolean);
  const idFromUrl = urlParts[urlParts.length - 1];
  const hesitationId =
    !isNaN(idFromUrl) && idFromUrl
      ? idFromUrl
      : document.body.dataset.hesitationId;

  if (!hesitationId) return;

  try {
    const res = await fetch(
      `${API_BASE_CH5}/chapter5/analysis/${hesitationId}/`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    const json = await res.json();

    if (json.status === "success" && json.data) {
      const data = json.data;

      const analysisDescEl = document.getElementById("aiAnalysisDesc");
      if (analysisDescEl && data.analysis_text) {
        analysisDescEl.textContent = data.analysis_text;
      }

      const product = data.recommended_product;
      if (product) {
        const titleEl = document.getElementById("recommendProductTitle");
        if (titleEl && product.name) {
          titleEl.innerHTML = product.name.replace(" ", "<br>");
        }

        const imgEl = document.getElementById("recommendProductImg");
        if (imgEl && product.image_url) {
          imgEl.src = product.image_url;
        }
      }

      const tagsContainer = document.getElementById("recommendProductTags");
      if (
        tagsContainer &&
        Array.isArray(data.reason_tags) &&
        data.reason_tags.length > 0
      ) {
        tagsContainer.innerHTML = data.reason_tags
          .map((tag) => `<span class="product-tag">${tag}</span>`)
          .join("");
      }
    }
  } catch (err) {
    console.error("AI 추천 결과 데이터 로드 실패:", err);
  }
});