import { ExerciseVideo } from '../types';

/* ---------------------------------------------------------------------------
 * Limits & accepted formats
 * ------------------------------------------------------------------------- */

export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const VIDEO_MAX_SECONDS = 3 * 60; // demo clips should be short
export const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm';
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const VIDEO_EXT = /\.(mp4|m4v|mov|webm)$/i;

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // before resizing
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

export function formatDuration(sec?: number): string {
  if (!sec || !isFinite(sec)) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------------------------------------------------------------------------
 * Links: YouTube, Vimeo, Google Drive, or a direct https video file
 * ------------------------------------------------------------------------- */

export type LinkCheck = { ok: true; video: ExerciseVideo } | { ok: false; error: string };

export function parseVideoLink(raw: string): LinkCheck {
  const input = raw.trim();
  if (!input) return { ok: false, error: 'Paste a link first.' };

  let url: URL;
  try {
    url = new URL(input.startsWith('http') ? input : `https://${input}`);
  } catch {
    return { ok: false, error: "That doesn't look like a link." };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Only web links (https://…) are supported.' };
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  const addedAt = new Date().toISOString();

  // YouTube: watch?v=, youtu.be/, shorts/, embed/, live/
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (url.searchParams.get('v')) id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
      if (m) id = m[1];
    }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      return { ok: true, video: { kind: 'youtube', src: id, addedAt } };
    }
    return { ok: false, error: 'This YouTube link has no video in it. Use the "Share" link of the video.' };
  }

  // Vimeo: vimeo.com/123456789(/hash) or player.vimeo.com/video/123456789
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = url.pathname.match(/(?:^|\/video)\/(\d{6,})(?:\/([0-9a-f]{6,}))?/);
    if (m) {
      const hash = m[2] || url.searchParams.get('h');
      return { ok: true, video: { kind: 'vimeo', src: hash ? `${m[1]}?h=${hash}` : m[1], addedAt } };
    }
    return { ok: false, error: 'This Vimeo link has no video in it.' };
  }

  // Google Drive: /file/d/<id>/view or open?id=<id>
  if (host === 'drive.google.com') {
    const m = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
    const id = m ? m[1] : url.searchParams.get('id');
    if (id) return { ok: true, video: { kind: 'drive', src: id, addedAt } };
    return {
      ok: false,
      error: 'Use the Google Drive "Share → Copy link" of the video file (set to "Anyone with the link").'
    };
  }

  // Direct video file
  if (VIDEO_EXT.test(url.pathname)) {
    if (url.protocol !== 'https:') {
      return { ok: false, error: 'Video links must start with https:// to play inside the app.' };
    }
    return { ok: true, video: { kind: 'url', src: url.toString(), addedAt } };
  }

  return {
    ok: false,
    error: 'Use a YouTube, Vimeo or Google Drive link, or a direct link to an .mp4 / .mov / .webm file.'
  };
}

/** Returns the URL to put in an <iframe> or <video> for link-based videos. */
export function embedUrl(video: ExerciseVideo): string {
  switch (video.kind) {
    case 'youtube':
      return `https://www.youtube-nocookie.com/embed/${video.src}?rel=0&modestbranding=1&playsinline=1`;
    case 'vimeo': {
      const [id, hash] = video.src.split('?h=');
      return `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}&` : '?'}title=0&byline=0&portrait=0`;
    }
    case 'drive':
      return `https://drive.google.com/file/d/${video.src}/preview`;
    default:
      return video.src;
  }
}

export function thumbnailUrl(video?: ExerciseVideo): string | null {
  if (video?.kind === 'youtube') return `https://i.ytimg.com/vi/${video.src}/hqdefault.jpg`;
  return null;
}

/* ---------------------------------------------------------------------------
 * Uploaded files: type, size, and a real playback check
 * ------------------------------------------------------------------------- */

export type FileCheck = { ok: true; durationSec: number } | { ok: false; error: string };

/** Loads the file into a hidden <video> to make sure this browser can actually play it. */
export function checkVideoFile(file: File, maxBytes: number = VIDEO_MAX_BYTES): Promise<FileCheck> {
  if (!VIDEO_TYPES.includes(file.type) && !VIDEO_EXT.test(file.name)) {
    return Promise.resolve({ ok: false, error: 'Please choose a video file (MP4, MOV or WebM).' });
  }
  if (file.size > maxBytes) {
    return Promise.resolve({
      ok: false,
      error: `This video is ${formatBytes(file.size)}. The limit is ${formatBytes(maxBytes)} — trim it or export at 1080p.`
    });
  }

  return new Promise((resolve) => {
    const el = document.createElement('video');
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (r: FileCheck) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeAttribute('src');
      el.load();
      URL.revokeObjectURL(url);
      resolve(r);
    };
    const timer = setTimeout(
      () => finish({ ok: false, error: "Couldn't read this video. Try exporting it as MP4 (H.264)." }),
      15000
    );
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => {
      const d = el.duration;
      if (!isFinite(d) || d <= 0) {
        finish({ ok: false, error: "Couldn't read the length of this video. Try exporting it as MP4 (H.264)." });
      } else if (d > VIDEO_MAX_SECONDS) {
        finish({
          ok: false,
          error: `This video is ${formatDuration(d)} long. Demo videos can be up to ${formatDuration(VIDEO_MAX_SECONDS)}.`
        });
      } else if (el.videoWidth === 0) {
        finish({ ok: false, error: 'This file has no picture (audio only?). Choose a video.' });
      } else {
        finish({ ok: true, durationSec: Math.round(d) });
      }
    };
    el.onerror = () =>
      finish({
        ok: false,
        error:
          "This browser can't play this video format. On iPhone set Camera → Formats → Most Compatible, or export as MP4 (H.264)."
      });
    el.src = url;
  });
}

/* ---------------------------------------------------------------------------
 * Profile photos: check, square-crop and shrink to a small JPEG
 * ------------------------------------------------------------------------- */

export type PhotoCheck = { ok: true; dataUrl: string } | { ok: false; error: string };

export function preparePhoto(file: File, size = 256): Promise<PhotoCheck> {
  if (!file.type.startsWith('image/')) {
    return Promise.resolve({ ok: false, error: 'Please choose a photo (JPG, PNG or WebP).' });
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return Promise.resolve({ ok: false, error: `This photo is ${formatBytes(file.size)}. The limit is 10 MB.` });
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx || side === 0) {
        URL.revokeObjectURL(url);
        resolve({ ok: false, error: "Couldn't read this photo." });
        return;
      }
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      );
      URL.revokeObjectURL(url);
      resolve({ ok: true, dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, error: "This photo format isn't supported here. Try a JPG or PNG." });
    };
    img.src = url;
  });
}

/* ---------------------------------------------------------------------------
 * Document photos (e.g. an InBody printout): keep it readable, but small enough to upload fast
 * ------------------------------------------------------------------------- */

export const PRINTOUT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
export const PRINTOUT_MAX_BYTES = 10 * 1024 * 1024;

export type PrintoutCheck =
  | { ok: true; blob: Blob; contentType: string; ext: 'jpg' | 'pdf' }
  | { ok: false; error: string };

export function preparePrintout(file: File, maxSide = 1800): Promise<PrintoutCheck> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf && !file.type.startsWith('image/')) {
    return Promise.resolve({ ok: false, error: 'Please choose a photo or a PDF of the printout.' });
  }
  if (file.size > PRINTOUT_MAX_BYTES) {
    return Promise.resolve({ ok: false, error: `This file is ${formatBytes(file.size)}. The limit is 10 MB.` });
  }
  if (isPdf) return Promise.resolve({ ok: true, blob: file, contentType: 'application/pdf', ext: 'pdf' });

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve({ ok: false, error: "Couldn't read this photo." });
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) =>
          resolve(
            blob
              ? { ok: true, blob, contentType: 'image/jpeg', ext: 'jpg' }
              : { ok: false, error: "Couldn't read this photo." }
          ),
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, error: "This photo format isn't supported here. Try a JPG or PNG, or a PDF." });
    };
    img.src = url;
  });
}

/** Blob -> data URL (small previews in the local demo mode). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
