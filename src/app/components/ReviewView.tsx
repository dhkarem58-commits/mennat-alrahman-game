import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Compass,
  Eye,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';
import {
  ALL_FACTS,
  FactCard,
  getChapterById,
  getStationById,
} from '../../curriculum';
import { DailyReviewSchedule } from '../../curriculum/smartReviewer';
import { FactMasteryState } from '../../firebase/progressService';

interface ReviewViewProps {
  factStates: Record<string, FactMasteryState>;
  dailySchedule: DailyReviewSchedule;
  onRecordReview: (fact: FactCard, mastered: boolean) => void;
  onJumpToFact: (stationId: string, factId: string) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  factStates,
  dailySchedule,
  onRecordReview,
  onJumpToFact,
}) => {
  const [revealed, setRevealed] = useState(false);
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);
  const [sessionReviewedCount, setSessionReviewedCount] = useState(0);

  const reviewDeck = useMemo(() => {
    const now = dailySchedule.generatedAtMs;
    const scored = ALL_FACTS.map((fact) => {
      const st = factStates[fact.id];
      const wrongCount = st?.wrongCount ?? 0;
      const mastery = st?.masteryLevel ?? 0;
      const nextReviewAt = st?.nextReviewAtMs ?? 0;
      const isDue = nextReviewAt > 0 && nextReviewAt <= now;

      let priority = 3;
      if (wrongCount > 0 && mastery < 3) priority = 0;
      else if (isDue) priority = 1;
      else if (mastery < 2) priority = 2;

      return { fact, st, priority, mastery, wrongCount };
    });

    return scored
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.wrongCount !== b.wrongCount) return b.wrongCount - a.wrongCount;
        return a.mastery - b.mastery;
      })
      .map((x) => x.fact);
  }, [factStates, dailySchedule.generatedAtMs]);

  const currentFact = useMemo(() => {
    if (selectedFactId) {
      const picked = ALL_FACTS.find((f) => f.id === selectedFactId);
      if (picked) return picked;
    }
    return dailySchedule.todayBatch[0]?.fact ?? reviewDeck[0];
  }, [selectedFactId, dailySchedule.todayBatch, reviewDeck]);

  const currentState = currentFact ? factStates[currentFact.id] : undefined;
  const chapter = currentFact ? getChapterById(currentFact.chapterId) : undefined;
  const station = currentFact ? getStationById(currentFact.stationId) : undefined;

  const masteredFactsCount = useMemo(
    () => Object.values(factStates).filter((s) => s.masteryLevel >= 2).length,
    [factStates]
  );

  const handleGrade = (mastered: boolean) => {
    if (!currentFact) return;
    if (mastered) {
      soundEngine.playCorrect();
    } else {
      soundEngine.playWrong();
    }
    onRecordReview(currentFact, mastered);
    setRevealed(false);
    setSelectedFactId(null);
    setSessionReviewedCount((c) => c + 1);
  };

  return (
    <div className="scholar-scroll fixed inset-x-0 top-[68px] bottom-0 z-25 overflow-y-auto bg-[#EEF2F6] px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-5 pb-12">
        {/* Header Card */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#171C19]/12 bg-[#FBF9F4] p-5 shadow-xs">
          <div>
            <h2 className="font-scholar text-2xl font-bold text-[#171C19]">
              المُراجِع الذكي وجدول التكرار المتباعد
            </h2>
            <p className="mt-1 text-sm text-[#171C19]/75">
              يحلّل مواعيد المراجعة (<span dir="ltr">nextReviewAtMs</span>) ونسب التعثّر ليبني جدولاً يومياً يحفظ رسوخ العلم.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#171C19]/10 bg-[#F2ECE1] px-4 py-2.5 text-center">
            <div>
              <div className="text-[11px] font-bold text-[#171C19]/60">مستحقة اليوم</div>
              <div className="text-lg font-extrabold text-[#B9382C] tabular-nums">
                {dailySchedule.dueCount}
              </div>
            </div>
            <div className="h-8 w-px bg-[#171C19]/15" />
            <div>
              <div className="text-[11px] font-bold text-[#171C19]/60">بطاقات مثبّتة</div>
              <div className="text-lg font-extrabold text-[#1E6B47] tabular-nums">
                {masteredFactsCount} / {ALL_FACTS.length}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Smart Schedule Breakdown */}
        <div className="rounded-2xl border border-[#171C19]/12 bg-[#FBF9F4] p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#1E6B47]" />
              <h3 className="font-scholar text-lg font-bold text-[#171C19]">
                جدول المراجعة الذكي اليومي
              </h3>
            </div>
            {dailySchedule.dueCount > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-[#C8922B]/14 px-2.5 py-1 text-xs font-bold text-[#8E6210] tabular-nums">
                <Clock className="h-3.5 w-3.5" />
                <span>الزمن المقترح: ~{dailySchedule.estimatedMinutes} دقائق</span>
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-[#171C19]/80">{dailySchedule.headline}</p>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl border border-[#171C19]/10 bg-white p-3">
              <div className="text-[11px] text-[#171C19]/60">مستحقة الآن</div>
              <div className="mt-0.5 text-lg font-extrabold text-[#B9382C] tabular-nums">
                {dailySchedule.dueCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#171C19]/10 bg-white p-3">
              <div className="text-[11px] text-[#171C19]/60">متأخرة عن الموعد</div>
              <div className="mt-0.5 text-lg font-extrabold text-[#C8922B] tabular-nums">
                {dailySchedule.overdueCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#171C19]/10 bg-white p-3">
              <div className="text-[11px] text-[#171C19]/60">خلال ٢٤ ساعة</div>
              <div className="mt-0.5 text-lg font-extrabold text-[#1E6B47] tabular-nums">
                {dailySchedule.laterTodayCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#171C19]/10 bg-white p-3">
              <div className="text-[11px] text-[#171C19]/60">خلال ٣ أيام قادمة</div>
              <div className="mt-0.5 text-lg font-extrabold text-[#171C19] tabular-nums">
                {dailySchedule.upcoming3DaysCount}
              </div>
            </div>
          </div>

          {dailySchedule.todayBatch.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-extrabold text-[#171C19]/75">
                دفعة اليوم المقترحة (انقر على أي بطاقة لمراجعتها الآن):
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {dailySchedule.todayBatch.slice(0, 6).map((item) => {
                  const isCurrent = currentFact?.id === item.fact.id;
                  return (
                    <button
                      key={item.fact.id}
                      type="button"
                      onClick={() => {
                        setSelectedFactId(item.fact.id);
                        setRevealed(false);
                      }}
                      className={`flex flex-col justify-between rounded-xl border p-3 text-right transition ${
                        isCurrent
                          ? 'border-[#1E6B47] bg-[#1E6B47]/10'
                          : 'border-[#171C19]/12 bg-white hover:bg-[#F2ECE1]'
                      }`}
                    >
                      <div className="line-clamp-1 text-xs font-bold text-[#171C19]">
                        {item.fact.title}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`font-bold ${
                            item.slot === 'overdue'
                              ? 'text-[#B9382C]'
                              : 'text-[#8E6210]'
                          }`}
                        >
                          {item.reasonLabel}
                        </span>
                        <span className="text-[#171C19]/60 tabular-nums">
                          {item.timeLabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {dailySchedule.upcomingBatch.length > 0 && (
            <div className="mt-4 border-t border-[#171C19]/10 pt-3">
              <div className="mb-2 text-xs font-bold text-[#171C19]/65">
                المواعيد القادمة في الجدول:
              </div>
              <div className="flex flex-wrap gap-2">
                {dailySchedule.upcomingBatch.slice(0, 4).map((item) => (
                  <div
                    key={item.fact.id}
                    className="rounded-lg border border-[#171C19]/10 bg-white px-2.5 py-1.5 text-[11px] text-[#171C19]/80"
                  >
                    <span className="font-bold text-[#171C19]">{item.fact.title}</span>
                    <span className="mx-1.5 text-[#171C19]/40">·</span>
                    <span className="font-semibold text-[#1E6B47]">{item.timeLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Recall Card */}
        {currentFact && (
          <div className="space-y-4 rounded-2xl border border-[#171C19]/14 bg-[#FBF9F4] p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#171C19]/10 pb-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-[#171C19]/75">
                {chapter && (
                  <span className="font-bold text-[#171C19]">{chapter.shortTitle}</span>
                )}
                {station && (
                  <>
                    <span>·</span>
                    <span>{station.title}</span>
                  </>
                )}
                <span>·</span>
                <span className="tabular-nums">ص {currentFact.bookPage}</span>
              </div>

              <div className="flex items-center gap-2">
                {currentState && currentState.wrongCount > 0 && (
                  <span className="rounded bg-[#B9382C]/12 px-2 py-0.5 font-bold text-[#B9382C] tabular-nums">
                    تعثر سابق: {currentState.wrongCount}
                  </span>
                )}
                <span className="rounded bg-[#F2ECE1] px-2 py-0.5 font-bold text-[#171C19]/75 tabular-nums">
                  الإتقان: {currentState?.masteryLevel ?? 0}/3
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#C8922B]">
                <Sparkles className="h-4 w-4" />
                <span>اختبر استحضارك الذهني قبل الكشف:</span>
              </div>
              <h3 className="font-scholar text-2xl font-bold leading-snug text-[#171C19]">
                {currentFact.title}
              </h3>
              <p className="text-sm text-[#171C19]/70">
                حاول استذكار الحكم الشرعي، الضابط أو التفصيل العلمي، والشاهد القرآني أو الحديثي المتعلق بهذه المسألة.
              </p>
            </div>

            {!revealed ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="flex items-center gap-2 rounded-xl bg-[#171C19] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2A332E]"
                >
                  <Eye className="h-4 w-4" />
                  <span>اكشف البطاقة والدليل للتحقق</span>
                </button>
                <button
                  type="button"
                  onClick={() => onJumpToFact(currentFact.stationId, currentFact.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-[#171C19]/15 bg-white px-4 py-2.5 text-xs font-bold text-[#171C19] hover:bg-[#F2ECE1]"
                >
                  <Compass className="h-4 w-4 text-[#1E6B47]" />
                  <span>فتح المجسم ثلاثي الأبعاد</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 border-t border-[#171C19]/10 pt-4">
                <p className="text-base leading-relaxed text-[#171C19]">
                  {currentFact.summary}
                </p>

                {currentFact.points && currentFact.points.length > 0 && (
                  <ul className="space-y-1.5 rounded-xl border border-[#171C19]/10 bg-white p-4">
                    {currentFact.points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#171C19]">
                        <span className="mt-0.5 font-bold text-[#C8922B] tabular-nums">
                          {i + 1}.
                        </span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {currentFact.evidence && currentFact.evidence.length > 0 && (
                  <div className="space-y-2">
                    {currentFact.evidence.map((ev, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-[#C8922B]/30 bg-white p-3.5"
                      >
                        <p className="font-scholar text-base font-bold text-[#171C19]">
                          {ev.text}
                        </p>
                        <div className="mt-1 text-xs font-semibold text-[#8E6210]">
                          {ev.source}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {currentFact.scholarlyNote && (
                  <div className="rounded-xl border border-[#1E6B47]/25 bg-[#1E6B47]/8 p-3.5 text-sm text-[#144D33]">
                    <div className="mb-1 text-xs font-extrabold">
                      {currentFact.scholarlyNote.label}
                    </div>
                    <p>{currentFact.scholarlyNote.text}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleGrade(false)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#B9382C]/35 bg-[#B9382C]/10 px-4 py-3 text-sm font-bold text-[#7E2118] hover:bg-[#B9382C]/18"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>ما زلت أحتاج تثبيتها</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGrade(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E6B47] px-4 py-3 text-sm font-bold text-white hover:bg-[#175538]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>أتقنتُها واستحضرتُ الدليل</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {sessionReviewedCount > 0 && (
          <div className="text-center text-xs font-bold text-[#1E6B47] tabular-nums">
            راجعت في هذه الجلسة {sessionReviewedCount} بطاقة بنجاح.
          </div>
        )}
      </div>
    </div>
  );
};
