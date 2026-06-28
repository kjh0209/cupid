import React, { useEffect, useRef, useState } from "react";

interface LogEntry {
  level: "log" | "warn" | "error" | "info";
  args: unknown[];
  ts: number;
}

interface Props {
  code: string;
  language: "javascript" | "typescript" | "html";
  /** Used to detect "I've changed file" and force iframe remount */
  bumpKey: number;
}

// Strip a small set of TypeScript constructs so that simple TS code runs in a
// plain browser. This is intentionally minimal — for production-grade TS,
// users should save their file as .js or compile externally.
function stripTypes(src: string): string {
  return src
    // Strip "as Type" assertions
    .replace(/\s+as\s+[A-Za-z_$][\w$<>,\s|&\[\]]*/g, "")
    // Strip type annotations on variable declarations: const x: T = ...
    .replace(/(\b(?:const|let|var)\s+[A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$<>,\s|&\[\]?]*(\s*=)/g, "$1$2")
    // Strip parameter type annotations: (x: T, y: U) — best-effort
    .replace(/(\([^)]*?)\b([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$<>,\s|&\[\]?]*([,)])/g, "$1$2$3")
    // Strip return type annotations: ): T {
    .replace(/\)\s*:\s*[A-Za-z_$][\w$<>,\s|&\[\]?]*\s*({)/g, ") $1")
    // Remove "interface ... { ... }" blocks (simple, single-level)
    .replace(/\binterface\s+[A-Za-z_$][\w$]*\s*(<[^>]+>)?\s*\{[^}]*\}/g, "")
    // Remove "type Foo = ...;" declarations
    .replace(/\btype\s+[A-Za-z_$][\w$]*\s*(<[^>]+>)?\s*=\s*[^;]+;/g, "");
}

function buildHtml(code: string, language: Props["language"]): string {
  if (language === "html") {
    return code;
  }
  const js = language === "typescript" ? stripTypes(code) : code;
  // Sandbox shim — capture console + uncaught errors and postMessage to parent
  const shim = `
    (function(){
      function safe(arg){ try { return JSON.parse(JSON.stringify(arg, function(_,v){ if (typeof v === 'function') return '[Function]'; if (v instanceof Error) return v.stack||v.message; return v; })); } catch(e){ return String(arg); } }
      function emit(level, args){ parent.postMessage({ __sandbox: true, level: level, args: Array.prototype.map.call(args, safe), ts: Date.now() }, '*'); }
      var origLog = console.log, origWarn = console.warn, origErr = console.error, origInfo = console.info;
      console.log = function(){ emit('log', arguments); origLog.apply(console, arguments); };
      console.warn = function(){ emit('warn', arguments); origWarn.apply(console, arguments); };
      console.error = function(){ emit('error', arguments); origErr.apply(console, arguments); };
      console.info = function(){ emit('info', arguments); origInfo.apply(console, arguments); };
      window.addEventListener('error', function(ev){ emit('error', [ev.message + ' @ ' + (ev.filename||'')+':'+(ev.lineno||0)]); });
      window.addEventListener('unhandledrejection', function(ev){ emit('error', ['Unhandled rejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason))]); });
    })();
  `;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>sandbox</title></head><body><script>${shim}</script><script>try{\n${js}\n}catch(e){ console.error(e && e.stack || String(e)); }</script></body></html>`;
}

export default function SandboxRunner({ code, language, bumpKey }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data as { __sandbox?: boolean; level?: LogEntry["level"]; args?: unknown[]; ts?: number };
      if (!d || !d.__sandbox) return;
      setLogs((l) => [...l.slice(-499), { level: d.level ?? "log", args: d.args ?? [], ts: d.ts ?? Date.now() }]);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const run = () => {
    setLogs([]);
    setRunning(true);
    // Force remount of iframe by bumping its key (handled by parent via bumpKey)
    const html = buildHtml(code, language);
    if (iframeRef.current) {
      iframeRef.current.srcdoc = html;
    }
    setTimeout(() => setRunning(false), 800);
  };

  const fmt = (v: unknown): string => {
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <button onClick={run} className="btn-success text-xs py-1.5 px-3">
          {running ? "Running…" : "▶ Run in sandbox"}
        </button>
        <button onClick={() => setLogs([])} className="btn-ghost text-xs py-1 px-3">Clear logs</button>
        <span className="text-[11px] text-gray-500 ml-auto">
          {language === "html" ? "HTML rendered directly" : "Captured console output"}
        </span>
      </div>

      {language === "html" ? (
        <iframe
          key={bumpKey}
          ref={iframeRef}
          sandbox="allow-scripts"
          srcDoc={code}
          className="w-full flex-1 min-h-[300px] bg-white rounded border border-gray-800"
          title="sandbox"
        />
      ) : (
        <>
          <iframe
            key={bumpKey}
            ref={iframeRef}
            sandbox="allow-scripts"
            className="hidden"
            title="sandbox"
          />
          <div className="code-block flex-1 min-h-[200px] overflow-auto">
            {logs.length === 0 ? (
              <div className="text-gray-600 italic text-xs">No output yet. Press Run to execute the file in a sandboxed iframe.</div>
            ) : (
              logs.map((l, i) => (
                <div key={i} className={
                  l.level === "error" ? "text-red-300" :
                  l.level === "warn"  ? "text-amber-300" :
                  l.level === "info"  ? "text-blue-300" :
                  "text-gray-200"
                }>
                  <span className="text-gray-600 mr-2">[{l.level}]</span>
                  {l.args.map(fmt).join(" ")}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
