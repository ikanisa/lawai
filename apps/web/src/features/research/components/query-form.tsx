import type { FormEvent } from 'react';

import type { Messages } from '@/lib/i18n';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';
import { Textarea } from '@/ui/textarea';

import { CameraOcrButton } from './camera-ocr-button';
import { VoiceInputButton } from './voice-input-button';

interface QueryFormMessages {
  heroPlaceholder: string;
  ohadaMode: string;
  euOverlay: string;
  confidentialMode: string;
}

interface ResearchQueryFormProps {
  question: string;
  context: string;
  ohadaMode: boolean;
  euOverlay: boolean;
  confidentialMode: boolean;
  processingLabel: string;
  submitLabel: string;
  contextPlaceholder: string;
  messages: QueryFormMessages;
  voiceMessages: Messages['research']['voice'];
  ocrMessages: Messages['research']['ocr'];
  confidentialMessages: Messages['research']['confidential'];
  isSubmitting?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onQuestionChange: (value: string) => void;
  onContextChange: (value: string) => void;
  onToggleOhada: () => void;
  onToggleEuOverlay: () => void;
  onToggleConfidential: () => void;
  onVoiceTranscript: (text: string) => void;
  onOcrText: (text: string) => void;
}

export function ResearchQueryForm({
  question,
  context,
  ohadaMode,
  euOverlay,
  confidentialMode,
  processingLabel,
  submitLabel,
  contextPlaceholder,
  messages,
  voiceMessages,
  ocrMessages,
  confidentialMessages,
  isSubmitting = false,
  onSubmit,
  onQuestionChange,
  onContextChange,
  onToggleOhada,
  onToggleEuOverlay,
  onToggleConfidential,
  onVoiceTranscript,
  onOcrText,
}: ResearchQueryFormProps) {
  return (
    <div className="glass-card rounded-3xl border border-slate-800/60 p-6 shadow-2xl">
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="hero-question">
          {messages.heroPlaceholder}
        </label>
        <div className="space-y-2">
          <Input
            id="hero-question"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder={messages.heroPlaceholder}
          />
          <VoiceInputButton
            messages={voiceMessages}
            onTranscript={onVoiceTranscript}
            disabled={confidentialMode}
            disabledMessage={confidentialMessages.voiceDisabled}
          />
        </div>
        <div className="space-y-2">
          <Textarea
            value={context}
            onChange={(event) => onContextChange(event.target.value)}
            placeholder={contextPlaceholder}
          />
          <CameraOcrButton
            messages={ocrMessages}
            onText={onOcrText}
            disabled={confidentialMode}
            disabledMessage={confidentialMessages.ocrDisabled}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Switch checked={ohadaMode} onClick={onToggleOhada} label={messages.ohadaMode} />
            <Switch checked={euOverlay} onClick={onToggleEuOverlay} label={messages.euOverlay} />
            <Switch
              checked={confidentialMode}
              onClick={onToggleConfidential}
              label={messages.confidentialMode}
            />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? processingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
