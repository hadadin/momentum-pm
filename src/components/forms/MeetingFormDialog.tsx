'use client';

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Meeting } from '@/types';
import { supabase } from '@/lib/supabase';

interface MeetingFormDialogProps {
  open: boolean;
  onClose: () => void;
  meeting?: Meeting | null;
  workspaceId: string;
  projects: Array<{ id: string; title: string }>;
  onSaved: () => void;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  selected: boolean;
}

export default function MeetingFormDialog({
  open,
  onClose,
  meeting,
  workspaceId,
  projects,
  onSaved,
}: MeetingFormDialogProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title || '');
      setDate(meeting.date || '');
      setProjectId(meeting.project_id || null);
      setNotes(meeting.notes || '');
      setActionItems([]);
    } else {
      setTitle('');
      setDate(new Date().toISOString().split('T')[0]);
      setProjectId(null);
      setNotes('');
      setActionItems([]);
    }
    setError('');
  }, [meeting, open]);

  const handleExtractActionItems = async () => {
    if (!notes.trim()) {
      setError('Please enter meeting notes first');
      return;
    }

    setExtracting(true);
    setError('');

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'extract-action-items',
          notes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract action items');
      }

      const data = await response.json();
      const items = data.actionItems || [];

      setActionItems(
        items.map((item: any, idx: number) => ({
          id: `${idx}-${Date.now()}`,
          title: item.title || '',
          description: item.description || '',
          priority: item.priority || 'medium',
          selected: true,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract action items');
    } finally {
      setExtracting(false);
    }
  };

  const toggleActionItem = (id: string) => {
    setActionItems((items) =>
      items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleCreateTasks = async () => {
    const selectedItems = actionItems.filter((item) => item.selected);
    if (selectedItems.length === 0) {
      setError('Please select at least one action item');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const tasks = selectedItems.map((item) => ({
        workspace_id: workspaceId,
        title: item.title,
        description: item.description,
        priority: item.priority,
        status: 'today',
        source: 'meeting',
        project_id: projectId,
      }));

      const { error: insertError } = await supabase.from('tasks').insert(tasks);

      if (insertError) throw insertError;

      setActionItems([]);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const meetingData = {
        title: title.trim(),
        date: date || null,
        notes: notes.trim(),
        project_id: projectId,
        workspace_id: workspaceId,
        status: 'completed',
      };

      if (meeting?.id) {
        const { error: updateError } = await supabase
          .from('meetings')
          .update(meetingData)
          .eq('id', meeting.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('meetings').insert([meetingData]);

        if (insertError) throw insertError;
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meeting');
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
    <Modal
      open={open}
      onClose={onClose}
      title={meeting ? 'Edit Meeting' : 'New Meeting'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meeting Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Date & Project */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Optional</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Meeting Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meeting Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste your meeting notes here..."
            rows={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Extract Action Items Button */}
        {!actionItems.length && (
          <button
            type="button"
            onClick={handleExtractActionItems}
            disabled={extracting || !notes.trim()}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm0 2a8 8 0 100 16 8 8 0 000-16zm.5 5v3.5h3.5v1H12.5V19h-1v-5.5H8v-1h3.5V7h1z" />
            </svg>
            {extracting ? 'Extracting...' : 'Extract Action Items'}
          </button>
        )}

        {/* Action Items List */}
        {actionItems.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-900">Action Items</h3>
            {actionItems.map((item) => (
              <div key={item.id} className="flex gap-3">
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleActionItem(item.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                  )}
                  <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${getPriorityColor(item.priority)}`}>
                    {item.priority}
                  </span>
                </div>
              </div>
            ))}

            {actionItems.filter((i) => i.selected).length > 0 && (
              <button
                type="button"
                onClick={handleCreateTasks}
                disabled={loading}
                className="w-full mt-3 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {loading
                  ? 'Creating...'
                  : `Create ${actionItems.filter((i) => i.selected).length} Tasks`}
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Meeting'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
