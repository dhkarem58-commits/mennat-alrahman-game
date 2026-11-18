import React from 'react';
import {
  Camera,
  CheckCircle2,
  Compass,
  Eye,
  Flame,
  Map as MapIcon,
  Navigation,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  CameraMode,
  DailyChallengeState,
  InteractableTarget,
  MinimapMarker,
  QuestGuidanceState,
} from '../../game/types';
import { MiniMap } from './MiniMap';

interface QuestHudProps {
  guidance: QuestGuidanceState;
  nearestTarget: InteractableTarget | null;
  playerPos: { x: number; z: number; yaw: number };
  markers: MinimapMarker[];
  cosmeticStars: number;
  remainingStarsToday: number;
  dailyStreakDays: number;
  dailyChallenge: DailyChallengeState;
  cameraMode: CameraMode;
  isTouchDevice: boolean;
  onChangeCameraMode: (mode: CameraMode) => void;
  onActivateNearest: () => void;
  onWalkToTarget: () => void;
  onOpenCosmetics: () => void;
}

export const QuestHud: React.FC<QuestHudProps> = ({
  guidance,
  nearestTarget,
  playerPos,
  markers,
  cosmeticStars,
  remainingStarsToday,
  dailyStreakDays,
  dailyChallenge,
  cameraMode,
  isTouchDevice,
  onChangeCameraMode,
  onActivateNearest,
  onWalkToTarget,
  onOpenCosmetics,
}) => {
  const cameraModes: { id: CameraMode; label: string; icon: React.ReactNode }[] = [
    { id: 'player', label: 'وضع اللاعب', icon: <Eye className="h-3.5 w-3.5" /> },
    { id: 'orbit', label: 'استكشاف حر', icon: <Camera className="h-3.5 w-3.5" /> },
    { id: 'topdown', label: 'خريطة علوية', icon: <MapIcon className="h-3.5 w-3.5" /> },
  ];

  const compassDeg = (guidance.compassAngleRad * 180) / Math.PI;

  return (
    <>
      {/* Top Left/Right Gameplay Strip below TopBar */}
      <div className="pointer-events-none fixed inset-x-0 top-[118px] z-16 flex flex-wrap items-start justify-between gap-2 px-3 sm:top-[106px] lg:top-[68px] sm:px-4">
        {/* Right-aligned Goal Tracker & Compass + Companion Hint */}
        <div className="flex max-w-sm flex-col gap-1.5">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[#171C19]/15 bg-[#FBF9F4]/95 px-3 py-2 shadow-md">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#C8922B]/40 bg-[#C8922B]/14 text-[#8E6210]"
              aria-hidden="true"
            >
              <Navigation
                className="h-4.5 w-4.5 transition-transform duration-150"
                style={{ transform: `rotate(${compassDeg}deg)` }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold text-[#1E6B47]">
                الوجهة التالية · {guidance.distanceMeters} م
              </div>
              <div className="truncate text-xs font-bold text-[#171C19]">
                {guidance.targetTitle}
              </div>
            </div>
            <button
              type="button"
              onClick={onWalkToTarget}
              title="توجّه تلقائياً إلى الوجهة المقترحة"
              className="shrink-0 rounded-lg border border-[#1E6B47]/30 bg-[#1E6B47]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#1E6B47] transition hover:bg-[#1E6B47] hover:text-white"
            >
              توجّه
            </button>
          </div>

          {/* Luminous Companion Orb Contextual Hint */}
          <div className="pointer-events-auto hidden items-center gap-2 rounded-xl border border-[#C8922B]/25 bg-[#FBF9F4]/92 px-3 py-1.5 text-[11px] text-[#171C19]/85 shadow-sm sm:flex">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#C8922B]" />
            <span className="leading-snug">{guidance.companionHint}</span>
          </div>
        </div>

        {/* Left-aligned MiniMap, Daily Challenge, Streak & Stars + Camera Switcher */}
        <div className="flex items-start gap-2.5">
          <div className="flex flex-col items-end gap-1.5">
            {/* Daily Challenge + Streak + Cosmetic Stars */}
            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-xl border border-[#171C19]/15 bg-[#FBF9F4]/95 px-2.5 py-1.5 shadow-md">
              <button
                type="button"
                onClick={onOpenCosmetics}
                title="تخصيص المظهر ونجوم المعرفة (تجميلي فقط)"
                className="flex items-center gap-1 rounded-md border border-[#C8922B]/35 bg-[#C8922B]/14 px-2 py-1 text-xs font-bold text-[#7B5509] transition hover:bg-[#C8922B]/25 tabular-nums"
              >
                <Star className="h-3.5 w-3.5 fill-[#C8922B] text-[#C8922B]" />
                <span>{cosmeticStars}</span>
                <span className="hidden text-[10px] opacity-75 sm:inline">
                  (متاح اليوم {remainingStarsToday})
                </span>
              </button>

              <div
                className="flex items-center gap-1 rounded-md border border-[#171C19]/10 bg-[#F2ECE1] px-2 py-1 text-xs font-bold text-[#171C19] tabular-nums"
                title="سلسلة الأيام المتتالية"
              >
                <Flame className="h-3.5 w-3.5 text-[#B9382C]" />
                <span>{dailyStreakDays} ي</span>
              </div>

              <div
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold tabular-nums ${
                  dailyChallenge.claimed
                    ? 'border-[#1E6B47]/40 bg-[#1E6B47]/12 text-[#1E6B47]'
                    : 'border-[#171C19]/10 bg-[#F2ECE1] text-[#171C19]/80'
                }`}
                title="تحدي اليوم: استكمل بطاقات أو تحديات"
              >
                {dailyChallenge.claimed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#1E6B47]" />
                ) : (
                  <Compass className="h-3.5 w-3.5 text-[#C8922B]" />
                )}
                <span>
                  تحدي اليوم: {Math.min(dailyChallenge.completedActions, dailyChallenge.targetActions)}/
                  {dailyChallenge.targetActions}
                </span>
              </div>
            </div>

            {/* 3 Camera Mode Selector */}
            <div
              role="group"
              aria-label="أوضاع الكاميرا"
              className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[#171C19]/15 bg-[#FBF9F4]/95 p-1 shadow-sm"
            >
              {cameraModes.map((m) => {
                const active = cameraMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeCameraMode(m.id)}
                    aria-pressed={active}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                      active
                        ? 'bg-[#171C19] text-white'
                        : 'text-[#171C19]/75 hover:bg-[#F2ECE1]'
                    }`}
                  >
                    {m.icon}
                    <span className="hidden sm:inline">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Circular MiniMap */}
          <div className="hidden sm:block">
            <MiniMap
              playerX={playerPos.x}
              playerZ={playerPos.z}
              playerYaw={playerPos.yaw}
              targetX={guidance.targetPos.x}
              targetZ={guidance.targetPos.z}
              markers={markers}
              reviewPortalActive={guidance.reviewPortalActive}
              onExpandTopDown={() =>
                onChangeCameraMode(cameraMode === 'topdown' ? 'player' : 'topdown')
              }
            />
          </div>
        </div>
      </div>

      {/* Desktop / Non-touch Proximity Interaction Prompt */}
      {nearestTarget && !isTouchDevice && (
        <div className="pointer-events-auto fixed bottom-24 left-1/2 z-18 -translate-x-1/2">
          <button
            type="button"
            onClick={onActivateNearest}
            className="flex items-center gap-2.5 rounded-xl border-2 border-[#C8922B] bg-[#1E6B47] px-5 py-2.5 text-sm font-bold text-white shadow-xl transition hover:bg-[#175538]"
          >
            <Sparkles className="h-4 w-4 text-[#F6C453]" />
            <span>
              {nearestTarget.kind === 'review_portal'
                ? 'افتح بوابة المراجعة الذكية (E)'
                : `ابدأ المحطة: ${nearestTarget.title} (E)`}
            </span>
          </button>
        </div>
      )}
    </>
  );
};
