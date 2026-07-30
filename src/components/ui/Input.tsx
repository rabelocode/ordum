import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-[#353938]"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            "flex h-11 w-full rounded-xl border border-[#DDD8CF] bg-white px-3.5 py-2 text-sm text-[#202322] placeholder:text-[#9CA3AF] focus:border-[#B66E45] focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            error && "border-[#C84E4E] focus:border-[#C84E4E] focus:ring-[#C84E4E]/20",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-[#C84E4E] font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : "password");

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-[#353938]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            id={inputId}
            className={cn(
              "flex h-11 w-full rounded-xl border border-[#DDD8CF] bg-white pl-3.5 pr-11 py-2 text-sm text-[#202322] placeholder:text-[#9CA3AF] focus:border-[#B66E45] focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              error && "border-[#C84E4E] focus:border-[#C84E4E] focus:ring-[#C84E4E]/20",
              className
            )}
            ref={ref}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#626866] hover:text-[#202322] focus:outline-none p-1 rounded-md"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-[#C84E4E] font-medium">{error}</p>}
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
