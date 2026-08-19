import os
import logging
import requests
from django.core.files.base import ContentFile
from .models import JourneyCard

logger = logging.getLogger('journey_save')

def generate_ai_card_image(card: JourneyCard) -> JourneyCard:
    """
    JourneyCard의 유저 선택값과 촬영 사진을 조합하여
    AI 이미지 생성 API를 호출하고 card_image에 저장하는 서비스 함수
    """
    try:
        selection = card.style_selection
        product_name = selection.product.name if (selection and selection.product) else "MCM Bag"
        carry_opt = selection.carry_option.name if (selection and selection.carry_option) else ""
        detail_opt = selection.detail_option.name if (selection and selection.detail_option) else ""
        captured_photo = card.captured_photo

        # 1. 프롬프트 구성
        prompt = (
            f"A high-end luxury editorial pictorial of {product_name}, "
            f"styled with {carry_opt} and {detail_opt} aesthetic."
        )

        # ------------------------------------------------------------------
        # 2-A. [OpenAI DALL-E 연동 시] (추후 주석 해제)
        # ------------------------------------------------------------------
        # import openai
        # client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        # response = client.images.generate(
        #     model="dall-e-3",
        #     prompt=prompt,
        #     size="1024x1024",
        #     n=1,
        # )
        # img_res = requests.get(response.data[0].url, timeout=20)
        # card.card_image.save(f"ai_card_{card.id}.png", ContentFile(img_res.content), save=False)

        # ------------------------------------------------------------------
        # 2-B. [자체 AI 서버 연동 시] (추후 주석 해제)
        # ------------------------------------------------------------------
        # ai_server_url = os.getenv("AI_SERVER_URL", "http://ai-server:8000/api/generate")
        # payload = {
        #     "prompt": prompt,
        #     "product_name": product_name,
        #     "carry_option": carry_opt,
        #     "detail_option": detail_opt,
        #     "user_photo_url": captured_photo.image.url if (captured_photo and captured_photo.image) else None
        # }
        # res = requests.post(ai_server_url, json=payload, timeout=30)
        # if res.status_code == 200:
        #     card.card_image.save(f"ai_card_{card.id}.png", ContentFile(res.content), save=False)

        # ------------------------------------------------------------------
        # 2-C. [현재 즉시 작동하는 Mock 로직]
        # 템플릿 배경 -> 촬영 원본 사진 -> 더미 이미지 순으로 Fallback 할당
        # ------------------------------------------------------------------
        if card.template and card.template.background_image:
            card.card_image = card.template.background_image
        elif captured_photo and captured_photo.image:
            card.card_image = captured_photo.image
        else:
            mock_res = requests.get("https://picsum.photos/800/1200", timeout=10)
            if mock_res.status_code == 200:
                card.card_image.save(f"ai_card_{card.id}.jpg", ContentFile(mock_res.content), save=False)

        card.status = 'completed'
        card.save()
        return card

    except Exception as e:
        logger.error(f"[AI Image Generation Error - Card #{card.id}]: {e}")
        card.status = 'failed'
        card.save()
        return card