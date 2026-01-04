from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import random
import json
import os
from app.models.game_models import (
    GameState, EncounterTarget, DiceRoll, DailyStoryContext, ActionType
)
from app.models.narrative_models import NarrativeMemory, EncounterSummary
from app.services import game_logic
from app.services import llm_service
from app.services import storage_service

router = APIRouter(prefix="/api/game", tags=["game"])


class StartGameRequest(BaseModel):
    player_name: Optional[str] = "John Miller"
    # campaign_year는 더 이상 사용하지 않음 (항상 1925)


class EncounterRequest(BaseModel):
    target_date: str  # "1926-01-01"
    visual_description: str
    required_symbol: str  # "COMBAT", "INVESTIGATION", "SEARCH"
    base_difficulty: int
    black_dice_sum: int
    green_dice_symbols: List[str]  # ["COMBAT", "SEARCH"]
    cthulhu_symbol_count: int = 0  # 크툴루 기호 개수 (0~3)
    is_forced_failure: bool = False  # 강제 실패 플래그
    game_data: Optional[Dict[str, Any]] = None  # 클라이언트에서 게임 데이터 전달


class MonthEndRequest(BaseModel):
    new_rules_unlocked: List[str] = []
    story_revelation: str = ""
    game_data: Optional[Dict[str, Any]] = None  # 클라이언트에서 게임 데이터 전달


class MonthStartRequest(BaseModel):
    new_rules_unlocked: List[str] = []
    story_revelation: str = ""
    game_data: Optional[Dict[str, Any]] = None  # 클라이언트에서 게임 데이터 전달


class MonthConclusionRequest(BaseModel):
    month: str  # "January"
    game_data: Optional[Dict[str, Any]] = None  # 클라이언트에서 게임 데이터 전달


@router.post("/start")
async def start_game(request: StartGameRequest):
    """새 게임 시작 (프롤로그 반환) - 항상 1925년으로 생성"""
    # 연도는 항상 1925로 고정
    campaign_year = 1925
    
    # AI로 프롤로그 생성
    from app.services import llm_service
    ai_prologue = await llm_service.generate_prologue(campaign_year)
    
    # 게임 데이터 초기화
    data = storage_service.initialize_new_game(campaign_year=campaign_year)
    if request.player_name:
        data["save_file_info"]["player_name"] = request.player_name
    
    # AI 생성 프롤로그로 교체
    prologue_date = f"{campaign_year - 1}-12-31"
    data["campaign_history"]["prologue"]["content"] = ai_prologue
    data["campaign_history"]["prologue"]["date"] = prologue_date
    data["campaign_history"]["prologue"]["is_finalized"] = True  # LLM이 생성했으므로 완료 상태로 설정
    
    # 클라이언트에서 저장하도록 전체 게임 데이터 반환
    return {
        "success": True,
        "prologue": ai_prologue,
        "game_state": data["current_state"],
        "campaign_year": campaign_year,
        "game_data": data  # 클라이언트에서 저장할 전체 데이터 (프롤로그 포함)
    }


@router.get("/state")
async def get_game_state_get():
    """현재 게임 상태 조회 (GET - 클라이언트에서 저장된 데이터 사용)"""
    # GET 요청의 경우 클라이언트에서 저장된 데이터를 사용하도록 빈 응답 반환
    # 또는 기본값 반환
    return {
        "success": True,
        "game_state": {
            "today_date": "1925-01-01",
            "madness_tracker": {"current_level": 0},
            "weekly_progress": {"success_count": 0, "completed_days_in_week": []}
        },
        "legacy_inventory": {},
        "campaign_year": 1925
    }


@router.post("/state")
async def get_game_state(request: Optional[Dict[str, Any]] = None):
    """현재 게임 상태 조회 (POST - 클라이언트에서 게임 데이터 전달)"""
    # 요청에서 게임 데이터 받기 (없으면 빈 데이터)
    if request and "game_data" in request:
        data = request["game_data"]
    else:
        # 호환성을 위해 빈 게임 데이터 반환
        return {
            "success": True,
            "game_state": {
                "today_date": "1925-01-01",
                "madness_tracker": {"current_level": 0},
                "weekly_progress": {"success_count": 0, "completed_days_in_week": []}
            },
            "legacy_inventory": {},
            "campaign_year": 1925
        }
    
    # 일기를 쓰지 않은 가장 최근 날짜 계산
    campaign_year = data.get("save_file_info", {}).get("campaign_year", 1925)
    start_date = f"{campaign_year}-01-01"
    
    # 모든 일기 날짜 수집
    written_dates = set()
    chapters = data.get("campaign_history", {}).get("monthly_chapters", [])
    for chapter in chapters:
        for entry in chapter.get("daily_entries", []):
            written_dates.add(entry.get("diary_write_date"))
    
    # 일기를 쓰지 않은 가장 최근 날짜 찾기
    try:
        from datetime import timedelta
        current_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
        
        # 일기를 쓰지 않은 가장 최근 날짜 찾기
        last_written_date = None
        if written_dates:
            written_dates_sorted = sorted([datetime.strptime(d, "%Y-%m-%d").date() for d in written_dates])
            last_written_date = written_dates_sorted[-1]
        
        # 일기를 쓰지 않은 가장 최근 날짜 계산
        # 게임 내 시간은 게임 진행에 따라만 흘러가므로, 마지막 일기 다음 날을 사용
        if last_written_date:
            # 마지막 일기 다음 날이 현재 날짜
            current_date = last_written_date + timedelta(days=1)
        else:
            # 일기가 없으면 시작 날짜 사용
            current_date = current_date_obj
        
        # 현재 상태 업데이트
        current_state = data.get("current_state", {})
        current_state["today_date"] = current_date.strftime("%Y-%m-%d")
        
        # 주간 초기화 상태 검증 (월요일이고 이전 주가 끝났는지 확인)
        if current_date.weekday() == 0:  # 월요일
            # 주간 진행 상황이 초기화되어 있는지 확인
            weekly_progress = current_state.get("weekly_progress", {})
            if weekly_progress.get("success_count", 0) != 0 or weekly_progress.get("completed_days_in_week", []):
                # 월요일인데 주간 진행 상황이 초기화되지 않은 경우 초기화
                weekly_progress["success_count"] = 0
                weekly_progress["completed_days_in_week"] = []
                current_state["weekly_progress"] = weekly_progress
    except Exception as e:
        print(f"현재 날짜 계산 실패: {e}")
        current_state = data.get("current_state", {})
    
    return {
        "success": True,
        "game_state": current_state,
        "legacy_inventory": data.get("legacy_inventory", {}),
        "campaign_year": campaign_year
    }


@router.post("/encounter")
async def process_encounter(request: EncounterRequest):
    """조우 처리 (주사위 결과 입력, 스토리 생성)"""
    # 클라이언트에서 게임 데이터 받기
    if not request.game_data:
        raise HTTPException(status_code=400, detail="game_data가 필요합니다.")
    data = request.game_data
    
    # 현재 상태 로드
    current_state = data.get("current_state", {})
    today_date_str = current_state.get("today_date", "1926-01-01")
    
    try:
        target_date_obj = datetime.strptime(request.target_date, "%Y-%m-%d").date()
        current_date_obj = datetime.strptime(today_date_str, "%Y-%m-%d").date()
        
        # 오늘 날짜는 일기를 쓰지 않은 가장 최근 날짜로 계산되므로 여기서는 업데이트하지 않음
        # (get_game_state에서 계산됨)
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다.")
    
    # 강제 실패가 아닌 경우에만 현재 주 확인
    if not request.is_forced_failure:
        # 현재 주에 속하는지 확인
        if not game_logic.is_date_in_current_week(target_date_obj, current_date_obj):
            raise HTTPException(status_code=400, detail="선택한 날짜가 현재 주에 속하지 않습니다.")
    
    # ActionType 변환
    try:
        action_type = ActionType[request.required_symbol]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"알 수 없는 행동 유형: {request.required_symbol}")
    
    green_symbols = [ActionType[s] for s in request.green_dice_symbols]
    
    # 모델 생성
    game_state = GameState(
        current_date=current_date_obj,
        madness_level=current_state.get("madness_tracker", {}).get("current_level", 0),
        weekly_success_count=current_state.get("weekly_progress", {}).get("success_count", 0),
        acquired_artifacts=data.get("legacy_inventory", {}).get("collected_artifacts", [])
    )
    
    is_sunday_boss = game_logic.is_sunday(target_date_obj)
    
    target = EncounterTarget(
        target_date=target_date_obj,
        visual_description=request.visual_description,
        required_symbol=action_type,
        base_difficulty=request.base_difficulty,
        is_sunday_boss=is_sunday_boss
    )
    
    dice_roll = DiceRoll(
        black_dice_sum=request.black_dice_sum,
        green_dice_symbols=green_symbols,
        cthulhu_symbol_count=request.cthulhu_symbol_count
    )
    
    context = DailyStoryContext(
        state=game_state,
        target=target,
        roll=dice_roll
    )
    
    # 게임 로직 처리
    outcome = game_logic.calculate_outcome(context)
    
    # 강제 실패인 경우 결과를 실패로 강제 설정
    if request.is_forced_failure:
        outcome["is_success"] = False
        outcome["number_match"] = False
        outcome["symbol_match"] = False
    
    # 주간/월간 초기화 체크 (광기 업데이트 전에 실행)
    game_state = game_logic.reset_weekly_progress(game_state, current_date_obj)
    game_state = game_logic.reset_monthly_madness(game_state, current_date_obj)
    
    # 광기 업데이트 (초기화 후에 실행)
    if outcome["madness_triggered"]:
        game_state = game_logic.update_madness(game_state, request.cthulhu_symbol_count)
    
    # 주간 성공 횟수 업데이트
    if outcome["is_success"]:
        game_state = game_logic.update_weekly_success(game_state, True)
    
    # 내러티브 메모리 구성
    weekly_log = []
    last_entry_snippet = None
    
    # 현재 월의 챕터에서 주간 로그 구성
    try:
        month_name = target_date_obj.strftime("%B")
        chapter = storage_service.get_current_month_chapter(data, month_name)
        daily_entries = chapter.get("daily_entries", [])
        
        # 이번 주의 엔트리만 필터링
        week_start = game_logic.get_week_start(current_date_obj)
        for entry in daily_entries:
            entry_date = datetime.strptime(entry["diary_write_date"], "%Y-%m-%d").date()
            if week_start <= entry_date <= current_date_obj:
                summary = EncounterSummary(
                    date=entry["diary_write_date"],
                    target_name=entry["game_logic_snapshot"]["target_name"],
                    outcome="성공" if entry["game_logic_snapshot"]["is_success"] else "실패",
                    key_narrative=entry["ai_generated_content"].get("summary_line", "")
                )
                weekly_log.append(summary)
        
        # 마지막 엔트리 스니펫
        if daily_entries:
            last_entry = daily_entries[-1]
            main_text = last_entry["ai_generated_content"].get("main_text", "")
            if main_text:
                # 마지막 문장 추출 (간단히)
                sentences = main_text.split(".")
                if sentences:
                    last_entry_snippet = sentences[-1].strip() + "."
    except Exception as e:
        print(f"내러티브 메모리 구성 중 오류: {e}")
    
    # 당월 주간 요약 추출
    current_month_weekly_summaries = []
    try:
        weekly_records = data.get("legacy_inventory", {}).get("weekly_records", [])
        for weekly_record in weekly_records:
            week_end_date_str = weekly_record.get("week_end_date", "")
            if week_end_date_str:
                week_end_date_obj = datetime.strptime(week_end_date_str, "%Y-%m-%d").date()
                # 현재 날짜와 같은 월/년도인지 확인
                if week_end_date_obj.year == current_date_obj.year and week_end_date_obj.month == current_date_obj.month:
                    # summary_line과 weekly_summary를 결합하여 추가
                    sunday_encounter = weekly_record.get("sunday_encounter", {})
                    summary_line = sunday_encounter.get("summary_line", "")
                    weekly_summary = weekly_record.get("weekly_summary", "")
                    
                    # 두 정보를 결합하여 하나의 요약으로 생성
                    if summary_line and weekly_summary:
                        combined_summary = f"{weekly_summary} 일요일 조우: {summary_line}"
                    elif summary_line:
                        combined_summary = f"일요일 조우: {summary_line}"
                    elif weekly_summary:
                        combined_summary = weekly_summary
                    else:
                        combined_summary = f"주 {weekly_record.get('week_number', '?')} 기록"
                    
                    current_month_weekly_summaries.append(combined_summary)
    except Exception as e:
        print(f"당월 주간 요약 추출 중 오류: {e}")
    
    memory = NarrativeMemory(
        weekly_log=weekly_log,
        last_entry_snippet=last_entry_snippet,
        active_artifacts=data.get("legacy_inventory", {}).get("collected_artifacts", []),
        major_events=[],
        current_month_weekly_summaries=current_month_weekly_summaries,
        monthly_summaries=[]  # monthly_records 대신 chapter_summary 사용
    )
    
    # 캠페인 연도 가져오기
    campaign_year = data.get("save_file_info", {}).get("campaign_year", 1925)
    
    # 성공률 계산 (해당 월 기준)
    sunday_success_count = 0
    sunday_total_count = 0
    overall_success_count = 0
    overall_total_count = 0
    
    try:
        month_name = target_date_obj.strftime("%B")
        chapter = storage_service.get_current_month_chapter(data, month_name)
        daily_entries = chapter.get("daily_entries", [])
        
        # 전체 조우 성공률 계산
        for entry in daily_entries:
            entry_date = datetime.strptime(entry["diary_write_date"], "%Y-%m-%d").date()
            if entry_date.year == current_date_obj.year and entry_date.month == current_date_obj.month:
                overall_total_count += 1
                if entry["game_logic_snapshot"].get("is_success", False):
                    overall_success_count += 1
                
                # 일요일 조우 성공률 계산
                if entry.get("day_of_week") == "Sunday":
                    sunday_total_count += 1
                    if entry["game_logic_snapshot"].get("is_success", False):
                        sunday_success_count += 1
        
        # weekly_records에서도 일요일 조우 확인
        weekly_records = data.get("legacy_inventory", {}).get("weekly_records", [])
        for weekly_record in weekly_records:
            week_end_date_str = weekly_record.get("week_end_date", "")
            if week_end_date_str:
                week_end_date_obj = datetime.strptime(week_end_date_str, "%Y-%m-%d").date()
                if week_end_date_obj.year == current_date_obj.year and week_end_date_obj.month == current_date_obj.month:
                    sunday_enc = weekly_record.get("sunday_encounter", {})
                    if sunday_enc:
                        # daily_entries에 이미 집계된 경우 중복 제거
                        already_counted = False
                        for entry in daily_entries:
                            entry_date = datetime.strptime(entry["diary_write_date"], "%Y-%m-%d").date()
                            if entry.get("day_of_week") == "Sunday" and entry_date == week_end_date_obj:
                                already_counted = True
                                break
                        if not already_counted:
                            sunday_total_count += 1
                            if sunday_enc.get("is_success", False):
                                sunday_success_count += 1
    except Exception as e:
        print(f"성공률 계산 중 오류: {e}")
    
    # 성공률 계산 (0으로 나누기 방지)
    sunday_success_rate = sunday_success_count / sunday_total_count if sunday_total_count > 0 else 0.0
    overall_success_rate = overall_success_count / overall_total_count if overall_total_count > 0 else 0.0
    
    # 스토리 생성
    narrative_text = await llm_service.generate_daily_story(
        context, 
        memory, 
        campaign_year,
        sunday_success_rate=sunday_success_rate,
        overall_success_rate=overall_success_rate,
        sunday_total_count=sunday_total_count
    )
    summary_line = await llm_service.generate_summary_line(narrative_text)
    
    # 일기 작성 날짜 결정
    # today_date는 일기를 쓰지 않은 가장 최근 날짜이므로, 이를 일기 작성 날짜로 사용
    # target_date는 일기 작성 날짜 결정에 영향을 주지 않음
    today_date_str = data.get("current_state", {}).get("today_date", target_date_obj.strftime("%Y-%m-%d"))
    today_date_obj = datetime.strptime(today_date_str, "%Y-%m-%d").date()
    
    # today_date를 일기 작성 날짜로 사용
    diary_write_date_obj = today_date_obj
    diary_write_date_str = diary_write_date_obj.strftime("%Y-%m-%d")
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    diary_write_day_of_week = day_names[diary_write_date_obj.weekday()]
    
    # visual_description 초기값 설정
    visual_description = request.visual_description
    
    # 조우 실패 시, 이전에 해결하지 못한 조우의 target_name을 무작위로 선택
    if not outcome["is_success"]:
        try:
            # weekly_records의 모든 주차에서 실패한 조우 수집
            failed_encounters = []
            weekly_records = data.get("legacy_inventory", {}).get("weekly_records", [])
            
            for weekly_record in weekly_records:
                key_encounters = weekly_record.get("key_encounters", [])
                for encounter in key_encounters:
                    # outcome이 "실패"이고, target_name이 "선택되지 않은 조우"가 아닌 경우만 수집
                    if (encounter.get("outcome") == "실패" and 
                        encounter.get("target_name") and 
                        encounter.get("target_name") != "선택되지 않은 조우"):
                        failed_encounters.append(encounter.get("target_name"))
            
            # 실패한 조우가 있으면 무작위로 하나 선택
            if failed_encounters:
                visual_description = random.choice(failed_encounters)
                print(f"실패 조우 무작위 선택: {visual_description} (후보 {len(failed_encounters)}개 중)")
        except Exception as e:
            print(f"실패 조우 선택 중 오류: {e}")
            # 오류 발생 시 기존 로직 유지
    
    # 일요일 조우인 경우, 실패하더라도 target_name이 올바르게 설정되도록 보장
    # 일요일 조우는 항상 target_date를 기반으로 daily_encounter_data에서 올바른 조우 정보를 가져옴
    if is_sunday_boss:
        # 일요일 조우인 경우, target_date를 기반으로 조우 데이터에서 찾기
        try:
            game_data_path = os.path.join("data", "daily_encounter_data_1.json")
            if os.path.exists(game_data_path):
                with open(game_data_path, "r", encoding="utf-8") as f:
                    encounter_data = json.load(f)
                    # target_date에서 월일 추출 (MM-DD 형식)
                    month_day = target_date_obj.strftime("%m-%d")
                    encounter = encounter_data.get("encounters", {}).get(month_day)
                    if encounter:
                        # 일요일 조우는 항상 daily_encounter_data에서 가져온 값을 사용
                        visual_description = encounter.get("visual_description", request.visual_description)
                    elif not visual_description or visual_description == "선택되지 않은 조우":
                        # 조우 데이터가 없고 visual_description도 없으면 원래 값 유지
                        pass
            elif not visual_description or visual_description == "선택되지 않은 조우":
                # 파일이 없고 visual_description도 없으면 원래 값 유지
                pass
        except Exception as e:
            print(f"일요일 조우 데이터 로드 실패: {e}")
            # 실패 시 visual_description이 비어있거나 기본값이 아니면 원래 값 유지
            if not visual_description or visual_description == "선택되지 않은 조우":
                # 에러 발생 시에도 기본값이면 원래 값 유지
                pass
    
    target_encounter_dict = {
        "visual_desc": visual_description,
        "action_type": request.required_symbol,
        "base_difficulty": request.base_difficulty,
        "symbols": request.green_dice_symbols,
        "target_date": request.target_date  # 타겟 조우 날짜
    }
    
    outcome_dict = {
        "is_success": outcome["is_success"],
        "madness_triggered": outcome["madness_triggered"],
        "black_dice_sum": request.black_dice_sum,
        "effective_difficulty": outcome["effective_difficulty"],
        "cthulhu_symbol_count": request.cthulhu_symbol_count
    }
    
    storage_service.add_daily_entry(
        data,
        diary_write_date_str,  # 일기 작성 날짜 (target_date와 today_date 중 더 큰 값)
        diary_write_day_of_week,  # 일기 작성 날짜의 요일
        target_encounter_dict,
        outcome_dict,
        narrative_text,
        summary_line
    )
    
    # 현재 상태 업데이트
    data["current_state"]["madness_tracker"]["current_level"] = game_state.madness_level
    data["current_state"]["weekly_progress"]["success_count"] = game_state.weekly_success_count
    
    # 일요일 조우 완료 후 주간 초기화 및 주간 요약 저장
    if game_logic.should_reset_weekly_progress(diary_write_date_obj):
        # 주간 번호 가져오기 (증가 전)
        current_week_number = data["current_state"]["weekly_progress"].get("current_week_number", 1)
        
        # 주의 시작/종료 날짜 계산
        week_start = game_logic.get_week_start(diary_write_date_obj)
        week_end = diary_write_date_obj
        
        # 일요일 조우 결과 추출 (실패하더라도 target_name이 올바르게 설정되도록 보장)
        sunday_target_name = visual_description  # 위에서 처리된 visual_description 사용
        sunday_encounter = {
            "date": diary_write_date_str,
            "target_name": sunday_target_name,  # 일요일 조우는 실패하더라도 올바른 target_name 사용
            "is_success": outcome["is_success"],
            "summary_line": summary_line,
            "main_text": narrative_text
        }
        
        # 그 주의 주요 조우 내용 수집 (weekly_log 활용)
        key_encounters = []
        for log_entry in weekly_log:
            key_encounters.append({
                "date": log_entry.date,
                "target_name": log_entry.target_name,
                "outcome": log_entry.outcome,
                "summary_line": log_entry.key_narrative
            })
        
        # 주간 요약 텍스트 생성 (간단한 요약)
        weekly_summary_text = f"{week_start.strftime('%Y년 %m월 %d일')}부터 {week_end.strftime('%m월 %d일')}까지의 주간 기록입니다. "
        if outcome["is_success"]:
            weekly_summary_text += f"일요일 조우에서 {sunday_target_name}을(를) 성공적으로 처리했습니다. "
        else:
            weekly_summary_text += f"일요일 조우에서 {sunday_target_name}을(를) 상대로 실패했습니다. "
        weekly_summary_text += f"이번 주 총 {len(key_encounters)}건의 조우가 있었습니다."
        
        # LLM으로 주간 상세 요약 생성
        campaign_year = data.get("save_file_info", {}).get("campaign_year", 1925)
        llm_weekly_summary = await llm_service.generate_weekly_summary(
            sunday_encounter,
            key_encounters,
            campaign_year
        )
        
        # 기존 요약 텍스트에 LLM 요약 추가
        final_weekly_summary = f"{weekly_summary_text}\n\n{llm_weekly_summary}"
        
        # 주간 요약 저장
        storage_service.add_weekly_summary(
            data,
            current_week_number,
            week_start,
            week_end,
            sunday_encounter,
            key_encounters,
            final_weekly_summary
        )
        
        # 주간 번호 증가
        data["current_state"]["weekly_progress"]["current_week_number"] = current_week_number + 1
        # 완료된 날짜 목록 초기화
        data["current_state"]["weekly_progress"]["completed_days_in_week"] = []
        # 성공 횟수는 이미 reset_weekly_progress에서 처리되었지만, 명시적으로 0으로 설정
        data["current_state"]["weekly_progress"]["success_count"] = 0
    else:
        # 일요일이 아닌 경우에만 completed_days_in_week에 추가
        if request.target_date not in data["current_state"]["weekly_progress"]["completed_days_in_week"]:
            data["current_state"]["weekly_progress"]["completed_days_in_week"].append(request.target_date)
    
    # 일기를 쓰지 않은 가장 최근 날짜로 업데이트
    # 일기 작성 후 다음 날짜로 이동
    # diary_write_date 기준으로 다음 날짜 계산
    # 게임 내 시간은 게임 진행에 따라만 흘러가므로, 일기 작성 날짜 + 1일만 사용
    from datetime import timedelta
    next_date = diary_write_date_obj + timedelta(days=1)
    data["current_state"]["today_date"] = next_date.strftime("%Y-%m-%d")
    
    # 클라이언트에서 저장하도록 업데이트된 전체 게임 데이터 반환
    return {
        "success": True,
        "outcome": outcome,
        "narrative": {
            "main_text": narrative_text,
            "summary_line": summary_line
        },
        "updated_state": {
            "madness_level": game_state.madness_level,
            "weekly_success_count": game_state.weekly_success_count
        },
        "game_data": data  # 클라이언트에서 저장할 전체 업데이트된 데이터
    }


@router.post("/month-end")
async def process_month_end(request: MonthEndRequest):
    """월말 처리 (점수 계산, 월간 요약 생성)"""
    # 클라이언트에서 게임 데이터 받기
    if not request.game_data:
        raise HTTPException(status_code=400, detail="game_data가 필요합니다.")
    data = request.game_data
    
    current_state = data.get("current_state", {})
    today_date_str = current_state.get("today_date", "1926-01-01")
    
    try:
        current_date_obj = datetime.strptime(today_date_str, "%Y-%m-%d").date()
        month_name = current_date_obj.strftime("%B")
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다.")
    
    chapter = storage_service.get_current_month_chapter(data, month_name)
    
    # 일요일 조우 성공 횟수 집계
    # weekly_records에서도 확인하되, 기존 daily_entries 방식도 유지 (호환성)
    sunday_success_count = 0
    bosses_defeated = []
    
    # weekly_records에서 해당 월의 일요일 조우 집계
    weekly_records = data.get("legacy_inventory", {}).get("weekly_records", [])
    for weekly_record in weekly_records:
        week_end_date = datetime.strptime(weekly_record["week_end_date"], "%Y-%m-%d").date()
        # 해당 월에 속하는 주차인지 확인
        if week_end_date.year == current_date_obj.year and week_end_date.month == current_date_obj.month:
            sunday_enc = weekly_record.get("sunday_encounter", {})
            if sunday_enc.get("is_success", False):
                sunday_success_count += 1
                bosses_defeated.append(sunday_enc.get("target_name", "알 수 없는 조우"))
    
    # 기존 방식도 유지 (weekly_records에 없는 경우를 대비)
    for entry in chapter.get("daily_entries", []):
        if entry.get("day_of_week") == "Sunday":
            entry_date = datetime.strptime(entry["diary_write_date"], "%Y-%m-%d").date()
            # weekly_records에 이미 집계된 경우 중복 제거
            already_counted = False
            for weekly_record in weekly_records:
                week_end_date = datetime.strptime(weekly_record["week_end_date"], "%Y-%m-%d").date()
                if week_end_date == entry_date and weekly_record.get("sunday_encounter", {}).get("is_success", False):
                    already_counted = True
                    break
            if not already_counted and entry["game_logic_snapshot"]["is_success"]:
                sunday_success_count += 1
                bosses_defeated.append(entry["game_logic_snapshot"]["target_name"])
    
    # 광기 게이지 만료 여부 확인
    madness_level = current_state.get("madness_tracker", {}).get("current_level", 0)
    madness_maxed_out = madness_level >= 10  # 예: 최대 10
    
    # 점수 계산
    monthly_score = game_logic.calculate_monthly_score(sunday_success_count, madness_maxed_out)
    
    # 월간 요약 생성
    chapter_data = {
        "month_name": f"1926년 {current_date_obj.month}월",
        "final_score": monthly_score,
        "bosses_defeated": bosses_defeated,
        "madness_state": "심각한 정신 착란" if madness_maxed_out else ("약간의 불안" if madness_level > 5 else "정상")
    }
    
    # 캠페인 연도 가져오기
    campaign_year = data.get("save_file_info", {}).get("campaign_year", 1925)
    
    chapter_summary = await llm_service.generate_monthly_summary(chapter_data, campaign_year)
    
    # 챕터 업데이트
    # is_completed는 month-conclusion에서 설정됨
    chapter["monthly_score"] = monthly_score
    chapter["chapter_summary"] = chapter_summary
    
    # 레거시 인벤토리 업데이트
    if request.new_rules_unlocked:
        legacy_inventory = data.get("legacy_inventory", {})
        active_rules = legacy_inventory.get("active_rules", [])
        for rule in request.new_rules_unlocked:
            active_rules.append({
                "id": f"rule_{month_name.lower()}_{len(active_rules)}",
                "name": rule,
                "effect_text": rule,
                "unlocked_month": month_name
            })
        legacy_inventory["active_rules"] = active_rules
        data["legacy_inventory"] = legacy_inventory
    
    # 클라이언트에서 저장하도록 업데이트된 전체 게임 데이터 반환
    return {
        "success": True,
        "monthly_score": monthly_score,
        "chapter_summary": chapter_summary,
        "bosses_defeated": bosses_defeated,
        "madness_state": chapter_data["madness_state"],
        "game_data": data  # 클라이언트에서 저장할 전체 업데이트된 데이터
    }


@router.post("/month-start")
async def process_month_start(request: MonthStartRequest):
    """새 달 시작 (레거시 업데이트 반영)"""
    # 클라이언트에서 게임 데이터 받기
    if not request.game_data:
        raise HTTPException(status_code=400, detail="game_data가 필요합니다.")
    data = request.game_data
    
    current_state = data.get("current_state", {})
    
    # 광기 수치 초기화는 month-conclusion에서 처리됨
    # 주간 진행 초기화
    current_state["weekly_progress"]["success_count"] = 0
    current_state["weekly_progress"]["completed_days_in_week"] = []
    
    data["current_state"] = current_state
    
    # 레거시 인벤토리 업데이트 (필요시)
    if request.new_rules_unlocked:
        legacy_inventory = data.get("legacy_inventory", {})
        collected_artifacts = legacy_inventory.get("collected_artifacts", [])
        collected_artifacts.extend(request.new_rules_unlocked)
        legacy_inventory["collected_artifacts"] = collected_artifacts
        data["legacy_inventory"] = legacy_inventory
    
    # 클라이언트에서 저장하도록 업데이트된 전체 게임 데이터 반환
    return {
        "success": True,
        "message": "새 달이 시작되었습니다.",
        "updated_state": current_state,
        "game_data": data  # 클라이언트에서 저장할 전체 업데이트된 데이터
    }


@router.post("/month-conclusion")
async def process_month_conclusion(request: MonthConclusionRequest):
    """월별 결산 처리 (LLM으로 결말 생성)"""
    # 클라이언트에서 게임 데이터 받기
    if not request.game_data:
        raise HTTPException(status_code=400, detail="game_data가 필요합니다.")
    data = request.game_data
    
    # 월 이름 정규화
    month_name = request.month.capitalize()
    
    # 캠페인 연도 가져오기
    campaign_year = data.get("save_file_info", {}).get("campaign_year", 1925)
    
    # 챕터 가져오기
    chapter = storage_service.get_current_month_chapter(data, month_name)
    daily_entries = chapter.get("daily_entries", [])
    
    if not daily_entries:
        raise HTTPException(status_code=400, detail="해당 월에 작성된 일기가 없습니다.")
    
    # 해당 월의 weekly_records 수집
    weekly_records = data.get("legacy_inventory", {}).get("weekly_records", [])
    month_weekly_records = []
    for weekly_record in weekly_records:
        week_end_date_str = weekly_record.get("week_end_date", "")
        if week_end_date_str:
            try:
                week_end_date = datetime.strptime(week_end_date_str, "%Y-%m-%d").date()
                # 월 이름을 숫자로 변환
                month_names = ["January", "February", "March", "April", "May", "June",
                              "July", "August", "September", "October", "November", "December"]
                month_number = month_names.index(month_name) + 1
                if week_end_date.year == campaign_year and week_end_date.month == month_number:
                    month_weekly_records.append(weekly_record)
            except (ValueError, IndexError):
                continue
    
    # 통계 정보 계산
    total_entries = len(daily_entries)
    success_count = sum(1 for entry in daily_entries if entry.get("game_logic_snapshot", {}).get("is_success", False))
    success_rate = (success_count / total_entries * 100) if total_entries > 0 else 0.0
    
    # 일요일 조우 통계
    sunday_entries = [e for e in daily_entries if e.get("day_of_week") == "Sunday"]
    sunday_success_count = sum(1 for entry in sunday_entries if entry.get("game_logic_snapshot", {}).get("is_success", False))
    sunday_success_rate = (sunday_success_count / len(sunday_entries) * 100) if sunday_entries else 0.0
    
    # 광기 통계
    total_madness = sum(entry.get("game_logic_snapshot", {}).get("cthulhu_symbol_count", 0) for entry in daily_entries)
    madness_triggered_count = sum(1 for entry in daily_entries if entry.get("game_logic_snapshot", {}).get("madness_triggered", False))
    
    # 월별 데이터 구성
    month_data = {
        "month_name": month_name,
        "campaign_year": campaign_year,
        "daily_entries": [
            {
                "date": entry.get("diary_write_date", ""),
                "day_of_week": entry.get("day_of_week", ""),
                "summary": entry.get("ai_generated_content", {}).get("summary_line", ""),
                "main_text": entry.get("ai_generated_content", {}).get("main_text", ""),
                "is_success": entry.get("game_logic_snapshot", {}).get("is_success", False),
                "madness_triggered": entry.get("game_logic_snapshot", {}).get("madness_triggered", False),
                "target_name": entry.get("game_logic_snapshot", {}).get("target_name", "")
            }
            for entry in daily_entries
        ],
        "weekly_summaries": [
            {
                "week_number": record.get("week_number", 0),
                "week_start_date": record.get("week_start_date", ""),
                "week_end_date": record.get("week_end_date", ""),
                "weekly_summary": record.get("weekly_summary", ""),
                "sunday_encounter": record.get("sunday_encounter", {})
            }
            for record in month_weekly_records
        ],
        "statistics": {
            "total_entries": total_entries,
            "success_count": success_count,
            "success_rate": round(success_rate, 1),
            "sunday_success_count": sunday_success_count,
            "sunday_total_count": len(sunday_entries),
            "sunday_success_rate": round(sunday_success_rate, 1),
            "total_madness": total_madness,
            "madness_triggered_count": madness_triggered_count
        }
    }
    
    # 일요일 조우 성공 횟수 집계 (점수 계산용)
    sunday_success_count = 0
    # weekly_records에서 해당 월의 일요일 조우 집계
    for weekly_record in month_weekly_records:
        sunday_enc = weekly_record.get("sunday_encounter", {})
        if sunday_enc.get("is_success", False):
            sunday_success_count += 1
    
    # daily_entries에서도 확인 (weekly_records에 없는 경우 대비)
    for entry in daily_entries:
        if entry.get("day_of_week") == "Sunday":
            entry_date_str = entry.get("diary_write_date", "")
            if entry_date_str:
                try:
                    entry_date = datetime.strptime(entry_date_str, "%Y-%m-%d").date()
                    # weekly_records에 이미 집계된 경우 중복 제거
                    already_counted = False
                    for weekly_record in month_weekly_records:
                        week_end_date = datetime.strptime(weekly_record["week_end_date"], "%Y-%m-%d").date()
                        if week_end_date == entry_date and weekly_record.get("sunday_encounter", {}).get("is_success", False):
                            already_counted = True
                            break
                    if not already_counted and entry.get("game_logic_snapshot", {}).get("is_success", False):
                        sunday_success_count += 1
                except ValueError:
                    continue
    
    # 광기 게이지 만료 여부 확인
    current_state = data.get("current_state", {})
    madness_level = current_state.get("madness_tracker", {}).get("current_level", 0)
    madness_maxed_out = madness_level >= 10  # 최대 10
    
    # 점수 계산
    from app.services import game_logic
    monthly_score = game_logic.calculate_monthly_score(sunday_success_count, madness_maxed_out)
    
    # LLM으로 결말 생성
    conclusion_text = await llm_service.generate_monthly_conclusion(month_data, campaign_year)
    
    # 월간 광기 수치 저장 및 초기화
    chapter["monthly_madness"] = madness_level
    current_state["madness_tracker"]["current_level"] = 0
    current_state["madness_tracker"]["description"] = "이번 달에 누적된 광기 수치 (매월 초 0으로 초기화됨)"
    data["current_state"] = current_state
    
    # 챕터에 결말과 점수 저장
    chapter["monthly_conclusion"] = conclusion_text
    chapter["chapter_summary"] = conclusion_text  # chapter_summary에 영구 저장
    chapter["monthly_score"] = monthly_score  # 점수 저장
    chapter["is_completed"] = True  # 월의 말일 보고서 작성 시 완료 처리
    
    # 클라이언트에서 저장하도록 업데이트된 전체 게임 데이터 반환
    return {
        "success": True,
        "month": month_name,
        "conclusion": conclusion_text,
        "monthly_score": monthly_score,
        "game_data": data  # 클라이언트에서 저장할 전체 업데이트된 데이터
    }


@router.get("/encounter-data")
async def get_encounter_data():
    """daily_encounter_data.json 파일을 읽어서 조우 데이터 반환"""
    game_data_path = os.path.join("data", "daily_encounter_data.json")
    
    try:
        with open(game_data_path, "r", encoding="utf-8") as f:
            game_data = json.load(f)
        return {
            "success": True,
            "data": game_data
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="daily_encounter_data.json 파일을 찾을 수 없습니다.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="daily_encounter_data.json 파일 파싱 오류")

