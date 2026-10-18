import React from 'react';
import { Resource } from '../types';
import { Download, ThumbsUp, User, Calendar, MessageSquare, ArrowDown } from 'lucide-react';

interface Props {
  resource: Resource;
}

export const ResourceCard: React.FC<Props> = ({ resource }) => {
  const getTypeStyles = (type: string) => {
    switch(type) {
      case 'Notes': return 'border-uni-cyan text-uni-cyan';
      case 'Question Bank': return 'border-uni-neon text-uni-neon';
      case 'Cheatsheet': return 'border-uni-alert text-uni-alert';
      case 'Lab Report': return 'border-purple-400 text-purple-400';
      case 'Solution': return 'border-orange-400 text-orange-400';
      default: return 'border-uni-muted text-uni-muted';
    }
  };

  return (
    <div className="group relative bg-uni-panel border border-uni-border p-5 flex flex-col h-full hover:border-uni-neon transition-all duration-300 hover:shadow-[0_0_15px_rgba(204,255,0,0.1)]">
      {/* Decorator */}
      <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-uni-border group-hover:border-uni-neon transition-colors" />

      {/* Header Tags */}
      <div className="flex justify-between items-start gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="bg-uni-border text-xs font-mono px-2 py-1 text-uni-text">
            {resource.slot}
          </span>
          <span className="bg-uni-border text-xs font-mono px-2 py-1 text-uni-contrast border border-transparent group-hover:border-uni-cyan transition-all">
            {resource.courseCode}
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider border ${getTypeStyles(resource.type)}`}>
            {resource.type}
          </span>
        </div>
        <div className="tabular shrink-0 text-xs font-bold font-mono px-2 py-1 text-uni-neon bg-uni-neon/5 border border-uni-neon/20">
          QS: {resource.qualityScore}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 mb-4">
        <h3 className="text-uni-contrast font-display font-semibold text-base sm:text-lg leading-snug tracking-tight mb-2 group-hover:text-uni-neon transition-colors line-clamp-2">
          {resource.title}
        </h3>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {resource.topics.slice(0, 3).map(topic => (
            <span key={topic} className="text-[11px] font-mono text-uni-muted hover:text-uni-cyan transition-colors border border-uni-border px-1.5 py-0.5">
              #{topic}
            </span>
          ))}
        </div>
        
        <p className="prose-read text-sm text-uni-muted line-clamp-2 border-l-2 border-uni-border pl-2 group-hover:border-uni-neon transition-colors">
          {resource.description}
        </p>
      </div>

      {/* Metrics Row */}
      <div className="tabular flex items-center gap-4 mb-4 text-xs font-mono text-uni-muted border-t border-uni-border pt-3">
        <div className="flex items-center gap-1.5 hover:text-uni-contrast transition-colors">
          <ThumbsUp size={14} className={resource.upvotes > 100 ? "text-uni-neon" : ""} />
          <span>{resource.upvotes}</span>
        </div>
        <div className="flex items-center gap-1.5 hover:text-uni-contrast transition-colors">
          <ArrowDown size={14} />
          <span>{resource.downloads}</span>
        </div>
        <div className="flex items-center gap-1.5 hover:text-uni-contrast transition-colors">
          <MessageSquare size={14} />
          <span>{resource.commentsCount || 0}</span>
        </div>
      </div>

      {/* Footer Metadata */}
      <div className="flex items-center justify-between mt-auto">
        <div className="flex flex-col gap-1">
           {resource.professor && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-uni-cyan">
                <User size={12} /> {resource.professor}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-uni-alert">
                <Calendar size={12} /> {resource.semester} {resource.year}
            </div>
        </div>
        
        <button className="text-uni-black bg-uni-neon hover:bg-uni-contrast transition-colors p-2 border border-uni-neon hover:border-uni-contrast shadow-hard-neon hover:shadow-hard hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]">
          <Download size={16} />
        </button>
      </div>
    </div>
  );
};
