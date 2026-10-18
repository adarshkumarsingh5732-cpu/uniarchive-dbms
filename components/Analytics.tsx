import React from 'react';
import { CourseStats } from '../types';
import { Heatmap } from './Heatmap';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy, Grid } from 'lucide-react';

interface Props {
  courseStats: CourseStats[];
  topSlots: { name: string; resources: number; score: number }[];
  isLoading?: boolean;
}

/**
 * Split into its own module so `recharts` (~150 kB) is only fetched when the
 * user actually opens the Analytics tab, instead of on first paint.
 */
export const Analytics: React.FC<Props> = ({ courseStats, topSlots, isLoading = false }) => {
  const featured = courseStats[0];

  return (
    <div className="animate-in fade-in duration-500 space-y-8 px-6 md:px-12">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8 border-b border-uni-border pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-uni-contrast uppercase tracking-tight">System Analytics</h2>
          <p className="prose-read text-uni-muted text-sm">Knowledge flow metrics</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {['7 DAYS', '30 DAYS', 'ALL TIME'].map(range => (
            <button key={range} className="px-2 sm:px-3 py-1 border border-uni-border text-[10px] font-mono text-uni-muted hover:text-uni-contrast hover:border-uni-neon transition-colors bg-uni-panel">{range}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Slot Activity Chart */}
        <div className="bg-uni-panel border border-uni-border p-4 sm:p-6">
          <div className="flex flex-wrap gap-2 justify-between items-center mb-6">
            <h3 className="text-base sm:text-lg font-display font-bold text-uni-contrast flex items-center gap-2 uppercase">
              <Trophy size={18} className="text-uni-neon shrink-0" /> Slot Dominance
            </h3>
            <span className="text-[10px] font-mono bg-uni-neon text-uni-black px-2 py-1 font-bold">ACTIVITY</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSlots} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} fontFamily="monospace" />
                <Tooltip
                  cursor={{ fill: '#2a2a2a' }}
                  contentStyle={{ backgroundColor: 'var(--uni-black)', border: '1px solid var(--uni-border)', color: 'var(--uni-text)', fontFamily: 'monospace' }}
                />
                <Bar dataKey="resources" fill="#333">
                  {topSlots.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--uni-neon)' : index === 1 ? 'var(--uni-cyan)' : 'var(--uni-border)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs font-mono text-uni-muted mt-4 text-center uppercase border-t border-uni-border pt-2">B1 leads contributions. G2 highest quality.</p>
          </div>
        </div>

        {/* Coverage Heatmap */}
        <div className="bg-uni-panel border border-uni-border p-4 sm:p-6">
          <div className="flex flex-wrap gap-2 justify-between items-center mb-6">
            <h3 className="text-base sm:text-lg font-display font-bold text-uni-contrast flex items-center gap-2 uppercase">
              <Grid size={18} className="text-uni-cyan shrink-0" /> Syllabus Coverage
            </h3>
            <span className="text-[10px] font-mono bg-uni-cyan text-uni-black px-2 py-1 font-bold">DENSITY</span>
          </div>
          {featured ? (
            <Heatmap stats={featured} />
          ) : (
            <div className="h-full flex items-center justify-center text-uni-muted font-mono text-xs uppercase py-16">
              {isLoading ? 'Loading coverage…' : 'No coverage data'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
