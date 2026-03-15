// ============================================================
// PM OS — TypeScript Types
// Auto-generated from Supabase schema (Momentum PM v2)
// ============================================================

export type TaskStatus = 'backlog' | 'today' | 'in_progress' | 'blocked' | 'done'
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'
export type ProjectPhase = 'discovery' | 'grooming' | 'development' | 'testing' | 'launched' | 'archived'

export interface Workspace {
  id: string
  name: string
  description?: string
  instance_path?: string
  is_active: boolean
  work_start_hour?: number
  work_end_hour?: number
  week_starts_on?: number
  default_task_duration?: number
  show_weekends?: boolean
  created_at: string
}

export interface Task {
  id: string
  workspace_id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  project_id?: string
  bet_id?: string
  time_estimate_minutes?: number
  time_actual_minutes: number
  scheduled_date?: string
  scheduled_hour?: number
  due_date?: string
  source: 'manual' | 'chat' | 'meeting' | 'agent' | 'integration'
  tags: string[]
  is_recurring: boolean
  recurring_rule?: Record<string, unknown>
  created_at: string
  completed_at?: string
  parent_task_id?: string
  focused_time_spent?: number
  // joined relations
  project?: { title: string; color: string } | null
  subtasks?: Subtask[]
}

export interface Project {
  id: string
  workspace_id: string
  title: string
  description?: string
  phase: ProjectPhase
  color: string
  due_date?: string
  bet_id?: string
  created_at: string
}

export interface Outcome {
  id: string
  workspace_id: string
  title: string
  description?: string
  target_metric?: string
  target_value?: number
  current_value?: number
  deadline?: string
  status: 'active' | 'achieved' | 'abandoned' | 'paused'
  created_at: string
}

export interface Bet {
  id: string
  outcome_id?: string
  title: string
  description?: string
  hypothesis?: string
  confidence: 'high' | 'medium' | 'low'
  status: 'exploring' | 'committed' | 'shipped' | 'evaluated'
  success_criteria?: string
  created_at: string
}

export interface Person {
  id: string
  workspace_id: string
  name: string
  role?: string
  team?: string
  working_style?: string
  communication_preference?: string
  last_interaction?: string
  created_at: string
}

export interface Commitment {
  id: string
  workspace_id: string
  description: string
  direction: 'i_owe_them' | 'they_owe_me'
  person_id?: string
  project_id?: string
  due_date?: string
  status: 'open' | 'fulfilled' | 'overdue' | 'cancelled'
  created_at: string
  fulfilled_at?: string
  person?: { name: string } | null
}

export interface Decision {
  id: string
  workspace_id: string
  title: string
  context?: string
  options_considered?: Array<{ option: string; pros: string; cons: string }>
  chosen_option?: string
  reasoning?: string
  confidence?: 'high' | 'medium' | 'low'
  expected_outcome?: string
  actual_outcome?: string
  review_date?: string
  project_id?: string
  created_at: string
  reviewed_at?: string
}

export interface Meeting {
  id: string
  workspace_id: string
  title: string
  date?: string
  attendees?: string[]
  raw_notes?: string
  summary?: string
  action_items?: Array<{ description: string; owner: string; due_date?: string; task_id?: string }>
  project_ids?: string[]
  created_at: string
}

export interface KpiEntry {
  id: string
  workspace_id: string
  metric_name: string
  value: number
  previous_value?: number
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
  is_favorite?: boolean
  display_order?: number
  date: string
  source: 'manual' | 'chat' | 'integration' | 'agent'
  notes?: string
  created_at: string
}

export interface DailyPlan {
  id: string
  workspace_id: string
  date: string
  shutdown_time?: string
  top_3?: string[]
  reflection?: string
  wins?: string[]
  energy_level?: 'high' | 'medium' | 'low'
  created_at: string
}

export interface WeeklyReview {
  id: string
  workspace_id: string
  week_start: string
  goals_set?: string[]
  goals_achieved?: string[]
  time_by_project?: Record<string, number>
  tasks_completed?: number
  tasks_planned?: number
  estimation_accuracy?: number
  key_learnings?: string[]
  next_week_focus?: string[]
  created_at: string
}

export interface ChatMessage {
  id: string
  workspace_id: string
  role: 'user' | 'assistant'
  content: string
  parsed_actions?: Record<string, unknown>
  created_at: string
}

export interface Goal {
  id: string
  workspace_id: string
  type: 'weekly' | 'daily'
  text: string
  completed: boolean
  linked_task_id?: string
  date: string
  created_at: string
}

export interface TimeBlock {
  id: string
  workspace_id: string
  task_id: string
  date: string
  start_time: string
  end_time: string
  created_at: string
  task?: { title: string; priority: TaskPriority; project_id?: string; time_estimate_minutes?: number } | null
}

export interface Subtask {
  id: string
  task_id: string
  title: string
  completed: boolean
  created_at: string
}

// ============================================================
// UI helpers
// ============================================================

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; border: string; bg: string; dot: string }> = {
  critical: { label: 'Critical', color: 'text-red-600', border: 'border-l-red-500', bg: 'bg-red-50', dot: 'bg-red-500' },
  high:     { label: 'High',     color: 'text-orange-600', border: 'border-l-orange-400', bg: 'bg-orange-50', dot: 'bg-orange-400' },
  medium:   { label: 'Medium',   color: 'text-blue-600', border: 'border-l-blue-400', bg: 'bg-blue-50', dot: 'bg-blue-400' },
  low:      { label: 'Low',      color: 'text-zinc-400', border: 'border-l-zinc-300', bg: 'bg-zinc-50', dot: 'bg-zinc-300' },
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; textColor: string; bgColor: string }> = {
  backlog:     { label: 'Backlog',     textColor: 'text-zinc-500',   bgColor: 'bg-zinc-100' },
  today:       { label: 'Today',       textColor: 'text-blue-600',   bgColor: 'bg-blue-100' },
  in_progress: { label: 'In Progress', textColor: 'text-amber-700',  bgColor: 'bg-amber-100' },
  blocked:     { label: 'Blocked',     textColor: 'text-red-600',    bgColor: 'bg-red-100' },
  done:        { label: 'Done',        textColor: 'text-green-700',  bgColor: 'bg-green-100' },
}
