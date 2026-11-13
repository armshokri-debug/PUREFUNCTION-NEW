import React from 'react';
import { MessageSquareQuote } from 'lucide-react';
import { ClientProfile } from '../../types';
import { formatDate } from '../../lib/workouts';

/** Notes the coach chose to share, newest (pinned first). */
export const CoachNotesCard: React.FC<{ client: ClientProfile }> = ({ client }) => {
  const notes = (client.coachNotes ?? [])
    .filter((n) => n.shared)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date))
    .slice(0, 2);
  if (!notes.length) return null;
  return (
    <section className="bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-5 mb-4">
      <h2 className="text-sm font-bold text-[#111827] flex items-center gap-2">
        <MessageSquareQuote className="w-4 h-4 text-[#B45309]" /> From your coach
      </h2>
      <ul className="mt-2 divide-y divide-gray-100">
        {notes.map((n) => (
          <li key={n.id} className="py-2.5">
            <p className="text-sm text-[#111827] whitespace-pre-wrap">{n.text}</p>
            <span className="text-[11px] text-gray-400">{formatDate(n.date)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
