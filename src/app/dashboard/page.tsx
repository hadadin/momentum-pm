'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Task, Workspace, KpiEntry, Project, Goal, PRIORITY_CONFIG, STATUS_CONFIG } from '@/types';
import TaskFormDialog from '@/components/forms/TaskFormDialog';
import AISuggestDialog from '@/components/ai/AISuggestDialog';
import AITaskChat from '@/components/ai/AITaskChat';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekStart(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  const date = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = dayNames[date.getDay()];
  const month = monthNames[date.getMonth()];
  const dateNum = date.getDate();
  return `${day}, ${month} ${dateNum}`;
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
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m-9-2a10 10 0 1120 0 10 10 0 01-20 0z"/></svg>
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
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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

interface TaskRowProps {
  task: Task;
  onToggleDone: (id: string) => void;
  onEdit: (task: Task) => void;
}

function TaskRow({ task, onToggleDone, onEdit }: TaskRowProps) {
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const isDone = task.status === 'done';

  return (
    <div className="flex items-start gap-3 p-2 hover:bg-zinc-50 rounded transition-colors">
      <button
        onClick={() => onToggleDone(task.id)}
        className="mt-0.5 flex-shrink-0 focus:outline-none"
      >
        {isDone ? (
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m-9-2a10 10 0 1120 0 10 10 0 01-20 0z"/></svg>
        ) : (
          <svg className="w-5 h-5 text-zinc-300 hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/></svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <button
          onClick={() => onEdit(task)}
          className="text-sm text-left font-medium hover:text-indigo-600 transition-colors"
        >
          <p className={`${isDone ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>
            {task.title}
          </p>
        </button>
      </div>
      <span className={`flex-shrink-0 inline-block px-2 py-1 text-xs font-medium rounded-full ${priorityConfig.bg} ${priorityConfig.color}`}>
        {priorityConfig.label}
      </span>
      {task.project && (
        <span className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-zinc-100 text-zinc-600">
          {task.project.title}
        </span>
      )}
    </div>
  );
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
    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="23 6 23 12 17 12"/></svg>
  ) : (
    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="23 18 23 12 17 12"/></svg>
  );

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">{kpi.metric_name}</p>
          <p className="text-2xl font-bold text-zinc-900 mt-2">{kpi.value}{kpi.unit || ''}</p>
        </div>
        <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {trendIcon}
          <span className="text-xs font-semibold">{Math.abs(percentChange)}%</span>
        </div>
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

  // Dialog states
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [aiDailyPlanOpen, setAiDailyPlanOpen] = useState(false);
  const [aiWeeklyGoalsOpen, setAiWeeklyGoalsOpen] = useState(false);
  const [aiTaskChatOpen, setAiTaskChatOpen] = useState(false);

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
          .select('*, project:projects(title, color)')
          .eq('workspace_id', workspaceData.id)
          .or(`due_date.eq.${today},status.eq.today`)
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

  const handleTasksCreatedFromAI = () => {
    setAiTaskChatOpen(false);
    fetchData();
  };

  const handleAISuggestAccepted = () => {
    setAiDailyPlanOpen(false);
    setAiWeeklyGoalsOpen(false);
    fetchData();
  };

  // Sort tasks by priority
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
  });

  const completedGoalsCount = dailyGoals.filter(g => g.completed).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-zinc-900">{getGreeting()}</h1>
          <p className="text-zinc-600 mt-1">{formatDate()}</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Tasks Due Today</p>
            <p className="text-3xl font-bold text-zinc-900 mt-2">{sortedTasks.length}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Active Projects</p>
            <p className="text-3xl font-bold text-zinc-900 mt-2">{projects.length}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Goals Progress</p>
            <p className="text-3xl font-bold text-zinc-900 mt-2">{completedGoalsCount}/{dailyGoals.length}</p>
          </div>
        </div>

        {/* AI Action Buttons Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setAiDailyPlanOpen(true)}
            className="bg-white border border-zinc-200 rounded-lg p-4 hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium text-zinc-900">AI Daily Plan</span>
          </button>

          <button
            onClick={() => setAiWeeklyGoalsOpen(true)}
            className="bg-white border border-zinc-200 rounded-lg p-4 hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium text-zinc-900">AI Weekly Goals</span>
          </button>

          <button
            onClick={() => setAiTaskChatOpen(true)}
            className="bg-white border border-zinc-200 rounded-lg p-4 hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium text-zinc-900">Add Tasks with AI</span>
          </button>
        </div>

        {/* Goals Section */}
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

        {/* Today's Tasks Section */}
        <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900">Today's Tasks</h3>
            <button
              onClick={handleNewTask}
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Task
            </button>
          </div>
          <div className="space-y-2">
            {sortedTasks.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">No tasks for today</p>
            ) : (
              sortedTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggleDone={handleToggleTask}
                  onEdit={handleEditTask}
                />
              ))
            )}
          </div>
        </div>

        {/* Favorite KPIs Section */}
        {kpis.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Favorite KPIs</h2>
            <div className="grid grid-cols-2 gap-4">
              {kpis.map(kpi => (
                <KpiCard key={kpi.id} kpi={kpi} />
              ))}
            </div>
          </div>
        )}

      </div>

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

      {/* AI Dialogs */}
      {workspace && (
        <>
          <AISuggestDialog
            open={aiDailyPlanOpen}
            onClose={() => setAiDailyPlanOpen(false)}
            mode="daily-top3"
            workspaceId={workspace.id}
            tasks={tasks}
            onAccepted={handleAISuggestAccepted}
          />

          <AISuggestDialog
            open={aiWeeklyGoalsOpen}
            onClose={() => setAiWeeklyGoalsOpen(false)}
            mode="weekly-goals"
            workspaceId={workspace.id}
            tasks={tasks}
            onAccepted={handleAISuggestAccepted}
          />

          <AITaskChat
            open={aiTaskChatOpen}
            onClose={() => setAiTaskChatOpen(false)}
            workspaceId={workspace.id}
            onTasksCreated={handleTasksCreatedFromAI}
          />
        </>
      )}
    </div>
  );
}
