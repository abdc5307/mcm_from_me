from google import genai
from django.conf import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

def generate_ai_narration(product, carry_option, detail_option):

    prompt = f"""
당신은 럭셔리 가방 브랜드의 카피라이터입니다.
아래 제품 정보를 바탕으로 감성적이고 간결한 영문 카피 한 줄을 작성해주세요.
형식은 "Built to move. Made to be yours." 처럼 짧고 임팩트 있게 작성해주세요.

제품: {product.name}
Carry 옵션: {carry_option.code_name}
Detail 옵션: {detail_option.code_name}

결과는 카피 문구만 출력하고, 다른 설명은 붙이지 마세요.
"""
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash", contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"Gemini API 호출 실패: {e}")
        return None