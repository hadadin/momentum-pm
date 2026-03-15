'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Task, TimeBlock, Workspace, PRIORITY_CONFIG } from '@/types';
// Inline SVG icons
function ChevronLeft({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
}
function ChevronRight({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
}
function XIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}

// Helper function to get the Sunday of the current week
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper function to format date range for display
function formatDateRange(startDate: Date): string {
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + 4); // Thursday is 4 days after Sunday

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

// Days of the work week (Sunday-Thursday for Israel)
const WORK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

// Hours from 09:00 to 18:00
const HOURS = Array.from({ length: 10 }, (_, i) => {
  const hour = 9 + i;
  return `${String(hour).padStart(2, '0')}:00`;
});

type ScheduledTask = Task & {
  timeBlock: TimeBlock;
};

export default function PlanningPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  // Get current workspace
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

      // Fetch all non-done tasks without parent_task_id
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('status', 'done', { negate: true })
        .is('parent_task_id', null)
        .order('priority', { ascending: true });

      // Fetch time blocks for this week
      const { data: timeBlocksData } = await supabase
        .from('time_blocks')
        .select('*')
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

      // Refresh time blocks
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 5);

      const { data: updatedTimeBlocks } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('workspace_id', workspace.id)
        .gte('date', formatDate(weekStart))
        .lt('date', formatDate(weekEnd));

      if (updatedTimeBlocks) {
        setTimeBlocks(updatedTimeBlocks);
      }

      setSelectedTask(null);
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
    if (!config) return 'bg-zinc-200 text-zinc-900';
    return `${config.bg} ${config.color}`;
  };

  const getTaskCardColor = (priority: string): string => {
    const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG];
    if (!config) return 'bg-zinc-100 border-zinc-300';
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
        <div className="text-zinc-600">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900 mb-4">Weekly Schedule</h1>

        {/* Navigation */}
        <div className="flex items-center justify-between bg-white rounded-xl p-4 border border-zinc-200 shadow-sm">
          <button
            onClick={handlePreviousWeek}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <span className="text-lg font-semibold text-zinc-700">
            {formatDateRange(weekStart)}
          </span>

          <button
            onClick={handleNextWeek}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Layout: Left Panel + Right Panel */}
      <div className="flex gap-6">
        {/* Left Panel: Unscheduled Tasks */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3">
              <h2 className="text-lg font-semibold text-white">Unscheduled Tasks</h2>
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-220px)] p-4 space-y-2">
              {unscheduledTasks.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <p className="text-sm">All tasks scheduled!</p>
                </div>
              ) : (
                unscheduledTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() =>
                      setSelectedTask(selectedTask?.id === task.id ? null : task)
                    }
                    className={`w-full text-left p-3 rounded-lg border-2 transition ${
                      selectedTask?.id === task.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-zinc-200 bg-zinc-50 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 text-sm line-clamp-2">
                          {task.title}
                        </p>
                        {task.time_estimate_minutes && (
                          <p className="text-xs text-zinc-600 mt-1">
                            {Math.ceil(task.time_estimate_minutes / 60)}h est.
                          </p>
                        )}
                      </div>
                      <span
                        className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getTaskColor(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Weekly Grid */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            {/* Grid Header with Hours */}
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* Time header */}
                <div className="flex border-b border-zinc-200">
                  <div className="w-32 flex-shrink-0 bg-zinc-50 px-4 py-3 border-r border-zinc-200" />
                  {HOURS.map((hour, idx) => (
                    <div
                      key={hour}
                      className={`w-24 flex-shrink-0 px-3 py-3 text-center text-sm font-medium ${
                        idx === currentHourIndex
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-zinc-50 text-zinc-700 border-r border-zinc-200'
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
                    <div key={day} className="flex border-b border-zinc-200 last:border-b-0">
                      {/* Day label */}
                      <div className="w-32 flex-shrink-0 bg-zinc-50 px-4 py-3 border-r border-zinc-200">
                        <p className="font-semibold text-zinc-900 text-sm">{day}</p>
                        <p className="text-xs text-zinc-600 mt-1">
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
                            onClick={() => {
                              if (selectedTask) {
                                handleScheduleTask(selectedTask, dayIndex, hour);
                              }
                            }}
                            className={`w-24 flex-shrink-0 min-h-20 p-2 border-r border-zinc-200 cursor-pointer transition relative ${
                              selectedTask
                                ? 'hover:bg-indigo-100'
                                : 'hover:bg-zinc-100'
                            } ${
                              hourIdx === currentHourIndex
                                ? 'bg-indigo-50'
                                : 'bg-white'
                            }`}
                          >
                            {/* Task cards in this slot */}
                            <div className="space-y-1 h-full flex flex-col justify-start">
                              {tasksInSlot.map((st) => (
                                <div
                                  key={st.id}
                                  className={`text-xs p-1.5 rounded-md border border-current truncate relative group ${getTaskCardColor(
                                    st.priority
                                  )}`}
                                >
                                  <div className="flex items-start gap-1">
                                    <span className="flex-1 line-clamp-2">
                                      {st.title}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnscheduleTask(st.timeBlock.id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 transition flex-shrink-0 ml-1"
                                    >
                                      <XIcon className="w-3 h-3 text-current" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Visual indicator when task is selected */}
                            {selectedTask && (
                              <div className="absolute inset-0 rounded border-2 border-indigo-400 pointer-events-none opacity-20" />
                            )}
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

      {/* Selected Task Indicator */}
      {selectedTask && (
        <div className="fixed bottom-6 right-6 bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <p className="text-sm font-medium">
            Click on a time slot to schedule: <span className="font-semibold">{selectedTask.title}</span>
          </p>
        </div>
      )}
    </div>
  );
}
