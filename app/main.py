from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from app.api import game, narrative

app = FastAPI(
    title="365 어드벤처: 크툴루",
    description="1926년 아컴을 배경으로 한 일일 캘린더 게임",
    version="1.0.0"
)

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
        with open("/index.html", "r", encoding="utf-8") as f:
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

