import React, { useState } from 'react';
import {
  Accessibility,
  Check,
  Download,
  Eye,
  Gamepad2,
  HelpCircle,
  Home,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  FontSizeScale,
  GameSettings,
  MobileButtonSize,
  QualityPreset,
} from '../../game/types';

export interface PWAInstallHookState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  install: () => Promise<boolean>;
}

interface SettingsPanelProps {
  isOpen: boolean;
  settings: GameSettings;
  soundEnabled: boolean;
  onClose: () => void;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onToggleSound: () => void;
  onReplayTutorial: () => void;
  onReturnToStart: () => void;
  onOpenCosmetics: () => void;
  pwa: PWAInstallHookState;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  settings,
  soundEnabled,
  onClose,
  onUpdateSettings,
  onToggleSound,
  onReplayTutorial,
  onReturnToStart,
  onOpenCosmetics,
  pwa,
}) => {
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (!isOpen) return null;

  const qualityOptions: { id: QualityPreset; label: string }[] = [
    { id: 'auto', label: 'تلقائي (متكيّف)' },
    { id: 'low', label: 'منخفض (سلاسة قصوى)' },
    { id: 'medium', label: 'متوسط' },
    { id: 'high', label: 'عالٍ' },
  ];

  const buttonSizes: { id: MobileButtonSize; label: string }[] = [
    { id: 'normal', label: 'عادي (52px)' },
    { id: 'large', label: 'كبير (64px)' },
  ];

  const fontSizes: { id: FontSizeScale; label: string }[] = [
    { id: 'normal', label: 'قياسي' },
    { id: 'large', label: 'مُكبّر' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="قائمة الإيقاف والإعدادات"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#171C19]/55 p-3 sm:p-5"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#171C19]/15 bg-[#FBF9F4] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#171C19]/12 bg-[#F2ECE1] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="h-5 w-5 text-[#1E6B47]" />
            <div>
              <h2 className="font-scholar text-xl font-bold text-[#171C19]">
                قائمة الإيقاف والإعدادات
              </h2>
              <p className="text-xs text-[#171C19]/65">
                التخصيص، الصوت، الرسوميات، وإمكانية الوصول
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="متابعة اللعب وإغلاق الإعدادات"
            className="rounded-lg border border-[#171C19]/15 bg-[#FBF9F4] p-2 text-[#171C19]/75 hover:bg-[#E7DEC9]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="scholar-scroll flex-1 space-y-5 overflow-y-auto p-5">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#1E6B47] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#175538]"
            >
              <Check className="h-4 w-4" />
              <span>استئناف اللعب</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCosmetics();
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#C8922B]/40 bg-[#C8922B]/14 px-4 py-2.5 text-sm font-bold text-[#6D4D0B] hover:bg-[#C8922B]/22"
            >
              <Sparkles className="h-4 w-4" />
              <span>المظهر والتجميل</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onReplayTutorial();
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#171C19]/15 bg-[#F2ECE1] px-4 py-2.5 text-sm font-bold text-[#171C19] hover:bg-[#E7DEC9]"
            >
              <HelpCircle className="h-4 w-4 text-[#1E6B47]" />
              <span>إعادة التعليم</span>
            </button>
          </div>

          {/* Audio Controls */}
          <section className="space-y-3 rounded-xl border border-[#171C19]/12 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[#171C19]">
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-[#1E6B47]" />
                ) : (
                  <VolumeX className="h-4 w-4 text-[#B9382C]" />
                )}
                <span>المؤثرات الصوتية الهادئة (بدون موسيقى)</span>
              </div>
              <button
                type="button"
                onClick={onToggleSound}
                aria-pressed={soundEnabled}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                  soundEnabled
                    ? 'border-[#1E6B47] bg-[#1E6B47] text-white'
                    : 'border-[#171C19]/15 bg-[#F2ECE1] text-[#171C19]'
                }`}
              >
                {soundEnabled ? 'مفعّلة' : 'مكتومة'}
              </button>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-[#171C19]/70 tabular-nums">
                <span>مستوى الصوت</span>
                <span>{Math.round(settings.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                aria-label="مستوى الصوت"
                onChange={(e) => onUpdateSettings({ volume: Number(e.target.value) })}
                className="w-full accent-[#1E6B47]"
              />
            </div>
          </section>

          {/* Graphics & Camera */}
          <section className="space-y-3 rounded-xl border border-[#171C19]/12 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#171C19]">
              <Eye className="h-4 w-4 text-[#1E6B47]" />
              <span>الرسوميات وحساسية الكاميرا</span>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-[#171C19]/75">جودة العرض</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {qualityOptions.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onUpdateSettings({ quality: q.id })}
                    aria-pressed={settings.quality === q.id}
                    className={`rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
                      settings.quality === q.id
                        ? 'border-[#171C19] bg-[#171C19] text-white'
                        : 'border-[#171C19]/12 bg-[#FBF9F4] text-[#171C19] hover:bg-[#F2ECE1]'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs text-[#171C19]/70 tabular-nums">
                <span>حساسية تدوير الكاميرا</span>
                <span>{settings.cameraSensitivity.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={settings.cameraSensitivity}
                aria-label="حساسية الكاميرا"
                onChange={(e) => onUpdateSettings({ cameraSensitivity: Number(e.target.value) })}
                className="w-full accent-[#1E6B47]"
              />
            </div>
          </section>

          {/* Touch Controls */}
          <section className="space-y-3 rounded-xl border border-[#171C19]/12 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#171C19]">
              <Gamepad2 className="h-4 w-4 text-[#C8922B]" />
              <span>التحكم باللمس والهاتف</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-xs font-semibold text-[#171C19]/75">حجم الأزرار</div>
                <div className="flex gap-1.5">
                  {buttonSizes.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onUpdateSettings({ mobileButtonSize: b.id })}
                      aria-pressed={settings.mobileButtonSize === b.id}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${
                        settings.mobileButtonSize === b.id
                          ? 'border-[#171C19] bg-[#171C19] text-white'
                          : 'border-[#171C19]/12 bg-[#FBF9F4] text-[#171C19]'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#171C19]/10 bg-[#FBF9F4] px-3 py-2">
                <span className="text-xs font-bold text-[#171C19]">وضع اليد اليسرى</span>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ leftHanded: !settings.leftHanded })}
                  aria-pressed={settings.leftHanded}
                  className={`rounded-md border px-3 py-1 text-xs font-bold ${
                    settings.leftHanded
                      ? 'border-[#1E6B47] bg-[#1E6B47] text-white'
                      : 'border-[#171C19]/15 bg-white text-[#171C19]'
                  }`}
                >
                  {settings.leftHanded ? 'مفعّل' : 'متوقف'}
                </button>
              </div>
            </div>
          </section>

          {/* Accessibility */}
          <section className="space-y-3 rounded-xl border border-[#171C19]/12 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#171C19]">
              <Accessibility className="h-4 w-4 text-[#1E6B47]" />
              <span>سهولة الوصول والقراءة</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-[#171C19]/75">حجم الخط</div>
                <div className="flex gap-1.5">
                  {fontSizes.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onUpdateSettings({ fontSize: f.id })}
                      aria-pressed={settings.fontSize === f.id}
                      className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                        settings.fontSize === f.id
                          ? 'border-[#171C19] bg-[#171C19] text-white'
                          : 'border-[#171C19]/12 bg-[#FBF9F4] text-[#171C19]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onUpdateSettings({ reducedMotion: !settings.reducedMotion })}
                aria-pressed={settings.reducedMotion}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold ${
                  settings.reducedMotion
                    ? 'border-[#1E6B47] bg-[#1E6B47]/12 text-[#144D33]'
                    : 'border-[#171C19]/12 bg-[#FBF9F4] text-[#171C19]'
                }`}
              >
                <span>تقليل الحركة</span>
                <span>{settings.reducedMotion ? 'مفعّل' : 'لا'}</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ highContrast: !settings.highContrast })}
                aria-pressed={settings.highContrast}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold ${
                  settings.highContrast
                    ? 'border-[#171C19] bg-[#171C19] text-white'
                    : 'border-[#171C19]/12 bg-[#FBF9F4] text-[#171C19]'
                }`}
              >
                <span>تباين عالٍ</span>
                <span>{settings.highContrast ? 'مفعّل' : 'لا'}</span>
              </button>
            </div>
          </section>

          {/* PWA Install & Return Home */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#171C19]/10 pt-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onReturnToStart();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[#171C19]/15 bg-[#F2ECE1] px-4 py-2 text-xs font-bold text-[#171C19] hover:bg-[#E7DEC9]"
            >
              <Home className="h-4 w-4" />
              <span>العودة إلى شاشة البداية</span>
            </button>

            {!pwa.isInstalled && (pwa.isInstallable || pwa.isIOS) && (
              <button
                type="button"
                onClick={() => {
                  if (pwa.isInstallable) {
                    void pwa.install();
                  } else if (pwa.isIOS) {
                    setShowIOSGuide((v) => !v);
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border border-[#1E6B47] bg-[#1E6B47]/10 px-4 py-2 text-xs font-bold text-[#1E6B47] hover:bg-[#1E6B47] hover:text-white"
              >
                <Download className="h-4 w-4" />
                <span>{pwa.isIOS ? 'تثبيت على iOS' : 'تثبيت التطبيق للعمل بلا إنترنت'}</span>
              </button>
            )}
          </div>

          {showIOSGuide && (
            <div className="rounded-xl border border-[#C8922B]/40 bg-[#C8922B]/10 p-3 text-xs leading-relaxed text-[#171C19]">
              لتثبيت الأكاديمية على iPhone / iPad: اضغط زر <strong>المشاركة</strong> في متصفح Safari ثم اختر <strong>إضافة إلى الشاشة الرئيسية</strong>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
