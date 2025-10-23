import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent text-accent-foreground',
        success: 'border-transparent bg-success/15 text-success-foreground',
        warning: 'border-transparent bg-warning/15 text-warning-foreground',
        danger: 'border-transparent bg-destructive/10 text-destructive-foreground',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
