# 기존 app.main의 app을 그대로 import
import sys
import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, Response
from mangum import Mangum

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Vercel serverless 환경에서 작업 디렉토리를 프로젝트 루트로 설정
# 이렇게 하면 app/main.py의 상대 경로가 올바르게 작동합니다
os.chdir(str(project_root))

# 기존 FastAPI 앱 import (코드 수정 없음)
from app.main import app  # noqa: E402

# 정적 파일 경로 보정 (Vercel 환경에서 올바른 경로 사용)
# 기존 마운트를 제거하고 올바른 경로로 재마운트
static_path = project_root / "static"
if static_path.exists():
    # 기존 마운트 제거
    app.routes = [route for route in app.routes if not (hasattr(route, 'path') and route.path == '/static')]
    # 올바른 경로로 재마운트
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# index.html 경로 보정을 위한 패치
# 기존 HTML 라우트를 올바른 경로를 사용하도록 재정의
index_html_path = project_root / "index.html"

async def patched_read_root():
    """경로 보정된 read_root"""
    try:
        with open(str(index_html_path), "r", encoding="utf-8") as f:
            content = f.read()
            return Response(
                content=content,
                media_type="text/html",
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0"
                }
            )
    except FileNotFoundError:
        return "<h1>템플릿 파일을 찾을 수 없습니다.</h1>"

# 기존 HTML 라우트를 제거하고 패치된 함수로 재등록
html_paths = ["/", "/play", "/game", "/diary", "/report"]
# 기존 라우트 제거
app.routes = [route for route in app.routes if not (hasattr(route, 'path') and route.path in html_paths)]
# 패치된 함수로 재등록
for path in html_paths:
    app.get(path, response_class=HTMLResponse)(patched_read_root)

# Vercel용 핸들러 생성
handler = Mangum(app, lifespan="off")

