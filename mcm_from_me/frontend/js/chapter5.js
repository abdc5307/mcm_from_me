document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.discover-container');
    const swiperWrapper = document.querySelector('.discover-swiper .swiper-wrapper');
    
    if (!swiperWrapper) return;

    const slides = swiperWrapper.querySelectorAll('.swiper-slide');
    const slideCount = slides.length;

    if (slideCount <= 1) {
        container?.classList.add('is-single');
    } else {
        container?.classList.remove('is-single');
        
        // 버벅임 및 스크롤 락 문제 해결 세팅
        const discoverSwiper = new Swiper('.discover-swiper', {
            slidesPerView: 'auto',
            centeredSlides: true,
            spaceBetween: 12,
            
            // ★ 루프 충돌 방지 및 부드러운 스와이프 핵심 옵션
            loop: true,
            rewind: false,
            observer: true,         // DOM 변경 감지
            observeParents: true,   // 부모 요소 스타일 변경 감지
            
            pagination: {
                el: '.discover-dots',
                clickable: true,
            },
        });
    }
});

/* ch5_still_deciding.html */
document.addEventListener('DOMContentLoaded', () => {
    const optionBtns = document.querySelectorAll('.still-option-btn');
    
    optionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 다른 버튼 활성화 해제 및 클릭된 버튼 토글
            optionBtns.forEach(b => {
                if (b !== btn) b.classList.remove('is-active');
            });
            btn.classList.toggle('is-active');
        });
    });
});