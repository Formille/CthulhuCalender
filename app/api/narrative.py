from fastapi import APIRouter, HTTPException
from datetime import datetime
import calendar
from app.services import storage_service

router = APIRouter(prefix="/api/narrative", tags=["narrative"])


@router.get("/diary/{date}")
async def get_diary_entry(date: str):
    """특정 날짜 일기 조회"""
    data = storage_service.load_game_data()
    
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        month_name = date_obj.strftime("%B")
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다.")
    
    chapter = storage_service.get_current_month_chapter(data, month_name)
    
    # 해당 날짜의 엔트리 찾기
    for entry in chapter.get("daily_entries", []):
        if entry["diary_write_date"] == date:
            return {
                "success": True,
                "entry": entry
            }
    
    raise HTTPException(status_code=404, detail="해당 날짜의 일기를 찾을 수 없습니다.")


@router.get("/month/{month}")
async def get_month_diary(month: str):
    """월별 일기 목록"""
    data = storage_service.load_game_data()
    
    # 월 이름 정규화 (예: "january" -> "January")
    month_name = month.capitalize()
    
    chapter = storage_service.get_current_month_chapter(data, month_name)
    
    entries = []
    for entry in chapter.get("daily_entries", []):
        game_snapshot = entry.get("game_logic_snapshot", {})
        entries.append({
            "date": entry["diary_write_date"],  # 하위 호환성을 위해 유지
            "diary_write_date": entry["diary_write_date"],  # 일기장 화면에서 사용
            "day_of_week": entry.get("day_of_week", ""),
            "summary": entry["ai_generated_content"].get("summary_line", ""),
            "full_text": entry["ai_generated_content"].get("main_text", ""),
            "tone_tag": entry["ai_generated_content"].get("tone_tag", ""),
            "is_success": game_snapshot.get("is_success", False),
            "madness_triggered": game_snapshot.get("madness_triggered", False),
            "cthulhu_symbol_count": game_snapshot.get("cthulhu_symbol_count", 0),
            "action_type": game_snapshot.get("action_type", ""),
            "dice_sum": game_snapshot.get("dice_result", {}).get("sum", 0),
            "game_logic_snapshot": game_snapshot  # target_date 접근을 위해 전체 포함
        })
    
    return {
        "success": True,
        "month": month_name,
        "entries": entries,
        "chapter_summary": chapter.get("chapter_summary", "")
    }


@router.get("/chapter/{month}")
async def get_chapter_summary(month: str):
    """월간 챕터 요약 조회"""
    data = storage_service.load_game_data()
    
    month_name = month.capitalize()
    chapters = data.get("campaign_history", {}).get("monthly_chapters", [])
    
    for chapter in chapters:
        if chapter.get("month") == month_name:
            return {
                "success": True,
                "chapter": {
                    "month": chapter.get("month", ""),
                    "is_completed": chapter.get("is_completed", False),
                    "monthly_score": chapter.get("monthly_score", 0),
                    "chapter_summary": chapter.get("chapter_summary", ""),
                    "bosses_defeated": chapter.get("bosses_defeated", [])
                }
            }
    
    raise HTTPException(status_code=404, detail="해당 월의 챕터를 찾을 수 없습니다.")


@router.get("/all-chapters")
async def get_all_chapters():
    """모든 챕터 목록 조회 (프롤로그 포함)"""
    data = storage_service.load_game_data()
    
    chapters = data.get("campaign_history", {}).get("monthly_chapters", [])
    
    chapter_list = []
    
    # 프롤로그가 있으면 맨 앞에 추가
    prologue = data.get("campaign_history", {}).get("prologue", {})
    if prologue.get("content"):
        chapter_list.append({
            "month": "Prologue",
            "is_completed": True,
            "monthly_score": 0,
            "chapter_summary": "",
            "is_prologue": True,
            "prologue_date": prologue.get("date", "")
        })
    
    for chapter in chapters:
        chapter_list.append({
            "month": chapter.get("month", ""),
            "is_completed": chapter.get("is_completed", False),
            "monthly_score": chapter.get("monthly_score", 0),
            "chapter_summary": chapter.get("chapter_summary", ""),
            "is_prologue": False
        })
    
    return {
        "success": True,
        "chapters": chapter_list
    }


@router.get("/prologue")
async def get_prologue():
    """프롤로그 조회"""
    data = storage_service.load_game_data()
    
    prologue = data.get("campaign_history", {}).get("prologue", {})
    
    if not prologue.get("content"):
        raise HTTPException(status_code=404, detail="프롤로그를 찾을 수 없습니다.")
    
    return {
        "success": True,
        "prologue": {
            "date": prologue.get("date", ""),
            "content": prologue.get("content", ""),
            "is_finalized": prologue.get("is_finalized", True)
        }
    }


@router.get("/month/{month}/completion-status")
async def get_month_completion_status(month: str):
    """월별 완료 상태 확인"""
    data = storage_service.load_game_data()
    
    # 월 이름 정규화
    month_name = month.capitalize()
    
    # 캠페인 연도 가져오기
    campaign_year = data.get("save_file_info", {}).get("campaign_year", 1925)
    
    # 월 이름을 숫자로 변환 (January -> 1)
    month_names = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
    try:
        month_number = month_names.index(month_name) + 1
    except ValueError:
        raise HTTPException(status_code=400, detail="올바른 월 이름이 아닙니다.")
    
    # 해당 월의 전체 일수 계산
    days_in_month = calendar.monthrange(campaign_year, month_number)[1]
    
    # 챕터 가져오기
    chapter = storage_service.get_current_month_chapter(data, month_name)
    daily_entries = chapter.get("daily_entries", [])
    
    # 작성된 날짜 수집
    written_dates = set()
    for entry in daily_entries:
        date_str = entry.get("diary_write_date", "")
        if date_str:
            try:
                entry_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                # 해당 월에 속하는 날짜인지 확인
                if entry_date.year == campaign_year and entry_date.month == month_number:
                    written_dates.add(entry_date.day)
            except ValueError:
                continue
    
    # 완료 여부 확인
    is_completed = len(written_dates) == days_in_month
    
    return {
        "success": True,
        "month": month_name,
        "campaign_year": campaign_year,
        "is_completed": is_completed,
        "days_in_month": days_in_month,
        "written_days": len(written_dates),
        "written_dates": sorted(list(written_dates))
    }


@router.get("/report/{month}")
async def get_month_report(month: str):
    """월별 보고서 조회 (프롬프트 정보 및 통계)"""
    data = storage_service.load_game_data()
    
    # 월 이름 정규화
    month_name = month.capitalize()
    
    # 캠페인 연도 가져오기
    campaign_year = data.get("save_file_info", {}).get("campaign_year", 1925)
    
    # 챕터 가져오기
    chapter = storage_service.get_current_month_chapter(data, month_name)
    daily_entries = chapter.get("daily_entries", [])
    
    # 월 이름을 숫자로 변환
    month_names = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
    try:
        month_number = month_names.index(month_name) + 1
    except ValueError:
        raise HTTPException(status_code=400, detail="올바른 월 이름이 아닙니다.")
    
    # 해당 월의 전체 일수 계산
    days_in_month = calendar.monthrange(campaign_year, month_number)[1]
    
    # 통계 계산
    total_entries = len(daily_entries)
    success_count = 0
    failure_count = 0
    sunday_success_count = 0
    sunday_total_count = 0
    total_madness = 0
    madness_triggered_count = 0
    action_type_counts = {"COMBAT": 0, "INVESTIGATION": 0, "SEARCH": 0}
    
    # 일기별 상세 정보 수집
    report_entries = []
    for entry in daily_entries:
        game_snapshot = entry.get("game_logic_snapshot", {})
        ai_content = entry.get("ai_generated_content", {})
        
        entry_date_str = entry.get("diary_write_date", "")
        try:
            entry_date = datetime.strptime(entry_date_str, "%Y-%m-%d").date()
            day = entry_date.day
            day_of_week = entry.get("day_of_week", "")
            
            # 이야기 진행 정도 계산
            story_progress_ratio = day / days_in_month
            story_progress_percent = round(story_progress_ratio * 100, 1)
            story_progress_text = f"{day}/{days_in_month} ({story_progress_percent}%)"
            
            is_success = game_snapshot.get("is_success", False)
            if is_success:
                success_count += 1
            else:
                failure_count += 1
            
            # 일요일 조우 통계
            if day_of_week == "Sunday":
                sunday_total_count += 1
                if is_success:
                    sunday_success_count += 1
            
            # 광기 통계
            cthulhu_count = game_snapshot.get("cthulhu_symbol_count", 0)
            total_madness += cthulhu_count
            if game_snapshot.get("madness_triggered", False):
                madness_triggered_count += 1
            
            # 행동 유형 통계
            action_type = game_snapshot.get("action_type", "")
            if action_type in action_type_counts:
                action_type_counts[action_type] += 1
            
            # 광기 상태 텍스트 생성 (해당 시점의 광기 수치는 추정 불가하므로 현재 상태 사용)
            current_madness = data.get("current_state", {}).get("madness_tracker", {}).get("current_level", 0)
            madness_state_text = ""
            if current_madness >= 7:
                madness_state_text = f"심각한 정신 착란 (광기 수치: {current_madness}/10)"
            elif current_madness >= 5:
                madness_state_text = f"중간 광기 (광기 수치: {current_madness}/10)"
            elif current_madness >= 3:
                madness_state_text = f"약한 광기 (광기 수치: {current_madness}/10)"
            else:
                madness_state_text = f"정상 (광기 수치: {current_madness}/10)"
            
            # 프롬프트 정보 재구성
            prompt_info = {
                "situation": {
                    "diary_date": f"{campaign_year}년 {month_number}월 {day}일 ({day_of_week})",
                    "target": game_snapshot.get("target_name", ""),
                    "action": action_type,
                    "story_progress": story_progress_text
                },
                "result": {
                    "judgment": "성공" if is_success else "실패",
                    "cthulhu_symbol_count": cthulhu_count,
                    "madness_triggered": game_snapshot.get("madness_triggered", False),
                    "madness_increase": cthulhu_count if game_snapshot.get("madness_triggered", False) else 0,
                    "current_madness_level": current_madness,
                    "madness_state": madness_state_text
                },
                "dice_result": {
                    "black_dice_sum": game_snapshot.get("dice_result", {}).get("sum", 0),
                    "green_dice_symbols": game_snapshot.get("dice_result", {}).get("symbols", [])
                }
            }
            
            report_entries.append({
                "date": entry_date_str,
                "day": day,
                "day_of_week": day_of_week,
                "prompt_info": prompt_info,
                "summary": ai_content.get("summary_line", ""),
                "full_text": ai_content.get("main_text", "")
            })
        except ValueError:
            continue
    
    # 성공률 계산
    success_rate = (success_count / total_entries * 100) if total_entries > 0 else 0.0
    sunday_success_rate = (sunday_success_count / sunday_total_count * 100) if sunday_total_count > 0 else 0.0
    
    # 월별 점수 가져오기
    monthly_score = chapter.get("monthly_score", 0)
    
    # 전체 통계
    statistics = {
        "monthly_score": monthly_score,
        "total_entries": total_entries,
        "success_count": success_count,
        "failure_count": failure_count,
        "success_rate": round(success_rate, 1),
        "sunday_total_count": sunday_total_count,
        "sunday_success_count": sunday_success_count,
        "sunday_success_rate": round(sunday_success_rate, 1),
        "total_madness": total_madness,
        "madness_triggered_count": madness_triggered_count,
        "action_type_counts": action_type_counts,
        "days_in_month": days_in_month,
        "written_days": total_entries
    }
    
    return {
        "success": True,
        "month": month_name,
        "campaign_year": campaign_year,
        "statistics": statistics,
        "entries": report_entries
    }

