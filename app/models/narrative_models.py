from pydantic import BaseModel, Field
from typing import List, Optional


class EncounterSummary(BaseModel):
    """개별 조우의 요약 정보 (주간 기억용)"""
    date: str
    target_name: str  # 예: "검은 고양이", "항구의 깡패"
    outcome: str  # 예: "성공(단서획득)", "실패(도망침)"
    key_narrative: str  # AI가 생성한 1문장 요약 (예: "고양이 목걸이에서 기이한 문양을 발견함")


class NarrativeMemory(BaseModel):
    """전체 기억 관리 모델"""
    # 단기 기억: 이번 주 수사 일지 (일요일이 지나면 초기화)
    weekly_log: List[EncounterSummary] = Field(default=[], description="이번 주에 발생한 사건들의 요약 리스트")

    # 중기 기억: 직전 일기의 마지막 문장 (연속성을 위해 필요)
    last_entry_snippet: Optional[str] = Field(None, description="어제 일기의 마지막 문장 (문맥 연결용)")

    # 장기 기억: 레거시 요소 (연말까지 유지)
    active_artifacts: List[str] = Field(default=[], description="현재 소지 중인 유물 목록 (예: '은 열쇠', '고대의 주문서')")
    major_events: List[str] = Field(default=[], description="과거에 처치한 주요 보스나 대사건 기록")
    
    # 당월 주간 요약 및 월간 요약
    current_month_weekly_summaries: List[str] = Field(default=[], description="이번 달의 주간 요약 텍스트 목록")
    monthly_summaries: List[str] = Field(default=[], description="지나간 모든 달의 월간 요약 텍스트 목록")

    def get_context_prompt(self) -> str:
        """AI에게 전달할 '이전 줄거리' 프롬프트 생성"""

        # 주간 요약글 생성
        weekly_summary = "이번 주 수사 기록:\n"
        if not self.weekly_log:
            weekly_summary += "- (아직 특별한 단서 없음)\n"
        else:
            for log in self.weekly_log:
                weekly_summary += f"- {log.date}: {log.target_name} 상대로 {log.outcome}. ({log.key_narrative})\n"

        # 장기 기억 (유물)
        inventory = ", ".join(self.active_artifacts) if self.active_artifacts else "없음"
        
        # 당월 주간 요약 생성
        current_month_weekly_text = ""
        if self.current_month_weekly_summaries:
            current_month_weekly_text = "\n        지난 주간 요약 (이번 달):\n"
            for i, summary in enumerate(self.current_month_weekly_summaries, 1):
                current_month_weekly_text += f"        - 주 {i}: {summary}\n"
        else:
            current_month_weekly_text = "\n        지난 주간 요약 (이번 달): (아직 없음)\n"
        
        # 월간 요약 생성
        monthly_text = ""
        if self.monthly_summaries:
            monthly_text = "\n        지난 월간 요약:\n"
            for i, summary in enumerate(self.monthly_summaries, 1):
                monthly_text += f"        - {i}월: {summary}\n"
        else:
            monthly_text = "\n        지난 월간 요약: (아직 없음)\n"

        return f"""
        [기억해야 할 배경 정보]
        1. 현재 소지품(유물): {inventory}
        2. {weekly_summary}
        3. 직전 상황: "{self.last_entry_snippet or '새로운 하루가 시작되었다.'}"{current_month_weekly_text}{monthly_text}

        (위 정보를 바탕으로, 오늘의 사건이 과거의 발견들과 자연스럽게 연결되도록 서술하시오.)
        """


class MonthlyChapterSummary(BaseModel):
    """월간 에피소드 결산 데이터 (한 달이 끝날 때 생성)"""
    month_name: str  # 예: "1926년 1월"
    final_score: int  # 계산된 월간 점수

    # 내러티브 요약
    bosses_defeated: List[str] = Field(default=[], description="처치한 일요일 보스 목록")
    madness_state: str = Field(default="", description="월말 시점 존 밀러의 정신 상태 (예: '피폐해짐', '냉철함')")
    chapter_summary: str = Field(default="", description="AI가 생성한 3~4줄 분량의 '지난 이야기' 요약")

    # 달력 뒷면에서 얻은 새로운 레거시 정보
    new_rules_unlocked: List[str] = Field(default=[], description="예: ['은 열쇠 사용 가능', '주문서 해독 보너스']")
    story_revelation: str = Field(default="", description="달력 뒷면의 스토리 텍스트 (다음 달 분위기 조성용)")


class GlobalCampaignMemory(BaseModel):
    """전체 캠페인(1년)을 관장하는 장기 기억 저장소"""
    # 완료된 챕터들의 아카이브 (장기 기억)
    past_chapters: List[MonthlyChapterSummary] = Field(default=[], description="지나간 달들의 요약 기록")

    # 현재 적용 중인 모든 활성 규칙 (누적됨)
    active_artifacts: List[str] = Field(default=[], description="현재 사용 가능한 모든 유물 및 특수 규칙")

    def get_new_month_prompt(self, current_month: str) -> str:
        """새로운 달(1일)이 시작될 때 AI에게 줄 프롬프트 생성"""

        # 가장 최근 챕터(직전 달) 정보 가져오기
        last_chapter = self.past_chapters[-1] if self.past_chapters else None

        legacy_rules = ", ".join(self.active_artifacts) if self.active_artifacts else "없음"

        prompt = f"""
        [시스템] {current_month}의 새로운 에피소드가 시작됩니다.

        [지난 이야기 요약]
        {last_chapter.chapter_summary if last_chapter else "모험의 시작입니다."}

        [현재 존 밀러의 상태]
        - 정신 상태: 지난달의 광기는 초기화되었으나, 기억은 남아있습니다. ({last_chapter.madness_state if last_chapter else '정상'})
        - 보유 능력/유물: {legacy_rules}

        [새로운 국면 (New Story)]
        {last_chapter.story_revelation if last_chapter else "아캄의 거리에는 기묘한 안개가 깔려 있습니다."}

        위 정보를 바탕으로 {current_month} 1일의 오프닝 일기를 작성해 주세요. 
        지난달의 사건을 회상하되, 새로운 위협에 대비하는 비장한 톤으로 시작하세요.
        """
        return prompt

    def close_month(self, chapter_data: MonthlyChapterSummary):
        """월말 정산 처리: 아카이브에 저장하고, 새 규칙을 활성 목록에 추가"""
        self.past_chapters.append(chapter_data)

        # 새로운 규칙/유물은 연말까지 계속 유지되므로 누적 리스트에 추가
        self.active_artifacts.extend(chapter_data.new_rules_unlocked)

