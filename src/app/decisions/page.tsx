'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Decision, Workspace, Project } from '@/types'

const CONFIDENCE_COLORS = { high: 'text-green-600 bg-green-50', medium: 'text-amber-600 bg-amber-50', low: 'text-red-600 bg-red-50' }

export default function DecisionsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // form
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [chosenOption, setChosenOption] = useState('')
  const [reasoning, setReasoning] = useState('')
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium')
  const [expectedOutcome, setExpectedOutcome] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [projectId, setProjectId] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase.from('workspaces').select('*').eq('is_active', true).limit(1).single()
      if (!ws) { setLoading(false); return }
      setWorkspace(ws)
      const [{ data: decs }, { data: projs }] = await Promise.all([
        supabase.from('decisions').select('*').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
        supabase.from('projects').select('id, title').eq('workspace_id', ws.id).order('title'),
      ])
      setDecisions(decs ?? [])
      setProjects(projs ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setTitle(''); setContext(''); setChosenOption(''); setReasoning('')
    setConfidence('medium'); setExpectedOutcome(''); setReviewDate(''); setProjectId('')
    setShowForm(false)
  }

  const saveDecision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !workspace) return
    const { data } = await supabase.from('decisions').insert({
      workspace_id: workspace.id, title: title.trim(),
      context: context.trim() || null, chosen_option: chosenOption.trim() || null,
      reasoning: reasoning.trim() || null, confidence,
      expected_outcome: expectedOutcome.trim() || null,
      review_date: reviewDate || null, project_id: projectId || null,
    }).select().single()
    if (data) setDecisions(prev => [data, ...prev])
    resetForm()
  }

  const deleteDecision = async (id: string) => {
    await supabase.from('decisions').delete().eq('id', id)
    setDecisions(prev => prev.filter(d => d.id !== id))
  }

  const addOutcome = async (id: string, outcome: string) => {
    await supabase.from('decisions').update({
      actual_outcome: outcome, reviewed_at: new Date().toISOString()
    }).eq('id', id)
    setDecisions(prev => prev.map(d => d.id === id ? { ...d, actual_outcome: outcome, reviewed_at: new Date().toISOString() } : d))
  }

  if (loading) return <div className="p-10 text-zinc-400">Loading decisions...</div>

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Decision Log</h1>
          <p className="text-zinc-500 text-sm mt-1">Track decisions, reasoning & outcomes</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Log Decision
        </button>
      </div>

      {showForm && (
        <form onSubmit={saveDecision} className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Decision *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What was decided?"
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Context</label>
            <textarea value={context} onChange={e => setContext(e.target.value)} rows={2} placeholder="What led to this decision?"
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Chosen Option</label>
              <input value={chosenOption} onChange={e => setChosenOption(e.target.value)} placeholder="What did you go with?"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Confidence</label>
              <select value={confidence} onChange={e => setConfidence(e.target.value as 'high' | 'medium' | 'low')}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Reasoning</label>
            <textarea value={reasoning} onChange={e => setReasoning(e.target.value)} rows={2} placeholder="Why this option?"
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Expected Outcome</label>
              <input value={expectedOutcome} onChange={e => setExpectedOutcome(e.target.value)} placeholder="What should happen?"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Review Date</label>
              <input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Project</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">None</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Log Decision</button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-zinc-500 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {decisions.map(d => {
          const conf = d.confidence ? CONFIDENCE_COLORS[d.confidence] : ''
          const expanded = expandedId === d.id
          return (
            <div key={d.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <button onClick={() => setExpandedId(expanded ? null : d.id)}
                className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-zinc-900">{d.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {new Date(d.created_at).toLocaleDateString()}
                    {d.chosen_option && ` · ${d.chosen_option}`}
                  </div>
                </div>
                {d.confidence && <span className={`text-xs px-2 py-0.5 rounded-full ${conf}`}>{d.confidence}</span>}
                {d.actual_outcome && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Reviewed</span>}
                <span className="text-zinc-300 text-sm">{expanded ? '▲' : '▼'}</span>
              </button>

              {expanded && (
                <div className="px-5 pb-4 border-t border-zinc-100 pt-4 space-y-3 text-sm">
                  {d.context && <div><span className="text-zinc-400 text-xs block mb-0.5">Context</span><span className="text-zinc-700">{d.context}</span></div>}
                  {d.reasoning && <div><span className="text-zinc-400 text-xs block mb-0.5">Reasoning</span><span className="text-zinc-700">{d.reasoning}</span></div>}
                  {d.expected_outcome && <div><span className="text-zinc-400 text-xs block mb-0.5">Expected Outcome</span><span className="text-zinc-700">{d.expected_outcome}</span></div>}
                  {d.actual_outcome && <div><span className="text-zinc-400 text-xs block mb-0.5">Actual Outcome</span><span className="text-zinc-700">{d.actual_outcome}</span></div>}
                  {d.review_date && !d.actual_outcome && <div className="text-xs text-zinc-400">Review scheduled: {d.review_date}</div>}

                  {!d.actual_outcome && (
                    <div className="pt-2">
                      <button onClick={() => {
                        const outcome = prompt('What actually happened?')
                        if (outcome) addOutcome(d.id, outcome)
                      }} className="text-xs text-indigo-600 hover:underline">+ Record Outcome</button>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => deleteDecision(d.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {decisions.length === 0 && !showForm && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-lg mb-1">No decisions logged</p>
          <p className="text-sm">Start logging decisions to build an institutional memory</p>
        </div>
      )}
    </div>
  )
}
