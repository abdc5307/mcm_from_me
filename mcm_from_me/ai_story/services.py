import logging
import time
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

# 실제 제품 조합별 참고 이미지 (chapter3.html에서 쓰는 파일과 동일)
PRODUCT_REFERENCE_IMAGE_MAP = {
    ('Ella Boston Bag', 'top_handle', 'basic_charm'): 'Small_Ella_Boston_Bag.jpg',
    ('Ella Boston Bag', 'top_handle', 'rocket_charm'): 'ella_tophandle_rocket.png',
    ('Ella Boston Bag', 'cross_body', 'basic_charm'): 'ella_crossbody_basic.png',
    ('Ella Boston Bag', 'cross_body', 'rocket_charm'): 'Ella_Boston_bag_cross.png',
}

# carry/detail 조합별 참고 이미지가 없는 제품을 위한 제품 단위 기본 이미지 (실제 MCM 정품 사진)
# product.name에 키워드가 포함되어 있으면 매칭 (예: "Himmel Backpack in Visetos" -> "Himmel Backpack")
PRODUCT_DEFAULT_IMAGE_MAP = [
    ('Himmel Backpack', 'himmel_backpack_visetos.jpg'),
    ('Aren Shopper', 'aren_shopper_visetos.jpg'),
    ('Klassik Crossbody', 'klassik_crossbody_visetos.jpg'),
]


def _load_product_reference_image(product_name, carry_code, detail_code):
    filename = PRODUCT_REFERENCE_IMAGE_MAP.get((product_name, carry_code, detail_code))
    if not filename:
        for keyword, mapped_filename in PRODUCT_DEFAULT_IMAGE_MAP:
            if keyword in product_name:
                filename = mapped_filename
                break
    if not filename:
        return None, None

    image_path = settings.BASE_DIR / 'frontend' / 'images' / filename
    if not image_path.exists():
        return None, None

    mime_type = 'image/png' if image_path.suffix.lower() == '.png' else 'image/jpeg'
    return image_path.read_bytes(), mime_type


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
        carry_code = selection.carry_option.code_name if (selection and selection.carry_option) else ""
        detail_code = selection.detail_option.code_name if (selection and selection.detail_option) else ""
        captured_photo = card.captured_photo

        moment_desc = MOMENT_PROMPT_MAP.get(
            getattr(selection, 'selected_moment', None), '세련된 도심 배경'
        )

        # 촬영 사진이 있어야 합성 가능 (없으면 바로 실패 처리)
        if not (captured_photo and captured_photo.image):
            raise ValueError("촬영된 사진이 없어 AI 이미지를 생성할 수 없습니다.")

        captured_photo.image.open('rb')
        photo_bytes = captured_photo.image.read()
        captured_photo.image.close()

        # 실제 제품 참고 이미지 (있으면 가방 디자인 정확도를 위해 함께 전달)
        product_image_bytes, product_image_mime = _load_product_reference_image(
            product_name, carry_code, detail_code
        )

        prompt = (
            f"첫 번째 이미지 속 사람의 얼굴과 신체 특징은 그대로 유지하면서, "
            f"{moment_desc}을 배경으로 {product_name} 가방을 "
            f"{carry_opt} 방식으로 들고 있는 자연스러운 모습으로 합성해줘. "
            f"{detail_opt} 디테일이 잘 보이게 해줘. "
            f"화보 같은 분위기로, 조명과 색감을 배경 분위기에 자연스럽게 맞춰줘."
        )
        if product_image_bytes:
            prompt += (
                " 가방의 색상, 소재, 하드웨어, 로고 디테일은 두 번째 이미지로 제공되는 "
                "실제 제품 참고 사진을 최대한 정확하게 그대로 반영해줘."
            )

        contents = [
            f"A high-end luxury fashion editorial photo. {prompt}",
            types.Part.from_bytes(data=photo_bytes, mime_type="image/jpeg"),
        ]
        if product_image_bytes:
            contents.append(
                types.Part.from_bytes(data=product_image_bytes, mime_type=product_image_mime)
            )

        # Gemini 이미지 모델 호출 (촬영 사진 + 실제 제품 사진을 함께 전달해 합성)
        # 이미지 생성 API가 간헐적으로 일시 과부하(503) 등을 반환할 수 있어 재시도한다.
        result_image = None
        result_mime = "image/jpeg"
        last_error = None
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash-image",
                    contents=contents,
                )
                candidates = response.candidates or []
                if candidates and candidates[0].content and candidates[0].content.parts:
                    for part in candidates[0].content.parts:
                        if part.inline_data is not None:
                            result_image = part.inline_data.data
                            result_mime = part.inline_data.mime_type or result_mime
                            break
                if result_image:
                    break
                last_error = ValueError("AI가 이미지를 반환하지 않았습니다.")
            except Exception as e:
                last_error = e
                logger.warning(f"[AI Image Generation Retry {attempt + 1}/3 - Card #{card.id}]: {e}")
            if attempt < 2:
                time.sleep(2)

        if not result_image:
            raise last_error or ValueError("AI가 이미지를 반환하지 않았습니다.")

        # AI 생성 이미지 저장
        ext = "png" if "png" in result_mime else "jpg"
        card.card_image.save(f"ai_card_{card.id}.{ext}", ContentFile(result_image), save=False)
        card.status = 'completed'
        card.save()
        return card

    except Exception as e:
        logger.error(f"[AI Image Generation Error - Card #{card.id}]: {e}")

        # AI 생성 실패 시 유저가 찍은 실제 촬영 사진을 1순위로 유지
        try:
            if card.captured_photo and card.captured_photo.image:
                card.card_image = card.captured_photo.image
            elif card.template and card.template.background_image:
                card.card_image = card.template.background_image
            card.status = 'completed'
        except Exception as fallback_error:
            logger.error(f"[Fallback도 실패 - Card #{card.id}]: {fallback_error}")
            card.status = 'failed'

        card.save()
        return card
