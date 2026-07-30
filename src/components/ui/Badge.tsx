import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#B66E45] text-white shadow-sm",
        secondary:
          "border-transparent bg-[#F3EEE4] text-[#202322]",
        outline:
          "border-[#DDD8CF] text-[#626866]",
        copper:
          "border-[#D2926D]/30 bg-[#B66E45]/10 text-[#B66E45]",
        carbon:
          "border-transparent bg-[#202322] text-white",
        integrity:
          "border-[#3457D5]/20 bg-[#E9EDFF] text-[#263F9F]",
        people:
          "border-[#16897A]/20 bg-[#E4F5F1] text-[#10685D]",
        talent:
          "border-[#D98C32]/20 bg-[#FFF1DD] text-[#AC6C24]",
        success:
          "border-[#1F8A63]/20 bg-[#E8F8F2] text-[#1F8A63]",
        warning:
          "border-[#C98224]/20 bg-[#FEF6E8] text-[#C98224]",
        danger:
          "border-[#C84E4E]/20 bg-[#FDF0F0] text-[#C84E4E]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  children?: React.ReactNode;
  className?: string;
}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
