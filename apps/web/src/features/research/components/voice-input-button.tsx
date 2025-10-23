'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/ui/button';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  messages: {
    start: string;
    stop: string;
    unsupported: string;
  };
  disabled?: boolean;
  disabledMessage?: string;
}

type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer R }
  ? R
  : typeof window extends { webkitSpeechRecognition: infer W }
  ? W
  : never;

export function VoiceInputButton({ onTranscript, messages, disabled = false, disabledMessage }: VoiceInputButtonProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [supported, setSupported] = useState<boolean>(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition: SpeechRecognitionType | undefined =
      (window as typeof window & { SpeechRecognition?: SpeechRecognitionType }).SpeechRecognition ||
      (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionType }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    setSupported(true);
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        onTranscript(transcript.trim());
      }
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [onTranscript]);

  useEffect(() => {
    if (!disabled || !listening) return;
    const recognition = recognitionRef.current;
    try {
      recognition?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, [disabled, listening]);

  if (!supported) {
    return (
      <span className="text-xs text-slate-400" role="status">
        {messages.unsupported}
      </span>
    );
  }

  function toggleListening() {
    if (disabled) return;
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
      return;
    }
    setListening(true);
    recognition.start();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant={listening ? 'destructive' : 'outline'}
        onClick={toggleListening}
        aria-pressed={listening}
        aria-live="polite"
        disabled={disabled}
        aria-disabled={disabled || undefined}
        title={disabled ? disabledMessage : undefined}
      >
        {listening ? <Square className="mr-2 h-4 w-4" aria-hidden /> : <Mic className="mr-2 h-4 w-4" aria-hidden />}
        {listening ? messages.stop : messages.start}
      </Button>
      {disabled && disabledMessage ? (
        <span className="text-xs text-slate-400">{disabledMessage}</span>
      ) : null}
    </div>
  );
}
