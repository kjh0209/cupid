import type { TaskClassification } from "../types.js";

export interface PromptBuildInput {
  taskMessage: string;
  optimizedMessage: string;
  taskClassification: TaskClassification;
  activeFilePath?: string;
  activeFileContent?: string;
  relatedFiles?: Array<{ path: string; content: string }>;
  repoDescription?: string;
  frameworkHints?: string[];
}

const SYSTEM_PROMPT = `You are an AI coding agent. Your job is to implement code changes precisely as requested.

Rules:
- Modify only the files necessary to complete the task
- Do not rewrite unrelated files or add unnecessary abstractions
- Preserve existing code style and patterns
- Return ONLY a JSON response in the exact format specified
- Do not include explanations outside the JSON
- Keep changes minimal and focused`;

const OUTPUT_FORMAT = `
Return your response as valid JSON in this exact format:
{
  "summary": "One-line description of what was changed",
  "files_changed": [
    {
      "path": "relative/path/to/file.ts",
      "change_type": "create" | "modify" | "delete",
      "content": "complete file content here"
    }
  ],
  "risks": ["list any risks or concerns"],
  "verification_notes": ["what to verify after applying changes"]
}

IMPORTANT: Use "content" with the complete updated file content (not patches).
Only include files you actually modified.`;

export function buildCodeGenPrompt(input: PromptBuildInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const parts: string[] = [];

  // Task context
  parts.push(`## Task`);
  parts.push(input.optimizedMessage || input.taskMessage);

  if (input.repoDescription) {
    parts.push(`\n## Repository Context`);
    parts.push(input.repoDescription);
  }

  if (input.frameworkHints && input.frameworkHints.length > 0) {
    parts.push(`\n## Framework/Language`);
    parts.push(input.frameworkHints.join(", "));
  }

  // Active file
  if (input.activeFilePath && input.activeFileContent) {
    parts.push(`\n## Active File: ${input.activeFilePath}`);
    parts.push("```");
    parts.push(input.activeFileContent.slice(0, 8000)); // limit to 8KB
    parts.push("```");
  }

  // Related files
  if (input.relatedFiles && input.relatedFiles.length > 0) {
    parts.push(`\n## Related Files`);
    for (const file of input.relatedFiles.slice(0, 5)) {
      parts.push(`\n### ${file.path}`);
      parts.push("```");
      parts.push(file.content.slice(0, 3000));
      parts.push("```");
    }
  }

  // Classification context
  const tc = input.taskClassification;
  parts.push(`\n## Task Classification`);
  parts.push(`- Task type: ${tc.taskType}`);
  parts.push(`- Risk level: ${tc.riskLevel}/5`);
  parts.push(`- Change scope: ${tc.expectedChangeScope}`);

  // Output format
  parts.push(`\n## Output Format`);
  parts.push(OUTPUT_FORMAT);

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: parts.join("\n"),
  };
}
