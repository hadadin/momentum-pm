'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Task, TaskStatus, TaskPriority, Workspace, Project, Subtask } from '@/types';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types';
import TaskFormDialog from '@/components/forms/TaskFormDialog';
import AITaskChat from '@/components/ai/AITaskChat';
import FocusMode from '@/components/FocusMode';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'done') return false;
  return task.due_date < todayISO();
}

const ALL_STATUSES: TaskStatus[] = ['backlog', 'today', 'in_progress', 'blocked', 'done'];
const ALL_PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

// Kanban status grouping
const KANBAN_COLUMNS: Record<string, TaskStatus[]> = {
  'backlog': ['backlog'],
  'today': ['today'],
  'in_progress': ['in_progress'],
  'blocked': ['blocked'],
  'done': ['done'],
};

// ─── Subtask List ──────────────────────────────────────────
function SubtaskList({
  subtasks,
  taskId,
  onToggle,
  onDelete,
}: {
  subtasks: Subtask[];
  taskId: string;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2 pl-8 border-l-2 border-gray-100">
      {subtasks.map(st => (
        <div key={st.id} className="flex items-center gap-2 py-1.5">
          <button
            onClick={() => onToggle(st.id, st.completed)}
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              st.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-indigo-400'
            }`}
          >
            {st.completed && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className={`text-xs ${st.completed ? 'line-through text-gray-400' : 'text-gray-600'}`}>
            {st.title}
          </span>
          <button
            onClick={() => onDelete(st.id)}
            className="ml-auto text-gray-300 hover:text-red-400 transition-colors"
            aria-label="Delete subtask"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Task Row (List View) ──────────────────────────────────────
function TaskRow({
  task,
  subtaskCount,
  expandedSubtasks,
  onToggleExpand,
  onToggle,
  onStatusChange,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onEdit,
  onFocus,
  subtasks,
}: {
  task: Task;
  subtaskCount: number;
  expandedSubtasks: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggle: (id: string, isDone: boolean) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onDeleteSubtask: (id: string) => void;
  onEdit: (task: Task) => void;
  onFocus: (task: Task) => void;
  subtasks: Subtask[];
}) {
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const pc = PRIORITY_CONFIG[task.priority];
  const isExpanded = expandedSubtasks.has(task.id);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);

  const handleAddSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    setAddingSubtask(true);
    await onAddSubtask(task.id, subtaskTitle);
    setSubtaskTitle('');
    setAddingSubtask(false);
  };

  return (
    <div className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors group">
      <div className={`flex items-start gap-3 px-4 py-3 border-l-4 ${pc.border}`}>
        {/* Checkbox */}
        <button
          onClick={() => onToggle(task.id, done)}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-indigo-400'
          }`}
        >
          {done && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => onEdit(task)}
            className={`text-sm font-medium text-left hover:text-indigo-600 transition-colors ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}
          >
            {task.title}
          </button>
          {task.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Status dropdown */}
            <select
              value={task.status}
              onChange={e => onStatusChange(task.id, e.target.value as TaskStatus)}
              className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer ${STATUS_CONFIG[task.status].bgColor} ${STATUS_CONFIG[task.status].textColor}`}
            >
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>

            {/* Priority badge */}
            <span className={`text-xs font-medium ${pc.color}`}>
              {pc.label}
            </span>

            {/* Project */}
            {task.project && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {task.project.title}
              </span>
            )}

            {/* Due date */}
            {task.due_date && (
              <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                {overdue ? '⚠ ' : ''}Due {task.due_date}
              </span>
            )}

            {/* Time estimate */}
            {task.time_estimate_minutes && (
              <span className="text-xs text-gray-400">⏱ {task.time_estimate_minutes}m</span>
            )}

            {/* Tags */}
            {task.tags?.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                #{tag}
              </span>
            ))}

            {/* Subtask badge */}
            {subtaskCount > 0 && (
              <button
                onClick={() => onToggleExpand(task.id)}
                className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
              >
                {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Focus mode button */}
          <button
            onClick={() => onFocus(task)}
            className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
            aria-label="Focus mode"
            title="Focus mode"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          {subtasks.length > 0 && (
            <SubtaskList
              subtasks={subtasks}
              taskId={task.id}
              onToggle={onToggleSubtask}
              onDelete={onDeleteSubtask}
            />
          )}

          {/* Add subtask form */}
          <div className="mt-3 flex gap-2 pl-8">
            <input
              type="text"
              placeholder="Add subtask..."
              value={subtaskTitle}
              onChange={e => setSubtaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleAddSubtask();
                }
              }}
              className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-400 outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              onClick={handleAddSubtask}
              disabled={!subtaskTitle.trim() || addingSubtask}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {addingSubtask ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────
function KanbanTaskCard({
  task,
  subtaskCount,
  onStatusChange,
  onToggle,
  onEdit,
  onFocus,
}: {
  task: Task;
  subtaskCount: number;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (task: Task) => void;
  onFocus: (task: Task) => void;
}) {
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const pc = PRIORITY_CONFIG[task.priority];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow group cursor-pointer">
      {/* Header with checkbox */}
      <div className="flex items-start gap-2 mb-2">
        <button
          onClick={() => onToggle(task.id, done)}
          className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-indigo-400'
          }`}
        >
          {done && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Title */}
      <button
        onClick={() => onEdit(task)}
        className={`text-sm font-medium text-left mb-2 w-full hover:text-indigo-600 transition-colors ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}
      >
        {task.title}
      </button>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pc.color}`}>
          {pc.label}
        </span>
        {task.project && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {task.project.title}
          </span>
        )}
        {subtaskCount > 0 && (
          <span className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full">
            {subtaskCount}
          </span>
        )}
      </div>

      {/* Due date */}
      {task.due_date && (
        <p className={`text-xs mb-2 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {overdue ? '⚠ ' : ''}Due {task.due_date}
        </p>
      )}

      {/* Status + Focus buttons */}
      <div className="flex gap-1.5 pt-2 border-t border-gray-100">
        <select
          value={task.status}
          onChange={e => onStatusChange(task.id, e.target.value as TaskStatus)}
          className="flex-1 text-xs px-1.5 py-1 border border-gray-200 rounded bg-white text-gray-600 outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <button
          onClick={() => onFocus(task)}
          className="p-1 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
          title="Focus mode"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function TasksPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subtasksMap, setSubtasksMap] = useState<Record<string, Subtask[]>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());

  // Dialog states
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [aiTaskChatOpen, setAiTaskChatOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!ws) {
        setLoading(false);
        return;
      }
      setWorkspace(ws);

      const [{ data: taskData }, { data: projectData }, { data: subtaskData }] = await Promise.all([
        supabase
          .from('tasks')
          .select('*, project:projects(title, color)')
          .eq('workspace_id', ws.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select('*')
          .eq('workspace_id', ws.id)
          .order('title'),
        supabase
          .from('subtasks')
          .select('*, task:tasks!inner(workspace_id)')
          .eq('task.workspace_id', ws.id),
      ]);

      setTasks(taskData ?? []);
      setProjects(projectData ?? []);

      // Group subtasks by task_id
      const grouped: Record<string, Subtask[]> = {};
      if (subtaskData) {
        subtaskData.forEach(st => {
          if (!grouped[st.task_id]) grouped[st.task_id] = [];
          grouped[st.task_id].push(st);
        });
      }
      setSubtasksMap(grouped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleTask = async (taskId: string, isDone: boolean) => {
    const newStatus: TaskStatus = isDone ? 'today' : 'done';
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: isDone ? null : new Date().toISOString(),
    }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const addSubtask = async (taskId: string, title: string) => {
    if (!workspace) return;
    const { data: created } = await supabase
      .from('subtasks')
      .insert({
        task_id: taskId,
        title: title.trim(),
        completed: false,
      })
      .select()
      .single();

    if (created) {
      setSubtasksMap(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] ?? []), created],
      }));
    }
  };

  const toggleSubtask = async (subtaskId: string, completed: boolean) => {
    await supabase.from('subtasks').update({ completed: !completed }).eq('id', subtaskId);
    setSubtasksMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(taskId => {
        updated[taskId] = updated[taskId].map(st =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        );
      });
      return updated;
    });
  };

  const deleteSubtask = async (subtaskId: string) => {
    await supabase.from('subtasks').delete().eq('id', subtaskId);
    setSubtasksMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(taskId => {
        updated[taskId] = updated[taskId].filter(st => st.id !== subtaskId);
      });
      return updated;
    });
  };

  const toggleExpandSubtasks = (taskId: string) => {
    setExpandedSubtasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setTaskFormOpen(true);
  };

  const handleNewTask = () => {
    setSelectedTask(null);
    setTaskFormOpen(true);
  };

  const handleTaskSaved = () => {
    setTaskFormOpen(false);
    setSelectedTask(null);
    fetchData();
  };

  const handleTasksCreatedFromAI = () => {
    setAiTaskChatOpen(false);
    fetchData();
  };

  // Filtered tasks
  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (projectFilter !== 'all' && t.project_id !== projectFilter) return false;
    return true;
  });

  const priorityOrder: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const statusOrder: Record<TaskStatus, number> = { blocked: 0, in_progress: 1, today: 2, backlog: 3, done: 4 };
  const sorted = [...filtered].sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Stats
  const totalActive = tasks.filter(t => t.status !== 'done').length;
  const overdueCount = tasks.filter(t => isOverdue(t)).length;
  const doneToday = tasks.filter(t => t.status === 'done' && t.completed_at?.startsWith(todayISO())).length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Tasks
            <span className="ml-3 inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
              {tasks.length}
            </span>
          </h1>
        </div>

        {/* View toggle */}
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            List
          </button>
          <div className="w-px bg-gray-200" />
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'kanban'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Kanban
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Status filters */}
        <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden p-0.5 gap-0.5">
          {(['all', 'backlog', 'today', 'in_progress', 'blocked', 'done'] as const).map((value) => {
            const label = value === 'all' ? 'All' : STATUS_CONFIG[value]?.label || value;
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value === 'all' ? 'all' : value)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  statusFilter === value
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as TaskPriority | 'all')}
          className="text-xs border border-gray-200 bg-white rounded-xl px-3 py-2 text-gray-600 outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="all">All priorities</option>
          {ALL_PRIORITIES.map(p => (
            <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
          ))}
        </select>

        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="text-xs border border-gray-200 bg-white rounded-xl px-3 py-2 text-gray-600 outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="all">All projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        {/* Action buttons */}
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleNewTask}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Task
          </button>

          <button
            onClick={() => setAiTaskChatOpen(true)}
            className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Add with AI
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-px rounded-xl overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-200 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl px-6 py-12 text-center">
          <p className="text-gray-600 font-medium text-sm">No tasks match this filter</p>
          <p className="text-gray-400 text-xs mt-1">Try a different filter or create a new task</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="rounded-xl overflow-hidden border border-gray-200 mb-4 bg-white">
          {sorted.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              subtaskCount={subtasksMap[task.id]?.length ?? 0}
              expandedSubtasks={expandedSubtasks}
              onToggleExpand={toggleExpandSubtasks}
              onToggle={toggleTask}
              onStatusChange={updateTaskStatus}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
              onEdit={handleEditTask}
              onFocus={setFocusTask}
              subtasks={subtasksMap[task.id] ?? []}
            />
          ))}
        </div>
      ) : (
        // Kanban view
        <div className="grid grid-cols-5 gap-4 mb-4">
          {(['backlog', 'today', 'in_progress', 'blocked', 'done'] as const).map(column => {
            const columnTasks = sorted.filter(t => t.status === column);
            const columnLabels: Record<typeof column, string> = {
              'backlog': 'Backlog',
              'today': 'Today',
              'in_progress': 'In Progress',
              'blocked': 'Blocked',
              'done': 'Done',
            };

            return (
              <div key={column} className="flex flex-col">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  {columnLabels[column]} ({columnTasks.length})
                </h2>
                <div className="flex-1 space-y-3 bg-gray-50 rounded-xl p-4 min-h-96">
                  {columnTasks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-gray-400">No tasks</p>
                    </div>
                  ) : (
                    columnTasks.map(task => (
                      <KanbanTaskCard
                        key={task.id}
                        task={task}
                        subtaskCount={subtasksMap[task.id]?.length ?? 0}
                        onStatusChange={updateTaskStatus}
                        onToggle={toggleTask}
                        onEdit={handleEditTask}
                        onFocus={setFocusTask}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Form Dialog */}
      {workspace && (
        <TaskFormDialog
          open={taskFormOpen}
          onClose={() => setTaskFormOpen(false)}
          task={selectedTask}
          workspaceId={workspace.id}
          projects={projects}
          onSaved={handleTaskSaved}
        />
      )}

      {/* AI Task Chat Dialog */}
      {workspace && (
        <AITaskChat
          open={aiTaskChatOpen}
          onClose={() => setAiTaskChatOpen(false)}
          workspaceId={workspace.id}
          onTasksCreated={handleTasksCreatedFromAI}
        />
      )}

      {/* Focus Mode */}
      {focusTask && (
        <FocusMode task={focusTask} onClose={() => setFocusTask(null)} />
      )}
    </div>
  );
}
