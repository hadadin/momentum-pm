'use client';

import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { supabase } from '@/lib/supabase';

interface AITaskChatProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  onTasksCreated: () => void;
}

interface ExtractedTask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string | null;
  time_estimate: number | null;
  selected: boolean;
}

export default function AITaskChat({
  open,
  onClose,
  workspaceId,
  onTasksCreated,
}: AITaskChatProps) {
  const [input, setInput] = useState('');
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError('');

    try {
      const today = new Date().toISOString().split('T')[0];
      const prompt = `You are a task management assistant. Parse the user's input and extract tasks.
User input: ${input}
Extract all tasks mentioned. For each task, determine:
- title (short, clear task name)
- description (more details if provided, otherwise empty string)
- priority (low/medium/high/critical based on context, default to medium)
- due_date (if mentioned, format as YYYY-MM-DD, otherwise null)
- time_estimate (if mentioned in minutes as a number, otherwise null)
Today's date is ${today}.`;

      const responseSchema = {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                due_date: { type: 'string' },
                time_estimate: { type: 'number' },
              },
              required: ['title', 'priority'],
            },
          },
        },
        required: ['tasks'],
      };

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, responseSchema }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process tasks');
      }
      let parsed: { tasks?: any[] } = {};
      if (result.data && typeof result.data === 'object') {
        parsed = result.data;
      } else if (typeof result.data === 'string') {
        try {
          const cleaned = result.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          parsed = JSON.parse(cleaned);
        } catch {
          parsed = {};
        }
      }
      const tasks = Array.isArray(parsed) ? parsed : (parsed.tasks || []);

      const formattedTasks: ExtractedTask[] = tasks.map((task: any, idx: number) => ({
        id: `${idx}-${Date.now()}`,
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        due_date: task.due_date || null,
        time_estimate: task.time_estimate || null,
        selected: true,
      }));

      setExtractedTasks(formattedTasks);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process tasks');
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    setExtractedTasks((tasks) =>
      tasks.map((task) => (task.id === id ? { ...task, selected: !task.selected } : task))
    );
  };

  const startEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditingTitle(title);
  };

  const saveEdit = (id: string) => {
    setExtractedTasks((tasks) =>
      tasks.map((task) =>
        task.id === id ? { ...task, title: editingTitle } : task
      )
    );
    setEditingId(null);
  };

  const handleCreateTasks = async () => {
    const selectedTasks = extractedTasks.filter((task) => task.selected);
    if (selectedTasks.length === 0) {
      setError('Please select at least one task');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const tasksToInsert = selectedTasks.map((task) => ({
        workspace_id: workspaceId,
        title: task.title,
        description: task.description || null,
        priority: task.priority,
        due_date: task.due_date || null,
        time_estimate_minutes: task.time_estimate || null,
        status: 'today' as const,
        source: 'chat' as const,
        tags: [],
        is_recurring: false,
        time_actual_minutes: 0,
      }));

      const { error: insertError } = await supabase.from('tasks').insert(tasksToInsert);

      if (insertError) throw insertError;

      onTasksCreated();
      setExtractedTasks([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tasks');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    };
    return colors[priority] || colors.medium;
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Tasks with AI" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!extractedTasks.length ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your tasks... e.g. 'Review designs by Friday, high priority. Also set up analytics dashboard next week'"
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm0 2a8 8 0 100 16 8 8 0 000-16zm.5 5v3.5h3.5v1H12.5V19h-1v-5.5H8v-1h3.5V7h1z" />
                </svg>
                {loading ? 'Processing...' : 'Send'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">
              Review Tasks ({extractedTasks.filter((t) => t.selected).length} selected)
            </h3>

            {extractedTasks.map((task) => (
              <div key={task.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={task.selected}
                    onChange={() => toggleTask(task.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    {editingId === task.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => saveEdit(task.id)}
                          className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                        <button
                          onClick={() => startEdit(task.id, task.title)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
                            <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ml-7 space-y-2">
                  {task.description && (
                    <p className="text-xs text-gray-600">{task.description}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    {task.due_date && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {task.due_date}
                      </span>
                    )}
                    {task.time_estimate && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {task.time_estimate}m
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setExtractedTasks([])}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCreateTasks}
                disabled={
                  loading || extractedTasks.filter((t) => t.selected).length === 0
                }
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {loading
                  ? 'Creating...'
                  : `Create ${extractedTasks.filter((t) => t.selected).length} Tasks`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
