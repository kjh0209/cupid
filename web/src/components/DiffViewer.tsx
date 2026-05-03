import React from "react";

interface DiffViewerProps {
  diff: string;
  label?: string;
  maxHeight?: string;
}

export function DiffViewer({ diff, label, maxHeight = "400px" }: DiffViewerProps) {
  if (!diff || diff.trim() === "") {
    return (
      <div className="code-block text-gray-500 text-xs italic p-4">
        No diff available
      </div>
    );
  }

  const lines = diff.split("\n");

  return (
    <div className="rounded-lg overflow-hidden border border-gray-800">
      {label && (
        <div className="bg-gray-800/60 px-3 py-1.5 text-xs font-medium text-gray-400 border-b border-gray-800">
          {label}
        </div>
      )}
      <div
        className="overflow-auto bg-gray-950 text-xs font-mono"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => {
              let cls = "text-gray-400";
              let bg = "";
              if (line.startsWith("+++") || line.startsWith("---")) {
                cls = "text-gray-300 font-semibold";
                bg = "bg-gray-800/40";
              } else if (line.startsWith("@@")) {
                cls = "text-cyan-400";
                bg = "bg-cyan-950/20";
              } else if (line.startsWith("+")) {
                cls = "text-emerald-300";
                bg = "bg-emerald-950/30";
              } else if (line.startsWith("-")) {
                cls = "text-red-300";
                bg = "bg-red-950/30";
              } else if (line.startsWith("diff ") || line.startsWith("index ")) {
                cls = "text-violet-400";
                bg = "bg-violet-950/10";
              }

              return (
                <tr key={i} className={`${bg} hover:brightness-110`}>
                  <td className="pl-3 pr-2 py-0.5 text-gray-600 select-none w-8 text-right border-r border-gray-800/50">
                    {i + 1}
                  </td>
                  <td className={`pl-3 pr-4 py-0.5 ${cls} whitespace-pre`}>
                    {line || " "}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
