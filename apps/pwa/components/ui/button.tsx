import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-primary text-[#0B1220] shadow-[var(--shadow-z2)] focus-visible:outline-[#22D3EE]",
        secondary:
          "bg-white/10 text-text-primary border border-white/20 shadow-[var(--shadow-z1)] focus-visible:outline-white/60",
        outline:
          "border border-white/20 bg-transparent text-text-primary hover:bg-white/10 focus-visible:outline-white/60",
        ghost: "text-text-primary hover:bg-white/10 focus-visible:outline-white/60",
        glass:
          "glass-panel text-text-primary backdrop-blur-2xl focus-visible:outline-white/60 border border-white/20"
      },
      size: {
        default: "px-5 py-2.5",
        sm: "px-3 py-2 text-xs",
        lg: "px-6 py-3 text-base",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
