'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Custom node types
const PromptNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-blue-500 min-w-[200px]">
    <div className="font-bold text-sm text-blue-700">{data.label || 'AI Prompt'}</div>
    <div className="text-xs text-gray-500 mt-1">
      Model: {data.config?.model || 'claude-sonnet-4'}
    </div>
    {data.config?.prompt && (
      <div className="text-xs text-gray-600 mt-2 truncate">
        {data.config.prompt.substring(0, 50)}...
      </div>
    )}
  </div>
);

const AnalysisNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-green-500 min-w-[200px]">
    <div className="font-bold text-sm text-green-700">{data.label || 'Document Analysis'}</div>
    <div className="text-xs text-gray-500 mt-1">Analyze documents</div>
  </div>
);

const HumanReviewNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-yellow-500 min-w-[200px]">
    <div className="font-bold text-sm text-yellow-700">{data.label || 'Human Review'}</div>
    <div className="text-xs text-gray-500 mt-1">Requires approval</div>
  </div>
);

const GenerateNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-purple-500 min-w-[200px]">
    <div className="font-bold text-sm text-purple-700">{data.label || 'Generate Document'}</div>
    <div className="text-xs text-gray-500 mt-1">Create from template</div>
  </div>
);

const ConditionalNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-orange-500 min-w-[200px]">
    <div className="font-bold text-sm text-orange-700">{data.label || 'Conditional'}</div>
    <div className="text-xs text-gray-500 mt-1">If/then logic</div>
  </div>
);

const nodeTypes = {
  prompt: PromptNode,
  analysis: AnalysisNode,
  human_review: HumanReviewNode,
  generate: GenerateNode,
  conditional: ConditionalNode,
};

interface WorkflowBuilderProps {
  workflowId?: string;
  onSave?: (workflow: any) => void;
}

export default function WorkflowBuilder({ workflowId, onSave }: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowType, setWorkflowType] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing workflow if workflowId provided
  useEffect(() => {
    if (workflowId) {
      loadWorkflow(workflowId);
    }
  }, [workflowId]);

  const loadWorkflow = async (id: string) => {
    try {
      const response = await fetch(`/api/workflows/${id}`);
      if (response.ok) {
        const workflow = await response.json();
        setWorkflowName(workflow.name);
        setWorkflowDescription(workflow.description || '');
        setWorkflowType(workflow.workflowType || '');

        // Convert workflow steps to nodes
        if (workflow.steps && Array.isArray(workflow.steps)) {
          const workflowNodes: Node[] = workflow.steps.map((step: any, index: number) => ({
            id: step.id || `step_${index}`,
            type: step.type || 'prompt',
            position: step.position || { x: 250 + index * 250, y: 250 },
            data: {
              label: step.name || step.type,
              config: step.config || {},
            },
          }));
          setNodes(workflowNodes);
        }
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type,
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: {
        label: `${type.replace('_', ' ')} Node`,
        config: {},
      },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  const updateNodeConfig = (nodeId: string, config: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, config: { ...node.data.config, ...config } } }
          : node
      )
    );
  };

  const saveWorkflow = async () => {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    setIsSaving(true);
    try {
      const workflow = {
        name: workflowName,
        description: workflowDescription,
        workflowType,
        steps: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          name: node.data.label,
          position: node.position,
          config: node.data.config,
        })),
        connections: edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
        })),
      };

      const url = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows';
      const method = workflowId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow),
      });

      if (response.ok) {
        const saved = await response.json();
        if (onSave) {
          onSave(saved);
        }
        alert('Workflow saved successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to save workflow: ${error.error}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4 flex items-center justify-between shadow-sm">
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Workflow Name"
            className="text-2xl font-bold border-none focus:ring-0 w-full bg-transparent"
          />
          <div className="flex gap-4">
            <input
              type="text"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              placeholder="Description (optional)"
              className="text-sm text-gray-600 border-none focus:ring-0 flex-1 bg-transparent"
            />
            <select
              value={workflowType}
              onChange={(e) => setWorkflowType(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="">Select type...</option>
              <option value="contract_review">Contract Review</option>
              <option value="due_diligence">Due Diligence</option>
              <option value="discovery">Discovery</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
        <Button onClick={saveWorkflow} disabled={isSaving} className="ml-4">
          {isSaving ? 'Saving...' : 'Save Workflow'}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Workflow Blocks */}
        <div className="w-64 bg-white border-r p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4 text-gray-700">Workflow Blocks</h3>
          <div className="space-y-2">
            <button
              onClick={() => addNode('prompt')}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-sm">AI Prompt</div>
              <div className="text-xs text-gray-500">Send prompt to AI</div>
            </button>
            <button
              onClick={() => addNode('analysis')}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-sm">Document Analysis</div>
              <div className="text-xs text-gray-500">Analyze documents</div>
            </button>
            <button
              onClick={() => addNode('human_review')}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-sm">Human Review</div>
              <div className="text-xs text-gray-500">Require approval</div>
            </button>
            <button
              onClick={() => addNode('generate')}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-sm">Generate Document</div>
              <div className="text-xs text-gray-500">Create from template</div>
            </button>
            <button
              onClick={() => addNode('conditional')}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-sm">Conditional</div>
              <div className="text-xs text-gray-500">If/then logic</div>
            </button>
          </div>

          {/* Node Configuration Panel */}
          {selectedNode && (
            <Card className="mt-6 p-4">
              <h4 className="font-semibold mb-3 text-sm">Configure Node</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600">Label</label>
                  <input
                    type="text"
                    value={selectedNode.data.label}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, label: e.target.value },
                      })
                    }
                    className="w-full text-sm border rounded px-2 py-1 mt-1"
                  />
                </div>
                {selectedNode.type === 'prompt' && (
                  <div>
                    <label className="text-xs text-gray-600">Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ''}
                      onChange={(e) =>
                        updateNodeConfig(selectedNode.id, { prompt: e.target.value })
                      }
                      className="w-full text-sm border rounded px-2 py-1 mt-1"
                      rows={3}
                    />
                  </div>
                )}
                <button
                  onClick={() => deleteNode(selectedNode.id)}
                  className="w-full text-xs text-red-600 hover:text-red-700 mt-2"
                >
                  Delete Node
                </button>
              </div>
            </Card>
          )}
        </div>

        {/* Main Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
