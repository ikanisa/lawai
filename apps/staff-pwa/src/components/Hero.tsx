'use client';

export function Hero() {
  return (
    <section className="card" aria-labelledby="today-briefing">
      <div className="badge" id="today-briefing">
        Field briefing
      </div>
      <h1 style={{ margin: '0.5rem 0 0.75rem', fontSize: '2rem' }}>
        Rapid response coverage for Saturday, 12 October
      </h1>
      <p>
        Review your assigned shifts, check equipment readiness, and confirm contact trees before leaving Wi-Fi.
        Offline maps, emergency scripts, and site checklists are cached locally.
      </p>
    </section>
  );
}
