'use client';

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Task, TimeBlock, Goal } from '@/types';
import { supabase } from '@/lib/supabase';

interface AISuggestDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'weekly-goals' | 'daily-top3' | 'weekly-planning';
  workspaceId: string;
  tasks: Task[];
  onAccepted: () => void;
}

interface WeeklyGoal {
  id: string;
  text: string;
  day: string;
  reason: string;
}

interface DailyTop3 {
  id: string;
  text: string;
  time: string;
  reason: string;
}

interface ScheduledItem {
  id: string;
  day: string;
  taskName: string;
  timeSlot: string;
  reason: string;
}

type SuggestionItem = WeeklyGoal | DailyTop3 | ScheduledItem;

export default function AISuggestDialog({
  open,
  onClose,
  mode,
  workspaceId,
  tasks,
  onAccepted,
}: AISuggestDialogProps) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getTitle = () => {
    switch (mode) {
      case 'weekly-goals':
        return 'AI Weekly Goals';
      case 'daily-top3':
        return 'AI Daily Priorities';
      case 'weekly-planning':
        return 'AI Weekly Schedule';
    }
  };

  const buildTaskContext = () => {
    return tasks
      .slice(0, 20)
      .map(
        (task) =>
          `- [${task.priority}] ${task.title}${task.due_date ? ` (due: ${task.due_date}` : ''}${task.time_estimate_minutes ? `, est: ${task.time_estimate_minutes}min` : ''}${task.due_date || task.time_estimate_minutes ? ')' : ''}`
      )
      .join('\n');
  };

  const fetchSuggestions = async () => {
    setLoading(true);
    setError('');

    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const taskContext = buildTaskContext();

      let prompt = '';

      switch (mode) {
        case 'weekly-goals':
          prompt = `You are a planning assistant. Based on these tasks, suggest 3-5 strategic weekly goals for the week starting ${weekStartStr}.
Tasks:
${taskContext}

For each goal, provide:
- text (the goal statement)
- day (Mon/Tue/Wed/Thu/Fri)
- reason (why this goal)

Return JSON with structure: { goals: [{ text, day, reason }] }`;
          break;

        case 'daily-top3':
          prompt = `You are a prioritization assistant. Based on these tasks, suggest the top 3 priorities for today.
Tasks:
${taskContext}

For each priority, provide:
- text (the task/priority)
- time (suggested time to do it, e.g. "09:00", "14:00")
- reason (why this priority)

Return JSON with structure: { priorities: [{ text, time, reason }] }`;
          break;

        case 'weekly-planning':
          prompt = `You are a scheduling assistant. Based on these tasks, create a weekly schedule starting ${weekStartStr}.
Tasks:
${taskContext}

For each scheduled item, provide:
- day (Mon/Tue/Wed/Thu/Fri)
- taskName (task to schedule)
- timeSlot (e.g. "09:00-11:00")
- reason (why scheduled here)

Return JSON with structure: { schedule: [{ day, taskName, timeSlot, reason }] }`;
          break;
      }

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch suggestions');
      }
      // API returns { data: text } - parse the text as JSON
      let data: any = {};
      try {
        if (typeof result.data === 'string') {
          const cleaned = result.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          data = JSON.parse(cleaned);
        } else {
          data = result.data || {};
        }
      } catch {
        data = {};
      }

      let formattedSuggestions: SuggestionItem[] = [];

      if (mode === 'weekly-goals' && data.goals) {
        formattedSuggestions = data.goals.map((goal: any, idx: number) => ({
          id: `${idx}-${Date.now()}`,
          text: goal.text || '',
          day: goal.day || '',
          reason: goal.reason || '',
        }));
      } else if (mode === 'daily-top3' && data.priorities) {
        formattedSuggestions = data.priorities.map((priority: any, idx: number) => ({
          id: `${idx}-${Date.now()}`,
          text: priority.text || '',
          time: priority.time || '',
          reason: priority.reason || '',
        }));
      } else if (mode === 'weekly-planning' && data.schedule) {
        formattedSuggestions = data.schedule.map((item: any, idx: number) => ({
          id: `${idx}-${Date.now()}`,
          day: item.day || '',
          taskName: item.taskName || '',
          timeSlot: item.timeSlot || '',
          reason: item.reason || '',
        }));
      }

      setSuggestions(formattedSuggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSuggestions();
    }
  }, [open, mode]);

  const deleteSuggestion = (id: string) => {
    setSuggestions((items) => items.filter((item) => item.id !== id));
  };

  const handleAccept = async () => {
    if (suggestions.length === 0) return;

    setLoading(true);
    setError('');

    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      if (mode === 'weekly-goals') {
        const goals = (suggestions as WeeklyGoal[]).map((goal) => ({
          workspace_id: workspaceId,
          type: 'weekly' as const,
          text: goal.text,
          completed: false,
          date: weekStartStr,
        }));

        const { error: insertError } = await supabase.from('goals').insert(goals);
        if (insertError) throw insertError;
      } else if (mode === 'daily-top3') {
        const goals = (suggestions as DailyTop3[]).map((priority) => ({
          workspace_id: workspaceId,
          type: 'daily' as const,
          text: priority.text,
          completed: false,
          date: todayStr,
        }));

        const { error: insertError } = await supabase.from('goals').insert(goals);
        if (insertError) throw insertError;
      } else if (mode === 'weekly-planning') {
        const timeBlocks = (suggestions as ScheduledItem[]).map((item) => {
          const dayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(item.day);
          const blockDate = new Date(weekStart);
          blockDate.setDate(weekStart.getDate() + dayIndex);

          const [startTime] = item.timeSlot.split('-');
          const [hours, minutes] = startTime.split(':');

          return {
            workspace_id: workspaceId,
            task_name: item.taskName,
            date: blockDate.toISOString().split('T')[0],
            start_time: startTime,
            duration_minutes: 60,
          };
        });

        const { error: insertError } = await supabase.from('time_blocks').insert(timeBlocks);
        if (insertError) throw insertError;
      }

      onAccepted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save suggestions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={getTitle()} maxWidth="max-w-lg">
      <div className="space-y-4">
        {loading && !suggestions.length ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <div className="animate-spin">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-600">AI is thinking...</p>
          </div>
        ) : error ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : suggestions.length > 0 ? (
          <div className="space-y-3">
            {mode === 'weekly-goals' &&
              (suggestions as WeeklyGoal[]).map((goal) => (
                <div key={goal.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{goal.text}</p>
                      <p className="text-xs text-gray-600 mt-1">{goal.reason}</p>
                      <span className="inline-block mt-2 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {goal.day}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteSuggestion(goal.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

            {mode === 'daily-top3' &&
              (suggestions as DailyTop3[]).map((priority) => (
                <div key={priority.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{priority.text}</p>
                      <p className="text-xs text-gray-600 mt-1">{priority.reason}</p>
                      <span className="inline-block mt-2 px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {priority.time}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteSuggestion(priority.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

            {mode === 'weekly-planning' &&
              (suggestions as ScheduledItem[]).map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          {item.day}
                        </span>
                        <span className="text-xs font-medium text-gray-600">{item.timeSlot}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{item.taskName}</p>
                      <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                    </div>
                    <button
                      onClick={() => deleteSuggestion(item.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                onClick={() => fetchSuggestions()}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Saving...' : 'Accept'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
