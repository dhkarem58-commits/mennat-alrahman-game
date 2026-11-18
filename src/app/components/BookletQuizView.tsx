import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  FileText,
  Filter,
  XCircle,
} from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';
import {
  BookletEssayQuestion,
  BookletObjectiveQuestion,
  CHAPTERS,
  ChapterId,
  getFactById,
} from '../../curriculum';
import { BookletQuizAnswerState } from '../../firebase/progressService';

interface BookletQuizViewProps {
  quizAnswers: Record<string, BookletQuizAnswerState>;
  onAnswerObjective: (
    question: BookletObjectiveQuestion,
    selectedIndex: number,
    isCorrect: boolean
  ) => void;
  onJumpToFact: (stationId: string, factId: string) => void;
}

type BankMode = 'objective' | 'essay';
type ObjectiveFilter = 'all' | 'unanswered' | 'wrong';

const ESSAY_REVIEWED_KEY = 'minnah_essay_reviewed_v1';

export const BookletQuizView: React.FC<BookletQuizViewProps> = ({
  quizAnswers,
  onAnswerObjective,
  onJumpToFact,
}) => {
  const [selectedChapter, setSelectedChapter] = useState<ChapterId>('ch2');
  const [mode, setMode] = useState<BankMode>('objective');
  const [filter, setFilter] = useState<ObjectiveFilter>('all');
  const [openEssayIds, setOpenEssayIds] = useState<Record<string, boolean>>({});
  const [reviewedEssayIds, setReviewedEssayIds] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(ESSAY_REVIEWED_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(ESSAY_REVIEWED_KEY, JSON.stringify(reviewedEssayIds));
    } catch {
      // ignore storage errors
    }
  }, [reviewedEssayIds]);

  const activeChapter = useMemo(
    () => CHAPTERS.find((c) => c.id === selectedChapter) ?? CHAPTERS[0],
    [selectedChapter]
  );

  const totalCorrectObj = useMemo(
    () => Object.values(quizAnswers).filter((a) => a.isCorrect).length,
    [quizAnswers]
  );

  const filteredObjectiveQuestions = useMemo(() => {
    return activeChapter.objectiveQuestions.filter((q) => {
      const ans = quizAnswers[q.id];
      if (filter === 'unanswered') return !ans;
      if (filter === 'wrong') return Boolean(ans && !ans.isCorrect);
      return true;
    });
  }, [activeChapter.objectiveQuestions, quizAnswers, filter]);

  const handleSelectOption = (q: BookletObjectiveQuestion, idx: number) => {
    const existing = quizAnswers[q.id];
    if (existing?.isCorrect) return;
    const isCorrect = idx === q.correctIndex;
    if (isCorrect) {
      soundEngine.playCorrect();
    } else {
      soundEngine.playWrong();
    }
    onAnswerObjective(q, idx, isCorrect);
  };

  const toggleEssayAnswer = (id: string) => {
    setOpenEssayIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleEssayReviewed = (id: string) => {
    setReviewedEssayIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="scholar-scroll fixed inset-x-0 top-[68px] bottom-0 z-25 overflow-y-auto bg-[#EEF2F6] px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5 pb-12">
        {/* Summary Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#171C19]/12 bg-[#FBF9F4] p-5 shadow-xs">
          <div>
            <h2 className="font-scholar text-2xl font-bold text-[#171C19]">
              بنك أسئلة كراسة المِنَّة الشامل
            </h2>
            <p className="mt-1 text-sm text-[#171C19]/75">
              جميع التدريبات الموضوعية (١٢٠ سؤالاً) والأسئلة المقالية ونماذج إجابتها (٤٠ سؤالاً) كما وردت في الكراسة حرفياً.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#171C19]/10 bg-[#F2ECE1] px-4 py-2.5">
            <div>
              <div className="text-[11px] font-bold text-[#171C19]/60">الموضوعي المتقن</div>
              <div className="text-lg font-extrabold text-[#1E6B47] tabular-nums">
                {totalCorrectObj} / 120
              </div>
            </div>
            <div className="h-8 w-px bg-[#171C19]/15" />
            <div>
              <div className="text-[11px] font-bold text-[#171C19]/60">المقالي المراجَع</div>
              <div className="text-lg font-extrabold text-[#C8922B] tabular-nums">
                {Object.values(reviewedEssayIds).filter(Boolean).length} / 40
              </div>
            </div>
          </div>
        </div>

        {/* Chapter Tabs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CHAPTERS.map((ch) => {
            const isSel = ch.id === selectedChapter;
            const chCorrect = ch.objectiveQuestions.filter(
              (q) => quizAnswers[q.id]?.isCorrect
            ).length;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChapter(ch.id)}
                className={`rounded-xl border p-3 text-right transition ${
                  isSel
                    ? 'border-[#171C19] bg-[#171C19] text-white'
                    : 'border-[#171C19]/12 bg-[#FBF9F4] text-[#171C19] hover:bg-[#F2ECE1]'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-xs">
                  <span
                    className="inline-block h-2 w-2 rounded-xs"
                    style={{ backgroundColor: ch.accentHex }}
                  />
                  <span className="opacity-75 tabular-nums">
                    {chCorrect}/{ch.objectiveQuestions.length}
                  </span>
                </div>
                <div className="mt-1 text-xs font-extrabold sm:text-sm">{ch.shortTitle}</div>
              </button>
            );
          })}
        </div>

        {/* Mode & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#171C19]/12 bg-[#FBF9F4] px-4 py-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-[#171C19]/10 bg-[#F2ECE1] p-1">
            <button
              type="button"
              onClick={() => setMode('objective')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                mode === 'objective'
                  ? 'bg-white text-[#1E6B47] shadow-xs'
                  : 'text-[#171C19]/75 hover:text-[#171C19]'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>
                الأسئلة الموضوعية ({activeChapter.objectiveQuestions.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('essay')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                mode === 'essay'
                  ? 'bg-white text-[#1E6B47] shadow-xs'
                  : 'text-[#171C19]/75 hover:text-[#171C19]'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>الأسئلة المقالية ({activeChapter.essayQuestions.length})</span>
            </button>
          </div>

          {mode === 'objective' && (
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="h-3.5 w-3.5 text-[#171C19]/55" />
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'unanswered', label: 'لم يُجب عنه' },
                  { id: 'wrong', label: 'أخطاء سابقة' },
                ] as { id: ObjectiveFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-lg border px-2.5 py-1 font-bold transition ${
                    filter === f.id
                      ? 'border-[#1E6B47] bg-[#1E6B47] text-white'
                      : 'border-[#171C19]/12 bg-[#F2ECE1] text-[#171C19]/75 hover:bg-[#E7DEC9]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Questions List */}
        {mode === 'objective' ? (
          filteredObjectiveQuestions.length === 0 ? (
            <div className="rounded-2xl border border-[#171C19]/12 bg-[#FBF9F4] p-8 text-center text-sm text-[#171C19]/70">
              لا توجد أسئلة مطابقة لهذا الفلتر في هذا الباب.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredObjectiveQuestions.map((q) => {
                const ans = quizAnswers[q.id];
                const relatedFact = q.relatedFactId ? getFactById(q.relatedFactId) : undefined;
                return (
                  <div
                    key={q.id}
                    className="space-y-3 rounded-2xl border border-[#171C19]/12 bg-[#FBF9F4] p-5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-md bg-[#F2ECE1] px-2.5 py-1 text-xs font-extrabold text-[#171C19] tabular-nums">
                        سؤال رقم {q.number}
                      </span>
                      {ans && (
                        <span
                          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold ${
                            ans.isCorrect
                              ? 'bg-[#1E6B47]/12 text-[#1E6B47]'
                              : 'bg-[#B9382C]/12 text-[#B9382C]'
                          }`}
                        >
                          {ans.isCorrect ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>إجابة صحيحة</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              <span>حاول مرة أخرى لتثبيت الصواب</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    <h3 className="font-scholar text-lg font-bold leading-relaxed text-[#171C19]">
                      {q.prompt}
                    </h3>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt, idx) => {
                        const isPicked = ans?.selectedIndex === idx;
                        const isCorrectOpt = idx === q.correctIndex;
                        let styleCls =
                          'border-[#171C19]/14 bg-white text-[#171C19] hover:bg-[#F2ECE1]';
                        if (ans?.isCorrect) {
                          if (isCorrectOpt) {
                            styleCls =
                              'border-[#1E6B47] bg-[#1E6B47]/12 font-bold text-[#144D33]';
                          } else {
                            styleCls = 'border-[#171C19]/8 bg-white/60 text-[#171C19]/50';
                          }
                        } else if (ans && isPicked && !ans.isCorrect) {
                          styleCls = 'border-[#B9382C] bg-[#B9382C]/10 text-[#7E2118]';
                        }

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectOption(q, idx)}
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-right text-sm transition ${styleCls}`}
                          >
                            <span>{opt}</span>
                            {ans?.isCorrect && isCorrectOpt && (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1E6B47]" />
                            )}
                            {ans && !ans.isCorrect && isPicked && (
                              <XCircle className="h-4 w-4 shrink-0 text-[#B9382C]" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {ans && (
                      <div className="rounded-xl border border-[#C8922B]/25 bg-white p-3.5 text-sm leading-relaxed text-[#171C19]/90">
                        <div className="mb-1 text-xs font-extrabold text-[#8E6210]">
                          التوجيه العلمي من الكراسة:
                        </div>
                        <p>{q.explanation}</p>
                        {relatedFact && (
                          <button
                            type="button"
                            onClick={() => onJumpToFact(relatedFact.stationId, relatedFact.id)}
                            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-[#1E6B47]/30 bg-[#1E6B47]/8 px-3 py-1.5 text-xs font-bold text-[#1E6B47] hover:bg-[#1E6B47]/15"
                          >
                            <Compass className="h-3.5 w-3.5" />
                            <span>مراجعة البطاقة في الخريطة: {relatedFact.title}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {activeChapter.essayQuestions.map((eq: BookletEssayQuestion) => {
              const isOpen = Boolean(openEssayIds[eq.id]);
              const isReviewed = Boolean(reviewedEssayIds[eq.id]);
              return (
                <div
                  key={eq.id}
                  className="rounded-2xl border border-[#171C19]/12 bg-[#FBF9F4] p-5 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-md bg-[#F2ECE1] px-2.5 py-1 text-xs font-extrabold text-[#171C19] tabular-nums">
                      سؤال مقالي رقم {eq.number}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleEssayReviewed(eq.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold transition ${
                        isReviewed
                          ? 'border-[#1E6B47] bg-[#1E6B47] text-white'
                          : 'border-[#171C19]/15 bg-white text-[#171C19]/75 hover:bg-[#F2ECE1]'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{isReviewed ? 'تمت مراجعته وإتقانه' : 'تحديد كمُتقَن'}</span>
                    </button>
                  </div>

                  <h3 className="font-scholar mt-3 text-lg font-bold leading-relaxed text-[#171C19]">
                    {eq.prompt}
                  </h3>

                  <button
                    type="button"
                    onClick={() => toggleEssayAnswer(eq.id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#171C19]/15 bg-white px-3.5 py-2 text-xs font-bold text-[#171C19] hover:bg-[#F2ECE1]"
                  >
                    {isOpen ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        <span>إخفاء نموذج الإجابة</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        <span>عرض نموذج الإجابة الكامل</span>
                      </>
                    )}
                  </button>

                  {isOpen && (
                    <div className="mt-3 space-y-2 rounded-xl border border-[#1E6B47]/25 bg-white p-4">
                      <ul className="space-y-1.5">
                        {eq.modelAnswerPoints.map((pt, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm leading-relaxed text-[#171C19]"
                          >
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#1E6B47]/12 text-xs font-bold text-[#1E6B47] tabular-nums">
                              {i + 1}
                            </span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                      {eq.evidenceRef && (
                        <div className="pt-1 text-xs font-bold text-[#8E6210]">
                          المرجع والشاهد: {eq.evidenceRef}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
