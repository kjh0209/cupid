# Model Catalog

Generated: 2026-06-28T07:12:31.019Z

## Models

| Model | Provider | Tier | Input $/M | Output $/M | Cached $/M | Context | Max Output | Coding Score | Source |
|-------|----------|------|-----------|------------|------------|---------|------------|--------------|--------|
| Claude Opus 4 | anthropic | strong | $15.00 | $75.00 | $1.50 | 200K | 32K | 72.7% | [link](https://www.anthropic.com/pricing) |
| Claude Sonnet 4 | anthropic | strong | $3.00 | $15.00 | $0.30 | 200K | 16K | 62.3% | [link](https://www.anthropic.com/pricing) |
| GPT-4o | openai | strong | $5.00 | $15.00 | $2.50 | 128K | 16K | 46.4% | [link](https://openai.com/pricing) |
| o1 | openai | strong | $15.00 | $60.00 | $7.50 | 200K | 100K | 48.8% | [link](https://openai.com/pricing) |
| Gemini 2.5 Pro | google | strong | $1.25 | $10.00 | $0.31 | 1000K | 66K | 63.4% | [link](https://ai.google.dev/pricing) |
| Claude Opus 4.7 | anthropic | strong | $5.00 | $25.00 | $0.50 | 1000K | 32K | 78.0% | [link](https://www.anthropic.com/pricing) |
| Claude Sonnet 4.6 | anthropic | strong | $3.00 | $15.00 | $0.30 | 1000K | 32K | 69.0% | [link](https://www.anthropic.com/pricing) |
| Claude 3.5 Sonnet (Oct 2024) | anthropic | mid | $3.00 | $15.00 | $0.30 | 200K | 8K | 49.9% | [link](https://www.anthropic.com/pricing) |
| GPT-4o mini | openai | mid | $0.15 | $0.60 | $0.07 | 128K | 16K | 28.4% | [link](https://openai.com/pricing) |
| o3-mini | openai | mid | $1.10 | $4.40 | $0.55 | 200K | 100K | 49.3% | [link](https://openai.com/pricing) |
| Gemini 3.5 Flash | google | mid | $1.50 | $9.00 | $0.37 | 1000K | 32K | 62.0% | [link](https://ai.google.dev/pricing) |
| Claude Haiku 4 | anthropic | cheap | $0.80 | $4.00 | $0.08 | 200K | 8K | 51.2% | [link](https://www.anthropic.com/pricing) |
| Claude 3.5 Haiku (Oct 2024) | anthropic | cheap | $0.80 | $4.00 | $0.08 | 200K | 8K | 40.6% | [link](https://www.anthropic.com/pricing) |
| DeepSeek Chat (V3) | deepseek | cheap | $0.27 | $1.10 | $0.07 | 64K | 8K | — | [link](https://api-docs.deepseek.com/quick_start/pricing) |
| Gemini 2.5 Flash Lite | google | cheap | $0.10 | $0.40 | $0.03 | 1000K | 8K | 38.0% | [link](https://ai.google.dev/pricing) |
| Gemini 3.1 Flash Lite | google | cheap | $0.25 | $1.50 | $0.06 | 1000K | 16K | 48.0% | [link](https://ai.google.dev/pricing) |
| Gemini 1.5 Pro | google | long_context | $1.25 | $5.00 | $0.31 | 2000K | 8K | — | [link](https://ai.google.dev/pricing) |

## Tier Definitions

| Tier | Description | Use Cases |
|------|-------------|-----------|
| cheap | Low-cost models, $0.05-$1/M input | Explanations, simple edits, UI changes |
| mid | Balanced models, $1-$5/M input | API impl, bug fixes, test generation |
| strong | High-capability models, $5-$20/M input | Security changes, architecture, multi-file refactor |
| long_context | Optimized for large contexts | Whole-repo analysis, large codebase tasks |
| local_private | Local/self-hosted models | Privacy-sensitive tasks |