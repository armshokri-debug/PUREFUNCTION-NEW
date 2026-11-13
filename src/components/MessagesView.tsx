import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Paperclip, Send, X } from 'lucide-react';
import { ClientProfile } from '../types';
import { Message, mediaUrl, messagesErrorText, useMessages } from '../cloud/messages';
import { ClientAvatar } from './VisualAssets';

const MAX = 50 * 1024 * 1024;

const Media: React.FC<{ m: Message }> = ({ m }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (m.attachmentPath) mediaUrl(m.attachmentPath).then(setUrl);
  }, [m.attachmentPath]);
  if (!m.attachmentPath) return null;
  if (!url) return <div className="w-48 h-32 rounded-2xl bg-black/10 animate-pulse" />;
  return m.attachmentType === 'video' ? (
    <video src={url} controls playsInline className="w-56 max-w-full rounded-2xl" />
  ) : (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Attachment" className="w-56 max-w-full rounded-2xl" />
    </a>
  );
};

const time = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/** One conversation. `me` = which side is typing. */
export const Thread: React.FC<{
  clientId: string;
  me: 'coach' | 'client';
  title: string;
  subtitle?: string;
  avatar?: React.ReactNode;
  onBack?: () => void;
  data: ReturnType<typeof useMessages>;
}> = ({ clientId, me, title, subtitle, avatar, onBack, data }) => {
  const { messages, error, send, markRead } = data;
  const thread = useMemo(() => messages.filter((m) => m.clientId === clientId), [messages, clientId]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
    const unread = thread.filter((m) => !m.readAt && m.fromCoach === (me === 'client')).map((m) => m.id);
    if (unread.length) markRead(unread);
  }, [thread.length, me, markRead]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    setErr(null);
    try {
      await send({ clientId, fromCoach: me === 'coach', body: text, file: file ?? undefined });
      setText('');
      setFile(null);
    } catch (x) {
      setErr(messagesErrorText(x));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100">
        {onBack && (
          <button onClick={onBack} aria-label="Back" className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer md:hidden">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        {avatar}
        <div className="min-w-0">
          <div className="text-sm font-bold text-[#111827] truncate">{title}</div>
          {subtitle && <div className="text-xs text-gray-500 truncate">{subtitle}</div>}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-2 bg-[#F7F8FA]">
        {error && <p className="text-sm text-gray-500 text-center py-10">{error}</p>}
        {!error && !thread.length && <p className="text-sm text-gray-500 text-center py-10">No messages yet. Say hi 👋</p>}
        {thread.map((m) => {
          const mine = m.fromCoach === (me === 'coach');
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <Media m={m} />
                {m.body && (
                  <div className={`px-4 py-2.5 rounded-[20px] text-sm leading-relaxed whitespace-pre-wrap ${mine ? 'bg-[#111827] text-white rounded-br-md' : 'bg-white border border-gray-100 text-[#111827] rounded-bl-md'}`}>
                    {m.body}
                  </div>
                )}
                <span className="text-[10.5px] text-gray-400 px-1">
                  {time(m.createdAt)}
                  {mine && m.readAt ? ' · Seen' : ''}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="p-3 border-t border-gray-100 bg-white">
        {file && (
          <div className="flex items-center gap-2 mb-2 text-xs bg-gray-100 rounded-full px-3 py-1.5 w-max max-w-full">
            <span className="truncate">{file.name}</span>
            <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment" className="cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
        <div className="flex items-end gap-2">
          <input
            ref={fileIn}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && f.size > MAX) setErr('File is larger than 50 MB.');
              else setFile(f ?? null);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={() => fileIn.current?.click()} aria-label="Attach photo or video" className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer shrink-0">
            <Paperclip className="w-4 h-4 text-gray-500" />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={`Message ${title.split(' ')[0]}…`}
            className="flex-1 resize-none border border-gray-200 rounded-[22px] px-4 py-2.5 text-sm focus:outline-none focus:border-[#111827] max-h-32"
          />
          <button type="submit" disabled={sending || (!text.trim() && !file)} aria-label="Send" className="w-10 h-10 rounded-full bg-[#FFC809] text-[#111827] flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
};

/** Coach inbox: list of clients + one open thread. */
export const CoachMessages: React.FC<{ clients: ClientProfile[]; initialClientId?: string }> = ({ clients, initialClientId }) => {
  const data = useMessages(null);
  const [open, setOpen] = useState<string | null>(initialClientId ?? null);
  const lastBy = useMemo(() => {
    const m = new Map<string, Message>();
    data.messages.forEach((x) => m.set(x.clientId, x));
    return m;
  }, [data.messages]);
  const unread = (id: string) => data.messages.filter((m) => m.clientId === id && !m.fromCoach && !m.readAt).length;
  const sorted = [...clients].sort((a, b) => (lastBy.get(b.id)?.createdAt ?? '').localeCompare(lastBy.get(a.id)?.createdAt ?? ''));
  const current = clients.find((c) => c.id === open);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl sm:text-[34px] font-bold tracking-tight text-[#111827] mb-5">Messages</h1>
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] overflow-hidden grid md:grid-cols-[300px_minmax(0,1fr)] h-[calc(100vh-220px)] min-h-[480px]">
        <ul className={`border-r border-gray-100 overflow-y-auto p-2 ${current ? 'hidden md:block' : ''}`}>
          {sorted.map((c) => {
            const last = lastBy.get(c.id);
            const u = unread(c.id);
            return (
              <li key={c.id}>
                <button onClick={() => setOpen(c.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[18px] text-left cursor-pointer ${open === c.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                  <ClientAvatar name={c.name} photoUrl={c.photoUrl} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#111827] truncate">{c.name}</div>
                    <div className="text-xs text-gray-500 truncate">{last ? `${last.fromCoach ? 'You: ' : ''}${last.body || (last.attachmentType === 'video' ? '🎥 Video' : '📷 Photo')}` : 'No messages yet'}</div>
                  </div>
                  {u > 0 && <span className="bg-[#FFC809] text-[#111827] text-[11px] font-bold rounded-full px-2 py-0.5">{u}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className={`min-h-0 ${current ? '' : 'hidden md:flex md:items-center md:justify-center'}`}>
          {current ? (
            <Thread
              key={current.id}
              clientId={current.id}
              me="coach"
              title={current.name}
              subtitle={`Week ${current.currentWeek} · ${current.phaseName}`}
              avatar={<ClientAvatar name={current.name} photoUrl={current.photoUrl} />}
              onBack={() => setOpen(null)}
              data={data}
            />
          ) : (
            <p className="text-sm text-gray-500">Pick a client to start chatting.</p>
          )}
        </div>
      </div>
    </div>
  );
};

/** Client side: one thread with the coach. */
export const ClientMessages: React.FC<{ clientId: string }> = ({ clientId }) => {
  const data = useMessages(clientId);
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] overflow-hidden h-[calc(100vh-190px)] min-h-[420px]">
        <Thread clientId={clientId} me="client" title="Coach" subtitle="Pure Function" data={data} />
      </div>
    </div>
  );
};

/** Unread count badge source for navigation. */
export function useUnreadCount(role: 'coach' | 'client', clientId: string | null): number {
  const { messages } = useMessages(role === 'client' ? clientId : null);
  return messages.filter((m) => !m.readAt && (role === 'coach' ? !m.fromCoach : m.fromCoach)).length;
}
