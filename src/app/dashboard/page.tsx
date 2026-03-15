'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Task, Workspace, KpiEntry, Project, Goal, PRIORITY_CONFIG, STATUS_CONFIG } from '@/types';
// FocusMode available on Tasks page
// Inline SVG icons (no external dependency)

function getWeekStart(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

interface KpiCardProps {
  kpi: KpiEntry;
}

function KpiCard({ kpi }: KpiCardProps) {
  const percentChange = kpi.previous_value && kpi.previous_value > 0
    ? Math.round(((kpi.value - kpi.previous_value) / kpi.previous_value) * 100)
    : 0;

  const isPositive = percentChange >= 0;
  const trendIcon = isPositive ? (
    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="18 15 12 9 6 15"/></svg>
  ) : (
    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="6 9 12 15 18 9"/></svg>
  );

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">{kpi.metric_name}</p>
          <p className="text-2xl font-bold text-zinc-900 mt-2">{kpi.value}{kpi.unit}</p>
        </div>
        <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {trendIcon}
          <span className="text-xs font-semibold">{Math.abs(percentChange)}%</span>
        </div>
      </div>
    </div>
  );
}

interface GoalItemProps {
  goal: Goal;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function GoalItem({ goal, onToggle, onDelete }: GoalItemProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <button
        onClick={() => onToggle(goal.id)}
        className="mt-1 flex-shrink-0 focus:outline-none"
      >
        {goal.completed ? (
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
        ) : (
          <svg className="w-5 h-5 text-zinc-300 hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/></svg>
        )}
      </button>
      <span className={`flex-1 text-sm ${goal.completed ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>
        {goal.text}
      </span>
      <button
        onClick={() => onDelete(goal.id)}
        className="flex-shrink-0 text-zinc-400 hover:text-red-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      </button>
    </div>
  );
}

interface GoalsColumnProps {
  title: string;
  goals: Goal[];
  onAddGoal: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  showProgress?: boolean;
}

function GoalsColumn({ title, goals, onAddGoal, onToggle, onDelete, showProgress }: GoalsColumnProps) {
  const [newGoal, setNewGoal] = useState('');
  const completedCount = goals.filter(g => g.completed).length;

  const handleAddGoal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newGoal.trim()) {
      onAddGoal(newGoal.trim());
      setNewGoal('');
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-zinc-900">{title}</h3>
        {showProgress && (
          <span className="text-xs font-medium text-zinc-600">{completedCount}/{goals.length}</span>
        )}
      </div>
      <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
        {goals.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">No goals yet</p>
        ) : (
          goals.map(goal => (
            <GoalItem
              key={goal.id}
              goal={goal}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
      <input
        type="text"
        value={newGoal}
        onChange={(e) => setNewGoal(e.target.value)}
        onKeyDown={handleAddGoal}
        placeholder={`Add ${title.toLowerCase()}...`}
        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded bg-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>
  );
}

interface QuickAddFormProps {
  onTaskAdd: (task: Partial<Task>) => void;
}

function QuickAddForm({ onTaskAdd }: QuickAddFormProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onTaskAdd({
        title: title.trim(),
        priority: priority as Task['priority'],
        due_date: getTodayDate(),
        status: 'today'
      });
      setTitle('');
      setPriority('medium');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-lg p-4">
      <h3 className="font-semibold text-zinc-900 mb-3">Quick Add</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task..."
          className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded bg-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded bg-zinc-50 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded font-medium text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add
        </button>
      </div>
    </form>
  );
}

interface TaskListProps {
  tasks: Task[];
  onToggleDone: (id: string) => void;
}

function TaskList({ tasks, onToggleDone }: TaskListProps) {
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
  });

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4">
      <h3 className="font-semibold text-zinc-900 mb-3">Today's Tasks</h3>
      <div className="space-y-2">
        {sortedTasks.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No tasks for today</p>
        ) : (
          sortedTasks.map(task => {
            const priorityConfig = PRIORITY_CONFIG[task.priority];
            const isDone = task.status === 'done';
            return (
              <div
                key={task.id}
                className="flex items-start gap-3 p-2 hover:bg-zinc-50 rounded transition-colors"
              >
                <button
                  onClick={() => onToggleDone(task.id)}
                  className="mt-0.5 flex-shrink-0 focus:outline-none"
                >
                  {isDone ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                  ) : (
                    <svg className="w-5 h-5 text-zinc-300 hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/></svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isDone ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>
                    {task.title}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 inline-block px-2 py-1 text-xs font-medium rounded-full ${priorityConfig.bg} ${priorityConfig.color}`}
                >
                  {priorityConfig.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kpis, setKpis] = useState<KpiEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [weeklyGoals, setWeeklyGoals] = useState<Goal[]>([]);
  const [dailyGoals, setDailyGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (workspaceError) throw workspaceError;
      if (!workspaceData) {
        setError('No workspace found');
        return;
      }
      setWorkspace(workspaceData);

      const today = getTodayDate();
      const weekStart = getWeekStart();

      const [tasksRes, kpisRes, projectsRes, goalsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .eq('workspace_id', workspaceData.id)
          .eq('due_date', today)
          .in('status', ['today', 'in_progress', 'backlog']),
        supabase
          .from('kpi_entries')
          .select('*')
          .eq('workspace_id', workspaceData.id)
          .eq('is_favorite', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select('*')
          .eq('workspace_id', workspaceData.id)
          .not('phase', 'in', '("archived","launched")'),
        supabase
          .from('goals')
          .select('*')
          .eq('workspace_id', workspaceData.id)
          .or(`and(type.eq.daily,date.eq.${today}),and(type.eq.weekly,date.eq.${weekStart})`)
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (kpisRes.error) throw kpisRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (goalsRes.error) throw goalsRes.error;

      setTasks(tasksRes.data || []);
      setKpis(kpisRes.data || []);
      setProjects(projectsRes.data || []);

      const goalsData = goalsRes.data || [];
      setWeeklyGoals(goalsData.filter(g => g.type === 'weekly'));
      setDailyGoals(goalsData.filter(g => g.type === 'daily'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'done' ? 'today' : 'done';
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (!error) {
      setTasks(tasks.map(t =>
        t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t
      ));
    }
  };

  const handleAddTask = async (taskData: Partial<Task>) => {
    if (!workspace) return;

    const { error } = await supabase
      .from('tasks')
      .insert([{
        ...taskData,
        workspace_id: workspace.id,
        source: 'manual',
        tags: [],
        is_recurring: false,
        time_actual_minutes: 0
      }]);

    if (!error) {
      fetchData();
    }
  };

  const handleAddGoal = async (text: string, type: 'weekly' | 'daily') => {
    if (!workspace) return;

    const date = type === 'daily' ? getTodayDate() : getWeekStart();
    const { error } = await supabase
      .from('goals')
      .insert([{
        workspace_id: workspace.id,
        type,
        text,
        completed: false,
        date
      }]);

    if (!error) {
      fetchData();
    }
  };

  const handleToggleGoal = async (goalId: string) => {
    const allGoals = [...weeklyGoals, ...dailyGoals];
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal) return;

    const { error } = await supabase
      .from('goals')
      .update({ completed: !goal.completed })
      .eq('id', goalId);

    if (!error) {
      if (goal.type === 'weekly') {
        setWeeklyGoals(weeklyGoals.map(g =>
          g.id === goalId ? { ...g, completed: !g.completed } : g
        ));
      } else {
        setDailyGoals(dailyGoals.map(g =>
          g.id === goalId ? { ...g, completed: !g.completed } : g
        ));
      }
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId);

    if (!error) {
      setWeeklyGoals(weeklyGoals.filter(g => g.id !== goalId));
      setDailyGoals(dailyGoals.filter(g => g.id !== goalId));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Good morning</h1>
          <p className="text-zinc-600 mt-1">Ready to crush your goals today?</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Tasks Due</p>
            <p className="text-3xl font-bold text-zinc-900 mt-2">{tasks.length}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Active Projects</p>
            <p className="text-3xl font-bold text-zinc-900 mt-2">{projects.length}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Daily Goals</p>
            <p className="text-3xl font-bold text-zinc-900 mt-2">{dailyGoals.length}</p>
          </div>
        </div>

        {/* KPI Cards */}
        {kpis.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Key Metrics</h2>
            <div className="grid grid-cols-2 gap-4">
              {kpis.map(kpi => (
                <KpiCard key={kpi.id} kpi={kpi} />
              ))}
            </div>
          </div>
        )}

        {/* Active Projects */}
        {projects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Active Projects</h2>
            <div className="flex flex-wrap gap-2">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: project.color || '#4f46e5' }}
                >
                  {project.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals Widget */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <GoalsColumn
            title="Weekly Focus"
            goals={weeklyGoals}
            onAddGoal={(text) => handleAddGoal(text, 'weekly')}
            onToggle={handleToggleGoal}
            onDelete={handleDeleteGoal}
          />
          <GoalsColumn
            title="Daily Top 3"
            goals={dailyGoals}
            onAddGoal={(text) => handleAddGoal(text, 'daily')}
            onToggle={handleToggleGoal}
            onDelete={handleDeleteGoal}
            showProgress
          />
        </div>

        {/* Today's Tasks */}
        <div className="mb-8">
          <TaskList tasks={tasks} onToggleDone={handleToggleTask} />
        </div>

        {/* Quick Add */}
        <div className="mb-8">
          <QuickAddForm onTaskAdd={handleAddTask} />
        </div>

      </div>
    </div>
  );
}
