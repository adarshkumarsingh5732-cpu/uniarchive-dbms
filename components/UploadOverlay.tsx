import React, { useState } from 'react';
import { X, UploadCloud, Check, AlertCircle } from 'lucide-react';
import { Resource, ResourceType } from '../types';
import { api } from '../services/api';

interface Props {
  onClose: () => void;
  onUploadComplete: (resource: Resource) => void;
  author?: string;
}

export const UploadOverlay: React.FC<Props> = ({ onClose, onUploadComplete, author }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);

  // Form State
  const [courseCode, setCourseCode] = useState('');
  const [slot, setSlot] = useState('');
  const [type, setType] = useState<ResourceType>('Notes');
  const [semester, setSemester] = useState('Winter');
  const [year, setYear] = useState('2024');
  const [topics, setTopics] = useState('');
  const [professor, setProfessor] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [completeness, setCompleteness] = useState(50);

  const [isPublishing, setIsPublishing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Vercel Serverless Limit is 4.5MB. We limit to 4MB to be safe.
      if (selectedFile.size > 4 * 1024 * 1024) {
        alert("File too large! Max size is 4MB for serverless uploads.");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleNext = () => {
    if (step === 1 && file) setStep(2);
    else if (step === 2 && title && courseCode) setStep(3);
  };

  const handlePublish = async () => {
    if (!file) return;

    setIsPublishing(true);
    try {
      // Only the fields the API actually stores; counters and timestamps are
      // server-owned and the id is assigned by the database.
      const metadata = {
        title,
        courseCode: courseCode.toUpperCase(),
        slot: slot.toUpperCase(),
        type,
        topics: topics.split(',').map(t => t.trim()).filter(t => t),
        qualityScore: Math.floor(completeness * 0.9) + 5,
        completeness,
        author: author || 'You',
        professor,
        semester,
        year,
        description
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('data', JSON.stringify(metadata));

      const newResource = await api.uploadResource(formData);

      onUploadComplete(newResource);
      onClose();
    } catch (error: any) {
      console.error("Upload failed", error);
      alert(error.message || "Upload failed. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-uni-black/90 backdrop-blur-sm p-4 font-mono">
      <div className="bg-uni-dark w-full max-w-2xl border border-uni-neon shadow-hard-neon flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-uni-border bg-uni-panel flex justify-between items-center">
          <div>
            <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">
              Contribute Resource
            </h2>
            <p className="text-xs text-uni-muted mt-1 uppercase">Help peers. Build rep.</p>
          </div>
          <button onClick={onClose} className="text-uni-muted hover:text-white transition-colors p-2 hover:bg-uni-border">
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-uni-border flex">
          <div className={`h-full bg-uni-neon transition-all duration-300 ${step >= 1 ? 'w-1/3' : 'w-0'}`}></div>
          <div className={`h-full bg-uni-neon transition-all duration-300 ${step >= 2 ? 'w-1/3' : 'w-0'}`}></div>
          <div className={`h-full bg-uni-neon transition-all duration-300 ${step >= 3 ? 'w-1/3' : 'w-0'}`}></div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-1">

          {/* STEP 1: UPLOAD */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="border-2 border-dashed border-uni-border hover:border-uni-neon transition-colors p-16 text-center cursor-pointer relative group bg-uni-panel">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept=".pdf,.jpg,.png,.docx"
                />
                <div className="flex flex-col items-center gap-4 group-hover:scale-105 transition-transform">
                  {file ? (
                    <>
                      <div className="w-16 h-16 bg-uni-neon/20 text-uni-neon flex items-center justify-center">
                        <Check size={32} />
                      </div>
                      <span className="text-lg text-white break-all">{file.name}</span>
                      <span className="text-xs text-uni-neon uppercase">Click to change</span>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-uni-border text-uni-muted flex items-center justify-center group-hover:text-uni-neon group-hover:bg-uni-neon/20 transition-all">
                        <UploadCloud size={32} />
                      </div>
                      <div className="text-white font-display font-bold text-lg">
                        DRAG & DROP
                      </div>
                      <p className="text-xs text-uni-muted">PDF, JPG, PNG (MAX 25MB)</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  disabled={!file}
                  className="bg-uni-neon text-uni-black font-display font-bold py-3 px-8 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-hard-neon uppercase"
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: METADATA */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Course Code</label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. BMAT202L"
                    className="w-full bg-uni-black border border-uni-border p-3 text-white focus:border-uni-neon outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Slot</label>
                  <input
                    type="text"
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                    placeholder="e.g. B1"
                    className="w-full bg-uni-black border border-uni-border p-3 text-white focus:border-uni-neon outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Resource Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Notes', 'Question Bank', 'Cheatsheet', 'Lab Report', 'Solution'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t as ResourceType)}
                      className={`p-2 text-xs border ${type === t ? 'border-uni-neon bg-uni-neon/10 text-uni-neon' : 'border-uni-border text-uni-muted hover:border-uni-text'}`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Professor</label>
                  <input
                    type="text"
                    value={professor}
                    onChange={(e) => setProfessor(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-uni-black border border-uni-border p-3 text-white focus:border-uni-neon outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Year/Sem</label>
                  <div className="flex gap-2">
                    <select value={semester} onChange={(e) => setSemester(e.target.value)} className="bg-uni-black border border-uni-border p-3 text-white outline-none w-1/2 cursor-pointer">
                      <option>Winter</option>
                      <option>Fall</option>
                    </select>
                    <input
                      type="text"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-1/2 bg-uni-black border border-uni-border p-3 text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Clear title for your resource"
                  className="w-full bg-uni-black border border-uni-border p-3 text-white focus:border-uni-neon outline-none transition-colors font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe contents, specific modules covered, etc."
                  className="w-full bg-uni-black border border-uni-border p-3 text-white focus:border-uni-neon outline-none transition-colors h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Topics (comma separated)</label>
                <input
                  type="text"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="Probability, Bayes, etc."
                  className="w-full bg-uni-black border border-uni-border p-3 text-white focus:border-uni-neon outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase flex justify-between">
                  <span>Syllabus Completeness</span>
                  <span className="text-uni-neon">{completeness}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={completeness}
                  onChange={(e) => setCompleteness(parseInt(e.target.value))}
                  className="w-full accent-uni-neon h-2 bg-uni-border appearance-none cursor-pointer"
                />
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="text-uni-muted hover:text-white uppercase"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!title || !courseCode}
                  className="bg-uni-neon text-uni-black font-display font-bold py-3 px-8 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-hard-neon uppercase"
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-uni-panel border border-uni-border p-6">
                <h3 className="text-uni-muted text-xs font-bold uppercase mb-4">Preview Card</h3>
                <div className="border border-uni-border p-4 bg-uni-black">
                  <div className="flex gap-2 mb-2">
                    <span className="bg-uni-border text-xs px-2 py-1 text-white">{slot || 'SLOT'}</span>
                    <span className="bg-uni-border text-xs px-2 py-1 text-white">{courseCode || 'CODE'}</span>
                    <span className="border border-uni-neon text-uni-neon text-xs px-2 py-1">{type}</span>
                  </div>
                  <h4 className="text-white font-display font-bold text-lg mb-1">{title}</h4>
                  <p className="text-uni-muted text-sm italic">"{description}"</p>
                </div>
              </div>

              <div className="bg-uni-neon/5 border border-uni-neon/20 p-4 flex gap-3">
                <AlertCircle className="text-uni-neon shrink-0" size={20} />
                <div className="text-sm text-uni-muted">
                  <p className="mb-2"><strong className="text-white">CONTRIBUTION AGREEMENT:</strong></p>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    <li>I confirm this is my original work or I have permission to share.</li>
                    <li>This does not contain current semester assignments/exams.</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="text-uni-muted hover:text-white uppercase"
                >
                  Back to Edit
                </button>
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="bg-uni-neon text-uni-black font-display font-bold py-3 px-12 hover:bg-white transition-all shadow-hard-neon uppercase"
                >
                  {isPublishing ? 'PUBLISHING...' : 'PUBLISH RESOURCE'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};