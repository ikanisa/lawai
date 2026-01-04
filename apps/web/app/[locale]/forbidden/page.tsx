export default function ForbiddenPage() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
            <h1 className="mb-2 text-2xl font-bold">403 - Accès Interdit</h1>
            <p className="mb-4 text-gray-600">Vous n&apos;avez pas la permission d&apos;accéder à cette page.</p>
            <a href="/" className="text-blue-600 hover:underline">
                Retour à l&apos;accueil
            </a>
        </div>
    );
}
