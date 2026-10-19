import React, { useState, useRef } from 'react';
import { Resource, Comment } from '../types';
import { api, resourcePreviewUrl, resourceDownloadUrl } from '../services/api';
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, Share2, Download, User, Calendar, MoreHorizontal, ExternalLink, Bookmark, Flag, Eye, Maximize, Minimize } from 'lucide-react';

interface Props {
  resource: Resource;
  onBack: () => void;
  isSaved?: boolean;
  onToggleSave?: (resource: Resource) => void;
}

export const ResourceViewer: React.FC<Props> = ({ resource, onBack, isSaved = false, onToggleSave }) => {
  const [comments, setComments] = useState<Comment[]>(resource.comments || []);
  const [newComment, setNewComment] = useState('');

  // Interaction States
  const [upvotes, setUpvotes] = useState(resource.upvotes);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [downloads, setDownloads] = useState(resource.downloads);
  const [showToast, setShowToast] = useState<{ show: boolean, msg: string }>({ show: false, msg: '' });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const viewerContainerRef = useRef<HTMLDivElement>(null);

  const handlePostComment = async () => {
    if (!newComment.trim()) return;

    try {
      const comment = await api.addComment(resource.id, {
        text: newComment,
        author: 'You'
      });
      setComments([comment, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error("Failed to post comment", error);
    }
  };

  const toggleUpvote = async () => {
    if (hasUpvoted) return; // Simple upvote only logic for MVP to match API

    try {
      await api.updateInteraction(resource.id, 'upvote');
      setUpvotes(prev => prev + 1);
      setHasUpvoted(true);
    } catch (error) {
      console.error("Upvote failed", error);
    }
  };

  // Downloads go through our own endpoint (see the DOWNLOAD link below): it
  // streams the file as an `attachment` with a readable name, and the server
  // increments the download counter — so the UI only updates its own badge.


  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    showNotification('Link Copied to Clipboard!');
  };

  const handleReport = () => {
    showNotification('Resource reported to moderators.');
  };

  const showNotification = (msg: string) => {
    setShowToast({ show: true, msg });
    setTimeout(() => setShowToast({ show: false, msg: '' }), 2500);
  };

  const toggleFullscreen = () => {
    if (!viewerContainerRef.current) return;

    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen change events (browser ESC key)
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Preview the PDF through the backend instead of embedding the raw
  // Cloudinary / external URL directly. Cloudinary serves PDFs uploaded as a
  // `raw` asset with `Content-Disposition: attachment`, and many hosts do the
  // same, which makes the browser download the file instead of rendering it in
  // an iframe. `GET /api/resources/:id/preview/<slug>.pdf` streams the file back
  // with `Content-Disposition: inline` *and* a readable name.
  const previewUrl = resource.pdfUrl ? resourcePreviewUrl(resource) : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] animate-in fade-in slide-in-from-bottom-4 duration-300 relative">

      {/* Toast Notification */}
      {showToast.show && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-uni-neon text-uni-black px-4 py-2 rounded shadow-hard-neon font-bold text-sm animate-in fade-in slide-in-from-top-2 border border-uni-black">
          {showToast.msg}
        </div>
      )}

      {/* Top Bar Navigation */}
      <div className="bg-uni-panel border-b border-uni-border p-3 sm:p-4 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={onBack}
            className="p-2 shrink-0 hover:bg-uni-border rounded-full text-uni-muted hover:text-uni-contrast transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-mono mb-1">
              <span className="text-uni-neon border border-uni-neon px-1.5 rounded-sm">{resource.courseCode}</span>
              <span className="text-uni-muted">{resource.slot}</span>
              <span className="text-uni-muted">•</span>
              <span className="text-uni-muted">{resource.type}</span>
              <div className="flex items-center gap-1 ml-2 text-uni-muted">
                <Eye size={10} />
                <span className="tabular">{resource.views.toLocaleString()}</span>
              </div>
            </div>
            <h1 className="text-uni-contrast font-display font-bold text-sm sm:text-lg leading-tight truncate">{resource.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <button
            onClick={() => onToggleSave?.(resource)}
            className={`p-2 transition-colors border ${isSaved ? 'text-uni-neon border-uni-neon bg-uni-neon/10' : 'text-uni-muted border-transparent hover:text-uni-contrast hover:bg-uni-border'}`}
            title={isSaved ? "Saved" : "Save to Library"}
          >
            <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
          </button>
          <a
            href={resourceDownloadUrl(resource)}
            onClick={() => setDownloads(prev => prev + 1)}
            className="hidden md:flex items-center gap-2 bg-uni-neon text-uni-black px-4 py-2 font-bold font-mono text-xs hover:bg-white transition-colors shadow-hard-neon active:translate-y-0.5 active:shadow-none"
          >
            <Download size={14} /> DOWNLOAD
          </a>
          <div className="h-6 w-px bg-uni-border mx-1"></div>
          <button
            onClick={handleShare}
            className="p-2 text-uni-muted hover:text-uni-contrast hover:bg-uni-border transition-colors"
            title="Share"
          >
            <Share2 size={18} />
          </button>
          <button
            onClick={handleReport}
            className="hidden sm:block p-2 text-uni-muted hover:text-uni-alert hover:bg-uni-border transition-colors"
            title="Report"
          >
            <Flag size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        {/* PDF Viewer Pane */}
        <div className="h-[60vh] shrink-0 md:h-auto md:flex-1 bg-uni-black p-0 md:p-6 overflow-hidden md:overflow-y-auto border-b md:border-b-0 md:border-r border-uni-border flex flex-col items-center">
          <div ref={viewerContainerRef} className="w-full h-full md:max-w-4xl bg-uni-panel shadow-2xl border border-uni-border relative flex flex-col group">
            {resource.pdfUrl ? (
              <>
                {/* Fullscreen Toggle Button - Appears on Hover */}
                <button
                  onClick={toggleFullscreen}
                  className="absolute top-4 right-4 z-10 bg-uni-black/80 text-uni-contrast p-2 rounded hover:bg-uni-neon hover:text-uni-black transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>

                {previewUrl ? (
                  <iframe
                    src={`${previewUrl}#view=FitH`}
                    className="w-full flex-1 border-0"
                    title="PDF Viewer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-uni-muted">
                    <div className="w-20 h-24 border-2 border-uni-border flex items-center justify-center mb-4">
                      <span className="font-bold text-xs">PDF</span>
                    </div>
                    <p>Loading PDF preview...</p>
                  </div>
                )}
                {!isFullscreen && (
                  <div className="bg-uni-black border-t border-uni-border p-2 text-center">
                    <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs text-uni-muted hover:text-uni-neon flex items-center justify-center gap-2">
                      <ExternalLink size={10} /> Problems viewing? Open original file
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-uni-muted">
                <div className="w-20 h-24 border-2 border-uni-border flex items-center justify-center mb-4">
                  <span className="font-bold text-xs">PDF</span>
                </div>
                <p>Preview not available for this file type.</p>
              </div>
            )}
          </div>
        </div>

        {/* Discussion Pane (Reddit Style) */}
        <div className="w-full md:w-96 bg-uni-panel shrink-0 flex flex-col md:border-l border-uni-border md:h-full">

          {/* Sidebar Header */}
          <div className="p-4 border-b border-uni-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-uni-border w-8 h-8 rounded-full flex items-center justify-center text-uni-muted">
                  <User size={16} />
                </div>
                <div className="text-xs">
                  <p className="text-uni-contrast font-bold hover:underline cursor-pointer">{resource.author}</p>
                  <p className="text-uni-muted">{resource.createdAt}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-uni-black border border-uni-border rounded px-2 py-1">
                <button
                  onClick={toggleUpvote}
                  className={`transition-colors ${hasUpvoted ? 'text-uni-neon' : 'text-uni-muted hover:text-uni-neon'}`}
                >
                  <ThumbsUp size={14} fill={hasUpvoted ? "currentColor" : "none"} />
                </button>
                <span className={`text-xs font-mono font-bold mx-1 ${hasUpvoted ? 'text-uni-neon' : 'text-uni-contrast'}`}>
                  {upvotes}
                </span>
                <button className="text-uni-muted hover:text-uni-alert"><ThumbsDown size={14} /></button>
              </div>
            </div>
            <p className="prose-read text-xs text-uni-muted p-3 bg-uni-black border border-uni-border rounded">
              {resource.description}
            </p>
            {resource.professor && (
              <div className="mt-3 text-xs text-uni-cyan font-mono flex items-center gap-2">
                <User size={12} /> Prof. {resource.professor}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <h3 className="text-xs font-bold text-uni-muted uppercase flex items-center gap-2">
              <MessageSquare size={12} /> {comments.length} Comments
            </h3>

            {comments.map(comment => (
              <div key={comment.id} className="flex gap-3 group">
                <div className="flex flex-col items-center gap-1 text-uni-muted pt-1">
                  <ThumbsUp size={12} className="hover:text-uni-neon cursor-pointer" />
                  <span className="text-[10px] font-mono">{comment.upvotes}</span>
                  <ThumbsDown size={12} className="hover:text-uni-alert cursor-pointer" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${comment.isOp ? 'text-uni-neon' : 'text-uni-contrast'}`}>
                      {comment.author}
                    </span>
                    {comment.isOp && <span className="text-[9px] bg-uni-neon/20 text-uni-neon px-1 rounded">OP</span>}
                    <span className="tabular text-[10px] text-uni-muted">{comment.timestamp}</span>
                  </div>
                  <p className="prose-read text-xs text-uni-text">{comment.text}</p>
                  <div className="flex gap-3 mt-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button className="text-[10px] font-bold text-uni-muted hover:text-uni-contrast">Reply</button>
                    <button className="text-[10px] font-bold text-uni-muted hover:text-uni-contrast">Report</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Comment Input */}
          <div className="p-4 border-t border-uni-border bg-uni-black">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="What are your thoughts?"
              className="w-full bg-uni-panel border border-uni-border p-3 text-xs text-uni-contrast outline-none focus:border-uni-neon resize-none h-20 rounded-sm mb-2"
            />
            <div className="flex justify-end">
              <button
                onClick={handlePostComment}
                disabled={!newComment}
                className="bg-uni-contrast text-uni-black text-xs font-bold px-4 py-1.5 hover:bg-uni-neon transition-colors disabled:opacity-50"
              >
                COMMENT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
