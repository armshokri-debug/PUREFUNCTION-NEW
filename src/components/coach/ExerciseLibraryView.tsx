import React, { useMemo, useState } from 'react';
import {
  Search,
  X,
  Plus,
  Check,
  Wind,
  Target,
  Pencil,
  Video,
  Star
} from 'lucide-react';
import {
  ClientProfile,
  Exercise,
  EQUIPMENT,
  PATTERNS,
  PLANES
} from '../../types';
import { searchExercises, useExerciseLibrary } from '../../state/ExerciseLibrary';
import { MUSCLE_GROUPS, equipmentTypeOf, groupOf, suggestQuery, SearchFilters } from '../../lib/exerciseSearch';
import { useFavorites } from '../../state/favorites';
import { formatDate, todayISO } from '../../lib/workouts';
import { ExerciseThumb, ExerciseVideoPlayer } from '../ExerciseMedia';
import { ExerciseEditorModal } from './ExerciseEditorModal';

interface ExerciseLibraryViewProps {
  clients: ClientProfile[];
  selectedClient?: ClientProfile;
  onAddExerciseToClientWorkout: (
    clientId: string,
    date: string,
    exercise: Exercise
  ) => void;
}

const PAGE = 48;

export const ExerciseLibraryView: React.FC<ExerciseLibraryViewProps> = ({
  clients,
  selectedClient,
  onAddExerciseToClientWorkout
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<NonNullable<SearchFilters['scope']>>('all');
  const [group, setGroup] = useState<string>('All');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('All');
  const [selectedPlane, setSelectedPlane] = useState<string>('All');
  const [selectedPattern, setSelectedPattern] = useState<string>('All');
  const [sort, setSort] = useState<'best' | 'az'>('best');
  const [shown, setShown] = useState(PAGE);
  const { exercises, catalogLoaded, getExercise, saveExercise, deleteExercise } = useExerciseLibrary();
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const activeExercise = activeExerciseId ? getExercise(activeExerciseId) ?? null : null;
  const setActiveExercise = (ex: Exercise | null) => setActiveExerciseId(ex?.id ?? null);
  // undefined = closed, null = new exercise, Exercise = editing
  const [editing, setEditing] = useState<Exercise | null | undefined>(undefined);
  const [targetClientId, setTargetClientId] = useState(selectedClient?.id ?? clients[0]?.id ?? '');
  const [targetDate, setTargetDate] = useState(todayISO());
  const [added, setAdded] = useState<string | null>(null);
  const targetClient = clients.find((c) => c.id === targetClientId);

  const filters: SearchFilters = {
    scope,
    group,
    equipment: selectedEquipment,
    plane: selectedPlane,
    pattern: selectedPattern
  };
  const filteredExercises = useMemo(
    () => searchExercises(exercises, searchQuery, filters, { favorites, sort }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercises, searchQuery, scope, group, selectedEquipment, selectedPlane, selectedPattern, favorites, sort]
  );
  const visibleExercises = filteredExercises.slice(0, shown);
  const suggestion = useMemo(
    () => (filteredExercises.length === 0 && searchQuery.trim() ? suggestQuery(exercises, searchQuery) : null),
    [filteredExercises.length, exercises, searchQuery]
  );
  const anyFilter =
    scope !== 'all' || group !== 'All' || selectedEquipment !== 'All' || selectedPlane !== 'All' || selectedPattern !== 'All' || !!searchQuery;
  const reset = () => {
    setScope('all');
    setGroup('All');
    setSelectedEquipment('All');
    setSelectedPlane('All');
    setSelectedPattern('All');
    setSearchQuery('');
    setShown(PAGE);
  };
  const filterChanged = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setShown(PAGE);
  };

  const quickAdd = (exercise: Exercise) => {
    if (!targetClientId) return;
    onAddExerciseToClientWorkout(targetClientId, targetDate, exercise);
    setAdded(`${exercise.name} → ${targetClient?.name.split(' ')[0] ?? ''}, ${formatDate(targetDate, { weekday: true })}`);
    window.setTimeout(() => setAdded(null), 2200);
  };
  const scopes: [NonNullable<SearchFilters['scope']>, string][] = [
    ['all', 'All'],
    ['pf', 'Pure Function'],
    ['mine', 'Mine'],
    ['favorites', 'Favorites'],
    ['video', 'With video']
  ];

  const field =
    'border border-gray-200 rounded-lg px-2.5 py-2 text-base sm:text-xs font-medium text-[#111827] bg-white focus:outline-none focus:border-[#111827]';

  const detail = activeExercise && (
    <>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          {activeExercise.phase && (
            <span className="inline-flex items-center bg-[#FEF3C7] text-[#92400E] text-[11px] font-semibold px-2.5 py-0.5 rounded-full mb-1.5">
              Phase: {activeExercise.phase}
            </span>
          )}
          <h2 className="text-xl font-bold text-[#111827]">{activeExercise.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {[groupOf(activeExercise), activeExercise.pattern, activeExercise.plane && `${activeExercise.plane} plane`, equipmentTypeOf(activeExercise)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {activeExercise.muscles && activeExercise.muscles.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{activeExercise.muscles.join(', ')}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => toggleFavorite(activeExercise.id)}
            aria-label={favorites.has(activeExercise.id) ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={favorites.has(activeExercise.id)}
            className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            <Star className={`w-4 h-4 ${favorites.has(activeExercise.id) ? 'fill-[#FFC809] text-[#FFC809]' : 'text-gray-400'}`} />
          </button>
          <button
            onClick={() => setActiveExercise(null)}
            className="p-2 rounded-lg text-gray-400 hover:text-[#111827] hover:bg-gray-100 cursor-pointer"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <ExerciseVideoPlayer video={activeExercise.video} title={activeExercise.name} />
      </div>
      <button
        onClick={() => setEditing(activeExercise)}
        className="w-full inline-flex items-center justify-center gap-2 mb-4 border border-gray-200 hover:border-[#111827] text-[#111827] text-xs font-semibold py-2.5 rounded-xl cursor-pointer"
      >
        {activeExercise.video ? (
          <>
            <Pencil className="w-3.5 h-3.5" /> Edit exercise / replace video
          </>
        ) : (
          <>
            <Video className="w-3.5 h-3.5" /> Add your video
          </>
        )}
      </button>

      {activeExercise.breathingPattern && (
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 mb-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111827] mb-1">
            <Wind className="w-3.5 h-3.5 text-[#F5B800]" />
            <span>Breathing</span>
          </div>
          <p className="text-xs text-gray-600">{activeExercise.breathingPattern}</p>
        </div>
      )}

      {activeExercise.cues.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5">Coaching cues</h3>
          <ol className="space-y-2">
            {activeExercise.cues.map((cue, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-[#111827]">
                <span className="w-4 h-4 rounded-full bg-[#111827] text-[#FFC809] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                  {idx + 1}
                </span>
                <span className="leading-relaxed text-gray-700">{cue}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {activeExercise.whyItMatters && (
        <div className="mb-4 p-3 rounded-xl bg-[#FFFDF5] border border-[#FEF3C7]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111827] mb-1">
            <Target className="w-3.5 h-3.5 text-[#F5B800]" />
            <span>Why it matters</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{activeExercise.whyItMatters}</p>
        </div>
      )}

      {clients.length > 0 && (
        <button
          onClick={() => quickAdd(activeExercise)}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium py-3 px-4 rounded-xl cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#FFC809]" />
          <span>
            Add to {targetClient?.name.split(' ')[0]} · {formatDate(targetDate, { weekday: true })}
          </span>
        </button>
      )}
    </>
  );

  return (
    <div className="max-w-6xl mx-auto relative">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h1 className="text-3xl sm:text-[34px] font-bold tracking-tight text-[#111827]">Exercise Library</h1>
        <button
          onClick={() => setEditing(null)}
          className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New exercise</span>
        </button>
      </div>

      {/* where "+" adds to */}
      {clients.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-100 rounded-2xl px-3.5 py-2.5 mb-4">
          <span className="text-xs font-semibold text-gray-500">Adding to</span>
          <select value={targetClientId} onChange={(e) => setTargetClientId(e.target.value)} aria-label="Add to client" className={field}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => e.target.value && setTargetDate(e.target.value)}
            aria-label="Add on date"
            className={field}
          />
          <span className="text-xs text-gray-400 hidden sm:inline">Tap + on any exercise to add it.</span>
        </div>
      )}

      {/* search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShown(PAGE);
          }}
          aria-label="Search exercises"
          placeholder={`Search ${exercises.length.toLocaleString()} exercises…`}
          className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-base sm:text-sm text-[#111827] placeholder:text-gray-400 focus:outline-none focus:border-[#111827]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-[#111827] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-400 mb-2.5 -mt-1">Try “db press”, “rdl”, “glutes” or “single leg”.</p>

      {/* scope */}
      <div className="flex flex-wrap min-w-0 gap-1.5 pb-2" role="tablist" aria-label="Show">
        {scopes.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={scope === k}
            onClick={() => filterChanged(setScope)(k)}
            className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
              scope === k ? 'bg-[#111827] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:text-[#111827]'
            }`}
          >
            {k === 'favorites' && <Star className="inline w-3 h-3 mr-1 -mt-0.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* muscle group */}
      <div className="flex flex-wrap min-w-0 gap-1.5 pb-2" role="group" aria-label="Muscle group">
        {['All', ...MUSCLE_GROUPS].map((g) => (
          <button
            key={g}
            onClick={() => filterChanged(setGroup)(g)}
            aria-pressed={group === g}
            className={`min-h-[44px] px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer ${
              group === g ? 'bg-[#FFC809] text-[#111827] font-semibold' : 'bg-[#F3F4F6] text-gray-600 hover:text-[#111827]'
            }`}
          >
            {g === 'All' ? 'All muscles' : g}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select value={selectedEquipment} onChange={(e) => filterChanged(setSelectedEquipment)(e.target.value)} aria-label="Equipment" className={field}>
          <option value="All">Any equipment</option>
          {EQUIPMENT.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select value={selectedPattern} onChange={(e) => filterChanged(setSelectedPattern)(e.target.value)} aria-label="Movement pattern" className={field}>
          <option value="All">Any pattern</option>
          {PATTERNS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select value={selectedPlane} onChange={(e) => filterChanged(setSelectedPlane)(e.target.value)} aria-label="Plane of motion" className={field}>
          <option value="All">Any plane</option>
          {PLANES.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'best' | 'az')} aria-label="Sort" className={field}>
          <option value="best">Best match</option>
          <option value="az">A → Z</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto tabular-nums" aria-live="polite">
          {filteredExercises.length.toLocaleString()} {filteredExercises.length === 1 ? 'exercise' : 'exercises'}
        </span>
        {anyFilter && (
          <button onClick={reset} className="text-xs font-medium text-gray-500 hover:text-[#111827] underline cursor-pointer">
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* results */}
        <div className={`${activeExercise ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} grid grid-cols-1 ${activeExercise ? '' : 'lg:grid-cols-2'} gap-2.5`}>
          {visibleExercises.map((exercise) => {
            const isSelected = activeExercise?.id === exercise.id;
            const fav = favorites.has(exercise.id);
            return (
              <div
                key={exercise.id}
                onClick={() => setActiveExercise(exercise)}
                className={`bg-white rounded-2xl p-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                  isSelected ? 'border-[1.5px] border-[#111827]' : 'border border-gray-100 hover:border-gray-300'
                }`}
              >
                <ExerciseThumb exercise={exercise} compact className="w-24 aspect-video shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[#111827] line-clamp-2 leading-snug" title={exercise.name}>
                    {exercise.name}
                  </h3>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {groupOf(exercise)} · {equipmentTypeOf(exercise)}
                    {(exercise.source === 'coach' || exercise.isCustom) && <span className="text-[#92400E] font-semibold"> · Yours</span>}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(exercise.id);
                  }}
                  aria-label={fav ? `Remove ${exercise.name} from favorites` : `Favorite ${exercise.name}`}
                  aria-pressed={fav}
                  className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer shrink-0"
                >
                  <Star className={`w-4 h-4 ${fav ? 'fill-[#FFC809] text-[#FFC809]' : 'text-gray-300'}`} />
                </button>
                {clients.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      quickAdd(exercise);
                    }}
                    aria-label={`Add ${exercise.name} to workout`}
                    className="w-10 h-10 rounded-xl bg-[#111827] text-[#FFC809] flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* details: side panel on desktop, bottom sheet on phones */}
        {activeExercise && (
          <>
            <div className="lg:hidden fixed inset-0 z-[60] bg-black/40" onClick={() => setActiveExercise(null)} aria-hidden />
            <aside
              aria-label="Exercise details"
              className="fixed inset-x-0 bottom-0 z-[65] max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl lg:static lg:z-auto lg:max-h-none lg:col-span-5 xl:col-span-4 lg:rounded-2xl lg:border lg:border-gray-100 lg:shadow-[0_4px_20px_rgba(0,0,0,0.06)] lg:sticky lg:top-6 lg:p-6"
            >
              {detail}
            </aside>
          </>
        )}
      </div>

      {filteredExercises.length > shown && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setShown((n) => n + PAGE)}
            className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-[#111827] hover:border-[#111827] cursor-pointer"
          >
            Show more ({(filteredExercises.length - shown).toLocaleString()} left)
          </button>
        </div>
      )}
      {filteredExercises.length === 0 && (
        <div className="text-sm text-gray-500 py-10 text-center space-y-2">
          <p>
            {!catalogLoaded
              ? 'Loading exercises…'
              : scope === 'favorites' && !anyFilterBesidesScope(searchQuery, group, selectedEquipment, selectedPlane, selectedPattern)
              ? 'No favorites yet. Tap the star on an exercise to keep it here.'
              : 'No exercises match.'}
          </p>
          {suggestion && (
            <p>
              Did you mean{' '}
              <button onClick={() => setSearchQuery(suggestion)} className="font-semibold text-[#111827] underline cursor-pointer">
                {suggestion}
              </button>
              ?
            </p>
          )}
          {anyFilter && catalogLoaded && (
            <button onClick={reset} className="text-xs font-medium underline cursor-pointer">
              Clear search and filters
            </button>
          )}
        </div>
      )}

      {added && (
        <div role="status" className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[70] bg-[#111827] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg inline-flex items-center gap-2 max-w-[92vw]">
          <Check className="w-4 h-4 text-[#FFC809] shrink-0" />
          <span className="truncate">Added: {added}</span>
        </div>
      )}

      {editing !== undefined && (
        <ExerciseEditorModal
          exercise={editing}
          onSave={(ex) => {
            saveExercise(ex);
            setActiveExerciseId(ex.id);
          }}
          onDelete={(id) => {
            deleteExercise(id);
            setActiveExerciseId(null);
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
};

function anyFilterBesidesScope(q: string, ...rest: string[]): boolean {
  return !!q || rest.some((r) => r !== 'All');
}
