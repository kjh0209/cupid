# Routing Accuracy Report

Generated: 2026-06-28T07:45:53.922Z
Corpus: 139 real-world prompts with human-assigned ground truth
Errors: 0

## Headline

| Metric | Value |
|---|---|
| **Classification accuracy** | **83/139 = 59.7%** |
| **Tier-floor compliance** (no under-route) | **136/139 = 97.8%** |
| Tier-ceiling efficiency (no over-route) | 132/139 = 95.0% |
| Avg design-bar pass rate (visual tasks only) | 82.5% (16 prompts) |
| Total router cost (this run) | $0.2551 |
| Total benchmark cost | $1.5959 |
| Cost reduction | 84.0% |

## Per-category accuracy

| Category | N | Class% | Floor% | Ceil% | Design% | Modal route |
|---|---|---|---|---|---|---|
| api_implementation | 8 | 63% | 100% | 100% | — | anthropic/claude-sonnet-4.6 × 6 |
| architecture_design | 6 | 50% | 83% | 100% | — | anthropic/claude-sonnet-4.6 × 5 |
| code_review | 5 | 40% | 100% | 100% | — | openai/gpt-4o-mini × 3 |
| creative_generation | 17 | 82% | 100% | 100% | 83% | anthropic/claude-sonnet-4.6 × 14 |
| database_schema_change | 8 | 75% | 88% | 100% | — | anthropic/claude-sonnet-4.6 × 7 |
| dependency_update | 4 | 25% | 100% | 100% | — | openai/gpt-4o-mini × 2 |
| devops_config | 6 | 67% | 100% | 100% | — | anthropic/claude-sonnet-4.6 × 6 |
| documentation_write | 5 | 40% | 100% | 60% | — | openai/gpt-4o-mini × 3 |
| explanation | 12 | 67% | 100% | 75% | — | openai/gpt-4o-mini × 9 |
| local_bug_fix | 12 | 50% | 100% | 100% | — | openai/gpt-4o-mini × 6 |
| multi_file_refactor | 6 | 0% | 100% | 100% | — | openai/gpt-4o-mini × 5 |
| performance_optimization | 6 | 33% | 83% | 100% | — | openai/gpt-4o-mini × 3 |
| prompt_rewrite_only | 3 | 67% | 100% | 100% | — | openai/gpt-4o-mini × 3 |
| security_sensitive_change | 10 | 70% | 100% | 100% | — | anthropic/claude-sonnet-4.6 × 10 |
| simple_edit | 11 | 36% | 100% | 91% | — | openai/gpt-4o-mini × 10 |
| test_generation | 11 | 73% | 100% | 91% | — | openai/gpt-4o-mini × 10 |
| ui_change | 9 | 100% | 100% | 100% | — | openai/gpt-4o-mini × 9 |

## 🚨 Failure analysis — what to fix next

### Tier-FLOOR violations (3) — high priority
These prompts were routed to a model BELOW the minimum tier they require. Common cause: wrong task type classification, or the right task type but the tier policy is too permissive.

| ID | Prompt | Expected | Got | Cause |
|---|---|---|---|---|
| db-6 | convert this enum column to a lookup table — preserve histor | task=database_schema_change, ≥strong | ui_change → openai/gpt-4o-mini (mid) | MISCLASSIFIED as "ui_change" |
| arch-6 | real-time collaborative editing — propose the conflict resol | task=architecture_design, ≥strong | unknown → openai/gpt-4o-mini (mid) | MISCLASSIFIED as "unknown" |
| perf-6 | this loop is hot in flamegraph — vectorize or rewrite for sp | task=performance_optimization, ≥strong | unknown → openai/gpt-4o-mini (mid) | MISCLASSIFIED as "unknown" |

### Classification errors (56)
| Confused | Count |
|---|---|
| simple_edit → unknown | 3 |
| multi_file_refactor → simple_edit | 3 |
| security_sensitive_change → api_implementation | 3 |
| creative_generation → unknown | 2 |
| local_bug_fix → unknown | 2 |
| local_bug_fix → performance_optimization | 2 |
| architecture_design → database_schema_change | 2 |
| multi_file_refactor → unknown | 2 |
| performance_optimization → ui_change | 2 |
| devops_config → database_schema_change | 2 |
| creative_generation → test_generation | 1 |
| explanation → architecture_design | 1 |
| explanation → security_sensitive_change | 1 |
| explanation → database_schema_change | 1 |
| simple_edit → documentation_write | 1 |
| simple_edit → local_bug_fix | 1 |
| simple_edit → multi_file_refactor | 1 |
| test_generation → api_implementation | 1 |
| test_generation → ui_change | 1 |
| local_bug_fix → api_implementation | 1 |
| local_bug_fix → database_schema_change | 1 |
| api_implementation → unknown | 1 |
| api_implementation → ui_change | 1 |
| api_implementation → security_sensitive_change | 1 |
| database_schema_change → ui_change | 1 |
| multi_file_refactor → security_sensitive_change | 1 |
| multi_file_refactor → ui_change | 1 |
| architecture_design → security_sensitive_change | 1 |
| architecture_design → unknown | 1 |
| performance_optimization → database_schema_change | 1 |
| performance_optimization → unknown | 1 |
| documentation_write → explanation | 1 |
| documentation_write → database_schema_change | 1 |
| documentation_write → devops_config | 1 |
| dependency_update → ui_change | 1 |
| dependency_update → database_schema_change | 1 |
| dependency_update → unknown | 1 |
| code_review → api_implementation | 1 |
| code_review → ui_change | 1 |
| code_review → database_schema_change | 1 |
| prompt_rewrite_only → unknown | 1 |
| test_generation → unknown | 1 |
| code_review → unknown | 1 |

Worst examples:

| ID | Prompt | Expected | Got | Rationale |
|---|---|---|---|---|
| creat-13 | make a pomodoro timer app | creative_generation | unknown |  |
| creat-14 | build a tip calculator app with bill splitting | creative_generation | unknown |  |
| creat-16 | build a weather dashboard with mock data and pretty icons | creative_generation | test_generation |  |
| exp-2 | what's the difference between interface and type in typescri | explanation | architecture_design |  |
| exp-6 | what's CORS and how do i handle it | explanation | security_sensitive_change |  |
| exp-7 | explain the difference between SQL JOIN types | explanation | database_schema_change |  |
| edit-2 | add a JSDoc comment to this function | simple_edit | documentation_write |  |
| edit-3 | convert this from var to const/let | simple_edit | unknown |  |
| edit-6 | fix the typo in this error message: 'Cant find user' | simple_edit | local_bug_fix |  |
| edit-7 | rename file constants.js to config.js and update imports | multi_file_refactor | simple_edit |  |
| edit-8 | change all double quotes to single quotes in this file | simple_edit | multi_file_refactor |  |
| edit-9 | sort these imports alphabetically | simple_edit | unknown |  |
| edit-10 | add a TODO comment above this function explaining what's mis | simple_edit | unknown |  |
| test-7 | write integration tests for the orders API endpoint | test_generation | api_implementation |  |
| test-8 | add snapshot tests for this React Card component | test_generation | ui_change |  |
| bug-5 | this api endpoint sometimes returns stale data — i think it' | local_bug_fix | api_implementation |  |
| bug-7 | this regex matches too much. it should only match ISO dates | local_bug_fix | unknown |  |
| bug-8 | production is showing 'EADDRINUSE' on startup intermittently | local_bug_fix | unknown |  |
| bug-10 | why is my code slow | local_bug_fix | performance_optimization |  |
| bug-11 | memory leak in my Node service — heap grows ~50MB per hour | local_bug_fix | performance_optimization |  |

### Design-bar misses (3) — creative/visual tasks below 70%
| ID | Prompt | Routed | Missing signals |
|---|---|---|---|
| creat-13 | make a pomodoro timer app | openai/gpt-4o-mini | typography, border-radius, transitions, self-contained |
| creat-14 | build a tip calculator app with bill splitting | openai/gpt-4o-mini | typography, border-radius, self-contained |
| creat-16 | build a weather dashboard with mock data and prett | openai/gpt-4o-mini | multi-color, typography, box-shadow, self-contained |

## Per-prompt log

### ✅ creat-1 — creative_generation
> make a simple breakout web game

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-2 — creative_generation
> build a snake game in HTML and JS

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-3 — creative_generation
> make a pong game

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-4 — creative_generation
> build a tetris clone

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-5 — creative_generation
> make a 2048 game in vanilla JS

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-6 — creative_generation
> build a memory match card game with 16 cards

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-7 — creative_generation
> make a flappy bird clone

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-8 — creative_generation
> build a wordle clone

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-9 — creative_generation
> make a landing page for an AI startup called Cupid

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-10 — creative_generation
> build a portfolio site with hero, projects, and contact sections

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-11 — creative_generation
> make an interactive demo of conway's game of life

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ✅ creat-12 — creative_generation
> build a kanban board app — drag and drop cards between columns

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ❌ creat-13 — creative_generation
> make a pomodoro timer app

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil · design 0%
- **Missing design signals**: typography, border-radius, transitions, self-contained

### ❌ creat-14 — creative_generation
> build a tip calculator app with bill splitting

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil · design 0%
- **Missing design signals**: typography, border-radius, self-contained

### ✅ creat-15 — creative_generation
> make a tiny chat app demo with fake AI responses

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil · design 100%

### ❌ creat-16 — creative_generation
> build a weather dashboard with mock data and pretty icons

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`test_generation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil · design 20%
- **Missing design signals**: multi-color, typography, box-shadow, self-contained

### ✅ exp-1 — explanation
> explain how promise.allsettled differs from promise.all

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`explanation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ exp-2 — explanation
> what's the difference between interface and type in typescript

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`architecture_design`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✗ceil

### ✅ exp-3 — explanation
> what does this code do

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`explanation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ exp-4 — explanation
> what is the event loop in node

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`explanation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ exp-5 — explanation
> explain javascript closures with an example

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`explanation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ exp-6 — explanation
> what's CORS and how do i handle it

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✗ceil

### ❌ exp-7 — explanation
> explain the difference between SQL JOIN types

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✗ceil

### ✅ exp-8 — explanation
> summarize the changes in React 19

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`explanation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ exp-9 — explanation
> what does this regex do: /^(?=.*[A-Z])(?=.*\d).{8,}$/

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`explanation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ exp-10 — explanation
> what is dependency injection and when should I use it

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`explanation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ edit-1 — simple_edit
> rename variable x to count in this function

- **Expected**: task=`simple_edit`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`simple_edit`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ edit-2 — simple_edit
> add a JSDoc comment to this function

- **Expected**: task=`simple_edit`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`documentation_write`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ edit-3 — simple_edit
> convert this from var to const/let

- **Expected**: task=`simple_edit`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ edit-4 — simple_edit
> remove all console.log calls from this file

- **Expected**: task=`simple_edit`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`simple_edit`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ edit-5 — simple_edit
> add type annotations to these function parameters

- **Expected**: task=`simple_edit`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`simple_edit`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ edit-6 — simple_edit
> fix the typo in this error message: 'Cant find user'

- **Expected**: task=`simple_edit`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`local_bug_fix`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ edit-7 — simple_edit
> rename file constants.js to config.js and update imports

- **Expected**: task=`multi_file_refactor`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`simple_edit`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ edit-8 — simple_edit
> change all double quotes to single quotes in this file

- **Expected**: task=`simple_edit`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`multi_file_refactor`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✗ceil

### ❌ edit-9 — simple_edit
> sort these imports alphabetically

- **Expected**: task=`simple_edit`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ edit-10 — simple_edit
> add a TODO comment above this function explaining what's missing

- **Expected**: task=`simple_edit`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ ui-1 — ui_change
> add hover and focus styles to this button using Tailwind

- **Expected**: task=`ui_change`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ ui-2 — ui_change
> make this card layout stack vertically on mobile

- **Expected**: task=`ui_change`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ ui-3 — ui_change
> change the primary color from indigo to emerald in this component

- **Expected**: task=`ui_change`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ ui-4 — ui_change
> add a loading spinner to this button when isLoading prop is true

- **Expected**: task=`ui_change`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ ui-5 — ui_change
> add an accessibility aria-label to this icon button

- **Expected**: task=`ui_change`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ ui-6 — ui_change
> increase the font size of the heading and add letter-spacing

- **Expected**: task=`ui_change`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ ui-7 — ui_change
> wrap this component in a card with shadow and rounded corners

- **Expected**: task=`ui_change`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ ui-8 — ui_change
> add a fade-in animation when this modal opens

- **Expected**: task=`ui_change`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ test-1 — test_generation
> write vitest tests for this chunk function covering edge cases

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`test_generation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ test-2 — test_generation
> write jest tests for an email validator covering valid, invalid, null

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`test_generation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ test-3 — test_generation
> generate vitest tests including async error cases for this fetchUser function

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`test_generation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ test-4 — test_generation
> write playwright e2e tests for the login flow

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`test_generation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ test-5 — test_generation
> add unit tests for this date formatter — test ISO, US, EU formats

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`test_generation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ test-6 — test_generation
> generate property-based tests with fast-check for this sort function

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`test_generation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ test-7 — test_generation
> write integration tests for the orders API endpoint

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✗ceil

### ❌ test-8 — test_generation
> add snapshot tests for this React Card component

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ test-9 — test_generation
> write a test that asserts this function throws on invalid input

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`test_generation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ test-10 — test_generation
> mock this fetch call and write tests for the data transformation

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`test_generation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ bug-1 — local_bug_fix
> this function returns undefined when array is empty. fix it to return 0

- **Expected**: task=`local_bug_fix`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`local_bug_fix`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ bug-2 — local_bug_fix
> this function has a race condition when called concurrently. find and fix

- **Expected**: task=`local_bug_fix`, floor=`mid`
- **Actual**: task=`local_bug_fix`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ bug-3 — local_bug_fix
> useEffect runs in infinite loop. find the bug

- **Expected**: task=`local_bug_fix`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`local_bug_fix`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ bug-4 — local_bug_fix
> there's an off-by-one bug. fix it

- **Expected**: task=`local_bug_fix`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`local_bug_fix`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ bug-5 — local_bug_fix
> this api endpoint sometimes returns stale data — i think it's a caching issue

- **Expected**: task=`local_bug_fix`, floor=`mid`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ bug-6 — local_bug_fix
> my docker build is failing with permission denied on alpine. what's wrong

- **Expected**: task=`local_bug_fix`, floor=`mid`
- **Actual**: task=`local_bug_fix`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ bug-7 — local_bug_fix
> this regex matches too much. it should only match ISO dates

- **Expected**: task=`local_bug_fix`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ bug-8 — local_bug_fix
> production is showing 'EADDRINUSE' on startup intermittently

- **Expected**: task=`local_bug_fix`, floor=`mid`
- **Actual**: task=`unknown`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ bug-9 — local_bug_fix
> tests pass locally but fail on CI with timezone issues

- **Expected**: task=`local_bug_fix`, floor=`mid`
- **Actual**: task=`local_bug_fix`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ bug-10 — local_bug_fix
> why is my code slow

- **Expected**: task=`local_bug_fix`, floor=`mid`
- **Actual**: task=`performance_optimization`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ bug-11 — local_bug_fix
> memory leak in my Node service — heap grows ~50MB per hour

- **Expected**: task=`local_bug_fix`, floor=`strong`
- **Actual**: task=`performance_optimization`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ bug-12 — local_bug_fix
> deadlock between two transactions. trace and fix

- **Expected**: task=`local_bug_fix`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ api-1 — api_implementation
> write an express POST /todos endpoint that validates with Zod and saves to Prisma

- **Expected**: task=`api_implementation`, floor=`mid`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ api-2 — api_implementation
> write a Fastify GET /users/:id that returns 404 if missing, 200 otherwise

- **Expected**: task=`api_implementation`, floor=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ api-3 — api_implementation
> add input validation with Zod and proper error responses to this handler

- **Expected**: task=`api_implementation`, floor=`mid`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ api-4 — api_implementation
> create a tRPC router for managing todos with create/list/delete

- **Expected**: task=`api_implementation`, floor=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ api-5 — api_implementation
> add pagination + sorting to this list endpoint

- **Expected**: task=`api_implementation`, floor=`mid`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ api-6 — api_implementation
> implement webhook receiver that verifies HMAC signature

- **Expected**: task=`api_implementation`, floor=`strong`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ api-7 — api_implementation
> build a websocket endpoint for live notifications using socket.io

- **Expected**: task=`api_implementation`, floor=`mid`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ api-8 — api_implementation
> implement file upload endpoint with multer, size limit 5mb

- **Expected**: task=`api_implementation`, floor=`mid`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ sec-1 — security_sensitive_change
> implement password verification with bcrypt and constant-time comparison

- **Expected**: task=`security_sensitive_change`, floor=`strong`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ sec-2 — security_sensitive_change
> rotate a JWT access token: validate old, issue new with new expiration

- **Expected**: task=`security_sensitive_change`, floor=`strong`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ sec-3 — security_sensitive_change
> add CSRF protection to this Express app's mutating endpoints

- **Expected**: task=`security_sensitive_change`, floor=`strong`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ sec-4 — security_sensitive_change
> encrypt API keys at rest with AES-256-GCM, decrypt on read

- **Expected**: task=`security_sensitive_change`, floor=`strong`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ sec-5 — security_sensitive_change
> implement rate limiting for login endpoint to prevent brute force

- **Expected**: task=`security_sensitive_change`, floor=`strong`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ sec-6 — security_sensitive_change
> validate Stripe webhook signature before processing payment events

- **Expected**: task=`security_sensitive_change`, floor=`strong`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ sec-7 — security_sensitive_change
> add OAuth2 PKCE flow for our SPA login

- **Expected**: task=`security_sensitive_change`, floor=`strong`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ sec-8 — security_sensitive_change
> implement secure password reset flow with single-use token

- **Expected**: task=`security_sensitive_change`, floor=`strong`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ sec-9 — security_sensitive_change
> harden this auth middleware: timing-safe, fail-closed, audit log

- **Expected**: task=`security_sensitive_change`, floor=`strong`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ sec-10 — security_sensitive_change
> add input sanitization to prevent SQL injection in this raw query

- **Expected**: task=`security_sensitive_change`, floor=`strong`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ db-1 — database_schema_change
> write a Prisma migration to add NOT NULL 'created_at' to existing orders table (50M rows)

- **Expected**: task=`database_schema_change`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ db-2 — database_schema_change
> add a unique composite index on (user_id, slug) on posts without locking

- **Expected**: task=`database_schema_change`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ db-3 — database_schema_change
> split 'name' on users into 'first_name'/'last_name' with data migration

- **Expected**: task=`database_schema_change`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ db-4 — database_schema_change
> add foreign key from orders.user_id to users.id without table scan lock

- **Expected**: task=`database_schema_change`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ db-5 — database_schema_change
> create a partial unique index on email where deleted_at is null

- **Expected**: task=`database_schema_change`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ db-6 — database_schema_change
> convert this enum column to a lookup table — preserve historical data

- **Expected**: task=`database_schema_change`, floor=`strong`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✗FLOOR · ✓ceil

### ✅ db-7 — database_schema_change
> add a soft-delete column with a partial index excluding deleted rows

- **Expected**: task=`database_schema_change`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ db-8 — database_schema_change
> shard the orders table by tenant_id — design the migration plan

- **Expected**: task=`architecture_design`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ ref-1 — multi_file_refactor
> extract auth logic from routes/users.ts into a services/authService.ts

- **Expected**: task=`multi_file_refactor`, floor=`mid`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ ref-2 — multi_file_refactor
> rename 'Customer' class to 'Client' across all imports and usages

- **Expected**: task=`multi_file_refactor`, floor=`mid`
- **Actual**: task=`simple_edit`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ ref-3 — multi_file_refactor
> split this 800-line component into smaller focused components

- **Expected**: task=`multi_file_refactor`, floor=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ ref-4 — multi_file_refactor
> convert this codebase from callbacks to async/await throughout

- **Expected**: task=`multi_file_refactor`, floor=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ ref-5 — multi_file_refactor
> introduce a logger module and replace all console.log calls with it

- **Expected**: task=`multi_file_refactor`, floor=`mid`
- **Actual**: task=`simple_edit`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ ref-6 — multi_file_refactor
> move shared types into a separate types/ folder and update imports

- **Expected**: task=`multi_file_refactor`, floor=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ arch-1 — architecture_design
> design a notification system supporting email, SMS, push — extensible to new channels

- **Expected**: task=`architecture_design`, floor=`mid`
- **Actual**: task=`architecture_design`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ arch-2 — architecture_design
> we have a monolith with auth, payments, analytics. should we split? team of 6, 1M req/day

- **Expected**: task=`architecture_design`, floor=`mid`
- **Actual**: task=`security_sensitive_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ arch-3 — architecture_design
> design a job queue with retries, DLQ, and exactly-once semantics

- **Expected**: task=`architecture_design`, floor=`strong`
- **Actual**: task=`architecture_design`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ arch-4 — architecture_design
> we need to migrate from REST to GraphQL — propose a phased plan

- **Expected**: task=`architecture_design`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ arch-5 — architecture_design
> design a multi-tenant data model with row-level isolation

- **Expected**: task=`architecture_design`, floor=`strong`
- **Actual**: task=`architecture_design`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ arch-6 — architecture_design
> real-time collaborative editing — propose the conflict resolution model

- **Expected**: task=`architecture_design`, floor=`strong`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✗FLOOR · ✓ceil

### ❌ perf-1 — performance_optimization
> this React component re-renders too often. find and fix unnecessary re-renders

- **Expected**: task=`performance_optimization`, floor=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ perf-2 — performance_optimization
> this list query is N+1. rewrite with eager loading

- **Expected**: task=`performance_optimization`, floor=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ perf-3 — performance_optimization
> our LCP is 4.2s. give me a prioritized list of fixes

- **Expected**: task=`performance_optimization`, floor=`mid`
- **Actual**: task=`performance_optimization`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ perf-4 — performance_optimization
> this aggregate query takes 8s. show me an indexed approach

- **Expected**: task=`performance_optimization`, floor=`mid`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ perf-5 — performance_optimization
> bundle size is 1.8MB. propose a code-splitting strategy

- **Expected**: task=`performance_optimization`, floor=`mid`
- **Actual**: task=`performance_optimization`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ perf-6 — performance_optimization
> this loop is hot in flamegraph — vectorize or rewrite for speed

- **Expected**: task=`performance_optimization`, floor=`strong`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✗FLOOR · ✓ceil

### ✅ devops-1 — devops_config
> write a multi-stage Dockerfile for a Next.js production build

- **Expected**: task=`devops_config`, floor=`mid`
- **Actual**: task=`devops_config`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ devops-2 — devops_config
> write a github actions workflow that runs lint, test, and deploys on main

- **Expected**: task=`devops_config`, floor=`mid`
- **Actual**: task=`devops_config`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ devops-3 — devops_config
> k8s deployment + service + HPA for a Node service, with resource limits

- **Expected**: task=`devops_config`, floor=`strong`
- **Actual**: task=`devops_config`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ devops-4 — devops_config
> set up nginx as reverse proxy with TLS and rate limiting

- **Expected**: task=`devops_config`, floor=`strong`
- **Actual**: task=`devops_config`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ devops-5 — devops_config
> terraform module for an RDS Postgres with backups

- **Expected**: task=`devops_config`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ devops-6 — devops_config
> write a docker-compose for postgres + redis + the app with healthchecks

- **Expected**: task=`devops_config`, floor=`mid`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ doc-1 — documentation_write
> generate a README for this project with install, usage, contributing sections

- **Expected**: task=`documentation_write`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`documentation_write`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ doc-2 — documentation_write
> add JSDoc to every exported function in this file

- **Expected**: task=`documentation_write`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`explanation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ doc-3 — documentation_write
> write an ADR for choosing Postgres over MongoDB for this project

- **Expected**: task=`documentation_write`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✗ceil

### ✅ doc-4 — documentation_write
> generate an OpenAPI spec for these Express routes

- **Expected**: task=`documentation_write`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`documentation_write`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ doc-5 — documentation_write
> write release notes for v2.0 highlighting breaking changes

- **Expected**: task=`documentation_write`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`devops_config`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✗ceil

### ❌ dep-1 — dependency_update
> upgrade React 17 to 19. list breaking changes I need to address

- **Expected**: task=`dependency_update`, floor=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ dep-2 — dependency_update
> upgrade Express 4 to 5. migration guide for this app

- **Expected**: task=`dependency_update`, floor=`mid`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ dep-3 — dependency_update
> npm audit reports 3 high-severity vulns. fix them

- **Expected**: task=`dependency_update`, floor=`mid`
- **Actual**: task=`dependency_update`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ dep-4 — dependency_update
> bump TypeScript 5.0 to 5.4 — what new strict checks will break

- **Expected**: task=`dependency_update`, floor=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ rev-1 — code_review
> review this PR diff and call out issues by severity

- **Expected**: task=`code_review`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`code_review`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ rev-2 — code_review
> review this auth handler — focus on security

- **Expected**: task=`code_review`, floor=`mid`
- **Actual**: task=`api_implementation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ rev-3 — code_review
> is this React component idiomatic? what would you change

- **Expected**: task=`code_review`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ❌ rev-4 — code_review
> review this migration for production safety

- **Expected**: task=`code_review`, floor=`strong`
- **Actual**: task=`database_schema_change`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ rev-5 — code_review
> give feedback on the naming and structure of this module

- **Expected**: task=`code_review`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`code_review`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ rw-1 — prompt_rewrite_only
> rewrite this prompt to be shorter and clearer: 'hey can you maybe please if possible just kind of fix the bug in the login function thanks you so much'

- **Expected**: task=`prompt_rewrite_only`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`prompt_rewrite_only`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ rw-2 — prompt_rewrite_only
> shorten this prompt while keeping all constraints

- **Expected**: task=`prompt_rewrite_only`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`prompt_rewrite_only`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ rw-3 — prompt_rewrite_only
> make this prompt more specific so the LLM doesn't hallucinate

- **Expected**: task=`prompt_rewrite_only`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ edge-1 — ui_change
> make my button look nicer

- **Expected**: task=`ui_change`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`ui_change`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ✅ edge-2 — explanation
> what does '?.' do in javascript

- **Expected**: task=`explanation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`explanation`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ edge-3 — test_generation
> make this code testable

- **Expected**: task=`test_generation`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ edge-4 — creative_generation
> make me a calculator

- **Expected**: task=`creative_generation`, floor=`mid`
- **Actual**: task=`creative_generation`, model=`anthropic/claude-sonnet-4.6` (`strong`)
- **Verdict**: ✓task · ✓floor · ✓ceil

### ❌ edge-5 — explanation
> is this code thread-safe

- **Expected**: task=`code_review`, floor=`cheap`, ceiling=`strong`
- **Actual**: task=`unknown`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✗task · ✓floor · ✓ceil

### ✅ edge-6 — simple_edit
> make this prettier

- **Expected**: task=`simple_edit`, floor=`cheap`, ceiling=`mid`
- **Actual**: task=`simple_edit`, model=`openai/gpt-4o-mini` (`mid`)
- **Verdict**: ✓task · ✓floor · ✓ceil
