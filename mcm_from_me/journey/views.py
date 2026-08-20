from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt

from .models import JourneySession, Product
from .serializers import JourneySessionSerializer, ProductSerializer
from .utils import generate_product_story
from ai_story.models import (
    Product as AiStoryProduct,
    Option as AiStoryOption,
    UserStyleSelection,
)

import base64
import requests
from google import genai
from google.genai import types
from django.core.files.base import ContentFile
from django.conf import settings
from ai_story.views import generate_journey_card_text


# [H-01 / H-02] 세션 초기화 및 Resume 확인 (E-12)
@api_view(['GET'])
@authentication_classes([])
@permission_classes([])
def init_or_check_session(request):
    session_id = request.GET.get('session_id')

    if session_id:
        try:
            session = JourneySession.objects.get(id=session_id)
            if not session.is_completed:
                return Response({
                    'status': 'RESUME_AVAILABLE',
                    'errorCode': 'E-12',
                    'message': 'Would you like to continue your journey?',
                    'lastActiveScreen': session.last_active_screen,
                    'session': JourneySessionSerializer(session).data
                }, status=status.HTTP_200_OK)
        except JourneySession.DoesNotExist:
            pass

    # 신규 세션 생성 (C1-01)
    new_session = JourneySession.objects.create(
        current_chapter="C1",
        last_active_screen="C1-01"
    )

    return Response({
        'status': 'NEW_SESSION',
        'sessionId': str(new_session.id),
        'nextScreen': 'C1-01'
    }, status=status.HTTP_201_CREATED)


# [H-08] Resume Journey - 이탈 복원
@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def resume_journey(request):
    session_id = request.data.get('session_id')
    try:
        session = JourneySession.objects.get(id=session_id)
        return Response({
            'status': 'SUCCESS',
            'lastActiveScreen': session.last_active_screen,
            'currentChapter': session.current_chapter
        }, status=status.HTTP_200_OK)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-01', 'message': 'Save session not found'}, status=status.HTTP_404_NOT_FOUND)


# [E-13] 새로 시작 (Start New Journey)
@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def start_new_journey(request):
    session_id = request.data.get('session_id')
    if session_id:
        JourneySession.objects.filter(id=session_id).update(is_completed=True)

    new_session = JourneySession.objects.create(current_chapter="C1", last_active_screen="C1-01")
    return Response({
        'status': 'SUCCESS',
        'sessionId': str(new_session.id),
        'nextScreen': 'C1-01'
    }, status=status.HTTP_200_OK)


# [C1-06 / C1-07] Moment 선택 저장
@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def save_moment(request):
    session_id = request.data.get('session_id')
    moment = request.data.get('moment')

    if not moment:
        return Response({'message': 'Moment selection required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = JourneySession.objects.get(id=session_id)
        session.selected_moment = moment
        session.current_chapter = "C2"
        session.last_active_screen = "C2-01"
        session.save()

        return Response({
            'status': 'SUCCESS',
            'nextScreen': 'C2-01'
        }, status=status.HTTP_200_OK)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-01', 'message': 'Session save failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# [C2-02 / C2-05] NFC/QR 스캔 태그 검증 및 제품 저장 (AI 연동 + Fallback 방어)
@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def verify_product_tag(request):
    session_id = request.data.get('session_id')
    tag_code = request.data.get('tag_code')

    try:
        product = Product.objects.filter(Q(nfc_tag_id=tag_code) | Q(qr_code_id=tag_code)).first()

        # E-02: 태그 인식 실패
        if not product:
            return Response({'errorCode': 'E-02', 'message': 'Tag Recognition Failed'}, status=status.HTTP_404_NOT_FOUND)

        # E-03: 미지원 제품
        if not product.is_supported:
            return Response({'errorCode': 'E-03', 'message': 'Unsupported Product'}, status=status.HTTP_400_BAD_REQUEST)

        session = JourneySession.objects.get(id=session_id)
        session.product = product
        session.current_chapter = "C2"
        session.last_active_screen = "C2-07"

        # AI 맞춤 스토리 생성 시도
        generated_story = None
        try:
            generated_story = generate_product_story(product, session.selected_moment)
            if hasattr(session, 'ai_story_text') and generated_story:
                session.ai_story_text = generated_story
        except Exception as e:
            print(f"스토리 생성 실패: {e}")

        session.save()

        # 안전한 기본 텍스트 추출 (Fallback)
        fallback_story = (
            getattr(product, 'description', None) 
            or getattr(product, 'story_desc', None) 
            or getattr(product, 'name', 'MCM Product')
        )

        return Response({
            'status': 'SUCCESS',
            'nextScreen': 'C2-07',
            'product': ProductSerializer(product).data,
            'story_text': generated_story or getattr(session, 'ai_story_text', None) or fallback_story
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"verify_product_tag 내부 에러: {e}")
        return Response({'errorCode': 'E-04', 'message': 'Product Details Unavailable'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# journey 앱의 carry/detail 코드 -> ai_story 앱의 Option.code_name 매핑
AI_STORY_CARRY_CODE_MAP = {'TOP_HANDLE': 'top_handle', 'CROSSBODY': 'cross_body'}
AI_STORY_DETAIL_CODE_MAP = {'BASIC_CHARM': 'basic_charm', 'ROCKET_CHARM': 'rocket_charm'}


def _link_ai_story_selection(request, session, carry_option, detail_option):
    """journey 세션에서 확정된 제품/스타일 선택을 ai_story.UserStyleSelection으로 연결한다.

    Chapter4(촬영)/Chapter5(AI 합성)는 journey 앱이 아니라 product/ai_story 앱의
    UserStyleSelection을 기준으로 동작하므로, 여기서 만든 selection의 id를
    Django 세션에 저장해 chapter4_page_view가 그대로 이어받게 한다.
    매칭 실패 시 조용히 넘어가고(기존 기본 동작 유지), selection_id는 세팅되지 않는다.
    """
    if not session.product:
        return

    # ai_story 제품 카탈로그의 이름은 "Himmel Backpack in Visetos"처럼 접미사가 붙어있을 수 있어
    # journey 제품명("Himmel Backpack")을 포함(부분 일치)하는 항목으로 매칭한다.
    product = AiStoryProduct.objects.filter(name__icontains=session.product.name).first()
    if not product:
        return

    try:
        carry = AiStoryOption.objects.get(
            group='carry', code_name=AI_STORY_CARRY_CODE_MAP.get(carry_option, '')
        )
        detail = AiStoryOption.objects.get(
            group='detail', code_name=AI_STORY_DETAIL_CODE_MAP.get(detail_option, '')
        )
    except AiStoryOption.DoesNotExist:
        return

    selection = UserStyleSelection.objects.create(
        product=product,
        carry_option=carry,
        detail_option=detail,
        selected_moment=session.selected_moment,
    )
    request.session['selection_id'] = selection.id


# [C3-11 / C3-17] Chapter 3 스타일 옵션 저장
@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def save_style_options(request):
    session_id = request.data.get('session_id')
    carry_option = request.data.get('carry_option')
    detail_option = request.data.get('detail_option')
    action = str(request.data.get('action', 'COMPLETE')).upper()

    valid_carry_options = {'TOP_HANDLE', 'CROSSBODY'}
    valid_detail_options = {'BASIC_CHARM', 'ROCKET_CHARM'}

    if carry_option not in valid_carry_options or detail_option not in valid_detail_options:
        return Response({'errorCode': 'E-05', 'message': 'Option Unavailable'}, status=status.HTTP_400_BAD_REQUEST)

    if action not in {'SUMMARY', 'COMPLETE'}:
        return Response({'errorCode': 'E-05', 'message': 'Option Unavailable'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = JourneySession.objects.get(id=session_id)
        session.carry_option = carry_option
        session.detail_option = detail_option
        session.current_chapter = "C4" if action == 'COMPLETE' else "C3"
        session.last_active_screen = "C4-01" if action == 'COMPLETE' else "C3-SUMMARY"
        session.save()

        if action == 'COMPLETE':
            _link_ai_story_selection(request, session, carry_option, detail_option)

        return Response({
            'status': 'SUCCESS',
            'nextScreen': session.last_active_screen,
            'style': {
                'carry_option': session.carry_option,
                'detail_option': session.detail_option,
            },
        }, status=status.HTTP_200_OK)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-01', 'message': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)


# [C4-10] Chapter 4 촬영 사진 저장
@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def save_photo_url(request):
    session_id = request.data.get('session_id')
    photo_url = request.data.get('photo_url')

    if not photo_url:
        return Response({'errorCode': 'E-11', 'message': 'Photo URL missing'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = JourneySession.objects.get(id=session_id)
        session.photo_url = photo_url
        session.current_chapter = "C5"
        session.last_active_screen = "C5-01"
        session.save()

        return Response({
            'status': 'SUCCESS',
            'nextScreen': 'C5-01'
        }, status=status.HTTP_200_OK)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-11', 'message': 'Save failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# [C5-14 / F-01] 여정 최종 완료
@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def complete_journey(request):
    session_id = request.data.get('session_id')

    try:
        session = JourneySession.objects.get(id=session_id)
        session.is_completed = True
        session.current_chapter = "F1"
        session.last_active_screen = "F-01"
        session.save()

        return Response({
            'status': 'SUCCESS',
            'nextScreen': 'F-01',
            'message': 'Your journey is complete.'
        }, status=status.HTTP_200_OK)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-11', 'message': 'Completion failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# [H-07] Chapter 이동 유효성 검사 API
@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def navigate_chapter(request):
    session_id = request.data.get('session_id')
    target_chapter = request.data.get('target_chapter')
    navigation_only = request.data.get('navigation_only') is True

    if target_chapter not in {'C1', 'C2', 'C3', 'C4', 'C5'}:
        return Response({'errorCode': 'E-14', 'message': 'Invalid chapter'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = JourneySession.objects.get(id=session_id)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-01', 'message': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    current_number = int(session.current_chapter[1:]) if session.current_chapter.startswith('C') else 5
    target_number = int(target_chapter[1:])
    chapter_is_locked = target_number > current_number if navigation_only else target_number > current_number + 1

    if chapter_is_locked:
        return Response({
            'errorCode': 'E-14',
            'message': 'Complete the previous chapter first',
            'lastActiveScreen': session.last_active_screen,
        }, status=status.HTTP_403_FORBIDDEN)

    if target_chapter == 'C3' and not session.product_id:
        return Response({'errorCode': 'E-04', 'message': 'Product Details Unavailable'}, status=status.HTTP_400_BAD_REQUEST)

    if not navigation_only and target_number == current_number + 1:
        session.current_chapter = target_chapter
        session.last_active_screen = f'{target_chapter}-01'
        session.save(update_fields=['current_chapter', 'last_active_screen', 'updated_at'])

    return Response({
        'status': 'SUCCESS',
        'targetChapter': target_chapter,
        'currentChapter': session.current_chapter,
        'lastActiveScreen': session.last_active_screen,
    }, status=status.HTTP_200_OK)



# moment/style 값을 프롬프트 문장으로 변환하는 매핑
MOMENT_PROMPT_MAP = {
    'MORNING': '아침 햇살이 비치는 도심 거리',
    'EVENING': '노을이 지는 도시 야경',
    # 실제 moment 값에 맞게 채워주세요
}

CARRY_PROMPT_MAP = {
    'TOP_HANDLE': '탑핸들로 가방을 손에 들고 있는',
    'CROSSBODY': '크로스바디로 가방을 어깨에 메고 있는',
}

DETAIL_PROMPT_MAP = {
    'BASIC_CHARM': '베이직 참 장식이 달린',
    'ROCKET_CHARM': '로켓 참 장식이 달린',
}


def build_prompt(session):
    moment_desc = MOMENT_PROMPT_MAP.get(session.selected_moment, '세련된 배경')
    carry_desc = CARRY_PROMPT_MAP.get(session.carry_option, '')
    detail_desc = DETAIL_PROMPT_MAP.get(session.detail_option, '')

    return (
        f"이 사람의 얼굴과 신체 특징은 그대로 유지하면서, "
        f"{moment_desc}을 배경으로 MCM 가방을 {carry_desc} 자연스러운 모습으로 합성해줘. "
        f"가방에는 {detail_desc} 디테일이 잘 보이게 해줘. "
        f"고급스럽고 화보 같은 분위기로, 조명과 색감을 자연스럽게 맞춰줘."
    )



@api_view(['POST'])
def generate_journey_card(request):
    session_id = request.data.get('session_id')

    try:
        session = JourneySession.objects.get(id=session_id)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-01', 'message': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    if not session.photo_url:
        return Response({'errorCode': 'E-12', 'message': 'Photo not found'}, status=status.HTTP_400_BAD_REQUEST)

    # 저장된 photo_url에서 이미지 바이트 가져오기
    from django.contrib.staticfiles import finders

    try:
        if session.photo_url.startswith('http'):
            photo_bytes = requests.get(session.photo_url, timeout=10).content
        else:
            # /static/images/xxx.jpg → images/xxx.jpg 로 변환 후 실제 파일 경로 찾기
            relative_path = session.photo_url.removeprefix('/static/')
            file_path = finders.find(relative_path)

            if not file_path:
                return Response({'errorCode': 'E-13', 'message': f'File not found: {relative_path}'}, status=status.HTTP_404_NOT_FOUND)

            with open(file_path, 'rb') as f:
                photo_bytes = f.read()
    except Exception as e:
        return Response({'errorCode': 'E-13', 'message': f'Photo load failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    prompt = build_prompt(session)

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
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
        caption = ""
        for part in response.candidates[0].content.parts:
            if part.text:
                caption += part.text
            elif part.inline_data:
                result_image = part.inline_data.data

        if not result_image:
            # 안전 필터에 걸리거나 생성 실패한 경우 fallback
            return Response({
                'errorCode': 'E-14',
                'message': 'Image generation failed, please retry'
            }, status=status.HTTP_502_BAD_GATEWAY)

        session.generated_image.save('journey_card.jpg', ContentFile(result_image), save=False)

        class _SimpleOption:
            """generate_journey_card_text가 기대하는 .code_name 속성을 흉내내는 헬퍼"""
            def __init__(self, code_name):
                self.code_name = code_name

        caption = generate_journey_card_text(
            product=session.product,
            carry_option=_SimpleOption(session.carry_option),
            detail_option=_SimpleOption(session.detail_option),
            narration=None,
        ) or ""

        session.generated_caption = caption
        session.current_chapter = "C5"
        session.last_active_screen = "C5-RESULT"
        session.save()

        return Response({
            'status': 'SUCCESS',
            'nextScreen': 'C5-RESULT',
            'image_url': session.generated_image.url,
            'caption': caption,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'errorCode': 'E-15',
            'message': f'AI generation error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)