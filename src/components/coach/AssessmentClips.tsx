import React, { useRef, useState } from 'react';
import { Upload, Link2, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { AssessmentClip, ClientProfile, ExerciseVideo } from '../../types';
import { VIDEO_ACCEPT, VIDEO_MAX_BYTES, checkVideoFile, formatBytes, parseVideoLink } from '../../lib/media';
import { saveVideoFile } from '../../lib/videoStore';
import { isCloud } from '../../cloud/supabase';
import { CLOUD_VIDEO_MAX_BYTES, uploadClientVideo } from '../../cloud/videos';
import { ExerciseVideoPlayer } from '../ExerciseMedia';

/** Standard filming protocol so week 0 and week 4 are filmed the same way. */
export const PROTOCOL = ['Overhead squat', 'Gait (walking)', 'Single-leg balance', 'Hip hinge', 'Standing posture'];
const ANGLES: AssessmentClip['angle'][] = ['Front', 'Side', 'Back'];

/** Step 6 of the assessment: film or link the movements. Saved privately for this client. */
export const AssessmentClips: React.FC<{
  client: ClientProfile;
  onUpdateClient: (c: ClientProfile) => void;
}> = ({ client, onUpdateClient }) => {
  const clips = client.clips ?? [];
  const [movement, setMovement] = useState(PROTOCOL[0]);
  const [custom, setCustom] = useState('');
  const [angle, setAngle] = useState<AssessmentClip['angle']>('Front');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const name = movement === 'Other' ? custom.trim() : movement;

  const add = (video: ExerciseVideo) => {
    const clip: AssessmentClip = { id: `clip-${Date.now().toString(36)}`, movement: name, angle, video };
    onUpdateClient({ ...client, clips: [...clips, clip] });
    setLink('');
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!name) return setError('Name the movement first.');
    setError(null);
    setBusy(true);
    const check = await checkVideoFile(file, isCloud ? CLOUD_VIDEO_MAX_BYTES : VIDEO_MAX_BYTES);
    if (!check.ok) {
      setBusy(false);
      return setError(check.error);
    }
    try {
      let video: ExerciseVideo;
      if (isCloud) {
        const src = await uploadClientVideo(client.id, file);
        video = { kind: 'storage', bucket: 'client-videos', src, fileName: file.name, sizeBytes: file.size, durationSec: check.durationSec, addedAt: new Date().toISOString() };
      } else {
        const src = `clip-${client.id}-${Date.now()}`;
        await saveVideoFile(src, file);
        video = { kind: 'file', src, fileName: file.name, sizeBytes: file.size, durationSec: check.durationSec, addedAt: new Date().toISOString() };
      }
      add(video);
    } catch {
      setError(isCloud ? 'Upload failed. Check the connection and try again.' : 'Not enough space on this device for this video.');
    }
    setBusy(false);
  };

  const onLink = () => {
    if (!name) return setError('Name the movement first.');
    const r = parseVideoLink(link);
    if (!r.ok) return setError(r.error);
    setError(null);
    add(r.video);
  };

  const field = 'border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm text-[#111827] bg-white focus:outline-none focus:border-[#111827]';

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6">
        <h3 className="text-base font-bold text-[#111827] mb-1">Film the movements</h3>
        <p className="text-sm text-gray-500 mb-4">
          Same movement, same angle every time — then week 0 and week 4 play side by side. Videos are private to you and this client
          {isCloud ? ` (up to ${formatBytes(CLOUD_VIDEO_MAX_BYTES)} each)` : ''}.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {[...PROTOCOL, 'Other'].map((m) => (
            <button
              key={m}
              onClick={() => setMovement(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${movement === m ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#111827]'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {movement === 'Other' && (
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Movement name" aria-label="Movement name" className={`${field} flex-1 min-w-[160px]`} />
          )}
          <select value={angle} onChange={(e) => setAngle(e.target.value as AssessmentClip['angle'])} aria-label="Camera angle" className={field}>
            {ANGLES.map((a) => (
              <option key={a} value={a}>
                {a} view
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={VIDEO_ACCEPT}
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 bg-[#111827] text-white text-sm font-semibold py-3 rounded-xl cursor-pointer disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-[#FFC809]" />}
            {busy ? 'Checking & uploading…' : 'Record or upload video'}
          </button>
          <div className="flex gap-2">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste a link" aria-label="Video link" className={`${field} flex-1 min-w-0`} />
            <button onClick={onLink} aria-label="Add link" className="px-3 rounded-xl border border-gray-200 cursor-pointer">
              <Link2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {clips.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clips.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[#111827]">
                  {c.movement} · {c.angle}
                </span>
                <button
                  onClick={() => onUpdateClient({ ...client, clips: clips.filter((x) => x.id !== c.id) })}
                  aria-label={`Remove ${c.movement} video`}
                  className="p-1.5 text-gray-300 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <ExerciseVideoPlayer video={c.video} title={`${c.movement} ${c.angle}`} />
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">These videos are saved with this assessment when you tap “Complete Assessment”.</p>
    </div>
  );
};
