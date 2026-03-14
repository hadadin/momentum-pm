'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Meeting, Workspace } from '@/types'

export default function MeetingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // form
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [attendees, setAttendees] = useState('')
  const [rawNotes, setRawNotes] = useState('')
  const [summary, setSummary] = useState('')
  const [actionItems, setActionItems] = useState<Array<{ description: string; owner: string; due_date?: string }>>([])

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase.from('workspaces').select('*').eq('is_active', true).limit(1).single()
      if (!ws) { setLoading(false); return }
      setWorkspace(ws)
      const { data } = await supabase.from('meetings').select('*').eq('workspace_id', ws.id).order('date', { ascending: false })
      setMeetings(data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setTitle(''); setDate(new Date().toISOString().split('T')[0]); setAttendees('')
    setRawNotes(''); setSummary(''); setActionItems([]); setShowForm(false); setEditingId(null)
  }

  const startEdit = (m: Meeting) => {
    setTitle(m.title); setDate(m.date ?? new Date().toISOString().split('T')[0])
    setAttendees((m.attendees ?? []).join(', ')); setRawNotes(m.raw_notes ?? '')
    setSummary(m.summary ?? ''); setActionItems(m.action_items ?? [])
    setEditingId(m.id); setShowForm(true)
  }

  const saveMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !workspace) return
    const payload = {
      workspace_id: workspace.id, title: title.trim(), date,
      attendees: attendees.split(',').map(a => a.trim()).filter(Boolean),
      raw_notes: rawNotes.trim() || null, summary: summary.trim() || null,
      action_items: actionItems.length > 0 ? actionItems : null,
    }
    if (editingId) {
      const { data } = await supabase.from('meetings').update(payload).eq('id', editingId).select().single()
      if (data) setMeetings(prev => prev.map(m => m.id === editingId ? data : m))
    } else {
      const { data } = await supabase.from('meetings').insert(payload).select().single()
      if (data) setMeetings(prev => [data, ...prev])
    }
    resetForm()
  }

  const deleteMeeting = async (id: string) => {
    await supabase.from('meetings').delete().eq('id', id)
    setMeetings(prev => prev.filter(m => m.id !== id))
  }

  const addActionItem = () => setActionItems(prev => [...prev, { description: '', owner: '' }])
  const updateActionItem = (idx: number, field: string, value: string) => {
    setActionItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }
  const removeActionItem = (idx: number) => setActionItems(prev => prev.filter((_, i) => i !== idx))

  if (loading) return <div className="p-10 text-zinc-400">Loading meetings...</div>

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Meetings</h1>
          <p className="text-zinc-500 text-sm mt-1">{meetings.length} meeting{meetings.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Meeting
        </button>
      </div>

      {showForm && (
        <form onSubmit={saveMeeting} className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Meeting title"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Attendees (comma-separated)</label>
            <input value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="Alice, Bob, Charlie"
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Notes</label>
            <textarea value={rawNotes} onChange={e => setRawNotes(e.target.value)} rows={4} placeholder="Raw meeting notes..."
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Summary</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2} placeholder="Key takeaways..."
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Action Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-500">Action Items</label>
              <button type="button" onClick={addActionItem} className="text-xs text-indigo-600 hover:underline">+ Add</button>
            </div>
            <div className="space-y-2">
              {actionItems.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input value={item.description} onChange={e => updateActionItem(i, 'description', e.target.value)}
                    placeholder="Action item" className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                  <input value={item.owner} onChange={e => updateActionItem(i, 'owner', e.target.value)}
                    placeholder="Owner" className="w-32 px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                  <input type="date" value={item.due_date ?? ''} onChange={e => updateActionItem(i, 'due_date', e.target.value)}
                    className="w-36 px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                  <button type="button" onClick={() => removeActionItem(i)} className="text-red-400 hover:text-red-600 text-sm px-2">×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              {editingId ? 'Update' : 'Save'} Meeting
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-zinc-500 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {meetings.map(m => {
          const expanded = expandedId === m.id
          const aiCount = (m.action_items ?? []).length
          return (
            <div key={m.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <button onClick={() => setExpandedId(expanded ? null : m.id)}
                className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-zinc-900">{m.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {m.date}
                    {m.attendees && m.attendees.length > 0 && ` · ${m.attendees.join(', ')}`}
                  </div>
                </div>
                {aiCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{aiCount} action item{aiCount !== 1 ? 's' : ''}</span>}
                <span className="text-zinc-300 text-sm">{expanded ? '▲' : '▼'}</span>
              </button>

              {expanded && (
                <div className="px-5 pb-4 border-t border-zinc-100 pt-4 space-y-3 text-sm">
                  {m.summary && (
                    <div>
                      <span className="text-zinc-400 text-xs block mb-0.5">Summary</span>
                      <p className="text-zinc-700">{m.summary}</p>
                    </div>
                  )}
                  {m.raw_notes && (
                    <div>
                      <span className="text-zinc-400 text-xs block mb-0.5">Notes</span>
                      <pre className="text-zinc-600 text-xs bg-zinc-50 rounded-lg p-3 whitespace-pre-wrap font-mono">{m.raw_notes}</pre>
                    </div>
                  )}
                  {m.action_items && m.action_items.length > 0 && (
                    <div>
                      <span className="text-zinc-400 text-xs block mb-1">Action Items</span>
                      <div className="space-y-1">
                        {m.action_items.map((ai, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-amber-50 rounded-lg px-3 py-2">
                            <span className="text-zinc-700 flex-1">{ai.description}</span>
                            <span className="text-amber-600 font-medium">{ai.owner}</span>
                            {ai.due_date && <span className="text-zinc-400">{ai.due_date}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => startEdit(m)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                    <button onClick={() => deleteMeeting(m.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {meetings.length === 0 && !showForm && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-lg mb-1">No meetings recorded</p>
          <p className="text-sm">Start capturing meeting notes and action items</p>
        </div>
      )}
    </div>
  )
}
