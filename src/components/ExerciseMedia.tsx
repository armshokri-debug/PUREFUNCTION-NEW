import React, { useEffect, useState } from 'react';
import { Play, VideoOff, Video } from 'lucide-react';
import { Exercise, ExerciseVideo } from '../types';
import { embedUrl, thumbnailUrl, formatDuration } from '../lib/media';
import { loadVideoFile } from '../lib/videoStore';
import { videoUrl } from '../cloud/videos';

/** Resolves a playable src for a video (object URL for uploaded files). */
function useVideoSrc(video?: ExerciseVideo): { src: string | null; missing: boolean } {
  const [state, setState] = useState<{ src: string | null; missing: boolean }>({
    src: video && video.kind !== 'file' && video.kind !== 'storage' ? embedUrl(video) : null,
    missing: false
  });

  useEffect(() => {
    if (!video) {
      setState({ src: null, missing: false });
      return;
    }
    if (video.kind === 'storage') {
      let cancelled = false;
      setState({ src: null, missing: false });
      videoUrl(video.src, video.bucket ?? 'exercise-videos').then((url) => {
        if (!cancelled) setState({ src: url, missing: !url });
      });
      return () => {
        cancelled = true;
      };
    }
    if (video.kind !== 'file') {
      setState({ src: embedUrl(video), missing: false });
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    setState({ src: null, missing: false });
    loadVideoFile(video.src).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setState({ src: null, missing: true });
        return;
      }
      url = URL.createObjectURL(blob);
      setState({ src: url, missing: false });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [video?.kind, video?.src]);

  return state;
}

const Placeholder: React.FC<{ className: string; label: string; compact?: boolean }> = ({
  className,
  label,
  compact
}) => (
  <div
    className={`${className} rounded-xl bg-[#F3F4F6] border border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 text-gray-400 select-none`}
  >
    <VideoOff className={compact ? 'w-4 h-4' : 'w-6 h-6'} />
    {!compact && <span className="text-xs font-medium">{label}</span>}
  </div>
);

/** Full player: YouTube / Vimeo / Drive in an iframe, files & direct links in <video>. */
export const ExerciseVideoPlayer: React.FC<{
  video?: ExerciseVideo;
  title: string;
  className?: string;
}> = ({ video, title, className = 'w-full aspect-video' }) => {
  const { src, missing } = useVideoSrc(video);

  if (!video) return <Placeholder className={className} label="No video yet" />;
  if (missing)
    return <Placeholder className={className} label={video.kind === 'storage' ? "Video couldn’t be loaded" : "Video file not on this device"} />;
  if (!src) return <div className={`${className} rounded-xl bg-gray-100 animate-pulse`} />;

  if (video.kind === 'file' || video.kind === 'url' || video.kind === 'storage') {
    return (
      <video
        key={src}
        src={`${src}#t=0.1`}
        controls
        playsInline
        preload="metadata"
        className={`${className} rounded-xl bg-black object-contain`}
      />
    );
  }
  return (
    <iframe
      key={src}
      src={src}
      title={title}
      className={`${className} rounded-xl bg-black`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
};

/** Small still for cards and lists. */
export const ExerciseThumb: React.FC<{
  exercise: Exercise;
  className?: string;
  compact?: boolean;
}> = ({ exercise, className = 'w-full aspect-video', compact }) => {
  const video = exercise.video;
  const { src, missing } = useVideoSrc(video?.kind === 'file' || video?.kind === 'url' || video?.kind === 'storage' ? video : undefined);
  const still = thumbnailUrl(video);

  if (!video || missing) return <Placeholder className={className} label="No video yet" compact={compact} />;

  return (
    <div className={`${className} rounded-xl overflow-hidden bg-[#111827] relative select-none`}>
      {still ? (
        <img src={still} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : src ? (
        <video src={`${src}#t=0.5`} muted playsInline preload="metadata" className="w-full h-full object-cover pointer-events-none" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/60">
          <Video className={compact ? 'w-4 h-4' : 'w-7 h-7'} />
        </div>
      )}
      {!compact && (
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-10 h-10 rounded-full bg-black/55 flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </span>
          </div>
          {video.durationSec ? (
            <span className="absolute bottom-1.5 right-1.5 text-[10px] font-medium text-white bg-black/60 px-1.5 py-0.5 rounded">
              {formatDuration(video.durationSec)}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
};
