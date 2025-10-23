'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '.@/ui/card';
import { Input } from '.@/ui/input';
import { Button } from '.@/ui/button';
import type { Messages } from '../@/lib/i18n';
import { DEMO_ORG_ID, DEMO_USER_ID, startWhatsAppOtp, linkWhatsAppOtp, unlinkWhatsApp } from '../@/lib/api';

interface SecurityPanelProps {
  messages: Messages;
}

const PHONE_REGEX = /^\+\d{8,15}$/;

export function SecurityPanel({ messages }: SecurityPanelProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [linked, setLinked] = useState(false);
  const [waId, setWaId] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: (formattedPhone: string) => startWhatsAppOtp({ phone: formattedPhone, orgId: DEMO_ORG_ID }),
    onSuccess: (_, formattedPhone) => {
      toast.success(messages.security.otpSent.replace('{phone}', formattedPhone));
    },
    onError: () => {
      toast.error(messages.security.errorGeneric);
    },
  });

  const linkMutation = useMutation({
    mutationFn: (payload: { phone: string; code: string }) =>
      linkWhatsAppOtp({ phone: payload.phone, otp: payload.code, orgId: DEMO_ORG_ID, userId: DEMO_USER_ID }),
    onSuccess: (data) => {
      setWaId(data.wa_id);
      setLinked(true);
      toast.success(messages.security.linked);
    },
    onError: () => {
      toast.error(messages.security.errorGeneric);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () => unlinkWhatsApp({ orgId: DEMO_ORG_ID, userId: DEMO_USER_ID }),
    onSuccess: () => {
      setLinked(false);
      setWaId(null);
      toast.success(messages.security.unlinked);
    },
    onError: () => {
      toast.error(messages.security.errorGeneric);
    },
  });

  const handleSendCode = () => {
    const normalized = phone.trim();
    if (!PHONE_REGEX.test(normalized)) {
      toast.error(messages.security.invalidPhone);
      return;
    }
    startMutation.mutate(normalized);
  };

  const handleLink = () => {
    const normalized = phone.trim();
    if (!PHONE_REGEX.test(normalized)) {
      toast.error(messages.security.invalidPhone);
      return;
    }
    if (!otp.trim()) {
      toast.error(messages.security.invalidOtp);
      return;
    }
    linkMutation.mutate({ phone: normalized, code: otp.trim() });
  };

  return (
    <Card className="glass-card border border-slate-800/60">
      <CardHeader>
        <CardTitle className="text-slate-100">{messages.security.title}</CardTitle>
        <p className="text-sm text-slate-400">{messages.security.description}</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-200">
        <label className="space-y-2 text-slate-300">
          <span>{messages.security.phoneLabel}</span>
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+33612345678"
            inputMode="tel"
          />
        </label>
        <div className="flex gap-2">
          <Button onClick={handleSendCode} disabled={startMutation.isPending}>
            {startMutation.isPending ? messages.security.sending : messages.security.sendCode}
          </Button>
          {linked ? (
            <Button variant="outline" onClick={() => unlinkMutation.mutate()} disabled={unlinkMutation.isPending}>
              {unlinkMutation.isPending ? messages.security.unlinking : messages.security.unlink}
            </Button>
          ) : null}
        </div>

        <label className="space-y-2 text-slate-300">
          <span>{messages.security.otpLabel}</span>
          <Input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" maxLength={6} />
        </label>
        <Button onClick={handleLink} disabled={linkMutation.isPending || linked}>
          {linkMutation.isPending ? messages.security.linking : messages.security.link}
        </Button>

        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 text-xs text-slate-400">
          <p>{linked ? messages.security.linkedStatus : messages.security.notLinked}</p>
          {waId ? <p className="mt-1 break-all text-slate-300">{waId}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
