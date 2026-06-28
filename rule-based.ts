import { getEncoding } from 'js-tiktoken';
import * as fs from 'fs';

const tokenizer = getEncoding("cl100k_base");

// ==========================================
// 1. DATA TYPES & INTERFACES
// ==========================================
interface IDEContext {
    fileName: string;
    activeLanguage: string;
    fileLineCount: number;
    hasTerminalError: boolean;
    hasHighlightedText: boolean; 
    rawCodePayload: string;      
    gitDiffText: string | null;  // NEW: Git diff integration
}

interface ModelStats {
    id: string;
    costPer1kTokens: number; 
    costScore: number;       // Normalized 0.0 to 1.0
    latencyScore: number;    
    riskScore: number;       
    baseQuality: number;     
}

// ==========================================
// 2. THE MARKET & REGISTRIES
// ==========================================
const MODEL_REGISTRY: ModelStats[] = [
    { id: 'llama-3-8b-local',  costPer1kTokens: 0.000, costScore: 0.0, latencyScore: 0.1, riskScore: 0.6, baseQuality: 0.5 },
    { id: 'claude-3.5-haiku',  costPer1kTokens: 0.00015, costScore: 0.1, latencyScore: 0.2, riskScore: 0.3, baseQuality: 0.7 },
    { id: 'gpt-4o-mini',       costPer1kTokens: 0.00015, costScore: 0.2, latencyScore: 0.3, riskScore: 0.4, baseQuality: 0.75 },
    { id: 'gemini-1.5-pro',    costPer1kTokens: 0.00125, costScore: 0.6, latencyScore: 0.6, riskScore: 0.2, baseQuality: 0.9 },
    { id: 'claude-3.5-sonnet', costPer1kTokens: 0.003, costScore: 0.9, latencyScore: 0.8, riskScore: 0.1, baseQuality: 1.0 },
    { id: 'claude-4.7-opus',   costPer1kTokens: 0.015, costScore: 1.0, latencyScore: 1.0, riskScore: 0.05, baseQuality: 1.0 } // Baseline Comparison
];

const ACTION_WEIGHTS: Record<string, { intent: string, weight: number }> = {
    'fix': { intent: 'Debug', weight: 0.8 }, 'error': { intent: 'Debug', weight: 0.9 }, 'crash': { intent: 'Debug', weight: 0.9 },
    'refactor': { intent: 'Refactor', weight: 0.9 }, 'optimize': { intent: 'Refactor', weight: 0.9 },
    'architecture': { intent: 'ComplexArchitecture', weight: 0.9 }, 'database': { intent: 'ComplexArchitecture', weight: 0.8 },
    'explain': { intent: 'Explain', weight: 0.9 }, 'how': { intent: 'Explain', weight: 0.5 },
    'commit': { intent: 'GitOps', weight: 0.9 }, 'review': { intent: 'GitOps', weight: 0.8 }
};

const SYSTEM_EXTENSIONS = ['.rs', '.cpp', '.c', '.zig', '.go'];

// ==========================================
// 3. PHASE 1: INTENT & AUCTION (THE BRAIN)
// ==========================================
class CupidBrain {
    static evaluate(prompt: string, context: IDEContext) {
        const tokens = prompt.toLowerCase().split(/[\s,.-]+/);
        const intentScores: Record<string, number> = {};
        const rulesTriggered: string[] = [];

        // 1. Lexical Scoring
        for (const token of tokens) {
            const match = ACTION_WEIGHTS[token];
            if (match) intentScores[match.intent] = (intentScores[match.intent] || 0) + match.weight;
        }

        // 2. Parallel Rule Triggers (Contextual Scoring)
        if (context.hasTerminalError) {
            intentScores['Debug'] = (intentScores['Debug'] || 0) + 1.5;
            rulesTriggered.push('IDE Diagnostics Error');
        }
        if (context.fileLineCount > 500 && !context.hasHighlightedText) {
            intentScores['ComplexArchitecture'] = (intentScores['ComplexArchitecture'] || 0) + 0.5;
            rulesTriggered.push('Large File Scope');
        }
        if (context.gitDiffText && (prompt.includes('commit') || prompt.includes('review'))) {
            intentScores['GitOps'] = 2.0; 
            rulesTriggered.push('Git Diff Pruning');
        }
        if (SYSTEM_EXTENSIONS.some(ext => context.fileName.endsWith(ext))) {
            intentScores['ComplexArchitecture'] = (intentScores['ComplexArchitecture'] || 0) + 1.0;
            rulesTriggered.push('System Language Lockout');
        }

        // 3. Find Intent
        let intent = 'Generate';
        let maxScore = 0;
        for (const [key, val] of Object.entries(intentScores)) {
            if (val > maxScore) { maxScore = val; intent = key; }
        }
        const confidence = Math.min(maxScore / 2.0, 1.0);

        // 4. Dynamic Auction Dials
        let alpha = 1.0, beta = 1.0, gamma = 1.0, delta = 1.0;
        switch (intent) {
            case 'ComplexArchitecture': alpha = 2.5; delta = 2.0; beta = 0.2; break;
            case 'Debug': gamma = 2.0; alpha = 1.5; break;
            case 'Explain': beta = 3.0; delta = 0.1; break;
            case 'GitOps': beta = 2.0; alpha = 1.2; break; // Needs okay reasoning, but cheap
        }

        if (context.hasHighlightedText) delta *= 0.5; 

        // 5. Run Auction
        let bestModel = MODEL_REGISTRY[0];
        let highestScore = -Infinity;
        for (const model of MODEL_REGISTRY) {
            // Ignore the expensive baseline for normal routing
            if (model.id === 'claude-4.7-opus') continue; 
            
            const score = (alpha * model.baseQuality) - (beta * model.costScore) - (gamma * model.latencyScore) - (delta * model.riskScore);
            if (score > highestScore) { highestScore = score; bestModel = model; }
        }

        // Context Size Override (Overrides Auction)
        const estTokens = (context.rawCodePayload.length / 4);
        if (estTokens > 30000) {
            bestModel = MODEL_REGISTRY.find(m => m.id === 'gemini-1.5-pro')!;
            rulesTriggered.push('Massive Context Override');
        }

        if (confidence < 0.40) bestModel = MODEL_REGISTRY.find(m => m.id === 'gpt-4o-mini')!;

        return { intent, confidence, bestModel, rulesTriggered };
    }
}

// ==========================================
// 4. PHASE 2: CONTEXT PRESERVATION LAYER
// ==========================================
class CPLOptimizer {
    static compress(context: IDEContext, intent: string, rulesTriggered: string[]): { compressedCode: string, rules: string[] } {
        let compressedCode = context.rawCodePayload;
        let modifiedRules = [...rulesTriggered];

        // Rule: If it's a Git operation, discard the whole file and only send the Diff
        if (intent === 'GitOps' && context.gitDiffText) {
            compressedCode = context.gitDiffText;
            modifiedRules.push('CPL: Diff Substitution');
            return { compressedCode, rules: modifiedRules };
        }

        // Rule: Simple explanations without highlights only need signatures
        if (intent === 'Explain' && !context.hasHighlightedText) {
            const lines = context.rawCodePayload.split('\n');
            compressedCode = lines.filter(line => 
                line.includes('class ') || line.includes('function ') || line.includes('import ')
            ).join('\n') + '\n// ... [Internal logic truncated] ...';
            modifiedRules.push('CPL: Signature Truncation');
        }

        // General cleanup for heavy tasks
        if (intent === 'ComplexArchitecture' || intent === 'Debug') {
            const originalLength = compressedCode.length;
            compressedCode = compressedCode.replace(/\n\s*\n/g, '\n').replace(/\/\/.*$/gm, '');
            if (originalLength !== compressedCode.length) modifiedRules.push('CPL: Strip Comments & Whitespace');
        }

        return { compressedCode, rules: modifiedRules };
    }
}

// ==========================================
// 5. MAIN EXECUTION & SIMULATOR
// ==========================================
export class CupidEngine {
    static processRequest(userPrompt: string, context: IDEContext) {
        const t0 = performance.now();
        
        const baselineString = userPrompt + "\n" + context.rawCodePayload;
        const baselineTokens = tokenizer.encode(baselineString).length;
        const baselineCost = (baselineTokens / 1000) * MODEL_REGISTRY.find(m=>m.id==='claude-4.7-opus')!.costPer1kTokens;

        // 1. Brain Routing
        const { intent, confidence, bestModel, rulesTriggered } = CupidBrain.evaluate(userPrompt, context);
        
        // 2. CPL Optimization
        const { compressedCode, rules } = CPLOptimizer.compress(context, intent, rulesTriggered);
        
        // 3. Real Token ROI Math
        const finalPayloadString = userPrompt + "\n" + compressedCode;
        const finalTokens = tokenizer.encode(finalPayloadString).length;
        const finalCost = (finalTokens / 1000) * bestModel.costPer1kTokens;
        const tokensSaved = baselineTokens - finalTokens;
        const estimatedCostSavings = baselineCost - finalCost;

        const t1 = performance.now();

        return {
            scenario: userPrompt,
            intent,
            rulesTriggered: rules.length > 0 ? rules.join(', ') : 'Fallback Rules',
            routedModel: bestModel.id,
            tokensSaved,
            costSaved: `$${estimatedCostSavings.toFixed(4)}`,
            latency: `${(t1 - t0).toFixed(2)}ms`
        };
    }
}

// ==========================================
// 6. UI DASHBOARD GENERATOR
// ==========================================
function runSimulations() {
    const dummyFileContext = "import { api } from 'core';\n" + "// This is a comment\n\n\nconst x = 1;\n".repeat(500); 

    const results = [
        CupidEngine.processRequest("There is an error in line 56, fix it", {
            fileName: "app.css", activeLanguage: 'css', fileLineCount: 500, hasTerminalError: true, hasHighlightedText: false, rawCodePayload: dummyFileContext, gitDiffText: null
        }),
        CupidEngine.processRequest("Write a commit message for this", {
            fileName: "auth.ts", activeLanguage: 'typescript', fileLineCount: 500, hasTerminalError: false, hasHighlightedText: false, rawCodePayload: dummyFileContext, gitDiffText: "+ const token = getJWT();\n- const token = null;"
        }),
        CupidEngine.processRequest("Explain the architecture of this memory management", {
            fileName: "memory.cpp", activeLanguage: 'cpp', fileLineCount: 500, hasTerminalError: false, hasHighlightedText: false, rawCodePayload: dummyFileContext, gitDiffText: null
        }),
        CupidEngine.processRequest("Refactor this highlighted function to be faster", {
            fileName: "utils.js", activeLanguage: 'javascript', fileLineCount: 500, hasTerminalError: false, hasHighlightedText: true, rawCodePayload: dummyFileContext, gitDiffText: null
        })
    ];

    console.table(results);

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>CUPID Telemetry Dashboard</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 40px; }
        .dashboard { max-width: 1200px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
        h2 { border-bottom: 1px solid #30363d; padding-bottom: 12px; color: #deff9a; font-weight: 600; display: flex; justify-content: space-between; }
        h2 span { font-size: 14px; font-weight: normal; color: #8b949e; align-self: flex-end; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; }
        th, td { padding: 14px 16px; border-bottom: 1px solid #21262d; vertical-align: top; }
        th { background-color: #21262d; font-size: 13px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; background: rgba(222, 255, 154, 0.15); color: #deff9a; border: 1px solid rgba(222, 255, 154, 0.3); }
        .intent { color: #58a6ff; font-weight: 500; font-size: 13px; }
        .metric { font-family: ui-monospace, SFMono-Regular, monospace; color: #79c0ff; font-weight: bold; }
        .rules { font-size: 12px; color: #8b949e; max-width: 250px; line-height: 1.4; }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <h2>CUPID Dynamic Auction Telemetry <span>Latency: Sub-50ms</span></h2>
        <table>
          <thead>
            <tr>
              <th>User Prompt</th>
              <th>Detected Intent</th>
              <th>Rules & CPL Triggers</th>
              <th>Winning Model</th>
              <th>Tokens Pruned</th>
              <th>ROI (Savings)</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(r => `
              <tr>
                <td>${r.scenario}</td>
                <td class="intent">${r.intent}</td>
                <td class="rules">${r.rulesTriggered.split(', ').map(rule => `• ${rule}`).join('<br>')}</td>
                <td><span class="badge">${r.routedModel}</span></td>
                <td class="metric">${r.tokensSaved.toLocaleString()}</td>
                <td class="metric" style="color: #3fb950;">${r.costSaved}</td>
                <td class="metric" style="color: #8b949e;">${r.latency}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </body>
    </html>
    `;

    fs.writeFileSync('dashboard.html', htmlContent);
    console.log('\n✅ SUCCESS: UI Dashboard generated! Open dashboard.html in your browser.');
}

runSimulations();