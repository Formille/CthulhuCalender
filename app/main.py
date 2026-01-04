from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from app.api import game, narrative
import json
from pathlib import Path

app = FastAPI(
    title="365 어드벤처: 크툴루",
    description="1926년 아컴을 배경으로 한 일일 캘린더 게임",
    version="1.0.0"
)

# CSS 변환 함수
def convert_css_to_js():
    """CSS 파일을 JavaScript로 변환"""
    try:
        css_path = Path('static/css/style.css')
        js_path = Path('static/js/styles.js')
        
        if not css_path.exists():
            return
        
        # CSS 파일 읽기
        css_content = css_path.read_text(encoding='utf-8')
        
        # JavaScript 파일 생성
        js_content = f"""// CSS 스타일을 동적으로 주입
// 이 파일은 static/css/style.css에서 자동 생성되었습니다.
(function() {{
    // 이미 주입되었는지 확인
    if (document.getElementById('injected-styles')) {{
        return;
    }}
    
    // <style> 태그 생성 및 CSS 주입
    const style = document.createElement('style');
    style.id = 'injected-styles';
    style.textContent = {json.dumps(css_content)};
    
    // <head>에 추가 (가능한 한 빨리)
    if (document.head) {{
        document.head.appendChild(style);
    }} else {{
        // head가 아직 없으면 DOMContentLoaded 대기
        document.addEventListener('DOMContentLoaded', function() {{
            document.head.appendChild(style);
        }});
    }}
}})();
"""
        
        # JavaScript 파일 저장
        js_path.parent.mkdir(parents=True, exist_ok=True)
        js_path.write_text(js_content, encoding='utf-8')
        print("✓ CSS가 JavaScript로 변환되었습니다: static/js/styles.js")
    except Exception as e:
        print(f"⚠ CSS 변환 중 오류: {e}")

# Startup 이벤트: 서버 시작/리로드 시 CSS 변환
@app.on_event("startup")
async def startup_event():
    convert_css_to_js()

# CORS 설정

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(game.router)
app.include_router(narrative.router)

# 정적 파일 서빙
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def read_root():
    """모든 경로를 SPA로 리다이렉트"""
    try:
        with open("index.html", "r", encoding="utf-8") as f:
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


@app.get("/play", response_class=HTMLResponse)
async def read_play():
    """SPA로 리다이렉트"""
    return await read_root()


@app.get("/game", response_class=HTMLResponse)
async def read_game():
    """SPA로 리다이렉트"""
    return await read_root()


@app.get("/diary", response_class=HTMLResponse)
async def read_diary():
    """SPA로 리다이렉트"""
    return await read_root()


@app.get("/report", response_class=HTMLResponse)
async def read_report():
    """SPA로 리다이렉트"""
    return await read_root()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

