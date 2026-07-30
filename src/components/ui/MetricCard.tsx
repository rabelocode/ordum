import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../../lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = "neutral",
  subtitle,
  icon,
  accentColor,
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-[#DDD8CF]/80 bg-white p-5 shadow-xs transition-all hover:border-[#DDD8CF]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#626866]">
          {title}
        </span>
        {icon && (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: accentColor || "#B66E45" }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-extrabold tracking-tight text-[#202322]">
          {value}
        </span>
        {change && (
          <div
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-bold rounded-md px-1.5 py-0.5",
              changeType === "positive" && "bg-[#E8F8F2] text-[#1F8A63]",
              changeType === "negative" && "bg-[#FDF0F0] text-[#C84E4E]",
              changeType === "neutral" && "bg-[#F3EEE4] text-[#626866]"
            )}
          >
            {changeType === "positive" && <TrendingUp className="w-3 h-3" />}
            {changeType === "negative" && <TrendingDown className="w-3 h-3" />}
            {changeType === "neutral" && <Minus className="w-3 h-3" />}
            <span>{change}</span>
          </div>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-[#626866]">{subtitle}</p>
      )}
    </div>
  );
}
