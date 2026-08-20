import re
from google import genai
from django.conf import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# 짧은 문구 생성 용도라 무거운 추론형 모델은 불필요하다.
# gemini-3.6-flash는 응답 시간이 4~27초까지 편차가 커서, 가볍고 일관되게 빠른(1~3초) 모델을 사용한다.
TEXT_MODEL = "gemini-3.1-flash-lite"


def generate_product_story(product, selected_moment):

    prompt = f"""
당신은 럭셔리 가방 브랜드의 카피라이터입니다.
아래 정보를 바탕으로 두 부분으로 구성된 제품 스토리 문구를 작성해주세요.

1번째 줄: 감성적이고 간결한 영문 카피 한 줄. "A timeless shape for what comes next." 처럼 짧고 임팩트 있게 작성해주세요.
2번째 부분: 위 영문 카피를 자연스럽게 풀어낸 한국어 해설 문단 (2~3문장). 선택한 무드와 제품의 특징을 자연스럽게 연결해서 작성해주세요.

제품명: {product.name}
선택한 무드: {selected_moment}

출력 형식:
첫 줄에는 영문 카피만 작성하고, 빈 줄을 하나 둔 뒤, 두 번째 줄부터는 한국어 해설 문단만 작성해주세요.
"[영문 카피]", "[한국어 해설]" 같은 대괄호 라벨이나 머리말은 절대 출력에 포함하지 마세요.
순수하게 카피 문구와 해설 문단 내용만 출력하세요.
"""
    try:
        response = client.models.generate_content(
            model=TEXT_MODEL, contents=prompt
        )
        raw_text = response.text.strip() if response and response.text else ""

        # 모델이 지시를 어기고 "[영문 카피]", "[한국어 해설]" 같은 라벨을 붙이는 경우가 있어
        # 띄어쓰기/콜론 유무와 상관없이 대괄호 라벨을 통째로 제거한다.
        cleaned_text = re.sub(r"\[\s*(영문\s*카피|한국어\s*해설)\s*\]\s*:?\s*", "", raw_text).strip()

        return cleaned_text
    except Exception as e:
        print(f"제품 스토리 생성 오류: {e}")
        return None