import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function StaffDashboard() {
    return (
        <div className="mx-auto max-w-4xl">
            <h2 className="mb-6 text-2xl font-bold">Tableau de bord Staff</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* HITL Queue Card */}
                <Link
                    href="/staff/queue"
                    className="flex flex-col rounded-lg border bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                    <h3 className="mb-2 text-lg font-semibold text-blue-600">Queue de révision HITL</h3>
                    <p className="text-gray-500">Examiner et valider les plans juridiques générés par l&apos;IA.</p>
                </Link>

                {/* Analytics/Reports placeholder */}
                <div className="flex flex-col rounded-lg border bg-white p-6 shadow-sm opacity-60">
                    <h3 className="mb-2 text-lg font-semibold text-gray-400">Rapports (Bientôt)</h3>
                    <p className="text-gray-500">Analyses et statistiques système.</p>
                </div>
            </div>
        </div>
    );
}
