import os
import httpx
from typing import Optional
from dotenv import load_dotenv
from app.models.game_models import DailyStoryContext
from app.models.narrative_models import NarrativeMemory

load_dotenv()

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_MODEL = "mistral-large-latest"  # 또는 "mistral-small", "mistral-large"


def load_system_prompt(campaign_year: int = 1925) -> str:
    """
    시스템 프롬프트 파일 로드 (연도별)
    
    Args:
        campaign_year: 캠페인 연도 (1925 또는 1931)
        
    Returns:
        시스템 프롬프트 텍스트
    """
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "system_prompt.txt")
    
    # 기본 프롬프트 로드
    base_prompt = ""
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            base_prompt = f.read()
    except FileNotFoundError:
        base_prompt = """당신은 아컴의 탐정 존 밀러입니다. 러브크래프트 스타일의 호러 느와르 소설을 작성하세요."""
    
    # 연도별 배경 설명 추가
    if campaign_year == 1925:
        year_context = """
# 배경 설정 (1925년)
이 이야기는 크툴루의 부름(The Call of Cthulhu)의 세계관을 배경으로 합니다.
- 항구에서 들려오는 기이한 소문들, 어두운 골목에서 벌어지는 의문의 사건들
- 남태평양의 외딴 섬에서 돌아온 선원들의 정신 이상 사례
- 위대한 옛것을 숭배하는 광신도들의 음모
- 구스타프 요한센의 일기와 같은 선원들의 기록들이 중요한 단서가 될 수 있음
- 해양과 항구, 외딴 섬과 관련된 공포가 주요 테마
"""
    elif campaign_year == 1931:
        year_context = """
# 배경 설정 (1931년)
이 이야기는 인스머스의 그림자(The Shadow over Innsmouth)의 세계관을 배경으로 합니다.
- 해안가 마을 인스머스에서 들려오는 기이한 소문들
- 사람들이 사라지는 해안 도시의 비밀
- 딥 원스(Deep Ones)와 인간의 잡종에 대한 공포
- 해안가와 바다, 물속의 존재들이 주요 테마
- 인스머스의 주민들이 가진 기괴한 특징들
- 밤이 되면 해안가에서 벌어지는 의식들
"""
    else:
        year_context = ""
    
    return base_prompt + year_context


def load_monthly_conclusion_prompt(month_name: str) -> Optional[str]:
    """
    월별 결산 결말 프롬프트 파일 로드
    
    Args:
        month_name: 월 이름 (예: "January", "February")
        
    Returns:
        해당 월의 결산 결말 지시사항 또는 None (없는 경우)
    """
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "monthly_conclusion_prompts.txt")
    
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        # 주석과 빈 줄 제거
        for line in lines:
            line = line.strip()
            # 주석 건너뛰기
            if line.startswith("#") or not line:
                continue
            
            # "월이름: 내용" 형식 파싱
            if ":" in line:
                parts = line.split(":", 1)
                if len(parts) == 2:
                    month = parts[0].strip()
                    content = parts[1].strip()
                    if month == month_name:
                        return content
        
        return None
    except FileNotFoundError:
        return None


async def call_mistral_api(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 8192
) -> Optional[str]:
    """
    Mistral API 호출
    
    Args:
        system_prompt: 시스템 프롬프트
        user_prompt: 사용자 프롬프트
        max_tokens: 최대 토큰 수
        
    Returns:
        생성된 텍스트 또는 None (실패 시)
    """
    if not MISTRAL_API_KEY:
        raise ValueError("MISTRAL_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {MISTRAL_API_KEY}"
    }

    payload = {
        "model": MISTRAL_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": 1.0
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(MISTRAL_API_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"]
            else:
                return None
    except httpx.HTTPError as e:
        print(f"Mistral API 호출 실패: {e}")
        return None
    except Exception as e:
        print(f"예상치 못한 오류: {e}")
        return None


async def generate_daily_story(
    context: DailyStoryContext,
    memory: NarrativeMemory,
    campaign_year: int = 1925,
    sunday_success_rate: float = 0.0,
    overall_success_rate: float = 0.0,
    sunday_total_count: int = 0
) -> str:
    """
    일일 스토리 생성
    
    Args:
        context: 일일 스토리 컨텍스트
        memory: 내러티브 메모리
        campaign_year: 캠페인 연도 (1925 또는 1931)
        sunday_success_rate: 일요일 조우 성공률 (0.0 ~ 1.0)
        overall_success_rate: 전체 조우 성공률 (0.0 ~ 1.0)
        sunday_total_count: 일요일 조우 총 횟수 (일요일 조우가 한 번이라도 있었는지 확인용)
    
    Returns:
        생성된 스토리 텍스트
    """
    system_prompt = load_system_prompt(campaign_year)
    
    # 컨텍스트 프롬프트 생성
    narrative_prompt = context.get_narrative_prompt(
        campaign_year,
        sunday_success_rate=sunday_success_rate,
        overall_success_rate=overall_success_rate,
        sunday_total_count=sunday_total_count
    )
    memory_prompt = memory.get_context_prompt()
    
    user_prompt = f"""{memory_prompt}

{narrative_prompt}
"""
    
    result = await call_mistral_api(system_prompt, user_prompt, max_tokens=1000)
    
    if result:
        return result.strip()
    else:
        # 폴백 메시지
        outcome = "성공" if context.is_success else "실패"
        return f"{context.state.current_date}. {context.target.visual_description}을(를) 상대로 {outcome}했습니다."


async def generate_monthly_summary(chapter_data: dict, campaign_year: int = 1925) -> str:
    """
    월간 회고록 생성
    
    Args:
        chapter_data: 월간 챕터 데이터
        campaign_year: 캠페인 연도 (1925 또는 1931)
    
    Returns:
        생성된 월간 요약 텍스트
    """
    system_prompt = load_system_prompt(campaign_year)
    
    user_prompt = f"""
    다음은 {chapter_data.get('month_name', '한 달')} 동안의 수사 기록입니다.
    
    [수사 결과]
    - 성공한 조우: {', '.join(chapter_data.get('bosses_defeated', []))}
    - 최종 점수: {chapter_data.get('final_score', 0)}점
    - 정신 상태: {chapter_data.get('madness_state', '알 수 없음')}
    
    위 정보를 바탕으로 존 밀러의 월간 회고록을 3~4줄 분량으로 작성해 주세요.
    지난 한 달의 사건들을 요약하고, 다음 달에 대한 불안감이나 결의를 표현하세요.
    """
    
    result = await call_mistral_api(system_prompt, user_prompt, max_tokens=300)
    
    if result:
        return result.strip()
    else:
        return f"{chapter_data.get('month_name', '한 달')}의 수사가 끝났습니다."


async def generate_prologue(campaign_year: int) -> str:
    """
    AI로 프롤로그 생성
    
    Args:
        campaign_year: 캠페인 연도 (1925 또는 1931)
        
    Returns:
        생성된 프롤로그 텍스트
    """
    system_prompt = load_system_prompt(campaign_year)
    
    if campaign_year == 1925:
        year_context = """
[배경 정보 - 1925년: 크툴루의 부름]
- 크툴루 신화의 핵심 연도
- 《크툴루의 부름》에서 주인공이 조사하는 핵심 사건(구스타프 요한센의 일기 속 크툴루 조우 사건)이 1925년 3월 23일에 발생
- 〈레드 훅의 공포〉, 〈금고 안에서〉 등의 단편이 집필된 해
- 항구에서 들려오는 기이한 소문들, 남태평양의 외딴 섬에서 돌아온 선원들의 정신 이상
- 크툴루를 숭배하는 광신도들의 음모
"""
    elif campaign_year == 1931:
        year_context = """
[배경 정보 - 1931년: 인스머스의 그림자]
- 후기 걸작의 시대
- 《인스머스의 그림자》와 《광기의 산맥에서》가 집필된 해
- 미스카토닉 대학 탐사대가 남극으로 떠나 재앙을 맞이하는 시점(1930~1931년)
- 해안가 마을 인스머스에서 들려오는 기이한 소문들
- 딥 원스(Deep Ones)와 인간의 잡종에 대한 공포
- 해안가와 바다, 물속의 존재들이 주요 테마
"""
    else:
        year_context = ""
    
    user_prompt = f"""
당신은 {campaign_year - 1}년 12월 31일 밤, 아캄의 탐정 사무소에 앉아 있는 존 밀러입니다.

{year_context}

위 배경 정보를 바탕으로, 존 밀러의 일기 형식으로 프롤로그를 작성해 주세요.

[요구사항]
1. 날짜: {campaign_year - 1}년 12월 31일, 장소: 매사추세츠주 아캄(Arkham), 탐정 사무소
2. 형식: 존 밀러의 1인칭 일기 형식
3. 분위기: 
   - 거리에서 들려오는 새해 축제 소리와 대비되는 어두운 분위기
   - 최근 들어 들려오는 기이한 소문들에 대한 언급
   - 다가올 {campaign_year}년에 대한 불안감과 결의
4. 내용:
   - 최근 의뢰인들의 공통된 공포
   - 최근 들어 들려오는 기이한 사건들에 대한 언급
   - 내일부터 시작될 수사에 대한 결의
   - 장비 점검 (손전등, 권총)
   - 이 일기장이 유서가 되지 않기를 바라는 마음
5. 길이: 3~4문단 정도의 분량
6. 톤: 러브크래프트 스타일의 코즈믹 호러 + 하드보일드 느와르

프롤로그를 작성해 주세요:
"""
    
    result = await call_mistral_api(system_prompt, user_prompt, max_tokens=800)
    
    if result:
        return result.strip()
    else:
        # 폴백: 기본 프롤로그 반환
        from app.services import storage_service
        prologue_text, _ = storage_service.generate_prologue(campaign_year)
        return prologue_text


async def generate_summary_line(story_text: str) -> str:
    """
    1줄 요약 생성
    
    Args:
        story_text: 전체 스토리 텍스트
        
    Returns:
        1줄 요약
    """
    system_prompt = "당신은 텍스트를 간결하게 요약하는 전문가입니다."
    
    user_prompt = f"""
    다음 일기 내용을 한 문장으로 요약해 주세요:
    
    {story_text}
    
    요약:
    """
    
    result = await call_mistral_api(system_prompt, user_prompt, max_tokens=100)
    
    if result:
        return result.strip()
    else:
        # 폴백: 첫 50자만 반환
        return story_text[:50] + "..." if len(story_text) > 50 else story_text


async def generate_weekly_summary(
    sunday_encounter: dict,
    key_encounters: list,
    campaign_year: int = 1925
) -> str:
    """
    주간 상세 요약 생성 (10문장 정도)
    
    Args:
        sunday_encounter: 일요일 조우 정보
        key_encounters: 주간 주요 조우 목록
        campaign_year: 캠페인 연도 (1925 또는 1931)
    
    Returns:
        생성된 주간 상세 요약 텍스트 (10문장 정도)
    """
    system_prompt = load_system_prompt(campaign_year)
    
    # 일요일 조우 정보 포맷팅
    sunday_info = f"""
일요일 조우:
- 날짜: {sunday_encounter.get('date', '알 수 없음')}
- 대상: {sunday_encounter.get('target_name', '알 수 없음')}
- 결과: {'성공' if sunday_encounter.get('is_success', False) else '실패'}
- 요약: {sunday_encounter.get('summary_line', '')}
"""
    
    # 주요 조우 정보 포맷팅
    encounters_text = "주간 주요 조우:\n"
    for i, encounter in enumerate(key_encounters, 1):
        encounters_text += f"""
{i}. 날짜: {encounter.get('date', '알 수 없음')}
   대상: {encounter.get('target_name', '알 수 없음')}
   결과: {encounter.get('outcome', '알 수 없음')}
   요약: {encounter.get('summary_line', '')}
"""
    
    user_prompt = f"""
다음은 한 주간의 조사 기록입니다. 존 밀러의 일기 형식으로 이번 주의 사건들을 상세하게 요약해 주세요.

{sunday_info}

{encounters_text}

위 정보를 바탕으로 다음 요구사항에 맞춰 주간 요약을 작성해 주세요:
1. 존 밀러의 1인칭 관점으로 서술
2. 러브크래프트 스타일의 코즈믹 호러 톤 유지
3. 약 10문장 정도의 분량
4. 일요일 조우와 주간 주요 조우들을 모두 포함
5. 사건들의 연속성과 긴장감을 표현
6. 발견한 단서나 유물에 대한 언급 포함

주간 요약:
"""
    
    result = await call_mistral_api(system_prompt, user_prompt, max_tokens=500)
    
    if result:
        return result.strip()
    else:
        # 폴백: 간단한 요약 반환
        return f"이번 주 {len(key_encounters)}건의 조우가 있었고, 일요일 조우는 {'성공' if sunday_encounter.get('is_success', False) else '실패'}했습니다."


async def generate_monthly_conclusion(month_data: dict, campaign_year: int = 1925) -> str:
    """
    월별 결말 생성 (한 달의 이야기를 정리하고 결말을 지어줌)
    
    Args:
        month_data: 월별 데이터 (일기, 주간 요약, 통계 등)
        campaign_year: 캠페인 연도 (1925 또는 1931)
    
    Returns:
        생성된 월별 결말 텍스트
    """
    system_prompt = load_system_prompt(campaign_year)
    
    # 월 이름과 연도
    month_name = month_data.get("month_name", "")
    year = month_data.get("campaign_year", campaign_year)
    
    # 일기 요약 생성
    entries_text = ""
    for i, entry in enumerate(month_data.get("daily_entries", []), 1):
        date_str = entry.get("date", "")
        day_of_week = entry.get("day_of_week", "")
        summary = entry.get("summary", "")
        is_success = entry.get("is_success", False)
        target_name = entry.get("target_name", "")
        
        entries_text += f"""
{i}. {date_str} ({day_of_week})
   - 대상: {target_name}
   - 결과: {'성공' if is_success else '실패'}
   - 요약: {summary}
"""
    
    # 주간 요약 생성
    weeks_text = ""
    for week_record in month_data.get("weekly_summaries", []):
        week_num = week_record.get("week_number", 0)
        week_start = week_record.get("week_start_date", "")
        week_end = week_record.get("week_end_date", "")
        weekly_summary = week_record.get("weekly_summary", "")
        sunday_enc = week_record.get("sunday_encounter", {})
        
        weeks_text += f"""
주 {week_num} ({week_start} ~ {week_end}):
- 일요일 조우: {sunday_enc.get('target_name', '알 수 없음')} ({'성공' if sunday_enc.get('is_success', False) else '실패'})
- 주간 요약: {weekly_summary}
"""
    
    # 통계 정보
    stats = month_data.get("statistics", {})
    stats_text = f"""
통계:
- 전체 조우: {stats.get('total_entries', 0)}건
- 성공: {stats.get('success_count', 0)}건 ({stats.get('success_rate', 0)}%)
- 일요일 조우 성공: {stats.get('sunday_success_count', 0)}/{stats.get('sunday_total_count', 0)} ({stats.get('sunday_success_rate', 0)}%)
- 광기 발작: {stats.get('madness_triggered_count', 0)}회
- 총 광기 수치: {stats.get('total_madness', 0)}
"""
    
    # 월별 결산 결말 지시사항 로드
    monthly_prompt = load_monthly_conclusion_prompt(month_name)
    monthly_instruction = ""
    if monthly_prompt:
        monthly_instruction = f"\n\n[특별 지시사항]\n이번 달({month_name})의 결말은 반드시 다음 내용으로 마무리해야 합니다:\n{monthly_prompt}\n\n위 지시사항을 반드시 포함하여 결말을 작성해 주세요."
    
    user_prompt = f"""
다음은 {year}년 {month_name}의 모든 조사 기록입니다. 존 밀러의 일기 형식으로 이번 달의 이야기를 정리하고 결말을 지어주세요.

[일기 기록]
{entries_text}

[주간 요약]
{weeks_text}

[통계 정보]
{stats_text}

위 정보를 바탕으로 다음 요구사항에 맞춰 월별 결말을 작성해 주세요:
1. 존 밀러의 1인칭 관점으로 서술
2. 러브크래프트 스타일의 코즈믹 호러 톤 유지
3. 한 달간의 주요 사건들을 시간 순서대로 요약
4. 발견한 단서, 유물, 패턴에 대한 종합 분석
5. 정신 상태의 변화나 광기의 누적에 대한 언급
6. 이번 달의 경험이 존 밀러에게 미친 영향
7. 다음 달에 대한 불안감, 예감, 또는 결의 표현
8. 전체적으로 한 달의 이야기를 마무리하는 결말 형식
9. 약 15-20문장 정도의 분량
{monthly_instruction}

월별 결말:
"""
    
    result = await call_mistral_api(system_prompt, user_prompt, max_tokens=1200)
    
    if result:
        return result.strip()
    else:
        # 폴백: 간단한 결말 반환
        return f"{year}년 {month_name}의 조사가 끝났습니다. 발견한 단서들과 경험한 공포들이 내 마음속에 깊이 새겨졌다. 다음 달이 기다리고 있다."

