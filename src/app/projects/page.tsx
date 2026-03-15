'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Project, Workspace, ProjectPhase } from '@/types'
import ProjectFormDialog from '@/components/forms/ProjectFormDialog'

const PHASE_ORDER: ProjectPhase[] = ['discovery', 'grooming', 'development', 'testing', 'launched', 'archived']

const PHASE_CONFIG: Record<ProjectPhase, { label: string; borderColor: string }> = {
  discovery:   { label: 'Discovery',   borderColor: 'border-t-purple-500' },
  grooming:    { label: 'Grooming',    borderColor: 'border-t-blue-500' },
  development: { label: 'Development', borderColor: 'border-t-amber-500' },
  testing:     { label: 'Testing',     borderColor: 'border-t-orange-500' },
  launched:    { label: 'Launched',    borderColor: 'border-t-green-500' },
  archived:    { label: 'Archived',    borderColor: 'border-t-zinc-400' },
}

export default function ProjectsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase
        .from('workspaces').select('*').eq('is_active', true).limit(1).maybeSingle()
      if (!ws) { setLoading(false); return }
      setWorkspace(ws)

      const { data: projectData } = await supabase
        .from('projects').select('*').eq('workspace_id', ws.id).order('created_at', { ascending: false })
      setProjects(projectData ?? [])

      // fetch task counts per project
      const { data: tasks } = await supabase
        .from('tasks').select('project_id').eq('workspace_id', ws.id).not('project_id', 'is', null)
      const counts: Record<string, number> = {}
      for (const t of (tasks ?? [])) {
        if (t.project_id) counts[t.project_id] = (counts[t.project_id] ?? 0) + 1
      }
      setTaskCounts(counts)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingProject(null)
  }

  const handleFormSaved = () => {
    handleFormClose()
    fetchData()
  }

  const handleCardClick = (project: Project) => {
    setEditingProject(project)
    setFormOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
          <p>Loading projects...</p>
        </div>
      </div>
    )
  }

  if (!workspace) {
    return <div className="p-10 text-center text-zinc-400">No workspace found</div>
  }

  // Group projects by phase
  const projectsByPhase: Record<ProjectPhase, Project[]> = {
    discovery: [], grooming: [], development: [], testing: [], launched: [], archived: []
  }
  projects.forEach(p => {
    projectsByPhase[p.phase].push(p)
  })

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Projects</h1>
          </div>
          <button
            onClick={() => {
              setEditingProject(null)
              setFormOpen(true)
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Project
          </button>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PHASE_ORDER.map(phase => {
            const phaseProjects = projectsByPhase[phase]
            const config = PHASE_CONFIG[phase]

            return (
              <div key={phase} className="flex flex-col">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-zinc-700">{config.label}</h2>
                  <span className="text-xs font-medium text-zinc-500 bg-zinc-200 px-2.5 py-1 rounded-full">
                    {phaseProjects.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 flex-1">
                  {phaseProjects.length === 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-lg p-4 text-center text-sm text-zinc-400 h-32 flex items-center justify-center">
                      No projects
                    </div>
                  ) : (
                    phaseProjects.map(p => {
                      const taskCount = taskCounts[p.id] ?? 0

                      return (
                        <button
                          key={p.id}
                          onClick={() => handleCardClick(p)}
                          className={`${config.borderColor} border-t-4 bg-white border border-zinc-200 rounded-lg p-4 text-left hover:shadow-md transition-shadow cursor-pointer group`}
                        >
                          {/* Title with color dot */}
                          <div className="flex items-start gap-2.5 mb-2.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                              style={{ backgroundColor: p.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-zinc-900 text-sm break-words">{p.title}</h3>
                            </div>
                          </div>

                          {/* Description */}
                          {p.description && (
                            <p className="text-xs text-zinc-500 line-clamp-1 mb-3 ml-4.5">{p.description}</p>
                          )}

                          {/* Metadata */}
                          <div className="flex items-center gap-2 text-xs text-zinc-400 ml-4.5">
                            {p.due_date && (
                              <>
                                <span>📅 {p.due_date}</span>
                              </>
                            )}
                            {taskCount > 0 && (
                              <span className="text-indigo-600 font-medium">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Project Form Dialog */}
      {workspace && (
        <ProjectFormDialog
          open={formOpen}
          onClose={handleFormClose}
          project={editingProject}
          workspaceId={workspace.id}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  )
}
