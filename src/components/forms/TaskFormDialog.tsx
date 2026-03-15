'use client';

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Task, TaskStatus, TaskPriority, PRIORITY_CONFIG, STATUS_CONFIG } from '@/types';
import { supabase } from '@/lib/supabase';

interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  parentTaskId?: string;
  workspaceId: string;
  projects: Array<{ id: string; title: string; color: string }>;
  onSaved: () => void;
}

const TIME_ESTIMATES = ['15min', '30min', '45min', '1h', '1.5h', '2h', '3h', '4h', '8h'];

export default function TaskFormDialog({
  open,
  onClose,
  task,
  parentTaskId,
  workspaceId,
  projects,
  onSaved,
}: TaskFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('today');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [timeEstimate, setTimeEstimate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority as TaskPriority);
      setStatus(task.status as TaskStatus);
      setProjectId(task.project_id || null);
      setDueDate(task.due_date || '');
      setTimeEstimate(task.time_estimate || '');
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('today');
      setProjectId(null);
      setDueDate('');
      setTimeEstimate('');
    }
    setError('');
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const taskData = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        project_id: projectId,
        due_date: dueDate || null,
        time_estimate: timeEstimate || null,
        source: 'manual',
        workspace_id: workspaceId,
        parent_task_id: parentTaskId || null,
      };

      if (task?.id) {
        // Update existing task
        const { error: updateError } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', task.id);

        if (updateError) throw updateError;
      } else {
        // Create new task
        const { error: insertError } = await supabase
          .from('tasks')
          .insert([taskData]);

        if (insertError) throw insertError;
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit Task' : 'New Task'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {parentTaskId && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">Subtask of parent task</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Priority & Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="backlog">Backlog</option>
              <option value="today">Today</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        {/* Project */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project
          </label>
          <select
            value={projectId || ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        {/* Due Date & Time Estimate */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Estimate
            </label>
            <select
              value={timeEstimate}
              onChange={(e) => setTimeEstimate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">None</option>
              {TIME_ESTIMATES.map((est) => (
                <option key={est} value={est}>
                  {est}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            {loading ? 'Saving...' : 'Save Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
