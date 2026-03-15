'use client';

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { KpiEntry } from '@/types';
import { supabase } from '@/lib/supabase';

interface KpiFormDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  onSaved: () => void;
}

type TrendType = 'up' | 'down' | 'neutral';

export default function KpiFormDialog({
  open,
  onClose,
  workspaceId,
  onSaved,
}: KpiFormDialogProps) {
  const [metricName, setMetricName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [previousValue, setPreviousValue] = useState('');
  const [unit, setUnit] = useState('');
  const [trend, setTrend] = useState<TrendType>('neutral');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setMetricName('');
      setCurrentValue('');
      setPreviousValue('');
      setUnit('');
      setTrend('neutral');
      setDate(new Date().toISOString().split('T')[0]);
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metricName.trim()) {
      setError('Metric name is required');
      return;
    }
    if (!currentValue) {
      setError('Current value is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const kpiData = {
        workspace_id: workspaceId,
        metric_name: metricName.trim(),
        current_value: parseFloat(currentValue),
        previous_value: previousValue ? parseFloat(previousValue) : null,
        unit: unit.trim() || null,
        trend,
        date: date || null,
      };

      const { error: insertError } = await supabase.from('kpi_entries').insert([kpiData]);

      if (insertError) throw insertError;

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add KPI entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add KPI Entry"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Metric Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Metric Name
          </label>
          <input
            type="text"
            value={metricName}
            onChange={(e) => setMetricName(e.target.value)}
            placeholder="e.g. Monthly Revenue, User Growth"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Current & Previous Value */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Value
            </label>
            <input
              type="number"
              step="0.01"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Previous Value
            </label>
            <input
              type="number"
              step="0.01"
              value={previousValue}
              onChange={(e) => setPreviousValue(e.target.value)}
              placeholder="0.00 (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Unit & Trend */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. %, $, users"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trend
            </label>
            <select
              value={trend}
              onChange={(e) => setTrend(e.target.value as TrendType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="up">Up</option>
              <option value="down">Down</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Adding...' : 'Add KPI'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
