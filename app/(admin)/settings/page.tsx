'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SystemSetting {
  key: string;
  value: any;
  description: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user.role !== 'ADMIN') {
      router.push('/chat');
    } else {
      loadSettings();
    }
  }, [session, router]);

  const loadSettings = async () => {
    // TODO: Implement settings API endpoint
    setSettings([
      {
        key: 'ai_model',
        value: { model: 'gpt-4-turbo-preview' },
        description: 'Default AI model for legal queries',
      },
      {
        key: 'max_tokens',
        value: { maxTokens: 2000 },
        description: 'Maximum tokens for AI responses',
      },
    ]);
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
        <h1 className="text-xl font-bold mb-6">LawAI Admin</h1>
        
        <nav className="flex-1 space-y-2">
          <Link
            href="/dashboard"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Dashboard
          </Link>
          <Link
            href="/users"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Users
          </Link>
          <Link
            href="/logs"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Audit Logs
          </Link>
          <Link
            href="/settings"
            className="block px-4 py-2 bg-blue-100 text-blue-700 rounded-lg"
          >
            Settings
          </Link>
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <h2 className="text-3xl font-bold mb-8">System Settings</h2>

        <div className="space-y-6">
          {settings.map((setting) => (
            <div key={setting.key} className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">{setting.key}</h3>
              {setting.description && (
                <p className="text-sm text-gray-500 mb-4">{setting.description}</p>
              )}
              <div className="bg-gray-50 p-4 rounded">
                <pre className="text-sm">
                  {JSON.stringify(setting.value, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
