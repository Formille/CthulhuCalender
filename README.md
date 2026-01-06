# CthulhuCalender Assistant

"365 어드벤처 : 크툴루 1926" 플레이에 몰입하기 위한 스토리를 제공하고, 기록 아카이빙을 돕습니다.

## 제작 의도

아스모디 코리아에서 퍼블리싱한** "365 어드벤처 : 크툴루 1926"**은 1926년 아컴을 배경으로 한 **일일 캘린더 게임**입니다.
하지만 점수 외의 별다른 내용이 없어 **좀 심심해서**, 결과에 따른 스토리를 제공해주면 좋겠다고 생각해서 제작했습니다.
플레이어의 주사위 결과에 따라 **Mistral API**를 통해 러브크래프트 스타일의 스토리를 생성하고, 모든 게임 기록과 생성된 스토리를 아카이빙하는 웹 애플리케이션입니다.

❗❗ 유의사항 ❗❗
다만 실제 2026년과 동일한 날짜 배치를 가지는 해는 **1925년**이므로, 앱 상에서는 1925년으로 진행합니다.

## 설치 방법

### 방법 1: uv 사용 (권장 - 가장 빠르고 간단)

`uv`는 Rust로 작성된 빠른 Python 패키지 관리자입니다.

1. **uv 설치** (아직 설치하지 않은 경우):
   ```powershell
   # Windows (PowerShell)
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

2. **Python 3.11 설치 및 가상환경 생성**:
   ```powershell
   # Python 3.11 설치
   uv python install 3.11
   
   # Python 3.11로 가상환경 생성
   uv venv --python 3.11 .venv
   ```

3. **의존성 설치**:
   ```powershell
   # uv를 사용하면 가상환경 활성화 없이도 설치 가능
   uv pip install -r requirements.txt
   ```

   또는 가상환경을 활성화한 후 일반 pip 사용:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

### 방법 2: 전통적인 방법

1. Python 3.11 설치 확인:
```powershell
py -3.11 --version
```

Python 3.11이 설치되어 있지 않은 경우:
- **방법 1**: [Python 공식 웹사이트](https://www.python.org/downloads/release/python-3110/)에서 Python 3.11 다운로드 및 설치
- **방법 2**: winget 사용 (관리자 권한 필요)
  ```powershell
  winget install Python.Python.3.11
  ```
- **방법 3**: uv 사용 (가장 간단)
  ```powershell
  uv python install 3.11
  ```

2. 가상환경 생성 및 활성화:
```bash
# Python 3.11로 가상환경 생성
py -3.11 -m venv .venv

# 가상환경 활성화 (Windows)
.venv\Scripts\activate  # PowerShell 또는 CMD
# 또는
source .venv/bin/activate  # Linux/Mac
```

**Windows PowerShell 사용 시 주의사항:**
PowerShell에서 실행 정책 오류가 발생하는 경우, 다음 중 하나를 사용하세요:

- **방법 1 (권장)**: 현재 세션에서만 실행 정책 우회
  1. PowerShell 터미널을 열고 프로젝트 디렉토리로 이동합니다
  2. 다음 명령어를 순서대로 실행합니다:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
  .venv\Scripts\activate
  ```
  > **참고**: 이 명령어는 PowerShell 터미널에서 직접 실행해야 합니다. 관리자 권한이 필요 없으며, 현재 PowerShell 세션에서만 적용됩니다.

- **방법 2**: 스크립트 직접 실행
  ```powershell
  .venv\Scripts\Activate.ps1
  ```

- **방법 3**: CMD 사용 (가장 간단)
  CMD를 열고 다음 명령어를 실행합니다:
  ```cmd
  .venv\Scripts\activate.bat
  ```

2. 의존성 설치:
```bash
pip install -r requirements.txt
```

**Python 3.13 사용 시 주의사항:**
Python 3.13을 사용하는 경우 `pydantic-core` 컴파일 오류가 발생할 수 있습니다. 다음 해결 방법을 시도하세요:

- **방법 1 (권장)**: 사전 컴파일된 wheel 파일 사용
  ```powershell
  pip install --only-binary :all: -r requirements.txt
  ```

- **방법 2**: Python 3.11 또는 3.12 사용
  Python 3.13은 비교적 최신 버전이라 일부 패키지와 호환성 문제가 있을 수 있습니다.
  Python 3.11 또는 3.12로 가상환경을 다시 생성하세요:
  ```powershell
  # Python 3.12가 설치되어 있다면
  py -3.12 -m venv venv
  .venv\Scripts\activate
  pip install -r requirements.txt
  ```

- **방법 3**: Rust 컴파일러 설치 (고급)
  `pydantic-core`는 Rust로 작성되어 컴파일이 필요합니다. 
  [rustup.rs](https://rustup.rs/)에서 Rust를 설치하고 PATH에 추가한 후 다시 시도하세요.

3. 환경 변수 설정:
`.env` 파일을 생성하고 `MISTRAL_API_KEY`를 설정하세요:
```
MISTRAL_API_KEY=your-api-key-here
```

## 실행 방법

```bash
uvicorn app.main:app --reload
```
