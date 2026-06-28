# CUPID Router — Value Proposition & Performance Data

> **핵심 메시지**: Claude Code Max ($200/month)을 구독하는 대신 Cupid를 사용하면,
> 동급 또는 더 나은 코딩 결과를 90% 낮은 비용으로 얻을 수 있습니다.

---

## 1. 비용 비교 (Cost Comparison)

### Claude Code Max vs Cupid Router

| 항목 | Claude Code Max | **Cupid Router** | 절감 |
|------|----------------|-----------------|------|
| 월 구독료 | $200/month | **API 사용량만** | ~$150–180 절감 |
| 간단한 질문 (설명) | Opus 풀요금 | gpt-4o-mini ($0.15/1M tokens) | **96% 절감** |
| 단위 테스트 작성 | Opus 풀요금 | gpt-4o-mini | **96% 절감** |
| 복잡한 버그 수정 | Opus 풀요금 | Sonnet 4.6 ($3/1M) | **80% 절감** |
| 보안 민감 변경 | Opus 풀요금 | Sonnet/Gemini Pro | **60–70% 절감** |
| DB 마이그레이션 | Opus 풀요금 | Sonnet 4.6 (strong) | **70% 절감** |
| 창의적 앱 생성 | Opus 풀요금 | Gemini 2.5 Pro | **50% 절감** |

**실측 데이터** (139개 실제 개발자 프롬프트 평가):
- 평균 비용 절감: **90.0%** (라우터 vs Claude Opus 기준)
- 100개 요청 당 비용: **$1.58** (vs Opus 기준 $15.88)

---

## 2. 라우팅 정확도 (Routing Accuracy)

### v1 평가 결과 (2026-06-28, 139개 프롬프트)

| 지표 | 값 | 목표 |
|------|-----|------|
| **분류 정확도** | **96.4%** (134/139) | ≥90% |
| **Tier-floor 준수** | **92.8%** (129/139) | ≥95% |
| Tier-ceiling 효율 | 98.6% (137/139) | ≥95% |
| 창의적 작업 디자인 품질 | 94.8% (16개 visual tasks) | ≥80% |

### 카테고리별 분류 정확도

| 카테고리 | N | 정확도 | 라우팅 선택 |
|---------|---|--------|-----------|
| creative_generation | 17 | **100%** | gemini-2.5-pro |
| architecture_design | 6 | **100%** | gemini-2.5-pro |
| api_implementation | 8 | **100%** | claude-sonnet-4.6 |
| devops_config | 6 | **100%** | gemini-2.5-pro |
| documentation_write | 5 | **100%** | gpt-4o-mini |
| local_bug_fix | 12 | **100%** | claude-sonnet-4.6 |
| multi_file_refactor | 6 | **100%** | claude-sonnet-4.6 |
| performance_optimization | 6 | **100%** | claude-sonnet-4.6 |
| security_sensitive_change | 10 | **100%** | gemini-2.5-pro |
| ui_change | 9 | **100%** | gpt-4o-mini |
| dependency_update | 4 | **100%** | claude-sonnet-4.6 |
| explanation | 12 | 92% | gpt-4o-mini |
| simple_edit | 11 | 91% | gpt-4o-mini |
| test_generation | 11 | 91% | gpt-4o-mini |
| code_review | 5 | 80% | gpt-4o-mini |

---

## 3. 모델 선택 전략 (Model Selection Strategy)

Cupid가 사용하는 17가지 태스크 분류와 각 모델 배정:

```
Cheap tier (gpt-4o-mini, $0.15/1M)
├── explanation         → 질문/개념 설명
├── simple_edit         → 이름 변경, 주석 추가
├── documentation_write → README, JSDoc
├── code_review         → 저위험 코드 리뷰
└── prompt_rewrite_only → 프롬프트 최적화

Mid tier (claude-sonnet-4.6, ~$3/1M)
├── local_bug_fix       → 버그 수정 (저위험)
├── test_generation     → 단위/통합 테스트
├── api_implementation  → REST/GraphQL 엔드포인트
└── dependency_update   → 패키지 업그레이드

Strong tier (claude-sonnet-4.6 / gemini-2.5-pro, ~$10-15/1M)
├── security_sensitive_change  → auth, crypto, 결제
├── database_schema_change     → 마이그레이션 (불가역)
├── architecture_design        → 시스템 설계
├── multi_file_refactor        → 대규모 리팩터
├── creative_generation        → 앱/게임/데모 생성
├── performance_optimization   → 복잡한 최적화
└── devops_config              → CI/CD, K8s, Terraform
```

---

## 4. 품질 보장 메커니즘 (Quality Guarantee Mechanisms)

### 4.1 다층 분류 시스템
1. **규칙 기반 분류기** (무료, 즉각적): 17개 태스크 타입 × 수십 개 키워드 사전
2. **LLM 보조 분류기** (Claude Haiku 4.5, $0.001/100건): 애매한 케이스 처리
3. **태스크-모델 친화도 표**: SWE-bench, Aider Polyglot 기반 실증 데이터

### 4.2 Tier-floor 보호 정책
보안 민감, DB 스키마 변경, 아키텍처 설계 → **항상 strong tier로 라우팅**.
저렴한 모델이 생성한 auth 코드나 DB 마이그레이션은 보안 사고/데이터 손실로 이어짐.

### 4.3 Disappointment Risk Score (DRS) — v2 신규
사용자가 저렴한 모델 결과를 보고 실망할 확률을 0-5 척도로 계산:
- 개방형 창작 동사 ("make/build/create a ...") → +2
- 품질 형용사 ("real", "polished", "fun") → +1
- 짧은 프롬프트 + 창작 동사 → +1
- LLM 분류기 불확실성 → +1
- 시각적 작업 + 코드 컨텍스트 없음 → +1

**DRS ≥ 3** (기본 모드): cheap tier 자동 차단

---

## 5. 경쟁 우위 (Competitive Advantages)

| 기능 | Cursor/Copilot | **Cupid** | Claude Code Max |
|------|---------------|-----------|----------------|
| 자동 모델 선택 | ❌ (수동) | **✅ 자동** | ❌ (Opus 고정) |
| 비용 최적화 | ❌ | **✅ 90% 절감** | ❌ |
| 보안 작업 보호 | ❌ | **✅ Strong tier 강제** | ✅ |
| 창의적 작업 품질 | ❌ | **✅ 94.8%** | ✅ |
| 프롬프트 최적화 | ❌ | **✅** | ❌ |
| VSCode 확장 | ✅ | **✅** | ✅ |
| 로컬/프라이빗 모델 | ❌ | **✅** | ❌ |
| 멀티 프로바이더 | ❌ | **✅ OpenAI+Anthropic+Google** | ❌ |

---

## 6. 월간 절감 시나리오 (Monthly Savings Scenarios)

### 개인 개발자 (1일 50건 요청)
```
월 총 요청: ~1,500건
  - 설명/간단수정 (50%): 750건 → gpt-4o-mini → $0.11
  - 중간 복잡도 (35%): 525건 → sonnet-4.6 → $1.57
  - 고위험/창의적 (15%): 225건 → gemini-pro/sonnet → $3.38
  
총 비용: ~$5/month
Claude Code Max 대비 절감: $195/month (97.5% 절감)
```

### 소규모 팀 (5명, 1인당 1일 40건)
```
월 총 요청: ~6,000건
  라우터 비용: ~$20/month
  5× Claude Code Max: $1,000/month
  절감: $980/month (98% 절감)
```

---

## 7. 기술 로드맵 (Technical Roadmap)

### 현재 완료 (v1)
- ✅ 17개 태스크 타입 분류
- ✅ 규칙 기반 + LLM 보조 분류기
- ✅ 태스크-모델 친화도 스코어링
- ✅ Tier-floor 보호 정책
- ✅ RAG 기반 모델 추천 개선
- ✅ Context Preservation Layer (CPL)
- ✅ 프롬프트 최적화 레이어
- ✅ VSCode 확장 (사이드바 채팅 + 스트리밍)
- ✅ 실시간 평가 시스템 (139개 실제 프롬프트)

### 진행 중 (v2)
- 🔧 Disappointment Risk Score (DRS) 시스템
- 🔧 DB/Security → Strong tier 자동 강제화
- 🔧 cost_aggressive 모드 (CI/배치용)
- 🔧 분류 회귀 수정 (v2에서 59.7% → 90%+ 목표)

### 다음 단계 (v3)
- 📋 실제 사용자 피드백 루프 (수락률 추적)
- 📋 모델 캐싱으로 추가 50% 비용 절감
- 📋 팀 공유 컨텍스트 (레포 히스토리 기반)
- 📋 웹 대시보드 (비용/품질 추적)

---

## 8. 참고: 모델 가격표 (2026년 6월 기준)

| 모델 | 입력 ($/1M) | 출력 ($/1M) | 특성 |
|------|------------|------------|------|
| gpt-4o-mini | $0.15 | $0.60 | 빠름, 설명/간단작업 최적 |
| claude-haiku-4-5 | $1.00 | $5.00 | 분류기용 |
| claude-sonnet-4.6 | $3.00 | $15.00 | 코딩 최강, 보안/DB |
| gemini-2.5-flash | $0.30 | $1.00 | 창의적 작업, 긴 컨텍스트 |
| gemini-2.5-pro | $1.25 | $10.00 | 아키텍처/창의적 |
| claude-opus-4.x | $15.00 | $75.00 | 벤치마크 기준선 |

---

*Last updated: 2026-06-28 | Cupid Router v1.0 | KAIST OverEdge 창업팀*
