import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.MOCK_API_PORT ?? 4010);
const HOST = '127.0.0.1';

const workspacePayload = {
  jurisdictions: [
    { code: 'FR', name: 'France', eu: true, ohada: false, matterCount: 4 },
    { code: 'OH', name: 'OHADA', eu: false, ohada: true, matterCount: 2 },
  ],
  matters: [
    {
      id: 'matter-demo',
      question: 'FRIA onboarding review',
      status: 'in_progress',
      riskLevel: 'LOW',
      hitlRequired: false,
      startedAt: '2024-09-01T09:15:00Z',
      finishedAt: null,
      jurisdiction: 'FR',
    },
  ],
  complianceWatch: [],
  hitlInbox: { items: [], pendingCount: 0 },
  desk: {
    playbooks: [
      {
        id: 'demo-playbook',
        title: 'FR case intake triage',
        persona: 'Associate',
        jurisdiction: 'FR',
        mode: 'ask',
        summary: 'Capture claimant summary, CEPEJ consent and OHADA overrides.',
        regulatoryFocus: ['CEPEJ consent', 'FRIA attestations'],
        steps: [
          { id: 'triage', name: 'Initial triage', description: 'Confirm scope and urgency.', status: 'success', attempts: 1 },
          { id: 'consent', name: 'Consent capture', description: 'Collect CEPEJ consent and audit trail.', status: 'success', attempts: 1 },
        ],
        cta: { label: 'Launch research', mode: 'ask', question: 'Summarise CEPEJ compliance risk' },
      },
    ],
    quickActions: [
      {
        id: 'qa-hitl',
        label: 'Review HITL queue',
        description: 'Open escalations pending reviewer sign-off.',
        mode: 'review',
        action: 'hitl',
        href: '/hitl',
      },
    ],
    personas: [
      {
        id: 'persona-hitl',
        label: 'HITL reviewer',
        description: 'Queue of escalated FR dossiers.',
        mode: 'review',
        focusAreas: ['High-risk FRIA findings'],
        guardrails: ['Document approvals'],
        href: '/hitl',
        agentCode: 'FR-HITL',
      },
    ],
    toolChips: [
      {
        id: 'tool-consent',
        label: 'Consent reconciliation',
        mode: 'do',
        status: 'ready',
        description: 'Sync CEPEJ consent with intake queue.',
        action: 'trust',
        href: '/trust',
        ctaLabel: 'Review consent log',
      },
    ],
  },
  navigator: [
    {
      id: 'fria-intake',
      title: 'FR civil case intake',
      jurisdiction: 'France',
      persona: 'Associate',
      mode: 'ask',
      summary: 'FRIA intake with CEPEJ consent capture and OHADA override checks.',
      estimatedMinutes: 30,
      lastRunAt: '2024-09-15T10:00:00Z',
      alerts: [],
      telemetry: { runCount: 12, hitlEscalations: 1, pendingTasks: 0 },
      steps: [
        {
          id: 'capture',
          label: 'Capture claimant brief',
          description: 'Collect FR civil facts & attachments.',
          state: 'complete',
          guardrails: ['Consent recorded'],
          outputs: ['Intake dossier'],
        },
        {
          id: 'consent',
          label: 'CEPEJ consent review',
          description: 'Verify CEPEJ consent signatures.',
          state: 'in_progress',
          guardrails: ['CEPEJ consent'],
          outputs: ['Consent certificate'],
        },
      ],
    },
  ],
};

const complianceStatusPayload = {
  orgId: '00000000-0000-0000-0000-000000000000',
  userId: '00000000-0000-0000-0000-000000000000',
  acknowledgements: {
    consent: {
      requiredVersion: '2024.09',
      acknowledgedVersion: '2024.09',
      acknowledgedAt: new Date().toISOString(),
      satisfied: true,
    },
    councilOfEurope: {
      requiredVersion: '2024.09',
      acknowledgedVersion: '2024.09',
      acknowledgedAt: new Date().toISOString(),
      satisfied: true,
    },
  },
  latest: null,
  history: [],
  totals: { total: 0, friaRequired: 0, cepejViolations: 0, statuteViolations: 0, disclosureGaps: 0 },
};

const agentRunResponse = {
  runId: 'mock-run',
  data: {
    jurisdiction: { country: 'FR', code: 'FR' },
    risk: {
      level: 'LOW',
      hitl_required: false,
      reason: 'Mock run',
      verification: { status: 'passed', notes: [], allowlistViolations: [] },
    },
    issue: 'Mock issue statement',
    rules: [],
    application: [],
    conclusion: 'Mock conclusion',
  },
  plan: [],
  notices: [],
  reused: false,
};

function handleOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-user-id,x-org-id',
  });
  res.end();
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(404);
    res.end();
    return;
  }

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const sendJson = (status, payload) => {
    res.writeHead(status, headers);
    res.end(JSON.stringify(payload));
  };

  if (req.method === 'GET' && url.pathname === '/workspace') {
    sendJson(200, workspacePayload);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/compliance/status') {
    sendJson(200, complianceStatusPayload);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/compliance/acknowledgements') {
    sendJson(200, complianceStatusPayload);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/auth/whatsapp/start') {
    sendJson(200, { verificationId: 'mock-verification', expiresAt: new Date(Date.now() + 300_000).toISOString() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/auth/whatsapp/verify') {
    sendJson(200, { session_token: 'mock-session-token', wa_id: 'whatsapp:+33123456789' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/auth/whatsapp/link') {
    sendJson(200, { wa_id: 'whatsapp:+33123456789' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/auth/whatsapp/unlink') {
    sendJson(200, { success: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/runs') {
    sendJson(200, agentRunResponse);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/telemetry') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  res.writeHead(404, headers);
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock API listening on http://${HOST}:${PORT}`);
});
