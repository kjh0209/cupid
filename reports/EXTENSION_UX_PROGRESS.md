# CUPID VS Code Extension — UX Progress Report

## v0.3.0 — Cursor/Antigravity-grade UX + Savings Analytics

### 피치덱 / 설계 자료 반영 사항

피치덱(`pitch deck script.txt`)과 디자인 설계서(`아이디어의_디자인_완성본.txt`)에서 도출한 핵심 디자인 원칙:
- **decision-aware interface**: chat 창이 아닌 비용·품질·의사결정 중심 UI
- **CUPID Arbitrage panel**: 누적 절감액·baseline 대비 savings를 실시간 노출
- **투명성**: 모델 선택 이유를 숨기지 않음 — routing 배지로 즉시 표시
- **슬로건**: "Don't code stupid. Use Cupid."

---

### 구현 완료 기능

#### v0.3.0 신규 기능

**1. CUPID Arbitrage Dashboard** (`analytics.ts` + `analyticsPanel.ts` + `analytics.html`)
- 매 응답 완료 시 실제 비용 vs Claude Opus 4 baseline 비용 자동 계산
- `Ctrl+Shift+J` 또는 사이드바 📊 아이콘으로 대시보드 열기
- 4개 KPI 카드: Total Saved · Avg Savings % · Total Requests · Actual Cost
- **4개 탭**:
  - 📈 **개요**: 비용 비교 바 차트, task type별 사용 현황
  - 🔢 **아낀 토큰**: 토큰 통계, Cupid vs Opus 단가 비교, Input/Output 비율
  - 🤖 **모델 비율**: 모델별 사용 횟수·비용 가로 바 차트, tier 분포
  - 📋 **히스토리**: 최근 100건 요청 테이블 (시간·taskType·모델·토큰·비용·절감)
- globalState 기반 영속 저장 (최대 2,000건)

**2. 실시간 savings 배지** (`chat.html`)
- 매 응답 완료 후 `↓94% vs Opus ($0.00123 saved)` 초록 배지 자동 표시
- 툴바에 세션 누적 절감액 실시간 업데이트: `↓ $0.0045 saved`

**3. 백엔드 버그 수정** (`src/api/streamRoutes.ts`)
- CPL `recordTask`에 `tokensIn: 0, tokensOut: 0, costUsd: 0` 하드코딩 → 실제 usage 데이터 사용으로 수정

**4. UX 개선** (`chat.html`)
- 빈 상태: 로고·슬로건·연결 상태 표시·3개 예시 프롬프트 칩
- 스트리밍 중 **■ Stop 버튼** 표시
- 라이트웨이트 마크다운 렌더링 (heading·bold·italic·list·blockquote·inline code)
- 코드 블록에 언어·줄 수 헤더 + Copy 버튼
- 백엔드 연결 상태 점 (초록=연결·빨강=미연결)

**5. 우측 패널 auto-move** (`extension.ts`)
- 첫 활성화 시 Secondary Side Bar(우측)로 자동 이동

**6. Status bar 개선** (`extension.ts`)
- 절감액이 있으면: `$(robot) Cupid · $0.0045 saved`
- 없으면: `$(robot) Cupid`

---

### 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `vscode-extension/src/analytics.ts` | **신규** — 절감액 추적 store |
| `vscode-extension/src/analyticsPanel.ts` | **신규** — Analytics 대시보드 패널 |
| `vscode-extension/media/analytics.html` | **신규** — 4탭 Analytics UI |
| `vscode-extension/media/chat.html` | 전면 개선 — savings 배지·빈 상태·Stop 버튼·마크다운 |
| `vscode-extension/src/chatView.ts` | analytics 기록·savings 계산·파일 목록 핸들러 |
| `vscode-extension/src/extension.ts` | analytics 초기화·새 명령·status bar 개선 |
| `vscode-extension/package.json` | v0.3.0·새 명령·메뉴·단축키 |
| `src/api/streamRoutes.ts` | **버그 수정** — CPL recordTask 실제 토큰 수 기록 |

---

### 제약 사항

1. **분석 데이터 baseline**: Claude Opus 4 가격($15/$75 per M 토큰)으로 고정. 실제 "사용하지 않은 모델"과 다를 수 있음.
2. **토큰 절감**: Prompt Optimizer의 30-50% 토큰 압축은 별도 추적 미구현 (백엔드에서 before/after 토큰 수가 필요).
3. **per-hunk accept/reject**: diff decoration 라이브러리 없이 전체 파일 수준 Apply/Reject만 지원 (v0.4.0 예정).

---

### 빌드 방법

```bash
cd vscode-extension
npm install
npm run compile   # tsc → out/
npm run package   # vsce package → cupid-ai-router-0.3.0.vsix
code --install-extension cupid-ai-router-0.3.0.vsix
```

### 단축키 요약

| 키 | 기능 |
|----|------|
| `Ctrl+Shift+K` | Cupid 채팅 열기 |
| `Ctrl+Shift+J` | Savings Dashboard 열기 |
| `Ctrl+Shift+L` | 선택 코드 질문 |
