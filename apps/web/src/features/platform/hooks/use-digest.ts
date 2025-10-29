import { useCallback, useEffect, useState } from 'react';
import { enableDigestNotifications, isDigestEnabled } from '@/lib/pwa';

export function useDigest() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setEnabled(isDigestEnabled());
  }, []);

  const enable = useCallback(async () => {
    setLoading(true);
    try {
      const granted = await enableDigestNotifications();
      if (granted) {
        setEnabled(true);
      }
      return granted;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    enabled,
    loading,
    enable,
    setEnabled,
  } as const;
}

