import React from "react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const sizeMap = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };
  return (
    <svg
      className={`animate-spin text-indigo-400 ${sizeMap[size]} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3 3 3h-4a8 8 0 01-8-8z" />
    </svg>
  );
}

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<string, string> = {
    completed: "badge-green",
    running: "badge-blue",
    failed: "badge-red",
    partial: "badge-yellow",
    pending: "badge-gray",
  };
  const icons: Record<string, string> = {
    completed: "✓",
    running: "⟳",
    failed: "✗",
    partial: "⚠",
    pending: "…",
  };
  return (
    <span className={map[status] ?? "badge-gray"}>
      {icons[status] ?? "?"} {status}
    </span>
  );
}

interface ParseStatusBadgeProps {
  status: string;
}

export function ParseStatusBadge({ status }: ParseStatusBadgeProps) {
  const map: Record<string, string> = {
    success: "badge-green",
    json_repair: "badge-yellow",
    code_block: "badge-yellow",
    failed: "badge-red",
  };
  return <span className={map[status] ?? "badge-gray"}>{status}</span>;
}

interface VerificationBadgeProps {
  passed: boolean | null;
}

export function VerificationBadge({ passed }: VerificationBadgeProps) {
  if (passed === null) return <span className="badge-gray">Not run</span>;
  if (passed) return <span className="badge-green">✓ Passed</span>;
  return <span className="badge-red">✗ Failed</span>;
}

interface TierBadgeProps {
  tier: string;
}

export function TierBadge({ tier }: TierBadgeProps) {
  const map: Record<string, string> = {
    nano: "badge-gray",
    micro: "badge-green",
    mid: "badge-blue",
    strong: "badge-purple",
    frontier: "badge-yellow",
    unknown: "badge-gray",
  };
  return <span className={map[tier] ?? "badge-gray"}>{tier}</span>;
}

export function CostDisplay({ usd }: { usd: number }) {
  if (usd === 0) return <span className="text-gray-500">$0.00</span>;
  if (usd < 0.001) return <span>${(usd * 1000).toFixed(3)}m</span>;
  return <span>${usd.toFixed(4)}</span>;
}

export function SavingsBadge({ percent }: { percent: number }) {
  if (percent <= 0) return <span className="badge-red">No savings</span>;
  if (percent >= 80) return <span className="badge-green">↓ {percent.toFixed(1)}%</span>;
  if (percent >= 40) return <span className="badge-blue">↓ {percent.toFixed(1)}%</span>;
  return <span className="badge-yellow">↓ {percent.toFixed(1)}%</span>;
}

interface ModelLabelProps {
  modelId: string;
  isRouter?: boolean;
}

export function ModelLabel({ modelId, isRouter }: ModelLabelProps) {
  const shortName = modelId.split("/").pop() ?? modelId;
  return (
    <span className="inline-flex items-center gap-1.5">
      {isRouter && <span className="text-indigo-400 text-xs">⚡</span>}
      <code className="text-xs font-mono text-gray-300">{shortName}</code>
    </span>
  );
}

export function EmptyState({ icon, title, desc }: { icon: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <span className="text-4xl">{icon}</span>
      <div className="text-gray-300 font-semibold">{title}</div>
      {desc && <div className="text-sm text-gray-500 max-w-xs">{desc}</div>}
    </div>
  );
}

export function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shimmer h-12 rounded-lg" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

export function SectionHeader({ icon, title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      {icon && <span className="text-xl mt-0.5">{icon}</span>}
      <div>
        <h2 className="font-semibold text-gray-200">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
