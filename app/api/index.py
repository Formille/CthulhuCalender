# 기존 app.main의 app을 그대로 import
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# 기존 FastAPI 앱 import (코드 수정 없음)
from app.main import app

# Vercel serverless function을 위한 Mangum 어댑터
from mangum import Mangum

# Vercel용 핸들러 생성
handler = Mangum(app, lifespan="off")

