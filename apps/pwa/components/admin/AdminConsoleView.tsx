"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CreditCard, FileText, Settings2, ShieldCheck, Users } from "lucide-react";

import { Badge } from '@avocat-ai/ui';
import { Button } from '@avocat-ai/ui';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from '@avocat-ai/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminConsoleQueryOptions } from "@/lib/queries/admin";
import { type AdminConsoleData, type PolicyToggle } from "@/lib/data/admin";

const tabConfig = [
  { id: "people", label: "Personnes & rôles", icon: Users },
  { id: "policies", label: "Politiques", icon: ShieldCheck },
  { id: "jurisdictions", label: "Juridictions", icon: Building2 },
  { id: "audit", label: "Journal", icon: FileText },
  { id: "billing", label: "Facturation", icon: CreditCard }
];

function PolicyRow({ policy, onToggle }: { policy: PolicyToggle; onToggle: (enabled: boolean) => void }) {
  return (
    <div className="flex items-start justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <p className="text-sm font-semibold text-white">{policy.label}</p>
        <p className="mt-1 text-xs text-white/60">{policy.description}</p>
      </div>
      <Switch checked={policy.enabled} onCheckedChange={onToggle} />
    </div>
  );
}

export function AdminConsoleView() {
  const { data, isLoading, isError } = useQuery(adminConsoleQueryOptions());
  const [tab, setTab] = useState(tabConfig[0]!.id);
  const [localData, setLocalData] = useState<AdminConsoleData | null>(null);

  const consoleData = localData ?? data;

  const togglePolicy = (id: string, enabled: boolean) => {
    setLocalData((prev) => {
      const base = prev ?? data;
      if (!base) return prev;
      return {
        ...base,
        policies: base.policies.map((policy) =>
          policy.id === id
            ? {
              ...policy,
              enabled
            }
            : policy
        )
      };
    });
  };

  if (isLoading || !consoleData) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[520px] rounded-3xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        Console admin indisponible pour le moment.
      </div>
    );
  }

  const billing = consoleData.billing;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Console d’administration</h1>
          <p className="mt-1 text-sm text-white/70">
            Gérez les utilisateurs, politiques de conformité, accès juridictionnels et facturation de la suite.
          </p>
        </div>
        <Button variant="secondary" className="gap-2">
          <Settings2 className="h-4 w-4" /> Paramètres SSO
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[var(--glass-shadow)]">
        <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-2xl bg-white/10 p-2 lg:grid-cols-5">
          {tabConfig.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70"
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="people" className="mt-5 space-y-3">
          {consoleData.people.map((person) => (
            <div key={person.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="text-sm font-semibold text-white">{person.name}</p>
                <p className="text-xs text-white/60">{person.role}</p>
                <p className="mt-1 text-xs text-white/60">
                  Juridictions : {person.jurisdictionFocus.join(", ")}
                </p>
              </div>
              <Badge variant={person.status === "active" ? "success" : "outline"}>
                {person.status === "active" ? "Actif" : person.status === "invited" ? "Invité" : "Suspendu"}
              </Badge>
            </div>
          ))}
          <Button variant="outline">Inviter une personne</Button>
        </TabsContent>

        <TabsContent value="policies" className="mt-5 space-y-3">
          {consoleData.policies.map((policy) => (
            <PolicyRow key={policy.id} policy={policy} onToggle={(enabled) => togglePolicy(policy.id, enabled)} />
          ))}
        </TabsContent>

        <TabsContent value="jurisdictions" className="mt-5 space-y-3">
          {consoleData.jurisdictions.map((jurisdiction) => {
            const usagePercent = Math.round((jurisdiction.usage / jurisdiction.seats) * 100);
            return (
              <div key={jurisdiction.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm text-white">
                  <span className="font-semibold">{jurisdiction.jurisdiction}</span>
                  <span>
                    {jurisdiction.usage}/{jurisdiction.seats} sièges ({usagePercent}%)
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[#22D3EE] to-[#6366F1]"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>
            );
          })}
          <Button size="sm" variant="outline">
            Ajuster les sièges
          </Button>
        </TabsContent>

        <TabsContent value="audit" className="mt-5">
          <ScrollArea className="h-[320px] pr-3">
            <ol className="space-y-3 text-sm text-white/70">
              {consoleData.auditLogs.map((entry) => (
                <li key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>{new Date(entry.occurredAt).toLocaleString()}</span>
                    <span>{entry.actor}</span>
                  </div>
                  <p className="mt-2 text-white">{entry.action}</p>
                  <p className="mt-1 text-white/70">{entry.detail}</p>
                </li>
              ))}
            </ol>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="billing" className="mt-5 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold text-white">Plan actuel</p>
            <p className="mt-1 text-white/70">{billing.currentPlan}</p>
            <p className="mt-2 text-sm text-white/70">
              {billing.seatsUsed}/{billing.seatsIncluded} sièges utilisés
            </p>
            <p className="mt-1 text-sm text-white/60">Prochaine facture : {new Date(billing.nextInvoiceAt).toLocaleDateString()}</p>
            <p className="mt-2 text-lg font-semibold text-white">{billing.estimatedAmount.toLocaleString()} €</p>
          </div>
          <Button>Exporter la facture détaillée</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
