import React, { useState } from 'react';
import { Search, Plus, X, ArrowUpRight, ClipboardCheck, Dumbbell, LineChart, FileText, Send } from 'lucide-react';
import { ClientInviteModal } from './ClientInviteModal';
import { ClientProfile, ClientSection } from '../../types';
import { ClientAvatar } from '../VisualAssets';

interface ClientsViewProps {
  clients: ClientProfile[];
  selectedClientId: string;
  onSelectClient: (clientId: string, targetTab?: ClientSection) => void;
  onAddClient: (newClient: {
    name: string;
    email: string;
    phaseNumber: 1 | 2 | 3 | 4;
    phaseName: ClientProfile['phaseName'];
  }) => string | void;
  onUpdateClient?: (updated: ClientProfile) => void;
  onCreateTestClient: () => void;
  onDeleteTestClient: (id: string) => void;
  /** client ids that have an account (cloud only; undefined in demo mode) */
  joinedIds?: Set<string>;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  selectedClientId,
  onSelectClient,
  onAddClient,
  onUpdateClient,
  onCreateTestClient,
  onDeleteTestClient,
  joinedIds
}) => {
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const inviteClient = clients.find((c) => c.id === inviteFor);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhase, setNewPhase] = useState<string>('1-Reposition');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phaseName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Enter the email your client will sign in with.');
      return;
    }
    if (clients.some((c) => (c.email ?? '').toLowerCase() === email)) {
      setFormError('A client with this email already exists.');
      return;
    }
    setFormError(null);
    const [numStr, pName] = newPhase.split('-');
    const newId = onAddClient({
      name: newName.trim(),
      email,
      phaseNumber: Number(numStr) as 1 | 2 | 3 | 4,
      phaseName: pName as ClientProfile['phaseName']
    });
    setNewName('');
    setNewEmail('');
    setIsAddModalOpen(false);
    // Cloud: right after adding, show the invite to send (like TrueCoach)
    if (newId && joinedIds) setInviteFor(newId);
  };

  // Real numbers: clients, assessments due within 5 days, workouts completed this week
  const activeCount = clients.length;
  const assessmentsDueCount = clients.filter((c) => c.nextAssessmentDays <= 5).length;
  const weekDone = clients.reduce((a, c) => a + c.adherenceCompleted, 0);
  const weekTotal = clients.reduce((a, c) => a + c.adherenceTotal, 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Title */}
      <h1 className="text-3xl sm:text-[34px] font-bold tracking-tight text-[#111827] mb-6">
        Clients
      </h1>

      {/* Top 3 Summary KPI Cards matching Mockup 6 */}
      <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-2xl mb-7">
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col justify-between">
          <div className="text-xs sm:text-[13px] font-medium text-gray-500 mb-1.5 leading-snug">
            Clients
          </div>
          <div className="text-2xl sm:text-[32px] font-bold text-[#F5B800] leading-none tabular-nums">
            {activeCount}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col justify-between">
          <div className="text-xs sm:text-[13px] font-medium text-gray-500 mb-1.5 leading-snug">
            Assessments due
          </div>
          <div className="text-2xl sm:text-[32px] font-bold text-[#111827] leading-none tabular-nums">
            {assessmentsDueCount}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col justify-between">
          <div className="text-xs sm:text-[13px] font-medium text-gray-500 mb-1.5 leading-snug">
            Workouts this week
          </div>
          <div className="text-2xl sm:text-[32px] font-bold text-[#111827] leading-none tabular-nums">
            {weekDone}
            <span className="text-base sm:text-lg text-gray-400 font-semibold">/{weekTotal}</span>
          </div>
        </div>
      </div>

      {/* Subtle Divider Line matching Mockup 6 */}
      <div className="border-t border-gray-200/80 mb-5" />

      {/* Search & Add Client Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-sm text-[#111827] placeholder:text-gray-400 focus:outline-none focus:border-[#111827] transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={clients.some((c) => c.isTestClient)} onClick={onCreateTestClient}
            className="min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl font-semibold text-sm disabled:opacity-50">
            + Test Client
          </button>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add client</span>
        </button>
        </div>
      </div>

      {/* Client List Card matching Mockup 6 */}
      <div className="@container bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100 divide-y divide-gray-100 overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <p className="text-sm text-gray-500 mb-3">
              {clients.length === 0
                ? 'No clients yet. Tap “Add client” and enter their email — they’ll use it to create their account.'
                : `No clients match "${searchQuery}".`}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-medium text-[#111827] underline cursor-pointer"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          filteredClients.map((client) => {
            const isSelected = client.id === selectedClientId;
            return (
              <div
                key={client.id}
                onClick={() => onSelectClient(client.id, 'exercises')}
                className={`group px-4 sm:px-6 py-4 flex flex-col @2xl:flex-row @2xl:items-center justify-between gap-4 transition-colors cursor-pointer ${
                  isSelected ? 'bg-gray-50/70' : 'hover:bg-gray-50/60'
                }`}
              >
                {/* Left: Avatar + Name + Phase Tag */}
                <div className="flex items-center gap-3.5 min-w-0 @2xl:w-[38%]">
                  <ClientAvatar name={client.name} photoUrl={client.photoUrl} />
                  <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                    <span className="text-[16px] font-semibold text-[#111827] truncate">
                      {client.name}
                    </span>
                    <span className="inline-flex items-center bg-[#F3F4F6] text-[#374151] text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
                      Phase {client.phaseNumber} · {client.phaseName}
                    </span>
                    {client.isTestClient && <span className="text-xs font-bold rounded-full bg-[#FEF3C7] px-3 py-1">DEMO — NOT REAL</span>}
                    {joinedIds && !joinedIds.has(client.id) && !client.isTestClient && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInviteFor(client.id);
                        }}
                        className="inline-flex items-center gap-1 bg-[#FEF3C7] text-[#92400E] text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap cursor-pointer"
                      >
                        <Send className="w-3 h-3" /> Not joined · Invite
                      </button>
                    )}
                  </div>
                </div>

                {/* Middle: Weekly Adherence 6-segment bar */}
                <div className="flex flex-col gap-1.5 @2xl:w-[28%]">
                  <div className="flex items-center justify-between w-full max-w-[168px]">
                    <span className="text-xs font-medium text-gray-600">
                      Weekly Adherence
                    </span>
                    <span className="text-[11px] text-gray-400 tabular-nums @2xl:hidden">
                      {client.adherenceCompleted}/{client.adherenceTotal}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1 w-full max-w-[168px]"
                    title={`${client.adherenceCompleted} of ${client.adherenceTotal} sessions completed`}
                  >
                    {Array.from({ length: client.adherenceTotal }).map((_, idx) => {
                      const filled = idx < client.adherenceCompleted;
                      return (
                        <div
                          key={idx}
                          className={`h-2 flex-1 rounded-sm transition-colors ${
                            filled ? 'bg-[#FFC809]' : 'bg-[#E5E7EB]'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Right: Next Assessment Date + Quick Actions */}
                <div className="flex flex-wrap items-center justify-between @2xl:justify-end gap-x-4 gap-y-2 @2xl:w-[34%]">
                  <div className="text-xs sm:text-[13px] text-gray-500 whitespace-nowrap tabular-nums">
                    Next assessment in{' '}
                    <span className="font-semibold text-[#111827]">
                      {client.nextAssessmentDays} days
                    </span>
                  </div>

                  {client.isTestClient && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete the TEST CLIENT and all of its demo workouts and assessments?')) onDeleteTestClient(client.id); }}
                      className="min-h-[44px] px-3 rounded-lg border border-red-200 text-red-700 text-xs font-semibold">Delete test client</button>
                  )}
                  {/* Quick contextual shortcuts for Coach */}
                  <div
                    className="flex items-center gap-1 opacity-100 [@media(hover:hover)]:@2xl:opacity-0 [@media(hover:hover)]:@2xl:group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onUpdateClient && (
                      <button
                        onClick={() => setInviteFor(client.id)}
                        title="Edit client & invite"
                        aria-label={`Edit ${client.name} and invite`}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-[#111827] hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onSelectClient(client.id, 'assessment')}
                      title="New Assessment"
                      className="p-1.5 rounded-lg text-gray-500 hover:text-[#111827] hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onSelectClient(client.id, 'exercises')}
                      title="Workout Builder"
                      className="p-1.5 rounded-lg text-gray-500 hover:text-[#111827] hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <Dumbbell className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onSelectClient(client.id, 'progression')}
                      title="Progress"
                      className="p-1.5 rounded-lg text-gray-500 hover:text-[#111827] hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <LineChart className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onSelectClient(client.id, 'assessment')}
                      title="Monthly Report"
                      className="p-1.5 rounded-lg text-gray-500 hover:text-[#111827] hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {inviteClient && onUpdateClient && (
        <ClientInviteModal
          client={inviteClient}
          clients={clients}
          joined={joinedIds ? joinedIds.has(inviteClient.id) : null}
          onSave={onUpdateClient}
          onClose={() => setInviteFor(null)}
        />
      )}

      {/* Add Client Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#111827]">Add New Client</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#111827] hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Jordan Taylor"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-[#111827] focus:outline-none focus:border-[#111827]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jordan.taylor@example.com"
                  autoComplete="off"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-[#111827] focus:outline-none focus:border-[#111827]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Starting Phase
                </label>
                <select
                  value={newPhase}
                  onChange={(e) => setNewPhase(e.target.value as typeof newPhase)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-[#111827] bg-white focus:outline-none focus:border-[#111827]"
                >
                  <option value="1-Reposition">Phase 1 · Reposition</option>
                  <option value="2-Integrate">Phase 2 · Integrate</option>
                  <option value="3-Strength">Phase 3 · Strength</option>
                  <option value="4-Performance">Phase 4 · Performance</option>
                </select>
              </div>

              <p className="text-xs text-gray-500 -mt-1">
                Your client creates their account with this email to see their program.
              </p>
              {formError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2" role="alert">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Add client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
