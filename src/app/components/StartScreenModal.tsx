import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Compass,
  Download,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  User,
  X,
} from 'lucide-react';
import {
  AvatarConfig,
  AvatarGender,
  COMPANION_COLOR_OPTIONS,
  CosmeticSwatch,
  ROBE_COLOR_OPTIONS,
  SATCHEL_COLOR_OPTIONS,
} from '../../game/types';
import { PWAInstallHookState } from './SettingsPanel';

interface StartScreenModalProps {
  isOpen: boolean;
  hasStartedOnce: boolean;
  avatar: AvatarConfig;
  cosmeticStars: number;
  unlockedCosmeticIds: string[];
  initialTab?: 'home' | 'cosmetics';
  completedCardsCount: number;
  xp: number;
  onContinue: () => void;
  onNewGame: () => void;
  onUpdateAvatar: (next: AvatarConfig) => void;
  onUnlockCosmetic: (item: CosmeticSwatch) => void;
  pwa: PWAInstallHookState;
}

export const StartScreenModal: React.FC<StartScreenModalProps> = ({
  isOpen,
  hasStartedOnce,
  avatar,
  cosmeticStars,
  unlockedCosmeticIds,
  initialTab = 'home',
  completedCardsCount,
  xp,
  onContinue,
  onNewGame,
  onUpdateAvatar,
  onUnlockCosmetic,
  pwa,
}) => {
  const [tab, setTab] = useState<'home' | 'cosmetics'>(initialTab);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setConfirmReset(false);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const unlockedSet = new Set(unlockedCosmeticIds);

  const renderSwatchGroup = (
    title: string,
    items: CosmeticSwatch[],
    selectedId: string,
    onSelect: (id: string) => void
  ) => (
    <div className="space-y-2">
      <div className="text-xs font-bold text-[#171C19]/80">{title}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const isUnlocked = item.cost === 0 || unlockedSet.has(item.id);
          const isSelected = selectedId === item.id;
          const canAfford = cosmeticStars >= item.cost;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (isUnlocked) {
                  onSelect(item.id);
                } else if (canAfford) {
                  onUnlockCosmetic(item);
                  onSelect(item.id);
                }
              }}
              className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-right transition ${
                isSelected
                  ? 'border-[#1E6B47] bg-[#1E6B47]/10'
                  : isUnlocked
                    ? 'border-[#171C19]/14 bg-white hover:bg-[#F2ECE1]'
                    : canAfford
                      ? 'border-[#C8922B]/55 bg-[#C8922B]/10 hover:bg-[#C8922B]/20'
                      : 'border-[#171C19]/10 bg-[#F2ECE1]/60 opacity-65'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-5 w-5 shrink-0 rounded-md border border-[#171C19]/20"
                  style={{ backgroundColor: item.hex }}
                />
                <span className="text-xs font-bold text-[#171C19]">{item.label}</span>
              </div>
              {isSelected ? (
                <Check className="h-4 w-4 shrink-0 text-[#1E6B47]" />
              ) : !isUnlocked ? (
                <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#8E6210] tabular-nums">
                  <Lock className="h-3 w-3" />
                  {item.cost}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="بداية أكاديمية المِنَّة وتخصيص الشخصية"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#171C19]/55 p-3 sm:p-5"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#171C19]/15 bg-[#FBF9F4] shadow-2xl">
        {/* Top Banner */}
        <div className="flex items-center justify-between border-b border-[#171C19]/12 bg-[#F2ECE1] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#C8922B]/40 bg-[#FBF9F4] text-[#C8922B]">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-scholar text-2xl font-bold text-[#171C19]">
                أكاديمية المِنَّة ثلاثية الأبعاد
              </h1>
              <p className="text-xs text-[#171C19]/70">
                رحلة تفاعلية لفهم وحفظ أبواب العقيدة الخمسة (كراسة المنة)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-[#C8922B]/35 bg-[#C8922B]/14 px-2.5 py-1.5 text-xs font-bold text-[#7B5509] tabular-nums">
              <Star className="h-3.5 w-3.5 fill-[#C8922B] text-[#C8922B]" />
              <span>{cosmeticStars}</span>
            </div>
            {hasStartedOnce && (
              <button
                type="button"
                onClick={onContinue}
                aria-label="إغلاق والعودة للأرخبيل"
                className="rounded-lg border border-[#171C19]/15 bg-[#FBF9F4] p-2 text-[#171C19]/75 hover:bg-[#E7DEC9]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex gap-2 border-b border-[#171C19]/10 bg-[#FBF9F4] px-5 pt-3">
          <button
            type="button"
            onClick={() => setTab('home')}
            className={`rounded-t-lg border-b-2 px-4 py-2 text-xs font-bold transition ${
              tab === 'home'
                ? 'border-[#1E6B47] text-[#1E6B47]'
                : 'border-transparent text-[#171C19]/65 hover:text-[#171C19]'
            }`}
          >
            الدخول للأرخبيل
          </button>
          <button
            type="button"
            onClick={() => setTab('cosmetics')}
            className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-4 py-2 text-xs font-bold transition ${
              tab === 'cosmetics'
                ? 'border-[#C8922B] text-[#8E6210]'
                : 'border-transparent text-[#171C19]/65 hover:text-[#171C19]'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>الشخصية والألوان التجميلية</span>
          </button>
        </div>

        {/* Body */}
        <div className="scholar-scroll flex-1 space-y-5 overflow-y-auto p-5">
          {tab === 'home' ? (
            <>
              {/* Gender quick pick on first start */}
              <div className="rounded-xl border border-[#171C19]/12 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#171C19]">
                  <User className="h-4 w-4 text-[#1E6B47]" />
                  <span>اختر شخصية طالب العلم</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { id: 'boy', label: 'طالب (ثوب محتشم وطاقية)' },
                      { id: 'girl', label: 'طالبة (عباءة وحجاب محتشم)' },
                    ] as { id: AvatarGender; label: string }[]
                  ).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onUpdateAvatar({ ...avatar, gender: g.id })}
                      aria-pressed={avatar.gender === g.id}
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-xs font-bold transition ${
                        avatar.gender === g.id
                          ? 'border-[#1E6B47] bg-[#1E6B47]/10 text-[#144D33]'
                          : 'border-[#171C19]/15 bg-[#FBF9F4] text-[#171C19] hover:bg-[#F2ECE1]'
                      }`}
                    >
                      <span>{g.label}</span>
                      {avatar.gender === g.id && <Check className="h-4 w-4 text-[#1E6B47]" />}
                    </button>
                  ))}
                </div>
              </div>

              {hasStartedOnce && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1E6B47]/25 bg-[#1E6B47]/8 px-4 py-3 text-xs text-[#144D33]">
                  <span className="font-bold">تقدّمك محفوظ ومُزامن</span>
                  <span className="tabular-nums">
                    {xp} نقطة خبرة · {completedCardsCount} بطاقة مستوعبة
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={onContinue}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E6B47] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#175538]"
                >
                  <Play className="h-4 w-4" />
                  <span>{hasStartedOnce ? 'استمرار من آخر موضع' : 'ابدأ الرحلة الآن'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('cosmetics')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#C8922B]/45 bg-[#C8922B]/14 px-4 py-3 text-xs font-bold text-[#7B5509] hover:bg-[#C8922B]/22"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>الشخصية والتجميل</span>
                </button>

                {hasStartedOnce && (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[#171C19]/15 bg-[#F2ECE1] px-4 py-3 text-xs font-bold text-[#171C19] hover:bg-[#E7DEC9]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>بداية جديدة</span>
                  </button>
                )}
              </div>

              {confirmReset && (
                <div className="rounded-xl border border-[#B9382C]/35 bg-[#B9382C]/8 p-3.5 text-xs">
                  <div className="font-bold text-[#7E2118]">
                    هل تريد إعادة موضع الشخصية إلى الساحة المركزية وبدء جولة جديدة؟ (يبقى رصيدك العلمي محفوظاً، أو يمكنك استكشاف الجزر من البداية).
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false);
                        onNewGame();
                      }}
                      className="rounded-lg bg-[#171C19] px-3.5 py-1.5 font-bold text-white"
                    >
                      تأكيد البداية من المركز
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="rounded-lg border border-[#171C19]/15 bg-white px-3.5 py-1.5 font-bold text-[#171C19]"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {!pwa.isInstalled && pwa.isInstallable && (
                <button
                  type="button"
                  onClick={() => void pwa.install()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1E6B47]/35 bg-white px-4 py-2.5 text-xs font-bold text-[#1E6B47] hover:bg-[#F2ECE1]"
                >
                  <Download className="h-4 w-4" />
                  <span>تثبيت «أكاديمية المِنَّة» كتطبيق يعمل بلا اتصال</span>
                </button>
              )}
            </>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-[#C8922B]/30 bg-[#C8922B]/10 p-3 text-xs text-[#6D4D0B]">
                تُجمع <strong>نجوم المعرفة</strong> يومياً أثناء التجوّل في الجزر، وتُستخدم هنا لفتح ألوان ثياب وحقائب محتشمة وإضاءة للرفيق النوراني دون أي تأثير على الرتب أو الأوسمة.
              </div>

              {/* Gender toggle */}
              <div className="flex gap-2">
                {(
                  [
                    { id: 'boy', label: 'طالب' },
                    { id: 'girl', label: 'طالبة' },
                  ] as { id: AvatarGender; label: string }[]
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onUpdateAvatar({ ...avatar, gender: g.id })}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold ${
                      avatar.gender === g.id
                        ? 'border-[#1E6B47] bg-[#1E6B47] text-white'
                        : 'border-[#171C19]/15 bg-white text-[#171C19]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {renderSwatchGroup(
                'ألوان الثياب والعباءة المحتشمة',
                ROBE_COLOR_OPTIONS,
                avatar.robeColorId,
                (id) => onUpdateAvatar({ ...avatar, robeColorId: id })
              )}

              {renderSwatchGroup(
                'ألوان حقيبة الكراسة',
                SATCHEL_COLOR_OPTIONS,
                avatar.satchelColorId,
                (id) => onUpdateAvatar({ ...avatar, satchelColorId: id })
              )}

              {renderSwatchGroup(
                'ألوان إضاءة الرفيق النوراني',
                COMPANION_COLOR_OPTIONS,
                avatar.companionColorId,
                (id) => onUpdateAvatar({ ...avatar, companionColorId: id })
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onContinue}
                  className="flex items-center gap-2 rounded-xl bg-[#1E6B47] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#175538]"
                >
                  <Compass className="h-4 w-4" />
                  <span>حفظ والعودة للأرخبيل</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
