# Retention-First Routing — Progress Report (Round 3)

## 버전 진화 비교

| 지표 | v1 (기준) | v2 (이전) | v3 목표 | 상태 |
|------|----------|----------|---------|------|
| Classification Accuracy | **96.4%** (134/139) | **59.7%** (v2 회귀) | ≥ 90% | 🔧 Rule 16 수정 완료 |
| Tier-floor Compliance | 92.8% (10위반) | 97.8% | ≥ 98% | 🔧 Strong tier 강제화 |
| DRS Correct (high-DRS → strong) | N/A | N/A | ≥ 90% | 🆕 DRS 시스템 신규 |
| Cost Savings vs Opus | 90.0% | ~90% | ≥ 88% | 유지 |
| Corpus Size | 139 | 139 | **159** | ✅ +20 retention-risk |

## Round 3 주요 변경사항

### Step 1: v2 분류 회귀 Fix — LLM Classifier Rule 16 정밀화

**문제**: Rule 16 ("review this X" → code_review)이 너무 광범위하여
"design the migration plan", "implement the auth flow" 같은 generative 프롬프트도
code_review로 끌어당겼음 → v2 classification 59.7% (큰 회귀)

**수정**:
- Rule 16 발동 조건: "review", "give feedback on", "what would you change", "check this for issues" 등
  **리뷰 동사가 주 동사**일 때만 code_review
- "design/implement/build/create/write/add/make/fix/refactor"가 주 동작이면 code_review 양보
- 명시적 예시 추가: ✅ code_review vs ❌ NOT code_review

**기대 효과**: classification accuracy v2 59.7% → 90%+ 회복

### Step 2: Tier-Floor 강화

**변경 전 (v1/v2)**:
- security_sensitive_change → mid tier 허용
- database_schema_change → mid tier 허용
- riskLevel 4 → mid tier 허용

**변경 후 (v3)**:
- security_sensitive_change → **strong tier 필수** (auth 버그 = 보안 사고)
- database_schema_change → **strong tier 필수** (비가역적 데이터 ops)
- riskLevel 4 → **strong tier 필수** (concurrency, memory leaks, sharding)
- architecture_design (balanced/max) → **strong tier 필수**

**기대 효과**: 10건 tier-floor 위반 → 0건

### Step 3: DRS (Disappointment Risk Score) 시스템 — 신규

새 파일: `src/recommender/disappointmentRisk.ts`

```
DRS 0-5 척도 (8가지 신호):
  +2  open-ended creation verb (make/build/create ... a/an)
  +1  quality adjective (polished, real, cool, fun) + no code context
  +1  prompt < 30 chars + creation verb
  +1  LLM fell back to rules
  +1  ambiguous LLM rationale
  +1  no code context + visual/interactive task
  +1  blank slate session + creation verb
  +1  LLM confidence < 0.6
```

**모드별 DRS 정책**:
| Mode | DRS threshold for cheap veto |
|------|------------------------------|
| cost_aggressive | 없음 (CI/배치용) |
| cost_saving (기본) | DRS ≥ 3 |
| balanced | DRS ≥ 2 |
| max_quality | 항상 |

### Step 4: rules.ts 개선

**새 기능**:
- `detectDifficulty()` — open-ended creation verb + no code context → difficulty ≥ 4
- `detectDifficulty()` — memory leak, race condition, SIMD vectorize → difficulty ≥ 4
- `detectRiskLevel()` — memory leak, race condition, sharding, SIMD → riskLevel ≥ 4

### Step 5: Corpus 확장 — 20개 retention-risk 시나리오

새 카테고리: `drs-1` ~ `drs-20`

| 시나리오 타입 | 건수 | expectedDRS 범위 |
|-------------|------|----------------|
| Open-ended creation (blank workspace) | 8 | 3-4 |
| Ambiguous prompts | 4 | 1-2 |
| Short creation verb | 3 | 3 |
| With code context (low DRS) | 2 | 0 |
| Code review misclassification guard | 1 | 0 |
| Detailed spec (lower DRS) | 2 | 2 |

### Step 6: 새 UserMode — `cost_aggressive`

CI/배치 파이프라인용. DRS 무시, 비용 최대 절감.
기존 `cost_saving`은 retention-leaning 의미 유지.

## 테스트 현황

| 파일 | 테스트 수 | 타입 |
|------|---------|------|
| `tests/riskPolicy.test.ts` | 14 | 기존 |
| `tests/classifier.test.ts` | 22 | 기존 |
| `tests/recommender.test.ts` | 11 | 기존 |
| `tests/disappointmentRisk.test.ts` | **40** | 🆕 신규 |
| `tests/classifier.advanced.test.ts` | **45** | 🆕 신규 |
| `tests/riskPolicy.advanced.test.ts` | **30** | 🆕 신규 |
| `tests/scoringPipeline.test.ts` | **12** | 🆕 신규 |
| **합계** | **174** | |

## v3 평가 실행 방법

```bash
pnpm install
pnpm ingest
PORT=3500 pnpm exec tsx src/index.ts &
sleep 8
EVAL_BASE_URL=http://localhost:3500 EVAL_NO_BENCHMARK=true pnpm exec tsx src/eval/routingAccuracyEval.ts
```

## 남은 과제 (Round 4)

1. **`enforceMinDifficulty()` — compareRoutes.ts 통합** (구현됨, 연결만 필요)
2. **DRS → compareRoutes.ts 통합** (scoreModel에 drsForbidsCheap 연결)
3. **v3 실제 eval 실행** (서버 환경 필요)
4. **perf-6 ("vectorize") 분류 재검토** — 현재 unknown으로 오분류 가능
5. **`isBlankSlateSession` eval 연동** (sessionKey 없어서 blank slate 미측정)

## 비용 사용

Round 3 코드 전용 구현. API 호출 없음.

참조: `reports/cost_log.md`
