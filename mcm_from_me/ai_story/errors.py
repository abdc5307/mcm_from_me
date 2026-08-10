#카드 선택 관련 에러
ERROR_CODES = {
    'E-01': {'code': 'E-01', 'message': '상담원 연결에 실패했습니다.'},
    'E-04': {'code': 'E-04', 'message': '제품 상세 정보 조회에 실패했습니다.'},
    'E-11': {'code': 'E-11', 'message': '카드 생성/저장에 실패했습니다.'},
}

def error_response(code):
    return ERROR_CODES.get(code, {'code': code, 'message': '알 수 없는 오류가 발생했습니다.'})