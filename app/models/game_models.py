from enum import Enum
from pydantic import BaseModel, Field, computed_field
from typing import List
from datetime import date
import calendar


class ActionType(str, Enum):
    """행동 유형 (주사위 기호)"""
    COMBAT = "전투, 신체적 대결"  # Pistol
    INVESTIGATION = "현장에서 진행하는 세부 조사"  # Lupe
    SEARCH = "어둡고 위험한 장소에서 일어나는 미행과 수색"  # Flashlight


class GameState(BaseModel):
    """게임의 현재 상태"""
    current_date: date = Field(..., description="현재 게임 날짜 (예: 1926-01-02)")
    madness_level: int = Field(0, ge=0, description="현재 누적된 광기 수치 (월초 0으로 초기화)")
    weekly_success_count: int = Field(0, ge=0, description="이번 주(월~토) 성공 횟수 (일요일 난이도 감소용)")
    acquired_artifacts: List[str] = Field(default=[], description="획득한 유물이나 활성화된 추가 규칙")


class EncounterTarget(BaseModel):
    """플레이어가 선택한 조우 대상"""
    target_date: date = Field(..., description="선택한 칸의 날짜 (반드시 오늘 날짜일 필요는 없음)")
    visual_description: str = Field(..., description="칸에 그려진 그림 묘사 (예: 총을 든 노파, 검은 고양이)")
    required_symbol: ActionType = Field(..., description="필요한 주사위 기호")
    base_difficulty: int = Field(..., ge=5, le=20, description="칸에 적힌 기본 난이도 숫자")
    is_sunday_boss: bool = Field(False, description="일요일 특별 조우 여부")

    @property
    def narrative_context(self) -> str:
        """AI에게 전달할 상황 묘사 힌트"""
        if self.required_symbol == ActionType.COMBAT:
            return f"존 밀러는 {self.visual_description}와(과) 물리적으로 충돌합니다."
        elif self.required_symbol == ActionType.INVESTIGATION:
            return f"존 밀러는 {self.visual_description}에 대해 면밀히 조사합니다."
        return f"존 밀러는 {self.visual_description}이(가) 있는 어두운 곳을 수색합니다."


class DiceRoll(BaseModel):
    """주사위 굴림 결과"""
    black_dice_sum: int = Field(..., description="검은색 숫자 주사위 3개의 합")
    green_dice_symbols: List[ActionType] = Field(..., description="초록색 기호 주사위 2개의 결과")
    cthulhu_symbol_count: int = Field(0, ge=0, le=3, description="검은 주사위에 나온 크툴루(문어) 기호 개수 (최대 3개)")


class DailyStoryContext(BaseModel):
    """최종 스토리 생성 요청 데이터"""
    state: GameState
    target: EncounterTarget
    roll: DiceRoll

    @computed_field
    @property
    def is_success(self) -> bool:
        """규칙에 따른 성공 여부 자동 판정"""
        # 일요일은 주간 성공 횟수만큼 난이도 차감
        effective_difficulty = self.target.base_difficulty
        if self.target.is_sunday_boss:
            effective_difficulty -= self.state.weekly_success_count
            effective_difficulty = max(0, effective_difficulty)  # 음수 방지

        # 성공 조건: 합계 >= 난이도 AND 기호 일치
        number_success = self.roll.black_dice_sum >= effective_difficulty
        symbol_success = self.target.required_symbol in self.roll.green_dice_symbols

        return number_success and symbol_success

    @computed_field
    @property
    def madness_triggered(self) -> bool:
        """광기 발동 여부"""
        return self.roll.cthulhu_symbol_count > 0
    
    @computed_field
    @property
    def madness_increase(self) -> int:
        """광기 증가량"""
        return self.roll.cthulhu_symbol_count

    def get_narrative_prompt(
        self, 
        campaign_year: int = 1925,
        sunday_success_rate: float = 0.0,
        overall_success_rate: float = 0.0,
        sunday_total_count: int = 0
    ) -> str:
        """AI에게 전달할 최종 프롬프트 생성"""
        story_tone = "음울하고 긴장감 넘치는 러브크래프트 스타일"
        if self.state.madness_level >= 7:
            story_tone += ", 몽환적이고 비논리적인 표현, 환각 및 의식의 붕괴가 서술에 드러나도록 (강한 광기, 현실과 환상의 경계가 무너진 스타일)"
        elif self.state.madness_level >= 5:
            story_tone += ", 어지럽고 불안정한 문장, 편집증적/비현실적 인식이 섞인 광기 어린 스타일 (중간 광기, 의심과 두려움 강조)"
        elif self.state.madness_level >= 3:
            story_tone += ", 불안·편집증이 느껴지는 심리 묘사를 중점적으로 (약한 광기, 현실감 왜곡 살짝 드러나게)"

        result_desc = "성공" if self.is_success else "실패"

        # 일요일 보스전인 경우 추가 맥락 제공
        sunday_context = ""
        if self.target.is_sunday_boss:
            sunday_context = f"(일요일에 중요한 조우를 진행합니다. 이번 주에는 총 7개의 단서 중 {self.state.weekly_success_count}개의 단서를 모았습니다.)"

        # 실패 시 광기 수준에 따른 꿈/환상 프롬프트 생성
        failure_dream_context = ""
        if not self.is_success:
            if self.state.madness_level >= 7:
                failure_dream_context = """
        - 실패 원인: 존 밀러는 전날 밤 꿈에서 본 끔찍한 이미지들 때문에 정신이 완전히 붕괴된 상태입니다.
          * 꿈 속에서 본 것: 앞선 일기에서 묘사된 대상에 대한 끔찍한 환상, 거대한 존재에 대한 환각, 귀에다가 대고 소리치는 듯한 환청
          * 현실 반영: 꿈에서 본 이미지가 현실과 겹쳐 보여 아무 행동도 할 수 없었습니다. 손이 떨리고, 눈앞이 흐려지고, *그것*의 목소리가 귓가에 맴돌았습니다.
          * 결과: 꿈 속의 공포 때문에 실제 조우 대상을 제대로 보지도, 행동할 수도 없었습니다."""
            elif self.state.madness_level >= 5:
                failure_dream_context = """
        - 실패 원인: 존 밀러는 전날 밤 꿈에서 본 기괴한 환상들 때문에 집중력을 잃었습니다.
          * 꿈 속에서 본 것: 앞선 일기에서 묘사된 대상에 대한 끔찍한 환상, 그림자가 움직이는 환각, 누군가 말하는 듯한 뚜렷한한 목소리
          * 현실 반영: 꿈의 잔상이 아직도 눈앞에 남아있어 현실과 구분이 어려웠습니다. 손이 떨리고, 불안감에 사로잡혀 제대로 된 판단을 내릴 수 없었습니다.
          * 결과: 꿈 속의 공포가 현실을 방해하여 조우 대상을 제대로 대응하지 못했습니다."""
            elif self.state.madness_level >= 3:
                failure_dream_context = """
        - 실패 원인: 존 밀러는 전날 밤 불안한 꿈을 꾸고 일어나서 정신이 흐려진 상태입니다.
          * 꿈 속에서 본 것: 어둠 속에서 무언가가 움직이는 느낌, 속삭이는 듯 어렴풋한한 들리는 환청, 불길한 예감
          * 현실 반영: 꿈의 여운이 남아있어 불안하고 집중이 되지 않았습니다. 뭔가 잘못될 것 같은 예감에 사로잡혀 있었습니다.
          * 결과: 꿈의 불안감이 실제 행동을 방해하여 조우 대상을 제대로 처리하지 못했습니다."""
            else:
                failure_dream_context = """
        - 실패 원인: 존 밀러는 전날 밤 불안한 꿈을 꾸고 피로한 상태입니다.
          * 꿈 속에서 본 것: 어둠 속의 그림자, 불길한 예감
          * 현실 반영: 꿈의 여운으로 인해 집중력이 떨어졌고, 불안한 마음이 행동을 방해했습니다.
          * 결과: 피로와 불안감으로 인해 조우 대상을 제대로 대응하지 못했습니다."""

        # 날짜와 요일 정보 추출 (일기 날짜는 현재 날짜 사용)
        diary_date = self.state.current_date  # 현재 날짜 (일기 작성 날짜)
        day_names_kr = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]
        day_names_en = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        day_of_week_kr = day_names_kr[diary_date.weekday()]
        day_of_week_en = day_names_en[diary_date.weekday()]
        
        # 날짜 포맷팅 (1925년 1월 3일 형식)
        year = diary_date.year
        month = diary_date.month
        day = diary_date.day
        
        # 이야기 진행 정도 계산 (이번 월 전체 일수 중 현재 일기 작성일의 비율)
        days_in_month = calendar.monthrange(year, month)[1]  # 해당 월의 전체 일수
        story_progress_ratio = day / days_in_month  # 진행 정도 (0.0 ~ 1.0)
        story_progress_percent = round(story_progress_ratio * 100, 1)  # 퍼센트로 변환
        story_progress_text = f"{day}/{days_in_month} ({story_progress_percent}%)"
        
        # 광기 상태 텍스트 생성
        madness_state_text = ""
        if self.state.madness_level >= 7:
            madness_state_text = "심각한 정신 착란 (광기 수치: " + str(self.state.madness_level) + "/10) - 현실과 환상의 경계가 무너진 상태"
        elif self.state.madness_level >= 5:
            madness_state_text = "중간 광기 (광기 수치: " + str(self.state.madness_level) + "/10) - 의심과 두려움이 강한 상태"
        elif self.state.madness_level >= 3:
            madness_state_text = "약한 광기 (광기 수치: " + str(self.state.madness_level) + "/10) - 불안과 편집증이 느껴지는 상태"
        else:
            madness_state_text = "정상 (광기 수치: " + str(self.state.madness_level) + "/10) - 비교적 냉철한 상태"
        
        # 성공률 텍스트 생성
        sunday_success_percent = round(sunday_success_rate * 100, 1) if sunday_success_rate > 0 else 0.0
        overall_success_percent = round(overall_success_rate * 100, 1) if overall_success_rate > 0 else 0.0

        # 이야기 진행 정도에 따른 단계별 프롬프트 생성
        if story_progress_percent < 10:
            story_stage_description = "**일상의 균열** 단계입니다. 평범한 일상 속에 설명할 수 없는 작은 위배가 등장합니다. 물리 법칙에 어긋나는 기이한 현상이나 기괴한 유물을 발견하며 독자에게 호기심과 미세한 불안감을 심어줍니다. 아직은 일상적인 논리로 설명 가능한 범위 내에서 기괴한 일들이 일어나기 시작합니다."
        elif story_progress_percent < 20:
            story_stage_description = "**집착의 시작** 단계입니다. 존 밀러가 그 현상을 파헤치기 시작합니다. 주변 사람들은 이를 부정하거나 무시하지만, 존 밀러는 본능적으로 무언가 잘못되었음을 느끼고 점점 더 깊이 조사에 몰입합니다. 조사가 본격화되기 시작하며, 작은 단서들이 모이기 시작합니다."
        elif story_progress_percent < 30:
            story_stage_description = "**거부할 수 없는 징조** 단계입니다. 일상적인 논리로 설명하려던 시도가 완전히 무너집니다. 광기의 전조가 나타나며, 존 밀러는 자신이 마주한 것이 단순한 사건이 아닌 거대한 체계의 일부임을 깨닫습니다. 현실이 흔들리기 시작하고, 설명할 수 없는 일들이 더욱 빈번해집니다."
        elif story_progress_percent < 40:
            story_stage_description = "**고립과 소외** 단계입니다. 진실에 다가갈수록 존 밀러는 사회적으로 고립됩니다. 동료를 잃거나, 믿었던 지식이 무용지물이 됩니다. 공포의 대상이 실체를 드러내지는 않지만 그 영향력은 확실해집니다. 주변 사람들과의 관계가 악화되고, 혼자서만 진실을 추적해야 하는 상황이 됩니다."
        elif story_progress_percent < 50:
            story_stage_description = "**진실의 파편 (Midpoint)** 단계입니다. 금지된 지식이나 고대의 기록을 통해 공포의 정체에 대한 단서를 얻습니다. 하지만 이는 희망이 아니라, 인간이 얼마나 미개한 존재인지를 깨닫는 절망의 시작입니다. 중요한 단서를 발견했지만, 그것이 더 큰 공포를 암시합니다."
        elif story_progress_percent < 61:
            story_stage_description = "**심연으로의 하강** 단계입니다. 존 밀러는 이제 되돌아갈 수 없습니다. 물리적, 정신적 한계에 부딪히며 주변 환경이 기괴하게 변하기 시작합니다. 현실과 환각의 경계가 모호해지는 구간입니다. 광기 수치가 높아지고, 정상적인 판단이 어려워집니다."
        elif story_progress_percent < 73:
            story_stage_description = "**압도적인 무력감** 단계입니다. 존 밀러가 나름의 대항책을 세우지만, 그것이 거대한 존재에게는 아무런 의미가 없음을 깨닫습니다. 개미가 인간의 발걸음을 막으려 하는 것과 같은 처절한 무력감이 강조됩니다. 모든 노력이 헛수고임을 깨닫는 순간입니다."
        elif story_progress_percent < 85:
            story_stage_description = "**우주적 공포의 현현** 단계입니다. 공포의 실체(외신, 고대 존재 등)가 그 모습을 드러내거나, 그 존재의 의지가 세상을 잠식합니다. 존 밀러의 정신력은 붕괴 직전에 도달합니다. 현실이 완전히 왜곡되고, 거대한 존재의 일부가 드러나기 시작합니다."
        elif story_progress_percent < 97:
            story_stage_description = "**절정 (Climax)** 단계입니다. 최후의 발악 혹은 도주가 일어납니다. 하지만 승리는 불가능하며, 고작해야 파멸을 잠시 늦추거나 혹은 진실을 목격하고 미쳐버리는 것이 최선인 상황이 전개됩니다. 모든 것이 끝나가는 순간, 마지막 선택의 기로에 서게 됩니다."
        else:
            # 1월인 경우 특별한 결말 플롯 적용
            if month == 1:
                story_stage_description = "**허무한 결말** 단계입니다. 이 일기는 1월의 마지막입니다. 2월 첫날 아침에 눈을 뜬 존 밀러는 한 달 동안 있었던 일이 사실 너무 생생한 꿈이었다는 것을 깨닫게 됩니다. 하지만 2월 첫날부터, 데자뷰같은 일들이 일어나기 시작할 것입니다. 이 일기에서 1월의 모든 경험이 꿈처럼 느껴지지만, 동시에 그것이 단순한 꿈이 아닐 수도 있다는 불안감을 암시하는 결말로 마무리하세요. 모든 것이 끝났지만, 진정한 공포는 이제 시작입니다."
            else:
                story_stage_description = "**허무한 결말** 단계입니다. 존 밀러는 파멸하거나, 살아남더라도 평생 지울 수 없는 공포 속에 갇힙니다. 세계는 여전히 무심하게 흘러가며, 우주적 존재에게 인류는 고려의 대상조차 아니었음이 명시됩니다. 모든 것이 끝났지만, 진정한 공포는 이제 시작입니다."

        return f"""
        당신은 아캄의 탐정 '존 밀러'입니다. 아래 정보를 바탕으로 오늘의 일기를 작성하세요.

        [상황 설정]
        - 일기 날짜: {year}년 {month}월 {day}일 ({day_of_week_kr})
        - 대상: {self.target.visual_description}
        - 행동: {self.target.required_symbol.value} 시도
        - 이야기 진행 정도: {story_progress_text} (이번 월 전체 일수 중 현재 일기 작성일의 비율)

        [결과 데이터]
        - 판정: {result_desc} {sunday_context}
        - 크툴루 기호: {self.roll.cthulhu_symbol_count}개 {"(공포에 질림)" if self.madness_triggered else ""}
        - 광기 발작: {"발생함" if self.madness_triggered else "없음"} {"(기호 " + str(self.roll.cthulhu_symbol_count) + "개로 인해 광기 +" + str(self.madness_increase) + ")" if self.madness_triggered else ""}
        - 현재 광기 수치: {self.state.madness_level} (높을수록 심리적 불안 묘사.)
        {failure_dream_context}

        [요청 사항]
        - 톤: {story_tone}
        - 일기 형식: 일기 첫 줄에 "{year}년 {month}월 {day}일, {day_of_week_kr}" 형식으로 날짜를 명시하세요.
        - 내용: {self.target.visual_description}을(를) 상대로 행동을 취한 구체적 묘사를 포함할 것.
        - 성공 시: 단서를 찾거나 적을 물리침.
        - 실패 시: 위의 "실패 원인"을 반드시 반영하세요. 전날 밤 꿈에서 본 이미지나 환상 때문에 아무것도 할 수 없었다는 내용을 중심으로 서술하세요. 꿈의 내용과 그것이 현실에 미친 영향을 구체적으로 묘사하세요.
        - 스토리 전진: 이 일기는 전체 스토리의 한 부분입니다. 매일의 일기가 스토리를 계속 전진시켜야 합니다. 
          * 이야기 진행 정도: {story_progress_text} - {story_stage_description}
{(f"          * 일요일 조우 성공률: {sunday_success_percent}% - 일요일 조우의 성공률이 높다면(70% 이상) 존 밀러는 자신감을 가지고 위협에 맞서고 있으며, 스토리는 더 적극적이고 공격적인 방향으로 전진해야 합니다. 성공률이 낮다면(50% 미만) 존 밀러는 좌절감과 절망감에 빠져있으며, 스토리는 더 어둡고 절망적인 방향으로 전진해야 합니다.          * 전체 조우 성공률: {overall_success_percent}% - 전체 조우 성공률이 높다면(70% 이상) 조사가 순조롭게 진행되고 있으며, 단서들이 잘 연결되고 있습니다. 성공률이 낮다면(50% 미만) 조사가 막히고 있으며, 위협이 점점 더 커지고 있습니다.          * 광기 상태: {madness_state_text} - 광기 상태에 따라 스토리의 톤과 방향이 달라져야 합니다. 광기가 심각할수록 현실과 환상의 경계가 무너지고, 더 어둡고 절망적인 내용이 포함되어야 합니다." if sunday_total_count > 0 else "")}
          * 종합: 위의 모든 요소({("이야기 진행 정도, 일요일 조우 성공률, " if sunday_total_count > 0 else "")}전체 조우 성공률, 광기 상태)를 종합적으로 고려하여 스토리 전진 방향을 결정하세요. 새로운 단서를 발견하거나, 기존 단서와의 연결을 발견하거나, 위협이 점점 더 구체화되거나, 정신 상태가 변화하는 등 스토리가 발전하는 내용을 포함하세요. 단순히 반복되는 내용이 아니라, 매일 새로운 정보나 상황 변화가 있어야 합니다.
        - 텍스트 강조: 중요한 단어나 구절은 마크다운 형식으로 강조하세요.
          * 굵게: **텍스트**  형식 사용
          * 이탤릭: *텍스트*  형식 사용
          * 예시: **공포**에 질린 나는 *그것*을 보았다.
        """

