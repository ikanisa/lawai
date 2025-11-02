'use client';

export function Hero() {
  return (
    <section className="card" aria-labelledby="executive-briefing">
      <div className="badge" id="executive-briefing">
        Executive briefing
      </div>
      <h1 style={{ margin: '0.5rem 0 0.75rem', fontSize: '2.1rem' }}>
        Governance and operations pulse — 12 October
      </h1>
      <p>
        Track compliance health, release velocity, and production resilience in one glance. All charts, incidents, and
        audit tasks are cached for offline review.
      </p>
    </section>
  );
}
