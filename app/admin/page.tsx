'use client';

import { useState, useEffect } from 'react';
import { IMPLEMENT_STYLES, DECAY_DURATIONS, type ImplementType } from '@/lib/config';

interface AnalyticsStats {
  totalSessions: number;
  rotations: Array<{ from_wall: string; to_wall: string; total: number }>;
  implements: Array<{ implement: string; count: number }>;
  drawings: Array<{ wall: string; implement: string; count: number }>;
  timeline: Array<{ hour: string; count: number }>;
}

// Wall colors for visualization
const WALL_COLORS = {
  front: '#4a9eff',
  left: '#ff6b9d',
  right: '#ffc107',
} as const;

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authenticated) {
      loadStats();
    }
  }, [authenticated]);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${password}`,
        },
      });

      if (response.status === 401) {
        setAuthenticated(false);
        setError('Invalid password');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(message);
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      setAuthenticated(true);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header with icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-[#1a1c1e] to-[#141516] border border-white/10">
              <svg className="w-8 h-8 text-[#d94f30]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-2">Stall Analytics</h1>
            <p className="text-sm text-gray-500">Admin access required</p>
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="bg-gradient-to-br from-[#1a1c1e] to-[#141516] rounded-xl p-6 border border-white/5">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-3 bg-[#0a0a0a] text-white rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#d94f30] focus:border-transparent placeholder:text-gray-700 transition-all"
                autoFocus
              />
              {error && (
                <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!password}
              className="w-full px-6 py-4 bg-[#d94f30] text-white rounded-lg font-medium hover:bg-[#c43d20] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#d94f30] shadow-lg shadow-[#d94f30]/20"
            >
              Access Dashboard
            </button>
          </form>

          {/* Footer hint */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-700">
              Password set in <span className="font-mono text-gray-600">ADMIN_PASSWORD</span> env var
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalDrawings = stats?.drawings.reduce((sum, d) => sum + Number(d.count), 0) || 0;
  const totalRotations = stats?.rotations.reduce((sum, r) => sum + Number(r.total), 0) || 0;
  const drawingsPerSession = stats && stats.totalSessions > 0
    ? (totalDrawings / Number(stats.totalSessions)).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-1">Stall Analytics</h1>
            <p className="text-gray-500 text-sm">Bathroom graffiti insights</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadStats}
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-br from-[#1a1c1e] to-[#141516] border border-white/10 text-white rounded-lg hover:border-white/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={() => setAuthenticated(false)}
              className="px-4 py-2 bg-gradient-to-br from-[#1a1c1e] to-[#141516] border border-white/10 text-white rounded-lg hover:border-white/20 transition-all"
            >
              Logout
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d94f30] mx-auto mb-4"></div>
              <p className="text-gray-400">Loading analytics...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-md">
              <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-400 text-lg font-medium mb-2">Failed to load analytics</p>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          </div>
        )}

        {stats && !loading && (
          <div className="space-y-6">
            {/* Hero Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Sessions - Primary */}
              <div className="md:col-span-2 lg:col-span-2 bg-gradient-to-br from-[#1a1c1e] to-[#141516] rounded-xl p-8 border border-white/5">
                <div className="text-gray-500 text-sm uppercase tracking-wider mb-2">Total Sessions</div>
                <div className="text-6xl font-bold mb-2">{stats.totalSessions}</div>
                <div className="text-gray-400 text-sm">Unique bathroom visits</div>
              </div>

              {/* Drawings Per Session */}
              <div className="bg-gradient-to-br from-[#d94f30]/10 to-[#d94f30]/5 rounded-xl p-6 border border-[#d94f30]/20">
                <div className="text-gray-500 text-sm uppercase tracking-wider mb-2">Avg per Session</div>
                <div className="text-4xl font-bold text-[#d94f30] mb-1">{drawingsPerSession}</div>
                <div className="text-gray-400 text-xs">Drawings per visit</div>
              </div>

              {/* Total Drawings */}
              <div className="bg-gradient-to-br from-[#1a1c1e] to-[#141516] rounded-xl p-6 border border-white/5">
                <div className="text-gray-500 text-sm uppercase tracking-wider mb-2">Drawings</div>
                <div className="text-4xl font-bold mb-1">{totalDrawings}</div>
                <div className="text-gray-400 text-xs">Total graffiti submitted</div>
              </div>
            </div>

            {/* Implement Usage */}
            <div className="bg-gradient-to-br from-[#1a1c1e] to-[#141516] rounded-xl p-6 border border-white/5">
              <h2 className="text-xl font-bold mb-6">Implement Usage</h2>
              {stats.implements.length > 0 ? (
                <div className="space-y-4">
                  {stats.implements.map((impl, i) => {
                    const implementKey = impl.implement as ImplementType;
                    const color = IMPLEMENT_STYLES[implementKey]?.color || '#888888';
                    const decayMs = DECAY_DURATIONS[implementKey] || 0;
                    const decayHours = Math.round(decayMs / (1000 * 60 * 60));
                    const percentage = (Number(impl.count) / Number(stats.implements[0].count)) * 100;
                    const displayName = impl.implement === 'scribble' ? 'Pencil' : impl.implement;

                    return (
                      <div key={i} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-[120px]">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="capitalize font-medium">{displayName}</span>
                        </div>
                        <div className="flex-1 max-w-md">
                          <div className="h-8 bg-[#0a0a0a] rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-500"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: color,
                                opacity: 0.8,
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 min-w-[140px] justify-end">
                          <span className="text-2xl font-bold">{impl.count}</span>
                          <span className="text-xs text-gray-500">
                            {decayHours < 24 ? `${decayHours}h decay` : `${Math.round(decayHours / 24)}d decay`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <p className="text-gray-500">No implement selections yet</p>
                </div>
              )}
            </div>

            {/* Wall Rotations Matrix */}
            <div className="bg-gradient-to-br from-[#1a1c1e] to-[#141516] rounded-xl p-6 border border-white/5">
              <h2 className="text-xl font-bold mb-6">Wall Rotations</h2>
              {stats.rotations.length > 0 ? (
                <div>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div></div>
                    <div className="text-center text-xs text-gray-500 uppercase">Front</div>
                    <div className="text-center text-xs text-gray-500 uppercase">Left</div>
                    <div className="text-center text-xs text-gray-500 uppercase">Right</div>
                  </div>
                  {(['front', 'left', 'right'] as const).map(fromWall => (
                    <div key={fromWall} className="grid grid-cols-4 gap-2 mb-2">
                      <div className="text-xs text-gray-500 uppercase flex items-center">{fromWall}</div>
                      {(['front', 'left', 'right'] as const).map(toWall => {
                        const rotation = stats.rotations.find(
                          r => r.from_wall === fromWall && r.to_wall === toWall
                        );
                        const count = rotation ? Number(rotation.total) : 0;
                        const maxCount = Math.max(...stats.rotations.map(r => Number(r.total)));
                        const intensity = maxCount > 0 ? count / maxCount : 0;
                        const wallColor = WALL_COLORS[toWall];

                        return (
                          <div
                            key={toWall}
                            className="h-16 rounded-lg border border-white/5 flex items-center justify-center font-bold text-lg transition-all hover:scale-105"
                            style={{
                              backgroundColor: count > 0 ? `${wallColor}${Math.round(intensity * 255).toString(16).padStart(2, '0')}` : '#0a0a0a',
                            }}
                          >
                            {count > 0 ? count : '−'}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                    <span>Intensity:</span>
                    <div className="flex gap-1">
                      {[0.2, 0.4, 0.6, 0.8, 1.0].map(opacity => (
                        <div
                          key={opacity}
                          className="w-8 h-4 rounded"
                          style={{ backgroundColor: `#4a9eff${Math.round(opacity * 255).toString(16).padStart(2, '0')}` }}
                        />
                      ))}
                    </div>
                    <span>Low → High</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-gray-500">No wall rotations yet</p>
                </div>
              )}
            </div>

            {/* Graffiti Distribution Grid */}
            <div className="bg-gradient-to-br from-[#1a1c1e] to-[#141516] rounded-xl p-6 border border-white/5">
              <h2 className="text-xl font-bold mb-6">Graffiti by Wall & Implement</h2>
              {stats.drawings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left text-xs text-gray-500 uppercase tracking-wider pb-3">Wall</th>
                        <th className="text-left text-xs text-gray-500 uppercase tracking-wider pb-3">Implement</th>
                        <th className="text-right text-xs text-gray-500 uppercase tracking-wider pb-3">Count</th>
                        <th className="text-right text-xs text-gray-500 uppercase tracking-wider pb-3">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.drawings.map((d, i) => {
                        const wallColor = WALL_COLORS[d.wall as keyof typeof WALL_COLORS] || '#888888';
                        const implementColor = IMPLEMENT_STYLES[d.implement as ImplementType]?.color || '#888888';
                        const percentage = totalDrawings > 0 ? ((Number(d.count) / totalDrawings) * 100).toFixed(1) : '0';
                        const displayName = d.implement === 'scribble' ? 'Pencil' : d.implement;

                        return (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: wallColor }}
                                />
                                <span className="capitalize">{d.wall}</span>
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: implementColor }}
                                />
                                <span className="capitalize">{displayName}</span>
                              </div>
                            </td>
                            <td className="py-3 text-right font-bold text-lg">{d.count}</td>
                            <td className="py-3 text-right text-gray-400">{percentage}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-gray-500">No graffiti submitted yet</p>
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            {stats.timeline && stats.timeline.length > 0 && (
              <div className="bg-gradient-to-br from-[#1a1c1e] to-[#141516] rounded-xl p-6 border border-white/5">
                <h2 className="text-xl font-bold mb-6">Activity Timeline (Last 7 Days)</h2>
                <div className="flex items-end gap-1 h-32">
                  {stats.timeline.slice().reverse().map((t, i) => {
                    const maxCount = Math.max(...stats.timeline.map(x => Number(x.count)));
                    const height = maxCount > 0 ? (Number(t.count) / maxCount) * 100 : 0;
                    const date = new Date(t.hour);
                    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="w-full bg-[#0a0a0a] rounded-t relative" style={{ height: '100%' }}>
                          <div
                            className="absolute bottom-0 w-full bg-[#d94f30] rounded-t transition-all group-hover:bg-[#ff6b4a]"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">
                          {i % Math.ceil(stats.timeline.length / 8) === 0 ? label : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
