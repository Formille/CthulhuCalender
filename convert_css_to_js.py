#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CSS 파일을 JavaScript로 변환하여 동적 주입 가능하게 만듭니다."""

import json

# CSS 파일 읽기
with open('static/css/style.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# JavaScript 파일 생성
js_content = f"""// CSS 스타일을 동적으로 주입
// 이 파일은 static/css/style.css에서 자동 생성되었습니다.
(function() {{

    
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
with open('static/js/styles.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("CSS가 JavaScript로 변환되었습니다: static/js/styles.js")



