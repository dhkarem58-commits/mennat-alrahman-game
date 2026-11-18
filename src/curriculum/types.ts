export type ChapterId = 'ch2' | 'ch3' | 'ch4' | 'ch5' | 'ch6';

export interface FactTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface FactCard {
  id: string;
  chapterId: ChapterId;
  stationId: string;
  bookPage: number;
  title: string;
  summary: string;
  points?: string[];
  evidence?: {
    type: 'quran' | 'hadith' | 'athar';
    text: string;
    source: string;
  }[];
  scholarlyNote?: {
    label: string;
    text: string;
    tone: 'rule' | 'warning' | 'pause' | 'refutation';
  };
  table?: FactTable;
  highlightPartIndex?: number;
}

export interface McqChallenge {
  id: string;
  type: 'mcq' | 'boolean';
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  relatedFactId?: string;
}

export interface ClassifyChallenge {
  id: string;
  type: 'classify';
  prompt: string;
  categories: { id: string; label: string }[];
  items: { id: string; text: string; categoryId: string }[];
  explanation: string;
  relatedFactId?: string;
}

export interface OrderChallenge {
  id: string;
  type: 'order';
  prompt: string;
  items: { id: string; text: string }[]; // Correct order from index 0..n-1
  explanation: string;
  relatedFactId?: string;
}

export interface MatchChallenge {
  id: string;
  type: 'match';
  prompt: string;
  pairs: { id: string; left: string; right: string }[];
  explanation: string;
  relatedFactId?: string;
}

export type MiniChallenge =
  | McqChallenge
  | ClassifyChallenge
  | OrderChallenge
  | MatchChallenge;

export type LandmarkKind =
  | 'dome_observatory'
  | 'wings_monument'
  | 'throne_pillars'
  | 'house_mamur'
  | 'messenger_pillars'
  | 'paths_bridge'
  | 'shield_crest'
  | 'sects_tribunal'
  | 'scrolls_timeline'
  | 'manuscript_ark'
  | 'scales_wisdom'
  | 'miracle_prism'
  | 'twin_gardens'
  | 'trumpet_spire'
  | 'sirat_bridge'
  | 'intercession_gate'
  | 'signs_sundial'
  | 'tablet_pen'
  | 'will_rings'
  | 'causality_gears'
  | 'fruit_garden';

export interface Station {
  id: string;
  chapterId: ChapterId;
  order: number;
  title: string;
  subtitle: string;
  landmarkKind: LandmarkKind;
  offsetOnIsland: [number, number]; // local [x, z] relative to island center
  facts: FactCard[];
  challenges: MiniChallenge[];
}

export interface BookletObjectiveQuestion {
  id: string;
  chapterId: ChapterId;
  number: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  relatedFactId?: string;
}

export interface BookletEssayQuestion {
  id: string;
  chapterId: ChapterId;
  number: number;
  prompt: string;
  modelAnswerPoints: string[];
  evidenceRef?: string;
}

export interface Chapter {
  id: ChapterId;
  chapterNumber: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  pagesRange: string;
  accentHex: string;
  stoneHex: string;
  islandPos: [number, number, number];
  islandRadius: number;
  stations: Station[];
  objectiveQuestions: BookletObjectiveQuestion[];
  essayQuestions: BookletEssayQuestion[];
}

export interface RankDef {
  index: number;
  title: string;
  minXp: number;
  description: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: 'mastery' | 'drills' | 'streak' | 'precision';
  xpBonus: number;
}
