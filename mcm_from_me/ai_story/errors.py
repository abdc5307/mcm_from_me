#카드 선택 관련 에러
ERROR_CODES = {
    'E-11': {'code': 'E-11', 'message': '카드 생성/저장에 실패했습니다.'},
}

def error_response(code):
    return ERROR_CODES.get(code, {'code': code, 'message': '알 수 없는 오류가 발생했습니다.'})