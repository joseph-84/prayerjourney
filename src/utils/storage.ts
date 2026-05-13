import { MMKV } from 'react-native-mmkv';
import { StoredPrayer, StoredGroup, TodayItem, CompletionMap } from '../types';

export const mmkv = new MMKV({ id: 'maeum-gido' });

const KEYS = {
  PRAYERS:     'mgido_prayers',
  GROUPS:      'mgido_groups',
  COMPLETIONS: 'mgido_completions',
  TODAY_LIST:  'mgido_today_list',
} as const;

// ── MMKV 기반 get/set (localStorage와 동일한 인터페이스) ───────────
function get<T>(key: string): T | null {
  try {
    const raw = mmkv.getString(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function set<T>(key: string, value: T): void {
  try { mmkv.set(key, JSON.stringify(value)); }
  catch (e) { console.error('[storage] set error:', e); }
}
export function remove(key: string): void { mmkv.delete(key); }
export function clearAll(): void { mmkv.clearAll(); }

// ── 기도문 ────────────────────────────────────────────────────────
function normalizeContent(p: StoredPrayer): StoredPrayer {
  return { ...p, content: p.content.replace(/\\n/g, '\n') };
}

export function getPrayers(): StoredPrayer[] { return get<StoredPrayer[]>(KEYS.PRAYERS) ?? []; }
export function savePrayers(prayers: StoredPrayer[]): void { set(KEYS.PRAYERS, prayers); }

export function mergeStaticPrayers(staticList: StoredPrayer[]): StoredPrayer[] {
  const local = getPrayers();
  const localMap = new Map(local.map(p => [p.id, p]));

  for (const rawSp of staticList) {
    const sp = normalizeContent(rawSp);
    const lp = localMap.get(sp.id);
    if (!lp) {
      localMap.set(sp.id, sp);
    } else {
      const staticTime = new Date(sp.updatedAt).getTime();
      const localTime  = new Date(lp.updatedAt).getTime();
      if (staticTime > localTime) {
        localMap.set(sp.id, { ...sp, source: lp.source });
      }
    }
  }

  const merged = Array.from(localMap.values());
  savePrayers(merged);
  return merged;
}

// ── 그룹 ──────────────────────────────────────────────────────────
export function getGroups(): StoredGroup[] { return get<StoredGroup[]>(KEYS.GROUPS) ?? []; }
export function saveGroups(groups: StoredGroup[]): void { set(KEYS.GROUPS, groups); }

// ── 완료 기록 ──────────────────────────────────────────────────────
export function getCompletions(): CompletionMap { return get<CompletionMap>(KEYS.COMPLETIONS) ?? {}; }
export function saveCompletions(log: CompletionMap): void { set(KEYS.COMPLETIONS, log); }

// ── 오늘 목록 ──────────────────────────────────────────────────────
export function getTodayList(): TodayItem[] { return get<TodayItem[]>(KEYS.TODAY_LIST) ?? []; }
export function saveTodayList(list: TodayItem[]): void { set(KEYS.TODAY_LIST, list); }
