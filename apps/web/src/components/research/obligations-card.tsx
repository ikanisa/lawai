import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../ui/badge';

interface ObligationsCardMessages {
  title: string;
  description: string;
  empty: string;
  countLabel: string;
}

interface ObligationsCardProps {
  obligations: string[];
  messages: ObligationsCardMessages;
}

export function ObligationsCard({ obligations, messages }: ObligationsCardProps) {
  const countLabel = messages.countLabel.replace('{count}', obligations.length.toString());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>{messages.title}</span>
          <Badge variant="outline">{countLabel}</Badge>
        </CardTitle>
        <p className="text-sm text-slate-300">{messages.description}</p>
      </CardHeader>
      <CardContent className="text-sm text-slate-200">
        {obligations.length === 0 ? (
          <p className="text-slate-400">{messages.empty}</p>
        ) : (
          <ul className="space-y-2">
            {obligations.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-legal-amber" aria-hidden />
                <span className="leading-relaxed text-slate-100">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
