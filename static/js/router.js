// SPA 라우팅 관리 모듈
// History API를 사용한 클라이언트 사이드 라우팅

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.currentComponent = null;
        this.initialized = false;
        // DOM이 로드된 후 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            // DOM이 이미 로드된 경우 약간 지연시켜 라우트 등록이 완료되도록 함
            setTimeout(() => this.init(), 0);
        }
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // 네비게이션 링크 이벤트 처리
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[data-route]');
            if (link) {
                e.preventDefault();
                const route = link.dataset.route;
                this.navigate(route);
            }
        });

        // 브라우저 뒤로/앞으로 버튼 처리
        window.addEventListener('popstate', (e) => {
            const route = this.getRouteFromPath(window.location.pathname);
            this.showRoute(route, false);
        });

        // 초기 라우트 설정 - 라우트가 등록될 때까지 대기
        const initialRoute = this.getRouteFromPath(window.location.pathname);
        this.waitForRouteAndNavigate(initialRoute);
    }

    /**
     * 라우트가 등록될 때까지 대기한 후 네비게이션
     */
    waitForRouteAndNavigate(route, maxAttempts = 50, attempt = 0) {
        if (this.routes.has(route)) {
            this.navigate(route, false);
        } else if (attempt < maxAttempts) {
            setTimeout(() => {
                this.waitForRouteAndNavigate(route, maxAttempts, attempt + 1);
            }, 100);
        } else {
            if (window.DebugLogger) {
                window.DebugLogger.warn('라우트 등록 대기 시간 초과', { route });
            }
            console.warn(`라우트 등록 대기 시간 초과: ${route}`);
        }
    }

    /**
     * 경로에서 라우트 추출
     */
    getRouteFromPath(pathname) {
        if (pathname === '/' || pathname === '') return 'landing';
        if (pathname === '/play') return 'play';
        if (pathname === '/diary') return 'diary';
        if (pathname === '/report') return 'report';
        return 'landing';
    }

    /**
     * 라우트 등록
     */
    register(route, component) {
        this.routes.set(route, component);
        if (window.DebugLogger) {
            window.DebugLogger.info('라우트 등록', { route });
        }
        
        // 초기화가 완료되었고 현재 라우트가 없으면 초기 라우트로 이동
        if (this.initialized && !this.currentRoute) {
            const initialRoute = this.getRouteFromPath(window.location.pathname);
            if (route === initialRoute) {
                this.navigate(initialRoute, false);
            }
        }
    }

    /**
     * 네비게이션
     */
    navigate(route, pushState = true) {
        if (pushState) {
            const path = route === 'landing' ? '/' : `/${route}`;
            window.history.pushState({ route }, '', path);
            if (window.DebugLogger) {
                window.DebugLogger.info('라우트 네비게이션', { route, path });
            }
        }
        this.showRoute(route);
    }

    /**
     * 라우트 표시
     */
    async showRoute(route) {
        const component = this.routes.get(route);
        if (!component) {
            const error = new Error(`라우트를 찾을 수 없습니다: ${route}`);
            if (window.DebugLogger) {
                window.DebugLogger.error('라우트 표시 실패', error);
            }
            console.error('라우트 표시 실패:', error);
            return;
        }

        // 이전 컴포넌트 정리
        if (this.currentComponent && typeof this.currentComponent.destroy === 'function') {
            try {
                this.currentComponent.destroy();
            } catch (error) {
                if (window.DebugLogger) {
                    window.DebugLogger.error('컴포넌트 destroy 실패', error);
                }
                console.error('컴포넌트 destroy 실패:', error);
            }
        }

        // 네비게이션 활성화 업데이트
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.route === route);
        });

        // 헤더 표시/숨김
        const header = document.getElementById('app-header');
        if (header) {
            if (route === 'landing') {
                header.style.display = 'none';
            } else {
                header.style.display = 'block';
            }
        }

        // 게임 상태 표시/숨김
        const gameStatus = document.getElementById('game-status-section');
        if (gameStatus) {
            if (route === 'play') {
                gameStatus.style.display = 'block';
            } else {
                gameStatus.style.display = 'none';
            }
        }

        // 컴포넌트 렌더링
        const content = document.getElementById('app-content');
        if (!content) {
            const error = new Error('app-content 요소를 찾을 수 없습니다.');
            if (window.DebugLogger) {
                window.DebugLogger.error('컨텐츠 영역 없음', error);
            }
            console.error('컨텐츠 영역 없음:', error);
            return;
        }

        content.innerHTML = '';
        
        this.currentRoute = route;
        this.currentComponent = component;
        
        try {
            // 컴포넌트 초기화
            if (typeof component.init === 'function') {
                await component.init();
            }
            
            // 컴포넌트 렌더링
            if (typeof component.render === 'function') {
                const html = component.render();
                content.innerHTML = html;
            }
            
            // 컴포넌트 마운트
            if (typeof component.mount === 'function') {
                await component.mount();
            }

            if (window.DebugLogger) {
                window.DebugLogger.info('라우트 표시 완료', { route });
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('라우트 표시 중 오류', error);
            }
            console.error('라우트 표시 중 오류:', error);
            content.innerHTML = `<div class="error">페이지를 로드하는 중 오류가 발생했습니다: ${error.message}</div>`;
        }
    }
}

// 전역 라우터 인스턴스
window.Router = new Router();

