import { ChapterId } from '../curriculum';

export type AvatarGender = 'boy' | 'girl';
export type CameraMode = 'player' | 'orbit' | 'topdown';
export type QualityPreset = 'auto' | 'low' | 'medium' | 'high';
export type MobileButtonSize = 'normal' | 'large';
export type FontSizeScale = 'normal' | 'large';

export interface CosmeticSwatch {
  id: string;
  label: string;
  hex: string;
  cost: number;
}

export const ROBE_COLOR_OPTIONS: CosmeticSwatch[] = [
  { id: 'robe_ivory', label: 'عاجي وقور', hex: '#F3EFE4', cost: 0 },
  { id: 'robe_emerald', label: 'زمردي علمي', hex: '#1E6B47', cost: 0 },
  { id: 'robe_navy', label: 'كحلي ليلي', hex: '#233B5D', cost: 0 },
  { id: 'robe_sandstone', label: 'رملي دافئ', hex: '#A78B67', cost: 4 },
  { id: 'robe_plum', label: 'أرجواني هادئ', hex: '#5D3D6E', cost: 6 },
  { id: 'robe_olive', label: 'زيتوني رصين', hex: '#4B6342', cost: 8 },
];

export const SATCHEL_COLOR_OPTIONS: CosmeticSwatch[] = [
  { id: 'satchel_leather', label: 'جلد بني أصيل', hex: '#6E472B', cost: 0 },
  { id: 'satchel_gold', label: 'ذهبي مطرّز', hex: '#B98223', cost: 0 },
  { id: 'satchel_emerald', label: 'أخضر زمردي', hex: '#1B5E3F', cost: 4 },
  { id: 'satchel_burgundy', label: 'عنّابي تراثي', hex: '#7B2D26', cost: 6 },
];

export const COMPANION_COLOR_OPTIONS: CosmeticSwatch[] = [
  { id: 'orb_gold', label: 'نور ذهبي', hex: '#F6C453', cost: 0 },
  { id: 'orb_emerald', label: 'نور زمردي', hex: '#4ADE95', cost: 0 },
  { id: 'orb_sky', label: 'نور سماوي', hex: '#60BDF8', cost: 5 },
  { id: 'orb_amber', label: 'نور عنبري', hex: '#FB923C', cost: 7 },
];

export const STARTER_COSMETIC_IDS: string[] = [
  'robe_ivory',
  'robe_emerald',
  'robe_navy',
  'satchel_leather',
  'satchel_gold',
  'orb_gold',
  'orb_emerald',
];

export interface AvatarConfig {
  gender: AvatarGender;
  robeColorId: string;
  satchelColorId: string;
  companionColorId: string;
}

export interface GameSettings {
  volume: number; // 0..1
  cameraSensitivity: number; // 0.5..2.0
  quality: QualityPreset;
  mobileButtonSize: MobileButtonSize;
  leftHanded: boolean;
  fontSize: FontSizeScale;
  reducedMotion: boolean;
  highContrast: boolean;
  tutorialCompleted: boolean;
}

export interface PlayerPositionState {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface DailyChallengeState {
  dateKey: string;
  targetActions: number;
  completedActions: number;
  claimed: boolean;
}

export interface PlayerGameState {
  hasStartedOnce: boolean;
  avatar: AvatarConfig;
  cosmeticStars: number;
  unlockedCosmeticIds: string[];
  lastPos: PlayerPositionState;
  dailyStreakDays: number;
  lastActiveDate: string;
  dailyChallenge: DailyChallengeState;
  collectedStarIdsToday: string[];
  collectedStarsDate: string;
  settings: GameSettings;
}

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createInitialPlayerGameState(): PlayerGameState {
  const today = getTodayDateKey();
  return {
    hasStartedOnce: false,
    avatar: {
      gender: 'boy',
      robeColorId: 'robe_ivory',
      satchelColorId: 'satchel_leather',
      companionColorId: 'orb_gold',
    },
    cosmeticStars: 0,
    unlockedCosmeticIds: [...STARTER_COSMETIC_IDS],
    lastPos: { x: 0, y: 0.75, z: 4.1, yaw: Math.PI },
    dailyStreakDays: 1,
    lastActiveDate: today,
    dailyChallenge: {
      dateKey: today,
      targetActions: 3,
      completedActions: 0,
      claimed: false,
    },
    collectedStarIdsToday: [],
    collectedStarsDate: today,
    settings: {
      volume: 0.85,
      cameraSensitivity: 1.0,
      quality: 'auto',
      mobileButtonSize: 'normal',
      leftHanded: false,
      fontSize: 'normal',
      reducedMotion: false,
      highContrast: false,
      tutorialCompleted: false,
    },
  };
}

export interface InteractableTarget {
  kind: 'station' | 'review_portal';
  id: string;
  chapterId?: ChapterId;
  title: string;
  subtitle: string;
  distance: number;
}

export interface MinimapMarker {
  id: string;
  chapterId: ChapterId;
  title: string;
  x: number;
  z: number;
  status: 'unexplored' | 'in_progress' | 'mastered';
}

export interface QuestGuidanceState {
  targetChapterId: ChapterId;
  targetStationId: string | null;
  targetTitle: string;
  targetSubtitle: string;
  targetPos: { x: number; y: number; z: number };
  recommendedBridgeChapterId: ChapterId | null;
  compassAngleRad: number; // angle relative to camera/player heading
  distanceMeters: number;
  companionHint: string;
  reviewPortalActive: boolean;
}
