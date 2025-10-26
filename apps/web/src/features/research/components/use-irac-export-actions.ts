import { useCallback } from 'react';
import { toast } from 'sonner';
import type { IRACPayload } from '@avocat-ai/shared';

import { exportIracToDocx, exportIracToPdf } from '@/lib/exporters';
import type { Locale } from '@/lib/i18n';

interface UseIracExportActionsOptions {
  payload: IRACPayload | null;
  locale: Locale;
  loadingMessages: {
    pdf: string;
    docx: string;
  };
  successMessages: {
    pdf: string;
    docx: string;
  };
  errorMessage: string;
}

export function useIracExportActions({
  payload,
  locale,
  loadingMessages,
  successMessages,
  errorMessage,
}: UseIracExportActionsOptions) {
  const handleExportPdf = useCallback(async () => {
    if (!payload) return;
    const toastId = 'export-pdf';
    toast.loading(loadingMessages.pdf, { id: toastId });
    try {
      await exportIracToPdf(payload, locale);
      toast.success(successMessages.pdf, { id: toastId });
    } catch (error) {
      console.error('export_pdf_failed', error);
      toast.error(errorMessage, { id: toastId });
    }
  }, [payload, locale, loadingMessages.pdf, successMessages.pdf, errorMessage]);

  const handleExportDocx = useCallback(async () => {
    if (!payload) return;
    const toastId = 'export-docx';
    toast.loading(loadingMessages.docx, { id: toastId });
    try {
      await exportIracToDocx(payload, locale);
      toast.success(successMessages.docx, { id: toastId });
    } catch (error) {
      console.error('export_docx_failed', error);
      toast.error(errorMessage, { id: toastId });
    }
  }, [payload, locale, loadingMessages.docx, successMessages.docx, errorMessage]);

  return {
    canExport: Boolean(payload),
    handleExportPdf,
    handleExportDocx,
  };
}
