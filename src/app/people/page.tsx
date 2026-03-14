'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Person, Commitment, Workspace } from '@/types'

export default function PeoplePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [showCommitForm, setShowCommitForm] = useState(false)

  // person form
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [team, setTeam] = useState('')
  const [workingStyle, setWorkingStyle] = useState('')
  const [commPref, setCommPref] = useState('')

  // commitment form
  const [commitDesc, setCommitDesc] = useState('')
  const [commitDirection, setCommitDirection] = useState<'i_owe_them' | 'they_owe_me'>('i_owe_them')
  const [commitDue, setCommitDue] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase.from('workspaces').select('*').eq('is_active', true).limit(1).single()
      if (!ws) { setLoading(false); return }
      setWorkspace(ws)

      const [{ data: ppl }, { data: cmts }] = await Promise.all([
        supabase.from('people').select('*').eq('workspace_id', ws.id).order('name'),
        supabase.from('commitments').select('*, person:people(name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
      ])
      setPeople(ppl ?? [])
      setCommitments(cmts ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const resetPersonForm = () => {
    setName(''); setRole(''); setTeam(''); setWorkingStyle(''); setCommPref('')
    setShowForm(false); setEditingId(null)
  }

  const startEdit = (p: Person) => {
    setName(p.name); setRole(p.role ?? ''); setTeam(p.team ?? '')
    setWorkingStyle(p.working_style ?? ''); setCommPref(p.communication_preference ?? '')
    setEditingId(p.id); setShowForm(true)
  }

  const savePerson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !workspace) return
    const payload = {
      workspace_id: workspace.id, name: name.trim(),
      role: role.trim() || null, team: team.trim() || null,
      working_style: workingStyle.trim() || null,
      communication_preference: commPref.trim() || null,
    }
    if (editingId) {
      const { data } = await supabase.from('people').update(payload).eq('id', editingId).select().single()
      if (data) setPeople(prev => prev.map(p => p.id === editingId ? data : p))
    } else {
      const { data } = await supabase.from('people').insert(payload).select().single()
      if (data) setPeople(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    }
    resetPersonForm()
  }

  const deletePerson = async (id: string) => {
    await supabase.from('people').delete().eq('id', id)
    setPeople(prev => prev.filter(p => p.id !== id))
    if (selectedPerson === id) setSelectedPerson(null)
  }

  const saveCommitment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commitDesc.trim() || !selectedPerson || !workspace) return
    const { data } = await supabase.from('commitments').insert({
      workspace_id: workspace.id, description: commitDesc.trim(),
      direction: commitDirection, person_id: selectedPerson,
      due_date: commitDue || null, status: 'open',
    }).select('*, person:people(name)').single()
    if (data) setCommitments(prev => [data, ...prev])
    setCommitDesc(''); setCommitDue(''); setShowCommitForm(false)
  }

  const toggleCommitment = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'fulfilled' ? 'open' : 'fulfilled'
    await supabase.from('commitments').update({
      status: newStatus, fulfilled_at: newStatus === 'fulfilled' ? new Date().toISOString() : null
    }).eq('id', id)
    setCommitments(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))
  }

  const personCommitments = commitments.filter(c => c.person_id === selectedPerson)
  const selected = people.find(p => p.id === selectedPerson)

  if (loading) return <div className="p-10 text-zinc-400">Loading people...</div>

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">People</h1>
          <p className="text-zinc-500 text-sm mt-1">Stakeholders, team members & commitments</p>
        </div>
        <button onClick={() => { resetPersonForm(); setShowForm(true) }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Person
        </button>
      </div>

      {showForm && (
        <form onSubmit={savePerson} className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Role</label>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Engineering Lead"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Team</label>
              <input value={team} onChange={e => setTeam(e.target.value)} placeholder="e.g. Platform"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Working Style</label>
              <input value={workingStyle} onChange={e => setWorkingStyle(e.target.value)} placeholder="e.g. Prefers async, detail-oriented"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Communication Preference</label>
              <input value={commPref} onChange={e => setCommPref(e.target.value)} placeholder="e.g. Slack DM, prefers morning"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              {editingId ? 'Update' : 'Add'} Person
            </button>
            <button type="button" onClick={resetPersonForm} className="px-4 py-2 text-zinc-500 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* People list */}
        <div className="col-span-1 space-y-2">
          {people.map(p => (
            <button key={p.id} onClick={() => setSelectedPerson(p.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                selectedPerson === p.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-zinc-200 hover:border-zinc-300'
              }`}>
              <div className="font-medium text-sm text-zinc-900">{p.name}</div>
              {p.role && <div className="text-xs text-zinc-500">{p.role}</div>}
              {p.team && <div className="text-xs text-zinc-400">{p.team}</div>}
            </button>
          ))}
          {people.length === 0 && <p className="text-sm text-zinc-400 text-center py-8">No people added yet</p>}
        </div>

        {/* Detail panel */}
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">{selected.name}</h2>
                  {selected.role && <p className="text-sm text-zinc-500">{selected.role}{selected.team ? ` · ${selected.team}` : ''}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(selected)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                  <button onClick={() => deletePerson(selected.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              </div>

              {(selected.working_style || selected.communication_preference) && (
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  {selected.working_style && (
                    <div className="bg-zinc-50 rounded-lg p-3">
                      <div className="text-xs text-zinc-400 mb-1">Working Style</div>
                      <div className="text-zinc-700">{selected.working_style}</div>
                    </div>
                  )}
                  {selected.communication_preference && (
                    <div className="bg-zinc-50 rounded-lg p-3">
                      <div className="text-xs text-zinc-400 mb-1">Communication</div>
                      <div className="text-zinc-700">{selected.communication_preference}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Commitments */}
              <div className="border-t border-zinc-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-700">Commitments</h3>
                  <button onClick={() => setShowCommitForm(!showCommitForm)}
                    className="text-xs text-indigo-600 hover:underline">+ Add</button>
                </div>

                {showCommitForm && (
                  <form onSubmit={saveCommitment} className="bg-zinc-50 rounded-lg p-4 mb-3 space-y-3">
                    <input value={commitDesc} onChange={e => setCommitDesc(e.target.value)}
                      placeholder="What's the commitment?" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                    <div className="flex gap-3">
                      <select value={commitDirection} onChange={e => setCommitDirection(e.target.value as 'i_owe_them' | 'they_owe_me')}
                        className="px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white">
                        <option value="i_owe_them">I owe them</option>
                        <option value="they_owe_me">They owe me</option>
                      </select>
                      <input type="date" value={commitDue} onChange={e => setCommitDue(e.target.value)}
                        className="px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                      <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">Save</button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {personCommitments.map(c => (
                    <div key={c.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                      c.status === 'fulfilled' ? 'bg-green-50' : c.direction === 'i_owe_them' ? 'bg-amber-50' : 'bg-blue-50'
                    }`}>
                      <button onClick={() => toggleCommitment(c.id, c.status)}
                        className={`w-4 h-4 rounded border flex-shrink-0 ${c.status === 'fulfilled' ? 'bg-green-500 border-green-500' : 'border-zinc-300'}`} />
                      <span className={c.status === 'fulfilled' ? 'line-through text-zinc-400' : 'text-zinc-700'}>{c.description}</span>
                      <span className="ml-auto text-xs text-zinc-400">
                        {c.direction === 'i_owe_them' ? '→ I owe' : '← They owe'}
                        {c.due_date && ` · ${c.due_date}`}
                      </span>
                    </div>
                  ))}
                  {personCommitments.length === 0 && <p className="text-xs text-zinc-400">No commitments tracked</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-zinc-400">
              <p className="text-sm">Select a person to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
