from google import genai
from django.conf import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

#이전 선택 ai api
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


#최종 선택 ai api
def generate_journey_card_text(product, carry_option, detail_option, narration):

    prompt = f"""
당신은 럭셔리 브랜드의 스토리텔러입니다.
아래 정보를 바탕으로 사용자의 스타일링 여정을 담은 짧은 카드 문구를 작성해주세요.
2~3문장 이내, 감성적이고 개인화된 톤으로 작성해주세요.

제품: {product.name}
Carry 옵션: {carry_option.code_name}
Detail 옵션: {detail_option.code_name}
기존 내레이션: {narration or '없음'}

결과는 카드 문구만 출력하고, 다른 설명은 붙이지 마세요.
"""
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"카드 생성 중 Gemini 오류: {e}")
        return None