import React from 'react';
import { Resource, CourseStats } from '../types';
import { ResourceCard } from './ResourceCard';
import { ArrowLeft, BookOpen, Users, FileText, Activity } from 'lucide-react';
import { Heatmap } from './Heatmap';
import { ContributionGrid } from './ContributionGrid';

interface Props {
  subjectCode: string;
  resources: Resource[];
  stats?: CourseStats;
  onBack: () => void;
}

export const SubjectDetail: React.FC<Props> = ({ subjectCode, resources, stats, onBack }) => {
  const subjectResources = resources.filter(r => r.courseCode === subjectCode);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-uni-muted hover:text-uni-contrast transition-colors font-mono text-xs uppercase group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Discover
      </button>

      {/* Subject Header */}
      <div className="bg-uni-panel border border-uni-border p-5 sm:p-8 mb-8 relative overflow-hidden">
        <div className="hidden md:block absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
           <BookOpen size={200} className="text-uni-contrast" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
             <span className="px-2 py-1 bg-uni-neon text-uni-black font-bold font-mono text-xs rounded-sm">COURSE CODE</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-bold text-uni-contrast mb-4 break-words">{subjectCode}</h1>
          <p className="text-uni-muted max-w-2xl font-mono text-xs sm:text-sm">
            Centralized repository for {subjectCode}. Access community verified notes, question banks, and solutions from parallel slots.
          </p>

          <div className="flex flex-wrap gap-4 sm:gap-6 mt-6 sm:mt-8 font-mono text-xs">
             <div className="flex items-center gap-2 text-uni-contrast">
                <FileText size={16} className="text-uni-cyan" />
                <span className="font-bold">{subjectResources.length}</span> Resources
             </div>
             <div className="flex items-center gap-2 text-uni-contrast">
                <Users size={16} className="text-uni-neon" />
                <span className="font-bold">120+</span> Contributors
             </div>
             <div className="flex items-center gap-2 text-uni-contrast">
                <Activity size={16} className="text-uni-alert" />
                <span className="font-bold">High</span> Activity
             </div>
          </div>
        </div>
      </div>
      
      {/* Activity Grid (GitHub Style) */}
      <div className="mb-8 bg-uni-panel border border-uni-border p-4 sm:p-6">
        <h3 className="font-bold text-uni-contrast text-sm uppercase mb-4">Contribution Activity</h3>
        <ContributionGrid data={stats?.activityGrid} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Resource List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-wrap gap-2 justify-between items-center border-b border-uni-border pb-2">
             <h2 className="font-display font-bold text-uni-contrast uppercase text-lg">Top Resources</h2>
             <div className="text-xs text-uni-muted font-mono">SORT: <span className="text-uni-contrast">RELEVANCE</span></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjectResources.map(r => (
               <div key={r.id} className="h-full">
                 <ResourceCard resource={r} />
               </div>
            ))}
            {subjectResources.length === 0 && (
              <div className="col-span-full py-12 text-center text-uni-muted border border-dashed border-uni-border bg-uni-panel/50">
                No resources found for this subject yet.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Stats */}
        <div className="space-y-6">
           {stats && (
             <div className="bg-uni-panel border border-uni-border p-4 h-80">
                <h3 className="font-bold text-uni-contrast text-sm uppercase mb-4">Coverage Heatmap</h3>
                <Heatmap stats={stats} />
             </div>
           )}
           
           <div className="bg-uni-panel border border-uni-border p-6">
             <h3 className="font-bold text-uni-contrast text-sm uppercase mb-4">Top Contributors</h3>
             <ul className="space-y-4">
               {['stat_god_99', 'math_wizard', 'topper_supreme'].map((user, i) => (
                 <li key={user} className="flex items-center justify-between font-mono text-xs">
                   <div className="flex items-center gap-2">
                     <span className={`w-5 h-5 flex items-center justify-center rounded-full ${i===0 ? 'bg-uni-neon text-uni-black' : 'bg-uni-border text-uni-muted'}`}>{i+1}</span>
                     <span className="text-uni-contrast hover:text-uni-cyan cursor-pointer transition-colors">{user}</span>
                   </div>
                   <span className="text-uni-muted">{500 - (i*50)} pts</span>
                 </li>
               ))}
             </ul>
           </div>
        </div>
      </div>
    </div>
  );
};
