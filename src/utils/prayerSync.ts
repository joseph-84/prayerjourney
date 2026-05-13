import { getPrayers, savePrayers, mmkv } from './storage';
import { StoredPrayer } from '../types';

// ── 서버 주소 ──────────────────────────────────────────────────────
const VERSION_URL = 'https://n8n.joseph84.freeddns.org/webhook/prayers/version';
const DATA_URL    = 'https://n8n.joseph84.freeddns.org/webhook/prayers/data';

// ── 저장 키 ────────────────────────────────────────────────────────
const SYNC_VERSION_KEY = 'mgido_prayer_version';

function getStoredVersion(): string {
  return mmkv.getString(SYNC_VERSION_KEY) ?? '';
}
function setStoredVersion(v: string): void {
  mmkv.set(SYNC_VERSION_KEY, v);
}

// ── 서버 응답 타입 ─────────────────────────────────────────────────
interface VersionResponse {
  version: string;   // e.g. "2.0.0"
  updatedAt: string;
}

// ── 결과 타입 ──────────────────────────────────────────────────────
export interface SyncResult {
  synced: boolean;
  version: string;
  addedCount: number;
  updatedCount: number;
}

function makeSignal(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

// ── 메인 동기화 함수 ───────────────────────────────────────────────
export async function syncPrayersFromServer(): Promise<SyncResult> {
  // 1. 버전 확인
  const vRes = await fetch(VERSION_URL, { signal: makeSignal(8000) });
  if (!vRes.ok) throw new Error(`version fetch failed: ${vRes.status}`);
  const { version: serverVersion } = await vRes.json() as VersionResponse;

  const storedVersion = getStoredVersion();
  if (serverVersion === storedVersion) {
    return { synced: false, version: serverVersion, addedCount: 0, updatedCount: 0 };
  }

  // 2. 기도문 데이터 가져오기
  const dRes = await fetch(DATA_URL, { signal: makeSignal(15000) });
  if (!dRes.ok) throw new Error(`data fetch failed: ${dRes.status}`);
  const serverPrayers = await dRes.json() as StoredPrayer[];

  if (!Array.isArray(serverPrayers) || serverPrayers.length === 0) {
    throw new Error('empty prayer data');
  }

  // 3. 로컬 기도문과 병합
  //    - user 기도문은 유지
  //    - static 기도문은 서버 버전으로 교체
  const local   = getPrayers();
  const localMap = new Map(local.map(p => [p.id, p]));

  let addedCount = 0, updatedCount = 0;

  for (const sp of serverPrayers) {
    const lp = localMap.get(sp.id);
    if (!lp) {
      // 신규 기도문
      localMap.set(sp.id, sp);
      addedCount++;
    } else if (lp.source === 'user') {
      // 사용자가 추가한 기도문은 건드리지 않음
    } else {
      // static 기도문: 서버 버전으로 교체
      localMap.set(sp.id, { ...sp, isFavorite: lp.isFavorite }); // 즐겨찾기 상태는 유지
      updatedCount++;
    }
  }

  // 4. 저장 및 버전 갱신
  savePrayers(Array.from(localMap.values()));
  setStoredVersion(serverVersion);

  console.info(`[prayerSync] synced v${serverVersion}: +${addedCount} added, ${updatedCount} updated`);
  return { synced: true, version: serverVersion, addedCount, updatedCount };
}
