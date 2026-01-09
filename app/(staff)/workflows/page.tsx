'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function WorkflowsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      loadWorkflows();
    }
  }, [session, router]);

  const loadWorkflows = async () => {
    try {
      const response = await fetch('/api/workflows');
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data);
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (workflow: any) => {
    loadWorkflows();
    setShowBuilder(false);
    setSelectedWorkflow(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <WorkflowBuilder
        workflowId={selectedWorkflow || undefined}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
            <Button onClick={() => setShowBuilder(true)}>Create Workflow</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{workflow.name}</h3>
                    {workflow.workflowType && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {workflow.workflowType}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      workflow.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {workflow.status}
                  </span>
                </div>

                {workflow.description && (
                  <p className="text-sm text-gray-600 mb-4">{workflow.description}</p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{workflow._count?.executions || 0} executions</span>
                  <span>{Array.isArray(workflow.steps) ? workflow.steps.length : 0} steps</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedWorkflow(workflow.id);
                      setShowBuilder(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      // Execute workflow
                      const response = await fetch(`/api/workflows/${workflow.id}/execute`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ inputData: {} }),
                      });
                      if (response.ok) {
                        alert('Workflow execution started!');
                      }
                    }}
                  >
                    Run
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {workflows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No workflows yet</p>
              <Button onClick={() => setShowBuilder(true)}>Create Your First Workflow</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
