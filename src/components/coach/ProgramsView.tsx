import React from 'react';
import { ClientProfile } from '../../types';
import { WorkoutBuilderView } from './WorkoutBuilderView';
import { ProgramTemplates } from './ProgramTemplates';
import { ProgramTemplate } from '../../lib/programTemplates';

/** 12-week programs: pick a client, build week by week with the library beside the calendar. */
export const ProgramsView: React.FC<{
  clients: ClientProfile[];
  client: ClientProfile;
  onSelectClientId: (id: string) => void;
  onUpdateClient: (c: ClientProfile) => void;
  onApplyTemplate: (template: ProgramTemplate, ids: string[], start: string) => void;
}> = ({ clients, client, onSelectClientId, onUpdateClient, onApplyTemplate }) => (
  <div className="max-w-7xl mx-auto">
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl sm:text-[34px] font-bold tracking-tight text-[#111827]">Programs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Week-by-week plan for {client.name.split(' ')[0]} · Phase {client.phaseNumber} ({client.phaseName}) · copy a week forward to build the next 12 weeks
        </p>
      </div>
      <select
        value={client.id}
        onChange={(e) => onSelectClientId(e.target.value)}
        aria-label="Program for client"
        className="border border-gray-200 rounded-full px-4 py-2.5 bg-white text-sm font-semibold text-[#111827] cursor-pointer"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
    <ProgramTemplates key={client.id} clients={clients} client={client} onApply={onApplyTemplate} />
    <div className="pf-embed pf-programs">
      <WorkoutBuilderView clients={[client]} client={client} onSelectClientId={() => {}} onUpdateClient={onUpdateClient} />
    </div>
  </div>
);
