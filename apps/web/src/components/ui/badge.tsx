import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-slate-800/70 text-slate-100 border border-slate-600/60',
        success: 'bg-legal-green/20 text-legal-green border border-legal-green/60',
        warning: 'bg-legal-amber/20 text-legal-amber border border-legal-amber/60',
        danger: 'bg-legal-red/20 text-legal-red border border-legal-red/60',
        outline: 'border border-slate-600/60 text-slate-100',
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
