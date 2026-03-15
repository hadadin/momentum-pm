'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Meeting, Workspace, Project } from '@/types'
import MeetingFormDialog from '@/components/forms/MeetingFormDialog'

type MeetingStatus = 'pending' | 'processed' | 'tasks_created'

interface MeetingWithExtras extends Meeting {
  status?: MeetingStatus
  project_id?: string
  extracted_action_items?: unknown[]
}

const STATUS_CONFIG: Record<MeetingStatus, { label: string; bg: string; text: string }> = {
  pending:      { label: 'Pending',        bg: 'bg-zinc-100',   text: 'text-zinc-600' },
  processed:    { label: 'Processed',      bg: 'bg-blue-100',   text: 'text-blue-700' },
  tasks_created: { label: 'Tasks Created', bg: 'bg-green-100',  text: 'text-green-700' },
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function groupMeetingsByRecency(meetings: MeetingWithExtras[]): Record<string, MeetingWithExtras[]> {
  const now = new Date()
  const weekStart = getWeekStart(now)
  const monthStart = getMonthStart(now)

  const weekStartStr = weekStart.toISOString().split('T')[0]
  const monthStartStr = monthStart.toISOString().split('T')[0]

  const groups: Record<string, MeetingWithExtras[]> = {
    'This Week': [],
    'This Month': [],
    'Older': [],
  }

  meetings.forEach(m => {
    const meetingDate = m.date || ''
    if (meetingDate >= weekStartStr) {
      groups['This Week'].push(m)
    } else if (meetingDate >= monthStartStr) {
      groups['This Month'].push(m)
    } else {
      groups['Older'].push(m)
    }
  })

  return groups
}

export default function MeetingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [meetings, setMeetings] = useState<MeetingWithExtras[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<MeetingWithExtras | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase
        .from('workspaces').select('*').eq('is_active', true).limit(1).maybeSingle()
      if (!ws) { setLoading(false); return }
      setWorkspace(ws)

      const [meetingsRes, projectsRes] = await Promise.all([
        supabase.from('meetings').select('*').eq('workspace_id', ws.id).order('date', { ascending: false }),
        supabase.from('projects').select('*').eq('workspace_id', ws.id),
      ])

      setMeetings((meetingsRes.data ?? []) as MeetingWithExtras[])
      setProjects(projectsRes.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingMeeting(null)
  }

  const handleFormSaved = () => {
    handleFormClose()
    fetchData()
  }

  const handleMeetingClick = (meeting: MeetingWithExtras) => {
    setEditingMeeting(meeting)
    setFormOpen(true)
  }

  const getProjectBadgeColor = (phase?: string): string => {
    const phaseColorMap: Record<string, string> = {
      discovery:   'bg-purple-100 text-purple-700',
      grooming:    'bg-blue-100 text-blue-700',
      development: 'bg-amber-100 text-amber-700',
      testing:     'bg-orange-100 text-orange-700',
      launched:    'bg-green-100 text-green-700',
      archived:    'bg-zinc-100 text-zinc-600',
    }
    return phase && phase in phaseColorMap ? phaseColorMap[phase] : 'bg-zinc-100 text-zinc-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
          <p>Loading meetings...</p>
        </div>
      </div>
    )
  }

  if (!workspace) {
    return <div className="p-10 text-center text-zinc-400">No workspace found</div>
  }

  const groupedMeetings = groupMeetingsByRecency(meetings)
  const hasAnyMeetings = Object.values(groupedMeetings).some(g => g.length > 0)

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Meetings</h1>
          </div>
          <button
            onClick={() => {
              setEditingMeeting(null)
              setFormOpen(true)
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Meeting
          </button>
        </div>

        {/* Meetings List */}
        {hasAnyMeetings ? (
          <div className="space-y-6">
            {Object.entries(groupedMeetings).map(([groupName, groupMeetings]) => {
              if (groupMeetings.length === 0) return null

              return (
                <div key={groupName}>
                  <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4 px-1">
                    {groupName}
                  </h2>

                  <div className="space-y-3">
                    {groupMeetings.map(m => {
                      const isExpanded = expandedId === m.id
                      const actionItemCount = (m.action_items ?? []).length
                      const extractedCount = (m.extracted_action_items ?? []).length
                      const linkedProject = projects.find(p => p.id === m.project_id)
                      const status = (m.status as MeetingStatus) || 'pending'

                      return (
                        <div
                          key={m.id}
                          className="bg-white border border-zinc-200 rounded-lg overflow-hidden hover:border-zinc-300 transition-colors"
                        >
                          {/* Card Header */}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : m.id)}
                            className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-zinc-50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-zinc-900">{m.title}</h3>
                              <div className="text-xs text-zinc-500 mt-1.5 flex flex-wrap items-center gap-2">
                                <span>📅 {m.date || 'No date'}</span>
                                {m.attendees && m.attendees.length > 0 && (
                                  <>
                                    <span>·</span>
                                    <span>{m.attendees.slice(0, 2).join(', ')}{m.attendees.length > 2 ? ` +${m.attendees.length - 2}` : ''}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Badges */}
                            <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                              {/* Status Badge */}
                              <span className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].text}`}>
                                {STATUS_CONFIG[status].label}
                              </span>

                              {/* Project Badge */}
                              {linkedProject && (
                                <span className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${getProjectBadgeColor(linkedProject.phase)}`}>
                                  {linkedProject.title}
                                </span>
                              )}

                              {/* Action Items Badge */}
                              {actionItemCount > 0 && (
                                <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 font-medium whitespace-nowrap">
                                  {actionItemCount} action{actionItemCount !== 1 ? 's' : ''}
                                </span>
                              )}

                              {/* Extracted Action Items Badge */}
                              {extractedCount > 0 && (
                                <span className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 font-medium whitespace-nowrap">
                                  {extractedCount} extracted
                                </span>
                              )}

                              {/* Expand/Collapse Indicator */}
                              <span className="text-zinc-300 text-sm ml-1">
                                {isExpanded ? (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </span>
                            </div>
                          </button>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="border-t border-zinc-100 px-5 py-4 space-y-4 text-sm bg-zinc-50">
                              {/* Notes Preview */}
                              {m.raw_notes && (
                                <div>
                                  <p className="text-xs font-semibold text-zinc-500 mb-2">Notes</p>
                                  <p className="text-xs text-zinc-600 line-clamp-2 whitespace-pre-wrap font-mono bg-white border border-zinc-200 rounded p-3">
                                    {m.raw_notes}
                                  </p>
                                </div>
                              )}

                              {/* Summary */}
                              {m.summary && (
                                <div>
                                  <p className="text-xs font-semibold text-zinc-500 mb-2">Summary</p>
                                  <p className="text-xs text-zinc-600">{m.summary}</p>
                                </div>
                              )}

                              {/* Action Items */}
                              {m.action_items && m.action_items.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-zinc-500 mb-2">Action Items ({actionItemCount})</p>
                                  <div className="space-y-2">
                                    {m.action_items.map((item, idx) => (
                                      <div key={idx} className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
                                        <p className="text-zinc-700 font-medium">{(item as any).description || item}</p>
                                        {(item as any).owner && <p className="text-zinc-500 mt-1">Owner: {(item as any).owner}</p>}
                                        {(item as any).due_date && <p className="text-zinc-500">Due: {(item as any).due_date}</p>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Footer Actions */}
                              <div className="flex gap-3 pt-2 border-t border-zinc-200">
                                <button
                                  onClick={() => handleMeetingClick(m)}
                                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-zinc-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium">No meetings recorded</p>
            <p className="text-sm mt-1">Create a meeting to capture notes and action items</p>
          </div>
        )}
      </div>

      {/* Meeting Form Dialog */}
      {workspace && (
        <MeetingFormDialog
          open={formOpen}
          onClose={handleFormClose}
          meeting={editingMeeting}
          workspaceId={workspace.id}
          projects={projects}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  )
}
