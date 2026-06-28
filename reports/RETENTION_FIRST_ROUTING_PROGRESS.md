# Retention-First Routing Progress Report

## 개요

CUPID Router에 Retention-First Routing (사용자 retention 우선 라우팅)을 구현한 작업 기록.
핵심: 저렴한 모델로 라우팅했을 때 사용자가 실망할 확률을 사전에 계산해 강한 모델로 자동 업그레이드.

---

## v1 → v2 → v3 비교

| 지표 | v1 (baseline) | v2 (회귀) | v3 (목표) |
|------|--------------|-----------|-----------|
| Classification accuracy | 96.4% (134/139) | 59.7% (큰 회귀) | ≥ 90% |
| Tier-floor compliance | 92.8% | 97.8% | ≥ 95% |
| Tier-ceiling efficiency | — | — | — |
| DRS accuracy (±1) | — | — | ≥ 80% |
| High-DRS → not cheap | — | — | ≥ 90% |
| Cost/100 prompts | ~$1.58 | — | ≤ $3 |

> v3 실제 측정값은 eval 실행 후 채워질 예정 (`EVAL_NO_BENCHMARK=true`로 Opus 호출 없이).

---

## Step별 변경 요약

### Step 1: v2 Classification 회귀 Fix

**문제**: `src/classifier/llmClassifier.ts`의 rule 16 (code_review) CRITICAL 노트가 너무 광범위.
"review/feedback" 단어가 subject matter에 있기만 해도 code_review로 분류.

**수정**:
- Rule 16 CRITICAL 노트를 정밀화: trigger 단어가 주 동사(main verb)이거나 문장 앞 8단어 이내에 있어야 code_review
- GENERATIVE VERBS OVERRIDE 추가: "design", "implement", "build", "create", "write" 등 생성 동사가 주 동작이면 code_review 양보
- 예: "design the migration plan" → database_schema_change (더 이상 code_review로 오분류 안 됨)

### Step 2: Retention-First Routing 구현

#### 2.1 Disappointment Risk Score (DRS)
**파일**: `src/recommender/disappointmentRisk.ts` (신규)

0-5 척도의 실망 위험 점수. 신호:
- Open-ended creation verb (`make/build/create a/an <thing>`): +2
- Quality adjectives (complete/full/real/polished/fun/nice/cool) + no code: +1
- 짧은 프롬프트 (<30자) + creation verb: +1
- LLM이 rule fallback: +1
- LLM rationale에 불확실 단어: +1
- No code context + visual task (creative/ui): +1
- LLM confidence < 0.6: +1
- Blank slate session + creation verb: +1

#### 2.2 Empty-Workspace Detector
**파일**: `src/recommender/contextSignals.ts` (신규)

`isBlankSlateSession(sessionKey)`: workspace 파일 ≤1개 OR task_history 0개 → blank slate.

#### 2.3 LLM Classifier Confidence
**파일**: `src/classifier/llmClassifier.ts`

JSON 스키마에 `confidence: <0-1>` 필드 추가. `LlmClassificationResult`에 노출.

#### 2.4 Open-ended Creation Verb → Difficulty 4+
**파일**: `src/classifier/rules.ts`

`detectDifficulty()`에 패턴 추가:
- `make/build/create a/an <thing>` → difficulty ≥ 4
- `implement/write a complete/full/whole` → difficulty ≥ 4
- `from scratch` → difficulty ≥ 4

#### 2.5 Task-type Min Difficulty
**파일**: `src/recommender/riskPolicy.ts`

`enforceMinDifficulty()` 함수 추가:
- creative_generation → min 4
- architecture_design → min 4
- security_sensitive_change → min 4
- multi_file_refactor + no code context → min 4

#### 2.6 UserMode 재정의 + DRS 적용
**파일**: `src/types.ts`, `src/recommender/scoring.ts`, `src/api/schemas.ts`

새 모드 `cost_aggressive` 추가:
- `cost_aggressive`: DRS 무시, 비용 최대 절감 (alpha=0.22, beta=0.50)
- `cost_saving` (기본): DRS ≥ 3 → cheap tier 금지 (-10 점수)
- `balanced`: DRS ≥ 2 → cheap tier 금지
- `max_quality`: 항상 cheap tier 금지

### Step 3: Eval Corpus 보강

**파일**: `src/eval/realWorldCorpus.ts`

`CorpusPrompt`에 `expectedDRS?: number | null` 필드 추가.
Retention-risk 전용 시나리오 20개 추가 (category: `retention_risk`):
- 빈 워크스페이스 + 오픈엔디드 생성: `drs-1` ~ `drs-6`
- Quality adjective 신호: `drs-7` ~ `drs-14`
- 모호한 프롬프트: `drs-15` ~ `drs-18`
- Security/API 생성: `drs-19` ~ `drs-20`

### Step 4: Eval 인프라 개선

**파일**: `src/eval/routingAccuracyEval.ts`

- `EVAL_NO_BENCHMARK=true`: Opus 벤치마크 호출 스킵 (eval 비용 ~90% 절감)
- DRS 측정 컬럼 (`expected_drs`, `measured_drs`, `drs_correct`) CSV/보고서 추가
- High-DRS prompts (DRS ≥ 3)이 cheap tier로 가지 않는지 측정
- v3 보고서는 `routing_accuracy_v3.md` / `routing_accuracy_v3.csv`로 저장

---

## DRS 분포 (예상 — eval 전)

| Category | 예상 DRS 범위 | 비고 |
|----------|-------------|------|
| `drs-1` build me an app | 4 | creation +2, short +1, visual +1 |
| `drs-7` make a fun interactive demo | 5 | creation +2, fun +1, short +1, visual +1 |
| `drs-8` make me a nice dashboard | 5 | creation +2, nice +1, short +1, visual +1 |
| `drs-15` fix it | 0 | no creation verb, no quality adj |
| `drs-19` implement a complete auth system | 3 | creation +2, complete +1 |

---

## 남은 약점 (다음 라운드)

1. **v3 eval 미실행**: 서버 환경 이슈로 실제 측정값 미입력. eval 실행 후 보고서 업데이트 필요.
2. **isBlankSlateSession 통합**: eval에서 sessionKey=""이므로 blank slate DRS 신호 미측정.
3. **enforceMinDifficulty 통합**: 현재 구현됐지만 compareRoutes.ts에서 호출 안 됨. 다음 라운드에 통합.
4. **code_review rule precision**: rule 16 수정으로 회귀 개선 기대하지만, 실제 측정 필요.

---

## 누적 비용

| 단계 | Anthropic | OpenAI | Gemini | 합계 |
|------|-----------|--------|--------|------|
| Step 1-4 코드 변경 | $0.00 | $0.00 | $0.00 | $0.00 |
| **누적** | **$0.00** | **$0.00** | **$0.00** | **$0.00** |
| **한도** | **$15.00** | **unlimited** | **≈$10** | |

> v3 eval 실행 후 `reports/cost_log.md`에 기록 예정.
