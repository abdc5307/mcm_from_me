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
// [Processing] 로딩 화면 (API 응답 기반 안전 처리)
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  // discover-container가 없는 페이지(Still Deciding 등)에서는 자동 실행 안 함
  if (!document.querySelector(".discover-container")) return;

  const overlay =
    document.getElementById("processingOverlay") ||
    document.querySelector(".processing-overlay, .loading-screen");
  if (!overlay) return;

  // 무한 루프 방지: 이미 생성 완료 후 새로고침된 상태라면 오버레이 제거 후 종료
  if (sessionStorage.getItem("cardGenerated") === "true") {
    overlay.style.display = "none";
    sessionStorage.removeItem("cardGenerated");
    return;
  }

  const progressEl =
    document.getElementById("progressNumber") ||
    overlay.querySelector(".progress-num, .percent, h2, span");
  const selectionId =
    localStorage.getItem("journeySelectionId") ||
    localStorage.getItem("selectionId") ||
    document.body.dataset.selectionId ||
    "1";

  let percent = 0;

  // 15초 동안 99%까지 카운팅
  const interval = setInterval(() => {
    if (percent < 99) {
      percent += 1;
      if (progressEl) {
        progressEl.textContent = percent;
      }
    }
  }, 150);

  fetch(`${API_BASE_CH5}/chapter5/generate/`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ 
      selection_id: selectionId,
      card_count: 1 
    }),
  })
    .then((res) => {
      if (!res.ok) {
        console.warn("카드 생성 API 실패 응답:", res.status);
      }
      return res;
    })
    .catch((err) => {
      console.warn("AI 생성 API 호출 실패:", err);
    })
    .finally(() => {
      clearInterval(interval);
      if (progressEl) progressEl.textContent = "100";

      sessionStorage.setItem("cardGenerated", "true");

      // 100이 화면에 0.3초간 렌더링된 후 새로고침
      setTimeout(() => {
        window.location.reload();
      }, 300);
    });
});

// =====================================================
// [Discover] 카드 목록 로드 + CHOOSE / STILL DECIDING + E-11
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  const discoverContainer = document.querySelector(".discover-container");
  const swiperWrapper = document.getElementById("discoverSwiperWrapper");
  if (!discoverContainer || !swiperWrapper) return;

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
  let activeCardImageUrl = null;
  let swiperInstance = null;
  const cardImageMap = {};

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
    
      // 최근 생성된 카드가 맨 앞으로 오도록 정렬
      const sortedCards = [...cards].sort((a, b) => {
        if (a.created_at && b.created_at) {
          return new Date(b.created_at) - new Date(a.created_at); // 최신순 내림차순
        }
        return (b.id ?? 0) - (a.id ?? 0); // created_at 없으면 id로 대체
      });
    
      renderCards(sortedCards);
    } catch (err) {
      console.error("스토리 카드 조회 실패:", err);
    }
  }

  function renderCards(cards) {
    if (!cards || cards.length === 0) {
      swiperWrapper.innerHTML = "";
      return;
    }

    swiperWrapper.innerHTML = cards
      .map((card, index) => {
        // AI 템플릿 이미지를 최우선 적용, 없을 경우 정적 기본 이미지
        const imageUrl =
          card.card_image_url ||
          card.card_image ||
          card.image_url ||
          STATIC_FALLBACK_IMG;

        cardImageMap[card.id] = imageUrl;

        const titleText = card.title || `NEW HORIZON`;
        const descText = card.card_text || card.description || "";
        const captionText = "LATEST CHAPTER";

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
    activeCardImageUrl =
      activeCardId != null ? cardImageMap[activeCardId] : null;
    const dotsElement = document.querySelector(".discover-dots");

    // 카드가 1개일 경우 Swiper 제거 및 단일 카드 레이아웃 고정
    if (cards.length === 1) {
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
        pagination: { el: ".discover-dots", clickable: true },
        on: {
          slideChangeTransitionEnd(sw) {
            const activeSlide = sw.slides[sw.activeIndex];
            if (activeSlide?.dataset.cardId) {
              activeCardId = activeSlide.dataset.cardId;
              activeCardImageUrl =
                cardImageMap[activeCardId] ?? activeCardImageUrl;
            }
          },
        },
      });
    }
  }

  // CHOOSE THIS JOURNEY 클릭 시
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
          const chosenImageUrl =
            data.data?.card_image_url ||
            data.card_image_url ||
            data.image_url ||
            data.data?.image_url ||
            activeCardImageUrl;

          if (chosenImageUrl) {
            localStorage.setItem("aiCardImageUrl", chosenImageUrl);
          }

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
// [Still Deciding] 옵션 토글 & SUBMIT TO AI (버튼 텍스트 변경 방식)
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

  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const activeOption = document.querySelector(".still-option-btn.is-active");
    if (!activeOption) {
      alert("망설인 이유를 하나 선택해주세요.");
      return;
    }
    const reason = activeOption.dataset.option;

    // 1. Processing 오버레이 표시 + 진행률(0~99%) 카운팅 시작
    const processingWrapper = document.getElementById("stillProcessingWrapper");
    const progressEl = document.getElementById("progressNumber");

    if (!processingWrapper) console.warn("stillProcessingWrapper 요소를 찾을 수 없습니다.");
    if (!progressEl) console.warn("progressNumber 요소를 찾을 수 없습니다.");

    submitBtn.disabled = true;
    if (processingWrapper) processingWrapper.style.display = "block";

    // 오버레이가 뜨는 시점에 반드시 0으로 초기화
    if (progressEl) progressEl.textContent = "0";
    console.log("[chapter5.js] 진행률 초기화:", progressEl ? progressEl.textContent : "(요소 없음)");

    const COUNT_DURATION = 12000; // ms
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const computed = Math.min(99, Math.floor((elapsed / COUNT_DURATION) * 99));
      if (progressEl) progressEl.textContent = computed;
    }, 100);

    // 2. 백엔드 AI 분석 요청
    try {
      const hesitationRes = await fetch(
        `${API_BASE_CH5}/chapter5/hesitation/`,
        {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({ selection_id: selectionId, reason }),
        }
      );
      const hesitationData = await hesitationRes.json();
      const hesitationId = hesitationData.data?.id || hesitationData.id;
      console.log("[chapter5.js] hesitation 등록 완료, hesitationId:", hesitationId);

      // 진짜 AI 분석 결과가 준비될 때까지 대기
      const analysisRes = await fetch(
        `${API_BASE_CH5}/chapter5/analysis/${hesitationId}/`
      );

      if (!analysisRes.ok) {
        throw new Error(`AI 분석 응답 에러: ${analysisRes.status}`);
      }

      await analysisRes.json(); // 완료 여부 확인
      console.log("[chapter5.js] AI 분석 응답 도착");

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, COUNT_DURATION - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remaining));

      // 100%로 채운 뒤 0.3초 보여주고 결과 화면으로 이동
      clearInterval(interval);
      if (progressEl) progressEl.textContent = "100";

      setTimeout(() => {
        window.location.href = `${API_BASE_CH5}/view/chapter5/analysis/${hesitationId}/`;
      }, 300);

    } catch (err) {
      console.error("제출 실패 상세 로그:", err);
      clearInterval(interval);

      // 에러 발생 시 오버레이 숨기고 버튼 복구
      if (processingWrapper) processingWrapper.style.display = "none";
      submitBtn.disabled = false;

      alert("서버와 통신 중 문제가 발생했습니다. 다시 시도해주세요.");
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
  const aiCardImageUrl = localStorage.getItem("aiCardImageUrl");
  const localPhoto = localStorage.getItem("capturedPhotoUrl");

  function applyResultPhoto(photoUrl) {
    if (!photoUrl) return;
    const imgEl = document.getElementById("resultCardImg") || document.querySelector(".result-card-img");
    if (imgEl) imgEl.src = photoUrl;
    
    resultContainer.style.backgroundImage = `url('${photoUrl}')`;
    resultContainer.style.backgroundSize = "cover";
    resultContainer.style.backgroundPosition = "center";
    resultContainer.style.backgroundRepeat = "no-repeat";
  }

  // AI가 생성한 이미지를 최우선으로 적용
  // AI 이미지가 아직 없을 때만 임시로 웹캠 사진
  if (aiCardImageUrl) {
    applyResultPhoto(aiCardImageUrl);
  } else if (localPhoto) {
    applyResultPhoto(localPhoto);
  }

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

  const keywordItems = document.querySelectorAll(".result-choose-keywords .keyword-item");
  const summaryDisplayNames = {
    TOP_HANDLE: "Top Handle",
    CROSSBODY: "Crossbody",
    BASIC_CHARM: "Basic Charm",
    ROCKET_CHARM: "Rocket Charm",
  };

  // Chapter 3의 스토리지 데이터 강제 추출 및 렌더링
  try {
    const storedProduct = JSON.parse(sessionStorage.getItem("journeyProduct") || "{}");
    const storedStyle = JSON.parse(sessionStorage.getItem("journeyStyle") || "{}");
    
    const prodName = storedProduct.name || "ELLA BOSTON BAG";
    const carryMode = summaryDisplayNames[storedStyle.carry] || storedStyle.carry || "CROSSBODY";
    const detailMode = summaryDisplayNames[storedStyle.detail] || storedStyle.detail || "ROCKET CHARM";
    
    // 모먼트 이름을 가져옴
    const rawMomentName =
      storedProduct.moment ||
      storedProduct.moment_name ||
      storedProduct.theme ||
      sessionStorage.getItem("journeyMoment") ||
      localStorage.getItem("journeyMoment") ||
      sessionStorage.getItem("selectedMoment") ||
      localStorage.getItem("selectedMoment") ||
      sessionStorage.getItem("moment") ||
      localStorage.getItem("moment") ||
      "URBAN ESCAPE"; 
      
    const momentName = rawMomentName.replace(/_/g, " ");
  
    if (keywordItems.length >= 4) {
      setKeywordHtml(keywordItems[0], prodName.toUpperCase());
      setKeywordHtml(keywordItems[1], momentName.toUpperCase());
      setKeywordHtml(keywordItems[2], carryMode.toUpperCase());
      setKeywordHtml(keywordItems[3], detailMode.toUpperCase());
    }
  } catch (err) {
    console.warn("로컬 세션 데이터 파싱 실패:", err);
  }

  // 서버 API 이미지 연동)
  if (!selectionId) return;

  try {
    const res = await fetch(`/api/ai_story/chapter5/final/${selectionId}/`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json();

    if (json.status === "success" && json.data) {
      const serverPhotoUrl =
        json.data.image_url || aiCardImageUrl || localPhoto || STATIC_FALLBACK_IMG;
      applyResultPhoto(serverPhotoUrl);
    }
  } catch (err) {
    console.error("최종 결과 API 호출 실패:", err);
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

document.addEventListener("DOMContentLoaded", () => {
  const btnMenu = document.querySelector(".menu-button, .btn-menu, #btnMenuOpen");
  const menuLayer = document.querySelector(".hamburger-menu, .menu-overlay, .drawer-menu, #hamburgerMenu");
  const btnClose = document.querySelector(".menu-close-button, .btn-close-menu, #btnCloseMenu, .close-button");

  if (btnMenu && menuLayer) {
    btnMenu.addEventListener("click", (e) => {
      e.preventDefault();
      menuLayer.classList.add("is-active");
    });
  }

  if (btnClose && menuLayer) {
    btnClose.addEventListener("click", (e) => {
      e.preventDefault();
      menuLayer.classList.remove("is-active");
    });
  }
});