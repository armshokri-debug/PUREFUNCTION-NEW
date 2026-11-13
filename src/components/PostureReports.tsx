import React, { useEffect, useState } from 'react';
import { supabase } from '../cloud/supabase';

/** Only the server's client-safe published projection is shown here. */
export function PostureReports({ clientId }: { clientId: string }) {
  const [reports, setReports] = useState<{ assessment_id: string; data: { recordedAt?: string; summary?: string; summaryApprovedByCoach?: boolean } }[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true; setReports([]); setError(false);
    if (supabase) void supabase.from('posture_public_reports').select('assessment_id,data')
      .eq('client_id', clientId).order('created_at', { ascending: false }).then(({ data, error: err }) => {
        if (active) { setReports(data ?? []); setError(!!err); }
      });
    return () => { active = false; };
  }, [clientId]);
  if (!supabase || (!error && !reports.length)) return null;
  return <section className="bg-white rounded-[28px] border border-gray-100 p-4 sm:p-6 my-4">
    <h2 className="text-sm font-bold">Posture Overview · published reports</h2>
    {error && <p role="status" className="text-sm text-gray-500">Published reports are temporarily unavailable.</p>}
    {reports.filter((r) => r.data.summaryApprovedByCoach).map((r) => <article key={r.assessment_id} className="py-3 text-sm">
      <p className="text-gray-500">{r.data.recordedAt?.slice(0, 10)}</p>
      <p className="whitespace-pre-wrap break-words">{r.data.summary}</p>
    </article>)}
  </section>;
}
