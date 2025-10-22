'use client';

import { FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { Messages } from '../../lib/i18n';

const PDF_FILE_INPUTS_DOC_URL =
  'https://github.com/avocat-ai/lawai/blob/main/docs/agents/pdf-file-inputs.md';

interface KnowledgeBaseViewProps {
  messages: Messages;
}

export function KnowledgeBaseView({ messages }: KnowledgeBaseViewProps) {
  const knowledgeMessages = messages.knowledgeBase;

  const cards = [
    {
      id: 'pdf-file-inputs',
      title: knowledgeMessages.cards.pdfFileInputs.title,
      description: knowledgeMessages.cards.pdfFileInputs.description,
      badge: knowledgeMessages.cards.pdfFileInputs.badge,
      features: knowledgeMessages.cards.pdfFileInputs.features,
      href: PDF_FILE_INPUTS_DOC_URL,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-100">{knowledgeMessages.title}</h1>
        <p className="text-sm text-slate-400">{knowledgeMessages.subtitle}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.id} className="glass-card border border-slate-800/60">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-slate-100">
                <span className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-emerald-300" aria-hidden />
                  {card.title}
                </span>
                <Badge variant="success">{card.badge}</Badge>
              </CardTitle>
              <p className="text-sm text-slate-300">{card.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc space-y-2 pl-5 text-xs text-slate-300">
                {card.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="inline-flex items-center gap-2" asChild>
                <a href={card.href} target="_blank" rel="noreferrer">
                  {knowledgeMessages.viewDoc}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
