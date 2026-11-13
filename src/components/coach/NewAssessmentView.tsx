import { saveAssessment } from '../../lib/assessments';
import { AssessmentClips } from './AssessmentClips';
import React, { useEffect, useState } from 'react';
import {
  Check,
  CloudUpload,
  Plus,
  Trash2,
  Play,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  FileText
} from 'lucide-react';
import {
  ClientProfile,
  InBodyData,
  RomMovement,
  PriTestItem,
  GaitPostureItem,
  StrengthTestItem,
  calculateAsymmetryPercent,
  calculateEstimated1RM
} from '../../types';
import { WEIGHT_UNIT, formatWeight } from '../../lib/units';
import { parseDegreeInput } from '../../lib/spectrum';
import { InBodyPrintoutThumbnail, InBodySegmentSilhouette } from '../VisualAssets';
import { WeightInput } from '../WeightInput';
import { isCloud } from '../../cloud/supabase';
import { deletePrintout, printoutUrl, uploadPrintout } from '../../cloud/printouts';
import { PRINTOUT_ACCEPT, blobToDataUrl, preparePrintout } from '../../lib/media';

/** Shows the saved InBody printout (photo or PDF) so the coach can read the numbers from it. */
const PrintoutPreview: React.FC<{ inBody: InBodyData }> = ({ inBody }) => {
  const [url, setUrl] = useState<string | null>(inBody.printoutPreview ?? null);
  useEffect(() => {
    let alive = true;
    if (inBody.printoutPath) {
      printoutUrl(inBody.printoutPath).then((u) => alive && setUrl(u));
    } else {
      setUrl(inBody.printoutPreview ?? null);
    }
    return () => {
      alive = false;
    };
  }, [inBody.printoutPath, inBody.printoutPreview]);

  const isPdf = /\.pdf$/i.test(inBody.printoutPath ?? inBody.printoutFileName ?? '');
  if (isPdf) {
    return (
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center gap-2 text-sm font-medium text-[#111827]"
      >
        <FileText className="w-10 h-10 text-gray-500" />
        <span className="max-w-[200px] truncate">{inBody.printoutFileName ?? 'InBody printout.pdf'}</span>
        <span className="text-xs text-gray-500 underline">Open PDF</span>
      </a>
    );
  }
  if (!url) return <div className="text-xs text-gray-400">Loading photo…</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="block w-full">
      <img
        src={url}
        alt="InBody printout"
        className="w-full max-h-[320px] object-contain rounded-lg border border-gray-200 bg-white"
      />
      <span className="block mt-2 text-xs text-gray-500 underline">Tap to open full size</span>
    </a>
  );
};

interface NewAssessmentViewProps {
  clients: ClientProfile[];
  client: ClientProfile;
  onSelectClientId: (id: string) => void;
  onUpdateClient: (updated: ClientProfile) => void;
  onFinishAssessment: () => void;
}

const STEPS = [
  { number: 1, label: '1. Body Comp' },
  { number: 2, label: '2. PRI Tests' },
  { number: 3, label: '3. Range of Motion' },
  { number: 4, label: '4. Gait & Posture' },
  { number: 5, label: '5. Strength' },
  { number: 6, label: '6. Video' }
];

export const NewAssessmentView: React.FC<NewAssessmentViewProps> = ({
  clients,
  client,
  onSelectClientId,
  onUpdateClient,
  onFinishAssessment
}) => {
  // Default to Step 3 (Range of Motion) or Step 1 (Body Comp) — let's start at Step 1 with 1-click access to all 6 steps
  const [activeStep, setActiveStep] = useState<number>(1);
  const [assessmentWeek, setAssessmentWeek] = useState<string>('Week 0');
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [newMovementName, setNewMovementName] = useState('');
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [uploadingPrintout, setUploadingPrintout] = useState(false);

  const showToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2400);
  };

  // Handlers for Step 1: Body Comp (InBody 270)
  const updateInBodyField = <K extends keyof InBodyData>(key: K, val: InBodyData[K]) => {
    onUpdateClient({
      ...client,
      inBody: {
        ...client.inBody,
        [key]: val
      }
    });
  };

  const updateSegment = (
    segKey: keyof InBodyData['segments'],
    val: number
  ) => {
    onUpdateClient({
      ...client,
      inBody: {
        ...client.inBody,
        segments: {
          ...client.inBody.segments,
          [segKey]: val
        }
      }
    });
  };

  // Saves the printout (photo or PDF). Numbers are NOT read from it: the coach types them in below.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploadingPrintout) return;
    setUploadingPrintout(true);
    try {
      const prepared = await preparePrintout(file);
      if (!prepared.ok) {
        showToast(prepared.error);
        return;
      }
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'InBody printout';
      const printoutFileName = `${baseName}.${prepared.ext}`;
      const oldPath = client.inBody.printoutPath;
      let printoutPath: string | undefined;
      let printoutPreview: string | undefined;
      if (isCloud) {
        printoutPath = await uploadPrintout(client.id, prepared.blob, prepared.contentType, prepared.ext);
      } else if (prepared.ext === 'jpg') {
        printoutPreview = await blobToDataUrl(prepared.blob);
      }
      onUpdateClient({
        ...client,
        inBody: {
          ...client.inBody,
          printoutUploaded: true,
          printoutFileName,
          printoutPath,
          printoutPreview
        }
      });
      if (oldPath) void deletePrintout(oldPath).catch(() => undefined);
      showToast('Printout saved. Type the numbers from it below.');
    } catch (err) {
      showToast(`Could not save the printout: ${(err as { message?: string }).message ?? 'try again'}`);
    } finally {
      setUploadingPrintout(false);
    }
  };

  // Handlers for Step 3: Range of Motion
  const updateRomValue = (id: string, side: 'left' | 'right', raw: string) => {
    // ROM rows store numeric values; empty input means unmeasured (0 in legacy schema).
    const value = raw === '' ? 0 : parseDegreeInput(raw);
    if (value === null) return;
    const updatedRom = client.rom.map((item) =>
      item.id === id ? { ...item, [side]: value } : item
    );
    onUpdateClient({
      ...client,
      rom: updatedRom
    });
  };

  const handleAddRomMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMovementName.trim()) return;
    const newItem: RomMovement = {
      id: `rom-${Date.now()}`,
      name: newMovementName.trim(),
      left: 40,
      right: 45
    };
    onUpdateClient({
      ...client,
      rom: [...client.rom, newItem]
    });
    setNewMovementName('');
  };

  const handleDeleteRomMovement = (id: string) => {
    onUpdateClient({
      ...client,
      rom: client.rom.filter((r) => r.id !== id)
    });
  };

  // Handlers for Step 2: PRI Tests
  const updatePriItem = (id: string, field: keyof PriTestItem, value: string) => {
    const list = client.priTests.length > 0 ? client.priTests : DEFAULT_PRI_TESTS;
    const updated = list.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onUpdateClient({
      ...client,
      priTests: updated
    });
  };

  // Handlers for Step 4: Gait & Posture
  const updateGaitItem = (
    id: string,
    field: keyof GaitPostureItem,
    value: string
  ) => {
    const list = client.gaitPosture.length > 0 ? client.gaitPosture : DEFAULT_GAIT_ITEMS;
    const updated = list.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onUpdateClient({
      ...client,
      gaitPosture: updated
    });
  };

  // Handlers for Step 5: Strength
  const updateStrengthItem = (
    id: string,
    field: 'loadKg' | 'reps',
    value: number
  ) => {
    const list =
      client.strengthTests.length > 0 ? client.strengthTests : DEFAULT_STRENGTH_ITEMS;
    const updated = list.map((item) =>
      item.id === id ? { ...item, [field]: Math.max(0, value) } : item
    );
    onUpdateClient({
      ...client,
      strengthTests: updated
    });
  };

  const handleNextStep = () => {
    if (activeStep < 6) {
      showToast(`Saved ${STEPS[activeStep - 1].label}`);
      setActiveStep(activeStep + 1);
    } else {
      onUpdateClient({
        ...saveAssessment(client, {
          inBody: client.inBody,
          rom: client.rom,
          // only what the coach actually entered (not the form's example rows)
          priTests: client.priTests,
          gaitPosture: client.gaitPosture,
          strengthTests: client.strengthTests,
          videos: client.videos,
          clips: client.clips ?? []
        }),
        // the next assessment starts with no videos
        clips: []
      });
      showToast('Assessment saved — compare it on the Progress screen');
      onFinishAssessment();
    }
  };

  const handlePrevStep = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  const priList = client.priTests.length > 0 ? client.priTests : DEFAULT_PRI_TESTS;
  const gaitList = client.gaitPosture.length > 0 ? client.gaitPosture : DEFAULT_GAIT_ITEMS;
  const strengthList =
    client.strengthTests.length > 0 ? client.strengthTests : DEFAULT_STRENGTH_ITEMS;
  const videoList = client.videos.length > 0 ? client.videos : DEFAULT_VIDEO_ITEMS;

  // Dynamic Heading matching Mockup 1 ("New Assessment") & Mockup 3 ("Body Composition — InBody 270")
  const stepTitle =
    activeStep === 1
      ? 'Body Composition — InBody 270'
      : activeStep === 3
      ? 'New Assessment'
      : `New Assessment — ${STEPS[activeStep - 1].label.replace(/^\d+\.\s*/, '')}`;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Top Heading & Client/Week Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-[34px] font-bold tracking-tight text-[#111827] leading-tight">
            {stepTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-base sm:text-[18px] text-gray-500">
            <div className="relative inline-flex items-center">
              <select
                value={client.id}
                onChange={(e) => onSelectClientId(e.target.value)}
                className="appearance-none bg-transparent pr-6 font-medium text-gray-600 hover:text-[#111827] focus:outline-none cursor-pointer"
                aria-label="Select Client"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-0 pointer-events-none" />
            </div>
            <span>·</span>
            <select
              value={assessmentWeek}
              onChange={(e) => setAssessmentWeek(e.target.value)}
              className="bg-transparent font-normal text-gray-500 hover:text-[#111827] focus:outline-none cursor-pointer"
              aria-label="Select Assessment Week"
            >
              <option value="Week 0">Week 0</option>
              <option value="Week 4">Week 4</option>
              <option value="Week 8">Week 8</option>
              <option value="Week 12">Week 12</option>
            </select>
          </div>
        </div>

        {/* Quick step switcher pills for fast review */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white border border-gray-200/80 rounded-xl p-1 self-start sm:self-auto">
          <button
            onClick={() => setActiveStep(1)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeStep === 1
                ? 'bg-[#111827] text-white'
                : 'text-gray-600 hover:text-[#111827]'
            }`}
          >
            InBody 270
          </button>
          <button
            onClick={() => setActiveStep(3)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeStep === 3
                ? 'bg-[#111827] text-white'
                : 'text-gray-600 hover:text-[#111827]'
            }`}
          >
            ROM Asymmetry
          </button>
        </div>
      </div>

      {/* 6-Step Horizontal Stepper matching Mockups 1 & 3 */}
      <div className="mb-8 w-full min-w-0 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
          {STEPS.map((step, idx) => {
            const isCompleted = step.number < activeStep;
            const isCurrent = step.number === activeStep;
            const isLast = idx === STEPS.length - 1;

            return (
              <React.Fragment key={step.number}>
                <button
                  onClick={() => setActiveStep(step.number)}
                  className="min-h-[64px] min-w-0 w-full flex flex-col items-center justify-center rounded-xl border border-gray-200 px-2 py-2 group cursor-pointer focus:outline-none"
                >
                  <div className="h-6 flex items-center justify-center mb-2">
                    {isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-[#111827] text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full bg-[#FFC809] ring-4 ring-[#FFC809]/20" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-[#D1D5DB] group-hover:bg-gray-400 transition-colors" />
                    )}
                  </div>
                  <span
                    className={`text-xs sm:text-[13px] text-center break-words transition-colors ${
                      isCurrent
                        ? 'font-semibold text-[#111827]'
                        : isCompleted
                        ? 'font-medium text-[#111827]'
                        : 'font-normal text-gray-400 group-hover:text-gray-600'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {!isLast && (
                  <div className="hidden">
                    <div
                      className={`h-[2px] w-full transition-colors ${
                        step.number < activeStep ? 'bg-[#111827]' : 'bg-[#E5E7EB]'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Toast Notification */}
      {savedToast && (
        <div className="mb-4 inline-flex items-center gap-2 bg-[#111827] text-white text-xs font-medium px-3.5 py-2 rounded-xl shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-[#FFC809]" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* =====================================================================
          STEP 1: BODY COMPOSITION — INBODY 270 (Matches Mockups 3, 4, 7, 8)
         ===================================================================== */}
      {activeStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Card: InBody Printout Upload Dropzone */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col">
            <label className="flex-1 border border-dashed border-gray-300 hover:border-[#111827] rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors min-h-[340px]">
              <input
                type="file"
                accept={PRINTOUT_ACCEPT}
                onChange={handleFileUpload}
                disabled={uploadingPrintout}
                className="hidden"
              />
              <CloudUpload className="w-9 h-9 text-gray-500 stroke-[1.6] mb-3" />
              <div className="text-[15px] font-medium text-[#111827] leading-snug max-w-[180px] mb-5">
                {uploadingPrintout ? 'Saving…' : 'Drop InBody printout photo or upload'}
              </div>

              {client.inBody.printoutPath || client.inBody.printoutPreview ? (
                <PrintoutPreview inBody={client.inBody} />
              ) : (
                <InBodyPrintoutThumbnail fileName={client.inBody.printoutFileName} />
              )}

              <span className="mt-4 text-xs font-medium text-gray-400 hover:text-[#111827] transition-colors">
                {client.inBody.printoutPath || client.inBody.printoutPreview ? 'Click here to replace' : 'Click to add the printout'}
              </span>
            </label>
          </div>

          {/* Right Card: Auto-filled InBody 270 Fields + 5-Segment Lean Mass Diagram */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-5 sm:p-7 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
            <div className="inline-flex items-center gap-1.5 bg-[#FEF3C7] text-[#92400E] text-xs font-medium px-3.5 py-1.5 rounded-full mb-5">
              <span>{client.inBody.printoutUploaded ? 'Printout saved — type the numbers from it' : 'Type the numbers from the printout'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left 2 Columns of Inputs */}
              <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                {/* Weight */}
                <div>
                  <label className="block text-xs font-medium text-[#111827] mb-1.5">
                    Weight
                  </label>
                  <div className="relative">
                    <WeightInput
                      step="0.1"
                      kg={client.inBody.weight}
                      onChangeKg={(kg) => updateInBodyField('weight', kg ?? 0)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-[15px] font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#111827]"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                      {WEIGHT_UNIT}
                    </span>
                  </div>
                </div>

                {/* Skeletal Muscle Mass */}
                <div>
                  <label className="block text-xs font-medium text-[#111827] mb-1.5">
                    Skeletal Muscle Mass
                  </label>
                  <div className="relative">
                    <WeightInput
                      step="0.1"
                      kg={client.inBody.skeletalMuscleMass}
                      onChangeKg={(kg) => updateInBodyField('skeletalMuscleMass', kg ?? 0)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-[15px] font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#111827]"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                      {WEIGHT_UNIT}
                    </span>
                  </div>
                </div>

                {/* Body Fat Mass */}
                <div>
                  <label className="block text-xs font-medium text-[#111827] mb-1.5">
                    Body Fat Mass
                  </label>
                  <div className="relative">
                    <WeightInput
                      step="0.1"
                      kg={client.inBody.bodyFatMass}
                      onChangeKg={(kg) => updateInBodyField('bodyFatMass', kg ?? 0)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-[15px] font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#111827]"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                      {WEIGHT_UNIT}
                    </span>
                  </div>
                </div>

                {/* Body Fat % */}
                <div>
                  <label className="block text-xs font-medium text-[#111827] mb-1.5">
                    Body Fat
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={client.inBody.bodyFatPercent}
                      onChange={(e) =>
                        updateInBodyField(
                          'bodyFatPercent',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-9 text-[15px] font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#111827]"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                      %
                    </span>
                  </div>
                </div>

                {/* BMR */}
                <div>
                  <label className="block text-xs font-medium text-[#111827] mb-1.5">
                    BMR
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="10"
                      value={client.inBody.bmr}
                      onChange={(e) =>
                        updateInBodyField('bmr', parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-12 text-[15px] font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#111827]"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                      kcal
                    </span>
                  </div>
                </div>

                {/* Visceral Fat Level */}
                <div>
                  <label className="block text-xs font-medium text-[#111827] mb-1.5">
                    Visceral Fat Level
                  </label>
                  <div>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="25"
                      value={client.inBody.visceralFatLevel}
                      onChange={(e) =>
                        updateInBodyField(
                          'visceralFatLevel',
                          parseInt(e.target.value, 10) || 1
                        )
                      }
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-[15px] font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#111827]"
                    />
                  </div>
                </div>

                {/* InBody Score */}
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-[#111827] mb-1.5">
                    InBody Score
                  </label>
                  <div>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="100"
                      value={client.inBody.inBodyScore}
                      onChange={(e) =>
                        updateInBodyField(
                          'inBodyScore',
                          parseInt(e.target.value, 10) || 0
                        )
                      }
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-[15px] font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#111827]"
                    />
                  </div>
                </div>

                {/* Total Body Water (optional) */}
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-[#111827] mb-1.5">
                    Total Body Water <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <WeightInput
                      step="0.1"
                      placeholder="—"
                      allowEmpty
                      kg={client.inBody.totalBodyWater}
                      onChangeKg={(kg) =>
                        updateInBodyField('totalBodyWater', kg == null ? undefined : kg)
                      }
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-[15px] font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#111827]"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                      {WEIGHT_UNIT}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: 5-Segment Lean Mass Body Diagram matching Mockup 3, 4, 7, 8 */}
              <div className="md:col-span-5 flex flex-col items-center justify-center">
                <InBodySegmentSilhouette
                  segments={client.inBody.segments}
                  onChangeSegment={updateSegment}
                />
                <span className="text-[11px] text-gray-400 mt-1">
                  5-Segment Lean Mass (click values to edit)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 2: PRI TESTS (Postural Restoration Institute)
         ===================================================================== */}
      {activeStep === 2 && (
        <div className="bg-white rounded-2xl p-5 sm:p-7 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">
                Postural Restoration Institute (PRI) Screen
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Assess Left AIC / Right BC tri-planar pelvic and ribcage orientation before loading.
              </p>
            </div>
            {priList.some((t) => t.status === 'Asymmetric') && (
              <span className="inline-flex items-center bg-[#FEF3C7] text-[#92400E] text-xs font-semibold px-3 py-1 rounded-full self-start sm:self-auto">
                {priList.filter((t) => t.status === 'Asymmetric').length} asymmetric finding
                {priList.filter((t) => t.status === 'Asymmetric').length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {priList.map((test) => (
              <div
                key={test.id}
                className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
              >
                <div className="md:col-span-4">
                  <div className="text-sm font-semibold text-[#111827]">{test.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{test.category} Zone</div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] text-gray-400 mb-1">Left Side</label>
                  <input
                    type="text"
                    value={test.leftResult}
                    placeholder="e.g. Positive / 3 of 5 / 54°"
                    onChange={(e) => updatePriItem(test.id, 'leftResult', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-[#111827] focus:outline-none focus:border-[#111827]"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] text-gray-400 mb-1">Right Side</label>
                  <input
                    type="text"
                    value={test.rightResult}
                    placeholder="Result"
                    onChange={(e) => updatePriItem(test.id, 'rightResult', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-[#111827] focus:outline-none focus:border-[#111827]"
                  />
                </div>

                <div className="md:col-span-2 flex md:justify-end">
                  <select
                    value={test.status}
                    onChange={(e) => updatePriItem(test.id, 'status', e.target.value)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer focus:outline-none ${
                      test.status === 'Asymmetric'
                        ? 'bg-[#FFC809] text-[#111827]'
                        : 'bg-[#E5E7EB] text-[#374151]'
                    }`}
                  >
                    <option value="Not tested">Not tested</option>
                    <option value="Asymmetric">Asymmetric</option>
                    <option value="Improved">Improved</option>
                    <option value="Neutral">Neutral</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 3: RANGE OF MOTION (Matches Mockup 1 pixel-for-pixel)
         ===================================================================== */}
      {activeStep === 3 && (
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
          <div className="w-full min-w-0">
            <table className="pf-responsive-table pf-stack-table w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs sm:text-[14px] font-semibold text-[#111827]">
                  <th className="py-4 pl-6 pr-4 w-[44%]">Movement</th>
                  <th className="py-4 px-4 w-[18%]">Left (°)</th>
                  <th className="py-4 px-4 w-[18%]">Right (°)</th>
                  <th className="py-4 pl-4 pr-6 text-right w-[20%]">Asymmetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm sm:text-[16px]">
                {client.rom.map((item) => {
                  const asymPercent = calculateAsymmetryPercent(item.left, item.right);
                  const isHighAsymmetry = asymPercent > 10;

                  return (
                    <tr key={item.id} className="group hover:bg-gray-50/40 transition-colors">
                      <td data-label="Movement" className="py-4 pl-6 pr-4 font-normal text-[#111827]">
                        <div className="flex items-center justify-between gap-2">
                          <span>{item.name}</span>
                          {client.rom.length > 3 && (
                            <button
                              onClick={() => handleDeleteRomMovement(item.id)}
                              title="Remove movement"
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1 transition-opacity cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td data-label="Left (°)" className="py-4 px-4">
                        <input
                          type="number"
                          min="0"
                          max="180"
                          step="1"
                          value={item.left}
                          onChange={(e) => updateRomValue(item.id, 'left', e.target.value)}
                          aria-label={`${item.name} Left degrees`}
                          className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-[15px] text-[#111827] tabular-nums focus:outline-none focus:border-[#111827] transition-colors"
                        />
                      </td>

                      <td data-label="Right (°)" className="py-4 px-4">
                        <input
                          type="number"
                          min="0"
                          max="180"
                          step="1"
                          value={item.right}
                          onChange={(e) => updateRomValue(item.id, 'right', e.target.value)}
                          aria-label={`${item.name} Right degrees`}
                          className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-[15px] text-[#111827] tabular-nums focus:outline-none focus:border-[#111827] transition-colors"
                        />
                      </td>

                      <td data-label="Result" className="py-4 pl-4 pr-6 text-right">
                        <span
                          className={`inline-flex items-center justify-center min-w-[52px] px-3 py-1 rounded-full text-sm tabular-nums ${
                            isHighAsymmetry
                              ? 'bg-[#FFC809] text-[#111827] font-semibold'
                              : 'bg-[#E5E7EB] text-[#374151] font-medium'
                          }`}
                        >
                          {asymPercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add Custom ROM Row */}
          <form
            onSubmit={handleAddRomMovement}
            className="px-6 py-3.5 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMovementName}
                onChange={(e) => setNewMovementName(e.target.value)}
                placeholder="Add joint movement (e.g., Straight leg raise)..."
                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-[#111827] focus:outline-none focus:border-[#111827] w-64"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#111827] bg-white border border-gray-200 hover:border-[#111827] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
            <div className="text-xs text-gray-400">
              Formula: <code className="font-mono">|L − R| / max(L,R) × 100</code> · Highlighted yellow above 10%
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          STEP 4: GAIT & POSTURE
         ===================================================================== */}
      {activeStep === 4 && (
        <div className="bg-white rounded-2xl p-5 sm:p-7 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="mb-5 pb-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-[#111827]">
              Static Posture & Dynamic Gait Observation
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Document ribcage-pelvis alignment, foot progression angle, and mid-stance hip shift.
            </p>
          </div>

          <div className="space-y-4">
            {gaitList.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
              >
                <div className="md:col-span-3">
                  <span className="text-[11px] font-medium text-gray-400 block">
                    {item.view} View
                  </span>
                  <span className="text-sm font-semibold text-[#111827]">
                    {item.checkpoint}
                  </span>
                </div>

                <div className="md:col-span-7">
                  <input
                    type="text"
                    value={item.finding}
                    placeholder="What you see (e.g. right iliac crest 1 cm higher)"
                    onChange={(e) => updateGaitItem(item.id, 'finding', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:border-[#111827]"
                  />
                </div>

                <div className="md:col-span-2 flex md:justify-end">
                  <select
                    value={item.severity}
                    onChange={(e) => updateGaitItem(item.id, 'severity', e.target.value)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer focus:outline-none ${
                      item.severity === 'Moderate'
                        ? 'bg-[#FFC809] text-[#111827]'
                        : 'bg-[#E5E7EB] text-[#374151]'
                    }`}
                  >
                    <option value="Not assessed">Not assessed</option>
                    <option value="Optimal">Optimal</option>
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 5: STRENGTH (Submaximal Load & Auto-Calculated Estimated 1RM)
         ===================================================================== */}
      {activeStep === 5 && (
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">
                Baseline Strength & Estimated 1RM
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Enter submaximal test load and reps completed to auto-calculate Epley 1RM.
              </p>
            </div>
          </div>

          <div className="w-full min-w-0">
            <table className="pf-responsive-table pf-stack-table w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs sm:text-sm font-semibold text-[#111827]">
                  <th className="py-3.5 pl-6 pr-4">Indicator Lift</th>
                  <th className="py-3.5 px-4">Test Load ({WEIGHT_UNIT})</th>
                  <th className="py-3.5 px-4">Reps Completed</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">Estimated 1RM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {strengthList.map((row) => {
                  const est1Rm = calculateEstimated1RM(row.loadKg, row.reps);
                  return (
                    <tr key={row.id}>
                      <td data-label="Indicator Lift" className="py-4 pl-6 pr-4 font-medium text-[#111827]">
                        {row.exercise}
                      </td>
                      <td data-label="Test load (lb)" className="py-4 px-4">
                        <WeightInput
                          step="2.5"
                          kg={row.loadKg}
                          onChangeKg={(kg) => updateStrengthItem(row.id, 'loadKg', kg ?? 0)}
                          className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#111827]"
                        />
                      </td>
                      <td data-label="Reps completed" className="py-4 px-4">
                        <input
                          type="number"
                          step="1"
                          value={row.reps}
                          onChange={(e) =>
                            updateStrengthItem(
                              row.id,
                              'reps',
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#111827]"
                        />
                      </td>
                      <td data-label="Result" className="py-4 pl-4 pr-6 text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FEF3C7] text-[#111827] font-bold text-sm tabular-nums">
                          {est1Rm > 0 ? formatWeight(est1Rm) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 6: VIDEO CAPTURE & KINEMATIC TAGGING
         ===================================================================== */}
      {activeStep === 6 && client.videos.length === 0 && (
        <AssessmentClips client={client} onUpdateClient={onUpdateClient} />
      )}

      {activeStep === 6 && client.videos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            {videoList.map((vid, idx) => (
              <div
                key={vid.id}
                onClick={() => setActiveVideoIndex(idx)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  activeVideoIndex === idx
                    ? 'bg-white border-[#111827] shadow-sm'
                    : 'bg-white border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-[#111827]">{vid.title}</span>
                  <span className="text-xs font-mono text-gray-400">{vid.duration}</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">{vid.angle}</div>
                <div className="text-xs text-[#111827] bg-gray-50 rounded-lg p-2.5">
                  {vid.keyCue}
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-[#111827]">
                    {videoList[activeVideoIndex]?.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Plumb-line & Joint Angle Overlay · 120fps Capture
                  </p>
                </div>
                <span className="bg-[#FFC809] text-[#111827] text-xs font-semibold px-3 py-1 rounded-full tabular-nums">
                  Alignment Score: {videoList[activeVideoIndex]?.currentScore}/100
                </span>
              </div>

              {/* Simulated Biomechanical Video Frame with Alignment Grid */}
              <div className="relative h-64 rounded-xl bg-[#1F2937] overflow-hidden flex items-center justify-center mb-4">
                <svg viewBox="0 0 400 220" className="w-full h-full">
                  {/* Calibration Grid */}
                  <g stroke="rgba(255,255,255,0.08)" strokeWidth="1">
                    <line x1="100" y1="0" x2="100" y2="220" />
                    <line x1="200" y1="0" x2="200" y2="220" />
                    <line x1="300" y1="0" x2="300" y2="220" />
                    <line x1="0" y1="55" x2="400" y2="55" />
                    <line x1="0" y1="110" x2="400" y2="110" />
                    <line x1="0" y1="165" x2="400" y2="165" />
                  </g>
                  {/* Vertical Plumb Line */}
                  <line
                    x1="200"
                    y1="15"
                    x2="200"
                    y2="205"
                    stroke="#FFC809"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  {/* Kinematic Skeleton Overlay */}
                  <circle cx="200" cy="48" r="10" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                  <line x1="176" y1="74" x2="224" y2="75" stroke="#FFC809" strokeWidth="2.5" />
                  <line x1="200" y1="58" x2="200" y2="122" stroke="#FFFFFF" strokeWidth="2.5" />
                  <line x1="182" y1="122" x2="218" y2="122" stroke="#FFC809" strokeWidth="2.5" />
                  <line x1="184" y1="122" x2="176" y2="188" stroke="#FFFFFF" strokeWidth="2.5" />
                  <line x1="216" y1="122" x2="224" y2="188" stroke="#FFFFFF" strokeWidth="2.5" />
                  {/* Joint Nodes */}
                  <circle cx="176" cy="74" r="4" fill="#FFC809" />
                  <circle cx="224" cy="75" r="4" fill="#FFC809" />
                  <circle cx="182" cy="122" r="4" fill="#FFC809" />
                  <circle cx="218" cy="122" r="4" fill="#FFC809" />
                </svg>

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-black/50 backdrop-blur-xs px-3 py-2 rounded-lg text-white text-xs">
                  <div className="flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-[#FFC809] fill-[#FFC809]" />
                    <span>0:12 / {videoList[activeVideoIndex]?.duration}</span>
                  </div>
                  <span className="text-[#FFC809] font-mono">Pelvic Shift: &lt; 1.5°</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Coach Observation: {videoList[activeVideoIndex]?.keyCue}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar matching Mockups 1 & 3 ("Back" + "Confirm & next" / "Save & next") */}
      <div className="mt-7 flex items-center justify-end gap-5">
        <button
          type="button"
          onClick={handlePrevStep}
          disabled={activeStep === 1}
          className={`text-sm font-medium transition-colors cursor-pointer ${
            activeStep === 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:text-[#111827]'
          }`}
        >
          Back
        </button>

        <button
          type="button"
          onClick={handleNextStep}
          className="bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors cursor-pointer"
        >
          {activeStep === 1
            ? 'Confirm & next'
            : activeStep === 6
            ? 'Complete Assessment'
            : 'Save & next'}
        </button>
      </div>
    </div>
  );
};

// Blank templates for a new client: the tests and checkpoints to do, no results yet.
const DEFAULT_PRI_TESTS: PriTestItem[] = [
  { id: 'pri-def-1', name: 'Adduction Drop Test (ADT)', category: 'Pelvis', leftResult: '', rightResult: '', status: 'Not tested', notes: '' },
  { id: 'pri-def-2', name: 'Extension Drop Test', category: 'Pelvis', leftResult: '', rightResult: '', status: 'Not tested', notes: '' },
  { id: 'pri-def-3', name: 'Hruska Adduction Lift Test (HALT)', category: 'Pelvis', leftResult: '', rightResult: '', status: 'Not tested', notes: '' },
  { id: 'pri-def-4', name: 'Passive Glenohumeral IR (HGIR)', category: 'Shoulder', leftResult: '', rightResult: '', status: 'Not tested', notes: '' }
];

const DEFAULT_GAIT_ITEMS: GaitPostureItem[] = [
  { id: 'gp-def-1', view: 'Anterior', checkpoint: 'Pelvic & Iliac Crest Symmetry', finding: '', severity: 'Not assessed' },
  { id: 'gp-def-2', view: 'Lateral', checkpoint: 'Thoracolumbar & Zone of Apposition', finding: '', severity: 'Not assessed' },
  { id: 'gp-def-3', view: 'Dynamic Gait', checkpoint: 'Left Stance Phase & Right Arm Swing', finding: '', severity: 'Not assessed' }
];

const DEFAULT_STRENGTH_ITEMS: StrengthTestItem[] = [
  { id: 'str-def-1', exercise: 'Goblet / Back Squat', loadKg: 0, reps: 0 },
  { id: 'str-def-2', exercise: 'Romanian Deadlift', loadKg: 0, reps: 0 },
  { id: 'str-def-3', exercise: 'DB Bench Press', loadKg: 0, reps: 0 }
];

const DEFAULT_VIDEO_ITEMS = [
  {
    id: 'vid-def-1',
    title: 'Overhead Squat Assessment',
    angle: 'Anterior & Sagittal Dual View',
    duration: '0:24',
    keyCue: 'Symmetrical hip crease depth and neutral ribcage stack.',
    week0Score: 68,
    currentScore: 91
  },
  {
    id: 'vid-def-2',
    title: 'Gait Cycle & Mid-Stance Shift',
    angle: 'Posterior Slow-Mo (120fps)',
    duration: '0:18',
    keyCue: 'Clean weight acceptance into left hip internal rotation.',
    week0Score: 64,
    currentScore: 88
  }
];
