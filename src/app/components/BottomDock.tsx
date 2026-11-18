import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Globe,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CHAPTERS, ChapterId } from '../../curriculum';
import { StationProgressState } from '../../firebase/progressService';

interface BottomDockProps {
  selectedChapterId: ChapterId | null;
  onSelectChapter: (chapterId: ChapterId) => void;
  onResetOverview: () => void;
  onOpenStation: (stationId: string) => void;
  stationStates: Record<string, StationProgressState>;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  isZenMode: boolean;
  onToggleZenMode: () => void;
  isTouchDevice?: boolean;
  isPlayerMoving?: boolean;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  selectedChapterId,
  onSelectChapter,
  onResetOverview,
  onOpenStation,
  stationStates,
  soundEnabled,
  onToggleSound,
  isCollapsed,
  onToggleCollapsed,
  isZenMode,
  onToggleZenMode,
  isTouchDevice = false,
  isPlayerMoving = false,
}) => {
  const activeChapter = CHAPTERS.find((c) => c.id === selectedChapterId) ?? null;

  if (isZenMode) {
    return (
      <div className="pointer-events-auto fixed bottom-4 left-4 z-20">
        <button
          type="button"
          onClick={onToggleZenMode}
          aria-label="إظهار لوحة التحكم"
          className="flex items-center gap-2 rounded-lg border border-[#171C19]/15 bg-[#FBF9F4] px-3.5 py-2 text-xs font-bold text-[#171C19] shadow-md transition hover:bg-[#F2ECE1]"
        >
          <Eye className="h-4 w-4 text-[#1E6B47]" />
          <span>إظهار لوحة التحكم</span>
        </button>
      </div>
    );
  }

  // Minimize BottomDock during active joystick movement on touch screens
  if (isTouchDevice && isPlayerMoving) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-2 z-20 flex justify-center px-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-[#171C19]/14 bg-[#FBF9F4]/90 px-3 py-1.5 text-[11px] font-bold text-[#171C19]/75 shadow-sm">
          <Globe className="h-3.5 w-3.5 text-[#1E6B47]" />
          <span>جاري التنقل في الأرخبيل</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-2 z-20 flex flex-col items-center gap-2 px-3 sm:bottom-3"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Chapter Stations Quick Ribbon when a chapter island is selected */}
      {!isCollapsed && activeChapter && (
        <div className="pointer-events-auto w-full max-w-5xl rounded-xl border border-[#171C19]/12 bg-[#FBF9F4] p-2.5 shadow-md">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: activeChapter.accentHex }}
              />
              <h2 className="font-scholar text-base font-bold text-[#171C19]">
                {activeChapter.title}
              </h2>
              <span className="text-xs text-[#171C19]/60 tabular-nums">
                · ص {activeChapter.pagesRange}
              </span>
            </div>
            <span className="hidden text-xs text-[#171C19]/65 sm:inline">
              اختر محطة من هنا أو انقر على مجسمها في الجزيرة
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {activeChapter.stations.map((st) => {
              const prog = stationStates[st.id];
              const doneCards = prog?.completedCardIds.length ?? 0;
              const totalCards = st.facts.length;
              const isMastered = Boolean(prog?.challengePassed && (prog?.stars ?? 0) >= 2);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onOpenStation(st.id)}
                  className={`flex flex-col justify-between rounded-lg border p-2 text-right transition ${
                    isMastered
                      ? 'border-[#1E6B47]/40 bg-[#1E6B47]/8 hover:bg-[#1E6B47]/14'
                      : 'border-[#171C19]/12 bg-[#F2ECE1]/70 hover:bg-[#F2ECE1]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[11px] font-bold text-[#171C19]/60 tabular-nums">
                      محطة {st.order}
                    </span>
                    <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#C8922B] tabular-nums">
                      <Star
                        className={`h-3 w-3 ${
                          (prog?.stars ?? 0) > 0 ? 'fill-[#C8922B]' : 'text-[#171C19]/25'
                        }`}
                      />
                      {prog?.stars ?? 0}/3
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs font-bold leading-snug text-[#171C19]">
                    {st.title}
                  </div>
                  <div className="mt-1.5 text-[11px] text-[#171C19]/65 tabular-nums">
                    {doneCards}/{totalCards} بطاقات
                    {prog?.challengePassed ? ' · تحدٍ مجتاز' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Dock Strip */}
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-between gap-1.5 rounded-xl border border-[#171C19]/14 bg-[#FBF9F4] px-2.5 py-1.5 shadow-md sm:gap-2 sm:px-3 sm:py-2">
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={onResetOverview}
            aria-label="عرض الأرخبيل كاملاً من الأعلى"
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
              selectedChapterId === null
                ? 'border-[#1E6B47] bg-[#1E6B47] text-white'
                : 'border-[#171C19]/12 bg-[#F2ECE1] text-[#171C19] hover:bg-[#E7DEC9]'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>الأرخبيل كاملاً</span>
          </button>

          {CHAPTERS.map((ch) => {
            const isSel = selectedChapterId === ch.id;
            const totalSt = ch.stations.length;
            const masteredSt = ch.stations.filter((s) => {
              const p = stationStates[s.id];
              return p?.challengePassed && p.stars >= 2;
            }).length;

            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onSelectChapter(ch.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition sm:gap-2 sm:px-3 ${
                  isSel
                    ? 'border-[#171C19] bg-[#171C19] text-white'
                    : 'border-[#171C19]/12 bg-[#F2ECE1] text-[#171C19] hover:bg-[#E7DEC9]'
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-xs"
                  style={{ backgroundColor: ch.accentHex }}
                />
                <span>{ch.shortTitle}</span>
                <span className="opacity-70 tabular-nums">
                  {masteredSt}/{totalSt}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 border-r border-[#171C19]/12 pr-2">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'كتم المؤثرات الصوتية' : 'تفعيل المؤثرات الصوتية'}
            title={soundEnabled ? 'كتم المؤثرات' : 'تفعيل المؤثرات'}
            className="rounded-lg border border-[#171C19]/12 bg-[#F2ECE1] p-1.5 text-[#171C19] transition hover:bg-[#E7DEC9]"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-[#1E6B47]" />
            ) : (
              <VolumeX className="h-4 w-4 text-[#171C19]/50" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? 'توسيع قائمة المحطات' : 'طي قائمة المحطات'}
            title={isCollapsed ? 'توسيع المحطات' : 'طي شريط المحطات'}
            className="rounded-lg border border-[#171C19]/12 bg-[#F2ECE1] p-1.5 text-[#171C19] transition hover:bg-[#E7DEC9]"
          >
            {isCollapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleZenMode}
            aria-label="وضع التأمل وإخفاء القوائم"
            title="وضع التأمل ثلاثي الأبعاد (إخفاء القوائم)"
            className="rounded-lg border border-[#171C19]/12 bg-[#F2ECE1] p-1.5 text-[#171C19] transition hover:bg-[#E7DEC9]"
          >
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
