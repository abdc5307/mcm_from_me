// =====================================================
// 공통 유틸
// =====================================================
const API_BASE_CH5 = "/api/ai_story";
// 카드 이미지 로드 실패 시 대신 보여줄 기본 이미지 (실제 정적 파일 경로에 맞게 조정해주세요)
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
// [Discover] 카드 목록 로드 + CHOOSE / STILL DECIDING
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    const discoverContainer = document.querySelector(".discover-container");
    const swiperWrapper = document.getElementById("discoverSwiperWrapper");
    if (!discoverContainer || !swiperWrapper) return; // discover 페이지가 아니면 종료

    const selectionId = document.body.dataset.selectionId;
    const btnChoose = document.getElementById("btnChooseJourney");
    const btnStill = document.getElementById("btnStillDeciding");

    let activeCardId = null;
    let swiperInstance = null;

    async function loadCards() {
        try {
            const res = await fetch(`${API_BASE_CH5}/chapter5/cards/${selectionId}/`);
            const data = await res.json();
            console.log("chapter5/cards 응답 원본:", data); // 필드명 확인용, 문제 해결되면 지워도 됨

            // TODO: 실제 응답 키에 맞게 조정 (cards / data / results 중 하나일 것으로 예상)
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
        if (cards.length === 0) {
            swiperWrapper.innerHTML = "";
            return;
        }

        swiperWrapper.innerHTML = cards
            .map((card) => {
                const imageUrl = card.image_url || card.image || "";
                if (!imageUrl) {
                    console.warn("카드에 이미지 URL이 없습니다:", card);
                }
                return `
            <div class="swiper-slide discover-card" data-card-id="${card.id}">
                <div class="discover-card-media">
                    <img
                        src="${imageUrl}"
                        alt="${card.title || ""}"
                        class="discover-card-img"
                        onerror="this.onerror=null; this.src='${STATIC_FALLBACK_IMG}';"
                    />
                    <div class="discover-card-overlay"></div>
                </div>
                <div class="discover-card-body">
                    <span class="discover-card-caption">${card.caption || "LATEST CHAPTER"}</span>
                    <h3 class="discover-card-title">${card.title || ""}</h3>
                    <p class="discover-card-desc">${card.description || card.desc || ""}</p>
                </div>
            </div>`;
            })
            .join("");

        activeCardId = cards[0]?.id ?? null;

        if (cards.length <= 1) {
            discoverContainer.classList.add("is-single");
        } else {
            discoverContainer.classList.remove("is-single");
            if (swiperInstance) swiperInstance.destroy(true, true);
            swiperInstance = new Swiper(".discover-swiper", {
                slidesPerView: "auto",
                centeredSlides: true,
                spaceBetween: 12,
                loop: true,
                rewind: false,
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

    if (btnChoose) {
        btnChoose.addEventListener("click", async () => {
            if (!activeCardId) return;
            try {
                const res = await fetch(`${API_BASE_CH5}/chapter5/card/${activeCardId}/select/`, {
                    method: "POST",
                    headers: jsonHeaders(),
                });
                if (res.ok) {
                    window.location.href = `${API_BASE_CH5}/view/chapter5/result/${selectionId}/`;
                } else {
                    alert("카드 선택 중 오류가 발생했습니다. 다시 시도해주세요.");
                }
            } catch (err) {
                console.error("카드 선택 실패:", err);
                alert("카드 선택 중 오류가 발생했습니다. 다시 시도해주세요.");
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

/* ch5_still_deciding.html — 옵션 선택 토글 */
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
});

// =====================================================
// [Still Deciding] SUBMIT TO AI
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    const submitBtn = document.getElementById("submitBtn");
    if (!submitBtn) return; // still deciding 페이지가 아니면 종료

    const selectionId = document.body.dataset.selectionId;

    submitBtn.addEventListener("click", async () => {
        const activeOption = document.querySelector(".still-option-btn.is-active");
        if (!activeOption) {
            alert("망설인 이유를 하나 선택해주세요.");
            return;
        }
        const reason = activeOption.dataset.option;

        submitBtn.disabled = true;
        try {
            // 1) 망설인 이유 저장 -> hesitation_id 발급
            const hesitationRes = await fetch(`${API_BASE_CH5}/chapter5/hesitation/`, {
                method: "POST",
                headers: jsonHeaders(),
                body: JSON.stringify({ selection_id: selectionId, reason }),
            });
            const hesitationData = await hesitationRes.json();
            if (!hesitationRes.ok) throw new Error("hesitation 저장 실패");

            // TODO: 실제 응답 키에 맞게 조정 (id / hesitation_id 중 하나일 것으로 예상)
            const hesitationId = hesitationData.id ?? hesitationData.hesitation_id;

            // 2) AI 분석 제출
            const submitRes = await fetch(`${API_BASE_CH5}/chapter5/submit-to-ai/`, {
                method: "POST",
                headers: jsonHeaders(),
                body: JSON.stringify({ hesitation_id: hesitationId }),
            });
            if (!submitRes.ok) throw new Error("AI 제출 실패");

            window.location.href = `${API_BASE_CH5}/view/chapter5/analysis/${hesitationId}/`;
        } catch (err) {
            console.error("AI 제출 실패:", err);
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

    if (!btnComplete && !btnConnectAdviser && !btnShare && !btnViewDetails) return; // 해당 페이지 아니면 종료

    const ds = document.body.dataset;
    const isRecommendationPage = !!ds.recommendationId; // still_result.html 여부

    if (btnComplete) {
        btnComplete.addEventListener("click", async () => {
            try {
                const res = await fetch(`${API_BASE_CH5}/chapter5/complete/${ds.selectionId}/`, {
                    method: "POST",
                    headers: jsonHeaders(),
                });
                if (res.ok) {
                    // TODO: 최종 "여정이 완료되었습니다" 화면이 아직 없어서 임시로 알림 처리.
                    // 해당 화면 템플릿이 준비되면 여기서 window.location.href로 이동시키면 됩니다.
                    alert("여정이 완료되었습니다!");
                } else {
                    alert("완료 처리 중 오류가 발생했습니다.");
                }
            } catch (err) {
                console.error("journey complete 요청 실패:", err);
            }
        });
    }

    if (btnConnectAdviser) {
        btnConnectAdviser.addEventListener("click", async () => {
            const url = isRecommendationPage
                ? `${API_BASE_CH5}/chapter5/recommendation/advisor-connect/`
                : `${API_BASE_CH5}/chapter5/advisor-connect/`;
            try {
                const res = await fetch(url, { method: "POST", headers: jsonHeaders() });
                if (res.ok) alert("어드바이저 연결이 요청되었습니다.");
            } catch (err) {
                console.error("advisor-connect 요청 실패:", err);
            }
        });
    }

    if (btnShare) {
        btnShare.addEventListener("click", async () => {
            const url = isRecommendationPage
                ? `${API_BASE_CH5}/chapter5/recommendation/${ds.recommendationId}/share/`
                : `${API_BASE_CH5}/chapter5/share/${ds.cardId}/`;
            try {
                const res = await fetch(url, { method: "POST", headers: jsonHeaders() });
                const data = await res.json();
                // TODO: 공유 UI(공유 시트/링크 복사 등)는 실제 응답 형태 확인 후 붙이기
                console.log("공유 응답:", data);
            } catch (err) {
                console.error("share 요청 실패:", err);
            }
        });
    }

    if (btnViewDetails) {
        btnViewDetails.addEventListener("click", async () => {
            if (!ds.productId) return;
            try {
                const res = await fetch(`${API_BASE_CH5}/chapter5/product/${ds.productId}/`);
                const data = await res.json();
                // TODO: 상세 모달/페이지 UI 없어서 우선 콘솔로 확인. 디자인 나오면 모달로 교체.
                console.log("제품 상세:", data);
            } catch (err) {
                console.error("product detail 요청 실패:", err);
            }
        });
    }
});

// =====================================================
// [Processing] 로딩 화면 — 기존 로직 유지 (수정 없음)
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("processingOverlay");
    const progressEl = document.getElementById("progressNumber");
    const selectionId = document.body.dataset.selectionId || "1";

    if (overlay && progressEl) {
        let percent = 0;

        const interval = setInterval(() => {
            if (percent < 100) {
                percent += Math.floor(Math.random() * 6) + 4;
                if (percent > 100) percent = 100;
                progressEl.textContent = percent;
            } else {
                clearInterval(interval);
                setTimeout(() => {
                    overlay.style.transition = "opacity 0.4s ease";
                    overlay.style.opacity = "0";
                    setTimeout(() => {
                        overlay.style.display = "none";
                    }, 400);
                }, 300);
            }
        }, 100);

        fetch("/api/ai_story/chapter5/generate/", {
            method: "POST",
            headers: jsonHeaders(),
            body: JSON.stringify({ selection_id: selectionId }),
        }).catch((err) => {
            console.warn("AI 생성 API 호출 실패 (무시하고 화면 표시):", err);
        });
    }
});