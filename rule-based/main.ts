import { getEncoding } from 'js-tiktoken';
import * as fs from 'fs';

const tokenizer = getEncoding("cl100k_base");

const ModelConfig = {
    'baseline': { id: 'claude-4.7-opus', cost: 15.00 },
    'cheap': { id: 'claude-4.5-haiku', cost: 0.15 },
    'mid': { id: 'gpt-5.4-mini', cost: 0.15 },
    'strong': { id: 'claude-4.6-sonnet', cost: 3.00 },
    'strong-reasoning': { id: 'gpt-5.5', cost: 5.00 },
    'long-context': { id: 'gemini-1.5-pro', cost: 1.25 }
};

class CupidRouter {
    private HEAVY_VERBS = ['fix', 'implement', 'refactor', 'optimize', 'debug', 'architect'];
    private LIGHT_VERBS = ['format', 'comment', 'rename', 'typo', 'color', 'align', 'css'];
    private HIGH_RISK_NOUNS = ['database', 'auth', 'security', 'schema', 'api', 'state'];
    private SYSTEM_EXTENSIONS = ['.rs', '.cpp', '.c', '.zig', '.go'];

    public processRequest(prompt: string, activeFileText: string, fileName: string, hasCompilerErrors: boolean, gitDiffText: string | null = null) {
        const promptLower = prompt.toLowerCase();
        const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

        const baselineString = prompt + "\n" + activeFileText;
        const baselineTokens = tokenizer.encode(baselineString).length;
        const baselineCost = (baselineTokens / 1000000) * ModelConfig.baseline.cost;

        let targetTier: keyof typeof ModelConfig = 'mid';
        let finalPayloadString = baselineString;
        let ruleTriggered = 'Fallback';

        if (gitDiffText && (promptLower.includes('commit') || promptLower.includes('review'))) {
            targetTier = 'mid';
            finalPayloadString = prompt + "\n" + gitDiffText;
            ruleTriggered = 'Rule 1: Git Diff Pruning';
        } else if (hasCompilerErrors) {
            targetTier = 'strong';
            ruleTriggered = 'Rule 3: IDE Diagnostics Error';
        } else if (this.SYSTEM_EXTENSIONS.includes(fileExtension)) {
            targetTier = 'strong-reasoning';
            ruleTriggered = 'Rule 4: System Language Lockout';
        } else if (this.HIGH_RISK_NOUNS.some(n => promptLower.includes(n)) || this.HEAVY_VERBS.some(v => promptLower.includes(v))) {
            targetTier = 'strong-reasoning';
            ruleTriggered = 'Rule 5: Heavy Architecture Intent';
        } else if (baselineTokens > 30000) {
            targetTier = 'long-context';
            ruleTriggered = 'Rule 6: Massive Context Window';
        } else if (this.LIGHT_VERBS.some(v => promptLower.includes(v))) {
            targetTier = 'cheap';
            finalPayloadString = prompt + "\n" + activeFileText.substring(0, activeFileText.length / 2);
            ruleTriggered = 'Rule 7: Safe/Light Boilerplate';
        }

        const cupidTokens = tokenizer.encode(finalPayloadString).length;
        const finalModel = ModelConfig[targetTier];
        const cupidCost = (cupidTokens / 1000000) * finalModel.cost;

        return {
            scenario: prompt,
            ruleTriggered,
            routedModel: finalModel.id,
            tokensSaved: baselineTokens - cupidTokens,
            costSaved: `$${(baselineCost - cupidCost).toFixed(4)}`
        };
    }
}

function runSimulations() {
    const router = new CupidRouter();
    const dummyFileContext = "const x = 1;\n".repeat(2000);

    const results = [
        router.processRequest("Change the button color to red", dummyFileContext, "app.css", false),
        router.processRequest("Write a commit message for this", dummyFileContext, "auth.ts", false, "+ const token = getJWT();\n- const token = null;"),
        router.processRequest("Fix the race condition in the database schema", dummyFileContext, "db.ts", true)
    ];

    // Output to Terminal
    console.table(results);

    // Generate the UI Dashboard
    const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>CUPID Orchestrator</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 40px; }
      .dashboard { max-width: 900px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
      h2 { border-bottom: 1px solid #30363d; padding-bottom: 12px; color: #58a6ff; font-weight: 500; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; }
      th, td { padding: 12px 16px; border-bottom: 1px solid #21262d; }
      th { background-color: #21262d; font-size: 14px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
      .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #238636; color: #ffffff; }
      .metric { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; color: #79c0ff; }
    </style>
  </head>
  <body>
    <div class="dashboard">
      <h2>CUPID Telemetry UI</h2>
      <table>
        <thead>
          <tr>
            <th>User Prompt</th>
            <th>Rule Triggered</th>
            <th>Routed Model</th>
            <th>Tokens Pruned</th>
            <th>Money Saved</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => `
            <tr>
              <td>${r.scenario}</td>
              <td style="color: #8b949e;">${r.ruleTriggered}</td>
              <td><span class="badge">${r.routedModel}</span></td>
              <td class="metric">${r.tokensSaved.toLocaleString()}</td>
              <td class="metric">${r.costSaved}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;

    fs.writeFileSync('dashboard.html', htmlContent);
    console.log('\n✅ SUCCESS: UI Dashboard generated! Check your folder for dashboard.html');
}

runSimulations();
