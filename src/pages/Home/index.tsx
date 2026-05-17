import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable,
  Modal, TextInput, FlatList, Alert, useWindowDimensions,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { usePrayerFontSize } from '../../hooks/usePrayerFontSize';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '../../components/ScreenWrapper';
import TimePicker from '../../components/TimePicker';
import { BiblePrayerContent } from '../../components/BiblePrayerContent';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppContext, todayKey } from '../../hooks/useAppData';
import { buildBibleUrl } from '../../hooks/useDailyBible';
import { StoredPrayer, StoredGroup, TodayItem } from '../../types';
import { rescheduleFromStorage } from '../../utils/notifications';

const GREEN = '#2D5016';
const DAYS_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

// 독서/복음은 prayers 배열에 없는 가상 항목
const BIBLE_PICKER_ITEMS = [
  { id: 'bible-reading', title: '오늘의 독서', category: '매일성경' },
  { id: 'bible-gospel',  title: '오늘의 복음',  category: '매일성경' },
];

const CAT_COLORS: Record<string, string> = {
  '주요기도': '#4A9B6F', '묵주기도': '#E86B5E', '고해성사': '#A0522D',
  '성체성사': '#3A9BE8', '호칭기도': '#7B68EE', '여러가지기도': '#E8963A',
  '레지오마리애': '#9B4A9B', '매일성경': '#2D5016',
};
function catColor(cat: string) { return CAT_COLORS[cat] ?? '#8A8A8E'; }

function toKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function getFirstDow(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }
function formatTime12(time: string) {
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? '오후' : '오전';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${period} ${h12}:${String(mm).padStart(2, '0')}`;
}

// ── 기도문 상세 모달 ──────────────────────────────────────────────
const PrayerModal: React.FC<{ prayer: StoredPrayer; onClose: () => void }> = ({ prayer, onClose }) => {
  const { bottom } = useSafeAreaInsets();
  const { fontSize, pinchGesture } = usePrayerFontSize();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      {/* Modal은 GestureHandlerRootView 범위 밖 → 내부에 별도 선언 필요 */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={mod.bg}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[mod.sheet, { paddingBottom: Math.max(32, bottom + 16) }]}>
          <View style={mod.handle} />
          <View style={mod.header}>
            <View style={{ flex: 1 }}>
              <Text style={mod.title}>{prayer.title}</Text>
              <Text style={[mod.cat, { color: catColor(prayer.category) }]}>{prayer.category}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={mod.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          {/* 두 손가락 핀치로 글씨 크기 조절 */}
          <GestureDetector gesture={pinchGesture}>
            <View collapsable={false} style={{ flexShrink: 1 }}>
              {/* GHScrollView: GestureDetector 안에서 스크롤과 핀치가 충돌 없이 동작 */}
              <GHScrollView style={mod.body} showsVerticalScrollIndicator={false}>
                {prayer.source === 'bible'
                  ? <BiblePrayerContent prayerId={prayer.id} fontSize={fontSize} />
                  : <Text style={[mod.content, { fontSize, lineHeight: fontSize * 1.65 }]}>
                      {prayer.content.replace(/\\n/g, '\n')}
                    </Text>
                }
                <View style={{ height: 20 }} />
              </GHScrollView>
            </View>
          </GestureDetector>
          <TouchableOpacity style={mod.footerBtn} onPress={onClose}>
            <Text style={mod.footerBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

// ── 그룹 기도 목록 모달 ───────────────────────────────────────────
const GroupPrayerListModal: React.FC<{
  groupName: string;
  prayers: StoredPrayer[];
  onSelectPrayer: (p: StoredPrayer) => void;
  onClose: () => void;
}> = ({ groupName, prayers, onSelectPrayer, onClose }) => {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={mod.bg}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[mod.sheet, { paddingBottom: Math.max(32, bottom + 16) }]}>
          <View style={mod.handle} />
          <View style={mod.header}>
            <Text style={[mod.title, { flex: 1 }]}>{groupName}</Text>
            <TouchableOpacity onPress={onClose} style={mod.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          <Text style={mod.hint}>기도문을 눌러 내용을 확인하세요</Text>
          <ScrollView style={[mod.body, { flexShrink: 1 }]}>
            {prayers.map((p, idx) => (
              <TouchableOpacity key={p.id} style={gpm.row} onPress={() => onSelectPrayer(p)}>
                <Text style={gpm.num}>{idx + 1}</Text>
                <View style={[gpm.dot, { backgroundColor: catColor(p.category) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={gpm.ptitle}>{p.title}</Text>
                  <Text style={gpm.pcat}>{p.category}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#ccc" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── 홈 메인 ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const { bottom: bottomInset } = useSafeAreaInsets();
  // 달력 셀 크기: margin 16*2 + padding 16*2 = 64px, 7열
  const cellSize = Math.floor((screenWidth - 64) / 7);

  const { prayers, groups, todayList, setTodayList, toggleCompletion, getCompletionsForDate, isLoading } = useAppContext();

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1;
  const todayDate = now.getDate();
  const todayDow = now.getDay();

  const [calYear,  setCalYear]  = useState(todayYear);
  const [calMonth, setCalMonth] = useState(todayMonth);
  const [selDate,  setSelDate]  = useState(todayDate);

  // 모달 상태
  const [viewPrayer,  setViewPrayer]  = useState<StoredPrayer | null>(null);
  const [viewGroup,   setViewGroup]   = useState<{ name: string; prayers: StoredPrayer[] } | null>(null);
  const [showEditor,  setShowEditor]  = useState(false);
  const [showPicker,  setShowPicker]  = useState(false);

  // 편집기 상태
  const [editList,       setEditList]       = useState<TodayItem[]>([]);
  const [pickerSearch,   setPickerSearch]   = useState('');
  const [pickerTab,      setPickerTab]      = useState<'prayer' | 'group'>('prayer');
  const [timePickerIdx,  setTimePickerIdx]  = useState<number | null>(null);

  const isViewingToday = calYear === todayYear && calMonth === todayMonth && selDate === todayDate;
  const selectedKey = toKey(calYear, calMonth, selDate);

  // 오늘 요일 필터 적용
  const displayItems = useMemo(() =>
    todayList.filter(item => item.days.length === 0 || item.days.includes(todayDow)),
    [todayList, todayDow]
  );

  const resolveItem = useCallback((item: TodayItem) => {
    if (item.type === 'prayer') {
      const p = prayers.find(x => x.id === item.id);
      return { title: p?.title ?? '(삭제됨)', color: catColor(p?.category ?? ''), prayer: p ?? null, group: null };
    }
    const g = groups.find(x => x.id === item.id);
    const gPrayers = (g?.prayerIds ?? []).map(id => prayers.find(p => p.id === id)).filter(Boolean) as StoredPrayer[];
    return { title: g?.name ?? '(삭제됨)', color: g?.color ?? '#9B4A9B', prayer: null, group: g ? { name: g.name, prayers: gPrayers } : null };
  }, [prayers, groups]);

  const completedIds = getCompletionsForDate(selectedKey);
  const total = displayItems.length;
  const doneCount = displayItems.filter(item => completedIds.includes(item.instanceId || item.id)).length;
  const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;

  const getDotType = (date: number) => {
    const log = getCompletionsForDate(toKey(calYear, calMonth, date));
    if (!log.length || !total) return null;
    const n = displayItems.filter(item => log.includes(item.instanceId || item.id)).length;
    if (n === 0) return null;
    if (n >= total) return 'full';
    if (n >= Math.ceil(total / 2)) return 'half';
    return 'some';
  };

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
    setSelDate(1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
    setSelDate(1);
  };
  const goToday = () => { setCalYear(todayYear); setCalMonth(todayMonth); setSelDate(todayDate); };

  const handleItemClick = (item: TodayItem) => {
    const { prayer, group } = resolveItem(item);
    if (prayer) setViewPrayer(prayer);
    else if (group) setViewGroup(group);
  };

  const handleToggle = (item: TodayItem) => {
    const key = item.instanceId || item.id;
    toggleCompletion(selectedKey, key);
  };

  // 편집기
  const openEditor = () => { setEditList([...todayList]); setShowEditor(true); };
  const openPicker = () => { setPickerSearch(''); setPickerTab('prayer'); setShowPicker(true); };

  const addToList = (id: string, type: 'prayer' | 'group') => {
    const instanceId = `${id}_${Date.now()}`;
    setEditList(prev => [...prev, { id, instanceId, type, time: '09:00', days: [] }]);
    setShowPicker(false);
  };
  const removeItem = (instanceId: string) => setEditList(prev => prev.filter(x => x.instanceId !== instanceId));
  const moveUp = (idx: number) => setEditList(prev => {
    const a = [...prev];
    if (idx === 0) return a;
    [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]];
    return a;
  });
  const moveDown = (idx: number) => setEditList(prev => {
    const a = [...prev];
    if (idx === a.length - 1) return a;
    [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]];
    return a;
  });
  const updateTime = (idx: number, time: string) =>
    setEditList(prev => prev.map((x, i) => i === idx ? { ...x, time } : x));
  const saveEditor = () => {
    setTodayList(editList);
    setShowEditor(false);
    // 알림 재스케줄 (비동기 – 에러는 무시)
    rescheduleFromStorage().catch(() => {});
  };

  const filteredPrayers = useMemo(() => {
    const keyword = pickerSearch;
    const bibleItems = BIBLE_PICKER_ITEMS.filter(b =>
      !keyword || b.title.includes(keyword) || b.category.includes(keyword) || '성경'.includes(keyword)
    );
    const prayerItems = prayers.filter(p =>
      p.title.includes(keyword) || p.category.includes(keyword)
    );
    return [...bibleItems, ...prayerItems] as any[];
  }, [prayers, pickerSearch]);
  const filteredGroups = useMemo(() =>
    groups.filter(g => g.name.includes(pickerSearch)),
    [groups, pickerSearch]
  );

  if (isLoading) {
    return (
      <ScreenWrapper style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>불러오는 중…</Text>
        </View>
      </ScreenWrapper>
    );
  }

  // 달력 셀 데이터
  const firstDow = getFirstDow(calYear, calMonth);
  const daysInMonth = getDaysInMonth(calYear, calMonth);

  return (
    <ScreenWrapper statusBarColor={GREEN} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>기도여정</Text>
              <Text style={styles.headerDate}>
                {calYear}년 {calMonth}월 {selDate}일 · {DAYS_LABEL[new Date(calYear, calMonth - 1, selDate).getDay()]}요일
              </Text>
            </View>
            <View style={styles.headerRight}>
              {!isViewingToday && (
                <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
                  <Text style={styles.todayBtnText}>오늘로</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.editBtn} onPress={openEditor}>
                <Text style={styles.editBtnText}>편집</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 진행률 */}
        <View style={styles.progress}>
          <Text style={styles.progressLabel}>
            {isViewingToday ? '오늘의 기도 완료' : `${calMonth}월 ${selDate}일 기도 기록`}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
          <View style={styles.progressNums}>
            <Text style={styles.progressNumText}>{doneCount} / {total} 완료</Text>
            <Text style={styles.progressNumText}>{pct}%</Text>
          </View>
        </View>

        {/* 기도 목록 */}
        <Text style={styles.sectionLabel}>
          {isViewingToday ? '오늘 기도 목록' : `${calMonth}월 ${selDate}일`}
        </Text>
        <View style={styles.listArea}>
          {displayItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🙏</Text>
              <Text style={styles.emptyTitle}>기도 목록이 없어요</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openEditor}>
                <Text style={styles.emptyBtnText}>목록 편집하기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            displayItems.map(item => {
              const { title, color } = resolveItem(item);
              const key = item.instanceId || item.id;
              const isDone = completedIds.includes(key);
              return (
                <View key={item.instanceId} style={[styles.prayerItem, isDone && styles.prayerItemDone]}>
                  <TouchableOpacity style={styles.prayerItemMain} onPress={() => handleItemClick(item)}>
                    <View style={[styles.prayerDot, { backgroundColor: color }]} />
                    {item.type === 'group' && (
                      <View style={styles.groupTag}>
                        <Text style={styles.groupTagText}>그룹</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.prayerTitle, isDone && styles.prayerTitleDone]}>{title}</Text>
                      <Text style={styles.prayerMeta}>
                        {item.time || '시간 없음'} · {item.days.length === 0 ? '매일' : item.days.map(d => DAYS_LABEL[d]).join('·')}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#ccc" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.checkBtn, isDone && styles.checkBtnDone]}
                    onPress={() => handleToggle(item)}
                  >
                    <Text style={[styles.checkMark, isDone && styles.checkMarkDone]}>✓</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* 달력 */}
        <Text style={styles.sectionLabel}>기도 기록</Text>
        <View style={styles.calendar}>
          <View style={styles.calNav}>
            <TouchableOpacity style={styles.calNavBtn} onPress={prevMonth}>
              <Text style={styles.calNavBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calNavTitle}>{calYear}년 {calMonth}월</Text>
            <TouchableOpacity style={styles.calNavBtn} onPress={nextMonth}>
              <Text style={styles.calNavBtnText}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.calWeekRow}>
            {DAYS_LABEL.map(d => (
              <Text key={d} style={styles.calWeekLabel}>{d}</Text>
            ))}
          </View>
          <View style={styles.calGrid}>
            {Array.from({ length: firstDow }, (_, i) => (
              <View key={`e${i}`} style={[styles.calCell, { width: cellSize, height: cellSize }]} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const dot = getDotType(d);
              const isCur = calYear === todayYear && calMonth === todayMonth && d === todayDate;
              const isSel = d === selDate;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.calCell, { width: cellSize, height: cellSize }, isCur && !isSel && styles.calCellToday, isSel && styles.calCellSelected]}
                  onPress={() => setSelDate(d)}
                >
                  <Text style={[styles.calCellText, isCur && !isSel && styles.calCellTextToday, isSel && styles.calCellTextSelected]}>
                    {d}
                  </Text>
                  {dot && (
                    <View style={[
                      styles.calDot,
                      dot === 'full' && styles.calDotFull,
                      dot === 'half' && styles.calDotHalf,
                      dot === 'some' && styles.calDotSome,
                    ]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.calLegend}>
            <View style={styles.calLegendItem}>
              <View style={[styles.calDot, styles.calDotFull]} />
              <Text style={styles.calLegendText}>전체 완료</Text>
            </View>
            <View style={styles.calLegendItem}>
              <View style={[styles.calDot, styles.calDotHalf]} />
              <Text style={styles.calLegendText}>절반 이상</Text>
            </View>
            <View style={styles.calLegendItem}>
              <View style={[styles.calDot, styles.calDotSome]} />
              <Text style={styles.calLegendText}>일부 완료</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── 기도문 상세 모달 ── */}
      {viewPrayer && <PrayerModal prayer={viewPrayer} onClose={() => setViewPrayer(null)} />}

      {/* ── 그룹 기도 목록 모달 ── */}
      {viewGroup && !viewPrayer && (
        <GroupPrayerListModal
          groupName={viewGroup.name}
          prayers={viewGroup.prayers}
          onSelectPrayer={p => setViewPrayer(p)}
          onClose={() => setViewGroup(null)}
        />
      )}

      {/* ── 편집 모달 ── */}
      <Modal visible={showEditor} transparent animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <TouchableOpacity style={mod.bg} activeOpacity={1} onPress={() => setShowEditor(false)}>
          <TouchableOpacity style={[mod.sheet, { maxHeight: '85%', paddingBottom: Math.max(32, bottomInset + 16) }]} activeOpacity={1}>
            <View style={mod.handle} />
            <View style={mod.header}>
              <Text style={[mod.title, { flex: 1 }]}>기도 목록 편집</Text>
              <TouchableOpacity onPress={() => setShowEditor(false)} style={mod.closeBtn}>
                <MaterialCommunityIcons name="close" size={22} color="#999" />
              </TouchableOpacity>
            </View>
            <ScrollView style={mod.body} keyboardShouldPersistTaps="handled">
              {editList.length === 0 ? (
                <View style={ed.empty}>
                  <Text style={ed.emptyIcon}>📋</Text>
                  <Text style={ed.emptyText}>아직 항목이 없어요</Text>
                </View>
              ) : (
                editList.map((item, idx) => {
                  const isBible = item.id === 'bible-reading' || item.id === 'bible-gospel';
                  const label = isBible
                    ? (item.id === 'bible-gospel' ? '오늘의 복음' : '오늘의 독서')
                    : item.type === 'prayer'
                      ? (prayers.find(p => p.id === item.id)?.title ?? '(없음)')
                      : (groups.find(g => g.id === item.id)?.name ?? '(없음)');
                  const color = isBible ? GREEN
                    : item.type === 'prayer'
                      ? catColor(prayers.find(p => p.id === item.id)?.category ?? '')
                      : (groups.find(g => g.id === item.id)?.color ?? '#9B4A9B');
                  const tagLabel = isBible ? '성경' : item.type === 'group' ? '그룹' : '기도';
                  const tagColor = isBible ? '#2D5016' : item.type === 'group' ? '#9B4A9B' : '#3A9BE8';
                  return (
                    <View key={item.instanceId} style={ed.item}>
                      <View style={[ed.colorBar, { backgroundColor: color }]} />
                      <View style={{ flex: 1 }}>
                        <View style={ed.itemTop}>
                          <View style={[ed.tag, { backgroundColor: tagColor + '22' }]}>
                            <Text style={[ed.tagText, { color: tagColor }]}>{tagLabel}</Text>
                          </View>
                          <Text style={ed.itemLabel} numberOfLines={1}>{label}</Text>
                        </View>
                        <TouchableOpacity style={ed.timeBtn} onPress={() => setTimePickerIdx(idx)}>
                          <Text style={ed.timeBtnIcon}>⏰</Text>
                          <Text style={ed.timeBtnText}>{formatTime12(item.time || '09:00')}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={ed.controls}>
                        <TouchableOpacity
                          style={[ed.moveBtn, idx === 0 && ed.moveBtnDisabled]}
                          onPress={() => moveUp(idx)}
                          disabled={idx === 0}
                        >
                          <Text style={ed.moveBtnText}>↑</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[ed.moveBtn, idx === editList.length - 1 && ed.moveBtnDisabled]}
                          onPress={() => moveDown(idx)}
                          disabled={idx === editList.length - 1}
                        >
                          <Text style={ed.moveBtnText}>↓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={ed.removeBtn} onPress={() => removeItem(item.instanceId)}>
                          <MaterialCommunityIcons name="close" size={16} color="#E86B5E" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
              <TouchableOpacity style={ed.addBtn} onPress={openPicker}>
                <Text style={ed.addBtnText}>+ 기도문 또는 그룹 추가</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
            <View style={mod.footer}>
              <TouchableOpacity style={mod.cancelBtn} onPress={() => setShowEditor(false)}>
                <Text style={mod.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={mod.saveBtn} onPress={saveEditor}>
                <Text style={mod.saveBtnText}>저장하기</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 픽커 모달 ── */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={mod.bg} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <TouchableOpacity style={[mod.sheet, { maxHeight: '80%', paddingBottom: Math.max(32, bottomInset + 16) }]} activeOpacity={1}>
            <View style={mod.handle} />
            <View style={mod.header}>
              <Text style={[mod.title, { flex: 1 }]}>추가할 항목 선택</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={mod.closeBtn}>
                <MaterialCommunityIcons name="close" size={22} color="#999" />
              </TouchableOpacity>
            </View>
            <View style={pk.searchRow}>
              <MaterialCommunityIcons name="magnify" size={18} color="#aaa" />
              <TextInput
                style={pk.searchInput}
                placeholder="검색..."
                placeholderTextColor="#bbb"
                value={pickerSearch}
                onChangeText={setPickerSearch}
              />
              {pickerSearch ? (
                <TouchableOpacity onPress={() => setPickerSearch('')}>
                  <MaterialCommunityIcons name="close-circle" size={16} color="#bbb" />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={pk.tabs}>
              <TouchableOpacity
                style={[pk.tab, pickerTab === 'prayer' && pk.tabActive]}
                onPress={() => setPickerTab('prayer')}
              >
                <Text style={[pk.tabText, pickerTab === 'prayer' && pk.tabTextActive]}>
                  기도문 ({filteredPrayers.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pk.tab, pickerTab === 'group' && pk.tabActive]}
                onPress={() => setPickerTab('group')}
              >
                <Text style={[pk.tabText, pickerTab === 'group' && pk.tabTextActive]}>
                  그룹 ({filteredGroups.length})
                </Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={(pickerTab === 'prayer' ? filteredPrayers : filteredGroups) as any[]}
              keyExtractor={(item: any) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={() => (
                <View style={pk.empty}>
                  <Text style={pk.emptyText}>
                    {pickerTab === 'group' && groups.length === 0
                      ? '그룹 탭에서 먼저 그룹을 만들어주세요'
                      : '검색 결과가 없습니다'}
                  </Text>
                </View>
              )}
              renderItem={({ item }: { item: any }) => {
                const isPrayer = pickerTab === 'prayer';
                const p = item as StoredPrayer;
                const g = item as StoredGroup;
                const color = isPrayer ? catColor(p.category) : g.color;
                const subtitle = isPrayer ? p.category : `${g.prayerIds.length}개 기도문`;
                const addedCount = isPrayer
                  ? editList.filter(x => x.id === p.id).length
                  : editList.filter(x => x.id === g.id).length;
                return (
                  <TouchableOpacity
                    style={pk.item}
                    onPress={() => addToList(item.id, pickerTab)}
                  >
                    <View style={[pk.dot, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={pk.itemTitle}>
                        {isPrayer ? p.title : g.name}
                      </Text>
                      <Text style={pk.itemSub}>
                        {subtitle}{addedCount > 0 ? ` · ${addedCount}개 추가됨` : ''}
                      </Text>
                    </View>
                    <Text style={pk.addIcon}>+</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 시간 선택기 ── */}
      {timePickerIdx !== null && (
        <TimePicker
          value={editList[timePickerIdx]?.time ?? '09:00'}
          onChange={time => updateTime(timePickerIdx, time)}
          onClose={() => setTimePickerIdx(null)}
        />
      )}
    </ScreenWrapper>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f4f3ef' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#999', fontSize: 14 },
  scrollContent: { paddingBottom: 20 },

  header:      { backgroundColor: GREEN, padding: 20, paddingBottom: 20 },
  headerRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '500', color: '#fff' },
  headerDate:  { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  todayBtn:    { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  todayBtnText:{ color: '#fff', fontSize: 12 },
  editBtn:     { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  progress:     { margin: 16, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  progressLabel:{ fontSize: 12, color: '#888', marginBottom: 8 },
  progressBar:  { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: GREEN, borderRadius: 3 },
  progressNums: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressNumText: { fontSize: 12, color: '#666' },

  sectionLabel: {
    fontSize: 11, fontWeight: '500', color: '#888', letterSpacing: 0.8,
    textTransform: 'uppercase', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8,
  },

  listArea:    { paddingHorizontal: 16, gap: 8 },
  emptyBox:    { alignItems: 'center', paddingVertical: 40 },
  emptyIcon:   { fontSize: 40 },
  emptyTitle:  { fontSize: 15, color: '#666', marginTop: 12 },
  emptyBtn:    { marginTop: 12, backgroundColor: GREEN, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  emptyBtnText:{ color: '#fff', fontSize: 13 },

  prayerItem: {
    backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row',
    alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden', marginBottom: 2,
  },
  prayerItemDone: { backgroundColor: '#f0f4ee' },
  prayerItemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  prayerDot:  { width: 10, height: 10, borderRadius: 5 },
  groupTag:   { backgroundColor: '#EDE7F6', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 3 },
  groupTagText: { fontSize: 10, color: '#9B4A9B' },
  prayerTitle: { fontSize: 14, color: '#1a1a1a', fontWeight: '500', lineHeight: 20 },
  prayerTitleDone: { color: '#aaa', textDecorationLine: 'line-through' },
  prayerMeta: { fontSize: 11, color: '#aaa', marginTop: 2, lineHeight: 16 },

  checkBtn: {
    width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f8f8f8', borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(0,0,0,0.06)',
  },
  checkBtnDone: { backgroundColor: GREEN },
  checkMark:    { fontSize: 18, color: '#ddd' },
  checkMarkDone:{ color: '#fff' },

  calendar: {
    margin: 16, backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)',
  },
  calNav:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { padding: 8 },
  calNavBtnText: { fontSize: 22, color: GREEN, lineHeight: 24 },
  calNavTitle:   { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },

  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calWeekLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: '#aaa', fontWeight: '500' },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { alignItems: 'center', justifyContent: 'center' },
  calCellSelected: { backgroundColor: GREEN, borderRadius: 20 },
  calCellToday:    { borderWidth: 1.5, borderColor: GREEN, borderRadius: 20 },
  calCellText:     { fontSize: 13, color: '#333' },
  calCellTextSelected: { color: '#fff', fontWeight: '600' },
  calCellTextToday:    { color: GREEN, fontWeight: '600' },

  calDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  calDotFull: { backgroundColor: GREEN },
  calDotHalf: { backgroundColor: '#E8963A' },
  calDotSome: { backgroundColor: '#ccc' },

  calLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendText: { fontSize: 11, color: '#aaa' },
});

// 모달 공통 스타일
const mod = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32, maxHeight: '88%', flexShrink: 1,
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#ddd', borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  title:    { fontSize: 17, fontWeight: '600', color: '#1a1a1a', lineHeight: 26 },
  cat:      { fontSize: 12, marginTop: 2, lineHeight: 18 },
  hint:     { fontSize: 13, color: '#888', paddingHorizontal: 20, marginBottom: 8 },
  closeBtn: { padding: 4 },
  body:     { paddingHorizontal: 20 },
  content:  { fontSize: 15, color: '#333', lineHeight: 24 },
  footer:   { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12 },
  cancelBtn:{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#666', fontWeight: '500' },
  saveBtn:  { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: GREEN, alignItems: 'center' },
  saveBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  footerBtn: { marginHorizontal: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center' },
  footerBtnText: { fontSize: 14, color: '#666', fontWeight: '500' },
});

// 그룹 기도 모달 스타일
const gpm = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)' },
  num: { fontSize: 12, color: '#aaa', width: 20, textAlign: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  ptitle: { fontSize: 14, color: '#1a1a1a' },
  pcat:   { fontSize: 12, color: '#aaa', marginTop: 2 },
});

// 편집기 스타일
const ed = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8',
    borderRadius: 12, marginBottom: 8, overflow: 'hidden',
  },
  colorBar: { width: 4, alignSelf: 'stretch' },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, paddingBottom: 4 },
  tag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '600' },
  itemLabel: { fontSize: 13, color: '#1a1a1a', flex: 1 },
  timeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingBottom: 10 },
  timeBtnIcon: { fontSize: 12 },
  timeBtnText: { fontSize: 12, color: '#555' },
  controls: { flexDirection: 'column', paddingRight: 8, gap: 4 },
  moveBtn: { padding: 4, borderRadius: 4, backgroundColor: '#eee' },
  moveBtnDisabled: { opacity: 0.3 },
  moveBtnText: { fontSize: 12, color: '#555' },
  removeBtn: { padding: 4, borderRadius: 4, backgroundColor: '#FFEBEE' },
  addBtn: { backgroundColor: GREEN, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#aaa' },
});

// 픽커 스타일
const pk = StyleSheet.create({
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f4f3ef', borderRadius: 10,
    marginHorizontal: 20, marginBottom: 10,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a1a', padding: 0 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: GREEN },
  tabText: { fontSize: 14, color: '#aaa' },
  tabTextActive: { color: GREEN, fontWeight: '600' },
  item: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 20, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  itemTitle: { fontSize: 14, color: '#1a1a1a' },
  itemSub:   { fontSize: 12, color: '#aaa', marginTop: 2 },
  addIcon:   { fontSize: 20, color: GREEN, fontWeight: '300' },
  empty:     { alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontSize: 14, color: '#aaa' },
});
