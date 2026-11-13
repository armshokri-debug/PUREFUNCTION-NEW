import React, { useRef, useState } from 'react';
import { X, Upload, Link2, Check, AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { BODY_PARTS, EQUIPMENT, Exercise, ExerciseVideo, PATTERNS, PHASES, PLANES } from '../../types';
import {
  VIDEO_ACCEPT,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SECONDS,
  checkVideoFile,
  formatBytes,
  formatDuration,
  parseVideoLink
} from '../../lib/media';
import { saveVideoFile } from '../../lib/videoStore';
import { isCloud } from '../../cloud/supabase';
import { CLOUD_VIDEO_MAX_BYTES, uploadExerciseVideo } from '../../cloud/videos';
import { ExerciseVideoPlayer } from '../ExerciseMedia';

interface Props {
  /** Existing exercise to edit, or null to create a new one. */
  exercise: Exercise | null;
  onSave: (exercise: Exercise) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const inputCls =
  'w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-[#111827] placeholder:text-gray-400 focus:outline-none focus:border-[#111827]';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1.5';

type PendingFile = { file: File; durationSec: number; previewUrl: string };

export const ExerciseEditorModal: React.FC<Props> = ({ exercise, onSave, onDelete, onClose }) => {
  const isNew = !exercise;
  const [name, setName] = useState(exercise?.name ?? '');
  const [bodyPart, setBodyPart] = useState<Exercise['bodyPart']>(exercise?.bodyPart ?? 'Lower');
  const [plane, setPlane] = useState<string>(exercise?.plane ?? '');
  const [pattern, setPattern] = useState<string>(exercise?.pattern ?? '');
  const [equipment, setEquipment] = useState<Exercise['equipment']>(exercise?.equipment ?? 'Bodyweight');
  const [phase, setPhase] = useState<string>(exercise?.phase ?? '');
  const [cuesText, setCuesText] = useState((exercise?.cues ?? []).join('\n'));
  const [breathing, setBreathing] = useState(exercise?.breathingPattern ?? '');
  const [why, setWhy] = useState(exercise?.whyItMatters ?? '');

  // Video
  const [video, setVideo] = useState<ExerciseVideo | undefined>(exercise?.video);
  const [mode, setMode] = useState<'upload' | 'link'>(exercise?.video && exercise.video.kind !== 'file' && exercise.video.kind !== 'storage' ? 'link' : 'upload');
  const [linkText, setLinkText] = useState('');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [checking, setChecking] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const clearPending = () => {
    if (pendingFile) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setVideoError(null);
    clearPending();
    setChecking(true);
    const result = await checkVideoFile(file, isCloud ? CLOUD_VIDEO_MAX_BYTES : VIDEO_MAX_BYTES);
    setChecking(false);
    if (!result.ok) {
      setVideoError(result.error);
      return;
    }
    setPendingFile({ file, durationSec: result.durationSec, previewUrl: URL.createObjectURL(file) });
  };

  const handleCheckLink = () => {
    setVideoError(null);
    const result = parseVideoLink(linkText);
    if (!result.ok) {
      setVideoError(result.error);
      return;
    }
    clearPending();
    setVideo(result.video);
    setLinkText('');
  };

  const handleSave = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Give the exercise a name.');
      return;
    }
    const id = exercise?.id ?? `ex-custom-${Date.now()}`;
    let finalVideo = video;

    if (pendingFile) {
      setSaving(true);
      let src: string;
      try {
        if (isCloud) {
          src = await uploadExerciseVideo(id, pendingFile.file);
        } else {
          src = `video-${id}-${Date.now()}`;
          await saveVideoFile(src, pendingFile.file);
        }
      } catch {
        setSaving(false);
        setFormError(
          isCloud
            ? 'The video could not be uploaded. Check your connection and try again.'
            : 'Not enough space on this device to save the video. Try a shorter or smaller file.'
        );
        return;
      }
      finalVideo = {
        kind: isCloud ? 'storage' : 'file',
        src,
        fileName: pendingFile.file.name,
        sizeBytes: pendingFile.file.size,
        durationSec: pendingFile.durationSec,
        addedAt: new Date().toISOString()
      };
    }

    onSave({
      ...(exercise ?? { isCustom: true, source: 'coach' }),
      id,
      name: name.trim(),
      bodyPart,
      plane: (plane || undefined) as Exercise['plane'],
      pattern: (pattern || undefined) as Exercise['pattern'],
      equipment,
      phase: (phase || undefined) as Exercise['phase'],
      cues: cuesText
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean),
      breathingPattern: breathing.trim(),
      whyItMatters: why.trim(),
      video: finalVideo
    } as Exercise);
    clearPending();
    setSaving(false);
    onClose();
  };

  const shownVideo: ExerciseVideo | undefined = pendingFile ? undefined : video;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#111827]">{isNew ? 'New exercise' : 'Edit exercise'}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-[#111827] hover:bg-gray-100 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-6">
          {/* ---------------- Video ---------------- */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold text-[#111827]">Demo video</h3>
              <div className="bg-gray-100 p-0.5 rounded-xl inline-flex">
                {(['upload', 'link'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setVideoError(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      mode === m ? 'bg-[#111827] text-white' : 'text-gray-600'
                    }`}
                  >
                    {m === 'upload' ? <Upload className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                    {m === 'upload' ? 'Upload' : 'Link'}
                  </button>
                ))}
              </div>
            </div>

            {/* Current / pending preview */}
            {(shownVideo || pendingFile) && (
              <div className="mb-3">
                {pendingFile ? (
                  <video src={pendingFile.previewUrl} controls playsInline className="w-full aspect-video rounded-xl bg-black object-contain" />
                ) : (
                  <ExerciseVideoPlayer video={shownVideo} title={name || 'Exercise video'} />
                )}
                <div className="flex items-center justify-between gap-3 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#111827] min-w-0">
                    <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                    <span className="truncate">
                      {pendingFile
                        ? `${pendingFile.file.name} · ${formatBytes(pendingFile.file.size)} · ${formatDuration(pendingFile.durationSec)} — checked, plays fine`
                        : shownVideo?.kind === 'file' || shownVideo?.kind === 'storage'
                        ? `${shownVideo.fileName ?? 'Uploaded video'}${shownVideo.durationSec ? ` · ${formatDuration(shownVideo.durationSec)}` : ''}`
                        : `${shownVideo?.kind === 'youtube' ? 'YouTube' : shownVideo?.kind === 'vimeo' ? 'Vimeo' : shownVideo?.kind === 'drive' ? 'Google Drive' : 'Video link'} — link checked`}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      clearPending();
                      setVideo(undefined);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            )}

            {mode === 'upload' ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept={VIDEO_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    void handleFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void handleFile(e.dataTransfer.files?.[0]);
                  }}
                  disabled={checking}
                  className="w-full border-2 border-dashed border-gray-300 hover:border-[#111827] rounded-2xl py-6 px-4 flex flex-col items-center gap-1.5 text-center cursor-pointer transition-colors"
                >
                  {checking ? (
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-gray-400" />
                  )}
                  <span className="text-sm font-semibold text-[#111827]">
                    {checking ? 'Checking video…' : shownVideo || pendingFile ? 'Choose a different video' : 'Choose a video or drop it here'}
                  </span>
                  <span className="text-xs text-gray-500">
                    MP4, MOV or WebM · up to {formatBytes(isCloud ? CLOUD_VIDEO_MAX_BYTES : VIDEO_MAX_BYTES)} · up to {formatDuration(VIDEO_MAX_SECONDS)}
                  </span>
                </button>
              </>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    inputMode="url"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCheckLink()}
                    placeholder="Paste YouTube, Vimeo or Google Drive link"
                    className={inputCls}
                  />
                  <button
                    onClick={handleCheckLink}
                    className="shrink-0 bg-[#111827] text-white text-sm font-semibold px-4 rounded-xl cursor-pointer"
                  >
                    Check
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Tip: upload to YouTube as <b>Unlisted</b> so only people with the link can see it.
                </p>
              </div>
            )}

            {videoError && (
              <div className="mt-2.5 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>{videoError}</span>
              </div>
            )}
          </section>

          {/* ---------------- Details ---------------- */}
          <section className="space-y-4">
            <div>
              <label className={labelCls}>Exercise name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Left AIC Split Squat" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Body part</label>
                <select value={bodyPart} onChange={(e) => setBodyPart(e.target.value as Exercise['bodyPart'])} className={inputCls}>
                  {BODY_PARTS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Plane of motion</label>
                <select value={plane} onChange={(e) => setPlane(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {PLANES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Equipment</label>
                <select value={equipment} onChange={(e) => setEquipment(e.target.value as Exercise['equipment'])} className={inputCls}>
                  {EQUIPMENT.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Phase</label>
                <select value={phase} onChange={(e) => setPhase(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {PHASES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Movement pattern</label>
                <select value={pattern} onChange={(e) => setPattern(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {PATTERNS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Coaching cues (one per line)</label>
              <textarea value={cuesText} onChange={(e) => setCuesText(e.target.value)} rows={4} placeholder={'Ribs down over pelvis\nFeel the left heel'} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Breathing (optional)</label>
              <input value={breathing} onChange={(e) => setBreathing(e.target.value)} placeholder="e.g. Inhale nose 4s · exhale 6s" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Why it matters (optional)</label>
              <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} className={inputCls} />
            </div>
          </section>

          {formError && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              <span>{formError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 sm:px-6 py-4 flex items-center justify-between gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!isNew && exercise?.isCustom && onDelete ? (
            confirmDelete ? (
              <button onClick={() => { onDelete(exercise.id); onClose(); }} className="text-sm font-semibold text-red-600 cursor-pointer">
                Tap again to delete
              </button>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-red-600 cursor-pointer">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-[#111827] cursor-pointer">
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving || checking}
              className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? (pendingFile && isCloud ? 'Uploading…' : 'Saving…') : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
