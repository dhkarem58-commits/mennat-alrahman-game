import React, { useEffect, useState } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  ChevronDown,
  Compass,
  LogIn,
  LogOut,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { getNextRank, getRankForXp } from '../../curriculum';
import { DailyReviewSchedule } from '../../curriculum/smartReviewer';

export type ActiveViewMode = 'map' | 'bank' | 'review' | 'achievements';

interface TopBarProps {
  activeView: ActiveViewMode;
  onChangeView: (view: ActiveViewMode) => void;
  xp: number;
  currentStreak: number;
  dueReviewCount: number;
  dailySchedule: DailyReviewSchedule;
  userEmail: string | null;
  displayName: string;
  isAuthBusy: boolean;
  isOnline: boolean;
  onOpenSettings: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onChangeView,
  xp,
  currentStreak,
  dueReviewCount,
  dailySchedule,
  userEmail,
  displayName,
  isAuthBusy,
  isOnline,
  onOpenSettings,
  onSignIn,
  onSignOut,
}) => {
  const rank = getRankForXp(xp);
  const nextRank = getNextRank(xp);

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [dismissedDueCount, setDismissedDueCount] = useState<number | null>(null);

  // Re-surface notification automatically if new cards become due
  useEffect(() => {
    if (dismissedDueCount !== null && dailySchedule.dueCount > dismissedDueCount) {
      setDismissedDueCount(null);
    }
    if (dailySchedule.dueCount === 0) {
      setIsScheduleOpen(false);
    }
  }, [dailySchedule.dueCount, dismissedDueCount]);

  const showSmartAlert =
    dailySchedule.dueCount > 0 && dismissedDueCount !== dailySchedule.dueCount;

  const navItems: {
    id: ActiveViewMode;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { id: 'map', label: 'الخريطة الثلاثية', icon: <Compass className="h-4 w-4" /> },
    { id: 'bank', label: 'بنك الكراسة (١٦٠)', icon: <BookOpen className="h-4 w-4" /> },
    {
      id: 'review',
      label: 'المراجعة الذكية',
      icon: <RotateCcw className="h-4 w-4" />,
      badge: dueReviewCount > 0 ? dueReviewCount : undefined,
    },
    { id: 'achievements', label: 'الأوسمة والرتبة', icon: <Award className="h-4 w-4" /> },
  ];

  return (
    <header className="pointer-events-auto relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[#171C19]/12 bg-[#FBF9F4] px-4 py-2.5 shadow-xs">
      {/* Zone 1: Brand Title */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#C8922B]/35 bg-[#F2ECE1] text-[#C8922B]">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-scholar text-lg font-bold leading-tight text-[#171C19]">
            أكاديمية المِنَّة ثلاثية الأبعاد
          </h1>
          <div className="flex items-center gap-2 text-xs text-[#171C19]/65 tabular-nums">
            <span>الرتبة: {rank.title}</span>
            <span>·</span>
            <span className="font-semibold text-[#C8922B]">{xp} نقطة</span>
            {nextRank && (
              <>
                <span>·</span>
                <span>التالي: {nextRank.minXp}</span>
              </>
            )}
            {currentStreak > 0 && (
              <>
                <span>·</span>
                <span className="font-semibold text-[#1E6B47]">
                  سلسلة {currentStreak}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Zone 2: Navigation Tabs */}
      <nav
        aria-label="التنقل الرئيسي"
        className="flex flex-wrap items-center gap-1 rounded-lg border border-[#171C19]/10 bg-[#F2ECE1] p-1"
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setIsScheduleOpen(false);
                onChangeView(item.id);
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                isActive
                  ? 'bg-[#FBF9F4] text-[#1E6B47] shadow-xs border border-[#171C19]/10'
                  : 'text-[#171C19]/75 hover:bg-[#FBF9F4]/60 hover:text-[#171C19]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="mr-0.5 rounded bg-[#B9382C] px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Smart Reviewer Notification + Offline Badge + Cloud Sync + Settings */}
      <div className="relative flex flex-wrap items-center gap-2">
        {!isOnline && (
          <div
            role="status"
            aria-label="وضع العمل بلا إنترنت"
            className="flex items-center gap-1.5 rounded-lg border border-[#C8922B]/50 bg-[#C8922B]/14 px-2.5 py-1.5 text-xs font-bold text-[#6D4D0B]"
          >
            <WifiOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">بلا اتصال</span>
          </div>
        )}

        {showSmartAlert && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsScheduleOpen((o) => !o)}
              aria-expanded={isScheduleOpen}
              className="flex items-center gap-2 rounded-lg border border-[#C8922B]/45 bg-[#C8922B]/14 px-3 py-1.5 text-xs font-bold text-[#6D4D0B] transition hover:bg-[#C8922B]/22"
            >
              <Bell className="h-3.5 w-3.5 text-[#C8922B]" />
              <span className="tabular-nums">
                جدول اليوم: {dailySchedule.dueCount} مستحقة · ~{dailySchedule.estimatedMinutes} د
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  isScheduleOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isScheduleOpen && (
              <div
                role="region"
                aria-label="جدول المراجعة الذكي اليومي"
                className="fixed left-4 top-[66px] z-40 w-[min(92vw,370px)] rounded-2xl border border-[#171C19]/15 bg-[#FBF9F4] p-4 shadow-xl sm:absolute sm:left-0 sm:top-full sm:mt-2"
              >
                <div className="flex items-start justify-between gap-2 border-b border-[#171C19]/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E6B47]/12 text-[#1E6B47]">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-[#171C19]">
                        المُراجِع الذكي · جدول اليوم
                      </div>
                      <div className="text-[11px] text-[#171C19]/65 tabular-nums">
                        {dailySchedule.dueCount} بطاقة مستحقة
                        {dailySchedule.overdueCount > 0
                          ? ` (${dailySchedule.overdueCount} متأخرة)`
                          : ''}
                        {' · '}~{dailySchedule.estimatedMinutes} دقيقة
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScheduleOpen(false)}
                    aria-label="إغلاق جدول اليوم"
                    className="rounded p-1 text-[#171C19]/50 hover:bg-[#F2ECE1] hover:text-[#171C19]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-[#171C19]/80">
                  {dailySchedule.headline}
                </p>

                {dailySchedule.todayBatch.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-extrabold text-[#8E6210]">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>أولوية البداية اليوم:</span>
                    </div>
                    {dailySchedule.todayBatch.slice(0, 3).map((item) => (
                      <div
                        key={item.fact.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#171C19]/10 bg-white px-2.5 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-[#171C19]">
                            {item.fact.title}
                          </div>
                          <div className="text-[11px] text-[#171C19]/60">
                            {item.reasonLabel} · {item.timeLabel}
                          </div>
                        </div>
                        <span className="shrink-0 rounded bg-[#F2ECE1] px-1.5 py-0.5 text-[10px] font-bold text-[#171C19]/75 tabular-nums">
                          ص {item.fact.bookPage}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsScheduleOpen(false);
                      onChangeView('review');
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1E6B47] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#175538]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>ابدأ جلسة المراجعة اليوم</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDismissedDueCount(dailySchedule.dueCount);
                      setIsScheduleOpen(false);
                    }}
                    className="rounded-lg border border-[#171C19]/12 bg-[#F2ECE1] px-3 py-2 text-xs font-bold text-[#171C19]/75 hover:bg-[#E7DEC9]"
                  >
                    لاحقاً
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {userEmail ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#1E6B47]/25 bg-[#F2ECE1] px-3 py-1.5">
            <div className="text-right">
              <div className="text-xs font-bold text-[#171C19]">{displayName}</div>
              <div className="text-[11px] text-[#1E6B47]">متصل · الحفظ السحابي مفعّل</div>
            </div>
            <button
              type="button"
              disabled={isAuthBusy}
              onClick={onSignOut}
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
              className="rounded-md border border-[#171C19]/12 bg-[#FBF9F4] p-1.5 text-[#171C19]/75 transition hover:text-[#B9382C] disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isAuthBusy}
            onClick={onSignIn}
            aria-label="تسجيل الدخول بحساب Google لحفظ التقدم سحابياً"
            className="flex items-center gap-2 rounded-lg bg-[#1E6B47] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#175538] disabled:opacity-60 sm:px-3.5 sm:text-sm"
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">حفظ التقدم سحابياً (Google)</span>
            <span className="sm:hidden">حفظ سحابي</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="قائمة الإيقاف والإعدادات"
          title="الإعدادات وقائمة الإيقاف (Esc)"
          className="flex items-center gap-1.5 rounded-lg border border-[#171C19]/15 bg-[#F2ECE1] px-2.5 py-2 text-xs font-bold text-[#171C19] transition hover:bg-[#E7DEC9]"
        >
          <SlidersHorizontal className="h-4 w-4 text-[#1E6B47]" />
          <span className="hidden md:inline">الإعدادات</span>
        </button>
      </div>
    </header>
  );
};
