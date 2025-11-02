export const metadata = {
  title: 'Offline mode | Avocat AI field staff',
};

export default function OfflinePage() {
  return (
    <section className="card" aria-labelledby="offline-heading">
      <h1 id="offline-heading">You are offline</h1>
      <p>
        Continue working with cached rosters, legal scripts, and logistics checklists. Connectivity checks run in the
        background and sync when the network returns.
      </p>
      <ul style={{ margin: '1rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.6 }}>
        <li>Use the staff dashboard for up-to-date assignments.</li>
        <li>Emergency contact trees remain available via the equipment menu.</li>
        <li>Document uploads queue locally and will resume automatically.</li>
      </ul>
    </section>
  );
}
