import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, FlatList, Modal, Alert, useWindowDimensions, Pressable,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureDetector, GestureHandlerRootView, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { useAppContext } from '../../hooks/useAppData';
import { useDailyBible, buildBibleUrl, todayKSTString } from '../../hooks/useDailyBible';
import { usePrayerFontSize } from '../../hooks/usePrayerFontSize';
import { StoredPrayer, TodayItem } from '../../types';

const GREEN = '#2D5016';

const CATEGORY_COLORS: Record<string, string> = {
  '주요기도': '#4A9B6F', '묵주기도': '#E86B5E', '고해성사': '#A0522D',
  '성체성사': '#3A9BE8', '호칭기도': '#7B68EE', '여러가지기도': '#E8963A',
  '레지오마리애': '#9B4A9B',
};
const FIXED_CATEGORIES = Object.keys(CATEGORY_COLORS);
function catColor(cat: string) { return CATEGORY_COLORS[cat] ?? '#8A8A8E'; }

type TabType = '전체' | '즐겨찾기' | '매일성경';

// ── 매일성경 탭 ──────────────────────────────────────────────────
const BibleTab: React.FC<{
  todayList: TodayItem[];
  onAddToList: (id: 'bible-reading' | 'bible-gospel') => void;
}> = ({ todayList, onAddToList }) => {
  const { data, loading, error, retry } = useDailyBible();
  const [expandedReading, setExpandedReading] = useState(false);
  const [expandedGospel,  setExpandedGospel]  = useState(false);

  const readingAdded = todayList.some(i => i.id === 'bible-reading');
  const gospelAdded  = todayList.some(i => i.id === 'bible-gospel');

  if (loading) {
    return (
      <View style={bt.center}>
        <Text style={bt.statusText}>오늘의 성경 읽기를 불러오는 중…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={bt.center}>
        <Text style={bt.statusIcon}>📵</Text>
        <Text style={bt.statusText}>성경 읽기를 불러오지 못했습니다.</Text>
        <TouchableOpacity style={bt.retryBtn} onPress={retry}>
          <Text style={bt.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasReadings = data.readings.length > 0;
  const hasGospel   = !!data.gospel;

  if (!hasReadings && !hasGospel) {
    return (
      <View style={bt.center}>
        <Text style={bt.statusIcon}>📖</Text>
        <Text style={bt.statusText}>오늘의 독서 정보를 파싱하지 못했습니다.</Text>
      </View>
    );
  }

  const mergedReadingContent = hasReadings
    ? data.readings.map((r, i) =>
        data.readings.length > 1 ? `【${r.title}】\n${r.content}` : r.content
      ).join('\n\n')
    : '';

  return (
    <ScrollView style={bt.scroll} contentContainerStyle={bt.scrollContent}>
      <Text style={bt.dateLabel}>📅 {data.date.replace(/-/g, '. ')}</Text>

      {hasReadings && (
        <View style={bt.card}>
          <TouchableOpacity style={bt.cardHeader} onPress={() => setExpandedReading(e => !e)}>
            <View style={bt.cardTitleRow}>
              <Text style={bt.cardIcon}>📖</Text>
              <Text style={bt.cardTitle}>
                {data.readings.length === 1
                  ? data.readings[0].title
                  : `독서 (${data.readings.map(r => r.title).join(', ')})`}
              </Text>
              {data.readings[0].book ? <Text style={bt.cardBook}>{data.readings[0].book}</Text> : null}
            </View>
            <Text style={bt.cardArrow}>{expandedReading ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {!expandedReading && (
            <Text style={bt.preview} numberOfLines={2}>{mergedReadingContent.slice(0, 80)}…</Text>
          )}
          {expandedReading && (
            <Text style={bt.content}>{mergedReadingContent}</Text>
          )}
          <View style={bt.cardFooter}>
            <TouchableOpacity
              style={[bt.addBtn, readingAdded && bt.addBtnAdded]}
              onPress={() => !readingAdded && onAddToList('bible-reading')}
              disabled={readingAdded}
            >
              <Text style={[bt.addBtnText, readingAdded && bt.addBtnTextAdded]}>
                {readingAdded ? '✓ 오늘 목록에 있음' : '+ 오늘 목록에 추가'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {hasGospel && data.gospel && (
        <View style={bt.card}>
          <TouchableOpacity style={bt.cardHeader} onPress={() => setExpandedGospel(e => !e)}>
            <View style={bt.cardTitleRow}>
              <Text style={bt.cardIcon}>✝</Text>
              <Text style={bt.cardTitle}>{data.gospel.title}</Text>
              {data.gospel.book ? <Text style={bt.cardBook}>{data.gospel.book}</Text> : null}
            </View>
            <Text style={bt.cardArrow}>{expandedGospel ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {!expandedGospel && (
            <Text style={bt.preview} numberOfLines={2}>{data.gospel.content.slice(0, 80)}…</Text>
          )}
          {expandedGospel && (
            <Text style={bt.content}>{data.gospel.content}</Text>
          )}
          <View style={bt.cardFooter}>
            <TouchableOpacity
              style={[bt.addBtn, gospelAdded && bt.addBtnAdded]}
              onPress={() => !gospelAdded && onAddToList('bible-gospel')}
              disabled={gospelAdded}
            >
              <Text style={[bt.addBtnText, gospelAdded && bt.addBtnTextAdded]}>
                {gospelAdded ? '✓ 오늘 목록에 있음' : '+ 오늘 목록에 추가'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

// ── 메인 ─────────────────────────────────────────────────────────
export default function LibraryScreen() {
  const { height: screenHeight } = useWindowDimensions();
  const {
    prayers, addPrayer, updatePrayer, deletePrayer,
    toggleFavorite, todayList, setTodayList,
  } = useAppContext();
  const { fontSize, pinchGesture } = usePrayerFontSize();

  const [search,       setSearch]       = useState('');
  const [activeTab,    setActiveTab]    = useState<TabType>('전체');
  const [activeCat,    setActiveCat]    = useState('전체');
  const [detailPrayer, setDetailPrayer] = useState<StoredPrayer | null>(null);
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [editPrayer,   setEditPrayer]   = useState<StoredPrayer | null>(null);
  const [actionPrayer, setActionPrayer] = useState<StoredPrayer | null>(null);

  const [formTitle,     setFormTitle]     = useState('');
  const [formContent,   setFormContent]   = useState('');
  const [formCategory,  setFormCategory]  = useState('주요기도');
  const [formCustomCat, setFormCustomCat] = useState('');
  const [showCatPicker, setShowCatPicker] = useState(false);

  const categories = useMemo(() =>
    ['전체', ...Array.from(new Set(prayers.filter(p => p.source !== 'bible').map(p => p.category)))],
    [prayers]
  );

  const filtered = useMemo(() => prayers.filter(p => {
    if (p.source === 'bible') return false;
    if (activeTab === '즐겨찾기' && !p.isFavorite) return false;
    if (activeCat !== '전체' && p.category !== activeCat) return false;
    if (search && !p.title.includes(search) && !p.content.includes(search)) return false;
    return true;
  }), [prayers, activeTab, activeCat, search]);

  const openAdd = () => {
    setFormTitle(''); setFormContent('');
    setFormCategory('주요기도'); setFormCustomCat('');
    setEditPrayer(null); setShowAddForm(true);
  };

  const openEdit = (p: StoredPrayer) => {
    const isCustom = !FIXED_CATEGORIES.includes(p.category);
    setFormTitle(p.title); setFormContent(p.content);
    setFormCategory(isCustom ? '__custom__' : p.category);
    setFormCustomCat(isCustom ? p.category : '');
    setEditPrayer(p); setShowAddForm(true);
    setDetailPrayer(null); setActionPrayer(null);
  };

  const saveForm = () => {
    if (!formTitle.trim() || !formContent.trim()) {
      Alert.alert('입력 오류', '제목과 내용을 모두 입력해주세요.');
      return;
    }
    const finalCat = formCategory === '__custom__'
      ? (formCustomCat.trim() || '기타')
      : formCategory;

    if (editPrayer) {
      updatePrayer(editPrayer.id, { title: formTitle.trim(), content: formContent.trim(), category: finalCat });
    } else {
      addPrayer({ title: formTitle.trim(), content: formContent.trim(), category: finalCat, isFavorite: false, isDeleted: false });
    }
    setShowAddForm(false); setEditPrayer(null);
  };

  const handleDelete = (p: StoredPrayer) => {
    Alert.alert(`"${p.title}" 삭제`, '이 기도문을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { deletePrayer(p.id); setActionPrayer(null); } },
    ]);
  };

  const handleAddBibleToList = (bibleId: 'bible-reading' | 'bible-gospel') => {
    if (todayList.some(i => i.id === bibleId)) return;
    const newItem: TodayItem = {
      id: bibleId, instanceId: `${bibleId}-${Date.now()}`,
      type: 'prayer', time: '', days: [],
    };
    setTodayList([...todayList, newItem]);
  };

  return (
    <ScreenWrapper statusBarColor={GREEN} style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기도문</Text>
        <View style={styles.tabRow}>
          {(['전체', '즐겨찾기', '매일성경'] as TabType[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, activeTab === t && styles.tabActive]}
              onPress={() => { setActiveTab(t); setActiveCat('전체'); }}
            >
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                {t === '매일성경' ? '📖 매일성경' : t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 매일성경 탭 */}
      {activeTab === '매일성경' && (
        <BibleTab todayList={todayList} onAddToList={handleAddBibleToList} />
      )}

      {/* 기도문 탭 */}
      {activeTab !== '매일성경' && (
        <View style={{ flex: 1 }}>
          {/* 검색 */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <MaterialCommunityIcons name="magnify" size={18} color="#aaa" />
              <TextInput
                style={styles.searchInput}
                placeholder="기도문 검색..."
                placeholderTextColor="#bbb"
                value={search}
                onChangeText={setSearch}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <MaterialCommunityIcons name="close-circle" size={16} color="#bbb" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.favBtn, activeTab === '즐겨찾기' && styles.favBtnActive]}
              onPress={() => setActiveTab(t => t === '즐겨찾기' ? '전체' : '즐겨찾기')}
            >
              <MaterialCommunityIcons
                name={activeTab === '즐겨찾기' ? 'star' : 'star-outline'}
                size={20}
                color={activeTab === '즐겨찾기' ? '#E8963A' : '#aaa'}
              />
            </TouchableOpacity>
          </View>

          {/* 카테고리 칩 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, activeCat === cat && styles.catChipActive]}
                onPress={() => setActiveCat(cat)}
              >
                <Text style={[styles.catChipText, activeCat === cat && styles.catChipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 목록 */}
          <FlatList
            data={filtered}
            keyExtractor={p => p.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={() => (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  {search ? `"${search}" 검색 결과가 없습니다` : '기도문이 없습니다'}
                </Text>
              </View>
            )}
            renderItem={({ item: p }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setDetailPrayer(p)}
                onLongPress={() => { if (p.source !== 'bible') setActionPrayer(p); }}
                activeOpacity={0.7}
              >
                <View style={[styles.cardColorBar, { backgroundColor: catColor(p.category) }]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
                    {p.source !== 'bible' && (
                      <TouchableOpacity
                        onPress={e => { toggleFavorite(p.id); }}
                        style={styles.starBtn}
                      >
                        <MaterialCommunityIcons
                          name={p.isFavorite ? 'star' : 'star-outline'}
                          size={20}
                          color={p.isFavorite ? '#E8963A' : '#ccc'}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.cardPreview} numberOfLines={1}>
                    {p.source === 'bible' ? '오늘 날짜의 가톨릭 독서를 불러옵니다' : p.content.replace(/\n/g, ' ')}
                  </Text>
                  <View style={styles.cardBadge}>
                    <Text style={[styles.cardBadgeText, { color: catColor(p.category) }]}>{p.category}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />

          {/* 추가 FAB */}
          <TouchableOpacity style={styles.fab} onPress={openAdd}>
            <MaterialCommunityIcons name="plus" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── 상세 보기 모달 ── */}
      <Modal visible={!!detailPrayer} transparent animationType="slide" onRequestClose={() => setDetailPrayer(null)}>
        {/* Modal은 GestureHandlerRootView 범위 밖 → 내부에 별도 선언 필요 */}
        <GestureHandlerRootView style={{ flex: 1 }}>
        {detailPrayer && (
          <View style={dlg.bg}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDetailPrayer(null)} />
            <View style={dlg.sheet}>
              <View style={dlg.handle} />
              <View style={dlg.header}>
                <View style={{ flex: 1 }}>
                  <Text style={dlg.title}>{detailPrayer.title}</Text>
                  <Text style={[dlg.badge, { color: catColor(detailPrayer.category) }]}>{detailPrayer.category}</Text>
                </View>
                <TouchableOpacity onPress={() => setDetailPrayer(null)}>
                  <MaterialCommunityIcons name="close" size={22} color="#999" />
                </TouchableOpacity>
              </View>
              {/* 두 손가락 핀치로 글씨 크기 조절 — collapsable=false 필수(Android) */}
              <GestureDetector gesture={pinchGesture}>
                <View collapsable={false}>
                  {/* GHScrollView: GestureDetector 안에서 스크롤과 핀치가 충돌 없이 동작 */}
                  <GHScrollView style={[dlg.body, { maxHeight: screenHeight * 0.55 }]}>
                    {detailPrayer.source === 'bible' ? (
                      <View style={dlg.bibleContent}>
                        <Text style={[dlg.content, { fontSize, lineHeight: fontSize * 1.65 }]}>오늘의 성경 본문은 홈 탭에서 확인하세요.</Text>
                      </View>
                    ) : (
                      <Text style={[dlg.content, { fontSize, lineHeight: fontSize * 1.65 }]}>{detailPrayer.content}</Text>
                    )}
                    <View style={{ height: 20 }} />
                  </GHScrollView>
                </View>
              </GestureDetector>
              <View style={dlg.footer}>
                {detailPrayer.source !== 'bible' && (
                  <TouchableOpacity style={dlg.editBtn} onPress={() => openEdit(detailPrayer)}>
                    <Text style={dlg.editBtnText}>수정</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={dlg.closeBtn} onPress={() => setDetailPrayer(null)}>
                  <Text style={dlg.closeBtnText}>닫기</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        </GestureHandlerRootView>
      </Modal>

      {/* ── 액션 모달 (롱프레스) ── */}
      <Modal visible={!!actionPrayer} transparent animationType="fade" onRequestClose={() => setActionPrayer(null)}>
        {actionPrayer && (
          <TouchableOpacity style={dlg.bg} activeOpacity={1} onPress={() => setActionPrayer(null)}>
            <TouchableOpacity style={act.sheet} activeOpacity={1}>
              <Text style={act.title}>{actionPrayer.title}</Text>
              <TouchableOpacity style={act.btn} onPress={() => openEdit(actionPrayer)}>
                <MaterialCommunityIcons name="pencil-outline" size={20} color={GREEN} />
                <Text style={[act.btnText, { color: GREEN }]}>수정</Text>
              </TouchableOpacity>
              <View style={act.sep} />
              <TouchableOpacity style={act.btn} onPress={() => handleDelete(actionPrayer)}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#E86B5E" />
                <Text style={[act.btnText, { color: '#E86B5E' }]}>삭제</Text>
              </TouchableOpacity>
              <View style={act.sep} />
              <TouchableOpacity style={act.btn} onPress={() => setActionPrayer(null)}>
                <Text style={[act.btnText, { color: '#aaa' }]}>취소</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      </Modal>

      {/* ── 추가/수정 폼 모달 ── */}
      <Modal visible={showAddForm} transparent animationType="slide" onRequestClose={() => setShowAddForm(false)}>
        <View style={dlg.bg}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAddForm(false)} />
          <View style={[dlg.sheet, { maxHeight: '90%' }]}>
            <View style={dlg.handle} />
            <View style={dlg.header}>
              <Text style={dlg.title}>{editPrayer ? '기도문 수정' : '새 기도문'}</Text>
              <TouchableOpacity onPress={() => setShowAddForm(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#999" />
              </TouchableOpacity>
            </View>
            <ScrollView style={[dlg.body, { maxHeight: screenHeight * 0.6 }]} keyboardShouldPersistTaps="handled">
              <Text style={frm.label}>제목 *</Text>
              <TextInput
                style={frm.input}
                placeholder="기도문 제목"
                placeholderTextColor="#bbb"
                value={formTitle}
                onChangeText={setFormTitle}
                maxLength={50}
              />

              <Text style={frm.label}>카테고리 *</Text>
              <TouchableOpacity style={frm.select} onPress={() => setShowCatPicker(true)}>
                <Text style={frm.selectText}>
                  {formCategory === '__custom__' ? '직접 입력' : formCategory}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color="#aaa" />
              </TouchableOpacity>
              {formCategory === '__custom__' && (
                <TextInput
                  style={[frm.input, { marginTop: 8 }]}
                  placeholder="새 카테고리 이름"
                  placeholderTextColor="#bbb"
                  value={formCustomCat}
                  onChangeText={setFormCustomCat}
                  maxLength={20}
                />
              )}

              <Text style={frm.label}>기도문 내용 *</Text>
              <TextInput
                style={[frm.input, frm.textarea]}
                placeholder="기도문 내용을 입력하세요..."
                placeholderTextColor="#bbb"
                value={formContent}
                onChangeText={setFormContent}
                multiline
                textAlignVertical="top"
              />
              <View style={{ height: 20 }} />
            </ScrollView>
            <View style={dlg.footer}>
              <TouchableOpacity style={dlg.closeBtn} onPress={() => setShowAddForm(false)}>
                <Text style={dlg.closeBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dlg.editBtn} onPress={saveForm}>
                <Text style={dlg.editBtnText}>{editPrayer ? '수정 완료' : '추가'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 카테고리 선택 모달 ── */}
      <Modal visible={showCatPicker} transparent animationType="slide" onRequestClose={() => setShowCatPicker(false)}>
        <TouchableOpacity style={dlg.bg} activeOpacity={1} onPress={() => setShowCatPicker(false)}>
          <TouchableOpacity style={[dlg.sheet]} activeOpacity={1}>
            <View style={dlg.handle} />
            <Text style={[dlg.title, { padding: 16, paddingBottom: 8 }]}>카테고리 선택</Text>
            {[...FIXED_CATEGORIES, '__custom__'].map(c => (
              <TouchableOpacity
                key={c}
                style={act.btn}
                onPress={() => { setFormCategory(c); setShowCatPicker(false); }}
              >
                {c !== '__custom__' && <View style={[act.dot, { backgroundColor: catColor(c) }]} />}
                <Text style={[act.btnText, formCategory === c && { color: GREEN, fontWeight: '600' }]}>
                  {c === '__custom__' ? '+ 직접 입력' : c}
                </Text>
                {formCategory === c && <MaterialCommunityIcons name="check" size={18} color={GREEN} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 16 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScreenWrapper>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f3ef' },

  header:      { backgroundColor: GREEN, padding: 20, paddingBottom: 0 },
  headerTitle: { fontSize: 22, fontWeight: '500', color: '#fff', marginBottom: 12 },
  tabRow:      { flexDirection: 'row', gap: 0 },
  tab:         { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:   { borderBottomColor: '#fff' },
  tabText:     { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: '#fff', fontWeight: '600' },

  searchRow:   { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  searchBox:   {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.1)',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a1a', padding: 0 },
  favBtn:      { padding: 8, borderRadius: 10, backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.1)' },
  favBtnActive:{ backgroundColor: '#FFF8E1' },

  catScroll:   { height: 44 },
  catContent:  { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  catChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.1)' },
  catChipActive: { backgroundColor: GREEN },
  catChipText:   { fontSize: 13, color: '#666' },
  catChipTextActive: { color: '#fff', fontWeight: '500' },

  listContent: { padding: 12, gap: 8, paddingBottom: 80 },
  emptyBox:    { alignItems: 'center', paddingVertical: 60 },
  emptyText:   { fontSize: 14, color: '#aaa' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  cardColorBar: { width: 4 },
  cardBody:     { flex: 1, padding: 14 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:    { fontSize: 15, fontWeight: '500', color: '#1a1a1a', flex: 1 },
  cardPreview:  { fontSize: 12, color: '#888', marginTop: 4, lineHeight: 16 },
  cardBadge:    { alignSelf: 'flex-start', marginTop: 6 },
  cardBadgeText:{ fontSize: 11, fontWeight: '500' },
  starBtn:      { padding: 4 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
});

const dlg = StyleSheet.create({
  bg:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:  { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: '80%' },
  handle: { width: 36, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  title:  { fontSize: 17, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  badge:  { fontSize: 12, marginTop: 2, fontWeight: '500' },
  body:   { paddingHorizontal: 20 },
  content:{ fontSize: 15, color: '#333', lineHeight: 26 },
  bibleContent: {},
  footer: { flexDirection: 'row', gap: 10, padding: 16 },
  editBtn:{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center' },
  editBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  closeBtn:{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  closeBtnText: { fontSize: 14, color: '#666', fontWeight: '500' },
});

const act = StyleSheet.create({
  sheet:  { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, paddingTop: 8 },
  title:  { fontSize: 15, fontWeight: '600', color: '#1a1a1a', padding: 16, paddingBottom: 8 },
  btn:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  btnText:{ fontSize: 15, color: '#1a1a1a' },
  dot:    { width: 10, height: 10, borderRadius: 5 },
  sep:    { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 20 },
});

const frm = StyleSheet.create({
  label:  { fontSize: 13, fontWeight: '500', color: '#555', marginBottom: 6, marginTop: 14 },
  input:  { backgroundColor: '#f4f3ef', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#1a1a1a', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  textarea: { minHeight: 150, textAlignVertical: 'top' },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f4f3ef', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  selectText: { fontSize: 15, color: '#1a1a1a' },
});

const bt = StyleSheet.create({
  scroll:       { flex: 1 },
  scrollContent: { padding: 16 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  statusIcon:   { fontSize: 40, marginBottom: 12 },
  statusText:   { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  retryBtn:     { marginTop: 16, backgroundColor: GREEN, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText:    { color: '#fff', fontSize: 13 },
  dateLabel:    { fontSize: 13, color: '#888', marginBottom: 12 },
  card:         { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 14 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8, flexWrap: 'wrap' },
  cardIcon:     { fontSize: 18 },
  cardTitle:    { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  cardBook:     { fontSize: 12, color: '#888' },
  cardArrow:    { fontSize: 12, color: '#aaa', paddingLeft: 8 },
  preview:      { paddingHorizontal: 14, paddingBottom: 10, fontSize: 13, color: '#888', lineHeight: 18 },
  content:      { paddingHorizontal: 14, paddingBottom: 14, fontSize: 15, color: '#333', lineHeight: 24 },
  cardFooter:   { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)', flexDirection: 'row', alignItems: 'center', gap: 12 },
  addBtn:       { flex: 1, backgroundColor: GREEN, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addBtnAdded:  { backgroundColor: '#f0f4ee' },
  addBtnText:   { fontSize: 13, color: '#fff', fontWeight: '500' },
  addBtnTextAdded: { color: GREEN },
});
