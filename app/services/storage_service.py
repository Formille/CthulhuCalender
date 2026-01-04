import json
from datetime import date, datetime
from typing import Dict, Any, Optional, List
from pathlib import Path


DATA_DIR = Path(__file__).parent.parent.parent / "data"
SAVE_FILE = DATA_DIR / "save_game.json"


def ensure_data_dir():
    """data 디렉토리가 없으면 생성"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_game_data() -> Dict[str, Any]:
    """
    게임 데이터 로드
    
    Returns:
        게임 데이터 딕셔너리 (파일이 없으면 새 게임 초기화)
    """
    ensure_data_dir()
    
    if not SAVE_FILE.exists():
        return initialize_new_game()
    
    try:
        with open(SAVE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data
    except (json.JSONDecodeError, IOError) as e:
        print(f"게임 데이터 로드 실패: {e}. 새 게임을 시작합니다.")
        return initialize_new_game()


def save_game_data(data: Dict[str, Any]) -> bool:
    """
    게임 데이터 저장
    
    Args:
        data: 저장할 게임 데이터
        
    Returns:
        저장 성공 여부
    """
    ensure_data_dir()
    
    try:
        # 마지막 플레이 시간 업데이트
        if "save_file_info" in data:
            data["save_file_info"]["last_played"] = datetime.now().isoformat()
        
        with open(SAVE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except IOError as e:
        print(f"게임 데이터 저장 실패: {e}")
        return False


def generate_prologue(year: int) -> tuple[str, str]:
    """
    연도별 프롤로그 생성 (하드코딩된 기본값 반환)
    AI 생성은 initialize_new_game에서 별도로 처리됨
    
    Args:
        year: 선택한 연도 (1925 또는 1931)
        
    Returns:
        (프롤로그 텍스트, 프롤로그 날짜) 튜플
    """
    if year == 1925:
        prologue_date = "1924-12-31"
        prologue_text = """날짜: 1924년 12월 31일 장소: 매사추세츠주 아캄(Arkham), 탐정 사무소

거리에서는 폭죽 소리가 들려온다. 사람들은 다가올 1925년이 희망으로 가득 찰 것이라 떠들며 축배를 들고 있다. 어리석은 자들. 그들은 아캄의 짙은 안개 속에 무엇이 도사리고 있는지 전혀 모른다.

나는 창밖으로 비치는 낡은 건물들의 그림자를 내려다본다. 최근 내 사무실을 찾아온 의뢰인들의 눈빛에는 공통된 공포가 서려 있었다. 항구에서 들려오는 기이한 소문들, 레드 훅의 어두운 골목에서 벌어지는 의문의 사건들, 그리고 금고 안에서 발견된 끔찍한 것들... 경찰은 집단 히스테리라며 무시했지만, 내 직감은 다르게 말하고 있다.

특히 최근 들어 항구 근처에서 이상한 일들이 벌어지고 있다는 소문이 끊이지 않는다. 어떤 선원이 남태평양의 외딴 섬에서 돌아온 후 정신이 나갔다는 이야기, 그리고 그가 남긴 일기장에 적힌 기괴한 기록들... 누군가는 그것이 단순한 환상이라고 하지만, 나는 알고 있다. 그곳에 무언가가 있다는 것을.

이 도시의 현실과 광기의 경계가 무너지고 있다. '위대한 옛것들'을 숭배하는 광신도들이 어둠 속에서 움직이기 시작했다. 그리고 그들이 기다리는 것은... 크툴루의 부름이다.

나는 책상 위에 놓인 장비들을 점검했다. 어둠을 밝혀줄 손전등, 그리고 최악의 상황에서 나를 지켜줄 권총 한 자루. 이것들이 내년 한 해 동안 나의 유일한 벗이 될 것이다.

내일, 1월 1일이 밝는 대로 나는 거리로 나갈 것이다. 매일 아캄의 골목을 뒤지고, 금지된 장소를 수색하여 놈들의 흔적을 찾아내야 한다. 쉽지 않은 싸움이 될 것이다. 때로는 도망쳐야 할 것이고, 때로는 내 이성이 버티지 못하고 광기에 잠식될지도 모른다.

하지만 누군가는 해야만 한다. 놈들이 이 세상을 완전히 삼키기 전에 진실을 밝혀내야 한다. 이 일기장이 나의 유서가 되지 않기를 바라며.

이제, 긴 밤이 지나고 날이 밝으면... 사냥을 시작한다."""
        
    elif year == 1931:
        prologue_date = "1930-12-31"
        prologue_text = """날짜: 1930년 12월 31일 장소: 매사추세츠주 아캄(Arkham), 탐정 사무소

거리에서는 폭죽 소리가 들려온다. 사람들은 다가올 1931년이 희망으로 가득 찰 것이라 떠들며 축배를 들고 있다. 어리석은 자들. 그들은 아캄의 짙은 안개 속에 무엇이 도사리고 있는지 전혀 모른다.

나는 창밖으로 비치는 낡은 건물들의 그림자를 내려다본다. 최근 내 사무실을 찾아온 의뢰인들의 눈빛에는 공통된 공포가 서려 있었다. 해안가 마을 인스머스에서 들려오는 기이한 소문들, 사람들이 사라지는 해안 도시의 비밀, 그리고 그곳에서 돌아온 자들의 기괴한 변화... 경찰은 집단 히스테리라며 무시했지만, 내 직감은 다르게 말하고 있다.

특히 최근 들어 인스머스라는 작은 해안 마을에 대한 소문이 끊이지 않는다. 그곳의 주민들은 이상한 특징을 가지고 있고, 밤이 되면 해안가에서 무언가를 숭배한다는 이야기. 그리고 그들이 섬기고 있다는 존재... 딥 원스(Deep Ones). 누군가는 그것이 단순한 미신이라고 하지만, 나는 알고 있다. 그곳에 무언가가 있다는 것을.

이 도시의 현실과 광기의 경계가 무너지고 있다. 고대의 존재들이 인간과 교류하고 있으며, 그들의 영향력이 점점 확장되고 있다. 그리고 그들이 기다리는 것은... 인류의 종말이다.

나는 책상 위에 놓인 장비들을 점검했다. 어둠을 밝혀줄 손전등, 그리고 최악의 상황에서 나를 지켜줄 권총 한 자루. 이것들이 내년 한 해 동안 나의 유일한 벗이 될 것이다.

내일, 1월 1일이 밝는 대로 나는 거리로 나갈 것이다. 매일 아캄의 골목을 뒤지고, 금지된 장소를 수색하여 놈들의 흔적을 찾아내야 한다. 쉽지 않은 싸움이 될 것이다. 때로는 도망쳐야 할 것이고, 때로는 내 이성이 버티지 못하고 광기에 잠식될지도 모른다.

하지만 누군가는 해야만 한다. 놈들이 이 세상을 완전히 삼키기 전에 진실을 밝혀내야 한다. 이 일기장이 나의 유서가 되지 않기를 바라며.

이제, 긴 밤이 지나고 날이 밝으면... 사냥을 시작한다."""
    else:
        # 기본값 (1925년)
        return generate_prologue(1925)
    
    return prologue_text, prologue_date


def initialize_new_game(campaign_year: int = 1925) -> Dict[str, Any]:
    """
    새 게임 초기화 (프롤로그 포함)
    
    Args:
        campaign_year: 캠페인 연도 (1925 또는 1931)
        
    Returns:
        초기화된 게임 데이터 구조
    """
    prologue_text, prologue_date = generate_prologue(campaign_year)
    start_date = f"{campaign_year}-01-01"

    return {
        "save_file_info": {
            "player_name": "John Miller",
            "campaign_year": campaign_year,
            "last_played": datetime.now().isoformat()
        },
        "current_state": {
            "description": "게임 플레이 중 실시간으로 변동되는 데이터입니다.",
            "today_date": start_date,
            "madness_tracker": {
                "current_level": 0,
                "description": "이번 달에 누적된 광기 수치 (매월 초 0으로 초기화됨)"
            },
            "weekly_progress": {
                "current_week_number": 1,
                "success_count": 0,
                "description": "일요일 특별 조우 난이도 차감을 위해 이번 주(월~토) 성공 횟수를 추적",
                "completed_days_in_week": []
            }
        },
        "legacy_inventory": {
            "description": "달력이 넘어갈 때마다 추가되어 연말까지 유지되는 요소들",
            "active_rules": [],
            "collected_artifacts": [],
            "weekly_records": []
        },
        "campaign_history": {
            "description": "지나간 에피소드들의 요약 및 상세 기록",
            "monthly_chapters": [],
            "prologue": {
                "date": prologue_date,
                "content": prologue_text,
                "is_finalized": True
            }
        }
    }


def get_current_month_chapter(data: Dict[str, Any], month_name: str) -> Optional[Dict[str, Any]]:
    """
    현재 월의 챕터 데이터 가져오기 (없으면 생성)
    
    Args:
        data: 게임 데이터
        month_name: 월 이름 (예: "January")
        
    Returns:
        월간 챕터 딕셔너리
    """
    if "campaign_history" not in data:
        data["campaign_history"] = {"monthly_chapters": []}
    
    chapters = data["campaign_history"].get("monthly_chapters", [])
    
    # 기존 챕터 찾기
    for chapter in chapters:
        if chapter.get("month") == month_name:
            return chapter
    
    # 새 챕터 생성
    new_chapter = {
        "month": month_name,
        "is_completed": False,
        "monthly_score": 0,
        "monthly_madness": 0,
        "description": "일요일 조우 성공(+5점) - 광기 만료(-5점) 계산 결과",
        "chapter_summary": "",
        "daily_entries": []
    }
    
    chapters.append(new_chapter)
    data["campaign_history"]["monthly_chapters"] = chapters
    
    return new_chapter


def add_daily_entry(
    data: Dict[str, Any],
    date_str: str,
    day_of_week: str,
    target_encounter: Dict[str, Any],
    outcome: Dict[str, Any],
    narrative_text: str,
    summary_line: str = "",
    is_finalized: bool = True
) -> bool:
    """
    일일 엔트리 추가
    
    Args:
        data: 게임 데이터
        date_str: 날짜 문자열 (예: "1926-01-01")
        day_of_week: 요일 (예: "Thursday")
        target_encounter: 조우 대상 정보
        outcome: 결과 정보
        narrative_text: 생성된 스토리 텍스트
        summary_line: 요약 줄
        is_finalized: 작성 완료 여부
        
    Returns:
        추가 성공 여부
    """
    # 월 이름 추출 (예: "1926-01-01" -> "January")
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        month_name = date_obj.strftime("%B")
    except ValueError:
        # 날짜 파싱 실패 시 현재 날짜 사용
        date_obj = datetime.now()
        month_name = date_obj.strftime("%B")
    
    chapter = get_current_month_chapter(data, month_name)
    
    entry = {
        "diary_write_date": date_str,
        "day_of_week": day_of_week,
        "is_finalized": is_finalized,
        "game_logic_snapshot": {
            "target_date": target_encounter.get("target_date", ""),  # 타겟 조우 날짜
            "target_name": target_encounter.get("visual_desc", ""),
            "action_type": target_encounter.get("action_type", ""),
            "dice_result": {
                "sum": outcome.get("black_dice_sum", 0),
                "symbols": target_encounter.get("symbols", [])
            },
            "is_success": outcome.get("is_success", False),
            "madness_triggered": outcome.get("madness_triggered", False),
            "cthulhu_symbol_count": outcome.get("cthulhu_symbol_count", 0)
        },
        "ai_generated_content": {
            "content_id": f"{date_str}-{datetime.now().timestamp()}",
            "generated_at": datetime.now().isoformat(),
            "main_text": narrative_text,
            "tone_tag": "Madness" if outcome.get("madness_triggered") else ("Success" if outcome.get("is_success") else "Failure"),
            "summary_line": summary_line or narrative_text[:50] + "..." if len(narrative_text) > 50 else narrative_text,
            "prompt_snapshot": ""  # 필요시 저장
        }
    }
    
    chapter["daily_entries"].append(entry)
    return True


def add_weekly_summary(
    data: Dict[str, Any],
    week_number: int,
    week_start_date: date,
    week_end_date: date,
    sunday_encounter: Dict[str, Any],
    key_encounters: List[Dict[str, Any]],
    weekly_summary_text: str = ""
) -> bool:
    """
    주차별 요약 데이터를 legacy_inventory.weekly_records에 저장
    
    Args:
        data: 게임 데이터
        week_number: 주차 번호 (1, 2, ..., 52)
        week_start_date: 주의 시작 날짜 (월요일)
        week_end_date: 주의 종료 날짜 (일요일)
        sunday_encounter: 일요일 조우 결과 딕셔너리
        key_encounters: 그 주의 주요 조우 목록
        weekly_summary_text: 주간 요약 텍스트 (선택사항)
        
    Returns:
        저장 성공 여부
    """
    if "legacy_inventory" not in data:
        data["legacy_inventory"] = {
            "description": "달력이 넘어갈 때마다 추가되어 연말까지 유지되는 요소들",
            "active_rules": [],
            "collected_artifacts": [],
            "weekly_records": []
        }
    
    legacy_inventory = data["legacy_inventory"]
    if "weekly_records" not in legacy_inventory:
        legacy_inventory["weekly_records"] = []
    
    weekly_record = {
        "week_number": week_number,
        "week_start_date": week_start_date.strftime("%Y-%m-%d"),
        "week_end_date": week_end_date.strftime("%Y-%m-%d"),
        "sunday_encounter": sunday_encounter,
        "key_encounters": key_encounters,
        "weekly_summary": weekly_summary_text
    }
    
    legacy_inventory["weekly_records"].append(weekly_record)
    return True

