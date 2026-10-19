import React, { useMemo, useState } from 'react';
import { CourseStats, Resource } from '../types';
import { Heatmap } from './Heatmap';
import { ContributionGrid } from './ContributionGrid';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy, Grid, Users, ArrowDown, ThumbsUp, Eye, FileText, TrendingUp, Clock } from 'lucide-react';

interface Props {
  courseStats: CourseStats[];
  /** The full catalogue (not the filtered view) so the numbers are stable. */
  resources: Resource[];
  isLoading?: boolean;
  onSelectSubject?: (code: string) => void;
}

type Window = '7d' | '30d' | 'all';

const WINDOWS: { key: Window; label: string; days: number }[] = [
  { key: '7d', label: '7 DAYS', days: 7 },
  { key: '30d', label: '30 DAYS', days: 30 },
  { key: 'all', label: 'ALL TIME', days: 0 }
];

/** Simple horizontal bar used for the distributions (lighter than a chart lib). */
const DistributionRow: React.FC<{
  label: string;
  value: number;
  max: number;
  suffix?: string;
  accent?: string;
  onClick?: () => void;
  title?: string;
}> = ({ label, value, max, suffix, accent = 'bg-uni-neon', onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    title={title ?? label}
    className={`w-full text-left group ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex justify-between gap-3 text-xs font-mono text-uni-muted mb-1">
      <span className="truncate group-hover:text-uni-contrast transition-colors">{label}</span>
      <span className="tabular shrink-0">{value}{suffix ? ` ${suffix}` : ''}</span>
    </div>
    <div className="h-1.5 bg-uni-black border border-uni-border overflow-hidden">
      <div
        className={`h-full ${accent} transition-all duration-500`}
        style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }}
      />
    </div>
  </button>
);

export const Analytics: React.FC<Props> = ({ courseStats, resources, isLoading = false, onSelectSubject }) => {
  const [windowKey, setWindowKey] = useState<Window>('all');
  const days = WINDOWS.find(w => w.key === windowKey)!.days;

  /** Resources uploaded inside the selected window. */
  const windowed = useMemo(() => {
    if (!days) return resources;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return resources.filter(r => new Date(r.createdAt).getTime() >= cutoff);
  }, [resources, days]);

  const stats = useMemo(() => {
    const total = (pick: (r: Resource) => number) => windowed.reduce((sum, r) => sum + pick(r), 0);

    const countBy = (pick: (r: Resource) => string) => {
      const map = new Map<string, number>();
      windowed.forEach(r => map.set(pick(r), (map.get(pick(r)) ?? 0) + 1));
      return [...map.entries()].sort((a, b) => b[1] - a[1]);
    };

    const byCourse = [...windowed.reduce((map, r) => {
      const entry = map.get(r.courseCode) ?? { count: 0, quality: 0 };
      map.set(r.courseCode, { count: entry.count + 1, quality: entry.quality + r.qualityScore });
      return map;
    }, new Map<string, { count: number; quality: number }>())]
      .map(([code, v]) => ({ code, count: v.count, avgQuality: Math.round(v.quality / v.count) }))
      .sort((a, b) => b.count - a.count || b.avgQuality - a.avgQuality);

    const qualityBuckets = [
      { label: '90+', count: windowed.filter(r => r.qualityScore >= 90).length },
      { label: '80–89', count: windowed.filter(r => r.qualityScore >= 80 && r.qualityScore < 90).length },
      { label: '70–79', count: windowed.filter(r => r.qualityScore >= 70 && r.qualityScore < 80).length },
      { label: '60–69', count: windowed.filter(r => r.qualityScore >= 60 && r.qualityScore < 70).length },
      { label: '< 60', count: windowed.filter(r => r.qualityScore < 60).length }
    ];

    const contributors = [...windowed.reduce((map, r) => {
      const entry = map.get(r.author) ?? { count: 0, upvotes: 0 };
      map.set(r.author, { count: entry.count + 1, upvotes: entry.upvotes + r.upvotes });
      return map;
    }, new Map<string, { count: number; upvotes: number }>())]
      .map(([author, v]) => ({ author, ...v }))
      .sort((a, b) => b.count - a.count || b.upvotes - a.upvotes);

    return {
      resources: windowed.length,
      courses: new Set(windowed.map(r => r.courseCode)).size,
      contributors: contributors.length,
      upvotes: total(r => r.upvotes),
      downloads: total(r => r.downloads),
      views: total(r => r.views),
      slots: countBy(r => r.slot),
      types: countBy(r => r.type),
      byCourse,
      qualityBuckets,
      topContributors: contributors.slice(0, 5),
      mostDownloaded: [...windowed].sort((a, b) => b.downloads - a.downloads).slice(0, 5),
      mostUpvoted: [...windowed].sort((a, b) => b.upvotes - a.upvotes).slice(0, 5)
    };
  }, [windowed]);

  /**
   * Activity for the window, summed across courses, plus the derived headline
   * that used to be a hardcoded sentence ("B1 leads contributions…").
   */
  const activity = useMemo(() => {
    const grids = courseStats.map(c => c.activityGrid).filter((g): g is number[] => Array.isArray(g));
    if (grids.length === 0) return { grid: [] as number[], total: 0, busiestDay: null as number | null };

    const length = Math.min(...grids.map(g => g.length));
    const summed = Array.from({ length }, (_, day) => grids.reduce((sum, g) => sum + (g[day] ?? 0), 0));

    const slice = days ? summed.slice(-days) : summed;
    const total = slice.reduce((sum, v) => sum + v, 0);
    const peak = Math.max(...slice, 0);
    return { grid: summed, total, busiestDay: peak > 0 ? peak : null };
  }, [courseStats, days]);

  const headline = useMemo(() => {
    if (!stats.slots.length) return null;
    const [topSlot] = stats.slots;
    const best = [...stats.byCourse].sort((a, b) => b.avgQuality - a.avgQuality)[0];
    return `Slot ${topSlot[0]} contributes the most uploads (${topSlot[1]}); ${best.code} has the highest average quality (${best.avgQuality}).`;
  }, [stats]);

  const maxSlot = Math.max(...stats.slots.map(([, v]) => v), 0);
  const maxType = Math.max(...stats.types.map(([, v]) => v), 0);
  const maxCourse = Math.max(...stats.byCourse.map(c => c.count), 0);
  const maxBucket = Math.max(...stats.qualityBuckets.map(b => b.count), 0);
  const maxContributor = Math.max(...stats.topContributors.map(c => c.count), 0);
  const maxDownload = Math.max(...stats.mostDownloaded.map(r => r.downloads), 0);

  const emptyWindow = stats.resources === 0;

  return (
    <div className="animate-in fade-in duration-500 space-y-8 px-6 md:px-12">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-2 border-b border-uni-border pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-uni-contrast uppercase tracking-tight">System Analytics</h2>
          <p className="prose-read text-uni-muted text-sm">
            Live numbers over the {resources.length} resources in the archive — nothing here is hardcoded.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {WINDOWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setWindowKey(key)}
              aria-pressed={windowKey === key}
              className={`px-2 sm:px-3 py-1 border text-[10px] font-mono transition-colors ${windowKey === key ? 'border-uni-neon text-uni-neon bg-uni-neon/10' : 'border-uni-border text-uni-muted hover:text-uni-contrast hover:border-uni-neon bg-uni-panel'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: `Resources ${windowKey === 'all' ? '' : `(last ${days}d)`}`.trim(), value: stats.resources, icon: <FileText size={13} /> },
          { label: 'Courses', value: stats.courses, icon: <Grid size={13} /> },
          { label: 'Contributors', value: stats.contributors, icon: <Users size={13} /> },
          { label: 'Upvotes', value: stats.upvotes, icon: <ThumbsUp size={13} /> },
          { label: 'Downloads', value: stats.downloads, icon: <ArrowDown size={13} /> },
          { label: 'Views', value: stats.views, icon: <Eye size={13} /> }
        ].map(kpi => (
          <div key={kpi.label} className="bg-uni-panel border border-uni-border p-3 hover:border-uni-neon transition-colors">
            <span className="text-[10px] text-uni-muted uppercase tracking-wider font-mono flex items-center gap-1 mb-1">
              {kpi.icon} {kpi.label}
            </span>
            <span className="tabular text-xl font-display font-bold text-uni-contrast">{kpi.value}</span>
          </div>
        ))}
      </div>

      {headline && (
        <p className="prose-read text-xs text-uni-muted border-l-2 border-uni-cyan pl-3">{headline}</p>
      )}

      {emptyWindow ? (
        <div className="border border-dashed border-uni-border p-10 text-center text-uni-muted">
          <Clock size={22} className="mx-auto mb-3 opacity-40" />
          <p className="prose-read text-sm">
            No uploads in the last {days} days. Switch to <button onClick={() => setWindowKey('all')} className="text-uni-neon underline">all time</button> to see the full archive.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Slot distribution (server-computed slot list is no longer needed:
                the same numbers come straight from the catalogue) */}
            <div className="bg-uni-panel border border-uni-border p-4 sm:p-6">
              <div className="flex flex-wrap gap-2 justify-between items-center mb-6">
                <h3 className="text-base sm:text-lg font-display font-bold text-uni-contrast flex items-center gap-2 uppercase">
                  <Trophy size={18} className="text-uni-neon shrink-0" /> Slot Dominance
                </h3>
                <span className="tabular text-[10px] font-mono bg-uni-neon text-uni-black px-2 py-1 font-bold">
                  {stats.slots.length} SLOTS
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.slots.map(([name, count]) => ({ name, resources: count }))} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#666" fontSize={11} tickLine={false} axisLine={false} fontFamily="monospace" interval={0} />
                    <Tooltip
                      cursor={{ fill: '#2a2a2a' }}
                      contentStyle={{ backgroundColor: 'var(--uni-black)', border: '1px solid var(--uni-border)', color: 'var(--uni-text)', fontFamily: 'monospace', fontSize: 12 }}
                    />
                    <Bar dataKey="resources" fill="#333">
                      {stats.slots.map(([, count], index) => (
                        <Cell key={index} fill={count === maxSlot ? 'var(--uni-neon)' : index === 1 ? 'var(--uni-cyan)' : 'var(--uni-border)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="prose-read text-[11px] text-uni-muted mt-3 text-center border-t border-uni-border pt-2">
                Resources per slot. The fullest slot is highlighted.
              </p>
            </div>

            {/* Type + quality distributions */}
            <div className="bg-uni-panel border border-uni-border p-4 sm:p-6 space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-display font-bold text-uni-contrast flex items-center gap-2 uppercase mb-4">
                  <TrendingUp size={18} className="text-uni-cyan shrink-0" /> What people upload
                </h3>
                <div className="space-y-3">
                  {stats.types.map(([type, count]) => (
                    <DistributionRow key={type} label={type} value={count} max={maxType} accent="bg-uni-cyan" suffix="res" />
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-uni-muted uppercase mb-3">Quality score spread</h4>
                <div className="space-y-3">
                  {stats.qualityBuckets.map(bucket => (
                    <DistributionRow key={bucket.label} label={`QS ${bucket.label}`} value={bucket.count} max={maxBucket} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Course coverage */}
            <div className="lg:col-span-2 bg-uni-panel border border-uni-border p-4 sm:p-6">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h3 className="text-base sm:text-lg font-display font-bold text-uni-contrast flex items-center gap-2 uppercase">
                  <Grid size={18} className="text-uni-neon shrink-0" /> Course coverage
                </h3>
                <span className="text-[10px] font-mono text-uni-muted uppercase">click a course to open it</span>
              </div>
              <div className="space-y-3">
                {stats.byCourse.slice(0, 8).map(course => (
                  <DistributionRow
                    key={course.code}
                    label={course.code}
                    value={course.count}
                    max={maxCourse}
                    suffix={`res · QS ${course.avgQuality}`}
                    onClick={onSelectSubject ? () => onSelectSubject(course.code) : undefined}
                  />
                ))}
              </div>
            </div>

            {/* Coverage heatmap for the featured course */}
            <div className="bg-uni-panel border border-uni-border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-display font-bold text-uni-contrast flex items-center gap-2 uppercase mb-4">
                <Grid size={18} className="text-uni-cyan shrink-0" /> Syllabus coverage
              </h3>
              {courseStats[0] ? (
                <Heatmap stats={courseStats[0]} />
              ) : (
                <div className="h-full flex items-center justify-center text-uni-muted font-mono text-xs uppercase py-16">
                  {isLoading ? 'Loading coverage…' : 'No coverage data'}
                </div>
              )}
            </div>
          </div>

          {/* Activity across the archive */}
          <div className="bg-uni-panel border border-uni-border p-4 sm:p-6">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <h3 className="text-base sm:text-lg font-display font-bold text-uni-contrast uppercase">
                Archive activity
              </h3>
              <span className="tabular text-[10px] font-mono text-uni-muted uppercase">
                {activity.total} events {windowKey === 'all' ? 'all time' : `in the last ${days} days`}
                {activity.busiestDay ? ` · peak ${activity.busiestDay}/day` : ''}
              </span>
            </div>
            <ContributionGrid data={activity.grid} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contributors */}
            <div className="bg-uni-panel border border-uni-border p-4 sm:p-6">
              <h3 className="text-base font-display font-bold text-uni-contrast flex items-center gap-2 uppercase mb-4">
                <Users size={18} className="text-uni-neon shrink-0" /> Top contributors
              </h3>
              {stats.topContributors.length > 0 ? (
                <div className="space-y-3">
                  {stats.topContributors.map(c => (
                    <DistributionRow
                      key={c.author}
                      label={c.author}
                      value={c.count}
                      max={maxContributor}
                      suffix="uploads"
                      title={`${c.author}: ${c.count} uploads, ${c.upvotes} upvotes`}
                    />
                  ))}
                </div>
              ) : (
                <p className="prose-read text-xs text-uni-muted">No uploads in this window.</p>
              )}
            </div>

            {/* Most downloaded */}
            <div className="bg-uni-panel border border-uni-border p-4 sm:p-6">
              <h3 className="text-base font-display font-bold text-uni-contrast flex items-center gap-2 uppercase mb-4">
                <ArrowDown size={18} className="text-uni-cyan shrink-0" /> Most downloaded
              </h3>
              <ul className="space-y-3">
                {stats.mostDownloaded.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-xs font-mono">
                    <span className="text-uni-contrast truncate">{r.title}</span>
                    <span className="tabular shrink-0 text-uni-muted">{r.downloads}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t border-uni-border">
                <DistributionRow
                  label="Busiest resource"
                  value={stats.mostDownloaded[0]?.downloads ?? 0}
                  max={maxDownload}
                  suffix="downloads"
                />
              </div>
            </div>

            {/* Most upvoted */}
            <div className="bg-uni-panel border border-uni-border p-4 sm:p-6">
              <h3 className="text-base font-display font-bold text-uni-contrast flex items-center gap-2 uppercase mb-4">
                <ThumbsUp size={18} className="text-uni-alert shrink-0" /> Most upvoted
              </h3>
              <ul className="space-y-3">
                {stats.mostUpvoted.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-xs font-mono">
                    <span className="text-uni-contrast truncate">{r.title}</span>
                    <span className="tabular shrink-0 text-uni-muted">{r.upvotes}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
