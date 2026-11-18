import { ALL_FACTS, ChapterId, FactCard, getChapterById } from './index';
import { FactMasteryState } from '../firebase/progressService';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ScheduledSlotKind = 'overdue' | 'due_now' | 'later_today' | 'upcoming';

export interface ScheduledReviewItem {
  fact: FactCard;
  state: FactMasteryState | undefined;
  slot: ScheduledSlotKind;
  urgencyScore: number;
  reasonLabel: string;
  timeLabel: string;
}

export interface DailyReviewSchedule {
  generatedAtMs: number;
  dueCount: number;
  overdueCount: number;
  laterTodayCount: number;
  upcoming3DaysCount: number;
  estimatedMinutes: number;
  focusChapterId: ChapterId | null;
  focusChapterTitle: string | null;
  todayBatch: ScheduledReviewItem[];
  upcomingBatch: ScheduledReviewItem[];
  headline: string;
}

export function formatArabicDueTiming(nextReviewAtMs: number, nowMs: number): string {
  if (nextReviewAtMs <= 0) return 'مستحقة الآن';
  const diffMs = nextReviewAtMs - nowMs;
  if (diffMs <= 0) {
    const overdueHours = Math.floor(Math.abs(diffMs) / HOUR_MS);
    if (overdueHours < 1) return 'مستحقة الآن';
    if (overdueHours < 24) return `متأخرة منذ ${overdueHours} س`;
    const overdueDays = Math.floor(overdueHours / 24);
    return `متأخرة منذ ${overdueDays} ي`;
  }
  const hoursAhead = Math.ceil(diffMs / HOUR_MS);
  if (hoursAhead < 24) return `خلال ${hoursAhead} س`;
  const daysAhead = Math.round(diffMs / DAY_MS);
  if (daysAhead <= 1) return 'غداً';
  return `بعد ${daysAhead} أيام`;
}

export function buildDailyReviewSchedule(
  factStates: Record<string, FactMasteryState>,
  nowMs = Date.now()
): DailyReviewSchedule {
  const laterTodayCutoff = nowMs + DAY_MS;
  const upcomingCutoff = nowMs + 3 * DAY_MS;

  const dueItems: ScheduledReviewItem[] = [];
  const upcomingItems: ScheduledReviewItem[] = [];
  const chapterDueCounter = new Map<ChapterId, number>();

  let overdueCount = 0;
  let laterTodayCount = 0;
  let upcoming3DaysCount = 0;

  for (const fact of ALL_FACTS) {
    const st = factStates[fact.id];
    if (!st) continue;

    const wrongCount = st.wrongCount ?? 0;
    const mastery = st.masteryLevel ?? 0;
    const nextReviewAt = st.nextReviewAtMs ?? 0;

    const hasMissedWeakness = wrongCount > 0 && mastery < 3;
    const isTimeDue = nextReviewAt > 0 && nextReviewAt <= nowMs;

    if (hasMissedWeakness || isTimeDue) {
      const isStrictlyOverdue =
        nextReviewAt > 0 && nowMs - nextReviewAt > 2 * HOUR_MS;
      if (isStrictlyOverdue) overdueCount += 1;

      const overdueHours =
        nextReviewAt > 0 ? Math.max(0, (nowMs - nextReviewAt) / HOUR_MS) : 0;
      const scholarlyWeight =
        fact.scholarlyNote?.tone === 'pause' ||
        fact.scholarlyNote?.tone === 'refutation'
          ? 12
          : 0;
      const urgencyScore =
        wrongCount * 42 +
        (3 - mastery) * 22 +
        Math.min(60, overdueHours * 1.5) +
        scholarlyWeight;

      const reasonLabel = hasMissedWeakness
        ? `تعثّر سابق (${wrongCount})`
        : isStrictlyOverdue
          ? 'مراجعة متأخرة'
          : 'حان موعد التثبيت';

      dueItems.push({
        fact,
        state: st,
        slot: isStrictlyOverdue ? 'overdue' : 'due_now',
        urgencyScore,
        reasonLabel,
        timeLabel: formatArabicDueTiming(nextReviewAt, nowMs),
      });

      chapterDueCounter.set(
        fact.chapterId,
        (chapterDueCounter.get(fact.chapterId) ?? 0) + 1
      );
    } else if (nextReviewAt > nowMs && nextReviewAt <= laterTodayCutoff) {
      laterTodayCount += 1;
      upcomingItems.push({
        fact,
        state: st,
        slot: 'later_today',
        urgencyScore: 20 - mastery * 4,
        reasonLabel: 'مجدولة لاحقاً اليوم',
        timeLabel: formatArabicDueTiming(nextReviewAt, nowMs),
      });
    } else if (nextReviewAt > laterTodayCutoff && nextReviewAt <= upcomingCutoff) {
      upcoming3DaysCount += 1;
      upcomingItems.push({
        fact,
        state: st,
        slot: 'upcoming',
        urgencyScore: 10 - mastery * 2,
        reasonLabel: 'مجدولة قريباً',
        timeLabel: formatArabicDueTiming(nextReviewAt, nowMs),
      });
    }
  }

  dueItems.sort((a, b) => b.urgencyScore - a.urgencyScore);
  upcomingItems.sort(
    (a, b) => (a.state?.nextReviewAtMs ?? 0) - (b.state?.nextReviewAtMs ?? 0)
  );

  let focusChapterId: ChapterId | null = null;
  let focusMax = 0;
  chapterDueCounter.forEach((cnt, chId) => {
    if (cnt > focusMax) {
      focusMax = cnt;
      focusChapterId = chId;
    }
  });
  const focusChapterTitle = focusChapterId
    ? (getChapterById(focusChapterId)?.shortTitle ?? null)
    : null;

  // Recommended focused daily batch (up to 12 due cards for optimal retention)
  const todayBatch = dueItems.slice(0, 12);
  const dueCount = dueItems.length;
  const estimatedMinutes =
    dueCount === 0 ? 0 : Math.max(2, Math.round(todayBatch.length * 1.25));

  let headline = 'لا توجد بطاقات متأخرة حالياً؛ استمر في استكشاف المحطات الجديدة.';
  if (dueCount > 0) {
    headline = focusChapterTitle
      ? `يُوصى اليوم بمراجعة ${todayBatch.length} من أصل ${dueCount} بطاقة مستحقة، والتركيز على ${focusChapterTitle}.`
      : `يُوصى اليوم بمراجعة ${todayBatch.length} بطاقة مستحقة لتثبيت الحفظ.`;
  } else if (laterTodayCount > 0) {
    headline = `لديك ${laterTodayCount} بطاقات ستستحق المراجعة لاحقاً خلال ٢٤ ساعة.`;
  }

  return {
    generatedAtMs: nowMs,
    dueCount,
    overdueCount,
    laterTodayCount,
    upcoming3DaysCount,
    estimatedMinutes,
    focusChapterId,
    focusChapterTitle,
    todayBatch,
    upcomingBatch: upcomingItems.slice(0, 6),
    headline,
  };
}
