# CthulhuCalender
"365 어드벤처 : 크툴루 1926" 플레이에 몰입하기 위한 스토리를 제공하고, 기록 아카이빙을 돕습니다.

1926년 아컴을 배경으로 한 일일 캘린더 게임에서, 플레이어의 주사위 결과에 따라 Mistral API를 통해 러브크래프트 스타일의 스토리를 생성하고, 모든 게임 기록과 생성된 스토리를 아카이빙하는 웹 애플리케이션입니다.
다만 실제 2026년과 동일한 날짜 배치를 가지는 해는 1925년이므로, 앱 상에서는 1925년으로 진행합니다. 원한다면 1931년으로도 진행할 수 있습니다.

## 설치 방법

1. 가상환경 생성 및 활성화:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# 또는
source venv/bin/activate  # Linux/Mac
```

2. 의존성 설치:
```bash
pip install -r requirements.txt
```

3. 환경 변수 설정:
`.env` 파일을 생성하고 `MISTRAL_API_KEY`를 설정하세요:
```
MISTRAL_API_KEY=your-api-key-here
```

## 실행 방법

```bash
uvicorn app.main:app --reload
```

브라우저에서 `http://localhost:8000`에 접속하세요.

## 프로젝트 구조

- `app/`: 백엔드 애플리케이션 코드
  - `models/`: Pydantic 데이터 모델
  - `services/`: 비즈니스 로직 서비스
  - `api/`: FastAPI 엔드포인트
  - `prompts/`: LLM 프롬프트 템플릿
- `static/`: 정적 파일 (CSS, JS)
- `templates/`: HTML 템플릿
- `data/`: 게임 저장 데이터 (JSON)

## 게임 규칙

- 매일 조우를 선택하고 주사위를 굴려 해결합니다
- 일요일은 특별 조우로, 이번 주 성공 횟수만큼 난이도가 감소합니다
- 크툴루 기호가 나오면 광기 수치가 증가합니다
- 매월 말에 점수를 계산하고 광기를 초기화합니다
<<<<<<< HEAD

=======
>>>>>>> 6bd311c (Initialize README with project details and setup)
