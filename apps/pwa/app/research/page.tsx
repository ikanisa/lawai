import { ResearchView } from "@/components/research/ResearchView";

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Bureau de recherche</h1>
        <p className="text-sm text-white/70">
          Pilotage agent-first des investigations juridiques : outillage OHADA/EU automatique, flux IRAC en streaming et preuves
          consolidées.
        </p>
      </header>
      <ResearchView />
    </div>
  );
}
