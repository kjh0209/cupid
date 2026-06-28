# API Key 사용료 영수증 발급 가이드 (학교 지원금 정산용)

> **중요**: Claude Code(이 CLI)는 어떠한 API Key도 발급·구매·결제하지 않습니다.
> 본 프로젝트의 `.env`에 들어있는 모든 키는 사용자(choo@sparcs.org)께서 각 제공자에 직접 가입하여 결제하신 것입니다.
> 따라서 영수증은 각 제공자의 콘솔에서 직접 다운로드해야 합니다.

현재 `.env`에 설정된 키 기준으로, 이 프로젝트가 실제로 비용을 발생시키는 제공자는 아래와 같습니다.

| 제공자 | `.env` 키 | 설정 여부 | 결제 콘솔 위치 |
|--------|-----------|----------|----------------|
| OpenAI | `OPENAI_API_KEY` | ✅ 설정됨 | https://platform.openai.com/settings/organization/billing/history |
| OpenRouter | `OPENROUTER_API_KEY` | ✅ 설정됨 | https://openrouter.ai/settings/credits |
| Anthropic | `ANTHROPIC_API_KEY` | ⚠️ 비어 있음 | https://console.anthropic.com/settings/billing (사용한 적 없으면 무시) |
| Google AI | `GOOGLE_API_KEY` | ⚠️ 비어 있음 | https://console.cloud.google.com/billing |

---

## 1. OpenAI 영수증 발급

### A. 월별 인보이스(공식 영수증, 학교 제출용)

1. https://platform.openai.com/settings/organization/billing/history 로 이동
2. **Billing → Billing history** 메뉴에서 청구 월을 선택
3. 각 인보이스 행 우측 **"View"** 또는 **"Download invoice"** 클릭
4. PDF로 저장 — 사업자등록번호·결제 금액·항목(예: "gpt-4o-mini API usage")이 명시됨

> 💡 **사업자등록번호/세금계산서 발행**: Billing → Billing details에서 사업자 정보(VAT/Tax ID)를 미리 입력해두면 인보이스에 자동 표기됩니다. 학교 정산 시 한국 사업자등록번호(예: SPARCS 또는 학교)를 등록해 두세요.

### B. 항목별 상세 사용 내역 (모델·일자·토큰까지)

월별 인보이스에는 모델별 합계만 나옵니다. 더 세밀한 내역이 필요하면:

1. https://platform.openai.com/usage 로 이동
2. 우측 상단 날짜 범위 선택 → **"Export"** 클릭
3. CSV가 다운로드됨 (`request_id`, `model`, `n_context_tokens`, `n_generated_tokens`, `cost` 컬럼 포함)

---

## 2. OpenRouter 영수증 발급

OpenRouter는 **선불 충전식**이라 결제 영수증과 사용 내역이 분리되어 있습니다.

### A. 충전(결제) 영수증

1. https://openrouter.ai/settings/credits 로 이동
2. **Credit history** 섹션에서 충전(Top-up) 내역 확인
3. 각 결제 행의 **"Invoice"** / **"Receipt"** 버튼 클릭 → PDF 다운로드

### B. 항목별 사용 내역 (어느 모델에 얼마)

1. https://openrouter.ai/activity 로 이동
2. 날짜 범위 필터 적용
3. 우상단 **"Export CSV"** 클릭 (모델·요청 시각·토큰·비용 포함)

> 💡 **OpenRouter는 한국어 세금계산서를 자동 발행하지 않습니다.** 학교 정산 담당자가 영문 인보이스를 인정하지 않는다면, 신용카드 명세서 + Activity CSV + 충전 영수증 PDF를 묶어 제출하는 방식이 가장 안전합니다.

---

## 3. Anthropic 영수증 (현재 키 비어 있으므로 참고용)

`.env`의 `ANTHROPIC_API_KEY`가 비어 있어 직접 호출은 발생하지 않습니다. 단, OpenRouter를 통해 Claude 모델(`anthropic/claude-*`)을 호출한 비용은 **OpenRouter 인보이스에 합산**되어 청구되므로 별도 Anthropic 영수증은 없습니다.

만약 향후 Anthropic 직접 키를 쓰게 되면:
1. https://console.anthropic.com/settings/billing
2. **Invoices** 탭에서 월별 PDF 다운로드

---

## 4. Google AI / Vertex 영수증 (현재 키 비어 있으므로 참고용)

`.env`의 `GOOGLE_API_KEY`도 비어 있습니다. Gemini 호출은 OpenRouter 경유로 처리되므로 OpenRouter 인보이스에 포함됩니다.

만약 직접 키를 쓰게 되면:
1. https://console.cloud.google.com/billing
2. 결제 계정 선택 → **거래(Transactions)** → 월별 청구서(.pdf) 다운로드
3. 한국 사업자라면 **세금 정보 → Tax ID** 등록 후 세금계산서 발행 가능

---

## 5. 학교 정산 제출 시 권장 패키지 (실전 팁)

학교 회계팀이 보통 요구하는 항목별 묶음:

```
정산 패키지/
├── 01_월별_인보이스/
│   ├── openai_2026-05_invoice.pdf
│   └── openrouter_2026-05_topup_receipt.pdf
├── 02_항목별_사용내역/
│   ├── openai_usage_2026-05.csv      ← /usage 에서 export
│   └── openrouter_activity_2026-05.csv ← /activity 에서 export
├── 03_프로젝트_증빙/
│   ├── 프로젝트_개요.md (이 cupid-engineered-llm-router가 무엇인지)
│   └── 모델_사용_사유.md (어떤 모델을 왜 호출했는지)
└── 04_카드명세서.pdf  ← 본인 신용카드 청구내역에서 발췌
```

`03_프로젝트_증빙`은 회계팀이 "외부 LLM API를 학교 돈으로 결제할 만한 사유"를 묻기 때문에 필요합니다. 본 프로젝트 `README.md`와 `PRODUCT_ROADMAP.md`의 캡쳐를 같이 첨부하면 통과율이 올라갑니다.

---

## 6. 자주 묻는 질문

**Q. 사업자등록번호가 없는 미국 회사(OpenAI/OpenRouter) 인보이스도 인정되나요?**
A. 학교 회계 규정에 따라 다릅니다. SPARCS·KAIST 등은 보통 영문 인보이스 + 사용 사유서 + 결제 증빙(카드 명세서)을 묶어 제출하면 인정합니다. 단, **반드시 사전에 회계팀 담당자에게 "해외 SaaS API 결제 영수증 양식"을 물어보고 진행하세요.**

**Q. 영수증 발급일이 결제일이 아니라 사용일로 나와야 한다는데요?**
A. OpenAI/OpenRouter 모두 **결제일(=충전일/청구일) 기준**으로 인보이스를 발행합니다. 사용일자별 분리가 필요하면 `/usage` CSV에서 일자별 필터링하여 별도 표를 첨부하세요.

**Q. 한 인보이스에 여러 프로젝트가 섞여 있으면?**
A. API Key 단위로 사용 내역을 분리하세요. OpenAI는 **Project Keys**(https://platform.openai.com/settings/organization/projects)를 만들면 프로젝트별로 사용량·인보이스가 자동 분리됩니다. 학교 지원 받는 프로젝트마다 별도 Project Key를 발급하는 것을 강력히 권장합니다.

---

## 7. 자동화: 사용 내역 일일 다운로드 (옵션)

OpenAI는 공식 Usage Export API를 제공합니다. 다음 cron 스크립트를 두면 매일 CSV가 적립됩니다:

```bash
# 매일 새벽 1시 OpenAI Usage CSV 다운로드 (예시)
curl -H "Authorization: Bearer $OPENAI_ADMIN_KEY" \
  "https://api.openai.com/v1/organization/usage/completions?start_time=$(date -d 'yesterday' +%s)&end_time=$(date +%s)" \
  > usage/openai-$(date +%F).json
```

> 단, 이건 **Admin Key** 권한이 필요하며 일반 API Key로는 받을 수 없습니다. https://platform.openai.com/settings/organization/admin-keys 에서 별도 발급.

OpenRouter는 공식 사용량 export API가 아직 없어, 웹 콘솔의 CSV export를 수동으로 받는 것이 유일한 방법입니다.
