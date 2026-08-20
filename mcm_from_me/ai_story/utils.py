from google import genai
from django.conf import settings
import json
import time
from google import genai
import re

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_ai_narration(product, carry_option, detail_option):
    prompt = f"""
당신은 럭셔리 가방 브랜드의 카피라이터입니다.
아래 제품 정보를 바탕으로 두 부분으로 구성된 카피를 작성해주세요.

1번째 줄: 감성적이고 간결한 영문 카피 한 줄. "Built to move. Made to be yours." 처럼 짧고 임팩트 있게 작성해주세요.
2번째 부분: 위 영문 카피를 자연스럽게 풀어낸 한국어 해설 문단 (3~4문장). 제품의 클래식한 구조와 선택한 옵션의 특징을 감성적으로 녹여서 작성해주세요.

제품: {product.name}
Carry 옵션: {carry_option.code_name}
Detail 옵션: {detail_option.code_name}

출력 형식:
첫 줄에는 영문 카피만 작성하고, 빈 줄을 하나 둔 뒤, 두 번째 줄부터는 한국어 해설 문단만 작성해주세요. 
앞에 [영문 카피], [한국어 해설] 같은 머리말이나 레이블은 절대 붙이지 마세요. 
"""
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash", contents=prompt
        )
        raw_text = response.text.strip() if response and response.text else ""

        cleaned_text = (
            raw_text.replace("[영문 카피]", "")
            .replace("[한국어 해설]", "")
            .replace("[영문카피]", "")
            .replace("[한국어해설]", "")
            .strip()
        )

        return cleaned_text
    except Exception as e:
        print(f"Gemini API 호출 실패: {e}")
        return None

MOMENT_TEXT_MAP = {
    'URBAN_ESCAPE': '도심을 벗어난 여유로운 순간',
    'NEW_JOURNEY': '새로운 시작을 앞둔 순간',
    'CREATIVE_FLOW': '자유로운 영감이 흐르는 순간',
    'MIDNIGHT_MOVE': '밤의 도시를 즐기는 순간',
}

def generate_journey_card_text(product, carry_option, detail_option, narration, selected_moment=None):
    moment_desc = MOMENT_TEXT_MAP.get(selected_moment, '특별한 순간')

    prompt = f"""
당신은 럭셔리 브랜드의 스토리텔러입니다.
아래 정보를 바탕으로 사용자의 스타일링 여정을 담은 짧은 카드 문구를 작성해주세요.
2~3문장 이내, 감성적이고 개인화된 톤으로 작성해주세요.

무드: {moment_desc}
제품: {product.name}
Carry 옵션: {carry_option.code_name}
Detail 옵션: {detail_option.code_name}
기존 내레이션: {narration or '없음'}

결과는 카드 문구만 출력하고, 다른 설명은 붙이지 마세요.
"""
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-3.6-flash", contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            print(f"카드 생성 중 Gemini 오류 (시도 {attempt+1}/3): {e}")
            if attempt < 2:
                time.sleep(2)  # 2초 대기 후 재시도
    return None


def generate_ai_analysis_and_recommendation(selection, reason, all_products):
    product_list_text = "\n".join(
        [f"- ID: {p.id} | 제품명: {p.name} | 특징: {p.description}" for p in all_products]
    )

    prompt = f"""
당신은 럭셔리 브랜드의 AI 스타일 컨설턴트입니다.
고객이 아래와 같은 이유로 구매를 고민하고 있습니다.

현재 선택 제품: {selection.product.name}
고민 이유: {reason}
기존 무드: NEW JOURNEY

다음 형식의 JSON으로만 답변해주세요. 다른 설명은 붙이지 마세요.
{{
  "keyword_analysis": "선택 키워드(NEW JOURNEY)와 고객 답변을 연결한 한 문장 분석",
  "current_product_interpretation": "현재 제품이 왜 아쉬웠는지 해석하는 한 문장",
  "question_suggestion": "같은 무드를 유지하며 다른 방향을 제안하는 질문형 한 문장",
  "recommended_product_id": "아래 제품 목록 중 가장 적합한 제품의 id (정수)",
  "reason_tags": ["추천 근거 태그 2~3개, 예: 넉넉한 수납, 양손이 자유로운 이동, NEW JOURNEY 무드"]
}}

제품 목록:
{product_list_text}
"""
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash", contents=prompt
        )
        raw = response.text.strip()
        raw = raw.replace('```json', '').replace('```', '').strip()
        parsed = json.loads(raw)

        analysis_text = " ".join([
            parsed.get("keyword_analysis", ""),
            parsed.get("current_product_interpretation", ""),
            parsed.get("question_suggestion", ""),
        ]).strip()

        return {
            "analysis_text": analysis_text,
            "recommended_product_id": int(parsed.get("recommended_product_id")),
            "reason_tags": ", ".join(parsed.get("reason_tags", [])),
        }
    except Exception as e:
        print(f"AI 분석/추천 생성 오류: {e}")
        return None