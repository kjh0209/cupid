import { describe, it, expect } from "vitest";
import { planVerification } from "../src/verification/verificationPlanner.js";
import type { TaskClassification } from "../src/types.js";

function makeClassification(overrides: Partial<TaskClassification> = {}): TaskClassification {
  return {
    taskType: "simple_edit",
    difficulty: 2,
    riskLevel: 2,
    contextNeed: "small",
    expectedChangeScope: "single_file",
    languageOrFramework: ["TypeScript"],
    needsToolCalling: false,
    needsLongContext: false,
    privacySensitive: false,
    compressionSensitivity: "medium",
    ...overrides,
  };
}

describe("VerificationPlanner", () => {
  describe("basic behavior", () => {
    it("always includes lint in required steps", () => {
      const plan = planVerification(makeClassification());
      expect(plan.required).toContain("lint");
    });

    it("includes typecheck for TypeScript projects", () => {
      const plan = planVerification(makeClassification({ languageOrFramework: ["TypeScript"] }));
      expect(plan.required).toContain("typecheck");
    });

    it("includes typecheck for React projects", () => {
      const plan = planVerification(makeClassification({ languageOrFramework: ["React"] }));
      expect(plan.required).toContain("typecheck");
    });

    it("includes typecheck for Next.js projects", () => {
      const plan = planVerification(makeClassification({ languageOrFramework: ["Next.js"] }));
      expect(plan.required).toContain("typecheck");
    });

    it("does not include typecheck for Python-only projects", () => {
      const plan = planVerification(makeClassification({ languageOrFramework: ["Python"] }));
      expect(plan.required).not.toContain("typecheck");
    });
  });

  describe("risk-based requirements", () => {
    it("riskLevel >= 4 requires unit_test and integration_test", () => {
      const plan = planVerification(makeClassification({ riskLevel: 4 }));
      expect(plan.required).toContain("unit_test");
      expect(plan.required).toContain("integration_test");
      expect(plan.optional).toContain("e2e_test");
    });

    it("riskLevel = 3 requires unit_test, optional integration_test", () => {
      const plan = planVerification(makeClassification({ riskLevel: 3 }));
      expect(plan.required).toContain("unit_test");
      expect(plan.optional).toContain("integration_test");
    });

    it("riskLevel = 2 has optional unit_test", () => {
      const plan = planVerification(makeClassification({ riskLevel: 2 }));
      expect(plan.optional).toContain("unit_test");
      expect(plan.required).not.toContain("unit_test");
    });

    it("riskLevel = 1 does not require or suggest unit_test", () => {
      const plan = planVerification(makeClassification({ riskLevel: 1 }));
      expect(plan.required).not.toContain("unit_test");
      expect(plan.optional).not.toContain("unit_test");
    });
  });

  describe("task-specific verification", () => {
    it("test_generation requires run_new_tests", () => {
      const plan = planVerification(makeClassification({ taskType: "test_generation" }));
      expect(plan.required).toContain("run_new_tests");
      expect(plan.optional).toContain("coverage_check");
    });

    it("api_implementation requires typecheck, optional api_test", () => {
      const plan = planVerification(makeClassification({ taskType: "api_implementation" }));
      expect(plan.required).toContain("typecheck");
      expect(plan.optional).toContain("api_test");
    });

    it("database_schema_change requires migration_dry_run", () => {
      const plan = planVerification(makeClassification({ taskType: "database_schema_change" }));
      expect(plan.required).toContain("migration_dry_run");
    });

    it("security_sensitive_change requires security_scan", () => {
      const plan = planVerification(makeClassification({ taskType: "security_sensitive_change" }));
      expect(plan.required).toContain("security_scan");
      expect(plan.required).toContain("unit_test");
    });

    it("multi_file_refactor includes optional build step", () => {
      const plan = planVerification(makeClassification({ taskType: "multi_file_refactor" }));
      expect(plan.required).toContain("typecheck");
      expect(plan.optional).toContain("build");
    });

    it("ui_change includes visual_regression and accessibility_check as optional", () => {
      const plan = planVerification(makeClassification({ taskType: "ui_change" }));
      expect(plan.optional).toContain("visual_regression");
      expect(plan.optional).toContain("accessibility_check");
    });

    it("explanation requires no extra verification", () => {
      const plan = planVerification(
        makeClassification({ taskType: "explanation", riskLevel: 1, languageOrFramework: ["Python"] })
      );
      expect(plan.required).toEqual(["lint"]);
    });

    it("prompt_rewrite_only requires no extra verification", () => {
      const plan = planVerification(
        makeClassification({ taskType: "prompt_rewrite_only", riskLevel: 1, languageOrFramework: ["Python"] })
      );
      expect(plan.required).toEqual(["lint"]);
    });
  });

  describe("deduplication", () => {
    it("does not duplicate typecheck when both TS and api_implementation", () => {
      const plan = planVerification(
        makeClassification({ taskType: "api_implementation", languageOrFramework: ["TypeScript"] })
      );
      const typecheckCount = plan.required.filter((s) => s === "typecheck").length;
      expect(typecheckCount).toBe(1);
    });

    it("optional items do not appear in required", () => {
      const plan = planVerification(makeClassification({ riskLevel: 4 }));
      for (const opt of plan.optional) {
        expect(plan.required).not.toContain(opt);
      }
    });

    it("steps is the union of required and optional", () => {
      const plan = planVerification(makeClassification({ riskLevel: 4, taskType: "security_sensitive_change" }));
      expect(plan.steps).toEqual([...plan.required, ...plan.optional]);
    });
  });

  describe("riskLevel passthrough", () => {
    it("returns the same riskLevel from the classification", () => {
      const plan = planVerification(makeClassification({ riskLevel: 5 }));
      expect(plan.riskLevel).toBe(5);
    });
  });
});
