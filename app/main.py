from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from app.api import game, narrative

app = FastAPI(
    title="365 어드벤처: 크툴루",
    description="1926년 아컴을 배경으로 한 일일 캘린더 게임",
    version="1.0.0"
)

# CORS 설정
from fastapi.middleware.cors import CORSMiddleware

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
    """랜딩 페이지 (항상 표시)"""
    try:
        with open("templates/landing.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "<h1>랜딩 페이지를 찾을 수 없습니다.</h1>"


@app.get("/play", response_class=HTMLResponse)
async def read_play():
    """게임 플레이 페이지"""
    try:
        with open("templates/index.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "<h1>템플릿 파일을 찾을 수 없습니다.</h1>"


@app.get("/game", response_class=HTMLResponse)
async def read_game():
    """게임 페이지 (하위 호환성을 위해 /play로 리다이렉트)"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/play", status_code=301)


@app.get("/diary", response_class=HTMLResponse)
async def read_diary():
    """일기장 페이지"""
    try:
        with open("templates/diary.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "<h1>템플릿 파일을 찾을 수 없습니다.</h1>"


@app.get("/report", response_class=HTMLResponse)
async def read_report():
    """보고서 페이지"""
    try:
        with open("templates/report.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "<h1>템플릿 파일을 찾을 수 없습니다.</h1>"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

