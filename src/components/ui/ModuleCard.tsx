import React from "react";
import { ShieldCheck, Users, Briefcase, ArrowRight, CheckCircle, ExternalLink } from "lucide-react";
import { ModuleManifest } from "../../types";
import { Badge } from "./Badge";
import { Button } from "./Button";

const ICON_MAP: Record<string, React.ReactNode> = {
  ShieldCheck: <ShieldCheck className="w-6 h-6" />,
  Users: <Users className="w-6 h-6" />,
  Briefcase: <Briefcase className="w-6 h-6" />,
};

export interface ModuleCardProps {
  key?: string | number;
  module: ModuleManifest;
  pendingCount?: number;
  onNavigate: (path: string) => void;
  isSpotlight?: boolean;
}

export function ModuleCard({
  module,
  pendingCount = 0,
  onNavigate,
  isSpotlight = false,
}: ModuleCardProps) {
  const icon = ICON_MAP[module.icon] || <ShieldCheck className="w-6 h-6" />;

  const badgeVariant =
    module.id === "integrity"
      ? "integrity"
      : module.id === "people"
      ? "people"
      : "talent";

  const buttonVariant =
    module.id === "integrity"
      ? "integrity"
      : module.id === "people"
      ? "people"
      : "talent";

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border border-[#DDD8CF]/80 bg-white p-5 sm:p-6 shadow-xs transition-all duration-300 hover:shadow-md hover:border-[#DDD8CF] min-w-0 ${
        isSpotlight ? "md:p-8 border-[1.5px]" : ""
      }`}
      style={{
        borderTopColor: module.accentColor,
        borderTopWidth: "4px",
      }}
    >
      <div className="min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4 min-w-0">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl font-bold transition-transform duration-200 group-hover:scale-105 flex-shrink-0"
            style={{
              backgroundColor: module.lightColor,
              color: module.darkColor,
            }}
          >
            {icon}
          </div>
          <div className="flex flex-wrap items-center sm:justify-end gap-1.5 min-w-0">
            {pendingCount > 0 && (
              <Badge variant="warning" className="animate-pulse">
                {pendingCount} {pendingCount === 1 ? "pendência" : "pendências"}
              </Badge>
            )}
            <Badge variant={badgeVariant as any}>Disponível na demonstração</Badge>
          </div>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-[#202322] mb-1 group-hover:text-[#202322] break-words min-w-0">
          {module.name}
        </h3>
        <p className="text-xs font-semibold text-[#626866] mb-3 uppercase tracking-wider break-words min-w-0">
          {module.tagline}
        </p>
        <p className="text-sm text-[#626866] leading-relaxed mb-6 break-words min-w-0">
          {module.description}
        </p>

        {/* Quick Features */}
        <div className="mb-6 space-y-2 min-w-0">
          {module.features.slice(0, isSpotlight ? 6 : 4).map((feat, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-[#353938] min-w-0">
              <CheckCircle
                className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                style={{ color: module.accentColor }}
              />
              <span className="break-words min-w-0">{feat}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0">
        {/* Quick actions */}
        {module.quickActions && module.quickActions.length > 0 && (
          <div className="pt-4 border-t border-[#DDD8CF]/50 mb-4 flex flex-wrap gap-2 min-w-0">
            {module.quickActions.map((qa) => (
              <button
                key={qa.id}
                onClick={() => onNavigate(qa.actionUrl)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#626866] hover:text-[#202322] bg-[#FAF8F3] hover:bg-[#F3EEE4] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer min-h-[36px]"
              >
                <span className="truncate">{qa.label}</span>
                <ExternalLink className="w-3 h-3 text-[#B66E45] flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        <Button
          variant={buttonVariant}
          className="w-full justify-between group-hover:pr-5 transition-all cursor-pointer min-h-[44px] rounded-xl text-xs sm:text-sm font-bold"
          onClick={() => onNavigate(module.basePath)}
        >
          <span>Acessar Solução</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 flex-shrink-0" />
        </Button>
      </div>
    </div>
  );
}
