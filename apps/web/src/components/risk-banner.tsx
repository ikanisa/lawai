import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { IRACPayload } from '@avocat-ai/shared';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface RiskBannerProps {
  risk: IRACPayload['risk'];
  onHitl?: () => void;
  hitlLabel: string;
}

const riskPalette: Record<IRACPayload['risk']['level'], { bg: string; text: string; icon: React.ComponentType<any> }> = {
  LOW: { bg: 'bg-legal-green/15 border-legal-green/40 text-legal-green', text: 'Risque faible', icon: ShieldCheck },
  MEDIUM: { bg: 'bg-legal-amber/15 border-legal-amber/50 text-legal-amber', text: 'Risque moyen', icon: ShieldAlert },
  HIGH: { bg: 'bg-legal-red/20 border-legal-red/50 text-legal-red', text: 'Risque élevé', icon: ShieldAlert },
};

export function RiskBanner({ risk, onHitl, hitlLabel }: RiskBannerProps) {
  const palette = riskPalette[risk.level];
  const Icon = palette.icon;

  return (
    <div
      className={`glass-card flex flex-col gap-3 rounded-2xl border px-4 py-3 ${palette.bg} border-current ${palette.text}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide">{palette.text}</p>
          <p className="text-sm text-slate-200/80">{risk.why}</p>
        </div>
        {risk.hitl_required && onHitl && (
          <Button variant="outline" onClick={onHitl} className="text-xs uppercase">
            {hitlLabel}
          </Button>
        )}
      </div>
      {risk.hitl_required && (
        <Badge variant="warning" className="w-max">
          Revue humaine requise
        </Badge>
      )}
    </div>
  );
}
