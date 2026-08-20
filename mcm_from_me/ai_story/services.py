import logging
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
    try:
        selection = card.style_selection
        product_name = selection.product.name if (selection and selection.product) else "MCM Bag"
        carry_opt = selection.carry_option.name if (selection and selection.carry_option) else ""
        detail_opt = selection.detail_option.name if (selection and selection.detail_option) else ""
        captured_photo = card.captured_photo

        moment_desc = MOMENT_PROMPT_MAP.get(
            getattr(selection, 'selected_moment', None), '세련된 도심 배경'
        )

        prompt = (
            f"Please create a high-fashion editorial photo based on this person's photo. "
            f"Keep the person's face and key features recognizable, set the background to {moment_desc}, "
            f"and show them holding or wearing a {product_name} in {carry_opt} style with {detail_opt} details. "
            f"Make it look like a luxury fashion magazine photoshoot."
        )

        if not (captured_photo and captured_photo.image):
            raise ValueError("촬영된 사진이 없습니다.")

        # 촬영된 사진 바이너리 읽기
        captured_photo.image.open('rb')
        photo_bytes = captured_photo.image.read()
        captured_photo.image.close()

        # Gemini 멀티모달 이미지 생성 호출
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[
                types.Part.from_bytes(data=photo_bytes, mime_type="image/jpeg"),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )

        result_image = None
        if hasattr(response, 'parts') and response.parts:
            for part in response.parts:
                if part.inline_data:
                    result_image = part.inline_data.data
                    break
        elif hasattr(response, 'candidates') and response.candidates:
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    result_image = part.inline_data.data
                    break

        if not result_image:
            raise ValueError("AI가 생성된 이미지를 반환하지 않았습니다.")

        # 생성된 AI 이미지 저장
        card.card_image.save(f"ai_card_{card.id}.jpg", ContentFile(result_image), save=False)
        card.status = 'completed'
        card.save()
        return card

    except Exception as e:
        logger.error(f"[AI Image Generation Error - Card #{card.id}]: {e}")

        # AI 생성 실패 시 원본 사진 유지
        try:
            if card.captured_photo and card.captured_photo.image:
                card.card_image = card.captured_photo.image
            elif card.template and card.template.background_image:
                card.card_image = card.template.background_image
            card.status = 'completed'
        except Exception as fallback_error:
            logger.error(f"[Fallback 실패 - Card #{card.id}]: {fallback_error}")
            card.status = 'failed'

        card.save()
        return card