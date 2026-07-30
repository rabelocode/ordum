import React from "react";
import { TenantBranding } from "../../types";

interface TenantLogoProps {
  branding: TenantBranding;
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

export function TenantLogo({
  branding,
  size = "md",
  className = "",
  showText = true,
}: TenantLogoProps) {
  const isOrdum = branding.companyName.toLowerCase().includes("ordum");

  const heightClasses = {
    sm: "h-7",
    md: "h-9",
    lg: "h-12",
  };

  const textClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
  };

  if (branding.logoUrl) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <img
          src={branding.logoUrl}
          alt={branding.companyName}
          className={`${heightClasses[size]} object-contain`}
        />
      </div>
    );
  }

  // Styled Brand Icon with Primary Color
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="flex items-center justify-center rounded-xl font-bold text-white shadow-xs transition-transform duration-200 hover:scale-105"
        style={{
          backgroundColor: branding.primaryColor || "#B66E45",
          width: size === "sm" ? "28px" : size === "md" ? "36px" : "48px",
          height: size === "sm" ? "28px" : size === "md" ? "36px" : "48px",
        }}
      >
        {isOrdum ? (
          <span className="font-extrabold tracking-tighter text-base">O</span>
        ) : (
          <span className="font-extrabold uppercase text-sm">
            {branding.companyName.substring(0, 2)}
          </span>
        )}
      </div>

      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-extrabold tracking-tight text-[#202322] ${textClasses[size]}`}
          >
            {branding.companyName}
          </span>
          {isOrdum && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#B66E45]">
              SOLUÇÕES CORPORATIVAS
            </span>
          )}
        </div>
      )}
    </div>
  );
}
