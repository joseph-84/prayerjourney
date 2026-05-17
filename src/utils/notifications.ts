import notifee, {
  AndroidImportance,
  AndroidCategory,
  RepeatFrequency,
  TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';
import { Alert, Platform } from 'react-native';
import { TodayItem, StoredPrayer, StoredGroup } from '../types';
import { mmkv, getPrayers, getGroups, getTodayList } from './storage';

// ── MMKV 키 ────────────────────────────────────────────────────────
const KEY_NOTIF_ENABLED  = 'notif_enabled';
const KEY_NOTIF_SOUND    = 'notif_sound';
const KEY_NOTIF_VIBRATE  = 'notif_vibrate';

export const ALARM_CHANNEL_ID = 'prayer-alarm';

// ── 설정 읽기/쓰기 ─────────────────────────────────────────────────
export function loadNotifSettings() {
  return {
    enabled: mmkv.getBoolean(KEY_NOTIF_ENABLED) ?? true,
    sound:   mmkv.getBoolean(KEY_NOTIF_SOUND)   ?? true,
    vibrate: mmkv.getBoolean(KEY_NOTIF_VIBRATE) ?? true,
  };
}
export function saveNotifSettings(enabled: boolean, sound: boolean, vibrate: boolean) {
  mmkv.set(KEY_NOTIF_ENABLED, enabled);
  mmkv.set(KEY_NOTIF_SOUND,   sound);
  mmkv.set(KEY_NOTIF_VIBRATE, vibrate);
}

// ── 권한 요청 ───────────────────────────────────────────────────────
export async function requestNotifPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
}

// ── 정확한 알람 권한 확인 및 요청 (Android 12+) ──────────────────────
export async function requestExactAlarmPermission(): Promise<void> {
  try {
    const settings = await notifee.getNotificationSettings();
    // android.alarm: 1 = ALLOWED, 0 = NOT_ALLOWED, -1 = NOT_SUPPORTED
    if ((settings.android as any).alarm === 0) {
      Alert.alert(
        '정확한 알람 권한 필요',
        '알람이 정확한 시간에 울리려면 "알람 및 리마인더" 권한이 필요합니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '설정으로 이동', onPress: () => notifee.openAlarmPermissionSettings() },
        ],
      );
    }
  } catch { /* 구버전 Android에서는 이 API가 없을 수 있음 */ }
}

// ── 즉시 테스트 알림 ────────────────────────────────────────────────
export async function sendTestNotification(): Promise<void> {
  try {
    // 1단계: 채널 생성
    const channelId = await notifee.createChannel({
      id:         'test-channel',
      name:       '테스트 알림',
      importance: AndroidImportance.HIGH,
    });

    // 2단계: 즉시 알림
    await notifee.displayNotification({
      title: '🙏 테스트 알림',
      body:  '알림이 정상적으로 작동합니다!',
      android: {
        channelId,
        importance:  AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
    });
  } catch (e: any) {
    Alert.alert('알림 오류', String(e?.message ?? e));
  }
}

// ── 채널 생성 ───────────────────────────────────────────────────────
export async function setupAlarmChannel(sound: boolean, vibrate: boolean) {
  await notifee.createChannel({
    id:               ALARM_CHANNEL_ID,
    name:             '기도 알림',
    importance:       AndroidImportance.HIGH,
    sound:            sound ? 'default' : undefined,
    vibration:        vibrate,
    vibrationPattern: vibrate ? [300, 400, 300, 400] : undefined,
    bypassDnd:        true,
  });
}

// ── 예약된 알림 모두 취소 ────────────────────────────────────────────
export async function cancelAllAlarms() {
  const scheduled = await notifee.getTriggerNotifications();
  await Promise.all(
    scheduled.map(n =>
      n.notification.id
        ? notifee.cancelTriggerNotification(n.notification.id)
        : Promise.resolve(),
    ),
  );
}

// ── 내부 헬퍼 ───────────────────────────────────────────────────────
function nextDailyOccurrence(hour: number, minute: number): number {
  const now = new Date();
  const t   = new Date();
  t.setHours(hour, minute, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t.getTime();
}

function nextWeeklyOccurrence(weekday: number, hour: number, minute: number): number {
  // weekday: 0=Sun … 6=Sat (same as Date.getDay())
  const now = new Date();
  const t   = new Date();
  t.setHours(hour, minute, 0, 0);
  let daysUntil = weekday - now.getDay();
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0 && t.getTime() <= now.getTime()) daysUntil = 7;
  t.setDate(t.getDate() + daysUntil);
  return t.getTime();
}

function resolveItemTitle(
  item: TodayItem,
  prayers: StoredPrayer[],
  groups: StoredGroup[],
): string {
  if (item.id === 'bible-reading') return '오늘의 독서';
  if (item.id === 'bible-gospel')  return '오늘의 복음';
  if (item.type === 'prayer') {
    return prayers.find(p => p.id === item.id)?.title ?? '기도 시간';
  }
  return groups.find(g => g.id === item.id)?.name ?? '기도 시간';
}

// ── 알람 스케줄링 ────────────────────────────────────────────────────
export async function scheduleAlarms(
  todayList: TodayItem[],
  prayers: StoredPrayer[],
  groups: StoredGroup[],
  sound: boolean,
  vibrate: boolean,
) {
  try {
    await setupAlarmChannel(sound, vibrate);
    await cancelAllAlarms();

    let count = 0;
    for (const item of todayList) {
      if (!item.time) continue;
      const parts = item.time.split(':').map(Number);
      const hh = parts[0] ?? 9;
      const mm = parts[1] ?? 0;
      if (isNaN(hh) || isNaN(mm)) continue;

      const body = resolveItemTitle(item, prayers, groups);

      if (item.days.length === 0) {
        // 매일 반복
        const trigger: TimestampTrigger = {
          type:            TriggerType.TIMESTAMP,
          timestamp:       nextDailyOccurrence(hh, mm),
          repeatFrequency: RepeatFrequency.DAILY,
          alarmManager:    { allowWhileIdle: true },
        };
        await notifee.createTriggerNotification(
          {
            id: `alarm-${item.instanceId}`,
            title: '🙏 기도 시간',
            body,
            android: {
              channelId:   ALARM_CHANNEL_ID,
              importance:  AndroidImportance.HIGH,
              pressAction: { id: 'default' },
              actions: [
                { title: '확인',          pressAction: { id: 'dismiss' } },
                { title: '다시알림 (5분)', pressAction: { id: 'snooze' } },
              ],
            },
          },
          trigger,
        );
        count++;
      } else {
        // 특정 요일마다 반복
        for (const dow of item.days) {
          const trigger: TimestampTrigger = {
            type:            TriggerType.TIMESTAMP,
            timestamp:       nextWeeklyOccurrence(dow, hh, mm),
            repeatFrequency: RepeatFrequency.WEEKLY,
            alarmManager:    { allowWhileIdle: true },
          };
          await notifee.createTriggerNotification(
            {
              id: `alarm-${item.instanceId}-d${dow}`,
              title: '🙏 기도 시간',
              body,
              android: {
                channelId:   ALARM_CHANNEL_ID,
                importance:  AndroidImportance.HIGH,
                pressAction: { id: 'default' },
                actions: [
                  { title: '확인',          pressAction: { id: 'dismiss' } },
                  { title: '다시알림 (5분)', pressAction: { id: 'snooze' } },
                ],
              },
            },
            trigger,
          );
          count++;
        }
      }
    }
    return count;
  } catch (e: any) {
    Alert.alert('알람 스케줄 오류', String(e?.message ?? e));
    return 0;
  }
}

// ── 다시알림 (스누즈) ─────────────────────────────────────────────
export async function snoozeAlarm(
  originalId: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    const trigger: TimestampTrigger = {
      type:         TriggerType.TIMESTAMP,
      timestamp:    Date.now() + 5 * 60 * 1000,   // 5분 후
      alarmManager: { allowWhileIdle: true },
    };
    await notifee.createTriggerNotification(
      {
        id: `snooze-${Date.now()}`,
        title,
        body: `${body} (다시알림)`,
        android: {
          channelId:   ALARM_CHANNEL_ID,
          importance:  AndroidImportance.HIGH,
          pressAction: { id: 'default' },
          actions: [
            { title: '확인',          pressAction: { id: 'dismiss' } },
            { title: '다시알림 (5분)', pressAction: { id: 'snooze' } },
          ],
        },
      },
      trigger,
    );
  } catch (e: any) {
    Alert.alert('다시알림 오류', String(e?.message ?? e));
  }
}

// ── 예약된 알림 개수 조회 ─────────────────────────────────────────
export async function getScheduledAlarmCount(): Promise<number> {
  const scheduled = await notifee.getTriggerNotifications();
  return scheduled.length;
}

// ── 배터리 최적화 관련 ────────────────────────────────────────────
/** 배터리 최적화가 켜져 있으면 true (Android 전용) */
export async function isBatteryOptimizationEnabled(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android') return false;
    return await notifee.isBatteryOptimizationEnabled();
  } catch { return false; }
}

/** 시스템 배터리 최적화 설정 화면 열기 */
export async function openBatterySettings(): Promise<void> {
  try {
    await notifee.openBatteryOptimizationSettings();
  } catch { /* 일부 구버전 Android에서 미지원 */ }
}

/**
 * OEM 전원 관리 설정 열기 (삼성·샤오미·화웨이 등)
 * 지원 기기에서만 동작하며, 미지원 기기에서는 무시됨
 */
export async function openPowerManagerSettings(): Promise<void> {
  try {
    await notifee.openPowerManagerSettings();
  } catch { /* 미지원 기기 무시 */ }
}

// ── 저장된 데이터 기반으로 알람 재스케줄 (Home 저장 후 호출용) ─────
export async function rescheduleFromStorage(): Promise<void> {
  const { enabled, sound, vibrate } = loadNotifSettings();
  if (!enabled) {
    await cancelAllAlarms();
    return;
  }
  const todayList = getTodayList();
  const prayers   = getPrayers();
  const groups    = getGroups();
  await scheduleAlarms(todayList, prayers, groups, sound, vibrate);
}
