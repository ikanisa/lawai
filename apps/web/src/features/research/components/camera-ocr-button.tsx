'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { Scan, Loader2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { toast } from 'sonner';

interface CameraOcrButtonProps {
  onText: (text: string) => void;
  messages: {
    capture: string;
    processing: string;
    error: string;
    success: string;
  };
  disabled?: boolean;
  disabledMessage?: string;
}

type OcrWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

let workerPromise: Promise<OcrWorker> | null = null;

export async function getOcrWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) => createWorker('fra+eng'))
      .catch((error) => {
        workerPromise = null;
        throw error;
      });
  }
  return workerPromise;
}

export async function __resetOcrWorkerForTests() {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch {
    // ignore in tests
  } finally {
    workerPromise = null;
  }
}

export function CameraOcrButton({ onText, messages, disabled = false, disabledMessage }: CameraOcrButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const toastId = 'ocr-processing';
    toast.loading(messages.processing, { id: toastId });
    try {
      const worker = await getOcrWorker();
      const result = await worker.recognize(file);
      const text = result?.data?.text?.trim();
      if (text) {
        onText(text);
        toast.success(messages.success, { id: toastId });
      } else {
        toast.error(messages.error, { id: toastId });
      }
    } catch (error) {
      console.error('ocr_failed', error);
      toast.error(messages.error, { id: toastId });
      workerPromise = null;
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }

  const buttonDisabled = disabled || loading;

  return (
    <div className="flex flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFiles}
        className="hidden"
        aria-hidden
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          if (buttonDisabled) return;
          inputRef.current?.click();
        }}
        disabled={buttonDisabled}
        aria-disabled={buttonDisabled || undefined}
        title={disabled ? disabledMessage : undefined}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Scan className="mr-2 h-4 w-4" aria-hidden />
        )}
        {messages.capture}
      </Button>
      {disabled && disabledMessage ? (
        <span className="text-xs text-slate-400">{disabledMessage}</span>
      ) : null}
    </div>
  );
}
