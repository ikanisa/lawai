export default function BenchPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Bench Memo Agent</h1>
        <p className="mt-2 text-sm text-white/70">
          Préparez des synthèses à destination des magistrats avec priorisation des sources.
        </p>
      </header>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/60">
          Les étapes du memo et les comparaisons de jurisprudence seront affichées ici.
        </p>
      </div>
    </div>
  );
}
