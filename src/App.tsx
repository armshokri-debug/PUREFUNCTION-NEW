import React, { useEffect, useState } from 'react';
import { supabase } from './cloud/supabase';
import { ProfilePhotoButton } from './components/client/ProfilePhotoButton';
import { useSession, Profile } from './cloud/Session';
import { AuthScreen, LoadingScreen, NewPasswordScreen, NoAccessScreen } from './cloud/AuthScreen';
import { ClientsStore, SyncState, useCloudClientsStore, useLocalClientsStore } from './cloud/useClientsStore';
import { ExerciseLibraryProvider } from './state/ExerciseLibrary';
import { ReferView } from './components/client/ReferView';
import { ReferralLanding } from './components/ReferralLanding';
import { ReferralsPanel } from './components/coach/ReferralsPanel';
import { refCodeFromUrl } from './cloud/referrals';
import { createClientProfile } from './lib/clients';
import {
  Users,
  BookOpen,
  Dumbbell,
  MessageCircle,
  CalendarCheck,
  Gift,
  TrendingUp,
  Smartphone,
  Monitor,
  LogOut,
  Cloud,
  CloudOff,
  Loader2,
  UserPlus
} from 'lucide-react';
import {
  ClientProfile,
  ClientSection,
  ClientTab,
  CoachTab,
  Exercise,
  Role
} from './types';
import {
  addDays,
  adherence,
  blankWorkout,
  defaultBlockFor,
  startOfWeek,
  todayISO,
  upsertWorkout,
  workoutOn
} from './lib/workouts';
import { ClientAvatar, PureFunctionLogo } from './components/VisualAssets';
import { ClientsView } from './components/coach/ClientsView';
import { ClientDetail } from './components/coach/ClientDetail';
import { ProgramsView } from './components/coach/ProgramsView';
import { CoachMessages, ClientMessages, useUnreadCount } from './components/MessagesView';
import { ProgramTemplate, applyProgramTemplate } from './lib/programTemplates';
import { createTestClient } from './lib/testClient';
import { NutritionTodayCard } from './components/NutritionPanel';
import { CoachNotesCard } from './components/client/CoachNotesCard';
import { ExerciseLibraryView } from './components/coach/ExerciseLibraryView';
import { InstallCard } from './components/client/InstallCard';
import { ClientTodayView } from './components/client/ClientTodayView';
import { ClientProgressView } from './components/client/ClientProgressView';

const COACH_NAV_ITEMS: {
  id: CoachTab;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'clients', label: 'Clients', shortLabel: 'Clients', icon: Users },
  { id: 'library', label: 'Library', shortLabel: 'Library', icon: BookOpen },
  { id: 'programs', label: 'Programs', shortLabel: 'Programs', icon: Dumbbell },
  { id: 'messages', label: 'Messages', shortLabel: 'Messages', icon: MessageCircle }
];

/* ===========================================================================
 * Entry: local demo (no cloud configured) or signed-in cloud workspace
 * ======================================================================== */

export default function App() {
  const { status, profile } = useSession();
  if (status === 'local') return <LocalApp />;
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'signed-out') return <SignedOut />;
  if (status === 'no-access') return <NoAccessScreen />;
  if (status === 'reset') return <NewPasswordScreen />;
  return <CloudApp profile={profile!} />;
}

/** Invite links (?ref=CODE) show the referral form; everyone else sees sign-in. */
function SignedOut() {
  const [code, setCode] = useState(() => refCodeFromUrl());
  if (code) return <ReferralLanding code={code} onSignIn={() => setCode(null)} />;
  return <AuthScreen />;
}

function LocalApp() {
  const store = useLocalClientsStore();
  return (
    <ExerciseLibraryProvider>
      <Workspace store={store} profile={null} />
    </ExerciseLibraryProvider>
  );
}

function CloudApp({ profile }: { profile: Profile }) {
  const store = useCloudClientsStore(profile);
  if (!store.loaded) return <LoadingScreen label="Loading your data…" />;
  if (store.loadError) return <LoadingScreen label={`Couldn’t load data: ${store.loadError}`} />;
  return (
    <ExerciseLibraryProvider>
      <Workspace store={store} profile={profile} />
    </ExerciseLibraryProvider>
  );
}

const SyncBadge: React.FC<{ sync: SyncState; railOnTablet?: boolean }> = ({ sync, railOnTablet = false }) => {
  const map = {
    saved: { icon: <Cloud className="w-3.5 h-3.5" />, text: 'Saved', cls: 'text-gray-400' },
    saving: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: 'Saving…', cls: 'text-gray-500' },
    error: { icon: <CloudOff className="w-3.5 h-3.5" />, text: 'Not saved — retrying', cls: 'text-red-600' },
    offline: { icon: <CloudOff className="w-3.5 h-3.5" />, text: 'Offline — will save', cls: 'text-[#B45309]' }
  }[sync];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${map.cls}`}
      role="status"
      aria-live="polite"
      title={map.text}
    >
      {map.icon}
      <span className={railOnTablet ? 'hidden lg:inline' : ''}>{map.text}</span>
    </span>
  );
};

const NoClientsYet: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div className="max-w-md mx-auto text-center py-20">
    <div className="w-14 h-14 rounded-2xl bg-[#FEF3C7] flex items-center justify-center mx-auto mb-4">
      <UserPlus className="w-6 h-6 text-[#B45309]" />
    </div>
    <h2 className="text-xl font-bold text-[#111827] mb-1">Add your first client</h2>
    <p className="text-sm text-gray-500 mb-5">
      Add a client with their email. When they create an account with that email, they see their own program.
    </p>
    <button onClick={onAdd} className="bg-[#111827] text-white text-sm font-semibold px-5 py-3 rounded-xl cursor-pointer">
      Go to Clients
    </button>
  </div>
);

/** Tiny helpers: remember which page/client was open (per browser tab session). */
function readSaved(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSaved(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the page just won't be remembered */
  }
}

function Workspace({ store, profile }: { store: ClientsStore; profile: Profile | null }) {
  const { signOut } = useSession();
  const { clients, setClients, sync } = store;
  const isClientUser = profile?.role === 'client';
  const [roleState, setRole] = useState<Role>(isClientUser ? 'client' : 'coach');
  const role: Role = isClientUser ? 'client' : roleState;
  const [coachTab, setCoachTab] = useState<CoachTab>(() => {
    const saved = readSaved('pf.coachTab');
    return COACH_NAV_ITEMS.some((i) => i.id === saved) ? (saved as CoachTab) : 'clients';
  });
  const [clientTab, setClientTab] = useState<ClientTab>('today');
  const [selectedClientIdState, setSelectedClientId] = useState<string>(() => {
    const saved = readSaved('pf.clientId');
    return saved && clients.some((c) => c.id === saved) ? saved : clients[0]?.id ?? '';
  });
  useEffect(() => writeSaved('pf.coachTab', coachTab), [coachTab]);
  const [clientOpen, setClientOpen] = useState<boolean>(() => readSaved('pf.clientOpen') === '1');
  const [clientSection, setClientSection] = useState<ClientSection>(() => (readSaved('pf.clientSection') as ClientSection) || 'exercises');
  useEffect(() => writeSaved('pf.clientOpen', clientOpen ? '1' : '0'), [clientOpen]);
  useEffect(() => writeSaved('pf.clientSection', clientSection), [clientSection]);
  useEffect(() => writeSaved('pf.clientId', selectedClientIdState), [selectedClientIdState]);
  const selectedClientId = isClientUser ? profile!.clientId ?? '' : selectedClientIdState;
  const [clientPreviewFrame, setClientPreviewFrame] = useState<boolean>(false);

  const selectedClient: ClientProfile | undefined =
    clients.find((c) => c.id === selectedClientId) || (isClientUser ? undefined : clients[0]);
  const canPreviewClient = !!selectedClient;
  const unreadCount = useUnreadCount(role, role === 'client' ? selectedClient?.id ?? null : null);

  // Cloud: which clients have created their account (for "Not joined · Invite").
  const [joinedIds, setJoinedIds] = useState<Set<string> | undefined>(undefined);
  useEffect(() => {
    if (!supabase || profile?.role !== 'coach' || coachTab !== 'clients') return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('client_id')
      .eq('role', 'client')
      .then(({ data }) => {
        if (!cancelled && data) setJoinedIds(new Set(data.map((r: { client_id: string }) => r.client_id)));
      });
    return () => {
      cancelled = true;
    };
  }, [profile, coachTab, clients.length]);

  // Signed in: drop the invite parameter from the address bar.
  useEffect(() => {
    if (profile && window.location.search.includes('join=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [profile]);

  const handleUpdateClient = (updated: ClientProfile) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const handleSelectClient = (clientId: string, section: ClientSection = 'exercises') => {
    setSelectedClientId(clientId);
    setClientSection(section);
    setClientOpen(true);
    setCoachTab('clients');
  };

  const handleAddClient = (newClientData: {
    name: string;
    email: string;
    phaseNumber: 1 | 2 | 3 | 4;
    phaseName: ClientProfile['phaseName'];
  }) => {
    const created = createClientProfile(newClientData);
    setClients((prev) => [created, ...prev]);
    setSelectedClientId(created.id);
    return created.id;
  };

  const handleCreateTestClient = () => {
    if (clients.some((c) => c.isTestClient)) return;
    const sample = createTestClient();
    setClients((prev) => [sample, ...prev]);
    setSelectedClientId(sample.id);
  };

  const handleDeleteTestClient = (id: string) => {
    if (!clients.some((c) => c.id === id && c.isTestClient)) return;
    setClients((prev) => prev.filter((c) => c.id !== id || !c.isTestClient));
    if (selectedClientIdState === id) {
      setSelectedClientId('');
      setClientOpen(false);
    }
  };

  const handleApplyTemplate = (template: ProgramTemplate, ids: string[], start: string) => {
    setClients((prev) => applyProgramTemplate(prev, template, ids, start).clients);
  };

  const handleAddExerciseToClientWorkout = (
    clientId: string,
    date: string,
    exercise: Exercise
  ) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const existing = workoutOn(c, date) ?? blankWorkout(date);
        return upsertWorkout(c, {
          ...existing,
          blocks: [...existing.blocks, defaultBlockFor(exercise)]
        });
      })
    );
  };

  // Weekly adherence on the Clients list comes from real workouts this week.
  const weekStart = startOfWeek(todayISO());
  const clientsWithStats = clients.map((c) => {
    const a = adherence(c, weekStart, addDays(weekStart, 6));
    return { ...c, adherenceCompleted: a.completed, adherenceTotal: a.scheduled };
  });

  return (
    <div
      className={`min-h-screen bg-[#F7F8FA] text-[#111827] flex flex-col ${
        role === 'coach' ? 'md:flex-row' : ''
      }`}
    >
      {/* =====================================================================
          COACH DESKTOP SIDEBAR (Matches Mockups 1–9)
         ===================================================================== */}
      {role === 'coach' && (
        <aside className="no-print hidden md:flex md:w-[84px] lg:w-60 md:flex-col md:sticky md:top-0 md:h-dvh md:shrink-0 md:overflow-y-auto bg-[#EAECEF] border-r border-gray-300/80 px-2 lg:px-4 py-6 justify-between select-none z-30">
          <div>
            {/* Brand Logo placed directly above Clients */}
            <div
              onClick={() => setCoachTab('clients')}
              className="px-1 lg:px-3 pt-1 pb-7 cursor-pointer flex justify-center lg:block"
            >
              <span className="lg:hidden pf-sidebar-logo"><PureFunctionLogo compact /></span>
              <span className="hidden lg:block"><PureFunctionLogo /></span>
            </div>

            {/* Primary Navigation Links */}
            <nav className="space-y-1.5">
              {COACH_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = coachTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCoachTab(item.id)}
                    title={item.label}
                    className={`w-full flex items-center justify-center lg:justify-between px-1 lg:px-4 py-2 lg:py-2.5 rounded-2xl lg:rounded-full text-[10px] lg:text-sm transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#111827] text-white font-semibold shadow-xs'
                        : 'text-[#1F2937] hover:text-[#111827] hover:bg-gray-300/60 font-medium'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row items-center gap-1 lg:gap-3">
                      <Icon
                        className={`w-5 h-5 lg:w-4 lg:h-4 ${
                          isActive ? 'text-white' : 'text-[#374151]'
                        }`}
                      />
                      <span className="whitespace-nowrap">
                        <span className="lg:hidden">{item.shortLabel}</span>
                        <span className="hidden lg:inline">{item.label}</span>
                      {item.id === 'messages' && unreadCount > 0 && (
                        <span aria-label={`${unreadCount} unread messages`} className="inline-flex min-w-5 h-5 px-1 rounded-full bg-[#FFC809] text-[#111827] font-bold text-[10px] items-center justify-center">{unreadCount > 99 ? '99+' : unreadCount}</span>
                      )}
                      </span>
                    </div>
                    {isActive && (
                      <span className="hidden lg:block w-2 h-2 rounded-full bg-[#FFC809] shrink-0" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Active Client Context + Role Switcher (Coach / Client) */}
          <div className="space-y-3 pt-4 border-t border-gray-300/80">
            {selectedClient && (
              <div className="px-0 lg:px-2 flex items-center justify-center lg:justify-start gap-2.5" title={`Active client: ${selectedClient.name}`}>
                <ClientAvatar
                  photoUrl={selectedClient.photoUrl}
                  name={selectedClient.name}
                  size="sm"
                />
                <div className="min-w-0 hidden lg:block">
                  <div className="text-[11px] font-medium text-gray-600">Active Client</div>
                  <div className="text-xs font-semibold text-[#111827] truncate">
                    {selectedClient.name}
                  </div>
                </div>
              </div>
            )}

            {/* Role Toggle Pill (coach can preview the client's view) */}
            <div className="bg-gray-300/75 p-1 rounded-xl grid grid-cols-1 lg:grid-cols-2 gap-1">
              <button
                onClick={() => setRole('coach')}
                className="py-1.5 rounded-lg text-[10px] lg:text-xs font-semibold transition-colors cursor-pointer bg-white text-[#111827] shadow-2xs"
              >
                Coach
              </button>
              <button
                onClick={() => setRole('client')}
                disabled={!canPreviewClient}
                title={profile ? "Preview this client's app" : undefined}
                className="py-1.5 rounded-lg text-[10px] lg:text-xs font-medium text-[#1F2937] hover:text-[#111827] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Client
              </button>
            </div>

            {profile && (
              <div className="px-0 lg:px-2 flex flex-col lg:flex-row items-center lg:justify-between gap-1 lg:gap-2">
                <div className="min-w-0">
                  <div className="hidden lg:block text-xs font-semibold text-[#111827] truncate" title={profile.email}>
                    {profile.displayName || profile.email}
                  </div>
                  <SyncBadge sync={sync} railOnTablet />
                </div>
                <button
                  onClick={() => void signOut()}
                  aria-label="Sign out"
                  title="Sign out"
                  className="p-2 rounded-lg text-gray-600 hover:text-[#111827] hover:bg-gray-300/60 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* =====================================================================
          MOBILE & CLIENT TOP BAR
         ===================================================================== */}
      <header
        className={`no-print flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200/80 sticky top-0 z-30 ${
          role === 'coach' ? 'md:hidden' : 'w-full'
        }`}
      >
        <div
          onClick={() => {
            if (role === 'coach') setCoachTab('clients');
            else setClientTab('today');
          }}
          className="cursor-pointer"
        >
          <PureFunctionLogo compact />
        </div>

        <div className="flex items-center gap-2">
          {role === 'client' && (
            <button
              onClick={() => setClientPreviewFrame(!clientPreviewFrame)}
              title="Toggle mobile frame preview on desktop"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#111827] bg-gray-100 px-2.5 py-1.5 rounded-lg cursor-pointer"
            >
              {clientPreviewFrame ? (
                <>
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Full width</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Phone frame</span>
                </>
              )}
            </button>
          )}

          {profile && <SyncBadge sync={sync} />}

          {role === 'client' && selectedClient && (
            <ProfilePhotoButton client={selectedClient} onUpdateClient={handleUpdateClient} />
          )}

          {profile && (
            <button
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
              className={`p-2 rounded-lg text-gray-400 hover:text-[#111827] hover:bg-gray-100 cursor-pointer ${
                isClientUser ? '' : 'md:hidden'
              }`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          {/* Role Switcher in Header */}
          {!isClientUser && (
          <div className="bg-gray-100 p-0.5 rounded-xl inline-flex items-center">
            <button
              onClick={() => setRole('coach')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                role === 'coach'
                  ? 'bg-[#111827] text-white'
                  : 'text-gray-600 hover:text-[#111827]'
              }`}
            >
              Coach
            </button>
            <button
              onClick={() => setRole('client')}
              disabled={!canPreviewClient}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                role === 'client'
                  ? 'bg-[#111827] text-white'
                  : 'text-gray-600 hover:text-[#111827]'
              }`}
            >
              Client
            </button>
          </div>
          )}
        </div>
      </header>

      {/* =====================================================================
          MAIN VIEWPORT CANVAS
         ===================================================================== */}
      {role === 'coach' ? (
        <main className="flex-1 min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12">
          <div className="px-4 sm:px-8 lg:px-12 py-6 sm:py-10">
            {coachTab === 'clients' && clientOpen && selectedClient ? (
              <ClientDetail
                key={selectedClient.id}
                client={selectedClient}
                section={clientSection}
                onSection={setClientSection}
                onBack={() => setClientOpen(false)}
                onUpdateClient={handleUpdateClient}
                onAddExercise={handleAddExerciseToClientWorkout}
              />
            ) : (
              coachTab === 'clients' && (
                <>
                  <ClientsView
                    clients={clientsWithStats}
                    selectedClientId={selectedClientId}
                    onSelectClient={handleSelectClient}
                    onAddClient={handleAddClient}
                    onCreateTestClient={handleCreateTestClient}
                    onDeleteTestClient={handleDeleteTestClient}
                    onUpdateClient={handleUpdateClient}
                    joinedIds={joinedIds}
                  />
                  {supabase && <ReferralsPanel clients={clients} />}
                </>
              )
            )}

            {coachTab === 'programs' && !selectedClient && <NoClientsYet onAdd={() => setCoachTab('clients')} />}
            {coachTab === 'programs' && selectedClient && (
              <ProgramsView
                clients={clients}
                client={selectedClient}
                onSelectClientId={setSelectedClientId}
                onUpdateClient={handleUpdateClient}
                onApplyTemplate={handleApplyTemplate}
              />
            )}

            {coachTab === 'library' && (
              <ExerciseLibraryView
                clients={clients}
                selectedClient={selectedClient}
                onAddExerciseToClientWorkout={handleAddExerciseToClientWorkout}
              />
            )}

            {coachTab === 'messages' && <CoachMessages clients={clients} initialClientId={clientOpen ? selectedClient?.id : undefined} />}
          </div>
        </main>
      ) : (
        /* CLIENT MOBILE-FIRST VIEWPORT */
        <main className="flex-1 min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 px-4">
          <div
            className={
              clientPreviewFrame
                ? 'md:max-w-[430px] md:mx-auto md:bg-[#F7F8FA] md:rounded-[32px] md:border-[6px] md:border-[#111827] md:shadow-xl md:p-5 md:my-2'
                : 'max-w-xl mx-auto'
            }
          >
            {role === 'client' && !clientPreviewFrame && <InstallCard />}
            {!selectedClient ? (
              <div className="text-center text-sm text-gray-500 py-20">
                Your coach is setting up your profile. Pull to refresh in a moment.
              </div>
            ) : clientTab === 'today' ? (
              <>
              <CoachNotesCard client={selectedClient} />
              <NutritionTodayCard client={selectedClient} onUpdateClient={handleUpdateClient} />
              <ClientTodayView
                client={selectedClient}
                onUpdateClient={handleUpdateClient}
              />
              </>
            ) : clientTab === 'messages' ? (
              <ClientMessages clientId={selectedClient.id} />
            ) : clientTab === 'refer' ? (
              <ReferView firstName={selectedClient.name.split(' ')[0]} />
            ) : (
              <ClientProgressView client={selectedClient} onUpdateClient={handleUpdateClient} />
            )}
          </div>
        </main>
      )}

      {/* =====================================================================
          COACH MOBILE BOTTOM NAVIGATION BAR (< md)
         ===================================================================== */}
      {role === 'coach' && (
        <nav className="no-print md:hidden fixed bottom-0 inset-x-0 bg-[#EAECEF] border-t border-gray-300/80 z-40 grid grid-cols-4 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {COACH_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = coachTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCoachTab(item.id)}
                className={`relative min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#111827] text-white font-semibold'
                    : 'text-[#1F2937] font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className="w-4 h-4" />
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFC809] absolute -top-0.5 -right-1.5" />
                  )}
                </div>
                <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">
                  {item.shortLabel}
                </span>
                {item.id === 'messages' && unreadCount > 0 && (
                  <span aria-label={`${unreadCount} unread messages`} className="absolute top-0 right-1 rounded-full bg-[#FFC809] text-[#111827] min-w-5 h-5 px-1 text-[10px] font-bold">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* =====================================================================
          CLIENT BOTTOM NAVIGATION BAR (Today | My Progress)
         ===================================================================== */}
      {role === 'client' && (
        <nav className="no-print fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-md mx-auto grid grid-cols-4 gap-1.5 px-3 py-2">
            {([
              { id: 'today', label: 'Today', icon: CalendarCheck },
              { id: 'progress', label: 'Progress', icon: TrendingUp },
              { id: 'messages', label: 'Chat', icon: MessageCircle },
              { id: 'refer', label: 'Refer', icon: Gift }
            ] as const).map((t) => {
              const Icon = t.icon;
              const active = clientTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setClientTab(t.id)}
                  className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 py-2 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    active ? 'bg-[#111827] text-white' : 'text-gray-500 hover:text-[#111827]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                  {t.id === 'messages' && unreadCount > 0 && (
                    <span aria-label={`${unreadCount} unread messages`} className="absolute top-0 right-1 min-w-5 h-5 px-1 rounded-full bg-[#FFC809] text-[#111827] font-bold text-[10px]">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
