import { useState, useEffect } from 'react';
import { MMKV } from 'react-native-mmkv';

const bibleStorage = new MMKV({ id: 'maeum-gido-bible' });

// ── 타입 ───────────────────────────────────────────────────────────
export interface BibleSection {
  title: string;
  book: string;
  content: string;
}

export interface DailyBibleData {
  date: string;
  readings: BibleSection[];
  gospel: BibleSection | null;
  fetchedAt: string;
}

// ── 상수 ───────────────────────────────────────────────────────────
const BASE_URL = 'https://maria.catholic.or.kr/mi_pr/missa/missa.asp?menu=missa&gomonth=';
const CACHE_KEY = 'bible_cache';

// ── 유틸 ───────────────────────────────────────────────────────────
export function todayKSTString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildBibleUrl(date: string): string {
  return `${BASE_URL}${date}`;
}

// ── 캐시 ───────────────────────────────────────────────────────────
function getCache(date: string): DailyBibleData | null {
  try {
    const raw = bibleStorage.getString(CACHE_KEY);
    if (!raw) return null;
    const cached: DailyBibleData = JSON.parse(raw);
    return cached.date === date ? cached : null;
  } catch { return null; }
}

function setCache(data: DailyBibleData): void {
  try { bibleStorage.set(CACHE_KEY, JSON.stringify(data)); } catch {}
}

// ── HTML 파서 (텍스트 기반) ────────────────────────────────────────
function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function cleanLines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

function parseText(fullText: string): { readings: BibleSection[]; gospel: BibleSection | null } {
  const lines = cleanLines(fullText);
  const READING_RE = /^제\d+독서$/;
  const GOSPEL_RE = /^복음$/;
  const SKIP_RE = /^(화답송|복음 환호송|강론|본기도|예물기도|영성체송|신앙 고백|보편 지향|성찬 전례)$/;

  const markers: Array<{ idx: number; title: string; type: 'reading' | 'gospel' | 'skip' | 'end' }> = [];
  lines.forEach((line, idx) => {
    if (READING_RE.test(line))                   markers.push({ idx, title: line, type: 'reading' });
    else if (GOSPEL_RE.test(line))               markers.push({ idx, title: line, type: 'gospel'  });
    else if (SKIP_RE.test(line))                 markers.push({ idx, title: line, type: 'skip'    });
    else if (/^본기도$|^예물기도$/.test(line))   markers.push({ idx, title: line, type: 'end'     });
  });

  const readings: BibleSection[] = [];
  let gospel: BibleSection | null = null;

  for (let mi = 0; mi < markers.length; mi++) {
    const m = markers[mi];
    if (m.type !== 'reading' && m.type !== 'gospel') continue;

    const endIdx = mi + 1 < markers.length ? markers[mi + 1].idx : lines.length;
    const block = lines.slice(m.idx + 1, endIdx);

    let book = '';
    let contentStart = 0;
    for (let i = 0; i < Math.min(3, block.length); i++) {
      if (block[i].includes('말씀입니다') || block[i].includes('복음입니다') || block[i].includes('시편')) {
        book = block[i];
        contentStart = i + 1;
        break;
      }
    }

    let contentEnd = block.length;
    for (let i = block.length - 1; i >= contentStart; i--) {
      if (block[i].includes('주님의 말씀') || block[i].includes('주 예수님의 복음')) {
        contentEnd = i; break;
      }
    }

    const section: BibleSection = {
      title: m.title,
      book,
      content: block.slice(contentStart, contentEnd).join('\n').trim(),
    };

    if (m.type === 'gospel') gospel = section;
    else readings.push(section);
  }

  return { readings, gospel };
}

// ── Fetch ──────────────────────────────────────────────────────────
async function fetchDailyBible(date: string): Promise<DailyBibleData> {
  const url = buildBibleUrl(date);
  let html = '';

  const res = await fetch(url, {
    headers: { 'Accept': 'text/html' },
  });

  try {
    // EUC-KR 디코딩 시도
    const buf = await res.arrayBuffer();
    try {
      html = new TextDecoder('euc-kr').decode(buf);
    } catch {
      // Hermes가 euc-kr 미지원 시 UTF-8 폴백 (한글이 깨질 수 있음)
      html = new TextDecoder('utf-8').decode(buf);
    }
  } catch {
    html = await res.text();
  }

  const plainText = stripTags(html);
  const { readings, gospel } = parseText(plainText);
  const data: DailyBibleData = { date, readings, gospel, fetchedAt: new Date().toISOString() };
  setCache(data);
  return data;
}

// ── 훅 ────────────────────────────────────────────────────────────
export function useDailyBible() {
  const date = todayKSTString();

  const [data,    setData]    = useState<DailyBibleData | null>(() => getCache(date));
  const [loading, setLoading] = useState<boolean>(() => !getCache(date));
  const [error,   setError]   = useState<string | null>(null);

  const load = (d: string) => {
    setLoading(true); setError(null);
    fetchDailyBible(d)
      .then(r => { setData(r); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  };

  useEffect(() => {
    if (!getCache(date)) load(date);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return {
    data, loading, error,
    retry: () => load(date),
    url: buildBibleUrl(date),
    date,
  };
}
