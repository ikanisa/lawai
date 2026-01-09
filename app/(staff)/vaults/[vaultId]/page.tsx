'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function VaultPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const vaultId = params.vaultId as string;

  const [vault, setVault] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      loadVault();
      loadDocuments();
    }
  }, [session, router, vaultId]);

  const loadVault = async () => {
    try {
      const response = await fetch(`/api/vaults?matterId=${vaultId}`);
      if (response.ok) {
        const data = await response.json();
        const vaultData = data.find((v: any) => v.id === vaultId);
        setVault(vaultData);
      }
    } catch (error) {
      console.error('Failed to load vault:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      // In a real implementation, this would fetch documents for the vault
      // For now, we'll use a placeholder
      setDocuments([]);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    formData.append('preserveStructure', 'true');

    try {
      const response = await fetch(`/api/vaults/${vaultId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Uploaded ${result.uploaded} documents successfully!`);
        loadDocuments();
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload documents');
    }
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/vaults/${vaultId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 20 }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{vault?.name || 'Vault'}</h1>
            {vault?.description && (
              <p className="text-gray-600 mt-1">{vault.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>Upload Documents</span>
              </Button>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && performSearch()}
            placeholder="Search documents semantically..."
            className="flex-1 border rounded px-4 py-2"
          />
          <Button onClick={performSearch} disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {searchResults.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Search Results</h2>
            {searchResults.map((result, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium">{result.document.title}</h3>
                    <p className="text-sm text-gray-500">{result.document.filename}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {(result.similarity * 100).toFixed(1)}% match
                  </span>
                </div>
                {result.snippet && (
                  <p className="text-sm text-gray-600 mt-2">{result.snippet}</p>
                )}
                {result.document.summary && (
                  <p className="text-xs text-gray-500 mt-2">{result.document.summary}</p>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-4">Documents</h2>
            {documents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => (
                  <Card key={doc.id} className="p-4">
                    <h3 className="font-medium mb-2">{doc.title}</h3>
                    <p className="text-sm text-gray-500 mb-2">{doc.filename}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{doc.extractionStatus}</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No documents yet</p>
                <label className="cursor-pointer">
                  <Button>Upload Documents</Button>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
