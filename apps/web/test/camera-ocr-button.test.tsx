import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { CameraOcrButton, __resetOcrWorkerForTests } from '@/features/research/components/camera-ocr-button';

const recognize = vi.fn(async () => ({ data: { text: 'Article reconnu' } }));

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(() => Promise.resolve({
    recognize,
    terminate: vi.fn(),
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CameraOcrButton', () => {
  beforeEach(() => {
    recognize.mockClear();
    __resetOcrWorkerForTests();
  });

  it('processes an image and forwards recognised text', async () => {
    const handleText = vi.fn();
    const messages = {
      capture: 'Scanner',
      processing: 'Traitement…',
      error: 'Erreur',
      success: 'Succès',
    };

    const { container } = render(<CameraOcrButton messages={messages} onText={handleText} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['binary'], 'capture.png', { type: 'image/png' });

    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => expect(handleText).toHaveBeenCalledWith('Article reconnu'));
    expect(recognize).toHaveBeenCalledTimes(1);
  });
});
