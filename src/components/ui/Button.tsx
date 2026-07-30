import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B66E45] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[#B66E45] text-white hover:bg-[#D2926D] shadow-sm active:bg-[#AC6C24]",
        carbon:
          "bg-[#202322] text-white hover:bg-[#353938] shadow-sm active:bg-[#151817]",
        outline:
          "border border-[#DDD8CF] bg-white text-[#202322] hover:bg-[#FAF8F3] hover:text-[#202322]",
        secondary:
          "bg-[#F3EEE4] text-[#202322] hover:bg-[#DDD8CF] active:bg-[#E2DDD2]",
        ghost:
          "text-[#202322] hover:bg-[#F3EEE4] hover:text-[#202322]",
        link:
          "text-[#B66E45] underline-offset-4 hover:underline p-0 h-auto font-semibold",
        integrity:
          "bg-[#3457D5] text-white hover:bg-[#263F9F] shadow-sm",
        people:
          "bg-[#16897A] text-white hover:bg-[#10685D] shadow-sm",
        talent:
          "bg-[#D98C32] text-white hover:bg-[#AC6C24] shadow-sm",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base font-semibold",
        icon: "h-9 w-9 rounded-lg p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
