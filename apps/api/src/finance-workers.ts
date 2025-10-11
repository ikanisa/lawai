import type {
  FinanceCommandPayload,
  FinanceCommandResult,
  FinanceCommandIntent,
  FinanceDomainKey,
} from '@avocat-ai/shared';
import {
  AnalyticsClient,
  ErpPayablesClient,
  GrcClient,
  RegulatoryClient,
  TaxGatewayClient,
  type ConnectorConfig,
} from './connectors/index.js';
import { workerRegistry, type DomainWorker, type WorkerExecuteContext } from './worker.js';

function connectorsMissing(payload: FinanceCommandPayload, required: string[]): string[] {
  const map = payload.connectors ?? {};
  return required.filter((name) => {
    const info = map[name];
    if (!info) {
      return true;
    }
    if (info.status === undefined) {
      return false;
    }
    return info.status !== 'active';
  });
}

function connectorHitl(payload: FinanceCommandPayload, missing: string[], reason?: string): FinanceCommandResult {
  return {
    status: 'needs_hitl',
    hitlReason: reason ?? `activate_connectors:${missing.join(',')}`,
    notices: missing.map((name) => `Activer le connecteur ${name} avant de poursuivre.`),
    output: {
      objective: payload.objective,
      connectorsMissing: missing,
    },
  };
}

function buildFollowUp(
  base: FinanceCommandPayload,
  intent: FinanceCommandIntent,
  objective: string,
  inputs: Record<string, unknown>,
): FinanceCommandPayload {
  return {
    intent,
    domain: base.domain,
    objective,
    inputs,
    guardrails: base.guardrails,
    telemetry: base.telemetry,
    connectors: base.connectors,
    safety: base.safety,
    metadata: base.metadata,
  };
}

function normaliseDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return trimmed;
  }
  return null;
}

type ConnectorRecord = {
  name: string;
  connector_type: string | null;
  status: string | null;
  config: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

async function loadConnectorMap(
  supabase: WorkerExecuteContext['supabase'],
  orgId: string,
): Promise<Map<string, ConnectorRecord>> {
  const { data, error } = await supabase
    .from('org_connectors')
    .select('name, connector_type, status, config, metadata')
    .eq('org_id', orgId);

  if (error) {
    throw new Error(`connector_lookup_failed:${error.message}`);
  }

  const map = new Map<string, ConnectorRecord>();
  for (const entry of data ?? []) {
    if (!entry?.name) {
      continue;
    }
    map.set(String(entry.name), {
      name: String(entry.name),
      connector_type: entry.connector_type ?? null,
      status: entry.status ?? null,
      config: (entry.config as Record<string, unknown> | null) ?? null,
      metadata: (entry.metadata as Record<string, unknown> | null) ?? null,
    });
  }
  return map;
}

function valueToString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function valueToNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function valueToRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') {
      result[key] = raw;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function resolveConnectorConfig(record: ConnectorRecord | null): ConnectorConfig | null {
  if (!record?.config) {
    return null;
  }
  const raw = record.config;
  const endpoint = valueToString((raw as Record<string, unknown>).endpoint) ?? valueToString((raw as Record<string, unknown>).url);
  if (!endpoint) {
    return null;
  }
  return {
    endpoint,
    apiKey: valueToString(raw.apiKey),
    tenantId: valueToString(raw.tenantId),
    extraHeaders: valueToRecord(raw.headers),
    timeoutMs: valueToNumber(raw.timeoutMs),
  };
}

async function requireMaybeSingle<T>(
  promise: Promise<{ data: T | null; error: { message: string } | null }>,
  errorCode: string,
): Promise<T | null> {
  const { data, error } = await promise;
  if (error) {
    throw new Error(`${errorCode}:${error.message}`);
  }
  return data;
}

async function executeTax({ envelope, supabase, logger }: WorkerExecuteContext): Promise<FinanceCommandResult> {
  const payload = envelope.command.payload;
  const missing = connectorsMissing(payload, ['tax_authority_gateway', 'general_ledger']);
  if (missing.length > 0) {
    return connectorHitl(payload, missing);
  }

  const orgId = envelope.session.orgId;
  const connectorMap = await loadConnectorMap(supabase, orgId);
  const taxConnector = ensureConnectorActive(payload, connectorMap, 'tax_authority_gateway', 'tax');
  if (!taxConnector) {
    return connectorHitl(payload, ['tax_authority_gateway']);
  }
  const taxConfig = resolveConnectorConfig(taxConnector);
  if (!taxConfig) {
    return connectorHitl(payload, ['tax_authority_gateway'], 'connector_config_missing');
  }
  const taxClient = new TaxGatewayClient(taxConfig, logger);

  const jurisdiction = (payload.inputs?.jurisdiction as string | undefined) ?? 'Inconnue';
  const period = (payload.inputs?.period as string | undefined) ?? 'période courante';

  try {
    switch (payload.intent) {
      case 'tax.prepare_filing': {
        const amount = payload.inputs?.amount !== undefined ? Number(payload.inputs.amount) : null;
        const currency = (payload.inputs?.currency as string | undefined) ?? 'EUR';

        const submission = await taxClient.submitFiling({
          jurisdiction,
          period,
          amount,
          currency,
          payload: payload.inputs ?? {},
        });

        await requireMaybeSingle(
          (supabase
            .from('finance_tax_filings')
            .upsert(
              {
                org_id: orgId,
                jurisdiction,
                period,
                status: 'prepared',
                amount,
                currency,
                due_date: normaliseDate(payload.inputs?.dueDate),
                metadata: {
                  ...(payload.inputs ?? {}),
                  submissionId: submission.submissionId,
                  submissionStatus: submission.status,
                  submittedAt: submission.submittedAt,
                  endpoint: taxConfig.endpoint,
                },
              },
              { onConflict: 'org_id,jurisdiction,period' } as any,
            )
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'tax_filing_upsert_failed',
        );

        const followUp = buildFollowUp(
          payload,
          'tax.check_deadline',
          `Confirmer la date limite pour ${jurisdiction} (${period})`,
          { jurisdiction, period },
        );

        return {
          status: 'completed',
          output: {
            summary: `Préparation du dépôt fiscal ${jurisdiction} pour ${period}.`,
            submissionId: submission.submissionId,
            submissionStatus: submission.status,
            jurisdiction,
            period,
            taxGatewayEndpoint: taxConfig.endpoint,
          },
          notices: ['Vérifier les déductions sensibles avant la soumission finale.'],
          followUps: [followUp],
          telemetry: { filingsPrepared: 1 },
        };
      }
      case 'tax.respond_audit': {
        await taxClient.sendAuditResponse({
          jurisdiction,
          period,
          response: (payload.inputs?.response as string | undefined) ?? '',
          evidenceIds: Array.isArray(payload.inputs?.evidenceIds)
            ? (payload.inputs?.evidenceIds as string[])
            : undefined,
        });

        await requireMaybeSingle(
          (supabase
            .from('finance_tax_filings')
            .update({
              status: 'audit',
              metadata: {
                ...(payload.inputs ?? {}),
                responseSentAt: new Date().toISOString(),
              },
            })
            .eq('org_id', orgId)
            .eq('jurisdiction', jurisdiction)
            .eq('period', period)
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'tax_audit_update_failed',
        );

        if (!payload.inputs?.evidenceReady) {
          return connectorHitl(payload, [], 'audit_evidence_missing');
        }

        return {
          status: 'completed',
          output: {
            summary: 'Réponse à l’audit préparée avec pièces jointes.',
            jurisdiction,
            taxGatewayEndpoint: taxConfig.endpoint,
          },
          notices: ['Valider la lettre de réponse avec l’équipe juridique.'],
          telemetry: { auditsHandled: 1 },
        };
      }
      case 'tax.check_deadline': {
        const record = await requireMaybeSingle(
          supabase
            .from('finance_tax_filings')
            .select('due_date, status')
            .eq('org_id', orgId)
            .eq('jurisdiction', jurisdiction)
            .eq('period', period)
            .maybeSingle(),
          'tax_filing_lookup_failed',
        );

        let dueDate = record?.due_date ?? null;
        let status = record?.status ?? 'prepared';

        if (!dueDate) {
          const external = await taxClient.fetchDeadline(jurisdiction, period);
          dueDate = external.dueDate;
          status = external.status;
          await requireMaybeSingle(
            (supabase
              .from('finance_tax_filings')
              .upsert(
                {
                  org_id: orgId,
                  jurisdiction,
                  period,
                  status,
                  due_date: dueDate,
                },
                { onConflict: 'org_id,jurisdiction,period' } as any,
              )
              .select()
              .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
            'tax_deadline_upsert_failed',
          );
        }

        return {
          status: 'completed',
          output: {
            summary: `Deadline fiscale confirmée pour ${jurisdiction}.`,
            jurisdiction,
            period,
            dueDate,
            filingStatus: status,
            taxGatewayEndpoint: taxConfig.endpoint,
          },
        };
      }
      default:
        return connectorHitl(payload, [], `intent_not_supported:${payload.intent}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'tax_gateway_error';
    return connectorHitl(payload, ['tax_authority_gateway'], message);
  }
}

async function executeAccountsPayable({ envelope, supabase, logger }: WorkerExecuteContext): Promise<FinanceCommandResult> {
  const payload = envelope.command.payload;
  const missing = connectorsMissing(payload, ['payables_module']);
  if (missing.length > 0) {
    return connectorHitl(payload, missing);
  }

  const orgId = envelope.session.orgId;
  const connectorMap = await loadConnectorMap(supabase, orgId);
  const erpConnector = ensureConnectorActive(payload, connectorMap, 'payables_module', 'erp');
  if (!erpConnector) {
    return connectorHitl(payload, ['payables_module']);
  }
  const erpConfig = resolveConnectorConfig(erpConnector);
  if (!erpConfig) {
    return connectorHitl(payload, ['payables_module'], 'connector_config_missing');
  }
  const erpClient = new ErpPayablesClient(erpConfig, logger);

  try {
    switch (payload.intent) {
      case 'ap.process_invoice': {
        const amount = Number(payload.inputs?.amount ?? 0);
        const currency = (payload.inputs?.currency as string | undefined) ?? 'EUR';
        const vendor = (payload.inputs?.vendor as string | undefined) ?? 'Fournisseur';

        const invoice = await erpClient.createInvoice({
          vendor,
          invoiceNumber: (payload.inputs?.invoiceNumber as string | undefined) ?? null,
          amount,
          currency,
          metadata: payload.inputs ?? {},
        });

        await requireMaybeSingle(
          (supabase
            .from('finance_ap_invoices')
            .insert({
              org_id: orgId,
              vendor,
              invoice_number: invoice.invoiceId,
              amount,
              currency,
              status: invoice.status === 'approved' ? 'approved' : 'pending',
              approval_status: invoice.status === 'approved' ? 'approved' : 'pending',
              metadata: {
                ...(payload.inputs ?? {}),
                invoiceId: invoice.invoiceId,
                erpEndpoint: erpConfig.endpoint,
              },
            })
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'ap_invoice_insert_failed',
        );

        const notices: string[] = [];
        if (amount > 10000) {
          notices.push('Montant supérieur à 10k – vérifier la double approbation.');
        }

        return {
          status: 'completed',
          output: {
            summary: `Facture ${vendor} traitée (${amount.toFixed(2)} ${currency}).`,
            requiresDualApproval: amount > 10000,
            erpEndpoint: erpConfig.endpoint,
            invoiceId: invoice.invoiceId,
          },
          notices,
          telemetry: { invoicesProcessed: 1, amount },
        };
      }
      case 'ap.schedule_payment': {
        const invoiceId = (payload.inputs?.invoiceId as string | undefined) ?? null;
        const scheduledDate = normaliseDate(payload.inputs?.scheduledDate) ?? new Date().toISOString().slice(0, 10);

        if (!invoiceId) {
          return connectorHitl(payload, [], 'missing_invoice_id');
        }

        const schedule = await erpClient.schedulePayment({
          invoiceId,
          scheduledFor: scheduledDate,
          reference: (payload.inputs?.reference as string | undefined) ?? null,
        });

        await requireMaybeSingle(
          (supabase
            .from('finance_ap_invoices')
            .update({
              payment_scheduled_for: scheduledDate,
              status: schedule.status === 'scheduled' ? 'scheduled' : 'pending',
              metadata: {
                ...(payload.inputs ?? {}),
                scheduleId: schedule.scheduleId,
                erpEndpoint: erpConfig.endpoint,
              },
            })
            .eq('org_id', orgId)
            .eq('invoice_number', invoiceId)
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'ap_schedule_update_failed',
        );

        return {
          status: 'completed',
          output: {
            summary: `Paiement planifié pour le ${scheduledDate}.`,
            paymentReference: payload.inputs?.reference ?? null,
            erpEndpoint: erpConfig.endpoint,
          },
          notices: ['Vérifier le solde de trésorerie avant exécution.'],
          telemetry: { paymentsScheduled: 1 },
        };
      }
      default:
        return connectorHitl(payload, [], `intent_not_supported:${payload.intent}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erp_client_error';
    return connectorHitl(payload, ['payables_module'], message);
  }
}

async function executeRisk({ envelope, supabase, logger }: WorkerExecuteContext): Promise<FinanceCommandResult> {
  const payload = envelope.command.payload;
  const missing = connectorsMissing(payload, ['grc_platform']);
  if (missing.length > 0) {
    return connectorHitl(payload, missing);
  }

  const orgId = envelope.session.orgId;
  const connectorMap = await loadConnectorMap(supabase, orgId);
  const grcConnector = ensureConnectorActive(payload, connectorMap, 'grc_platform', 'compliance');
  if (!grcConnector) {
    return connectorHitl(payload, ['grc_platform']);
  }
  const grcConfig = resolveConnectorConfig(grcConnector);
  if (!grcConfig) {
    return connectorHitl(payload, ['grc_platform'], 'connector_config_missing');
  }
  const grcClient = new GrcClient(grcConfig, logger);

  try {
    switch (payload.intent) {
      case 'risk.update_register': {
        const riskId = (payload.inputs?.riskId as string | undefined) ?? 'RISK-NEW';
        const severity = (payload.inputs?.severity as string | undefined) ?? 'medium';
        const jurisdiction = (payload.inputs?.jurisdiction as string | undefined) ?? 'UNK';

        await grcClient.upsertRisk({
          jurisdiction,
          severity,
          note: (payload.inputs?.note as string | undefined) ?? undefined,
          metadata: payload.inputs ?? {},
        });

        await requireMaybeSingle(
          (supabase
            .from('risk_register')
            .insert({
              org_id: orgId,
              juris_code: jurisdiction,
              risk_flag: severity,
              note: (payload.inputs?.note as string | undefined) ?? null,
              period_from: normaliseDate(payload.inputs?.periodFrom),
              period_to: normaliseDate(payload.inputs?.periodTo),
            })
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'risk_register_insert_failed',
        );

        return {
          status: 'completed',
          output: {
            summary: `Registre mis à jour pour ${riskId} (sévérité ${severity}).`,
            riskId,
            severity,
            grcEndpoint: grcConfig.endpoint,
          },
          telemetry: { risksUpdated: 1 },
        };
      }
      case 'risk.assess_control': {
        const controlId = (payload.inputs?.controlId as string | undefined) ?? 'CTRL-1';
        const result = (payload.inputs?.testResult as string | undefined) ?? 'not_tested';

        await grcClient.logControlTest({
          controlId,
          result,
          metadata: payload.inputs ?? {},
        });

        await requireMaybeSingle(
          (supabase
            .from('finance_risk_control_tests')
            .insert({
              org_id: orgId,
              control_id: controlId,
              result,
              metadata: payload.inputs ?? {},
            })
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'risk_control_insert_failed',
        );

        if (result === 'failed') {
          return connectorHitl(payload, [], 'control_failed');
        }

        return {
          status: 'completed',
          output: {
            summary: `Contrôle ${controlId} testé avec succès.`,
            controlId,
            result,
            grcEndpoint: grcConfig.endpoint,
          },
          telemetry: { controlsTested: 1 },
        };
      }
      default:
        return connectorHitl(payload, [], `intent_not_supported:${payload.intent}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'grc_client_error';
    return connectorHitl(payload, ['grc_platform'], message);
  }
}

async function executeAudit({ envelope, supabase, logger }: WorkerExecuteContext): Promise<FinanceCommandResult> {
  const payload = envelope.command.payload;
  const missing = connectorsMissing(payload, ['grc_platform']);
  if (missing.length > 0) {
    return connectorHitl(payload, missing);
  }

  const orgId = envelope.session.orgId;
  const connectorMap = await loadConnectorMap(supabase, orgId);
  const grcConnector = ensureConnectorActive(payload, connectorMap, 'grc_platform', 'compliance');
  if (!grcConnector) {
    return connectorHitl(payload, ['grc_platform']);
  }
  const grcConfig = resolveConnectorConfig(grcConnector);
  if (!grcConfig) {
    return connectorHitl(payload, ['grc_platform'], 'connector_config_missing');
  }
  const grcClient = new GrcClient(grcConfig, logger);

  try {
    switch (payload.intent) {
      case 'audit.prepare_walkthrough': {
        const processName = (payload.inputs?.process as string | undefined) ?? 'Processus';
        const response = await grcClient.createWalkthrough({
          processName,
          summary: (payload.inputs?.summary as string | undefined) ?? undefined,
          metadata: payload.inputs ?? {},
        });

        await requireMaybeSingle(
          (supabase
            .from('finance_audit_walkthroughs')
            .insert({
              org_id: orgId,
              process_name: processName,
              status: 'ready',
              metadata: {
                ...(payload.inputs ?? {}),
                walkthroughId: response.id,
                grcEndpoint: grcConfig.endpoint,
              },
            })
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'audit_walkthrough_insert_failed',
        );

        return {
          status: 'completed',
          output: {
            summary: `Walkthrough prêt pour ${processName}.`,
            process: processName,
            grcEndpoint: grcConfig.endpoint,
          },
          notices: ['Planifier une session HITL si le client doit valider les étapes.'],
          telemetry: { walkthroughsPrepared: 1 },
        };
      }
      case 'audit.update_pbc': {
        const item = (payload.inputs?.item as string | undefined) ?? 'PBC Item';
        await grcClient.updatePbc({
          processName: item,
          metadata: payload.inputs ?? {},
        });

        await requireMaybeSingle(
          (supabase
            .from('finance_audit_walkthroughs')
            .insert({
              org_id: orgId,
              process_name: item,
              status: 'review',
              metadata: {
                ...(payload.inputs ?? {}),
                pbcUpdatedAt: new Date().toISOString(),
                grcEndpoint: grcConfig.endpoint,
              },
            })
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'audit_pbc_insert_failed',
        );

        return {
          status: 'completed',
          output: {
            summary: `Demande PBC mise à jour: ${item}.`,
            item,
            grcEndpoint: grcConfig.endpoint,
          },
        };
      }
      default:
        return connectorHitl(payload, [], `intent_not_supported:${payload.intent}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'grc_client_error';
    return connectorHitl(payload, ['grc_platform'], message);
  }
}

async function executeCfo({ envelope, supabase, logger }: WorkerExecuteContext): Promise<FinanceCommandResult> {
  const payload = envelope.command.payload;
  const missing = connectorsMissing(payload, ['bi_warehouse']);
  if (missing.length > 0) {
    return connectorHitl(payload, missing);
  }

  const orgId = envelope.session.orgId;
  const connectorMap = await loadConnectorMap(supabase, orgId);
  const analyticsConnector = ensureConnectorActive(payload, connectorMap, 'bi_warehouse', 'analytics');
  if (!analyticsConnector) {
    return connectorHitl(payload, ['bi_warehouse']);
  }
  const analyticsConfig = resolveConnectorConfig(analyticsConnector);
  if (!analyticsConfig) {
    return connectorHitl(payload, ['bi_warehouse'], 'connector_config_missing');
  }
  const analyticsClient = new AnalyticsClient(analyticsConfig, logger);

  try {
    switch (payload.intent) {
      case 'cfo.generate_board_pack': {
        const period = (payload.inputs?.period as string | undefined) ?? 'Dernier mois';
        const metricsInput = (payload.inputs?.metrics as Record<string, unknown> | undefined) ?? {};
        const response = await analyticsClient.generateBoardPack({
          period,
          metrics: metricsInput,
          summary: (payload.inputs?.summary as string | undefined) ?? undefined,
        });

        await requireMaybeSingle(
          (supabase
            .from('finance_board_packs')
            .upsert(
              {
                org_id: orgId,
                period,
                status: response.status === 'ready' ? 'ready' : 'draft',
                metrics: response.metrics ?? metricsInput,
                summary: (payload.inputs?.summary as string | undefined) ?? null,
              },
              { onConflict: 'org_id,period' } as any,
            )
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'board_pack_upsert_failed',
        );

        return {
          status: 'completed',
          output: {
            summary: `Pack board généré pour ${period}.`,
            keyMetrics: Object.keys(response.metrics ?? metricsInput),
            analyticsEndpoint: analyticsConfig.endpoint,
          },
          telemetry: { boardPacks: 1 },
        };
      }
      case 'cfo.run_scenario': {
        const scenario = (payload.inputs?.scenario as string | undefined) ?? 'baseline';
        const assumptions = (payload.inputs?.assumptions as Record<string, unknown> | undefined) ?? {};
        const response = await analyticsClient.runScenario({
          scenario,
          assumptions,
          period: (payload.inputs?.period as string | undefined) ?? undefined,
        });

        await requireMaybeSingle(
          (supabase
            .from('finance_board_packs')
            .upsert(
              {
                org_id: orgId,
                period: (payload.inputs?.period as string | undefined) ?? 'courant',
                status: 'draft',
                metrics: response.outputs ?? assumptions,
                summary: `Scénario ${scenario}`,
              },
              { onConflict: 'org_id,period' } as any,
            )
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'board_scenario_upsert_failed',
        );

        return {
          status: 'completed',
          output: {
            summary: `Scénario ${scenario} exécuté.`,
            assumptions,
            analyticsEndpoint: analyticsConfig.endpoint,
            scenarioId: response.scenarioId,
          },
          notices: ['Valider les hypothèses sensibles avec le CFO.'],
        };
      }
      default:
        return connectorHitl(payload, [], `intent_not_supported:${payload.intent}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'analytics_client_error';
    return connectorHitl(payload, ['bi_warehouse'], message);
  }
}

async function executeRegulatory({ envelope, supabase, logger }: WorkerExecuteContext): Promise<FinanceCommandResult> {
  const payload = envelope.command.payload;
  const missing = connectorsMissing(payload, ['regulatory_portal']);
  if (missing.length > 0) {
    return connectorHitl(payload, missing);
  }

  const orgId = envelope.session.orgId;
  const connectorMap = await loadConnectorMap(supabase, orgId);
  const regulatoryConnector = ensureConnectorActive(payload, connectorMap, 'regulatory_portal', 'tax');
  if (!regulatoryConnector) {
    return connectorHitl(payload, ['regulatory_portal']);
  }
  const regulatoryConfig = resolveConnectorConfig(regulatoryConnector);
  if (!regulatoryConfig) {
    return connectorHitl(payload, ['regulatory_portal'], 'connector_config_missing');
  }
  const regulatoryClient = new RegulatoryClient(regulatoryConfig, logger);

  const jurisdiction = (payload.inputs?.jurisdiction as string | undefined) ?? 'Inconnue';
  const filingType = (payload.inputs?.filing as string | undefined) ?? 'Déclaration';
  const dueDate = normaliseDate(payload.inputs?.dueDate);

  try {
    switch (payload.intent) {
      case 'regulatory.prepare_filing': {
        const submission = await regulatoryClient.submitFiling({
          jurisdiction,
          filingType,
          dueDate,
          metadata: payload.inputs ?? {},
        });

        await requireMaybeSingle(
          (supabase
            .from('finance_regulatory_filings')
            .upsert(
              {
                org_id: orgId,
                jurisdiction,
                filing_type: filingType,
                status: submission.status,
                due_date: dueDate,
                metadata: {
                  ...(payload.inputs ?? {}),
                  submissionId: submission.submissionId,
                  regulatoryEndpoint: regulatoryConfig.endpoint,
                },
              },
              { onConflict: 'org_id,jurisdiction,filing_type' } as any,
            )
            .select()
            .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
          'regulatory_filing_upsert_failed',
        );

        return {
          status: 'completed',
          output: {
            summary: `Dossier réglementaire préparé (${filingType}).`,
            filing: filingType,
            dueDate,
            submissionId: submission.submissionId,
            regulatoryEndpoint: regulatoryConfig.endpoint,
          },
          notices: ['Confirmer l’attestation manuelle avant soumission.'],
          telemetry: { filingsPrepared: 1 },
        };
      }
      case 'regulatory.track_deadline': {
        const record = await requireMaybeSingle(
          supabase
            .from('finance_regulatory_filings')
            .select('due_date, status')
            .eq('org_id', orgId)
            .eq('jurisdiction', jurisdiction)
            .eq('filing_type', filingType)
            .maybeSingle(),
          'regulatory_filing_lookup_failed',
        );

        let dueDateValue = record?.due_date ?? dueDate;
        let statusValue = record?.status ?? 'planned';

        if (!dueDateValue) {
          const status = await regulatoryClient.fetchStatus(jurisdiction, filingType);
          dueDateValue = status.dueDate;
          statusValue = status.status;
          await requireMaybeSingle(
            (supabase
              .from('finance_regulatory_filings')
              .upsert(
                {
                  org_id: orgId,
                  jurisdiction,
                  filing_type: filingType,
                  status: statusValue,
                  due_date: dueDateValue,
                },
                { onConflict: 'org_id,jurisdiction,filing_type' } as any,
              )
              .select()
              .maybeSingle()) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
            'regulatory_filing_status_upsert_failed',
          );
        }

        return {
          status: 'completed',
          output: {
            summary: `Deadline réglementaire suivie (${dueDateValue ?? 'N/A'}).`,
            filing: filingType,
            status: statusValue,
            regulatoryEndpoint: regulatoryConfig.endpoint,
          },
        };
      }
      default:
        return connectorHitl(payload, [], `intent_not_supported:${payload.intent}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'regulatory_client_error';
    return connectorHitl(payload, ['regulatory_portal'], message);
  }
}

function ensureConnectorActive(
  payload: FinanceCommandPayload,
  map: Map<string, ConnectorRecord>,
  name: string,
  expectedType: string,
): ConnectorRecord | null {
  const payloadStatus = payload.connectors?.[name]?.status;
  if (payloadStatus && payloadStatus !== 'active') {
    return null;
  }

  const record = map.get(name);
  if (!record) {
    return null;
  }

  if (record.status && record.status !== 'active') {
    return null;
  }

  if (expectedType && record.connector_type && record.connector_type !== expectedType) {
    return null;
  }

  return record;
}

const domainWorkers: DomainWorker[] = [
  { domain: 'tax_compliance', execute: executeTax },
  { domain: 'accounts_payable', execute: executeAccountsPayable },
  { domain: 'risk_controls', execute: executeRisk },
  { domain: 'audit_assurance', execute: executeAudit },
  { domain: 'cfo_strategy', execute: executeCfo },
  { domain: 'regulatory_filings', execute: executeRegulatory },
];

export function registerFinanceWorkers(registry = workerRegistry): void {
  for (const worker of domainWorkers) {
    registry.register(worker);
  }
}

registerFinanceWorkers();
