import React from 'react';
import { Award, CheckCircle2, Lock, Sparkles, Star } from 'lucide-react';
import {
  ACHIEVEMENTS,
  ALL_FACTS,
  ALL_STATIONS,
  CHAPTERS,
  getNextRank,
  getRankForXp,
  RANKS,
} from '../../curriculum';
import { StudentProgressSnapshot } from '../../firebase/progressService';

interface AchievementsViewProps {
  progress: StudentProgressSnapshot;
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({ progress }) => {
  const { profile, stations, quizAnswers, achievements } = progress;
  const currentRank = getRankForXp(profile.xp);
  const nextRank = getNextRank(profile.xp);
  const unlockedSet = new Set(achievements);

  const accuracyPct =
    profile.totalAnswered > 0
      ? Math.round((profile.totalCorrect / profile.totalAnswered) * 100)
      : 100;

  const masteredStationsCount = ALL_STATIONS.filter((st) => {
    const s = stations[st.id];
    return s?.challengePassed && s.stars >= 2;
  }).length;

  const correctObjectiveCount = Object.values(quizAnswers).filter(
    (a) => a.isCorrect
  ).length;

  const xpProgressPct = nextRank
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((profile.xp - currentRank.minXp) /
              Math.max(1, nextRank.minXp - currentRank.minXp)) *
              100
          )
        )
      )
    : 100;

  return (
    <div className="scholar-scroll fixed inset-x-0 top-[68px] bottom-0 z-25 overflow-y-auto bg-[#EEF2F6] px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        {/* Rank & Overall Progress Card */}
        <div className="rounded-2xl border border-[#171C19]/12 bg-[#FBF9F4] p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C8922B]/35 bg-[#F2ECE1] text-[#C8922B]">
                <Award className="h-8 w-8" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#1E6B47]">
                  الرتبة العلمية الحالية
                </div>
                <h2 className="font-scholar text-2xl font-bold text-[#171C19]">
                  {currentRank.title}
                </h2>
                <p className="text-sm text-[#171C19]/70">{currentRank.description}</p>
              </div>
            </div>

            <div className="text-left">
              <div className="text-xs font-bold text-[#171C19]/60">مجموع النقاط</div>
              <div className="text-3xl font-extrabold text-[#C8922B] tabular-nums">
                {profile.xp} XP
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-[#171C19]/70 tabular-nums">
              <span>التقدم نحو الرتبة التالية</span>
              <span>
                {nextRank
                  ? `${nextRank.title} (${nextRank.minXp} XP)`
                  : 'بلغت أعلى رتبة في الأكاديمية!'}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-lg bg-[#F2ECE1]">
              <div
                className="h-full rounded-lg bg-[#1E6B47] transition-all duration-300"
                style={{ width: `${xpProgressPct}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#171C19]/10 bg-[#F2ECE1]/70 p-3">
              <div className="text-xs text-[#171C19]/60">البطاقات المستوعبة</div>
              <div className="mt-1 text-xl font-extrabold text-[#171C19] tabular-nums">
                {profile.completedCardsCount} / {ALL_FACTS.length}
              </div>
            </div>
            <div className="rounded-xl border border-[#171C19]/10 bg-[#F2ECE1]/70 p-3">
              <div className="text-xs text-[#171C19]/60">المحطات المتقنة</div>
              <div className="mt-1 text-xl font-extrabold text-[#1E6B47] tabular-nums">
                {masteredStationsCount} / {ALL_STATIONS.length}
              </div>
            </div>
            <div className="rounded-xl border border-[#171C19]/10 bg-[#F2ECE1]/70 p-3">
              <div className="text-xs text-[#171C19]/60">بنك الكراسة الموضوعي</div>
              <div className="mt-1 text-xl font-extrabold text-[#171C19] tabular-nums">
                {correctObjectiveCount} / 120
              </div>
            </div>
            <div className="rounded-xl border border-[#171C19]/10 bg-[#F2ECE1]/70 p-3">
              <div className="text-xs text-[#171C19]/60">أطول سلسلة · الدقة</div>
              <div className="mt-1 text-xl font-extrabold text-[#C8922B] tabular-nums">
                {profile.bestStreak} · {accuracyPct}%
              </div>
            </div>
          </div>
        </div>

        {/* Chapter Breakdown */}
        <div className="rounded-2xl border border-[#171C19]/12 bg-[#FBF9F4] p-5 shadow-xs">
          <h3 className="font-scholar mb-3 text-lg font-bold text-[#171C19]">
            إتقان الجزر والأبواب الخمسة
          </h3>
          <div className="grid gap-3 sm:grid-cols-5">
            {CHAPTERS.map((ch) => {
              const doneSt = ch.stations.filter((st) => {
                const s = stations[st.id];
                return s?.challengePassed && s.stars >= 2;
              }).length;
              const pct = Math.round((doneSt / ch.stations.length) * 100);
              return (
                <div
                  key={ch.id}
                  className="rounded-xl border border-[#171C19]/10 bg-white p-3.5"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-xs"
                      style={{ backgroundColor: ch.accentHex }}
                    />
                    <span className="tabular-nums text-[#171C19]/70">
                      {doneSt}/{ch.stations.length} محطات
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm font-extrabold text-[#171C19]">
                    {ch.shortTitle}
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded bg-[#F2ECE1]">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: ch.accentHex,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rank Ladder */}
        <div className="rounded-2xl border border-[#171C19]/12 bg-[#FBF9F4] p-5 shadow-xs">
          <h3 className="font-scholar mb-3 text-lg font-bold text-[#171C19]">
            سُلّم الرتب العلمية
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {RANKS.map((r) => {
              const unlocked = profile.xp >= r.minXp;
              const isCur = r.index === currentRank.index;
              return (
                <div
                  key={r.index}
                  className={`rounded-xl border p-3.5 ${
                    isCur
                      ? 'border-[#C8922B] bg-[#C8922B]/10'
                      : unlocked
                        ? 'border-[#1E6B47]/30 bg-white'
                        : 'border-[#171C19]/10 bg-[#F2ECE1]/50 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="tabular-nums text-[#8E6210]">{r.minXp} XP</span>
                    {unlocked ? (
                      <Star className="h-4 w-4 fill-[#C8922B] text-[#C8922B]" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-[#171C19]/40" />
                    )}
                  </div>
                  <div className="mt-1 font-scholar text-base font-bold text-[#171C19]">
                    {r.title}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#171C19]/70">
                    {r.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 18 Achievements Gallery */}
        <div className="rounded-2xl border border-[#171C19]/12 bg-[#FBF9F4] p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-scholar text-lg font-bold text-[#171C19]">
              الأوسمة والإنجازات ({unlockedSet.size} / {ACHIEVEMENTS.length})
            </h3>
            <span className="flex items-center gap-1 text-xs font-bold text-[#1E6B47]">
              <Sparkles className="h-4 w-4" />
              <span>تُمنح تلقائياً مع التقدم</span>
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACHIEVEMENTS.map((ach) => {
              const unlocked = unlockedSet.has(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                    unlocked
                      ? 'border-[#1E6B47]/35 bg-white shadow-xs'
                      : 'border-[#171C19]/10 bg-[#F2ECE1]/45 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          unlocked
                            ? 'bg-[#1E6B47]/12 text-[#1E6B47]'
                            : 'bg-[#171C19]/10 text-[#171C19]/60'
                        }`}
                      >
                        {unlocked ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>وسام مكتسب</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" />
                            <span>مغلق</span>
                          </>
                        )}
                      </span>
                      <span className="text-xs font-extrabold text-[#C8922B] tabular-nums">
                        +{ach.xpBonus} XP
                      </span>
                    </div>
                    <h4 className="font-scholar mt-2 text-base font-bold text-[#171C19]">
                      {ach.title}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-[#171C19]/75">
                      {ach.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
