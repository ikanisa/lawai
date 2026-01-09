'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DocumentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      loadDocuments();
    }
  }, [session, router]);

  const loadDocuments = async () => {
    // TODO: Implement documents API endpoint
    setDocuments([]);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-neutral-50 p-4 flex flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Navigation</h2>
          <Link
            href="/chat"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg mb-2"
          >
            Chat
          </Link>
          <Link
            href="/documents"
            className="block px-4 py-2 bg-blue-100 text-blue-700 rounded-lg mb-2"
          >
            Documents
          </Link>
          <Link
            href="/history"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            History
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Documents</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Upload Document
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="bg-white border rounded-lg p-12 text-center">
            <p className="text-gray-500 mb-4">No documents uploaded yet</p>
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Upload Your First Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-2">{doc.filename}</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(2)} KB` : 'Unknown size'}
                </p>
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                    View
                  </button>
                  <button className="flex-1 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
