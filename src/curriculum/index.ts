import { CH2_ANGELS } from './ch2_angels';
import { CH3_MESSENGERS } from './ch3_messengers';
import { CH4_BOOKS } from './ch4_books';
import { CH5_LASTDAY } from './ch5_lastday';
import { CH6_QADAR } from './ch6_qadar';
import {
  AchievementDef,
  BookletObjectiveQuestion,
  Chapter,
  ChapterId,
  FactCard,
  RankDef,
  Station,
} from './types';

export * from './types';

export const CHAPTERS: Chapter[] = [
  CH2_ANGELS,
  CH3_MESSENGERS,
  CH4_BOOKS,
  CH5_LASTDAY,
  CH6_QADAR,
];

export const RANKS: RankDef[] = [
  {
    index: 0,
    title: 'طالب مبتدئ',
    minXp: 0,
    description: 'بداية الرحلة في أرخبيل المِنَّة وتعلّم أصول العقيدة.',
  },
  {
    index: 1,
    title: 'قارئ متأمّل',
    minXp: 250,
    description: 'أتقن أوائل البطاقات المعرفية وشرع في فحص الأدلة.',
  },
  {
    index: 2,
    title: 'حافظ البراهين',
    minXp: 650,
    description: 'يستحضر الآيات والأحاديث بأرقامها ودلالاتها الدقيقة.',
  },
  {
    index: 3,
    title: 'محقّق المسائل',
    minXp: 1200,
    description: 'يفرّق بين الإجماع والخلاف السائغ ومواطن التوقف الشرعي.',
  },
  {
    index: 4,
    title: 'فاحص الشبهات',
    minXp: 1900,
    description: 'يميز بين عقيدة أهل السنة وأقوال الفرق المخالفة بدقة.',
  },
  {
    index: 5,
    title: 'متقن الكراسة',
    minXp: 2800,
    description: 'استوعب غالب أبواب المنة وحلّ تدريباتها بإتقان.',
  },
  {
    index: 6,
    title: 'إمام راسخ',
    minXp: 3800,
    description: 'بلغ الذروة في حفظ وفهم أبواب كراسة المنة كاملة.',
  },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach_first_card',
    title: 'نور الفهم الأول',
    description: 'أتممت دراسة أول بطاقة علمية في الأكاديمية.',
    category: 'mastery',
    xpBonus: 25,
  },
  {
    id: 'ach_first_station',
    title: 'فاتح المحطة الأولى',
    description: 'أتقنت أول محطة بالكامل وتحدياتها التفاعلية.',
    category: 'mastery',
    xpBonus: 50,
  },
  {
    id: 'ach_streak_5',
    title: 'سلسلة اليقين (٥)',
    description: 'أجبت على ٥ أسئلة متتالية إجابة صحيحة دون خطأ.',
    category: 'streak',
    xpBonus: 40,
  },
  {
    id: 'ach_streak_12',
    title: 'رسوخ الحافظة (١٢)',
    description: 'حققت ١٢ إجابة صحيحة متتالية بدون أي تعثّر.',
    category: 'streak',
    xpBonus: 100,
  },
  {
    id: 'ach_streak_25',
    title: 'نجم التحقيق (٢٥)',
    description: 'سلسلة مذهلة من ٢٥ إجابة متتالية صحيحة!',
    category: 'streak',
    xpBonus: 180,
  },
  {
    id: 'ach_ch2_master',
    title: 'حارس جزيرة الملائكة',
    description: 'أتقنت جميع محطات الباب الثاني (الإيمان بالملائكة).',
    category: 'mastery',
    xpBonus: 120,
  },
  {
    id: 'ach_ch3_master',
    title: 'وارث هدي الرسل',
    description: 'أتقنت جميع محطات الباب الثالث (الإيمان بالرسل).',
    category: 'mastery',
    xpBonus: 140,
  },
  {
    id: 'ach_ch4_master',
    title: 'حافظ المخطوطات',
    description: 'أتقنت جميع محطات الباب الرابع (الإيمان بالكتب).',
    category: 'mastery',
    xpBonus: 140,
  },
  {
    id: 'ach_ch5_master',
    title: 'بصيرة الدار الآخرة',
    description: 'أتقنت جميع محطات الباب الخامس (الإيمان باليوم الآخر).',
    category: 'mastery',
    xpBonus: 150,
  },
  {
    id: 'ach_ch6_master',
    title: 'مُحكِم مراتب القدر',
    description: 'أتقنت جميع محطات الباب السادس (الإيمان بالقضاء والقدر).',
    category: 'mastery',
    xpBonus: 160,
  },
  {
    id: 'ach_pause_precision',
    title: 'منضبط في التوقف الشرعي',
    description: 'أتقنت مسائل التوقف (عزرائيل، رضوان، إسرافيل، الخضر، وصحف موسى).',
    category: 'precision',
    xpBonus: 110,
  },
  {
    id: 'ach_kasb_scholar',
    title: 'فاصل الخطاب في الكسب',
    description: 'ميّزت بدقة بين مذهب أهل السنة والأشاعرة والمعتزلة والجبرية.',
    category: 'precision',
    xpBonus: 110,
  },
  {
    id: 'ach_drills_25',
    title: 'باحث التدريبات (٢٥)',
    description: 'أجبت إجابة صحيحة على ٢٥ سؤالاً من بنك الكراسة الرسمي.',
    category: 'drills',
    xpBonus: 80,
  },
  {
    id: 'ach_drills_60',
    title: 'نصف الكراسة (٦٠)',
    description: 'أجبت إجابة صحيحة على ٦٠ سؤالاً من بنك الكراسة الرسمي.',
    category: 'drills',
    xpBonus: 150,
  },
  {
    id: 'ach_drills_120',
    title: 'خاتم بنك الكراسة (١٢٠/١٢٠)',
    description: 'أجبت إجابة صحيحة على جميع الأسئلة الموضوعية الـ ١٢٠ في الكراسة!',
    category: 'drills',
    xpBonus: 350,
  },
  {
    id: 'ach_smart_review_5',
    title: 'مثبّت المراجعة الذكية',
    description: 'راجعت ٥ بطاقات في صندوق المراجعة الذكية بنجاح.',
    category: 'precision',
    xpBonus: 70,
  },
  {
    id: 'ach_cards_all',
    title: 'مستوعب الكراسة',
    description: 'أتممت قراءة واستيعاب جميع البطاقات العلمية في الأبواب الخمسة.',
    category: 'mastery',
    xpBonus: 250,
  },
  {
    id: 'ach_grand_archipelago',
    title: 'عميد أكاديمية المِنَّة',
    description: 'أتقنت جميع محطات الجزر الخمس وبنك الكراسة الكامل.',
    category: 'mastery',
    xpBonus: 500,
  },
];

export const ALL_STATIONS: Station[] = CHAPTERS.flatMap((c) => c.stations);
export const ALL_FACTS: FactCard[] = ALL_STATIONS.flatMap((s) => s.facts);
export const ALL_OBJECTIVE_QUESTIONS: BookletObjectiveQuestion[] = CHAPTERS.flatMap(
  (c) => c.objectiveQuestions
);

export function getChapterById(id: ChapterId): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

export function getStationById(id: string): Station | undefined {
  return ALL_STATIONS.find((s) => s.id === id);
}

export function getFactById(id: string): FactCard | undefined {
  return ALL_FACTS.find((f) => f.id === id);
}

export function getRankForXp(xp: number): RankDef {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.minXp) current = r;
  }
  return current;
}

export function getNextRank(xp: number): RankDef | null {
  const current = getRankForXp(xp);
  return RANKS.find((r) => r.index === current.index + 1) ?? null;
}
