import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Layers,
  ShieldAlert,
  Sparkles,
  Star,
  X,
  XCircle,
} from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';
import {
  Chapter,
  ClassifyChallenge,
  FactCard,
  MatchChallenge,
  McqChallenge,
  MiniChallenge,
  OrderChallenge,
  Station,
} from '../../curriculum';
import { StationProgressState } from '../../firebase/progressService';

interface StationModalProps {
  station: Station;
  chapter: Chapter;
  stationState: StationProgressState | undefined;
  initialFactId?: string | null;
  onClose: () => void;
  onCompleteCard: (station: Station, factId: string) => void;
  onHighlightPart: (partIndex: number) => void;
  onCompleteChallenge: (
    station: Station,
    scorePct: number,
    correctCount: number,
    totalCount: number,
    missedFactIds: string[]
  ) => void;
  onSelectStation: (stationId: string) => void;
}

type ModalStage = 'study' | 'challenge' | 'summary';

function deterministicShuffle<T>(items: T[], seedStr: string): T[] {
  const arr = [...items];
  if (arr.length <= 1) return arr;
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i--) {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    const j = Math.abs(hash) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Ensure order differs from original if possible when length >= 2
  const isIdentical = arr.every((item, idx) => item === items[idx]);
  if (isIdentical && arr.length >= 2) {
    [arr[0], arr[1]] = [arr[1], arr[0]];
  }
  return arr;
}

export const StationModal: React.FC<StationModalProps> = ({
  station,
  chapter,
  stationState,
  initialFactId,
  onClose,
  onCompleteCard,
  onHighlightPart,
  onCompleteChallenge,
  onSelectStation,
}) => {
  const initialCardIdx = useMemo(() => {
    if (!initialFactId) return 0;
    const idx = station.facts.findIndex((f) => f.id === initialFactId);
    return idx >= 0 ? idx : 0;
  }, [initialFactId, station.facts]);

  const [stage, setStage] = useState<ModalStage>('study');
  const [cardIdx, setCardIdx] = useState<number>(initialCardIdx);

  // Challenge stage state
  const [challengeIdx, setChallengeIdx] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [missedFactIds, setMissedFactIds] = useState<string[]>([]);
  const [gradedResult, setGradedResult] = useState<{
    isCorrect: boolean;
    explanation: string;
  } | null>(null);

  // Per-challenge interactive states
  const [selectedMcq, setSelectedMcq] = useState<number | null>(null);
  const [classifyMap, setClassifyMap] = useState<Record<string, string>>({});
  const [orderItems, setOrderItems] = useState<{ id: string; text: string }[]>([]);
  const [matchPairs, setMatchPairs] = useState<Record<string, string>>({});
  const [activeMatchLeftId, setActiveMatchLeftId] = useState<string | null>(null);
  const [summaryScorePct, setSummaryScorePct] = useState<number>(0);

  // Reset modal when station changes
  useEffect(() => {
    setStage('study');
    setCardIdx(initialCardIdx);
    setChallengeIdx(0);
    setCorrectCount(0);
    setMissedFactIds([]);
    setGradedResult(null);
    setSummaryScorePct(0);
  }, [station.id, initialCardIdx]);

  const currentFact: FactCard | undefined = station.facts[cardIdx];
  const currentChallenge: MiniChallenge | undefined = station.challenges[challengeIdx];

  // Highlight matching 3D landmark part on current card
  useEffect(() => {
    if (stage === 'study' && currentFact) {
      onHighlightPart(currentFact.highlightPartIndex ?? cardIdx);
    } else if (stage === 'challenge') {
      onHighlightPart(challengeIdx);
    }
  }, [stage, cardIdx, challengeIdx, currentFact, onHighlightPart]);

  // Reset interactive state whenever challenge changes
  useEffect(() => {
    if (!currentChallenge) return;
    setGradedResult(null);
    setSelectedMcq(null);
    setClassifyMap({});
    setMatchPairs({});
    setActiveMatchLeftId(null);
    if (currentChallenge.type === 'order') {
      setOrderItems(deterministicShuffle(currentChallenge.items, currentChallenge.id));
    } else {
      setOrderItems([]);
    }
  }, [currentChallenge]);

  const shuffledMatchRight = useMemo(() => {
    if (!currentChallenge || currentChallenge.type !== 'match') return [];
    return deterministicShuffle(
      currentChallenge.pairs.map((p) => ({ id: p.id, text: p.right })),
      currentChallenge.id + '_right'
    );
  }, [currentChallenge]);

  const completedCardSet = useMemo(
    () => new Set(stationState?.completedCardIds ?? []),
    [stationState?.completedCardIds]
  );

  const nextStationInChapter = useMemo(() => {
    const idx = chapter.stations.findIndex((s) => s.id === station.id);
    if (idx >= 0 && idx + 1 < chapter.stations.length) {
      return chapter.stations[idx + 1];
    }
    return null;
  }, [chapter.stations, station.id]);

  const handleCompleteCurrentCard = () => {
    if (!currentFact) return;
    if (!completedCardSet.has(currentFact.id)) {
      soundEngine.playCardComplete();
      onCompleteCard(station, currentFact.id);
    }
    if (cardIdx + 1 < station.facts.length) {
      setCardIdx(cardIdx + 1);
    } else if (station.challenges.length > 0) {
      setStage('challenge');
      setChallengeIdx(0);
      setCorrectCount(0);
      setMissedFactIds([]);
    } else {
      setStage('summary');
    }
  };

  const recordChallengeOutcome = (isCorrect: boolean, explanation: string, relatedFactId?: string) => {
    setGradedResult({ isCorrect, explanation });
    if (isCorrect) {
      soundEngine.playCorrect();
      setCorrectCount((c) => c + 1);
    } else {
      soundEngine.playWrong();
      if (relatedFactId) {
        setMissedFactIds((prev) => (prev.includes(relatedFactId) ? prev : [...prev, relatedFactId]));
      }
    }
  };

  const handleCheckMcq = (ch: McqChallenge, idx: number) => {
    if (gradedResult) return;
    setSelectedMcq(idx);
    recordChallengeOutcome(idx === ch.correctIndex, ch.explanation, ch.relatedFactId);
  };

  const handleCheckClassify = (ch: ClassifyChallenge) => {
    if (gradedResult) return;
    const allAssigned = ch.items.every((it) => Boolean(classifyMap[it.id]));
    if (!allAssigned) return;
    const isCorrect = ch.items.every((it) => classifyMap[it.id] === it.categoryId);
    recordChallengeOutcome(isCorrect, ch.explanation, ch.relatedFactId);
  };

  const handleMoveOrderItem = (index: number, delta: -1 | 1) => {
    if (gradedResult) return;
    const target = index + delta;
    if (target < 0 || target >= orderItems.length) return;
    const copy = [...orderItems];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setOrderItems(copy);
  };

  const handleCheckOrder = (ch: OrderChallenge) => {
    if (gradedResult) return;
    const isCorrect = ch.items.every((it, idx) => orderItems[idx]?.id === it.id);
    recordChallengeOutcome(isCorrect, ch.explanation, ch.relatedFactId);
  };

  const handleClickRightMatch = (rightId: string) => {
    if (gradedResult || !activeMatchLeftId) return;
    setMatchPairs((prev) => {
      const next = { ...prev };
      // Ensure 1-to-1 pairing by removing rightId if paired elsewhere
      for (const [k, v] of Object.entries(next)) {
        if (v === rightId) delete next[k];
      }
      next[activeMatchLeftId] = rightId;
      return next;
    });
    setActiveMatchLeftId(null);
  };

  const handleCheckMatch = (ch: MatchChallenge) => {
    if (gradedResult) return;
    const allMatched = ch.pairs.every((p) => Boolean(matchPairs[p.id]));
    if (!allMatched) return;
    const isCorrect = ch.pairs.every((p) => matchPairs[p.id] === p.id);
    recordChallengeOutcome(isCorrect, ch.explanation, ch.relatedFactId);
  };

  const handleAdvanceChallenge = () => {
    if (challengeIdx + 1 < station.challenges.length) {
      setChallengeIdx(challengeIdx + 1);
    } else {
      const total = Math.max(station.challenges.length, 1);
      const pct = Math.round((correctCount / total) * 100);
      setSummaryScorePct(pct);
      onCompleteChallenge(station, pct, correctCount, total, missedFactIds);
      if (pct >= 60) {
        soundEngine.playStationMastered();
      }
      setStage('summary');
    }
  };

  const renderScholarlyTone = (note: NonNullable<FactCard['scholarlyNote']>) => {
    const map = {
      rule: {
        bg: 'bg-[#1E6B47]/8 border-[#1E6B47]/30 text-[#144D33]',
        icon: <BookOpen className="h-4 w-4 shrink-0 text-[#1E6B47]" />,
      },
      warning: {
        bg: 'bg-[#C8922B]/12 border-[#C8922B]/35 text-[#6D4D0B]',
        icon: <AlertTriangle className="h-4 w-4 shrink-0 text-[#C8922B]" />,
      },
      pause: {
        bg: 'bg-[#1D4E89]/10 border-[#1D4E89]/30 text-[#163B68]',
        icon: <HelpCircle className="h-4 w-4 shrink-0 text-[#1D4E89]" />,
      },
      refutation: {
        bg: 'bg-[#B9382C]/10 border-[#B9382C]/30 text-[#7E2118]',
        icon: <ShieldAlert className="h-4 w-4 shrink-0 text-[#B9382C]" />,
      },
    }[note.tone];

    return (
      <div className={`rounded-xl border p-3.5 ${map.bg}`}>
        <div className="mb-1 flex items-center gap-2 text-xs font-extrabold">
          {map.icon}
          <span>{note.label}</span>
        </div>
        <p className="text-sm leading-relaxed">{note.text}</p>
      </div>
    );
  };

  const earnedStars = summaryScorePct >= 90 ? 3 : summaryScorePct >= 60 ? 2 : summaryScorePct >= 30 ? 1 : 0;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#171C19]/50 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={station.title}
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#171C19]/15 bg-[#FBF9F4] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#171C19]/12 bg-[#F2ECE1] px-5 py-3.5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#171C19]/65">
              <span
                className="inline-block h-2.5 w-2.5 rounded-xs"
                style={{ backgroundColor: chapter.accentHex }}
              />
              <span className="font-bold text-[#171C19]">{chapter.shortTitle}</span>
              <span>·</span>
              <span>محطة {station.order}</span>
              <span>·</span>
              <span className="tabular-nums">
                {completedCardSet.size}/{station.facts.length} بطاقات مستوعبة
              </span>
            </div>
            <h2 className="font-scholar mt-1 text-xl font-bold text-[#171C19]">
              {station.title}
            </h2>
            <p className="text-xs text-[#171C19]/70">{station.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Stage Switcher */}
            <div className="hidden items-center gap-1 rounded-lg border border-[#171C19]/12 bg-[#FBF9F4] p-1 sm:flex">
              <button
                type="button"
                onClick={() => setStage('study')}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                  stage === 'study'
                    ? 'bg-[#1E6B47] text-white'
                    : 'text-[#171C19]/70 hover:bg-[#F2ECE1]'
                }`}
              >
                ١. الفهم والبطاقات
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage('challenge');
                  setChallengeIdx(0);
                  setCorrectCount(0);
                  setMissedFactIds([]);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                  stage === 'challenge'
                    ? 'bg-[#C8922B] text-white'
                    : 'text-[#171C19]/70 hover:bg-[#F2ECE1]'
                }`}
              >
                ٢. التحدي التفاعلي ({station.challenges.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة المحطة"
              className="rounded-lg border border-[#171C19]/15 bg-[#FBF9F4] p-2 text-[#171C19]/75 transition hover:bg-[#E7DEC9] hover:text-[#171C19]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="scholar-scroll flex-1 overflow-y-auto p-5">
          {stage === 'study' && currentFact && (
            <div className="space-y-4">
              {/* Fact Stepper Dots */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#171C19]/10 bg-[#F2ECE1]/70 px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {station.facts.map((f, idx) => {
                    const isDone = completedCardSet.has(f.id);
                    const isCur = idx === cardIdx;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setCardIdx(idx)}
                        className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold tabular-nums transition ${
                          isCur
                            ? 'border-[#171C19] bg-[#171C19] text-white'
                            : isDone
                              ? 'border-[#1E6B47]/35 bg-[#1E6B47]/12 text-[#1E6B47]'
                              : 'border-[#171C19]/12 bg-[#FBF9F4] text-[#171C19]/70'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="h-3 w-3" />}
                        <span>بطاقة {idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-semibold text-[#171C19]/65 tabular-nums">
                  صفحة الكراسة: ص {currentFact.bookPage}
                </span>
              </div>

              {/* Fact Content Card */}
              <div className="space-y-4 rounded-2xl border border-[#171C19]/12 bg-white p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-scholar text-xl font-bold leading-snug text-[#171C19]">
                    {currentFact.title}
                  </h3>
                  {completedCardSet.has(currentFact.id) && (
                    <span className="flex shrink-0 items-center gap-1 rounded-md border border-[#1E6B47]/30 bg-[#1E6B47]/10 px-2.5 py-1 text-xs font-bold text-[#1E6B47]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>تم الاستيعاب</span>
                    </span>
                  )}
                </div>

                <p className="text-base leading-relaxed text-[#171C19]/90">
                  {currentFact.summary}
                </p>

                {currentFact.points && currentFact.points.length > 0 && (
                  <ul className="space-y-2 rounded-xl border border-[#171C19]/10 bg-[#FBF9F4] p-4">
                    {currentFact.points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#171C19]">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#C8922B]/15 text-xs font-bold text-[#8E6210] tabular-nums">
                          {i + 1}
                        </span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {currentFact.evidence && currentFact.evidence.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#1E6B47]">
                      <Layers className="h-4 w-4" />
                      <span>الأدلة الشرعية من الكراسة:</span>
                    </div>
                    {currentFact.evidence.map((ev, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-[#C8922B]/25 bg-[#FBF9F4] p-3.5"
                      >
                        <p className="font-scholar text-base font-bold leading-relaxed text-[#171C19]">
                          {ev.text}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-xs text-[#171C19]/65">
                          <span>
                            {ev.type === 'quran'
                              ? 'دليل قرآني'
                              : ev.type === 'hadith'
                                ? 'حديث نبوي'
                                : 'أثر / قول محقق'}
                          </span>
                          <span className="font-semibold text-[#8E6210]">{ev.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {currentFact.table && (
                  <div className="overflow-x-auto rounded-xl border border-[#171C19]/12">
                    {currentFact.table.title && (
                      <div className="border-b border-[#171C19]/10 bg-[#F2ECE1] px-3.5 py-2 text-xs font-bold text-[#171C19]">
                        {currentFact.table.title}
                      </div>
                    )}
                    <table className="w-full border-collapse text-right text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#FBF9F4] text-[#171C19]">
                          {currentFact.table.headers.map((h, i) => (
                            <th
                              key={i}
                              className="border-b border-[#171C19]/12 px-3 py-2 font-extrabold"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentFact.table.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={rIdx % 2 === 0 ? 'bg-white' : 'bg-[#FBF9F4]/60'}
                          >
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="border-b border-[#171C19]/8 px-3 py-2 leading-relaxed text-[#171C19]/90"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {currentFact.scholarlyNote && renderScholarlyTone(currentFact.scholarlyNote)}
              </div>
            </div>
          )}

          {stage === 'challenge' && currentChallenge && (
            <div className="space-y-4">
              {/* Challenge Progress */}
              <div className="flex items-center justify-between rounded-xl border border-[#171C19]/10 bg-[#F2ECE1] px-4 py-2.5 text-xs font-bold text-[#171C19]">
                <span>
                  التحدي {challengeIdx + 1} من {station.challenges.length}
                </span>
                <span className="text-[#1E6B47] tabular-nums">
                  الإجابات الصحيحة: {correctCount}
                </span>
              </div>

              <div className="space-y-4 rounded-2xl border border-[#171C19]/12 bg-white p-5 shadow-xs">
                <h3 className="font-scholar text-lg font-bold leading-relaxed text-[#171C19]">
                  {currentChallenge.prompt}
                </h3>

                {/* MCQ / Boolean */}
                {(currentChallenge.type === 'mcq' || currentChallenge.type === 'boolean') && (
                  <div className="space-y-2">
                    {currentChallenge.options.map((opt, idx) => {
                      const isPicked = selectedMcq === idx;
                      const isCorrectOpt = idx === currentChallenge.correctIndex;
                      let cls =
                        'border-[#171C19]/15 bg-[#FBF9F4] text-[#171C19] hover:bg-[#F2ECE1]';
                      if (gradedResult) {
                        if (isCorrectOpt) {
                          cls = 'border-[#1E6B47] bg-[#1E6B47]/12 text-[#144D33] font-bold';
                        } else if (isPicked) {
                          cls = 'border-[#B9382C] bg-[#B9382C]/10 text-[#7E2118]';
                        } else {
                          cls = 'border-[#171C19]/10 bg-white text-[#171C19]/50';
                        }
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={Boolean(gradedResult)}
                          onClick={() => handleCheckMcq(currentChallenge, idx)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-right text-sm transition ${cls}`}
                        >
                          <span>{opt}</span>
                          {gradedResult && isCorrectOpt && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1E6B47]" />
                          )}
                          {gradedResult && isPicked && !isCorrectOpt && (
                            <XCircle className="h-4 w-4 shrink-0 text-[#B9382C]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Classify */}
                {currentChallenge.type === 'classify' && (
                  <div className="space-y-3">
                    {currentChallenge.items.map((item) => {
                      const assigned = classifyMap[item.id];
                      const isRight = gradedResult && assigned === item.categoryId;
                      const isWrong = gradedResult && assigned !== item.categoryId;
                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-3.5 ${
                            isRight
                              ? 'border-[#1E6B47] bg-[#1E6B47]/8'
                              : isWrong
                                ? 'border-[#B9382C] bg-[#B9382C]/8'
                                : 'border-[#171C19]/12 bg-[#FBF9F4]'
                          }`}
                        >
                          <div className="mb-2 text-sm font-bold text-[#171C19]">{item.text}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {currentChallenge.categories.map((cat) => {
                              const active = assigned === cat.id;
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  disabled={Boolean(gradedResult)}
                                  onClick={() =>
                                    setClassifyMap((prev) => ({ ...prev, [item.id]: cat.id }))
                                  }
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                                    active
                                      ? 'border-[#171C19] bg-[#171C19] text-white'
                                      : 'border-[#171C19]/15 bg-white text-[#171C19] hover:bg-[#F2ECE1]'
                                  }`}
                                >
                                  {cat.label}
                                </button>
                              );
                            })}
                          </div>
                          {isWrong && (
                            <div className="mt-1.5 text-xs font-bold text-[#1E6B47]">
                              التصنيف الصحيح:{' '}
                              {
                                currentChallenge.categories.find((c) => c.id === item.categoryId)
                                  ?.label
                              }
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!gradedResult && (
                      <button
                        type="button"
                        disabled={
                          !currentChallenge.items.every((it) => Boolean(classifyMap[it.id]))
                        }
                        onClick={() => handleCheckClassify(currentChallenge)}
                        className="rounded-xl bg-[#1E6B47] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#175538] disabled:opacity-45"
                      >
                        تحقق من التصنيف
                      </button>
                    )}
                  </div>
                )}

                {/* Order */}
                {currentChallenge.type === 'order' && (
                  <div className="space-y-2.5">
                    {orderItems.map((item, idx) => {
                      const isCorrectPos =
                        gradedResult && currentChallenge.items[idx]?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${
                            gradedResult
                              ? isCorrectPos
                                ? 'border-[#1E6B47] bg-[#1E6B47]/8'
                                : 'border-[#B9382C] bg-[#B9382C]/8'
                              : 'border-[#171C19]/12 bg-[#FBF9F4]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#171C19] text-xs font-bold text-white tabular-nums">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-semibold text-[#171C19]">{item.text}</span>
                          </div>
                          {!gradedResult && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveOrderItem(idx, -1)}
                                aria-label="تحريك للأعلى"
                                className="rounded-md border border-[#171C19]/15 bg-white p-1.5 text-[#171C19] hover:bg-[#F2ECE1] disabled:opacity-35"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === orderItems.length - 1}
                                onClick={() => handleMoveOrderItem(idx, 1)}
                                aria-label="تحريك للأسفل"
                                className="rounded-md border border-[#171C19]/15 bg-white p-1.5 text-[#171C19] hover:bg-[#F2ECE1] disabled:opacity-35"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!gradedResult && (
                      <button
                        type="button"
                        onClick={() => handleCheckOrder(currentChallenge)}
                        className="mt-2 rounded-xl bg-[#1E6B47] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#175538]"
                      >
                        تحقق من الترتيب
                      </button>
                    )}
                  </div>
                )}

                {/* Match */}
                {currentChallenge.type === 'match' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#171C19]/70">
                      اختر عنصراً من العمود الأيمن ثم انقر على ما يناسبه من العمود الأيسر للربط بينهما.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        {currentChallenge.pairs.map((p, idx) => {
                          const linkedRightId = matchPairs[p.id];
                          const linkedRightText = currentChallenge.pairs.find(
                            (x) => x.id === linkedRightId
                          )?.right;
                          const isSelected = activeMatchLeftId === p.id;
                          const isRight = gradedResult && linkedRightId === p.id;
                          const isWrong = gradedResult && linkedRightId !== p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={Boolean(gradedResult)}
                              onClick={() => setActiveMatchLeftId(isSelected ? null : p.id)}
                              className={`w-full rounded-xl border p-3 text-right transition ${
                                isRight
                                  ? 'border-[#1E6B47] bg-[#1E6B47]/10'
                                  : isWrong
                                    ? 'border-[#B9382C] bg-[#B9382C]/10'
                                    : isSelected
                                      ? 'border-[#C8922B] bg-[#C8922B]/15'
                                      : 'border-[#171C19]/15 bg-[#FBF9F4] hover:bg-[#F2ECE1]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-sm font-bold text-[#171C19]">
                                <span>
                                  {idx + 1}. {p.left}
                                </span>
                              </div>
                              {linkedRightText && (
                                <div className="mt-1 text-xs font-semibold text-[#1E6B47]">
                                  ← {linkedRightText}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="space-y-2">
                        {shuffledMatchRight.map((r) => {
                          const isUsed = Object.values(matchPairs).includes(r.id);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              disabled={Boolean(gradedResult) || !activeMatchLeftId}
                              onClick={() => handleClickRightMatch(r.id)}
                              className={`w-full rounded-xl border p-3 text-right text-sm transition ${
                                activeMatchLeftId
                                  ? 'border-[#C8922B] bg-white hover:bg-[#C8922B]/10'
                                  : isUsed
                                    ? 'border-[#1E6B47]/35 bg-[#1E6B47]/8 text-[#171C19]/75'
                                    : 'border-[#171C19]/12 bg-[#F2ECE1]/60 text-[#171C19]'
                              }`}
                            >
                              {r.text}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {!gradedResult && (
                      <button
                        type="button"
                        disabled={!currentChallenge.pairs.every((p) => Boolean(matchPairs[p.id]))}
                        onClick={() => handleCheckMatch(currentChallenge)}
                        className="rounded-xl bg-[#1E6B47] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#175538] disabled:opacity-45"
                      >
                        تحقق من الربط
                      </button>
                    )}
                  </div>
                )}

                {/* Explanation + Next */}
                {gradedResult && (
                  <div
                    className={`rounded-xl border p-4 ${
                      gradedResult.isCorrect
                        ? 'border-[#1E6B47]/35 bg-[#1E6B47]/10 text-[#144D33]'
                        : 'border-[#B9382C]/35 bg-[#B9382C]/8 text-[#7E2118]'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-sm font-extrabold">
                      {gradedResult.isCorrect ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-[#1E6B47]" />
                          <span>أحسنت! إجابة علمية دقيقة</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-[#B9382C]" />
                          <span>تنبّه للتفصيل العلمي الدقيق:</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-[#171C19]">
                      {gradedResult.explanation}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAdvanceChallenge}
                        className="flex items-center gap-1.5 rounded-lg bg-[#171C19] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#2A332E]"
                      >
                        <span>
                          {challengeIdx + 1 < station.challenges.length
                            ? 'التحدي التالي'
                            : 'عرض خلاصة المحطة'}
                        </span>
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === 'summary' && (
            <div className="mx-auto max-w-xl space-y-5 rounded-2xl border border-[#171C19]/12 bg-white p-6 text-center shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C8922B]/15 text-[#C8922B]">
                <Award className="h-8 w-8" />
              </div>

              <div>
                <h3 className="font-scholar text-2xl font-bold text-[#171C19]">
                  {summaryScorePct >= 60 ? 'أتممت المحطة بنجاح!' : 'نتيجة المحطة'}
                </h3>
                <p className="mt-1 text-sm text-[#171C19]/75">{station.title}</p>
              </div>

              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3].map((n) => (
                  <Star
                    key={n}
                    className={`h-8 w-8 ${
                      n <= earnedStars
                        ? 'fill-[#C8922B] text-[#C8922B]'
                        : 'text-[#171C19]/20'
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#171C19]/10 bg-[#FBF9F4] p-4">
                <div>
                  <div className="text-xs text-[#171C19]/60">نسبة الدقة</div>
                  <div className="text-xl font-extrabold text-[#1E6B47] tabular-nums">
                    {summaryScorePct}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#171C19]/60">الإجابات الصحيحة</div>
                  <div className="text-xl font-extrabold text-[#171C19] tabular-nums">
                    {correctCount} / {station.challenges.length}
                  </div>
                </div>
              </div>

              {missedFactIds.length > 0 && (
                <div className="rounded-xl border border-[#C8922B]/30 bg-[#C8922B]/10 p-3 text-xs text-[#6D4D0B]">
                  أُضيفت المسائل التي تعثّرت فيها إلى صندوق «المراجعة الذكية» لتثبيتها لاحقاً.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStage('challenge');
                    setChallengeIdx(0);
                    setCorrectCount(0);
                    setMissedFactIds([]);
                  }}
                  className="rounded-xl border border-[#171C19]/15 bg-[#F2ECE1] px-4 py-2.5 text-xs font-bold text-[#171C19] hover:bg-[#E7DEC9]"
                >
                  إعادة التحدي
                </button>
                {nextStationInChapter && (
                  <button
                    type="button"
                    onClick={() => onSelectStation(nextStationInChapter.id)}
                    className="flex items-center gap-1.5 rounded-xl bg-[#1E6B47] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#175538]"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>المحطة التالية: {nextStationInChapter.title}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-[#171C19] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2B332E]"
                >
                  العودة إلى الأرخبيل ثلاثي الأبعاد
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation for Study stage */}
        {stage === 'study' && currentFact && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#171C19]/12 bg-[#F2ECE1] px-5 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={cardIdx === 0}
                onClick={() => setCardIdx((i) => Math.max(0, i - 1))}
                className="flex items-center gap-1 rounded-lg border border-[#171C19]/15 bg-[#FBF9F4] px-3 py-2 text-xs font-bold text-[#171C19] hover:bg-[#E7DEC9] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
                <span>السابقة</span>
              </button>
              <span className="text-xs font-bold text-[#171C19]/70 tabular-nums">
                {cardIdx + 1} / {station.facts.length}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCompleteCurrentCard}
              className="flex items-center gap-2 rounded-xl bg-[#1E6B47] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#175538]"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {cardIdx + 1 < station.facts.length
                  ? 'تم استيعاب البطاقة · التالية'
                  : 'تم الاستيعاب · ابدأ التحدي التفاعلي'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
