interface VersionPoint {
  label: string;
  date: string;
  isCurrent?: boolean;
}

export function VersionTimeline({ points }: { points: VersionPoint[] }) {
  return (
    <ol className="relative space-y-4 border-l border-slate-700/60 pl-4">
      {points.map((point, index) => (
        <li key={`${point.label}-${index}`} className="relative">
          <span
            className={`absolute -left-[9px] mt-1 h-3 w-3 rounded-full border ${
              point.isCurrent
                ? 'border-teal-300 bg-teal-300 shadow-[0_0_0_4px_rgba(45,212,191,0.2)]'
                : 'border-slate-500 bg-slate-800'
            }`}
            aria-hidden
          />
          <div className="ml-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{point.label}</p>
            <p className="text-xs text-slate-400">{point.date}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
