import type { TaskClassification, VerificationPlan } from "../types.js";

export function planVerification(classification: TaskClassification): VerificationPlan {
  const { taskType, riskLevel, languageOrFramework } = classification;

  const required: string[] = [];
  const optional: string[] = [];

  // TypeScript tasks: always run typecheck
  if (
    languageOrFramework.includes("TypeScript") ||
    languageOrFramework.some((f) => ["Next.js", "React", "Vue", "Node.js"].includes(f))
  ) {
    required.push("typecheck");
  }

  // Linting: almost always useful
  required.push("lint");

  // Risk-based test requirements
  if (riskLevel >= 4) {
    required.push("unit_test", "integration_test");
    optional.push("e2e_test");
  } else if (riskLevel >= 3) {
    required.push("unit_test");
    optional.push("integration_test");
  } else if (riskLevel >= 2) {
    optional.push("unit_test");
  }

  // Task-specific
  switch (taskType) {
    case "test_generation":
      required.push("run_new_tests");
      optional.push("coverage_check");
      break;

    case "api_implementation":
      required.push("typecheck");
      optional.push("unit_test", "api_test");
      break;

    case "database_schema_change":
      required.push("typecheck", "migration_dry_run");
      optional.push("integration_test");
      break;

    case "security_sensitive_change":
      required.push("typecheck", "security_scan", "unit_test");
      optional.push("integration_test", "auth_flow_test");
      break;

    case "multi_file_refactor":
      required.push("typecheck");
      optional.push("unit_test", "build");
      break;

    case "ui_change":
      optional.push("visual_regression", "accessibility_check");
      break;

    case "architecture_design":
      optional.push("typecheck", "build");
      break;

    case "explanation":
    case "prompt_rewrite_only":
      // No verification needed
      break;
  }

  // Deduplicate
  const uniqueRequired = [...new Set(required)];
  const uniqueOptional = [...new Set(optional)].filter(
    (s) => !uniqueRequired.includes(s)
  );

  const steps = [...uniqueRequired, ...uniqueOptional];

  return {
    steps,
    required: uniqueRequired,
    optional: uniqueOptional,
    riskLevel,
  };
}
