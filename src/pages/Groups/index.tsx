import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, FlatList, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '../../components/ScreenWrapper';
import { BiblePrayerContent } from '../../components/BiblePrayerContent';
import { usePrayerFontSize } from '../../hooks/usePrayerFontSize';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppContext } from '../../hooks/useAppData';
import { StoredPrayer, StoredGroup } from '../../types';

const GREEN = '#2D5016';

const GROUP_COLORS = ['#4A9B6F', '#E8963A', '#7B68EE', '#E86B5E', '#3A9BE8', '#C4A24A', '#9B4A9B', '#2D5016'];
const CAT_COLORS: Record<string, string> = {
  '주요기도': '#4A9B6F', '묵주기도': '#E86B5E', '고해성사': '#A0522D',
  '성체성사': '#3A9BE8', '호칭기도': '#7B68EE', '여러가지기도': '#E8963A', '레지오마리애': '#9B4A9B',
  '매일성경': '#2D5016',
};
function catColor(cat: string) { return CAT_COLORS[cat] ?? '#8A8A8E'; }

// 독서/복음은 prayers 배열에 없는 가상 항목
const BIBLE_PICKER_ITEMS = [
  { id: 'bible-reading', title: '오늘의 독서', category: '매일성경' },
  { id: 'bible-gospel',  title: '오늘의 복음',  category: '매일성경' },
];
const BIBLE_VIRTUAL_PRAYERS: Record<string, StoredPrayer> = {
  'bible-reading': { id: 'bible-reading', title: '오늘의 독서', category: '매일성경', source: 'bible', content: '', isFavorite: false, isDeleted: false, createdAt: '', updatedAt: '' },
  'bible-gospel':  { id: 'bible-gospel',  title: '오늘의 복음',  category: '매일성경', source: 'bible', content: '', isFavorite: false, isDeleted: false, createdAt: '', updatedAt: '' },
};

// ── 기도 플레이어 ─────────────────────────────────────────────────
const PrayerPlayer: React.FC<{
  groupName: string;
  prayers: StoredPrayer[];
  onClose: () => void;
}> = ({ groupName, prayers, onClose }) => {
  const [idx,  setIdx]  = useState(0);
  const [done, setDone] = useState(false);
  const { fontSize, panHandlers } = usePrayerFontSize();
  const total   = prayers.length;
  const current = prayers[idx];

  if (done) {
    return (
      <View style={pl.done}>
        <Text style={pl.doneIcon}>✝</Text>
        <Text style={pl.doneTitle}>기도를 마쳤습니다</Text>
        <Text style={pl.doneSub}>{groupName}</Text>
        <TouchableOpacity style={pl.doneBtn} onPress={onClose}>
          <Text style={pl.doneBtnText}>닫기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={pl.container}>
      <View style={pl.header}>
        <TouchableOpacity style={pl.closeBtn} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={pl.groupName}>{groupName}</Text>
        <Text style={pl.progress}>{idx + 1} / {total}</Text>
      </View>

      <View style={pl.progBar}>
        <View style={[pl.progFill, { width: `${((idx + 1) / total) * 100}%` as any }]} />
      </View>

      {/* 두 손가락 핀치로 글씨 크기 조절 */}
      <View {...panHandlers} style={{ flex: 1 }}>
        <ScrollView style={pl.body} contentContainerStyle={pl.bodyContent}>
          <Text style={pl.prayerTitle}>{current?.title}</Text>
          {current?.source === 'bible'
            ? <BiblePrayerContent prayerId={current.id} fontSize={fontSize} />
            : <Text style={[pl.prayerContent, { fontSize, lineHeight: fontSize * 1.65 }]}>
                {current?.content
                  ? current.content.replace(/\\n/g, '\n')
                  : '기도문 내용이 없습니다.'}
              </Text>
          }
        </ScrollView>
      </View>

      <View style={pl.footer}>
        <TouchableOpacity
          style={[pl.navBtn, pl.navBtnPrev, idx === 0 && pl.navBtnDisabled]}
          onPress={() => setIdx(i => i - 1)}
          disabled={idx === 0}
        >
          <Text style={pl.navBtnText}>이전</Text>
        </TouchableOpacity>
        {idx < total - 1 ? (
          <TouchableOpacity
            style={[pl.navBtn, pl.navBtnNext]}
            onPress={() => setIdx(i => i + 1)}
          >
            <Text style={[pl.navBtnText, { color: '#fff' }]}>다음</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[pl.navBtn, pl.navBtnDone]}
            onPress={() => setDone(true)}
          >
            <Text style={[pl.navBtnText, { color: '#fff' }]}>기도 완료 ✓</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ── 메인 ─────────────────────────────────────────────────────────
export default function GroupsScreen() {
  const { prayers, groups, addGroup, updateGroup, deleteGroup } = useAppContext();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [formName,     setFormName]     = useState('');
  const [formDesc,     setFormDesc]     = useState('');
  const [formColor,    setFormColor]    = useState(GROUP_COLORS[0]);
  const [formPrayers,  setFormPrayers]  = useState<string[]>([]);
  const [search,       setSearch]       = useState('');
  const [playingGroup, setPlayingGroup] = useState<{ name: string; prayers: StoredPrayer[] } | null>(null);

  const getPrayer    = (id: string) => prayers.find(p => p.id === id);
  const getAnyPrayer = (id: string): StoredPrayer | undefined =>
    BIBLE_VIRTUAL_PRAYERS[id] ?? prayers.find(p => p.id === id);

  const openAdd = () => {
    setFormName(''); setFormDesc(''); setFormColor(GROUP_COLORS[0]); setFormPrayers([]);
    setSearch('');   // 검색어 초기화 → bible 항목 항상 표시
    setEditId(null); setShowForm(true);
  };
  const openEdit = (id: string) => {
    const g = groups.find(x => x.id === id);
    if (!g) return;
    setFormName(g.name); setFormDesc(g.description); setFormColor(g.color); setFormPrayers([...g.prayerIds]);
    setSearch('');   // 검색어 초기화
    setEditId(id); setShowForm(true); setExpandedId(null);
  };

  const saveForm = () => {
    if (!formName.trim()) { Alert.alert('', '그룹 이름을 입력해주세요.'); return; }
    if (formPrayers.length === 0) { Alert.alert('', '기도문을 하나 이상 선택해주세요.'); return; }
    if (editId) {
      updateGroup(editId, { name: formName.trim(), description: formDesc.trim(), color: formColor, prayerIds: formPrayers });
    } else {
      addGroup({ name: formName.trim(), description: formDesc.trim(), color: formColor, prayerIds: formPrayers, isDeleted: false });
    }
    setShowForm(false); setEditId(null);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`"${name}" 삭제`, '이 그룹을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { deleteGroup(id); setExpandedId(null); } },
    ]);
  };

  const startPrayer = (g: StoredGroup) => {
    const plist = g.prayerIds.map(id => getAnyPrayer(id)).filter(Boolean) as StoredPrayer[];
    setPlayingGroup({ name: g.name, prayers: plist });
    setExpandedId(null);
  };

  const togglePicker = (id: string) => {
    setFormPrayers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const moveUp   = (idx: number) => setFormPrayers(prev => { const a = [...prev]; if (idx === 0) return a; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a; });
  const moveDown = (idx: number) => setFormPrayers(prev => { const a = [...prev]; if (idx === a.length - 1) return a; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a; });

  const filteredPrayers = useMemo(() => {
    const bibleItems = BIBLE_PICKER_ITEMS.filter(b =>
      !search || b.title.includes(search) || b.category.includes(search) || '성경'.includes(search)
    );
    const prayerItems = prayers.filter(p =>
      p.source !== 'bible' && (p.title.includes(search) || p.category.includes(search))
    );
    return [...bibleItems, ...prayerItems] as any[];
  }, [prayers, search]);

  // 기도 플레이어 (전체 화면)
  if (playingGroup) {
    return (
      <ScreenWrapper statusBarColor={GREEN} style={{ flex: 1, backgroundColor: '#f4f3ef' }}>
        <PrayerPlayer
          groupName={playingGroup.name}
          prayers={playingGroup.prayers}
          onClose={() => setPlayingGroup(null)}
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper statusBarColor={GREEN} style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기도 그룹</Text>
        <Text style={styles.headerSub}>나만의 기도 순서 묶음</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {groups.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🗂️</Text>
            <Text style={styles.emptyTitle}>아직 그룹이 없어요</Text>
            <Text style={styles.emptyDesc}>+ 버튼으로 그룹을 만들어보세요</Text>
          </View>
        ) : (
          groups.map(g => {
            const isExp = expandedId === g.id;
            return (
              <View key={g.id} style={styles.card}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => setExpandedId(isExp ? null : g.id)}
                >
                  <View style={[styles.colorDot, { backgroundColor: g.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupName}>{g.name}</Text>
                    {g.description ? <Text style={styles.groupDesc}>{g.description}</Text> : null}
                  </View>
                  <Text style={styles.countBadge}>{g.prayerIds.length}개</Text>
                  <MaterialCommunityIcons
                    name={isExp ? 'chevron-up' : 'chevron-down'}
                    size={20} color="#aaa"
                  />
                </TouchableOpacity>

                {isExp && (
                  <View style={styles.cardBody}>
                    {g.prayerIds.map((pid, idx) => {
                      const p = getAnyPrayer(pid);
                      if (!p) return null;
                      return (
                        <View key={pid} style={styles.prayerRow}>
                          <Text style={styles.prayerNum}>{idx + 1}</Text>
                          <View style={[styles.prayerDot, { backgroundColor: catColor(p.category) }]} />
                          <Text style={styles.prayerTitle} numberOfLines={1}>{p.title}</Text>
                          <View style={styles.prayerMoves}>
                            <TouchableOpacity
                              style={[styles.moveBtn, idx === 0 && styles.moveBtnDisabled]}
                              disabled={idx === 0}
                              onPress={() => {
                                const newIds = [...g.prayerIds];
                                [newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]];
                                updateGroup(g.id, { prayerIds: newIds });
                              }}
                            >
                              <Text style={styles.moveBtnText}>↑</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.moveBtn, idx === g.prayerIds.length - 1 && styles.moveBtnDisabled]}
                              disabled={idx === g.prayerIds.length - 1}
                              onPress={() => {
                                const newIds = [...g.prayerIds];
                                [newIds[idx], newIds[idx + 1]] = [newIds[idx + 1], newIds[idx]];
                                updateGroup(g.id, { prayerIds: newIds });
                              }}
                            >
                              <Text style={styles.moveBtnText}>↓</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(g.id)}>
                        <Text style={styles.actionBtnText}>수정</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDel]}
                        onPress={() => handleDelete(g.id, g.name)}
                      >
                        <Text style={[styles.actionBtnText, { color: '#E86B5E' }]}>삭제</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnPlay]}
                        onPress={() => startPrayer(g)}
                      >
                        <Text style={[styles.actionBtnText, { color: '#fff' }]}>기도 시작</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── 그룹 추가/수정 모달 ── */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <TouchableOpacity style={mod.bg} activeOpacity={1} onPress={() => setShowForm(false)}>
          <TouchableOpacity style={[mod.sheet, { maxHeight: '90%', paddingBottom: Math.max(32, bottomInset + 16) }]} activeOpacity={1}>
            <View style={mod.handle} />
            <View style={mod.header}>
              <Text style={mod.title}>{editId ? '그룹 수정' : '새 그룹'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#999" />
              </TouchableOpacity>
            </View>
            <ScrollView style={mod.body} keyboardShouldPersistTaps="handled">
              <Text style={frm.label}>그룹 이름 *</Text>
              <TextInput
                style={frm.input}
                placeholder="예) 아침기도 루틴"
                placeholderTextColor="#bbb"
                value={formName}
                onChangeText={setFormName}
                maxLength={30}
              />

              <Text style={frm.label}>설명</Text>
              <TextInput
                style={frm.input}
                placeholder="그룹 설명 (선택)"
                placeholderTextColor="#bbb"
                value={formDesc}
                onChangeText={setFormDesc}
                maxLength={50}
              />

              <Text style={frm.label}>그룹 색상</Text>
              <View style={frm.colorRow}>
                {GROUP_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[frm.colorBtn, { backgroundColor: c }, formColor === c && frm.colorBtnActive]}
                    onPress={() => setFormColor(c)}
                  >
                    {formColor === c && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={frm.label}>기도문 선택 * ({formPrayers.length}개)</Text>
              <View style={frm.searchRow}>
                <MaterialCommunityIcons name="magnify" size={16} color="#aaa" />
                <TextInput
                  style={frm.searchInput}
                  placeholder="기도문 검색..."
                  placeholderTextColor="#bbb"
                  value={search}
                  onChangeText={setSearch}
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <MaterialCommunityIcons name="close-circle" size={14} color="#bbb" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={frm.prayerList}>
                {filteredPrayers.length === 0 ? (
                  <Text style={frm.emptyText}>검색 결과 없음</Text>
                ) : (
                  filteredPrayers.map(p => {
                    const sel = formPrayers.includes(p.id);
                    const order = formPrayers.indexOf(p.id) + 1;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[frm.pItem, sel && frm.pItemSelected]}
                        onPress={() => togglePicker(p.id)}
                      >
                        <View style={[frm.pDot, { backgroundColor: catColor(p.category) }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={frm.pTitle}>{p.title}</Text>
                          <Text style={frm.pCat}>{p.category}</Text>
                        </View>
                        {sel ? (
                          <View style={frm.orderBadge}>
                            <Text style={frm.orderBadgeText}>{order}</Text>
                          </View>
                        ) : (
                          <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#ccc" />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {formPrayers.length > 0 && (
                <View style={frm.preview}>
                  <Text style={frm.previewLabel}>순서 미리보기</Text>
                  {formPrayers.map((pid, idx) => {
                    const p = getAnyPrayer(pid);
                    if (!p) return null;
                    return (
                      <View key={pid} style={frm.previewRow}>
                        <Text style={frm.previewNum}>{idx + 1}</Text>
                        <Text style={frm.previewTitle} numberOfLines={1}>{p.title}</Text>
                        <View style={frm.previewMoves}>
                          <TouchableOpacity
                            disabled={idx === 0}
                            style={[frm.previewBtn, idx === 0 && frm.previewBtnDisabled]}
                            onPress={() => moveUp(idx)}
                          >
                            <Text style={frm.previewBtnText}>↑</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={idx === formPrayers.length - 1}
                            style={[frm.previewBtn, idx === formPrayers.length - 1 && frm.previewBtnDisabled]}
                            onPress={() => moveDown(idx)}
                          >
                            <Text style={frm.previewBtnText}>↓</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
            <View style={mod.footer}>
              <TouchableOpacity style={mod.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={mod.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={mod.saveBtn} onPress={saveForm}>
                <Text style={mod.saveText}>{editId ? '수정 완료' : '그룹 만들기'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScreenWrapper>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f3ef' },
  header:    { backgroundColor: GREEN, padding: 20, paddingBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: '500', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  scrollContent: { padding: 16, paddingBottom: 100 },
  emptyBox:  { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48 },
  emptyTitle:{ fontSize: 16, color: '#666', fontWeight: '500', marginTop: 16 },
  emptyDesc: { fontSize: 13, color: '#aaa', marginTop: 8 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  colorDot:   { width: 14, height: 14, borderRadius: 7 },
  groupName:  { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  groupDesc:  { fontSize: 12, color: '#888', marginTop: 2 },
  countBadge: { fontSize: 12, color: '#aaa', paddingHorizontal: 6 },

  cardBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)', padding: 12 },
  prayerRow:{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  prayerNum:{ fontSize: 12, color: '#aaa', width: 20, textAlign: 'center' },
  prayerDot:{ width: 8, height: 8, borderRadius: 4 },
  prayerTitle: { flex: 1, fontSize: 14, color: '#333' },
  prayerMoves: { flexDirection: 'row', gap: 4 },
  moveBtn: { padding: 4, borderRadius: 4, backgroundColor: '#f0f0f0' },
  moveBtnDisabled: { opacity: 0.3 },
  moveBtnText: { fontSize: 13, color: '#555' },

  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#f4f3ef', alignItems: 'center',
  },
  actionBtnDel:  { backgroundColor: '#FFEBEE' },
  actionBtnPlay: { backgroundColor: GREEN },
  actionBtnText: { fontSize: 13, fontWeight: '500', color: '#555' },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28, backgroundColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
});

const pl = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f3ef' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  closeBtn:  { padding: 8 },
  groupName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1, textAlign: 'center' },
  progress:  { fontSize: 13, color: '#888' },
  progBar:   { height: 3, backgroundColor: '#e0e0e0', marginHorizontal: 16 },
  progFill:  { height: 3, backgroundColor: GREEN },
  body:      { flex: 1 },
  bodyContent: { padding: 24 },
  prayerTitle:  { fontSize: 22, fontWeight: '600', color: '#1a1a1a', marginBottom: 20, lineHeight: 30 },
  prayerContent:{ fontSize: 16, color: '#444', lineHeight: 28 },
  footer:    { flexDirection: 'row', padding: 20, gap: 12 },
  navBtn:    { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#f0f0f0' },
  navBtnPrev:{ },
  navBtnNext:{ backgroundColor: GREEN },
  navBtnDone:{ backgroundColor: '#4A9B6F' },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 15, color: '#555', fontWeight: '500' },

  done:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  doneIcon:  { fontSize: 60, color: GREEN, marginBottom: 20 },
  doneTitle: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  doneSub:   { fontSize: 14, color: '#888' },
  doneBtn:   { marginTop: 32, backgroundColor: GREEN, borderRadius: 24, paddingHorizontal: 32, paddingVertical: 14 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

const mod = StyleSheet.create({
  bg:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:  { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, flex: 1 },
  handle: { width: 36, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  title:  { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  body:   { flex: 1, paddingHorizontal: 20 },  // flex:1 → ScrollView가 남은 공간 채워 스크롤 가능
  footer: { flexDirection: 'row', gap: 10, padding: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelText: { fontSize: 14, color: '#666', fontWeight: '500' },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: GREEN, alignItems: 'center' },
  saveText: { fontSize: 14, color: '#fff', fontWeight: '600' },
});

const frm = StyleSheet.create({
  label:     { fontSize: 13, fontWeight: '500', color: '#555', marginBottom: 6, marginTop: 14 },
  input:     { backgroundColor: '#f4f3ef', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#1a1a1a', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  colorRow:  { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorBtn:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorBtnActive: { borderWidth: 3, borderColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f4f3ef', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a1a', padding: 0 },
  prayerList:{ },
  pItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.05)' },
  pItemSelected: { backgroundColor: '#f0f8f0' },
  pDot:      { width: 8, height: 8, borderRadius: 4 },
  pTitle:    { fontSize: 14, color: '#1a1a1a' },
  pCat:      { fontSize: 11, color: '#aaa', marginTop: 1 },
  orderBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  orderBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  emptyText: { textAlign: 'center', padding: 16, fontSize: 13, color: '#bbb' },

  preview:    { marginTop: 14, backgroundColor: '#f0f8f0', borderRadius: 10, padding: 12 },
  previewLabel:{ fontSize: 12, color: GREEN, fontWeight: '600', marginBottom: 8 },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  previewNum: { fontSize: 12, color: '#aaa', width: 20 },
  previewTitle: { flex: 1, fontSize: 13, color: '#333' },
  previewMoves: { flexDirection: 'row', gap: 4 },
  previewBtn: { padding: 4, borderRadius: 4, backgroundColor: '#fff' },
  previewBtnDisabled: { opacity: 0.3 },
  previewBtnText: { fontSize: 12, color: '#555' },
});
