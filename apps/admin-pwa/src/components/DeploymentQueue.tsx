'use client';

import { useQuery } from '@tanstack/react-query';
import { deploymentsQueryOptions } from '@/lib/api';

const statusColor: Record<'queued' | 'running' | 'complete', string> = {
  queued: 'rgba(59, 130, 246, 0.2)',
  running: 'rgba(251, 191, 36, 0.2)',
  complete: 'rgba(34, 197, 94, 0.2)',
};

export function DeploymentQueue() {
  const { data } = useQuery(deploymentsQueryOptions());
  const deployments = data ?? [];

  return (
    <section className="card" aria-labelledby="deployment-queue-heading">
      <h2 id="deployment-queue-heading">Deployment queue</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
        <thead style={{ textAlign: 'left', color: '#cbd5f5', fontSize: '0.85rem' }}>
          <tr>
            <th scope="col" style={{ paddingBottom: '0.5rem' }}>
              Service
            </th>
            <th scope="col" style={{ paddingBottom: '0.5rem' }}>
              Version
            </th>
            <th scope="col" style={{ paddingBottom: '0.5rem' }}>
              Queued
            </th>
            <th scope="col" style={{ paddingBottom: '0.5rem' }}>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((deployment) => (
            <tr key={deployment.id} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
              <td style={{ padding: '0.6rem 0' }}>{deployment.service}</td>
              <td>{deployment.version}</td>
              <td>{new Date(deployment.queuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
              <td>
                <span className="badge" style={{ background: statusColor[deployment.status], color: '#020617' }}>
                  {deployment.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
