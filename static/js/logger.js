// 디버깅 콘솔 로그 유틸리티 모듈
// 프로젝트 전반에 체계적인 디버깅 로그를 제공합니다.

(function() {
    'use strict';

    // 로그 레벨 정의
    const LogLevel = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    };

    // 로그 레벨 이름
    const LogLevelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

    // 개발 환경 감지
    function isDevelopment() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || 
               hostname === '127.0.0.1' ||
               /^192\.168\.\d+\.\d+$/.test(hostname) ||
               /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
               /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(hostname);
    }

    // 타임스탬프 생성
    function getTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
    }

    // 호출 스택에서 파일명과 함수명 추출
    function getCallerInfo() {
        try {
            const stack = new Error().stack;
            if (!stack) return { file: 'unknown', function: 'unknown' };
            
            const lines = stack.split('\n');
            // logger.js를 호출한 파일 찾기 (보통 4번째 줄)
            for (let i = 3; i < lines.length && i < 10; i++) {
                const line = lines[i];
                if (line && !line.includes('logger.js')) {
                    // 파일명 추출 (예: "at processEncounter (app.js:1522:5)")
                    const fileMatch = line.match(/([^/\\]+\.js):(\d+):(\d+)/);
                    const funcMatch = line.match(/at\s+(\w+)/);
                    
                    if (fileMatch) {
                        return {
                            file: fileMatch[1],
                            function: funcMatch ? funcMatch[1] : 'anonymous',
                            line: fileMatch[2]
                        };
                    }
                }
            }
        } catch (e) {
            // 스택 추적 실패 시 무시
        }
        return { file: 'unknown', function: 'unknown' };
    }

    // 로그 포맷팅
    function formatLog(level, message, data, callerInfo) {
        const timestamp = getTimestamp();
        const levelName = LogLevelNames[level];
        const fileInfo = callerInfo.file !== 'unknown' 
            ? `${callerInfo.file}${callerInfo.function !== 'unknown' ? ':' + callerInfo.function : ''}`
            : '';
        
        const prefix = `[${timestamp}] [${levelName}]${fileInfo ? ' [' + fileInfo + ']' : ''}`;
        
        return {
            prefix,
            message,
            data,
            levelName,
            timestamp,
            callerInfo
        };
    }

    // DebugLogger 객체
    const DebugLogger = {
        currentLevel: isDevelopment() ? LogLevel.DEBUG : LogLevel.INFO,
        isDevelopment: isDevelopment(),
        levels: LogLevel,
        
        // 로그 레벨 설정
        setLevel: function(level) {
            if (typeof level === 'string') {
                level = LogLevel[level.toUpperCase()];
            }
            if (level !== undefined && level >= 0 && level <= 3) {
                this.currentLevel = level;
                this.info('로그 레벨 변경:', LogLevelNames[level]);
            }
        },
        
        // 현재 로그 레벨 가져오기
        getLevel: function() {
            return LogLevelNames[this.currentLevel];
        },
        
        // 로그 출력 여부 확인
        shouldLog: function(level) {
            return level >= this.currentLevel;
        },
        
        // DEBUG 로그
        debug: function(message, data) {
            if (!this.shouldLog(LogLevel.DEBUG)) return;
            const callerInfo = getCallerInfo();
            const formatted = formatLog(LogLevel.DEBUG, message, data, callerInfo);
            console.debug(formatted.prefix, message, data || '');
        },
        
        // INFO 로그
        info: function(message, data) {
            if (!this.shouldLog(LogLevel.INFO)) return;
            const callerInfo = getCallerInfo();
            const formatted = formatLog(LogLevel.INFO, message, data, callerInfo);
            console.info(formatted.prefix, message, data || '');
        },
        
        // WARN 로그
        warn: function(message, data) {
            if (!this.shouldLog(LogLevel.WARN)) return;
            const callerInfo = getCallerInfo();
            const formatted = formatLog(LogLevel.WARN, message, data, callerInfo);
            console.warn(formatted.prefix, message, data || '');
        },
        
        // ERROR 로그
        error: function(message, error) {
            if (!this.shouldLog(LogLevel.ERROR)) return;
            const callerInfo = getCallerInfo();
            const formatted = formatLog(LogLevel.ERROR, message, error, callerInfo);
            console.error(formatted.prefix, message, error || '');
        },
        
        // 함수 진입 로그
        logFunctionEntry: function(functionName, args) {
            if (!this.shouldLog(LogLevel.DEBUG)) return;
            const callerInfo = getCallerInfo();
            const funcName = functionName || callerInfo.function;
            const timestamp = getTimestamp();
            const fileInfo = callerInfo.file !== 'unknown' ? `[${callerInfo.file}]` : '';
            console.group(`[${timestamp}] [DEBUG] ${fileInfo} 함수 진입: ${funcName}`);
            if (args && Object.keys(args).length > 0) {
                console.debug('매개변수:', args);
            }
        },
        
        // 함수 종료 로그
        logFunctionExit: function(functionName, result, startTime) {
            if (!this.shouldLog(LogLevel.DEBUG)) return;
            const callerInfo = getCallerInfo();
            const funcName = functionName || callerInfo.function;
            const timestamp = getTimestamp();
            const fileInfo = callerInfo.file !== 'unknown' ? `[${callerInfo.file}]` : '';
            const duration = startTime ? ` (소요 시간: ${Date.now() - startTime}ms)` : '';
            if (result !== undefined) {
                console.debug('반환값:', result);
            }
            console.log(`[${timestamp}] [DEBUG] ${fileInfo} 함수 종료: ${funcName}${duration}`);
            console.groupEnd();
        },
        
        // API 요청 로그
        logAPIRequest: function(method, url, body) {
            if (!this.shouldLog(LogLevel.INFO)) return;
            const callerInfo = getCallerInfo();
            const timestamp = getTimestamp();
            const fileInfo = callerInfo.file !== 'unknown' ? `[${callerInfo.file}]` : '';
            console.group(`[${timestamp}] [INFO] ${fileInfo} API 요청: ${method} ${url}`);
            if (body) {
                // 민감한 정보 제거
                const sanitizedBody = this.sanitizeData(body);
                console.info('요청 본문:', sanitizedBody);
            }
        },
        
        // API 응답 로그
        logAPIResponse: function(method, url, response, duration) {
            if (!this.shouldLog(LogLevel.INFO)) return;
            const callerInfo = getCallerInfo();
            const timestamp = getTimestamp();
            const fileInfo = callerInfo.file !== 'unknown' ? `[${callerInfo.file}]` : '';
            const durationText = duration ? ` (소요 시간: ${duration}ms)` : '';
            console.info(`[${timestamp}] [INFO] ${fileInfo} API 응답: ${method} ${url}${durationText}`);
            if (response) {
                const sanitizedResponse = this.sanitizeData(response);
                console.info('응답 데이터:', sanitizedResponse);
            }
            console.groupEnd();
        },
        
        // 민감한 정보 제거
        sanitizeData: function(data) {
            if (!data || typeof data !== 'object') return data;
            
            const sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'apikey', 'authorization'];
            const sanitized = Array.isArray(data) ? [...data] : { ...data };
            
            for (const key in sanitized) {
                if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                    sanitized[key] = '[REDACTED]';
                } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
                    sanitized[key] = this.sanitizeData(sanitized[key]);
                }
            }
            
            return sanitized;
        },
        
        // 그룹 시작
        group: function(label) {
            if (!this.shouldLog(LogLevel.DEBUG)) return;
            console.group(label);
        },
        
        // 그룹 종료
        groupEnd: function() {
            if (!this.shouldLog(LogLevel.DEBUG)) return;
            console.groupEnd();
        }
    };

    // 전역 객체로 등록
    window.DebugLogger = DebugLogger;
    
    // 초기화 로그
    DebugLogger.info('DebugLogger 초기화 완료', {
        level: DebugLogger.getLevel(),
        isDevelopment: DebugLogger.isDevelopment
    });
})();



