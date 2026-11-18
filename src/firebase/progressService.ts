import { type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getRankForXp } from '../curriculum';
import { db, handleFirestoreError, OperationType } from './firebaseClient';

export interface UserProfileState {
  displayName: string;
  xp: number;
  rankIndex: number;
  bestStreak: number;
  currentStreak: number;
  totalCorrect: number;
  totalAnswered: number;
  completedCardsCount: number;
  soundEnabled: boolean;
}

export interface StationProgressState {
  stationId: string;
  chapterId: string;
  stars: number; // 0..3
  bestScore: number; // 0..100
  completedCardIds: string[];
  challengePassed: boolean;
}

export interface FactMasteryState {
  factId: string;
  chapterId: string;
  masteryLevel: number; // 0..3
  wrongCount: number;
  correctCount: number;
  nextReviewAtMs: number;
}

export interface BookletQuizAnswerState {
  questionId: string;
  chapterId: string;
  isCorrect: boolean;
  selectedIndex: number;
}

export interface StudentProgressSnapshot {
  profile: UserProfileState;
  stations: Record<string, StationProgressState>;
  facts: Record<string, FactMasteryState>;
  quizAnswers: Record<string, BookletQuizAnswerState>;
  achievements: string[];
}

const LOCAL_STORAGE_KEY = 'minnah_academy_progress_v1';

export function createInitialProgress(displayName = 'طالب العلم'): StudentProgressSnapshot {
  return {
    profile: {
      displayName,
      xp: 0,
      rankIndex: 0,
      bestStreak: 0,
      currentStreak: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      completedCardsCount: 0,
      soundEnabled: true,
    },
    stations: {},
    facts: {},
    quizAnswers: {},
    achievements: [],
  };
}

export function loadLocalProgress(): StudentProgressSnapshot {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return createInitialProgress();
    const parsed = JSON.parse(raw) as Partial<StudentProgressSnapshot>;
    const base = createInitialProgress();
    return {
      profile: { ...base.profile, ...(parsed.profile ?? {}) },
      stations: parsed.stations ?? {},
      facts: parsed.facts ?? {},
      quizAnswers: parsed.quizAnswers ?? {},
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    };
  } catch {
    return createInitialProgress();
  }
}

export function saveLocalProgress(snapshot: StudentProgressSnapshot): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors
  }
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function sanitizeDisplayName(name: string | null | undefined): string {
  const trimmed = (name || 'طالب العلم').trim();
  if (!trimmed) return 'طالب العلم';
  return trimmed.slice(0, 96);
}

export async function ensureCloudUserProfile(
  user: User,
  profile: UserProfileState
): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const existingSnap = await getDoc(userRef);
    const rankIdx = clamp(getRankForXp(profile.xp).index, 0, 10);
    const payload = {
      displayName: sanitizeDisplayName(profile.displayName || user.displayName),
      xp: clamp(Math.round(profile.xp), 0, 1000000),
      rankIndex: rankIdx,
      bestStreak: clamp(Math.round(profile.bestStreak), 0, 10000),
      currentStreak: clamp(Math.round(profile.currentStreak), 0, 10000),
      totalCorrect: clamp(Math.round(profile.totalCorrect), 0, 100000),
      totalAnswered: clamp(Math.round(profile.totalAnswered), 0, 100000),
      completedCardsCount: clamp(Math.round(profile.completedCardsCount), 0, 500),
      soundEnabled: Boolean(profile.soundEnabled),
    };

    if (!existingSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function saveCloudStationProgress(
  user: User,
  st: StationProgressState
): Promise<void> {
  const path = `users/${user.uid}/stationStates/${st.stationId}`;
  const ref = doc(db, 'users', user.uid, 'stationStates', st.stationId);
  try {
    const snap = await getDoc(ref);
    const completedCardIds = st.completedCardIds.slice(0, 30);
    const stars = clamp(Math.round(st.stars), 0, 3);
    const bestScore = clamp(Math.round(st.bestScore), 0, 100);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: user.uid,
        stationId: st.stationId,
        chapterId: st.chapterId,
        stars,
        bestScore,
        completedCardIds,
        challengePassed: Boolean(st.challengePassed),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        stars,
        bestScore,
        completedCardIds,
        challengePassed: Boolean(st.challengePassed),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCloudFactMastery(
  user: User,
  fact: FactMasteryState
): Promise<void> {
  const path = `users/${user.uid}/factStates/${fact.factId}`;
  const ref = doc(db, 'users', user.uid, 'factStates', fact.factId);
  try {
    const snap = await getDoc(ref);
    const payload = {
      masteryLevel: clamp(Math.round(fact.masteryLevel), 0, 3),
      wrongCount: clamp(Math.round(fact.wrongCount), 0, 1000),
      correctCount: clamp(Math.round(fact.correctCount), 0, 1000),
      nextReviewAtMs: Math.max(0, Math.round(fact.nextReviewAtMs)),
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: user.uid,
        factId: fact.factId,
        chapterId: fact.chapterId,
        ...payload,
      });
    } else {
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCloudQuizAnswer(
  user: User,
  ans: BookletQuizAnswerState
): Promise<void> {
  const path = `users/${user.uid}/quizAnswers/${ans.questionId}`;
  const ref = doc(db, 'users', user.uid, 'quizAnswers', ans.questionId);
  try {
    const snap = await getDoc(ref);
    const payload = {
      isCorrect: Boolean(ans.isCorrect),
      selectedIndex: clamp(Math.round(ans.selectedIndex), -1, 10),
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: user.uid,
        questionId: ans.questionId,
        chapterId: ans.chapterId,
        ...payload,
      });
    } else {
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCloudAchievement(
  user: User,
  achievementId: string
): Promise<void> {
  const path = `users/${user.uid}/achievements/${achievementId}`;
  const ref = doc(db, 'users', user.uid, 'achievements', achievementId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: user.uid,
        achievementId,
        unlockedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

import {
  createInitialPlayerGameState,
  getTodayDateKey,
  PlayerGameState,
  STARTER_COSMETIC_IDS,
} from '../game/types';

export async function loadAndMergeCloudProgress(
  user: User,
  localSnapshot: StudentProgressSnapshot
): Promise<StudentProgressSnapshot> {
  const uid = user.uid;
  const basePath = `users/${uid}`;

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    const cloudStations: Record<string, StationProgressState> = {};
    const cloudFacts: Record<string, FactMasteryState> = {};
    const cloudQuiz: Record<string, BookletQuizAnswerState> = {};
    const cloudAchievements = new Set<string>();

    if (userSnap.exists()) {
      const stationsSnap = await getDocs(
        query(collection(db, 'users', uid, 'stationStates'), where('ownerId', '==', uid))
      );
      stationsSnap.forEach((d) => {
        const data = d.data();
        cloudStations[d.id] = {
          stationId: String(data.stationId ?? d.id),
          chapterId: String(data.chapterId ?? ''),
          stars: Number(data.stars ?? 0),
          bestScore: Number(data.bestScore ?? 0),
          completedCardIds: Array.isArray(data.completedCardIds) ? data.completedCardIds : [],
          challengePassed: Boolean(data.challengePassed),
        };
      });

      const factsSnap = await getDocs(
        query(collection(db, 'users', uid, 'factStates'), where('ownerId', '==', uid))
      );
      factsSnap.forEach((d) => {
        const data = d.data();
        cloudFacts[d.id] = {
          factId: String(data.factId ?? d.id),
          chapterId: String(data.chapterId ?? ''),
          masteryLevel: Number(data.masteryLevel ?? 0),
          wrongCount: Number(data.wrongCount ?? 0),
          correctCount: Number(data.correctCount ?? 0),
          nextReviewAtMs: Number(data.nextReviewAtMs ?? 0),
        };
      });

      const quizSnap = await getDocs(
        query(collection(db, 'users', uid, 'quizAnswers'), where('ownerId', '==', uid))
      );
      quizSnap.forEach((d) => {
        const data = d.data();
        cloudQuiz[d.id] = {
          questionId: String(data.questionId ?? d.id),
          chapterId: String(data.chapterId ?? ''),
          isCorrect: Boolean(data.isCorrect),
          selectedIndex: Number(data.selectedIndex ?? -1),
        };
      });

      const achSnap = await getDocs(
        query(collection(db, 'users', uid, 'achievements'), where('ownerId', '==', uid))
      );
      achSnap.forEach((d) => {
        cloudAchievements.add(d.id);
      });
    }

    // Merge local and cloud keeping highest progress
    const mergedStations: Record<string, StationProgressState> = { ...cloudStations };
    const stationsToPush: StationProgressState[] = [];
    for (const [stId, localSt] of Object.entries(localSnapshot.stations)) {
      const c = mergedStations[stId];
      if (!c) {
        mergedStations[stId] = localSt;
        stationsToPush.push(localSt);
      } else {
        const unionCards = Array.from(
          new Set([...c.completedCardIds, ...localSt.completedCardIds])
        );
        const merged: StationProgressState = {
          stationId: stId,
          chapterId: c.chapterId || localSt.chapterId,
          stars: Math.max(c.stars, localSt.stars),
          bestScore: Math.max(c.bestScore, localSt.bestScore),
          completedCardIds: unionCards,
          challengePassed: c.challengePassed || localSt.challengePassed,
        };
        mergedStations[stId] = merged;
        if (
          merged.stars > c.stars ||
          merged.bestScore > c.bestScore ||
          merged.completedCardIds.length > c.completedCardIds.length ||
          (merged.challengePassed && !c.challengePassed)
        ) {
          stationsToPush.push(merged);
        }
      }
    }

    const mergedFacts: Record<string, FactMasteryState> = { ...cloudFacts };
    const factsToPush: FactMasteryState[] = [];
    for (const [fId, localFact] of Object.entries(localSnapshot.facts)) {
      const c = mergedFacts[fId];
      if (!c) {
        mergedFacts[fId] = localFact;
        factsToPush.push(localFact);
      } else {
        const merged: FactMasteryState = {
          factId: fId,
          chapterId: c.chapterId || localFact.chapterId,
          masteryLevel: Math.max(c.masteryLevel, localFact.masteryLevel),
          wrongCount: Math.max(c.wrongCount, localFact.wrongCount),
          correctCount: Math.max(c.correctCount, localFact.correctCount),
          nextReviewAtMs: Math.max(c.nextReviewAtMs, localFact.nextReviewAtMs),
        };
        mergedFacts[fId] = merged;
        if (
          merged.masteryLevel > c.masteryLevel ||
          merged.correctCount > c.correctCount ||
          merged.wrongCount > c.wrongCount
        ) {
          factsToPush.push(merged);
        }
      }
    }

    const mergedQuiz: Record<string, BookletQuizAnswerState> = { ...cloudQuiz };
    const quizToPush: BookletQuizAnswerState[] = [];
    for (const [qId, localAns] of Object.entries(localSnapshot.quizAnswers)) {
      const c = mergedQuiz[qId];
      if (!c || (localAns.isCorrect && !c.isCorrect)) {
        mergedQuiz[qId] = localAns;
        quizToPush.push(localAns);
      }
    }

    const achievementsToPush: string[] = [];
    for (const achId of localSnapshot.achievements) {
      if (!cloudAchievements.has(achId)) {
        cloudAchievements.add(achId);
        achievementsToPush.push(achId);
      }
    }

    const cloudProfileData = userSnap.exists() ? userSnap.data() : null;
    const mergedXp = Math.max(
      Number(cloudProfileData?.xp ?? 0),
      localSnapshot.profile.xp
    );
    const mergedCompletedCards = new Set<string>();
    Object.values(mergedStations).forEach((s) =>
      s.completedCardIds.forEach((cid) => mergedCompletedCards.add(cid))
    );

    const mergedProfile: UserProfileState = {
      displayName: sanitizeDisplayName(
        user.displayName || String(cloudProfileData?.displayName ?? localSnapshot.profile.displayName)
      ),
      xp: mergedXp,
      rankIndex: getRankForXp(mergedXp).index,
      bestStreak: Math.max(
        Number(cloudProfileData?.bestStreak ?? 0),
        localSnapshot.profile.bestStreak
      ),
      currentStreak: Math.max(
        Number(cloudProfileData?.currentStreak ?? 0),
        localSnapshot.profile.currentStreak
      ),
      totalCorrect: Math.max(
        Number(cloudProfileData?.totalCorrect ?? 0),
        localSnapshot.profile.totalCorrect
      ),
      totalAnswered: Math.max(
        Number(cloudProfileData?.totalAnswered ?? 0),
        localSnapshot.profile.totalAnswered
      ),
      completedCardsCount: Math.max(
        mergedCompletedCards.size,
        Number(cloudProfileData?.completedCardsCount ?? 0),
        localSnapshot.profile.completedCardsCount
      ),
      soundEnabled:
        cloudProfileData?.soundEnabled !== undefined
          ? Boolean(cloudProfileData.soundEnabled)
          : localSnapshot.profile.soundEnabled,
    };

    // Parent user doc MUST exist before subcollection writes!
    await ensureCloudUserProfile(user, mergedProfile);

    await Promise.all([
      ...stationsToPush.map((s) => saveCloudStationProgress(user, s)),
      ...factsToPush.map((f) => saveCloudFactMastery(user, f)),
      ...quizToPush.map((q) => saveCloudQuizAnswer(user, q)),
      ...achievementsToPush.map((a) => saveCloudAchievement(user, a)),
    ]);

    const mergedSnapshot: StudentProgressSnapshot = {
      profile: mergedProfile,
      stations: mergedStations,
      facts: mergedFacts,
      quizAnswers: mergedQuiz,
      achievements: Array.from(cloudAchievements),
    };
    saveLocalProgress(mergedSnapshot);
    return mergedSnapshot;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, basePath);
    return localSnapshot;
  }
}

const GAME_STATE_STORAGE_KEY = 'minnah_player_game_state_v1';

function normalizeDailyRollover(state: PlayerGameState): PlayerGameState {
  const today = getTodayDateKey();
  let dailyStreakDays = Math.max(1, state.dailyStreakDays || 1);
  let lastActiveDate = state.lastActiveDate || today;

  if (lastActiveDate !== today) {
    const prevMs = Date.parse(`${lastActiveDate}T00:00:00`);
    const todayMs = Date.parse(`${today}T00:00:00`);
    const diffDays = Number.isFinite(prevMs) && Number.isFinite(todayMs)
      ? Math.round((todayMs - prevMs) / (24 * 60 * 60 * 1000))
      : 0;
    dailyStreakDays = diffDays === 1 ? dailyStreakDays + 1 : 1;
    lastActiveDate = today;
  }

  const resetChallenge = state.dailyChallenge.dateKey !== today;
  const resetStars = state.collectedStarsDate !== today;

  return {
    ...state,
    dailyStreakDays,
    lastActiveDate,
    dailyChallenge: resetChallenge
      ? { dateKey: today, targetActions: 3, completedActions: 0, claimed: false }
      : state.dailyChallenge,
    collectedStarsDate: today,
    collectedStarIdsToday: resetStars ? [] : state.collectedStarIdsToday,
  };
}

export function loadLocalPlayerGameState(): PlayerGameState {
  const base = createInitialPlayerGameState();
  try {
    const raw = localStorage.getItem(GAME_STATE_STORAGE_KEY);
    if (!raw) return normalizeDailyRollover(base);
    const parsed = JSON.parse(raw) as Partial<PlayerGameState>;
    const merged: PlayerGameState = {
      ...base,
      ...parsed,
      avatar: { ...base.avatar, ...(parsed.avatar ?? {}) },
      lastPos: { ...base.lastPos, ...(parsed.lastPos ?? {}) },
      dailyChallenge: { ...base.dailyChallenge, ...(parsed.dailyChallenge ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      unlockedCosmeticIds: Array.from(
        new Set([...STARTER_COSMETIC_IDS, ...(parsed.unlockedCosmeticIds ?? [])])
      ),
      collectedStarIdsToday: Array.isArray(parsed.collectedStarIdsToday)
        ? parsed.collectedStarIdsToday
        : [],
    };
    return normalizeDailyRollover(merged);
  } catch {
    return normalizeDailyRollover(base);
  }
}

export function saveLocalPlayerGameState(state: PlayerGameState): void {
  try {
    localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

function buildCloudGameStatePayload(uid: string, s: PlayerGameState) {
  return {
    ownerId: uid,
    stateId: 'player',
    hasStartedOnce: Boolean(s.hasStartedOnce),
    gender: s.avatar.gender === 'girl' ? 'girl' : 'boy',
    robeColorId: (s.avatar.robeColorId || 'robe_ivory').slice(0, 48),
    satchelColorId: (s.avatar.satchelColorId || 'satchel_leather').slice(0, 48),
    companionColorId: (s.avatar.companionColorId || 'orb_gold').slice(0, 48),
    cosmeticStars: clamp(Math.round(s.cosmeticStars), 0, 10000),
    unlockedCosmeticIds: Array.from(new Set(s.unlockedCosmeticIds)).slice(0, 40),
    posX: clamp(Number(s.lastPos.x) || 0, -200, 200),
    posY: clamp(Number(s.lastPos.y) || 0.75, -50, 100),
    posZ: clamp(Number(s.lastPos.z) || 4.1, -200, 200),
    posYaw: clamp(Number(s.lastPos.yaw) || Math.PI, -20, 20),
    dailyStreakDays: clamp(Math.round(s.dailyStreakDays), 0, 10000),
    lastActiveDate: (s.lastActiveDate || getTodayDateKey()).slice(0, 20),
    dailyChallengeDate: (s.dailyChallenge.dateKey || getTodayDateKey()).slice(0, 20),
    dailyChallengeCompleted: clamp(Math.round(s.dailyChallenge.completedActions), 0, 100),
    dailyChallengeClaimed: Boolean(s.dailyChallenge.claimed),
    collectedStarsDate: (s.collectedStarsDate || getTodayDateKey()).slice(0, 20),
    collectedStarIdsToday: Array.from(new Set(s.collectedStarIdsToday)).slice(0, 40),
    volume: clamp(Number(s.settings.volume), 0, 1),
    cameraSensitivity: clamp(Number(s.settings.cameraSensitivity), 0.3, 3),
    quality: (['auto', 'low', 'medium', 'high'].includes(s.settings.quality)
      ? s.settings.quality
      : 'auto') as 'auto' | 'low' | 'medium' | 'high',
    mobileButtonSize: (s.settings.mobileButtonSize === 'large' ? 'large' : 'normal') as
      | 'normal'
      | 'large',
    leftHanded: Boolean(s.settings.leftHanded),
    fontSize: (s.settings.fontSize === 'large' ? 'large' : 'normal') as 'normal' | 'large',
    reducedMotion: Boolean(s.settings.reducedMotion),
    highContrast: Boolean(s.settings.highContrast),
    tutorialCompleted: Boolean(s.settings.tutorialCompleted),
  };
}

export async function saveCloudPlayerGameState(
  user: User,
  state: PlayerGameState
): Promise<void> {
  const path = `users/${user.uid}/gameState/player`;
  const ref = doc(db, 'users', user.uid, 'gameState', 'player');
  try {
    const snap = await getDoc(ref);
    const full = buildCloudGameStatePayload(user.uid, state);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...full,
        updatedAt: serverTimestamp(),
      });
    } else {
      const { ownerId: _o, stateId: _s, ...updatable } = full;
      await updateDoc(ref, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadAndMergeCloudPlayerGameState(
  user: User,
  localState: PlayerGameState
): Promise<PlayerGameState> {
  const path = `users/${user.uid}/gameState/player`;
  try {
    const ref = doc(db, 'users', user.uid, 'gameState', 'player');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await saveCloudPlayerGameState(user, localState);
      return localState;
    }

    const d = snap.data();
    const today = getTodayDateKey();
    const sameStarDate = String(d.collectedStarsDate ?? '') === today;
    const sameChallengeDate = String(d.dailyChallengeDate ?? '') === today;

    const merged: PlayerGameState = normalizeDailyRollover({
      hasStartedOnce: Boolean(d.hasStartedOnce) || localState.hasStartedOnce,
      avatar: {
        gender: d.gender === 'girl' ? 'girl' : localState.avatar.gender,
        robeColorId: String(d.robeColorId ?? localState.avatar.robeColorId),
        satchelColorId: String(d.satchelColorId ?? localState.avatar.satchelColorId),
        companionColorId: String(d.companionColorId ?? localState.avatar.companionColorId),
      },
      cosmeticStars: Math.max(Number(d.cosmeticStars ?? 0), localState.cosmeticStars),
      unlockedCosmeticIds: Array.from(
        new Set([
          ...STARTER_COSMETIC_IDS,
          ...(Array.isArray(d.unlockedCosmeticIds) ? d.unlockedCosmeticIds : []),
          ...localState.unlockedCosmeticIds,
        ])
      ),
      lastPos:
        d.posX !== undefined && d.posZ !== undefined
          ? {
              x: Number(d.posX),
              y: Number(d.posY ?? 0.75),
              z: Number(d.posZ),
              yaw: Number(d.posYaw ?? Math.PI),
            }
          : localState.lastPos,
      dailyStreakDays: Math.max(Number(d.dailyStreakDays ?? 1), localState.dailyStreakDays),
      lastActiveDate: String(d.lastActiveDate ?? localState.lastActiveDate),
      dailyChallenge: sameChallengeDate
        ? {
            dateKey: today,
            targetActions: 3,
            completedActions: Math.max(
              Number(d.dailyChallengeCompleted ?? 0),
              localState.dailyChallenge.completedActions
            ),
            claimed: Boolean(d.dailyChallengeClaimed) || localState.dailyChallenge.claimed,
          }
        : localState.dailyChallenge,
      collectedStarsDate: today,
      collectedStarIdsToday: sameStarDate
        ? Array.from(
            new Set([
              ...(Array.isArray(d.collectedStarIdsToday) ? d.collectedStarIdsToday : []),
              ...localState.collectedStarIdsToday,
            ])
          )
        : localState.collectedStarIdsToday,
      settings: {
        volume: d.volume !== undefined ? Number(d.volume) : localState.settings.volume,
        cameraSensitivity:
          d.cameraSensitivity !== undefined
            ? Number(d.cameraSensitivity)
            : localState.settings.cameraSensitivity,
        quality: (['auto', 'low', 'medium', 'high'].includes(String(d.quality))
          ? String(d.quality)
          : localState.settings.quality) as PlayerGameState['settings']['quality'],
        mobileButtonSize:
          d.mobileButtonSize === 'large'
            ? 'large'
            : localState.settings.mobileButtonSize,
        leftHanded:
          d.leftHanded !== undefined ? Boolean(d.leftHanded) : localState.settings.leftHanded,
        fontSize: d.fontSize === 'large' ? 'large' : localState.settings.fontSize,
        reducedMotion:
          d.reducedMotion !== undefined
            ? Boolean(d.reducedMotion)
            : localState.settings.reducedMotion,
        highContrast:
          d.highContrast !== undefined
            ? Boolean(d.highContrast)
            : localState.settings.highContrast,
        tutorialCompleted:
          Boolean(d.tutorialCompleted) || localState.settings.tutorialCompleted,
      },
    });

    saveLocalPlayerGameState(merged);
    await saveCloudPlayerGameState(user, merged);
    return merged;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return localState;
  }
}
