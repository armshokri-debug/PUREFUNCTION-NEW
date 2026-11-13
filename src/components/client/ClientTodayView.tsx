import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  MessageSquare,
  PartyPopper
} from 'lucide-react';
import { ClientProfile, SetLog, Workout, WorkoutBlock } from '../../types';
import { useExerciseLibrary } from '../../state/ExerciseLibrary';
import { isNewRecord } from '../../lib/records';
import { WEIGHT_UNIT, formatWeight, roundLb } from '../../lib/units';
import { WeightInput } from '../WeightInput';
import { ExerciseVideoPlayer } from '../ExerciseMedia';
import {
  addDays,
  dayShort,
  effectiveStatus,
  formatDate,
  formatPerformance,
  lastPerformance,
  orderLabels,
  parseISODate,
  parseReps,
  startOfWeek,
  suggestLoad,
  todayISO,
  upsertWorkout,
  weekDates,
  workoutOn
} from '../../lib/workouts';

interface ClientTodayViewProps {
  client: ClientProfile;
  onUpdateClient: (updated: ClientProfile) => void;
}

const card = 'bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100';
const cellInput =
  'w-full min-w-0 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-base text-[#111827] tabular-nums text-center focus:outline-none focus:border-[#111827] disabled:bg-gray-50 disabled:text-gray-500';

export const ClientTodayView: React.FC<ClientTodayViewProps> = ({ client, onUpdateClient }) => {
  const today = todayISO();
  const { getExercise } = useExerciseLibrary();
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [date, setDate] = useState(today);
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [videoFor, setVideoFor] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');

  const workout = workoutOn(client, date);

  useEffect(() => {
    if (!rest) return;
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= rest.endsAt) setRest(null);
    }, 250);
    return () => window.clearInterval(t);
  }, [rest]);

  /* ---------------- saving ---------------- */

  const save = (w: Workout) => onUpdateClient(upsertWorkout(client, w));

  const patchBlock = (blockId: string, patch: Partial<WorkoutBlock>) => {
    if (!workout) return;
    save({ ...workout, blocks: workout.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) });
  };

  const patchSet = (block: WorkoutBlock, setNumber: number, patch: Partial<SetLog>) => {
    patchBlock(block.id, {
      loggedSets: block.loggedSets.map((s) => (s.setNumber === setNumber ? { ...s, ...patch } : s))
    });
  };

  const toggleSet = (block: WorkoutBlock, s: SetLog) => {
    if (s.completed) {
      patchSet(block, s.setNumber, { completed: false });
      return;
    }
    const target = parseReps(block.reps);
    const reps = s.reps ?? (target.kind === 'reps' && target.max > 0 ? target.max : target.kind === 'time' ? target.min : null);
    patchSet(block, s.setNumber, { completed: true, reps, kg: s.kg ?? (block.loadKg || 0) });
    if (block.restSec > 0) {
      setRest({ endsAt: Date.now() + block.restSec * 1000, total: block.restSec });
      setNow(Date.now());
    }
  };

  const useSuggested = (block: WorkoutBlock, kg: number) => {
    patchBlock(block.id, {
      loggedSets: block.loggedSets.map((s) => (s.completed ? s : { ...s, kg }))
    });
  };

  const finish = () => {
    if (!workout) return;
    save({
      ...workout,
      status: 'completed',
      completedAt: new Date().toISOString(),
      sessionRpe: sessionRpe ?? undefined,
      clientFeedback: feedback.trim() || undefined
    });
    setFinishing(false);
    setRest(null);
  };

  /* ---------------- derived ---------------- */

  const totalSets = workout?.blocks.reduce((a, b) => a + b.loggedSets.length, 0) ?? 0;
  const doneSets = workout?.blocks.reduce((a, b) => a + b.loggedSets.filter((s) => s.completed).length, 0) ?? 0;
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
  const labels = workout ? orderLabels(workout.blocks) : [];
  const status = workout ? effectiveStatus(workout, today) : null;
  const nextWorkout = (client.workouts ?? []).find((w) => w.date > date && w.status === 'planned');
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  const videoExercise = videoFor ? getExercise(videoFor) : undefined;

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold text-gray-500">
            {date === today ? 'Today' : formatDate(date, { weekday: true })}
          </span>
          <span className="inline-flex items-center bg-[#F3F4F6] text-[#111827] text-xs font-medium px-3 py-1 rounded-full">
            Phase {client.phaseNumber} · {client.phaseName}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">{workout ? workout.title : 'Rest day'}</h1>
        {workout?.focus && (
          <p className="text-xs text-gray-500 mt-0.5">
            {workout.focus}
            {workout.durationMin ? ` · ${workout.durationMin} min` : ''}
          </p>
        )}
      </div>

      {/* Week strip */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => {
            const ws = addDays(weekStart, -7);
            setWeekStart(ws);
            setDate(ws);
          }}
          aria-label="Previous week"
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {weekDates(weekStart).map((d) => {
            const w = workoutOn(client, d);
            const st = w ? effectiveStatus(w, today) : null;
            const active = d === date;
            return (
              <button
                key={d}
                onClick={() => {
                  setDate(d);
                  setFinishing(false);
                }}
                aria-label={formatDate(d, { weekday: true })}
                aria-pressed={active}
                className={`py-1.5 rounded-xl text-center cursor-pointer ${
                  active ? 'bg-[#111827] text-white' : d === today ? 'bg-[#FEF3C7] text-[#111827]' : 'text-gray-600'
                }`}
              >
                <div className="text-[10px] font-semibold">{dayShort(d)}</div>
                <div className="text-sm font-bold tabular-nums">{parseISODate(d).getDate()}</div>
                <div className="h-1.5 flex justify-center mt-0.5">
                  {st && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        st === 'completed' ? 'bg-[#16A34A]' : st === 'missed' ? 'bg-[#DC2626]' : active ? 'bg-[#FFC809]' : 'bg-gray-400'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => {
            const ws = addDays(weekStart, 7);
            setWeekStart(ws);
            setDate(ws);
          }}
          aria-label="Next week"
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {!workout ? (
        <div className={`${card} text-center py-10`}>
          <p className="text-base font-semibold text-[#111827] mb-1">No workout scheduled</p>
          <p className="text-sm text-gray-500">Recover well — walk, breathe, sleep.</p>
          {nextWorkout && (
            <button
              onClick={() => {
                setWeekStart(startOfWeek(nextWorkout.date));
                setDate(nextWorkout.date);
              }}
              className="mt-5 inline-flex items-center gap-2 bg-[#111827] text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer"
            >
              Next: {formatDate(nextWorkout.date, { weekday: true })} · {nextWorkout.title}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Completed banner */}
          {workout.status === 'completed' && (
            <div className="mb-4 flex items-center gap-3 p-4 rounded-2xl bg-[#DCFCE7] text-[#166534]">
              <PartyPopper className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <div className="font-semibold">Workout completed</div>
                <div className="text-xs">
                  {workout.sessionRpe ? `Session RPE ${workout.sessionRpe}/10 · ` : ''}You can still correct your numbers below.
                </div>
              </div>
            </div>
          )}
          {status === 'missed' && workout.status !== 'completed' && (
            <div className="mb-4 p-3 rounded-2xl bg-[#FEF2F2] text-[#991B1B] text-xs font-medium">
              This day was missed. You can still log it if you trained.
            </div>
          )}

          {/* Progress + rest timer */}
          <div className={`${card} mb-4 !p-4`}>
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span className="text-gray-600">
                {doneSets}/{totalSets} sets
              </span>
              <span className="font-bold text-[#111827] tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
              <div className="h-full bg-[#FFC809] transition-all rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {workout.coachNotes && (
            <div className="mb-4 p-3.5 rounded-2xl bg-[#FFFDF5] border border-[#FEF3C7] text-sm text-gray-700">
              <span className="font-semibold text-[#111827]">Coach: </span>
              {workout.coachNotes}
            </div>
          )}

          {/* Exercises */}
          <div className="space-y-4">
            {workout.blocks.map((block, i) => {
              const exercise = getExercise(block.exerciseId);
              const last = lastPerformance(client, block.exerciseId, date);
              const suggestion = suggestLoad(block, last, exercise?.bodyPart);
              const target = parseReps(block.reps);
              const anyDone = block.loggedSets.some((s) => s.completed);
              const allDone = block.loggedSets.length > 0 && block.loggedSets.every((s) => s.completed);
              const paired = block.supersetWithPrevious;

              return (
                <div key={block.id} className={`${card} ${paired ? 'border-l-4 border-l-[#FFC809]' : ''} ${allDone ? 'opacity-90' : ''}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`min-w-7 h-7 px-1.5 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                          allDone ? 'bg-[#16A34A] text-white' : 'bg-[#111827] text-[#FFC809]'
                        }`}
                      >
                        {allDone ? <Check className="w-4 h-4" /> : labels[i]}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-[#111827] leading-snug">{block.name}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {block.sets} × {block.reps || '–'}
                          {block.loadKg > 0 ? ` @ ${formatWeight(block.loadKg)}` : ''}
                          {block.restSec ? ` · ${block.restSec}s rest` : ''}
                          {paired ? ' · superset' : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setVideoFor(block.exerciseId)}
                      className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-[#111827] text-xs font-medium px-2.5 py-2 rounded-lg cursor-pointer shrink-0"
                    >
                      <Play className="w-3 h-3 fill-[#111827]" />
                      <span>Demo</span>
                    </button>
                  </div>

                  {block.notes && (
                    <p className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mb-3">{block.notes}</p>
                  )}

                  {/* Last time + suggestion */}
                  {(last || suggestion) && (
                    <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                      {last && (
                        <span className="text-gray-500">
                          Last time <span className="font-semibold text-[#111827]">{formatPerformance(last)}</span>
                        </span>
                      )}
                      {suggestion && !allDone && (
                        <button
                          onClick={() => useSuggested(block, suggestion.kg)}
                          title={suggestion.reason}
                          className={`inline-flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-full cursor-pointer ${
                            suggestion.action === 'increase'
                              ? 'bg-[#FFC809] text-[#111827]'
                              : suggestion.action === 'reduce'
                              ? 'bg-[#FEE2E2] text-[#991B1B]'
                              : 'bg-[#F3F4F6] text-[#111827]'
                          }`}
                        >
                          {suggestion.action === 'increase' ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : suggestion.action === 'reduce' ? (
                            <TrendingDown className="w-3.5 h-3.5" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                          Use {formatWeight(suggestion.kg)}
                        </button>
                      )}
                      {suggestion && !allDone && <p className="basis-full text-[11px] text-gray-500">{suggestion.reason}</p>}
                    </div>
                  )}

                  {/* Sets */}
                  <div className="grid grid-cols-[2rem_1fr_1fr_2.75rem] gap-2 items-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 px-0.5">
                    <span>Set</span>
                    <span className="text-center">{WEIGHT_UNIT}</span>
                    <span className="text-center">{target.kind === 'time' ? 'sec' : 'reps'}</span>
                    <span />
                  </div>
                  <div className="space-y-2">
                    {block.loggedSets.map((s) => (
                      <div key={s.setNumber} className="grid grid-cols-[2rem_1fr_1fr_2.75rem] gap-2 items-center">
                        <span className="text-sm font-semibold text-gray-500 tabular-nums text-center">{s.setNumber}</span>
                        <WeightInput
                          min={0}
                          step={0.5}
                          allowEmpty
                          kg={s.kg}
                          placeholder={block.loadKg ? String(roundLb(block.loadKg)) : 'BW'}
                          onChangeKg={(kg) => patchSet(block, s.setNumber, { kg })}
                          aria-label={`Set ${s.setNumber} weight`}
                          className={cellInput}
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={s.reps ?? ''}
                          placeholder={target.kind === 'reps' && target.max ? String(target.max) : target.kind === 'time' ? String(target.min) : '–'}
                          onChange={(e) =>
                            patchSet(block, s.setNumber, {
                              reps: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value)))
                            })
                          }
                          aria-label={`Set ${s.setNumber} ${target.kind === 'time' ? 'seconds' : 'reps'}`}
                          className={cellInput}
                        />
                        <button
                          onClick={() => toggleSet(block, s)}
                          aria-label={s.completed ? `Undo set ${s.setNumber}` : `Complete set ${s.setNumber}`}
                          aria-pressed={s.completed}
                          className={`w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                            s.completed ? 'bg-[#111827] text-[#FFC809]' : 'bg-white border-2 border-gray-200 text-gray-300 hover:border-[#111827]'
                          }`}
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        {s.completed && isNewRecord(client, block.exerciseId, block.name, date, s.kg, s.reps) && (
                          <span className="col-span-4 -mt-1 justify-self-end inline-flex items-center gap-1 text-[11px] font-bold text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded-full" role="status">
                            🏆 New PR — set {s.setNumber}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Effort, pain, note */}
                  {anyDone && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-[#111827]">How hard was it? (RPE)</span>
                        <span className="text-[11px] text-gray-400">10 = nothing left</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 mb-3">
                        {[6, 7, 8, 9, 10].map((r) => (
                          <button
                            key={r}
                            onClick={() => patchBlock(block.id, { rpe: block.rpe === r ? undefined : r })}
                            aria-pressed={block.rpe === r}
                            className={`py-2 rounded-lg text-sm font-semibold tabular-nums cursor-pointer ${
                              block.rpe === r ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#111827]'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => patchBlock(block.id, { pain: !block.pain })}
                          aria-pressed={!!block.pain}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                            block.pain ? 'bg-[#DC2626] text-white' : 'bg-[#F3F4F6] text-[#111827]'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> {block.pain ? 'Pain reported' : 'I felt pain'}
                        </button>
                        <button
                          onClick={() => setNoteOpen(noteOpen === block.id ? null : block.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#F3F4F6] text-[#111827] cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> {block.clientNote ? 'Edit note' : 'Note for coach'}
                        </button>
                      </div>
                      {(noteOpen === block.id || block.pain) && (
                        <textarea
                          value={block.clientNote ?? ''}
                          onChange={(e) => patchBlock(block.id, { clientNote: e.target.value })}
                          placeholder={block.pain ? 'Where and when did it hurt?' : 'Anything your coach should know'}
                          rows={2}
                          className="mt-2 w-full text-base bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#111827]"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Finish */}
          {workout.blocks.length > 0 && workout.status !== 'completed' && (
            <button
              onClick={() => setFinishing(true)}
              disabled={doneSets === 0}
              className="mt-5 w-full bg-[#111827] disabled:bg-gray-300 text-white text-sm font-semibold py-3.5 rounded-2xl cursor-pointer"
            >
              {doneSets === 0 ? 'Log at least one set to finish' : 'Finish workout'}
            </button>
          )}
        </>
      )}

      {/* Rest timer */}
      {rest && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 w-[calc(100%-2rem)] max-w-sm bg-[#111827] text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
          <Clock className="w-5 h-5 text-[#FFC809] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold tabular-nums">
              Rest {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
            </div>
            <div className="h-1 bg-white/20 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-[#FFC809]" style={{ width: `${(restLeft / rest.total) * 100}%` }} />
            </div>
          </div>
          <button onClick={() => setRest({ ...rest, endsAt: rest.endsAt + 15000, total: rest.total + 15 })} className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-white/10 cursor-pointer">
            +15s
          </button>
          <button onClick={() => setRest(null)} className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-white/10 cursor-pointer">
            Skip
          </button>
        </div>
      )}

      {/* Finish sheet */}
      {finishing && workout && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#111827]">Nice work 👏</h3>
              <button onClick={() => setFinishing(false)} aria-label="Close" className="p-1.5 text-gray-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm font-semibold text-[#111827] mb-2">How hard was the whole session?</p>
            <div className="grid grid-cols-5 gap-1.5 mb-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                <button
                  key={r}
                  onClick={() => setSessionRpe(r)}
                  aria-pressed={sessionRpe === r}
                  className={`py-2.5 rounded-lg text-sm font-semibold tabular-nums cursor-pointer ${
                    sessionRpe === r ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#111827]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 mb-4">
              <span>Very easy</span>
              <span>Max effort</span>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="How did it feel? Anything for your coach?"
              rows={3}
              className="w-full text-base bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#111827] mb-4"
            />
            <button onClick={finish} className="w-full bg-[#111827] text-white text-sm font-semibold py-3.5 rounded-2xl cursor-pointer">
              Finish workout ({doneSets}/{totalSets} sets)
            </button>
          </div>
        </div>
      )}

      {/* Demo video */}
      {videoFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setVideoFor(null)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-5 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#111827]">{videoExercise?.name ?? 'Exercise'}</h3>
              <button onClick={() => setVideoFor(null)} aria-label="Close" className="p-1.5 text-gray-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ExerciseVideoPlayer video={videoExercise?.video} title={videoExercise?.name ?? 'Exercise'} className="w-full aspect-video mb-4" />
            {videoExercise && videoExercise.cues.length > 0 && (
              <ol className="space-y-2 mb-4">
                {videoExercise.cues.map((cue, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-[#111827] text-[#FFC809] text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{cue}</span>
                  </li>
                ))}
              </ol>
            )}
            <button onClick={() => setVideoFor(null)} className="w-full bg-[#111827] text-white text-sm font-semibold py-3 rounded-xl cursor-pointer">
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
