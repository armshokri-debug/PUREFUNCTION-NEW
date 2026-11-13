import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Pin, Trash2 } from 'lucide-react';
import { ClientProfile, CoachNote } from '../../types';
import { formatDate, newId, todayISO } from '../../lib/workouts';

const card = 'bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6';

/** Coach notes per client: private by default, can be shared with the client. */
export const NotesPanel: React.FC<{ client: ClientProfile; onUpdateClient: (c: ClientProfile) => void }> = ({ client, onUpdateClient }) => {
  const notes = client.coachNotes ?? [];
  const [text, setText] = useState('');
  const [shared, setShared] = useState(false);
  const save = (next: CoachNote[]) => onUpdateClient({ ...client, coachNotes: next });

  const add = () => {
    const t = text.trim();
    if (!t) return;
    save([{ id: newId('note'), date: todayISO(), text: t, shared }, ...notes]);
    setText('');
    setShared(false);
  };
  const sorted = [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section className={card}>
        <h3 className="text-sm font-bold text-[#111827] mb-3">New note</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="e.g. Left knee tight on split squats — shorten range this week."
          className="w-full border border-gray-200 rounded-[20px] px-4 py-3 text-sm focus:outline-none focus:border-[#111827] resize-none"
        />
        <label className="flex items-center gap-2 mt-3 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="accent-[#111827] w-4 h-4" />
          Share with {client.name.split(' ')[0]}
        </label>
        <button onClick={add} disabled={!text.trim()} className="mt-4 w-full bg-[#111827] text-white text-sm font-semibold py-3 rounded-full disabled:opacity-40 cursor-pointer">
          Save note
        </button>
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Notes are private unless you share them.
        </p>
      </section>

      <section className={card}>
        <h3 className="text-sm font-bold text-[#111827] mb-2">Notes · {notes.length}</h3>
        {!notes.length && <p className="text-sm text-gray-500">No notes yet.</p>}
        <ul className="divide-y divide-gray-100">
          {sorted.map((n) => (
            <li key={n.id} className="py-3.5 flex gap-3">
              <div className="w-16 shrink-0 text-xs font-semibold text-gray-400 pt-0.5">{formatDate(n.date)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#111827] whitespace-pre-wrap leading-relaxed">{n.text}</p>
                <div className="flex items-center gap-2 mt-2">
                  {n.pinned && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFC809] text-[#111827]">Pinned</span>}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${n.shared ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {n.shared ? 'Shared with client' : 'Private'}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-1 shrink-0">
                <button title={n.pinned ? 'Unpin' : 'Pin'} onClick={() => save(notes.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)))} className="p-2 rounded-full hover:bg-gray-100 cursor-pointer">
                  <Pin className={`w-4 h-4 ${n.pinned ? 'text-[#111827]' : 'text-gray-400'}`} />
                </button>
                <button title={n.shared ? 'Make private' : 'Share with client'} onClick={() => save(notes.map((x) => (x.id === n.id ? { ...x, shared: !x.shared } : x)))} className="p-2 rounded-full hover:bg-gray-100 cursor-pointer">
                  {n.shared ? <Eye className="w-4 h-4 text-green-700" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                </button>
                <button
                  title="Delete"
                  onClick={() => {
                    if (window.confirm('Delete this note?')) save(notes.filter((x) => x.id !== n.id));
                  }}
                  className="p-2 rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
