import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Award, BookOpen, Compass, Crown, Sparkles, WifiOff, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import {
  ACHIEVEMENTS,
  ALL_FACTS,
  ALL_STATIONS,
  BookletObjectiveQuestion,
  CHAPTERS,
  ChapterId,
  FactCard,
  getChapterById,
  getRankForXp,
  getStationById,
  Station,
} from '../curriculum';
import { buildDailyReviewSchedule } from '../curriculum/smartReviewer';
import {
  auth,
  signInWithGoogle,
  signOutAccount,
  testFirestoreConnection,
} from '../firebase/firebaseClient';
import {
  ensureCloudUserProfile,
  FactMasteryState,
  loadAndMergeCloudPlayerGameState,
  loadAndMergeCloudProgress,
  loadLocalPlayerGameState,
  loadLocalProgress,
  saveCloudAchievement,
  saveCloudFactMastery,
  saveCloudPlayerGameState,
  saveCloudQuizAnswer,
  saveCloudStationProgress,
  saveLocalPlayerGameState,
  saveLocalProgress,
  StationProgressState,
  StudentProgressSnapshot,
} from '../firebase/progressService';
import {
  AvatarConfig,
  CameraMode,
  CosmeticSwatch,
  GameSettings,
  getTodayDateKey,
  InteractableTarget,
  PlayerGameState,
  QuestGuidanceState,
} from '../game/types';
import { AcademyScene, SceneHudSnapshot } from '../scene/AcademyScene';
import { AchievementsView } from './components/AchievementsView';
import { BookletQuizView } from './components/BookletQuizView';
import { BottomDock } from './components/BottomDock';
import { MobileControls } from './components/MobileControls';
import { QuestHud } from './components/QuestHud';
import { ReviewView } from './components/ReviewView';
import { SettingsPanel } from './components/SettingsPanel';
import { StartScreenModal } from './components/StartScreenModal';
import { StationModal } from './components/StationModal';
import { ActiveViewMode, TopBar } from './components/TopBar';
import { Tutorial } from './components/Tutorial';
import { usePwaStatus } from './hooks/usePwaStatus';

const SMART_REVIEW_COUNT_KEY = 'minnah_smart_review_count_v1';

function computeNewlyUnlockedAchievements(
  snapshot: StudentProgressSnapshot,
  smartReviewCount: number
): string[] {
  const already = new Set(snapshot.achievements);
  const newly: string[] = [];

  const check = (id: string, cond: boolean) => {
    if (!already.has(id) && cond) {
      already.add(id);
      newly.push(id);
    }
  };

  const stationStates = snapshot.stations;
  const isStationMastered = (stId: string) => {
    const s = stationStates[stId];
    return Boolean(s?.challengePassed && s.stars >= 2);
  };

  const masteredStationsCount = ALL_STATIONS.filter((st) =>
    isStationMastered(st.id)
  ).length;

  const correctQuizCount = Object.values(snapshot.quizAnswers).filter(
    (a) => a.isCorrect
  ).length;

  const chapterMastered = (chId: ChapterId) => {
    const ch = getChapterById(chId);
    return Boolean(ch && ch.stations.every((st) => isStationMastered(st.id)));
  };

  check('ach_first_card', snapshot.profile.completedCardsCount >= 1);
  check('ach_first_station', masteredStationsCount >= 1);
  check('ach_streak_5', snapshot.profile.bestStreak >= 5);
  check('ach_streak_12', snapshot.profile.bestStreak >= 12);
  check('ach_streak_25', snapshot.profile.bestStreak >= 25);

  check('ach_ch2_master', chapterMastered('ch2'));
  check('ach_ch3_master', chapterMastered('ch3'));
  check('ach_ch4_master', chapterMastered('ch4'));
  check('ach_ch5_master', chapterMastered('ch5'));
  check('ach_ch6_master', chapterMastered('ch6'));

  const pauseMastered =
    isStationMastered('ch2_st3') &&
    isStationMastered('ch2_st4') &&
    isStationMastered('ch3_st3') &&
    isStationMastered('ch4_st1');
  check('ach_pause_precision', pauseMastered);

  check('ach_kasb_scholar', isStationMastered('ch6_st5'));

  check('ach_drills_25', correctQuizCount >= 25);
  check('ach_drills_60', correctQuizCount >= 60);
  check('ach_drills_120', correctQuizCount >= 120);

  const reinforcedFactsCount = Object.values(snapshot.facts).filter(
    (f) => f.correctCount >= 2
  ).length;
  check('ach_smart_review_5', smartReviewCount >= 5 || reinforcedFactsCount >= 5);

  check('ach_cards_all', snapshot.profile.completedCardsCount >= ALL_FACTS.length);
  check(
    'ach_grand_archipelago',
    masteredStationsCount >= ALL_STATIONS.length && correctQuizCount >= 120
  );

  return newly;
}

const DEFAULT_GUIDANCE: QuestGuidanceState = {
  targetChapterId: 'ch2',
  targetStationId: null,
  targetTitle: 'جاري تهيئة الوجهة...',
  targetSubtitle: 'اختر جزيرة أو اتبع السهم الذهبي',
  targetPos: { x: 0, y: 0.75, z: 0 },
  distanceMeters: 0,
  compassAngleRad: 0,
  recommendedBridgeChapterId: 'ch2',
  companionHint: 'مرحبًا بك في أرخبيل كراسة المِنَّة؛ دعنا نستكشف معًا.',
  reviewPortalActive: false,
};

export const App: React.FC = () => {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<AcademyScene | null>(null);

  const [progress, setProgress] = useState<StudentProgressSnapshot>(() =>
    loadLocalProgress()
  );
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const [gameState, setGameState] = useState<PlayerGameState>(() =>
    loadLocalPlayerGameState()
  );
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const [smartReviewCount, setSmartReviewCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(SMART_REVIEW_COUNT_KEY) || '0') || 0;
    } catch {
      return 0;
    }
  });
  const smartReviewRef = useRef(smartReviewCount);
  smartReviewRef.current = smartReviewCount;

  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [activeView, setActiveView] = useState<ActiveViewMode>('map');
  const [selectedChapterId, setSelectedChapterId] = useState<ChapterId | null>(null);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [initialFactId, setInitialFactId] = useState<string | null>(null);

  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [webglLost, setWebglLost] = useState(false);

  // Phase 3 Loading / Start / Settings / Tutorial UI state
  const [loadProgress, setLoadProgress] = useState<{ percent: number; label: string }>({
    percent: 0,
    label: 'جاري تحميل أرخبيل المِنَّة...',
  });
  const [isStartOpen, setIsStartOpen] = useState(true);
  const [startTab, setStartTab] = useState<'home' | 'cosmetics'>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  // Live 3D scene HUD snapshot
  const [nearestTarget, setNearestTarget] = useState<InteractableTarget | null>(null);
  const [hudSnapshot, setHudSnapshot] = useState<SceneHudSnapshot>(() => ({
    playerPos: gameState.lastPos,
    cameraMode: 'player',
    guidance: DEFAULT_GUIDANCE,
    markers: [],
    isMoving: false,
    isTouchDevice:
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches,
    remainingStarsToday: 20,
  }));

  const [hoveredInfo, setHoveredInfo] = useState<{
    stationId: string;
    x: number;
    y: number;
  } | null>(null);

  const [toastAchievementId, setToastAchievementId] = useState<string | null>(null);
  const [rankUpBanner, setRankUpBanner] = useState<string | null>(null);
  const [chapterBridgeBanner, setChapterBridgeBanner] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const { pwa, isOnline } = usePwaStatus();

  // Refresh time tick every minute so newly due nextReviewAtMs cards surface automatically
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Sync audio mute state and volume
  useEffect(() => {
    soundEngine.setEnabled(progress.profile.soundEnabled);
    soundEngine.setVolume(gameState.settings.volume);
  }, [progress.profile.soundEnabled, gameState.settings.volume]);

  // Persist helper for PlayerGameState (local immediately + optional cloud)
  const updateGameState = useCallback(
    (updater: (prev: PlayerGameState) => PlayerGameState, pushCloud = true) => {
      const next = updater(gameStateRef.current);
      gameStateRef.current = next;
      setGameState(next);
      saveLocalPlayerGameState(next);
      const activeUser = userRef.current;
      if (pushCloud && activeUser) {
        void (async () => {
          await ensureCloudUserProfile(activeUser, progressRef.current.profile);
          await saveCloudPlayerGameState(activeUser, next);
        })();
      }
      return next;
    },
    []
  );

  // Sync scene parameters when settings or avatar change
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    sc.setQualityPreset(gameState.settings.quality);
    sc.setCameraSensitivity(gameState.settings.cameraSensitivity);
    sc.setReducedMotion(gameState.settings.reducedMotion);
  }, [
    gameState.settings.quality,
    gameState.settings.cameraSensitivity,
    gameState.settings.reducedMotion,
  ]);

  useEffect(() => {
    sceneRef.current?.updateAvatarAppearance(gameState.avatar);
  }, [gameState.avatar]);

  // Firestore connectivity verification + auth listener (sequence profile before gameState!)
  useEffect(() => {
    void testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const mergedProgress = await loadAndMergeCloudProgress(
          nextUser,
          progressRef.current
        );
        setProgress(mergedProgress);

        const mergedGame = await loadAndMergeCloudPlayerGameState(
          nextUser,
          gameStateRef.current
        );
        gameStateRef.current = mergedGame;
        setGameState(mergedGame);

        sceneRef.current?.updateAvatarAppearance(mergedGame.avatar);
        sceneRef.current?.syncCollectedStars(mergedGame.collectedStarIdsToday);
      }
    });
    return () => unsub();
  }, []);

  const handleOpenStation = useCallback(
    (stationId: string, factId?: string) => {
      const st = getStationById(stationId);
      if (!st) return;

      // Snapshot current player position cleanly before opening modal
      const snapPos = sceneRef.current?.getPlayerPositionSnapshot();
      if (snapPos) {
        updateGameState((prev) => ({ ...prev, lastPos: snapPos }), false);
      }

      setActiveView('map');
      setSelectedChapterId(st.chapterId);
      setActiveStationId(st.id);
      setInitialFactId(factId ?? null);
      soundEngine.playFly();
      sceneRef.current?.flyToStation(st.id);
    },
    [updateGameState]
  );

  const handleOpenReviewPortal = useCallback(() => {
    const snapPos = sceneRef.current?.getPlayerPositionSnapshot();
    if (snapPos) {
      updateGameState((prev) => ({ ...prev, lastPos: snapPos }), false);
    }
    soundEngine.playFly();
    setActiveStationId(null);
    setActiveView('review');
  }, [updateGameState]);

  const handleCollectStar = useCallback(
    (starId: string) => {
      const today = getTodayDateKey();
      const prev = gameStateRef.current;
      if (prev.collectedStarsDate === today && prev.collectedStarIdsToday.includes(starId)) {
        return;
      }
      soundEngine.playStarCollect();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(14);
        } catch {
          // ignore
        }
      }
      updateGameState((cur) => {
        const list =
          cur.collectedStarsDate === today
            ? Array.from(new Set([...cur.collectedStarIdsToday, starId]))
            : [starId];
        return {
          ...cur,
          cosmeticStars: cur.cosmeticStars + 1,
          collectedStarsDate: today,
          collectedStarIdsToday: list,
        };
      });
    },
    [updateGameState]
  );

  // Mount Three.js 3D Archipelago once
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const initial = gameStateRef.current;
    const scene = new AcademyScene(
      host,
      {
        onSelectStation: (stationId) => {
          handleOpenStation(stationId);
        },
        onOpenReviewPortal: () => {
          handleOpenReviewPortal();
        },
        onHoverStation: (stationId, x, y) => {
          if (!stationId) {
            setHoveredInfo(null);
          } else {
            setHoveredInfo({ stationId, x, y });
          }
        },
        onNearestInteractableChange: (target) => {
          setNearestTarget(target);
        },
        onHudTick: (snap) => {
          setHudSnapshot(snap);
        },
        onCollectStar: (starId) => {
          handleCollectStar(starId);
        },
        onTogglePause: () => {
          setIsSettingsOpen((prev) => !prev);
        },
        onLoadProgress: (percent, label) => {
          setLoadProgress({ percent, label });
        },
        onContextLost: () => {
          setWebglLost(true);
        },
        onContextRestored: () => {
          setWebglLost(false);
        },
      },
      {
        avatar: initial.avatar,
        initialPos: initial.lastPos,
        collectedStarIdsToday: initial.collectedStarIdsToday,
        quality: initial.settings.quality,
        sensitivity: initial.settings.cameraSensitivity,
        reducedMotion: initial.settings.reducedMotion,
      }
    );

    scene.syncProgressVisuals(progressRef.current.stations);
    sceneRef.current = scene;

    return () => {
      const last = scene.getPlayerPositionSnapshot();
      const next = { ...gameStateRef.current, lastPos: last };
      saveLocalPlayerGameState(next);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [handleCollectStar, handleOpenReviewPortal, handleOpenStation]);

  // Periodically save player position locally (+ on page hide)
  useEffect(() => {
    const savePosOnly = () => {
      const snap = sceneRef.current?.getPlayerPositionSnapshot();
      if (!snap) return;
      const cur = gameStateRef.current.lastPos;
      if (
        Math.hypot(snap.x - cur.x, snap.z - cur.z) > 0.35 ||
        Math.abs(snap.yaw - cur.yaw) > 0.1
      ) {
        updateGameState((prev) => ({ ...prev, lastPos: snap }), false);
      }
    };

    const intervalId = window.setInterval(savePosOnly, 4000);
    const onVisibility = () => {
      if (document.hidden) savePosOnly();
    };
    window.addEventListener('beforeunload', savePosOnly);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', savePosOnly);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [updateGameState]);

  // Pause 3D input processing while overlays or non-map views are active
  useEffect(() => {
    const anyModalOpen =
      isStartOpen ||
      isSettingsOpen ||
      isTutorialOpen ||
      Boolean(activeStationId) ||
      activeView !== 'map';
    sceneRef.current?.setPaused(anyModalOpen);
  }, [isStartOpen, isSettingsOpen, isTutorialOpen, activeStationId, activeView]);

  // Sync 3D beacons & halos whenever station progress updates
  useEffect(() => {
    sceneRef.current?.syncProgressVisuals(progress.stations);
  }, [progress.stations]);

  // Highlight active station monument in 3D and restore camera on close
  useEffect(() => {
    if (activeStationId) {
      sceneRef.current?.setActiveStationHighlight(activeStationId, 0);
    } else {
      sceneRef.current?.setActiveStationHighlight(null, 0);
      sceneRef.current?.returnCameraToPlayer();
    }
  }, [activeStationId]);

  const dailySchedule = useMemo(
    () => buildDailyReviewSchedule(progress.facts, nowTick),
    [progress.facts, nowTick]
  );
  const dueReviewCount = dailySchedule.dueCount;

  // Sync review portal visibility in central hub
  useEffect(() => {
    sceneRef.current?.setDueReviewCount(dueReviewCount);
  }, [dueReviewCount]);

  // Increment Daily Challenge progress & reward +2 cosmetic stars once completed
  const incrementDailyChallenge = useCallback(() => {
    const today = getTodayDateKey();
    updateGameState((prev) => {
      const current =
        prev.dailyChallenge.dateKey === today
          ? prev.dailyChallenge
          : { dateKey: today, targetActions: 3, completedActions: 0, claimed: false };

      if (current.claimed) return prev;
      const nextCompleted = Math.min(current.targetActions, current.completedActions + 1);
      const justCompleted = nextCompleted >= current.targetActions;
      if (justCompleted) {
        soundEngine.playAchievement();
      }
      return {
        ...prev,
        cosmeticStars: prev.cosmeticStars + (justCompleted ? 2 : 0),
        dailyChallenge: {
          ...current,
          completedActions: nextCompleted,
          claimed: justCompleted,
        },
      };
    });
  }, [updateGameState]);

  const applyProgressUpdate = useCallback(
    (
      updater: (prev: StudentProgressSnapshot) => StudentProgressSnapshot,
      options?: {
        updatedStation?: StationProgressState;
        updatedFacts?: FactMasteryState[];
        updatedQuizAnswer?: BookletObjectiveQuestion & {
          selectedIndex: number;
          isCorrect: boolean;
        };
        overrideSmartReviewCount?: number;
      }
    ) => {
      const prevRankIdx = progressRef.current.profile.rankIndex;
      const nextBase = updater(progressRef.current);
      const reviewCnt = options?.overrideSmartReviewCount ?? smartReviewRef.current;
      const newAchIds = computeNewlyUnlockedAchievements(nextBase, reviewCnt);

      let extraXp = 0;
      newAchIds.forEach((id) => {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (def) extraXp += def.xpBonus;
      });

      const finalXp = nextBase.profile.xp + extraXp;
      const nextRank = getRankForXp(finalXp);
      const finalSnapshot: StudentProgressSnapshot = {
        ...nextBase,
        profile: {
          ...nextBase.profile,
          xp: finalXp,
          rankIndex: nextRank.index,
        },
        achievements: [...nextBase.achievements, ...newAchIds],
      };

      setProgress(finalSnapshot);
      saveLocalProgress(finalSnapshot);

      if (nextRank.index > prevRankIdx) {
        soundEngine.playAchievement();
        setRankUpBanner(`ارتقيت إلى رتبة: ${nextRank.title}`);
      }

      if (newAchIds.length > 0) {
        soundEngine.playAchievement();
        setToastAchievementId(newAchIds[0]);
      }

      const activeUser = userRef.current;
      if (activeUser) {
        void (async () => {
          await ensureCloudUserProfile(activeUser, finalSnapshot.profile);
          if (options?.updatedStation) {
            await saveCloudStationProgress(activeUser, options.updatedStation);
          }
          if (options?.updatedFacts) {
            await Promise.all(
              options.updatedFacts.map((f) => saveCloudFactMastery(activeUser, f))
            );
          }
          if (options?.updatedQuizAnswer) {
            await saveCloudQuizAnswer(activeUser, {
              questionId: options.updatedQuizAnswer.id,
              chapterId: options.updatedQuizAnswer.chapterId,
              isCorrect: options.updatedQuizAnswer.isCorrect,
              selectedIndex: options.updatedQuizAnswer.selectedIndex,
            });
          }
          if (newAchIds.length > 0) {
            await Promise.all(newAchIds.map((id) => saveCloudAchievement(activeUser, id)));
          }
        })();
      }
    },
    []
  );

  // Auto-hide achievement, rank-up, and bridge banners
  useEffect(() => {
    if (!toastAchievementId) return;
    const t = window.setTimeout(() => setToastAchievementId(null), 4800);
    return () => window.clearTimeout(t);
  }, [toastAchievementId]);

  useEffect(() => {
    if (!rankUpBanner) return;
    const t = window.setTimeout(() => setRankUpBanner(null), 4600);
    return () => window.clearTimeout(t);
  }, [rankUpBanner]);

  useEffect(() => {
    if (!chapterBridgeBanner) return;
    const t = window.setTimeout(() => setChapterBridgeBanner(null), 5000);
    return () => window.clearTimeout(t);
  }, [chapterBridgeBanner]);

  const handleCompleteCard = useCallback(
    (station: Station, factId: string) => {
      const prevSt = progressRef.current.stations[station.id] ?? {
        stationId: station.id,
        chapterId: station.chapterId,
        stars: 0,
        bestScore: 0,
        completedCardIds: [],
        challengePassed: false,
      };
      if (prevSt.completedCardIds.includes(factId)) return;

      const nextSt: StationProgressState = {
        ...prevSt,
        completedCardIds: [...prevSt.completedCardIds, factId],
      };

      const prevFact = progressRef.current.facts[factId] ?? {
        factId,
        chapterId: station.chapterId,
        masteryLevel: 0,
        wrongCount: 0,
        correctCount: 0,
        nextReviewAtMs: 0,
      };
      const nextFact: FactMasteryState = {
        ...prevFact,
        masteryLevel: Math.max(prevFact.masteryLevel, 1),
        nextReviewAtMs:
          prevFact.nextReviewAtMs > 0
            ? prevFact.nextReviewAtMs
            : Date.now() + 24 * 60 * 60 * 1000,
      };

      applyProgressUpdate(
        (prev) => {
          const allCardIds = new Set<string>();
          Object.values(prev.stations).forEach((s) =>
            s.completedCardIds.forEach((id) => allCardIds.add(id))
          );
          allCardIds.add(factId);

          return {
            ...prev,
            profile: {
              ...prev.profile,
              xp: prev.profile.xp + 20,
              completedCardsCount: allCardIds.size,
            },
            stations: {
              ...prev.stations,
              [station.id]: nextSt,
            },
            facts: {
              ...prev.facts,
              [factId]: nextFact,
            },
          };
        },
        { updatedStation: nextSt, updatedFacts: [nextFact] }
      );

      incrementDailyChallenge();
    },
    [applyProgressUpdate, incrementDailyChallenge]
  );

  const handleCompleteChallenge = useCallback(
    (
      station: Station,
      scorePct: number,
      correctCount: number,
      totalCount: number,
      missedFactIds: string[]
    ) => {
      const prevSt = progressRef.current.stations[station.id] ?? {
        stationId: station.id,
        chapterId: station.chapterId,
        stars: 0,
        bestScore: 0,
        completedCardIds: [],
        challengePassed: false,
      };

      const newStars = scorePct >= 90 ? 3 : scorePct >= 60 ? 2 : scorePct >= 30 ? 1 : 0;
      const passed = scorePct >= 60;
      const allStationCardIds = Array.from(
        new Set([...prevSt.completedCardIds, ...station.facts.map((f) => f.id)])
      );

      const nextSt: StationProgressState = {
        ...prevSt,
        stars: Math.max(prevSt.stars, newStars),
        bestScore: Math.max(prevSt.bestScore, scorePct),
        completedCardIds: allStationCardIds,
        challengePassed: prevSt.challengePassed || passed,
      };

      // Check chapter mastery transition for bridge celebration
      const chapter = getChapterById(station.chapterId);
      const wasChapterMastered = Boolean(
        chapter &&
          chapter.stations.every((st) => {
            const p = progressRef.current.stations[st.id];
            return Boolean(p?.challengePassed && p.stars >= 2);
          })
      );

      const updatedFactsList: FactMasteryState[] = [];
      const missedSet = new Set(missedFactIds);
      const now = Date.now();

      station.facts.forEach((f) => {
        const prevFact = progressRef.current.facts[f.id] ?? {
          factId: f.id,
          chapterId: station.chapterId,
          masteryLevel: 0,
          wrongCount: 0,
          correctCount: 0,
          nextReviewAtMs: 0,
        };
        if (missedSet.has(f.id)) {
          updatedFactsList.push({
            ...prevFact,
            masteryLevel: Math.max(0, prevFact.masteryLevel - 1),
            wrongCount: prevFact.wrongCount + 1,
            nextReviewAtMs: now,
          });
        } else if (passed) {
          const nextLvl = Math.min(3, Math.max(prevFact.masteryLevel, 1) + 1);
          updatedFactsList.push({
            ...prevFact,
            masteryLevel: nextLvl,
            correctCount: prevFact.correctCount + 1,
            nextReviewAtMs: now + nextLvl * 2 * 24 * 60 * 60 * 1000,
          });
        }
      });

      const xpBonus = passed
        ? (prevSt.challengePassed ? 25 : 70) + correctCount * 10
        : correctCount * 5;

      applyProgressUpdate(
        (prev) => {
          const nextFactsMap = { ...prev.facts };
          updatedFactsList.forEach((uf) => {
            nextFactsMap[uf.factId] = uf;
          });

          const updatedStationsMap = { ...prev.stations, [station.id]: nextSt };
          const allCardIds = new Set<string>();
          Object.values(updatedStationsMap).forEach((s) =>
            s.completedCardIds.forEach((id) => allCardIds.add(id))
          );

          const isPerfect = missedFactIds.length === 0 && totalCount > 0;
          const nextStreak = isPerfect ? prev.profile.currentStreak + correctCount : 0;

          return {
            ...prev,
            profile: {
              ...prev.profile,
              xp: prev.profile.xp + xpBonus,
              totalCorrect: prev.profile.totalCorrect + correctCount,
              totalAnswered: prev.profile.totalAnswered + totalCount,
              currentStreak: nextStreak,
              bestStreak: Math.max(prev.profile.bestStreak, nextStreak),
              completedCardsCount: allCardIds.size,
            },
            stations: updatedStationsMap,
            facts: nextFactsMap,
          };
        },
        { updatedStation: nextSt, updatedFacts: updatedFactsList }
      );

      if (passed) {
        sceneRef.current?.celebrateStationMastery(station.id);
        incrementDailyChallenge();

        if (chapter && !wasChapterMastered) {
          const nowMastered = chapter.stations.every((st) => {
            const p =
              st.id === station.id ? nextSt : progressRef.current.stations[st.id];
            return Boolean(p?.challengePassed && p.stars >= 2);
          });
          if (nowMastered) {
            soundEngine.playBridgeLit();
            setChapterBridgeBanner(
              `أحسنت! أتقنت ${chapter.shortTitle} وأضاء الجسر نحو الباب التالي.`
            );
          }
        }
      }
    },
    [applyProgressUpdate, incrementDailyChallenge]
  );

  const handleAnswerObjective = useCallback(
    (q: BookletObjectiveQuestion, selectedIndex: number, isCorrect: boolean) => {
      const updatedFacts: FactMasteryState[] = [];
      if (q.relatedFactId) {
        const prevFact = progressRef.current.facts[q.relatedFactId] ?? {
          factId: q.relatedFactId,
          chapterId: q.chapterId,
          masteryLevel: 0,
          wrongCount: 0,
          correctCount: 0,
          nextReviewAtMs: 0,
        };
        const nextFact: FactMasteryState = isCorrect
          ? {
              ...prevFact,
              masteryLevel: Math.min(3, prevFact.masteryLevel + 1),
              correctCount: prevFact.correctCount + 1,
              nextReviewAtMs: Date.now() + 3 * 24 * 60 * 60 * 1000,
            }
          : {
              ...prevFact,
              masteryLevel: Math.max(0, prevFact.masteryLevel - 1),
              wrongCount: prevFact.wrongCount + 1,
              nextReviewAtMs: Date.now(),
            };
        updatedFacts.push(nextFact);
      }

      applyProgressUpdate(
        (prev) => {
          const prevAns = prev.quizAnswers[q.id];
          const firstTimeCorrect = isCorrect && !prevAns?.isCorrect;
          const nextStreak = isCorrect ? prev.profile.currentStreak + 1 : 0;
          const nextFacts = { ...prev.facts };
          updatedFacts.forEach((f) => {
            nextFacts[f.factId] = f;
          });

          return {
            ...prev,
            profile: {
              ...prev.profile,
              xp: prev.profile.xp + (firstTimeCorrect ? 15 : 0),
              totalCorrect: prev.profile.totalCorrect + (isCorrect ? 1 : 0),
              totalAnswered: prev.profile.totalAnswered + 1,
              currentStreak: nextStreak,
              bestStreak: Math.max(prev.profile.bestStreak, nextStreak),
            },
            facts: nextFacts,
            quizAnswers: {
              ...prev.quizAnswers,
              [q.id]: {
                questionId: q.id,
                chapterId: q.chapterId,
                isCorrect: prevAns?.isCorrect ? true : isCorrect,
                selectedIndex,
              },
            },
          };
        },
        {
          updatedFacts,
          updatedQuizAnswer: { ...q, selectedIndex, isCorrect },
        }
      );

      if (isCorrect) {
        incrementDailyChallenge();
      }
    },
    [applyProgressUpdate, incrementDailyChallenge]
  );

  const handleRecordReview = useCallback(
    (fact: FactCard, mastered: boolean) => {
      const nextCount = smartReviewRef.current + (mastered ? 1 : 0);
      if (mastered) {
        setSmartReviewCount(nextCount);
        try {
          localStorage.setItem(SMART_REVIEW_COUNT_KEY, String(nextCount));
        } catch {
          // ignore
        }
      }

      const prevFact = progressRef.current.facts[fact.id] ?? {
        factId: fact.id,
        chapterId: fact.chapterId,
        masteryLevel: 0,
        wrongCount: 0,
        correctCount: 0,
        nextReviewAtMs: 0,
      };
      const now = Date.now();
      const nextLvl = mastered ? Math.min(3, prevFact.masteryLevel + 1) : 0;
      const intervalDays = nextLvl === 3 ? 7 : nextLvl === 2 ? 3 : 1;

      const nextFact: FactMasteryState = {
        ...prevFact,
        masteryLevel: nextLvl,
        correctCount: mastered ? prevFact.correctCount + 1 : prevFact.correctCount,
        wrongCount: mastered ? prevFact.wrongCount : prevFact.wrongCount + 1,
        nextReviewAtMs: mastered
          ? now + intervalDays * 24 * 60 * 60 * 1000
          : now + 60 * 60 * 1000,
      };

      applyProgressUpdate(
        (prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            xp: prev.profile.xp + (mastered ? 15 : 5),
          },
          facts: {
            ...prev.facts,
            [fact.id]: nextFact,
          },
        }),
        { updatedFacts: [nextFact], overrideSmartReviewCount: nextCount }
      );

      if (mastered) {
        incrementDailyChallenge();
      }
    },
    [applyProgressUpdate, incrementDailyChallenge]
  );

  const handleSelectChapter = (chId: ChapterId) => {
    setSelectedChapterId(chId);
    setActiveView('map');
    soundEngine.playFly();
    sceneRef.current?.flyToChapter(chId);
  };

  const handleResetOverview = () => {
    setSelectedChapterId(null);
    setActiveStationId(null);
    setActiveView('map');
    soundEngine.playFly();
    sceneRef.current?.flyToOverview();
  };

  const handleToggleSound = () => {
    const nextVal = !progress.profile.soundEnabled;
    soundEngine.setEnabled(nextVal);
    applyProgressUpdate((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        soundEnabled: nextVal,
      },
    }));
  };

  const handleUpdateSettings = (partial: Partial<GameSettings>) => {
    updateGameState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...partial,
      },
    }));
  };

  const handleUpdateAvatar = (nextAvatar: AvatarConfig) => {
    updateGameState((prev) => ({
      ...prev,
      avatar: nextAvatar,
    }));
  };

  const handleUnlockCosmetic = (item: CosmeticSwatch) => {
    updateGameState((prev) => {
      if (prev.unlockedCosmeticIds.includes(item.id) || prev.cosmeticStars < item.cost) {
        return prev;
      }
      soundEngine.playStarCollect();
      return {
        ...prev,
        cosmeticStars: prev.cosmeticStars - item.cost,
        unlockedCosmeticIds: [...prev.unlockedCosmeticIds, item.id],
      };
    });
  };

  const handleStartContinue = () => {
    setIsStartOpen(false);
    updateGameState((prev) => ({ ...prev, hasStartedOnce: true }));
    if (!gameStateRef.current.settings.tutorialCompleted) {
      setIsTutorialOpen(true);
    }
  };

  const handleStartNewGame = () => {
    sceneRef.current?.resetPlayerToHub();
    const hubPos = { x: 0, y: 0.75, z: 4.1, yaw: Math.PI };
    setSelectedChapterId(null);
    setActiveStationId(null);
    setActiveView('map');
    setIsStartOpen(false);
    updateGameState((prev) => ({
      ...prev,
      hasStartedOnce: true,
      lastPos: hubPos,
    }));
    if (!gameStateRef.current.settings.tutorialCompleted) {
      setIsTutorialOpen(true);
    }
  };

  const handleFinishTutorial = () => {
    setIsTutorialOpen(false);
    if (!gameStateRef.current.settings.tutorialCompleted) {
      handleUpdateSettings({ tutorialCompleted: true });
    }
  };

  const handleSignIn = async () => {
    setIsAuthBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      // Popup closed or blocked
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setIsAuthBusy(true);
    try {
      await signOutAccount();
    } finally {
      setIsAuthBusy(false);
    }
  };

  const activeStation = activeStationId ? getStationById(activeStationId) : undefined;
  const activeChapter = activeStation ? getChapterById(activeStation.chapterId) : undefined;
  const hoveredStation = hoveredInfo ? getStationById(hoveredInfo.stationId) : undefined;
  const hoveredChapter = hoveredStation ? getChapterById(hoveredStation.chapterId) : undefined;
  const toastAchievement = toastAchievementId
    ? ACHIEVEMENTS.find((a) => a.id === toastAchievementId)
    : undefined;

  const rootAccessibilityClasses = [
    gameState.settings.fontSize === 'large' ? 'font-scale-large' : '',
    gameState.settings.highContrast ? 'high-contrast-mode' : '',
    gameState.settings.reducedMotion ? 'reduced-motion-mode' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const isSceneGameplayVisible =
    activeView === 'map' &&
    !activeStation &&
    !isStartOpen &&
    !isSettingsOpen &&
    !isTutorialOpen &&
    !isZenMode;

  return (
    <div
      dir="rtl"
      className={`relative h-screen w-screen overflow-hidden bg-[#EEF2F6] select-none ${rootAccessibilityClasses}`}
    >
      {/* Persistent Three.js 3D Canvas Container */}
      <div ref={canvasHostRef} className="fixed inset-0 z-0" style={{ touchAction: 'none' }} />

      {/* 3D Archipelago Loading Progress Screen */}
      {loadProgress.percent < 100 && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#EEF2F6] p-6 text-center"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#171C19]/15 bg-[#FBF9F4] p-6 shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#C8922B]/40 bg-[#F2ECE1] text-[#1E6B47]">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="font-scholar mt-3 text-xl font-bold text-[#171C19]">
              أكاديمية المِنَّة ثلاثية الأبعاد
            </h2>
            <p className="mt-1 text-xs text-[#171C19]/70">{loadProgress.label}</p>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#F2ECE1]">
              <div
                className="h-full bg-[#1E6B47] transition-all duration-300"
                style={{ width: `${Math.max(8, loadProgress.percent)}%` }}
              />
            </div>
            <div className="mt-1.5 text-[11px] font-bold text-[#1E6B47] tabular-nums">
              {loadProgress.percent}%
            </div>
          </div>
        </div>
      )}

      {/* WebGL Context Lost Recovery */}
      {webglLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#EEF2F6] p-6 text-center">
          <div className="max-w-md rounded-2xl border border-[#171C19]/15 bg-[#FBF9F4] p-6 shadow-lg">
            <h2 className="font-scholar text-xl font-bold text-[#171C19]">
              توقّف العرض ثلاثي الأبعاد مؤقتاً
            </h2>
            <p className="mt-2 text-sm text-[#171C19]/75">
              يمكنك إعادة تحميل الصفحة لاستئناف الرحلة، وجميع تقدمك محفوظ بأمان.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-[#1E6B47] px-5 py-2.5 text-sm font-bold text-white"
            >
              إعادة التحميل
            </button>
          </div>
        </div>
      )}

      {/* Top Navigation & XP Header */}
      {!isZenMode && (
        <TopBar
          activeView={activeView}
          onChangeView={(view) => {
            setActiveView(view);
            if (view !== 'map') {
              setActiveStationId(null);
            }
          }}
          xp={progress.profile.xp}
          currentStreak={progress.profile.currentStreak}
          dueReviewCount={dueReviewCount}
          dailySchedule={dailySchedule}
          userEmail={user?.email ?? null}
          displayName={user?.displayName || progress.profile.displayName}
          isAuthBusy={isAuthBusy}
          isOnline={isOnline}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />
      )}

      {/* Gameplay HUD: Goal Tracker, Compass, Companion Hint, Daily Challenge, Streak, Stars, MiniMap, Camera Modes */}
      {isSceneGameplayVisible && (
        <QuestHud
          guidance={hudSnapshot.guidance}
          nearestTarget={nearestTarget}
          playerPos={hudSnapshot.playerPos}
          markers={hudSnapshot.markers}
          cosmeticStars={gameState.cosmeticStars}
          remainingStarsToday={hudSnapshot.remainingStarsToday}
          dailyStreakDays={gameState.dailyStreakDays}
          dailyChallenge={gameState.dailyChallenge}
          cameraMode={hudSnapshot.cameraMode}
          isTouchDevice={hudSnapshot.isTouchDevice}
          onChangeCameraMode={(mode: CameraMode) => sceneRef.current?.setCameraMode(mode)}
          onActivateNearest={() => sceneRef.current?.activateNearestInteractable()}
          onWalkToTarget={() => {
            const g = hudSnapshot.guidance;
            if (g.reviewPortalActive) {
              sceneRef.current?.walkToReviewPortal();
            } else {
              sceneRef.current?.walkToWorldPoint(g.targetPos.x, g.targetPos.z, 2.75, () => {
                sceneRef.current?.activateNearestInteractable();
              });
            }
          }}
          onOpenCosmetics={() => {
            setStartTab('cosmetics');
            setIsStartOpen(true);
          }}
        />
      )}

      {/* Mobile Touch Virtual Joystick & Action Buttons */}
      <MobileControls
        visible={
          activeView === 'map' &&
          !activeStation &&
          !isStartOpen &&
          !isSettingsOpen &&
          !isTutorialOpen &&
          hudSnapshot.isTouchDevice
        }
        buttonSize={gameState.settings.mobileButtonSize}
        leftHanded={gameState.settings.leftHanded}
        nearestTarget={nearestTarget}
        onVirtualMove={(dx, dy) => sceneRef.current?.input.setVirtualMove(dx, dy)}
        onVirtualSprint={(active) => sceneRef.current?.input.setVirtualSprint(active)}
        onJump={() => sceneRef.current?.input.triggerJump()}
        onInteract={() => sceneRef.current?.activateNearestInteractable()}
        onVibrate={(ms = 12) => {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(ms);
            } catch {
              // ignore
            }
          }
        }}
      />

      {/* 3D Hover Tooltip (Desktop) */}
      {isSceneGameplayVisible &&
        !hudSnapshot.isTouchDevice &&
        hoveredStation &&
        hoveredInfo &&
        hoveredChapter && (
          <div
            className="pointer-events-none fixed z-20 max-w-xs rounded-xl border border-[#171C19]/15 bg-[#FBF9F4] px-3.5 py-2.5 shadow-lg"
            style={{
              left: Math.min(window.innerWidth - 260, Math.max(12, hoveredInfo.x + 14)),
              top: Math.min(window.innerHeight - 110, Math.max(76, hoveredInfo.y - 12)),
            }}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#171C19]/65">
              <span
                className="inline-block h-2 w-2 rounded-xs"
                style={{ backgroundColor: hoveredChapter.accentHex }}
              />
              <span>{hoveredChapter.shortTitle}</span>
              <span>·</span>
              <span>محطة {hoveredStation.order}</span>
            </div>
            <div className="font-scholar mt-0.5 text-sm font-bold text-[#171C19]">
              {hoveredStation.title}
            </div>
            <div className="mt-0.5 text-[11px] text-[#171C19]/70">
              {hoveredStation.facts.length} بطاقات علمية · انقر للمشي وفتح المحطة
            </div>
          </div>
        )}

      {/* Notifications Stack: Achievement / Rank-Up / Bridge Lit */}
      <div className="pointer-events-none fixed top-24 left-4 z-40 flex flex-col gap-2">
        {toastAchievement && (
          <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-[#C8922B]/50 bg-[#FBF9F4] p-4 shadow-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C8922B]/15 text-[#C8922B]">
              <Award className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold text-[#1E6B47]">
                إنجاز جديد مفتوح! (+{toastAchievement.xpBonus} XP)
              </div>
              <div className="font-scholar text-sm font-bold text-[#171C19]">
                {toastAchievement.title}
              </div>
            </div>
            <button
              type="button"
              aria-label="إغلاق إشعار الإنجاز"
              onClick={() => setToastAchievementId(null)}
              className="rounded p-1 text-[#171C19]/45 hover:text-[#171C19]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {rankUpBanner && (
          <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-[#1E6B47]/45 bg-[#FBF9F4] p-3.5 shadow-xl">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1E6B47]/12 text-[#1E6B47]">
              <Crown className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-xs font-bold text-[#171C19]">
              {rankUpBanner}
            </div>
            <button
              type="button"
              aria-label="إغلاق إشعار الرتبة"
              onClick={() => setRankUpBanner(null)}
              className="rounded p-1 text-[#171C19]/45 hover:text-[#171C19]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {chapterBridgeBanner && (
          <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-[#C8922B]/45 bg-[#FBF9F4] p-3.5 shadow-xl">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C8922B]/14 text-[#8E6210]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-xs font-bold text-[#171C19]">
              {chapterBridgeBanner}
            </div>
            <button
              type="button"
              aria-label="إغلاق إشعار إضاءة الجسر"
              onClick={() => setChapterBridgeBanner(null)}
              className="rounded p-1 text-[#171C19]/45 hover:text-[#171C19]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Offline Subtle Toast */}
      {!isOnline && activeView === 'map' && !isStartOpen && (
        <div className="pointer-events-none fixed bottom-16 right-4 z-18 hidden items-center gap-2 rounded-xl border border-[#C8922B]/40 bg-[#FBF9F4] px-3 py-1.5 text-[11px] font-bold text-[#6D4D0B] shadow-md sm:flex">
          <WifiOff className="h-3.5 w-3.5" />
          <span>وضع عدم الاتصال — التقدّم محفوظ محلياً وستتم مزامنته لاحقاً</span>
        </div>
      )}

      {/* Bottom Archipelago Dock in Map Mode */}
      {activeView === 'map' && !isStartOpen && (
        <BottomDock
          selectedChapterId={selectedChapterId}
          onSelectChapter={handleSelectChapter}
          onResetOverview={handleResetOverview}
          onOpenStation={(stId) => handleOpenStation(stId)}
          stationStates={progress.stations}
          soundEnabled={progress.profile.soundEnabled}
          onToggleSound={handleToggleSound}
          isCollapsed={isDockCollapsed}
          onToggleCollapsed={() => setIsDockCollapsed((v) => !v)}
          isZenMode={isZenMode}
          onToggleZenMode={() => setIsZenMode((v) => !v)}
          isTouchDevice={hudSnapshot.isTouchDevice}
          isPlayerMoving={hudSnapshot.isMoving}
        />
      )}

      {/* Start Screen & Wardrobe Cosmetics Modal */}
      <StartScreenModal
        isOpen={isStartOpen}
        hasStartedOnce={gameState.hasStartedOnce}
        avatar={gameState.avatar}
        cosmeticStars={gameState.cosmeticStars}
        unlockedCosmeticIds={gameState.unlockedCosmeticIds}
        initialTab={startTab}
        completedCardsCount={progress.profile.completedCardsCount}
        xp={progress.profile.xp}
        onContinue={handleStartContinue}
        onNewGame={handleStartNewGame}
        onUpdateAvatar={handleUpdateAvatar}
        onUnlockCosmetic={handleUnlockCosmetic}
        pwa={pwa}
      />

      {/* Pause & Settings Modal */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        settings={gameState.settings}
        soundEnabled={progress.profile.soundEnabled}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateSettings={handleUpdateSettings}
        onToggleSound={handleToggleSound}
        onReplayTutorial={() => setIsTutorialOpen(true)}
        onReturnToStart={() => {
          setStartTab('home');
          setIsStartOpen(true);
        }}
        onOpenCosmetics={() => {
          setStartTab('cosmetics');
          setIsStartOpen(true);
        }}
        pwa={pwa}
      />

      {/* 4-Step Adaptive Interactive Tutorial */}
      <Tutorial
        isOpen={isTutorialOpen}
        isTouchDevice={hudSnapshot.isTouchDevice}
        onFinish={handleFinishTutorial}
      />

      {/* Station Modal */}
      {activeView === 'map' && activeStation && activeChapter && (
        <StationModal
          station={activeStation}
          chapter={activeChapter}
          stationState={progress.stations[activeStation.id]}
          initialFactId={initialFactId}
          onClose={() => setActiveStationId(null)}
          onCompleteCard={handleCompleteCard}
          onHighlightPart={(partIdx) =>
            sceneRef.current?.setActiveStationHighlight(activeStation.id, partIdx)
          }
          onCompleteChallenge={handleCompleteChallenge}
          onSelectStation={(stId) => handleOpenStation(stId)}
        />
      )}

      {/* Secondary Views */}
      {activeView === 'bank' && (
        <BookletQuizView
          quizAnswers={progress.quizAnswers}
          onAnswerObjective={handleAnswerObjective}
          onJumpToFact={handleOpenStation}
        />
      )}

      {activeView === 'review' && (
        <ReviewView
          factStates={progress.facts}
          dailySchedule={dailySchedule}
          onRecordReview={handleRecordReview}
          onJumpToFact={handleOpenStation}
        />
      )}

      {activeView === 'achievements' && <AchievementsView progress={progress} />}
    </div>
  );
};
