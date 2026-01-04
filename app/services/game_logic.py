from datetime import date, timedelta
from typing import Dict, Any
from app.models.game_models import DailyStoryContext, GameState


def calculate_outcome(context: DailyStoryContext) -> Dict[str, Any]:
    """
    주사위 결과 기반 성공/실패 판정
    
    Args:
        context: DailyStoryContext 객체
        
    Returns:
        판정 결과 딕셔너리 (is_success, effective_difficulty, madness_triggered)
    """
    # 일요일 보스전인 경우 주간 성공 횟수만큼 난이도 차감
    effective_difficulty = context.target.base_difficulty
    if context.target.is_sunday_boss:
        effective_difficulty -= context.state.weekly_success_count
        effective_difficulty = max(0, effective_difficulty)  # 음수 방지

    # 성공 조건: 숫자 합계 >= 난이도 AND 기호 일치
    number_success = context.roll.black_dice_sum >= effective_difficulty
    symbol_success = context.target.required_symbol in context.roll.green_dice_symbols

    is_success = number_success and symbol_success

    return {
        "is_success": is_success,
        "effective_difficulty": effective_difficulty,
        "madness_triggered": context.madness_triggered,
        "number_match": number_success,
        "symbol_match": symbol_success
    }


def update_madness(state: GameState, cthulhu_symbol_count: int) -> GameState:
    """
    크툴루 기호 감지 시 광기 수치 증가
    
    Args:
        state: 현재 게임 상태
        cthulhu_symbol_count: 크툴루 기호 개수 (0~3)
        
    Returns:
        업데이트된 GameState
    """
    if cthulhu_symbol_count > 0:
        state.madness_level += cthulhu_symbol_count
    return state


def update_weekly_success(state: GameState, is_success: bool) -> GameState:
    """
    주간 성공 횟수 업데이트
    
    Args:
        state: 현재 게임 상태
        is_success: 조우 성공 여부
        
    Returns:
        업데이트된 GameState
    """
    if is_success:
        state.weekly_success_count += 1
    return state


def reset_weekly_progress(state: GameState, current_date: date) -> GameState:
    """
    매주 월요일 주간 성공 횟수 초기화
    (일요일 조우 완료 후 초기화는 process_encounter에서 별도 처리)
    
    Args:
        state: 현재 게임 상태
        current_date: 현재 날짜
        
    Returns:
        업데이트된 GameState
    """
    # 월요일인지 확인 (weekday() == 0이 월요일)
    if current_date.weekday() == 0:
        state.weekly_success_count = 0
    return state


def should_reset_weekly_progress(diary_write_date: date) -> bool:
    """
    일요일 조우 완료 후 주간 초기화가 필요한지 확인
    
    Args:
        diary_write_date: 일기 작성 날짜 (조우 완료 날짜)
        
    Returns:
        일요일이면 True (주간 초기화 필요)
    """
    return is_sunday(diary_write_date)


def reset_monthly_madness(state: GameState, current_date: date, previous_date: date = None) -> GameState:
    """
    다음 달로 넘어갈 때 광기 수치 0으로 초기화
    (월이 바뀌는 순간에 초기화)
    
    Args:
        state: 현재 게임 상태
        current_date: 현재 날짜
        previous_date: 이전 날짜 (옵션, 월 변경 감지용)
        
    Returns:
        업데이트된 GameState
    """
    # 이전 날짜가 제공된 경우 월 변경 확인
    if previous_date is not None:
        if previous_date.month != current_date.month or previous_date.year != current_date.year:
            state.madness_level = 0
    # 이전 날짜가 없는 경우 매월 1일 확인 (하위 호환성)
    elif current_date.day == 1:
        state.madness_level = 0
    return state


def calculate_monthly_score(
    sunday_success_count: int,
    madness_maxed_out: bool
) -> int:
    """
    월간 점수 계산
    - 성공한 일요일 조우(특별 조우) 하나당 +5점
    - 해당 월의 광기 칸이 모두 채워졌다면 -5점
    
    Args:
        sunday_success_count: 성공한 일요일 조우 개수
        madness_maxed_out: 광기 게이지가 만료되었는지 여부
        
    Returns:
        계산된 점수
    """
    score = sunday_success_count * 5
    if madness_maxed_out:
        score -= 5
    return score


def is_sunday(date_obj: date) -> bool:
    """날짜가 일요일인지 확인"""
    return date_obj.weekday() == 6


def get_week_start(date_obj: date) -> date:
    """해당 날짜가 속한 주의 월요일 날짜 반환"""
    days_since_monday = date_obj.weekday()
    return date_obj - timedelta(days=days_since_monday)


def is_date_in_current_week(target_date: date, current_date: date) -> bool:
    """
    대상 날짜가 현재 주(월~일)에 속하는지 확인
    
    Args:
        target_date: 확인할 날짜
        current_date: 현재 날짜
        
    Returns:
        현재 주에 속하면 True
    """
    if is_sunday(target_date):
        # 일요일은 해당 주 일요일 당일에만 가능
        return target_date == current_date
    
    week_start = get_week_start(current_date)
    week_end = week_start + timedelta(days=6)
    
    return week_start <= target_date <= week_end

