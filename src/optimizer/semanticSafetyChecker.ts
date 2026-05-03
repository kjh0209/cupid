import type { SemanticRisk, TaskClassification } from "../types.js";

const HIGH_RISK_TERMS = [
  "jwt", "token", "session", "auth", "password", "secret",
  "permission", "role", "admin", "security", "encryption",
  "sql.injection", "xss", "csrf", "payment", "stripe",
  "migration", "schema", "drop", "delete", "transaction",
];

const CRITICAL_PATTERN_CHECKS = [
  { pattern: /\bjwt\b|\btoken\b|\bsession\b/i, weight: 2 },
  { pattern: /\bauth\w*/i, weight: 2 },
  { pattern: /\bpassword|secret|key\b/i, weight: 3 },
  { pattern: /\bpayment|billing|stripe\b/i, weight: 3 },
  { pattern: /\bmigrat\w*|schema|drop\s+table/i, weight: 2 },
  { pattern: /\bpermission|role|admin\b/i, weight: 2 },
  { pattern: /\bsecurity|encrypt|decrypt\b/i, weight: 2 },
];

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => {
    const pattern = kw.replace(".", "\\s*");
    return new RegExp(pattern, "i").test(lower);
  }).length;
}

export function assessSemanticRisk(
  original: string,
  optimized: string,
  classification: TaskClassification
): {
  risk: SemanticRisk;
  reasons: string[];
  violations: string[];
} {
  const reasons: string[] = [];
  const violations: string[] = [];

  // 1. Check if critical terms are in original but missing from optimized
  for (const { pattern } of CRITICAL_PATTERN_CHECKS) {
    const inOriginal = pattern.test(original);
    const inOptimized = pattern.test(optimized);

    if (inOriginal && !inOptimized) {
      const match = original.match(pattern);
      violations.push(`Critical term may have been removed: "${match?.[0] ?? pattern.source}"`);
    }
  }

  // 2. Check if explicit filenames are preserved
  const fileRefs = original.match(/[\w.-]+\.(ts|tsx|js|jsx|py|go|rs)\b/g) ?? [];
  for (const fileRef of fileRefs) {
    if (!optimized.includes(fileRef)) {
      violations.push(`File reference may have been removed: "${fileRef}"`);
    }
  }

  // 3. Check if quoted strings (potential requirements) are preserved
  const quotedInOriginal = original.match(/"[^"]{3,40}"/g) ?? [];
  for (const q of quotedInOriginal) {
    if (!optimized.includes(q)) {
      reasons.push(`Quoted requirement "${q}" may have been paraphrased`);
    }
  }

  // 4. Compression ratio check
  const origTokens = Math.ceil(original.length / 4);
  const optTokens = Math.ceil(optimized.length / 4);
  const compressionRatio = optTokens / origTokens;

  if (compressionRatio < 0.3 && classification.riskLevel >= 4) {
    violations.push(
      `Aggressive compression (${Math.round((1 - compressionRatio) * 100)}%) on high-risk task`
    );
  }

  // 5. High-risk task classification signals
  if (classification.taskType === "security_sensitive_change" && violations.length > 0) {
    violations.push("Security task with potential requirement loss");
  }

  // Determine overall risk level
  let risk: SemanticRisk;
  if (violations.length >= 2) {
    risk = "high";
  } else if (violations.length === 1 || reasons.length >= 2) {
    risk = "medium";
  } else {
    risk = "low";
  }

  return { risk, reasons, violations };
}

export function checkHighRiskCompression(
  original: string,
  optimized: string,
  compressionSensitivity: string
): boolean {
  if (compressionSensitivity !== "high") return true;

  const secHits = countKeywordHits(original, HIGH_RISK_TERMS);
  if (secHits < 2) return true;

  const origLen = original.length;
  const optLen = optimized.length;
  const compressionPercent = (1 - optLen / origLen) * 100;

  // For high-sensitivity tasks, allow max 30% compression
  if (compressionPercent > 30) {
    return false;
  }

  return true;
}
