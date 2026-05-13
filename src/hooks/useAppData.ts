import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import {
  StoredPrayer, StoredGroup, TodayItem, CompletionMap, BIBLE_PRAYER_IDS,
} from '../types';
import {
  getPrayers, savePrayers, getGroups, saveGroups,
  getCompletions, saveCompletions, getTodayList, saveTodayList,
  mergeStaticPrayers,
} from '../utils/storage';
import { syncPrayersFromServer } from '../utils/prayerSync';
import staticJson from '../assets/prayers.json';

const staticPrayers = staticJson as StoredPrayer[];

// ── 매일 성경 가상 기도문 (스토리지에 저장 안 됨) ───────────────────
const BIBLE_VIRTUAL_PRAYERS: StoredPrayer[] = [
  {
    id: 'bible-reading', title: '오늘의 독서', content: '',
    category: '매일성경', source: 'bible',
    isFavorite: false, isDeleted: false,
    createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
  },
  {
    id: 'bible-gospel', title: '오늘의 복음', content: '',
    category: '매일성경', source: 'bible',
    isFavorite: false, isDeleted: false,
    createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
  },
];

// ── 유틸 ─────────────────────────────────────────────────────────
export function nowISO() { return new Date().toISOString(); }
export function genId(prefix = 'u') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Context ───────────────────────────────────────────────────────
export interface AppData {
  prayers:    StoredPrayer[];
  groups:     StoredGroup[];
  todayList:  TodayItem[];
  completions: CompletionMap;
  isLoading:  boolean;

  addPrayer:       (p: Omit<StoredPrayer, 'id' | 'source' | 'createdAt' | 'updatedAt'>) => void;
  updatePrayer:    (id: string, patch: Partial<StoredPrayer>) => void;
  deletePrayer:    (id: string) => void;
  toggleFavorite:  (id: string) => void;

  addGroup:        (g: Omit<StoredGroup, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateGroup:     (id: string, patch: Partial<StoredGroup>) => void;
  deleteGroup:     (id: string) => void;

  setTodayList:    (list: TodayItem[]) => void;
  toggleCompletion:(date: string, prayerId: string) => void;
  getCompletionsForDate: (date: string) => string[];
}

export const AppContext = createContext<AppData | null>(null);

export function useAppContext(): AppData {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext가 없습니다.');
  return ctx;
}

// ── 메인 훅 ───────────────────────────────────────────────────────
export function useAppData(): AppData {
  const [prayers,     setPrayers]    = useState<StoredPrayer[]>(() => mergeStaticPrayers(staticPrayers).filter(p => !p.isDeleted));
  const [groups,      setGroups]     = useState<StoredGroup[]>(() => getGroups().filter(g => !g.isDeleted));
  const [todayList,   setTodayListSt]= useState<TodayItem[]>(() => getTodayList());
  const [completions, setCompletions]= useState<CompletionMap>(() => getCompletions());
  const [isLoading,   setIsLoading]  = useState(false);

  useEffect(() => {
    (async () => {
      // 백그라운드 서버 동기화
      try {
        const result = await syncPrayersFromServer();
        if (result.synced) {
          const updated = getPrayers().filter(p => !p.isDeleted);
          setPrayers(updated);
        }
      } catch { /* 네트워크 없어도 무시 */ }
    })();
  }, []);

  const addPrayer = useCallback((input: Omit<StoredPrayer, 'id' | 'source' | 'createdAt' | 'updatedAt'>) => {
    const np: StoredPrayer = { ...input, id: genId('u'), source: 'user', createdAt: nowISO(), updatedAt: nowISO() };
    setPrayers(prev => {
      const next = [...prev, np];
      const all  = getPrayers();
      savePrayers([...all.filter(p => p.isDeleted), ...next]);
      return next;
    });
  }, []);

  const updatePrayer = useCallback((id: string, patch: Partial<StoredPrayer>) => {
    setPrayers(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch, updatedAt: nowISO() } : p);
      const all  = getPrayers();
      savePrayers([...all.filter(p => p.isDeleted), ...next]);
      return next;
    });
  }, []);

  const deletePrayer = useCallback((id: string) => {
    if (BIBLE_PRAYER_IDS.includes(id as any)) return;
    setPrayers(prev => {
      const next = prev.filter(p => p.id !== id);
      const all  = getPrayers();
      savePrayers(all.map(p => p.id === id ? { ...p, isDeleted: true, updatedAt: nowISO() } : p));
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setPrayers(prev => {
      const next = prev.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite, updatedAt: nowISO() } : p);
      const all  = getPrayers();
      savePrayers([...all.filter(p => p.isDeleted), ...next]);
      return next;
    });
  }, []);

  const addGroup = useCallback((input: Omit<StoredGroup, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ng: StoredGroup = { ...input, id: genId('g'), createdAt: nowISO(), updatedAt: nowISO() };
    setGroups(prev => { const next = [...prev, ng]; saveGroups(next); return next; });
  }, []);

  const updateGroup = useCallback((id: string, patch: Partial<StoredGroup>) => {
    setGroups(prev => {
      const next = prev.map(g => g.id === id ? { ...g, ...patch, updatedAt: nowISO() } : g);
      saveGroups(next);
      return next;
    });
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups(prev => { const next = prev.filter(g => g.id !== id); saveGroups(next); return next; });
  }, []);

  const setTodayList = useCallback((list: TodayItem[]) => {
    setTodayListSt(list); saveTodayList(list);
  }, []);

  const toggleCompletion = useCallback((date: string, prayerId: string) => {
    setCompletions(prev => {
      const cur  = prev[date] ?? [];
      const next = cur.includes(prayerId) ? cur.filter(x => x !== prayerId) : [...cur, prayerId];
      const updated = { ...prev, [date]: next };
      saveCompletions(updated);
      return updated;
    });
  }, []);

  const getCompletionsForDate = useCallback((date: string) => completions[date] ?? [], [completions]);

  const prayersWithBible = useMemo(
    () => [...BIBLE_VIRTUAL_PRAYERS, ...prayers],
    [prayers],
  );

  return {
    prayers: prayersWithBible, groups, todayList, completions, isLoading,
    addPrayer, updatePrayer, deletePrayer, toggleFavorite,
    addGroup, updateGroup, deleteGroup,
    setTodayList,
    toggleCompletion, getCompletionsForDate,
  };
}
