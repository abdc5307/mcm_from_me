import os
import logging
import requests
from django.conf import settings
from django.core.files.base import ContentFile
from google import genai
from google.genai import types
from .models import JourneyCard

logger = logging.getLogger('journey_save')

client = genai.Client(api_key=settings.GEMINI_API_KEY)


MOMENT_PROMPT_MAP = {
    'URBAN_ESCAPE': '도심을 벗어난 한적한 자연 속, 여유로운 풍경',
    'NEW_JOURNEY': '떠오르는 아침 햇살 아래 공항 또는 기차역 같은 새로운 출발의 장소',
    'CREATIVE_FLOW': '감각적인 갤러리나 스튜디오, 영감이 흐르는 공간',
    'MIDNIGHT_MOVE': '네온사인이 빛나는 도시의 밤거리, 화려한 야경',
}

def generate_ai_card_image(card: JourneyCard) -> JourneyCard:
    """
    JourneyCard의 유저 선택값과 촬영 사진을 조합하여
    Gemini 이미지 생성 API를 호출하고 card_image에 저장하는 서비스 함수
    """
    try:
        selection = card.style_selection
        product_name = selection.product.name if (selection and selection.product) else "MCM Bag"
        carry_opt = selection.carry_option.name if (selection and selection.carry_option) else ""
        detail_opt = selection.detail_option.name if (selection and selection.detail_option) else ""
        captured_photo = card.captured_photo

        moment_desc = MOMENT_PROMPT_MAP.get(
            getattr(selection, 'selected_moment', None), '세련된 도심 배경'
        )

        # 1. 프롬프트 구성 (1번 영역 - 필요하면 여기 문구만 다듬으면 됨)
        prompt = (
            f"이 사람의 얼굴과 신체 특징은 그대로 유지하면서, "
            f"{moment_desc}을 배경으로 {product_name} 가방을 "
            f"{carry_opt} 방식으로 들고 있는 자연스러운 모습으로 합성해줘. "
            f"{detail_opt} 디테일이 잘 보이게 해줘. "
            f"화보 같은 분위기로, 조명과 색감을 배경 분위기에 자연스럽게 맞춰줘."
        )

        # 2. 촬영 사진이 있어야 합성 가능 (없으면 바로 실패 처리)
        if not (captured_photo and captured_photo.image):
            raise ValueError("촬영된 사진이 없어 AI 이미지를 생성할 수 없습니다.")

        captured_photo.image.open('rb')
        photo_bytes = captured_photo.image.read()
        captured_photo.image.close()

        # 3. Gemini 이미지 생성/편집 호출 (2번 영역 - 실제 AI 호출부)
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[
                types.Part.from_bytes(data=photo_bytes, mime_type="image/jpeg"),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"]
            ),
        )

        result_image = None
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                result_image = part.inline_data.data
                break

        if not result_image:
            raise ValueError("AI가 이미지를 반환하지 않았습니다. (안전 필터 또는 생성 실패)")

        # 4. 결과 이미지 저장 (3번 영역 - card.card_image.save 파싱)
        card.card_image.save(f"ai_card_{card.id}.png", ContentFile(result_image), save=False)

        card.status = 'completed'
        card.save()
        return card

    except Exception as e:
        logger.error(f"[AI Image Generation Error - Card #{card.id}]: {e}")

        # 5. 실패 시 Fallback (Mock 로직 유지 - 데모 중 전면 실패 방지용)
        try:
            if card.template and card.template.background_image:
                card.card_image = card.template.background_image
            elif card.captured_photo and card.captured_photo.image:
                card.card_image = card.captured_photo.image
            card.status = 'completed'
        except Exception as fallback_error:
            logger.error(f"[Fallback도 실패 - Card #{card.id}]: {fallback_error}")
            card.status = 'failed'

        card.save()
        return card