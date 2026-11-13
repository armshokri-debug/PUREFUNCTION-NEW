import React from 'react';
import { Exercise } from '../types';
import { WEIGHT_UNIT, formatWeight } from '../lib/units';
import { WeightInput } from './WeightInput';

export const PureFunctionLogo: React.FC<{
  compact?: boolean;
  darkBg?: boolean;
  className?: string;
}> = ({ compact = false, darkBg = false, className = '' }) => {
  const primaryColor = darkBg ? '#FFFFFF' : '#111827';
  const accentColor = '#F5B800'; // Vibrant logo yellow matching #FFC809 / uploaded logo

  return (
    <div
      className={`inline-flex items-center select-none ${className}`}
      aria-label="Pure Function Fitness Center"
    >
      <svg
        viewBox="0 0 1274 380"
        className={compact ? 'h-8 w-auto' : 'w-full max-w-[196px] h-auto'}
        role="img"
        aria-label="Pure Function Fitness Center"
      >
        {/* ==================== TOP LEFT: P ==================== */}
        <path
          d="M 8 144 L 8 7.5 L 66 7.5 C 91 7.5, 106 21.5, 106 42 C 106 62.5, 91 76.5, 66 76.5 L 8 76.5"
          fill="none"
          stroke={primaryColor}
          strokeWidth="15"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />

        {/* ==================== LEFT YELLOW BAR ==================== */}
        <rect x="0" y="168" width="112" height="26" fill={accentColor} />

        {/* ==================== BOTTOM LEFT: F ==================== */}
        <path
          d="M 8 366 L 8 229.5 L 108 229.5 M 8 293 L 98 293"
          fill="none"
          stroke={primaryColor}
          strokeWidth="15"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />

        {/* ==================== GIANT SHARED YELLOW U ==================== */}
        <path
          d="M 161 0 L 161 302 A 58 58 0 0 0 277 302 L 277 0"
          fill="none"
          stroke={accentColor}
          strokeWidth="23"
          strokeLinecap="butt"
        />

        {/* ==================== TOP MIDDLE: R ==================== */}
        <path
          d="M 345 144 L 345 7.5 L 408 7.5 C 433 7.5, 448 21.5, 448 42 C 448 62.5, 433 76.5, 408 76.5 L 345 76.5 M 404 76.5 C 434 76.5, 443 96, 446 144"
          fill="none"
          stroke={primaryColor}
          strokeWidth="15"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />

        {/* ==================== TOP MIDDLE: E ==================== */}
        <path
          d="M 626 7.5 L 524 7.5 L 524 136.5 L 628 136.5 M 524 72 L 616 72"
          fill="none"
          stroke={primaryColor}
          strokeWidth="15"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />

        {/* ==================== TOP RIGHT: FITNESS / CENTER ==================== */}
        <g
          fill={accentColor}
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
          fontWeight="700"
          fontSize="46"
          textAnchor="middle"
        >
          {/* F I T N E S S */}
          <text x="688" y="38">F</text>
          <text x="782" y="38">I</text>
          <text x="878" y="38">T</text>
          <text x="976" y="38">N</text>
          <text x="1074" y="38">E</text>
          <text x="1168" y="38">S</text>
          <text x="1256" y="38">S</text>

          {/* C E N T E R */}
          <text x="690" y="142">C</text>
          <text x="803" y="142">E</text>
          <text x="916" y="142">N</text>
          <text x="1030" y="142">T</text>
          <text x="1143" y="142">E</text>
          <text x="1256" y="142">R</text>
        </g>

        {/* ==================== LONG RIGHT YELLOW BAR ==================== */}
        <rect x="337" y="168" width="937" height="26" fill={accentColor} />

        {/* ==================== BOTTOM ROW: N C T I O N ==================== */}
        {/* N */}
        <path
          d="M 345 366 L 345 225 L 455 363 L 455 222"
          fill="none"
          stroke={primaryColor}
          strokeWidth="15"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />

        {/* C */}
        <path
          d="M 644 266 C 635 238, 613 222, 584 222 C 544 222, 518 252, 518 294 C 518 336, 544 366, 584 366 C 614 366, 636 349, 645 320"
          fill="none"
          stroke={primaryColor}
          strokeWidth="15"
          strokeLinecap="butt"
        />

        {/* T */}
        <path
          d="M 702 229.5 L 826 229.5 M 764 229.5 L 764 366"
          fill="none"
          stroke={primaryColor}
          strokeWidth="15"
          strokeLinecap="butt"
        />

        {/* I */}
        <line
          x1="882"
          y1="222"
          x2="882"
          y2="366"
          stroke={primaryColor}
          strokeWidth="15"
          strokeLinecap="butt"
        />

        {/* O */}
        <ellipse
          cx="1019"
          cy="294"
          rx="64"
          ry="66"
          fill="none"
          stroke={primaryColor}
          strokeWidth="15"
        />

        {/* N */}
        <path
          d="M 1150 366 L 1150 225 L 1260 363 L 1260 222"
          fill="none"
          stroke={primaryColor}
          strokeWidth="15"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      </svg>
    </div>
  );
};

/**
 * Client photo, or their initials when no photo has been added yet.
 * (avatarId is kept for data compatibility; it no longer picks a drawn face.)
 */
export const ClientAvatar: React.FC<{
  avatarId?: string;
  name: string;
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ name, photoUrl, size = 'md' }) => {
  const dims =
    size === 'sm' ? 'w-9 h-9 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-11 h-11 text-sm';
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <div
      className={`${dims} rounded-full overflow-hidden shrink-0 bg-[#F3F4F6] border border-gray-200/80 flex items-center justify-center font-semibold text-[#374151] select-none`}
      title={name}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
};

export const InBodyPrintoutThumbnail: React.FC<{ fileName?: string }> = ({ fileName }) => (
  <div className="w-28 bg-white rounded-lg border border-gray-200 shadow-sm p-2.5 text-left select-none mx-auto">
    <div className="flex items-center justify-between border-b border-gray-200 pb-1 mb-1.5">
      <span className="text-[9px] font-bold tracking-tight text-[#111827]">InBody</span>
      <span className="text-[6px] text-gray-400 font-mono">270</span>
    </div>
    <div className="grid grid-cols-3 gap-1 mb-1.5">
      <div className="h-1.5 bg-gray-200 rounded-sm" />
      <div className="h-1.5 bg-gray-100 rounded-sm" />
      <div className="text-[8px] font-bold text-right text-[#111827] leading-none">81</div>
    </div>
    <div className="space-y-1 mb-2">
      <div className="flex items-center gap-1">
        <div className="w-5 h-1 bg-gray-300 rounded-sm" />
        <div className="h-1 w-10 bg-[#111827] rounded-sm" />
      </div>
      <div className="flex items-center gap-1">
        <div className="w-5 h-1 bg-gray-300 rounded-sm" />
        <div className="h-1 w-12 bg-[#FFC809] rounded-sm" />
      </div>
      <div className="flex items-center gap-1">
        <div className="w-5 h-1 bg-gray-300 rounded-sm" />
        <div className="h-1 w-7 bg-gray-400 rounded-sm" />
      </div>
    </div>
    <div className="border-t border-gray-100 pt-1 grid grid-cols-2 gap-1">
      <div className="h-1 bg-gray-200 rounded-sm" />
      <div className="h-1 bg-gray-200 rounded-sm" />
      <div className="h-1 bg-gray-200 rounded-sm" />
      <div className="h-1 bg-gray-200 rounded-sm" />
    </div>
    {fileName && (
      <div className="mt-1.5 pt-1 border-t border-gray-100 text-[7px] text-gray-400 truncate">
        {fileName}
      </div>
    )}
  </div>
);

export const InBodySegmentSilhouette: React.FC<{
  segments: {
    leftArm: number;
    rightArm: number;
    trunk: number;
    leftLeg: number;
    rightLeg: number;
  };
  onChangeSegment?: (
    key: 'leftArm' | 'rightArm' | 'trunk' | 'leftLeg' | 'rightLeg',
    value: number
  ) => void;
}> = ({ segments, onChangeSegment }) => {
  return (
    <div className="relative flex flex-col items-center justify-center py-2 select-none">
      <div className="relative w-[230px] h-[320px] flex items-center justify-center">
        {/* Clean anatomical outline matching Mockups 3, 4, 7, 8 */}
        <svg viewBox="0 0 200 310" className="w-full h-full">
          {/* Body silhouette outline */}
          <path
            d="M100 14
               C109 14, 115 21, 115 31
               C115 39, 111 45, 108 49
               L109 55
               C122 58, 134 62, 139 72
               C143 82, 146 105, 150 124
               L156 147
               C158 152, 162 156, 164 160
               C162 162, 158 160, 156 158
               C157 164, 159 170, 157 172
               C155 173, 153 168, 152 165
               C151 169, 149 173, 147 172
               C146 171, 147 166, 147 162
               C145 164, 143 166, 142 164
               C141 162, 143 155, 143 149
               L136 122
               C133 108, 130 95, 127 86
               L123 130
               C125 144, 128 160, 127 182
               C126 206, 123 228, 121 248
               C119 266, 118 279, 120 288
               C122 293, 125 297, 123 299
               C119 301, 111 300, 109 296
               C107 291, 108 279, 107 262
               C106 242, 105 218, 103 196
               L100 182
               L97 196
               C95 218, 94 242, 93 262
               C92 279, 93 291, 91 296
               C89 300, 81 301, 77 299
               C75 297, 78 293, 80 288
               C82 279, 81 266, 79 248
               C77 228, 74 206, 73 182
               C72 160, 75 144, 77 130
               L73 86
               C70 95, 67 108, 64 122
               L57 149
               C57 155, 59 162, 58 164
               C57 166, 55 164, 53 162
               C53 166, 54 171, 53 172
               C51 173, 49 169, 48 165
               C47 168, 45 173, 43 172
               C41 170, 43 164, 44 158
               C42 160, 38 162, 36 160
               C38 156, 42 152, 44 147
               L50 124
               C54 105, 57 82, 61 72
               C66 62, 78 58, 91 55
               L92 49
               C89 45, 85 39, 85 31
               C85 21, 91 14, 100 14 Z"
            fill="#F3F4F6"
            stroke="#111827"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />

          {/* Dashed Segment Separation Lines matching InBody 270 diagram */}
          {/* Left Shoulder */}
          <line
            x1="70"
            y1="62"
            x2="75"
            y2="92"
            stroke="#6B7280"
            strokeWidth="1.1"
            strokeDasharray="3 3"
          />
          {/* Right Shoulder */}
          <line
            x1="130"
            y1="62"
            x2="125"
            y2="92"
            stroke="#6B7280"
            strokeWidth="1.1"
            strokeDasharray="3 3"
          />
          {/* Left Pelvis/Leg crease */}
          <line
            x1="75"
            y1="154"
            x2="100"
            y2="174"
            stroke="#6B7280"
            strokeWidth="1.1"
            strokeDasharray="3 3"
          />
          {/* Right Pelvis/Leg crease */}
          <line
            x1="125"
            y1="154"
            x2="100"
            y2="174"
            stroke="#6B7280"
            strokeWidth="1.1"
            strokeDasharray="3 3"
          />
        </svg>

        {/* Left Arm Label */}
        <div className="absolute left-0 top-[102px] text-right">
          {onChangeSegment ? (
            <label className="inline-flex items-center gap-0.5 text-[13px] font-medium text-[#111827] tabular-nums bg-white/90 px-1.5 py-0.5 rounded border border-transparent hover:border-gray-300 focus-within:border-[#111827]">
              <WeightInput
                step="0.1"
                kg={segments.leftArm}
                onChangeKg={(kg) => onChangeSegment('leftArm', kg ?? 0)}
                className="w-10 text-right bg-transparent focus:outline-none tabular-nums"
                aria-label={`Left Arm Lean Mass ${WEIGHT_UNIT}`}
              />
              <span>{WEIGHT_UNIT}</span>
            </label>
          ) : (
            <span className="text-[13px] font-medium text-[#111827] tabular-nums">
              {formatWeight(segments.leftArm)}
            </span>
          )}
        </div>

        {/* Right Arm Label */}
        <div className="absolute right-0 top-[102px] text-left">
          {onChangeSegment ? (
            <label className="inline-flex items-center gap-0.5 text-[13px] font-medium text-[#111827] tabular-nums bg-white/90 px-1.5 py-0.5 rounded border border-transparent hover:border-gray-300 focus-within:border-[#111827]">
              <WeightInput
                step="0.1"
                kg={segments.rightArm}
                onChangeKg={(kg) => onChangeSegment('rightArm', kg ?? 0)}
                className="w-10 text-right bg-transparent focus:outline-none tabular-nums"
                aria-label={`Right Arm Lean Mass ${WEIGHT_UNIT}`}
              />
              <span>{WEIGHT_UNIT}</span>
            </label>
          ) : (
            <span className="text-[13px] font-medium text-[#111827] tabular-nums">
              {formatWeight(segments.rightArm)}
            </span>
          )}
        </div>

        {/* Trunk Label (Centered inside torso) */}
        <div className="absolute top-[118px] left-1/2 -translate-x-1/2 text-center">
          {onChangeSegment ? (
            <label className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-[#111827] tabular-nums bg-white/80 px-1 rounded border border-transparent hover:border-gray-300 focus-within:border-[#111827]">
              <WeightInput
                step="0.1"
                kg={segments.trunk}
                onChangeKg={(kg) => onChangeSegment('trunk', kg ?? 0)}
                className="w-11 text-center bg-transparent focus:outline-none tabular-nums"
                aria-label={`Trunk Lean Mass ${WEIGHT_UNIT}`}
              />
              <span>{WEIGHT_UNIT}</span>
            </label>
          ) : (
            <span className="text-[13px] font-medium text-[#111827] tabular-nums">
              {formatWeight(segments.trunk)}
            </span>
          )}
        </div>

        {/* Left Leg Label */}
        <div className="absolute left-2 bottom-[66px] text-right">
          {onChangeSegment ? (
            <label className="inline-flex items-center gap-0.5 text-[13px] font-medium text-[#111827] tabular-nums bg-white/90 px-1.5 py-0.5 rounded border border-transparent hover:border-gray-300 focus-within:border-[#111827]">
              <WeightInput
                step="0.1"
                kg={segments.leftLeg}
                onChangeKg={(kg) => onChangeSegment('leftLeg', kg ?? 0)}
                className="w-10 text-right bg-transparent focus:outline-none tabular-nums"
                aria-label={`Left Leg Lean Mass ${WEIGHT_UNIT}`}
              />
              <span>{WEIGHT_UNIT}</span>
            </label>
          ) : (
            <span className="text-[13px] font-medium text-[#111827] tabular-nums">
              {formatWeight(segments.leftLeg)}
            </span>
          )}
        </div>

        {/* Right Leg Label */}
        <div className="absolute right-2 bottom-[66px] text-left">
          {onChangeSegment ? (
            <label className="inline-flex items-center gap-0.5 text-[13px] font-medium text-[#111827] tabular-nums bg-white/90 px-1.5 py-0.5 rounded border border-transparent hover:border-gray-300 focus-within:border-[#111827]">
              <WeightInput
                step="0.1"
                kg={segments.rightLeg}
                onChangeKg={(kg) => onChangeSegment('rightLeg', kg ?? 0)}
                className="w-10 text-right bg-transparent focus:outline-none tabular-nums"
                aria-label={`Right Leg Lean Mass ${WEIGHT_UNIT}`}
              />
              <span>{WEIGHT_UNIT}</span>
            </label>
          ) : (
            <span className="text-[13px] font-medium text-[#111827] tabular-nums">
              {formatWeight(segments.rightLeg)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const ExerciseIllustration: React.FC<{
  type: Exercise['illustrationType'];
  className?: string;
}> = ({ type, className = 'w-full h-40' }) => {
  return (
    <div
      className={`${className} rounded-xl overflow-hidden bg-[#D8DCE3] relative flex items-center justify-center select-none`}
    >
      <svg viewBox="0 0 320 200" className="w-full h-full object-cover">
        {/* Clean studio gym background: white wall, black squat rack uprights, dark rubber floor */}
        <rect width="320" height="135" fill="#E5E7EB" />
        {/* Studio rack uprights */}
        <rect x="26" y="0" width="8" height="135" fill="#1F2937" />
        <rect x="292" y="0" width="7" height="135" fill="#1F2937" />
        {/* Gym floor */}
        <rect y="135" width="320" height="65" fill="#26292E" />
        {/* Gym mat */}
        <rect x="35" y="148" width="250" height="10" rx="3" fill="#111827" />

        {type === 'hip-lift' && (
          <g>
            {/* Foam roller under knees */}
            <circle cx="195" cy="140" r="10" fill="#111827" />
            {/* Supine athlete doing 90/90 hip lift */}
            {/* Head */}
            <circle cx="88" cy="136" r="11" fill="#E0AC8B" />
            <path d="M77 136 C77 125, 96 125, 96 134 Z" fill="#4B3621" />
            {/* Torso on mat */}
            <path
              d="M98 140 L165 135 L168 147 L98 148 Z"
              fill="#6B7280"
            />
            {/* Pelvis lifted slightly + Thighs */}
            <path
              d="M162 136 L208 110 L216 118 L170 146 Z"
              fill="#111827"
            />
            {/* Lower legs angled to floor/box */}
            <path
              d="M208 110 L245 140 L238 146 L202 118 Z"
              fill="#E0AC8B"
            />
            {/* Shoes */}
            <rect x="238" y="138" width="18" height="9" rx="4" fill="#4B5563" />
            {/* Yellow biomechanical cue arc at pelvis */}
            <path
              d="M158 124 Q170 112 182 120"
              stroke="#FFC809"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}

        {type === 'goblet-squat' && (
          <g>
            {/* Rack uprights behind */}
            <rect x="78" y="0" width="6" height="135" fill="#1F2937" />
            <rect x="236" y="0" width="6" height="135" fill="#1F2937" />
            {/* Athlete in deep symmetrical goblet squat facing front */}
            {/* Legs */}
            <path
              d="M138 115 L118 118 L122 152 L134 152 L134 128 L160 130 L186 128 L186 152 L198 152 L202 118 L182 115 Z"
              fill="#111827"
            />
            {/* Torso */}
            <rect x="138" y="68" width="44" height="50" rx="10" fill="#6B7280" />
            {/* Head */}
            <circle cx="160" cy="48" r="13" fill="#E0AC8B" />
            <path d="M148 44 C148 32, 172 32, 172 44 Z" fill="#2D231E" />
            {/* Arms holding dumbbell vertically at chest */}
            <path
              d="M138 74 L128 96 L150 96 M182 74 L192 96 L170 96"
              stroke="#E0AC8B"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Dumbbell at sternum */}
            <rect x="151" y="72" width="18" height="7" rx="2" fill="#111827" />
            <rect x="156" y="79" width="8" height="14" fill="#374151" />
            <rect x="151" y="93" width="18" height="7" rx="2" fill="#111827" />
            {/* Yellow vertical stack indicator */}
            <line
              x1="160"
              y1="62"
              x2="160"
              y2="142"
              stroke="#FFC809"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
          </g>
        )}

        {type === 'clam' && (
          <g>
            {/* Side-lying athlete on mat */}
            <circle cx="88" cy="116" r="11" fill="#F1C6A7" />
            {/* Supporting arm */}
            <path
              d="M82 126 L72 145 L98 145"
              stroke="#F1C6A7"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Torso */}
            <path d="M98 126 L166 132 L164 147 L96 144 Z" fill="#6B7280" />
            {/* Bottom leg */}
            <path
              d="M164 140 L216 146 L252 144"
              stroke="#111827"
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
            />
            {/* Top leg abducted (Clam open) */}
            <path
              d="M164 136 L210 114 L248 140"
              stroke="#1F2937"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Yellow abduction arc */}
            <path
              d="M214 140 A 26 26 0 0 0 212 112"
              stroke="#FFC809"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}

        {type === 'hip-rotation' && (
          <g>
            {/* Quadruped active hip rotation */}
            <circle cx="226" cy="96" r="11" fill="#F1C6A7" />
            {/* Supporting right arm on mat */}
            <line
              x1="208"
              y1="104"
              x2="208"
              y2="148"
              stroke="#F1C6A7"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Torso */}
            <path d="M148 92 L212 96 L210 112 L146 110 Z" fill="#6B7280" />
            {/* Supporting knee on mat */}
            <path
              d="M152 106 L152 146 L112 146"
              stroke="#111827"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Elevated rotating hip/leg */}
            <path
              d="M150 96 L116 86 L124 58"
              stroke="#1F2937"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="150" cy="96" r="4" fill="#FFC809" />
          </g>
        )}

        {(type === 'rdl' ||
          type === 'belly-lift' ||
          type === 'split-squat' ||
          type === 'landmine-press' ||
          type === 'wall-squat' ||
          type === 'pallof-press') && (
          <g>
            {/* Athletic hinge / unilateral movement silhouette */}
            <circle cx="196" cy="68" r="12" fill="#E0AC8B" />
            {/* Hinged / stacked torso */}
            <path d="M136 92 L184 72 L190 88 L142 108 Z" fill="#4B5563" />
            {/* Hips & Legs */}
            <path
              d="M138 102 L148 148 M144 102 L122 148"
              stroke="#111827"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Arms + Barbell/Load */}
            <line
              x1="176"
              y1="82"
              x2="176"
              y2="128"
              stroke="#E0AC8B"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <circle cx="176" cy="130" r="14" fill="#111827" stroke="#FFC809" strokeWidth="2.5" />
          </g>
        )}
      </svg>
    </div>
  );
};
