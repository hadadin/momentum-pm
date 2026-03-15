'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types'

interface FocusModeProps {
  task: Task
  onClose: () => void
}

export default function FocusMode({ task, onClose }: FocusModeProps) {
  const hasEstimate = !!task.time_estimate_minutes
  const totalSeconds = hasEstimate ? task.time_estimate_minutes! * 60 : 0

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const saveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = useCallback(() => {
    setRunning(true)
    intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    // save every 10 seconds
    saveRef.current = setInterval(() => {
      supabase.from('tasks').update({
        focused_time_spent: (task.focused_time_spent ?? 0) + Math.floor(elapsed / 60)
      }).eq('id', task.id).then()
    }, 10000)
  }, [task.id, task.focused_time_spent, elapsed])

  const pauseTimer = () => {
    setRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (saveRef.current) clearInterval(saveRef.current)
  }

  const handleClose = async () => {
    pauseTimer()
    // save final time
    const mins = Math.floor(elapsed / 60)
    if (mins > 0) {
      await supabase.from('tasks').update({
        focused_time_spent: (task.focused_time_spent ?? 0) + mins
      }).eq('id', task.id)
    }
    onClose()
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (saveRef.current) clearInterval(saveRef.current)
    }
  }, [])

  // Auto-stop countdown timer
  useEffect(() => {
    if (hasEstimate && elapsed >= totalSeconds && running) {
      pauseTimer()
    }
  }, [elapsed, totalSeconds, hasEstimate, running])

  const remaining = hasEstimate ? Math.max(totalSeconds - elapsed, 0) : elapsed
  const displayMinutes = Math.floor(remaining / 60)
  const displaySeconds = remaining % 60
  const progress = hasEstimate && totalSeconds > 0 ? Math.min(elapsed / totalSeconds, 1) : 0

  // SVG circle
  const radius = 120
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Task info */}
      <div className="text-center mb-12">
        <span className="text-indigo-400 text-sm font-medium uppercase tracking-widest">Focus Mode</span>
        <h2 className="text-white text-2xl font-bold mt-2">{task.title}</h2>
        {task.project && (
          <span className="text-gray-500 text-sm mt-1 block">{task.project.title}</span>
        )}
      </div>

      {/* Timer circle */}
      <div className="relative w-72 h-72 mb-10">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 280 280">
          {/* Background circle */}
          <circle cx="140" cy="140" r={radius} fill="none" stroke="#27272a" strokeWidth="8" />
          {/* Progress circle */}
          {hasEstimate && (
            <circle
              cx="140" cy="140" r={radius} fill="none"
              stroke="#6366f1" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-1000"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white text-5xl font-mono font-bold">
            {String(displayMinutes).padStart(2, '0')}:{String(displaySeconds).padStart(2, '0')}
          </span>
          <span className="text-gray-500 text-sm mt-2">
            {hasEstimate ? (running ? 'remaining' : 'countdown') : (running ? 'elapsed' : 'stopwatch')}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={running ? pauseTimer : startTimer}
          className="w-16 h-16 bg-indigo-600 hover:bg-indigo-700 rounded-full flex items-center justify-center transition-colors"
        >
          {running ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-8 mt-10 text-center">
        <div>
          <span className="text-gray-500 text-xs block">Session</span>
          <span className="text-white text-lg font-medium">{Math.floor(elapsed / 60)}m</span>
        </div>
        <div>
          <span className="text-gray-500 text-xs block">Total focused</span>
          <span className="text-white text-lg font-medium">{(task.focused_time_spent ?? 0) + Math.floor(elapsed / 60)}m</span>
        </div>
        {hasEstimate && (
          <div>
            <span className="text-gray-500 text-xs block">Estimate</span>
            <span className="text-white text-lg font-medium">{task.time_estimate_minutes}m</span>
          </div>
        )}
      </div>
    </div>
  )
}
