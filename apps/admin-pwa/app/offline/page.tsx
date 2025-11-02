export const metadata = {
  title: 'Offline mode | Avocat AI admin hub',
};

export default function OfflinePage() {
  return (
    <section className="card" aria-labelledby="offline-heading">
      <h1 id="offline-heading">You are offline</h1>
      <p>
        Governance dashboards remain available with cached data. Continue reviewing incidents and audit trails; changes
        sync automatically once connectivity is restored.
      </p>
      <ul style={{ margin: '1rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.6 }}>
        <li>Deployment approvals queue locally and preserve your reviewer signature.</li>
        <li>Compliance evidence uploads resume when your connection stabilises.</li>
        <li>Use keyboard shortcuts (press "/" for global search) even without a network.</li>
      </ul>
    </section>
  );
}
