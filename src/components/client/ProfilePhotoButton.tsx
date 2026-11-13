import React, { useRef, useState } from 'react';
import { Camera, Trash2, AlertCircle } from 'lucide-react';
import { ClientProfile } from '../../types';
import { PHOTO_ACCEPT, preparePhoto } from '../../lib/media';
import { ClientAvatar } from '../VisualAssets';

/** Client's own avatar in the top bar: tap to add, change or remove their photo. */
export const ProfilePhotoButton: React.FC<{
  client: ClientProfile;
  onUpdateClient: (updated: ClientProfile) => void;
}> = ({ client, onUpdateClient }) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = () => {
    setError(null);
    input.current?.click();
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const result = await preparePhoto(file);
    if (!result.ok) {
      setError(result.error);
      setOpen(true);
      return;
    }
    onUpdateClient({ ...client, photoUrl: result.dataUrl });
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => (client.photoUrl ? setOpen((o) => !o) : pick())}
        className="relative block cursor-pointer"
        aria-label={client.photoUrl ? 'Change profile photo' : 'Add profile photo'}
        title={client.photoUrl ? 'Change profile photo' : 'Add profile photo'}
      >
        <ClientAvatar name={client.name} photoUrl={client.photoUrl} size="sm" />
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#111827] border-2 border-white flex items-center justify-center">
          <Camera className="w-2 h-2 text-white" />
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-56 bg-white rounded-xl shadow-lg border border-gray-100 p-1.5">
            {error && (
              <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 rounded-lg px-2.5 py-2 mb-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}
            <button onClick={pick} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[#111827] hover:bg-gray-50 cursor-pointer">
              <Camera className="w-4 h-4" /> {client.photoUrl ? 'Change photo' : 'Add photo'}
            </button>
            {client.photoUrl && (
              <button
                onClick={() => {
                  onUpdateClient({ ...client, photoUrl: undefined });
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Remove photo
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
