'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/staff/chat-interface';

interface ChatSession {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    messages: number;
  };
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      loadSessions();
      
      // Check for case parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const caseId = urlParams.get('case');
      const sessionId = urlParams.get('session');
      
      if (caseId && !activeSession) {
        // Create new session linked to case
        createSessionForCase(caseId);
      } else if (sessionId) {
        setActiveSession(sessionId);
      }
    }
  }, [session]);

  const createSessionForCase = async (caseId: string) => {
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Case Chat', caseId }),
      });

      if (response.ok) {
        const newSession = await response.json();
        setSessions((prev) => [newSession, ...prev]);
        setActiveSession(newSession.id);
      }
    } catch (error) {
      console.error('Failed to create session for case:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/chat/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
        if (data.length > 0 && !activeSession) {
          setActiveSession(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });

      if (response.ok) {
        const newSession = await response.json();
        setSessions((prev) => [newSession, ...prev]);
        setActiveSession(newSession.id);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSession === sessionId) {
          const remaining = sessions.filter((s) => s.id !== sessionId);
          setActiveSession(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-neutral-50 p-4 flex flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Chat Sessions</h2>
          <button
            onClick={createNewSession}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-4"
          >
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`p-3 rounded-lg cursor-pointer border ${
                activeSession === session.id
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => setActiveSession(session.id)}
            >
              <p className="font-medium text-sm truncate">
                {session.title || 'Untitled Chat'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {session._count.messages} messages
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                className="text-xs text-red-600 hover:text-red-800 mt-2"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600 mb-2">{session.user?.email}</p>
          <button
            onClick={() => signOut()}
            className="w-full px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        {activeSession ? (
          <ChatInterface sessionId={activeSession} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 mb-4">No chat selected</p>
              <button
                onClick={createNewSession}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
