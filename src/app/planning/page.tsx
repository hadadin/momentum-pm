'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Task, TimeBlock, Workspace, PRIORITY_CONFIG } from '@/types';
import AISuggestDialog from '@/components/ai/AISuggestDialog';

// Inline SVG icons
function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// Helper functions
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateRange(startDate: Date): string {
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + 4);

  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${startStr} - ${endStr}`;
}

const WORK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const HOURS = Array.from({ length: 10 }, (_, i) => {
  const hour = 9 + i;
  return `${String(hour).padStart(2, '0')}:00`;
});

type ScheduledTask = Task & {
  timeBlock: TimeBlock;
};

export default function PlanningPage() {
  const [currentDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Get workspace
  useEffect(() => {
    const fetchWorkspace = async () => {
      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (workspaceData) {
        setWorkspace(workspaceData);
      }
    };

    fetchWorkspace();
  }, []);

  // Fetch tasks and time blocks
  useEffect(() => {
    const fetchData = async () => {
      if (!workspace) return;

      setLoading(true);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 5);

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('workspace_id', workspace.id)
        .neq('status', 'done')
        .is('parent_task_id', null)
        .order('priority', { ascending: true });

      const { data: timeBlocksData } = await supabase
        .from('time_blocks')
        .select(
          `
          *,
          task:tasks(title, priority, project_id, time_estimate_minutes)
        `
        )
        .eq('workspace_id', workspace.id)
        .gte('date', formatDate(weekStart))
        .lt('date', formatDate(weekEnd));

      if (tasksData) {
        setTasks(tasksData);
      }

      if (timeBlocksData) {
        setTimeBlocks(timeBlocksData);
      }

      setLoading(false);
    };

    fetchData();
  }, [weekStart, workspace]);

  // Calculate unscheduled and scheduled tasks
  useEffect(() => {
    const scheduledTaskIds = new Set(timeBlocks.map((tb) => tb.task_id));
    const unscheduled = tasks.filter((task) => !scheduledTaskIds.has(task.id));

    const scheduled = timeBlocks
      .map((tb) => {
        const task = tasks.find((t) => t.id === tb.task_id);
        return task ? { ...task, timeBlock: tb } : null;
      })
      .filter((item): item is ScheduledTask => item !== null);

    setUnscheduledTasks(unscheduled);
    setScheduledTasks(scheduled);
  }, [tasks, timeBlocks]);

  const handlePreviousWeek = () => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    setWeekStart(newWeekStart);
  };

  const handleNextWeek = () => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    setWeekStart(newWeekStart);
  };

  const handleScheduleTask = async (task: Task, dayIndex: number, hour: string) => {
    if (!workspace) return;

    const dateToSchedule = new Date(weekStart);
    dateToSchedule.setDate(dateToSchedule.getDate() + dayIndex);

    const [startHour] = hour.split(':');
    const endHour = String(parseInt(startHour) + 1).padStart(2, '0');

    try {
      await supabase.from('time_blocks').insert({
        workspace_id: workspace.id,
        task_id: task.id,
        date: formatDate(dateToSchedule),
        start_time: `${startHour}:00`,
        end_time: `${endHour}:00`,
      });

      // Refresh
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 5);

      const { data: updatedTimeBlocks } = await supabase
        .from('time_blocks')
        .select(
          `
          *,
          task:tasks(title, priority, project_id, time_estimate_minutes)
        `
        )
        .eq('workspace_id', workspace.id)
        .gte('date', formatDate(weekStart))
        .lt('date', formatDate(weekEnd));

      if (updatedTimeBlocks) {
        setTimeBlocks(updatedTimeBlocks);
      }
    } catch (error) {
      console.error('Error scheduling task:', error);
    }
  };

  const handleUnscheduleTask = async (timeBlockId: string) => {
    if (!workspace) return;

    try {
      await supabase.from('time_blocks').delete().eq('id', timeBlockId);
      setTimeBlocks((prev) => prev.filter((tb) => tb.id !== timeBlockId));
    } catch (error) {
      console.error('Error unscheduling task:', error);
    }
  };

  const getTaskColor = (priority: string): string => {
    const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG];
    if (!config) return 'bg-gray-200 text-gray-900';
    return `${config.bg} ${config.color}`;
  };

  const getTaskCardColor = (priority: string): string => {
    const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG];
    if (!config) return 'bg-gray-100 border-gray-300';
    return `${config.bg} ${config.border}`;
  };

  const getCurrentHourIndex = (): number => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 9 || hour >= 18) return -1;
    return hour - 9;
  };

  const currentHourIndex = getCurrentHourIndex();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Weekly Planning</h1>
            <p className="text-gray-600 text-sm mt-1">{formatDateRange(weekStart)}</p>
          </div>
          <button
            onClick={() => setAiDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
          >
            <SparkleIcon className="w-4 h-4" />
            AI Plan Week
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200">
          <button
            onClick={handlePreviousWeek}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <span className="text-lg font-semibold text-gray-700">{formatDateRange(weekStart)}</span>

          <button
            onClick={handleNextWeek}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Layout: Left + Right */}
      <div className="flex gap-6">
        {/* Left Panel: Unscheduled Tasks */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-[calc(100vh-200px)] flex flex-col">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 flex-shrink-0">
              <h2 className="text-lg font-semibold text-white">Unscheduled Tasks</h2>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {unscheduledTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">All tasks scheduled!</p>
                </div>
              ) : (
                unscheduledTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition cursor-help"
                    title="Click to select and drag to schedule"
                  >
                    <p className="font-medium text-gray-900 text-sm line-clamp-2">{task.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${getTaskColor(task.priority)}`}
                      >
                        {task.priority}
                      </span>
                      {task.time_estimate_minutes && (
                        <span className="text-xs text-gray-600">
                          {Math.ceil(task.time_estimate_minutes / 60)}h
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Weekly Grid */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* Time header */}
                <div className="flex border-b border-gray-200">
                  <div className="w-32 flex-shrink-0 bg-gray-50 px-4 py-3 border-r border-gray-200" />
                  {HOURS.map((hour, idx) => (
                    <div
                      key={hour}
                      className={`w-24 flex-shrink-0 px-3 py-3 text-center text-sm font-medium border-r border-gray-200 ${
                        idx === currentHourIndex
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {hour}
                    </div>
                  ))}
                </div>

                {/* Day rows */}
                {WORK_DAYS.map((day, dayIndex) => {
                  const dayDate = new Date(weekStart);
                  dayDate.setDate(dayDate.getDate() + dayIndex);
                  const dateStr = formatDate(dayDate);

                  return (
                    <div key={day} className="flex border-b border-gray-200 last:border-b-0">
                      {/* Day label */}
                      <div className="w-32 flex-shrink-0 bg-gray-50 px-4 py-3 border-r border-gray-200">
                        <p className="font-semibold text-gray-900 text-sm">{day}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {dayDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>

                      {/* Hour cells */}
                      {HOURS.map((hour, hourIdx) => {
                        const tasksInSlot = scheduledTasks.filter(
                          (st) =>
                            st.timeBlock.date === dateStr &&
                            st.timeBlock.start_time === `${hour.split(':')[0]}:00`
                        );

                        return (
                          <div
                            key={`${day}-${hour}`}
                            className={`w-24 flex-shrink-0 min-h-20 p-2 border-r border-gray-200 transition relative ${
                              hourIdx === currentHourIndex ? 'bg-indigo-50' : 'bg-white'
                            } hover:bg-gray-50`}
                          >
                            {/* Task cards */}
                            <div className="space-y-1 h-full flex flex-col justify-start">
                              {tasksInSlot.map((st) => (
                                <div
                                  key={st.id}
                                  className={`text-xs p-1.5 rounded-md border border-current truncate relative group ${getTaskCardColor(
                                    st.priority
                                  )}`}
                                >
                                  <div className="flex items-start gap-1">
                                    <span className="flex-1 line-clamp-2">{st.title}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnscheduleTask(st.timeBlock.id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                                    >
                                      <XIcon className="w-3 h-3 text-current" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Dialog */}
      <AISuggestDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        mode="weekly-planning"
        workspaceId={workspace?.id || ''}
        tasks={unscheduledTasks}
        onAccepted={() => {
          // Refresh time blocks
          if (workspace) {
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 5);

            supabase
              .from('time_blocks')
              .select(
                `
              *,
              task:tasks(title, priority, project_id, time_estimate_minutes)
            `
              )
              .eq('workspace_id', workspace.id)
              .gte('date', formatDate(weekStart))
              .lt('date', formatDate(weekEnd))
              .then(({ data }) => {
                if (data) {
                  setTimeBlocks(data);
                }
              });
          }
          setAiDialogOpen(false);
        }}
      />
    </div>
  );
}
