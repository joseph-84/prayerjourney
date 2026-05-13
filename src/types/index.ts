// ── 기도문 ────────────────────────────────────────────────────────
export interface StoredPrayer {
  id: string;
  title: string;
  content: string;
  category: string;
  isFavorite: boolean;
  isDeleted: boolean;
  source: 'static' | 'user' | 'bible';
  createdAt: string;
  updatedAt: string;
}

// ── 그룹 ──────────────────────────────────────────────────────────
export interface StoredGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  prayerIds: string[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── 오늘 목록 아이템 ───────────────────────────────────────────────
export interface TodayItem {
  id: string;
  instanceId: string; // 같은 기도문을 여러 번 추가할 때 구분
  type: 'prayer' | 'group';
  time: string;
  days: number[]; // 0=일, 1=월, ... 6=토 (빈 배열=매일)
}

// ── 완료 기록 ──────────────────────────────────────────────────────
export type CompletionMap = Record<string, string[]>; // { 'YYYY-MM-DD': prayerId[] }

// ── 매일 성경 ──────────────────────────────────────────────────────
export const BIBLE_PRAYER_IDS = ['bible-reading', 'bible-gospel'] as const;
export type BiblePrayerId = typeof BIBLE_PRAYER_IDS[number];
