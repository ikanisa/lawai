import { IRACPayload } from '@avocat-ai/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../ui/badge';

interface ClauseRiskCardMessages {
  title: string;
  description: string;
  issueLabel: string;
  rationaleLabel: string;
  hitlLabel: string;
}

interface ClauseRiskCardProps {
  risk: IRACPayload['risk'];
  issue: string;
  riskLabel: string;
  messages: ClauseRiskCardMessages;
}

const riskVariants: Record<IRACPayload['risk']['level'], 'success' | 'warning' | 'danger'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export function ClauseRiskCard({ risk, issue, riskLabel, messages }: ClauseRiskCardProps) {
  const variant = riskVariants[risk.level];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <p className="text-sm text-slate-300">{messages.description}</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={variant}>{riskLabel}</Badge>
          {risk.hitl_required ? <Badge variant="warning">{messages.hitlLabel}</Badge> : null}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{messages.issueLabel}</p>
          <p className="mt-1 text-slate-100">{issue}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{messages.rationaleLabel}</p>
          <p className="mt-1 text-slate-100">{risk.why}</p>
        </div>
      </CardContent>
    </Card>
  );
}
