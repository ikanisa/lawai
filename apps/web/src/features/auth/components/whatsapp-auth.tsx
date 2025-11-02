'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@avocat-ai/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@avocat-ai/ui';
import { Input } from '@avocat-ai/ui';
import type { Messages } from '@/lib/i18n';
import { DEMO_ORG_ID, startWhatsAppOtp, verifyWhatsAppOtp } from '@/lib/api';

interface WhatsAppAuthProps {
  messages: Messages;
  orgId?: string;
}

const PHONE_REGEX = /^\+\d{8,15}$/;

export function WhatsAppAuth({ messages, orgId }: WhatsAppAuthProps) {
  const [stage, setStage] = useState<'start' | 'verify' | 'success'>('start');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [lastPhone, setLastPhone] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: (formattedPhone: string) =>
      startWhatsAppOtp({ phone: formattedPhone, orgId: orgId ?? DEMO_ORG_ID }),
    onSuccess: (_result, formattedPhone) => {
      setLastPhone(formattedPhone);
      setStage('verify');
      toast.success(messages.auth.otpSent.replace('{phone}', formattedPhone));
    },
    onError: (error: Error) => {
      const message =
        error.message === 'rate_limited_phone' || error.message === 'rate_limited_ip'
          ? messages.auth.errorRateLimit
          : messages.auth.errorGeneric;
      toast.error(message);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (payload: { phone: string; code: string }) =>
      verifyWhatsAppOtp({ phone: payload.phone, otp: payload.code, orgHint: orgId ?? DEMO_ORG_ID }),
    onSuccess: (data) => {
      setSessionToken(data.session_token);
      setStage('success');
      toast.success(messages.auth.success);
    },
    onError: () => {
      toast.error(messages.auth.errorGeneric);
    },
  });

  const handleStart = () => {
    const normalized = phone.trim();
    if (!PHONE_REGEX.test(normalized)) {
      toast.error(messages.auth.invalidPhone);
      return;
    }
    startMutation.mutate(normalized);
  };

  const handleVerify = () => {
    const targetPhone = lastPhone ?? phone.trim();
    if (!PHONE_REGEX.test(targetPhone)) {
      toast.error(messages.auth.invalidPhone);
      return;
    }
    if (otp.trim().length === 0) {
      toast.error(messages.auth.invalidOtp);
      return;
    }
    verifyMutation.mutate({ phone: targetPhone, code: otp.trim() });
  };

  const resetFlow = () => {
    setStage('start');
    setOtp('');
    setSessionToken(null);
  };

  return (
    <div className="mx-auto w-full max-w-md py-12">
      <Card className="glass-card border border-slate-800/60">
        <CardHeader>
          <CardTitle className="text-center text-xl font-semibold text-slate-100">
            {messages.auth.title}
          </CardTitle>
          <p className="text-center text-sm text-slate-400">{messages.auth.description}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {stage === 'start' ? (
            <div className="space-y-3">
              <label className="space-y-2 text-sm text-slate-300">
                <span>{messages.auth.phoneLabel}</span>
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+33612345678"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
              <Button className="w-full" onClick={handleStart} disabled={startMutation.isPending}>
                {startMutation.isPending ? messages.auth.sending : messages.auth.sendCode}
              </Button>
            </div>
          ) : null}

          {stage === 'verify' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">{messages.auth.enterCodeTitle}</p>
              <Input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder={messages.auth.otpPlaceholder}
                inputMode="numeric"
                maxLength={6}
              />
              <Button className="w-full" onClick={handleVerify} disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? messages.auth.verifying : messages.auth.verifyCode}
              </Button>
              <Button variant="ghost" className="w-full text-xs text-slate-400" onClick={resetFlow}>
                {messages.auth.back}
              </Button>
            </div>
          ) : null}

          {stage === 'success' ? (
            <div className="space-y-3 text-sm text-slate-200">
              <p>{messages.auth.success}</p>
              {sessionToken ? (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                  <p className="font-semibold">Session token</p>
                  <p className="break-all">{sessionToken}</p>
                </div>
              ) : null}
              <Button variant="outline" className="w-full" onClick={resetFlow}>
                {messages.auth.startAgain}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
