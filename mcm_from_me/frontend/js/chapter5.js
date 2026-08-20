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
// [Processing] 로딩 화면 (15초 대기 후 안전하게 1회 새로고침)
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  const overlay =
    document.getElementById("processingOverlay") ||
    document.querySelector(".processing-overlay, .loading-screen");
  if (!overlay) return;

  // ★ 무한 루프 방지 핵심 안전장치 ★
  // 이미 카드를 생성하고 새로고침되어 돌아온 상태라면, API를 또 부르지 않고 로딩창만 즉시 없앱니다.
  if (sessionStorage.getItem("cardGenerated") === "true") {
    overlay.style.display = "none";
    sessionStorage.removeItem("cardGenerated"); // 다음번 테스트를 위해 메모 초기화
    return; // 여기서 실행을 완전히 멈춤!
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

  // 15초 동안 99%까지 올라가도록 조절
  const interval = setInterval(() => {
    if (percent < 99) {
      percent += 1;
      if (progressEl) {
        progressEl.textContent = percent;
      }
    }
  }, 150);

  // API 호출 - 응답이 오면(성공/실패 모두) 곧바로 처리, 불필요한 고정 대기 없음
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

      // 브라우저에게 "나 방금 카드 만들었어!" 라고 메모 남기기
      sessionStorage.setItem("cardGenerated", "true");

      // 응답 도착 즉시 새로고침 (Gemini 응답 시간 그대로가 곧 사용자 대기 시간)
      window.location.reload();
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
  let activeCardImageUrl = null; // 현재 활성 카드의 AI 생성 이미지 URL
  let swiperInstance = null;
  const cardImageMap = {}; // 카드 ID -> AI 이미지 URL 매핑

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
    
      // 최근 생성된 카드가 맨 앞(3, 2, 1 순서)으로 오도록 정렬
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

        // 카드 ID -> AI 이미지 URL 매핑 저장 (CHOOSE 시 activeCardImageUrl로 사용)
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

  const defaultBtnText = submitBtn.textContent;

  // 뒤로가기(bfcache)로 이 페이지에 돌아왔을 때, 나가기 직전의 "ANALYZING..." 상태가
  // 그대로 복원되지 않도록 버튼과 선택 상태를 초기화한다.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    submitBtn.disabled = false;
    submitBtn.textContent = defaultBtnText;
  });

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
    submitBtn.textContent = "ANALYZING...";
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

      // AI 분석/추천을 여기서 미리 생성해 캐시해둔다. 이렇게 하면 다음 페이지는
      // 새 페이지(로딩 화면)를 거치지 않고 완성된 결과로 바로 넘어간다.
      await fetch(`${API_BASE_CH5}/chapter5/analysis/${hesitationId}/`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      window.location.href = `${API_BASE_CH5}/view/chapter5/analysis/${hesitationId}/`;
    } catch (err) {
      console.error("제출 실패:", err);
      alert("처리 중 오류가 발생했습니다. 다시 시도해주세요.");
      submitBtn.disabled = false;
      submitBtn.textContent = defaultBtnText;
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
  const aiCardImageUrl = localStorage.getItem("aiCardImageUrl"); // Discover에서 CHOOSE한 AI 생성 이미지
  const localPhoto = localStorage.getItem("capturedPhotoUrl"); // 웹캠 사진 (AI 이미지가 없을 때만 쓰는 fallback)

  function applyResultPhoto(photoUrl) {
    if (!photoUrl) return;
    const imgEl = document.getElementById("resultCardImg") || document.querySelector(".result-card-img");
    if (imgEl) imgEl.src = photoUrl;
    
    resultContainer.style.backgroundImage = `url('${photoUrl}')`;
    resultContainer.style.backgroundSize = "cover";
    resultContainer.style.backgroundPosition = "center";
    resultContainer.style.backgroundRepeat = "no-repeat";
  }

  // AI가 생성한 이미지를 최우선으로 즉시 적용합니다. (내가 찍은 사진이 아님)
  // AI 이미지가 아직 없을 때만 임시로 웹캠 사진을 보여줍니다.
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

  // 1. Chapter 3의 스토리지 데이터 강제 추출 및 렌더링
  try {
    const storedProduct = JSON.parse(sessionStorage.getItem("journeyProduct") || "{}");
    const storedStyle = JSON.parse(sessionStorage.getItem("journeyStyle") || "{}");
    
    const prodName = storedProduct.name || "ELLA BOSTON BAG";
    const carryMode = summaryDisplayNames[storedStyle.carry] || storedStyle.carry || "CROSSBODY";
    const detailMode = summaryDisplayNames[storedStyle.detail] || storedStyle.detail || "ROCKET CHARM";
    
    // 모먼트 이름을 다양한 세션/로컬 스토리지 키 및 journeyProduct 내부 속성에서 탐색
    const momentName =
      storedProduct.moment ||
      storedProduct.moment_name ||
      storedProduct.theme ||
      sessionStorage.getItem("journeyMoment") ||
      localStorage.getItem("journeyMoment") ||
      sessionStorage.getItem("selectedMoment") ||
      localStorage.getItem("selectedMoment") ||
      sessionStorage.getItem("moment") ||
      localStorage.getItem("moment") ||
      "URBAN OASIS"; // 기본값도 URBAN으로 변경
  
    if (keywordItems.length >= 4) {
      setKeywordHtml(keywordItems[0], prodName.toUpperCase());
      setKeywordHtml(keywordItems[1], momentName.toUpperCase());
      setKeywordHtml(keywordItems[2], carryMode.toUpperCase());
      setKeywordHtml(keywordItems[3], detailMode.toUpperCase());
    }
  } catch (err) {
    console.warn("로컬 세션 데이터 파싱 실패:", err);
  }

  // 2. 서버 API 이미지 연동 (단, API의 키워드 더미데이터가 로컬을 덮어쓰지 않도록 차단)
  if (!selectionId) return;

  try {
    const res = await fetch(`/api/ai_story/chapter5/final/${selectionId}/`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json();

    if (json.status === "success" && json.data) {
      // 서버가 내려주는 AI 이미지가 최우선, 그 다음 로컬에 저장된 AI 이미지, 마지막이 웹캠 사진
      const serverPhotoUrl =
        json.data.image_url || aiCardImageUrl || localPhoto || STATIC_FALLBACK_IMG;
      applyResultPhoto(serverPhotoUrl);
      
      // 의도적으로 json.data의 키워드를 덮어쓰는 로직은 삭제했습니다. (Chapter 3 실제 데이터 보호)
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
      if (analysisDescEl) {
        analysisDescEl.textContent =
          data.analysis_text || "고객님의 선택을 바탕으로 새로운 여정을 계속 찾아드릴게요.";
      }

      const product = data.recommended_product;
      const titleEl = document.getElementById("recommendProductTitle");
      if (titleEl) {
        titleEl.innerHTML = (product?.name || "추천 제품 준비 중").replace(" ", "<br>");
      }

      const imgEl = document.getElementById("recommendProductImg");
      if (imgEl) {
        imgEl.src = product?.image_url || STATIC_FALLBACK_IMG;
      }

      const tagsContainer = document.getElementById("recommendProductTags");
      if (tagsContainer) {
        tagsContainer.innerHTML =
          Array.isArray(data.reason_tags) && data.reason_tags.length > 0
            ? data.reason_tags
                .map((tag) => `<span class="product-tag">${tag}</span>`)
                .join("")
            : "";
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