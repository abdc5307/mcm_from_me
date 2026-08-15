from google import genai
from django.conf import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_product_story(product, selected_moment):

    prompt = f"""
당신은 럭셔리 가방 브랜드의 카피라이터입니다.
아래 정보를 바탕으로 두 부분으로 구성된 제품 스토리 문구를 작성해주세요.

1번째 줄: 감성적이고 간결한 영문 카피 한 줄. "A timeless shape for what comes next." 처럼 짧고 임팩트 있게 작성해주세요.
2번째 부분: 위 영문 카피를 자연스럽게 풀어낸 한국어 해설 문단 (2~3문장). 선택한 무드와 제품의 특징을 자연스럽게 연결해서 작성해주세요.

제품명: {product.name}
선택한 무드: {selected_moment}

출력 형식은 아래와 같이 정확히 지켜주세요. 다른 설명은 붙이지 마세요.

[영문 카피]

[한국어 해설]
"""
    try:
        response = client.models.generate_content(
            model="gemini-flash-latest", contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"제품 스토리 생성 오류: {e}")
        return None