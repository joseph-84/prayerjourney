import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, Modal, TextInput, Share, ActivityIndicator,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useAppContext } from '../../hooks/useAppData';
import { clearAll, savePrayers, saveGroups, saveCompletions, saveTodayList } from '../../utils/storage';
import {
  loadNotifSettings,
  saveNotifSettings,
  requestNotifPermission,
  requestExactAlarmPermission,
  scheduleAlarms,
  cancelAllAlarms,
} from '../../utils/notifications';
import { N8N_BASE_URL } from '../../config';

const GREEN = '#2D5016';
const BACKUP_SERVER = N8N_BASE_URL;

function showToastMsg(setter: (msg: string) => void, msg: string) {
  setter(msg);
  setTimeout(() => setter(''), 3000);
}

export default function SettingsScreen() {
  const { prayers, groups, completions, todayList, setTodayList } = useAppContext();

  // 알림 설정 – MMKV 에서 초기값 로드
  const initNotif = loadNotifSettings();
  const [notifEnabled, setNotifEnabled] = useState(initNotif.enabled);
  const [notifSound,   setNotifSound]   = useState(initNotif.sound);
  const [notifVibrate, setNotifVibrate] = useState(initNotif.vibrate);
  const [toast,        setToast]        = useState('');

  // 서버 내보내기 모달
  const [exportModal,   setExportModal]   = useState(false);
  const [exportCode,    setExportCode]    = useState('');
  const [exportExpiry,  setExportExpiry]  = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // 서버 가져오기 모달
  const [importModal,   setImportModal]   = useState(false);
  const [importCode,    setImportCode]    = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [pasteHint,     setPasteHint]     = useState('');

  const toast$ = (msg: string) => showToastMsg(setToast, msg);

  // ── 알림 토글 핸들러 ─────────────────────────────────────────────
  const handleNotifEnabled = async (val: boolean) => {
    setNotifEnabled(val);
    saveNotifSettings(val, notifSound, notifVibrate);
    if (val) {
      const granted = await requestNotifPermission();
      if (!granted) {
        toast$('알림 권한이 필요합니다. 시스템 설정에서 허용해주세요.');
        setNotifEnabled(false);
        saveNotifSettings(false, notifSound, notifVibrate);
        return;
      }
      await scheduleAlarms(todayList, prayers, groups, notifSound, notifVibrate);
      toast$(`알림이 켜졌습니다. ${todayList.length}개의 기도 알람이 설정되었습니다.`);
    } else {
      await cancelAllAlarms();
      toast$('알림이 꺼졌습니다.');
    }
  };

  const handleNotifSound = async (val: boolean) => {
    setNotifSound(val);
    saveNotifSettings(notifEnabled, val, notifVibrate);
    if (notifEnabled) {
      await scheduleAlarms(todayList, prayers, groups, val, notifVibrate);
    }
  };

  const handleNotifVibrate = async (val: boolean) => {
    setNotifVibrate(val);
    saveNotifSettings(notifEnabled, notifSound, val);
    if (notifEnabled) {
      await scheduleAlarms(todayList, prayers, groups, notifSound, val);
    }
  };

  // ── 통계 ────────────────────────────────────────────────────────
  const totalPrayers    = prayers.length;
  const userPrayers     = prayers.filter(p => p.source === 'user').length;
  const totalGroups     = groups.length;
  const completionDays  = Object.keys(completions).length;
  const totalCompletions = Object.values(completions).reduce((s, arr) => s + arr.length, 0);

  // ── 서버 내보내기 ────────────────────────────────────────────────
  const handleServerExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`${BACKUP_SERVER}/webhook/mgido-export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prayers, groups, completions, todayList }),
      });
      if (!res.ok) throw new Error(`서버 오류 ${res.status}`);
      const { code, expiresAt } = await res.json();
      setExportCode(code);
      setExportExpiry(new Date(expiresAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }));
      setExportModal(true);
    } catch {
      toast$('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        title: '기도여정 백업 비밀번호',
        message: `기도여정 백업 비밀번호: ${exportCode}\n유효기간: ${exportExpiry}까지\n\n앱 설정 → 서버에서 가져오기에서 입력하세요.`,
      });
    } catch {}
  };

  // ── 서버 가져오기 ────────────────────────────────────────────────
  const handleServerImport = async () => {
    const code = importCode.trim().toUpperCase();
    if (code.length < 6) { toast$('비밀번호를 입력해주세요.'); return; }
    setImportLoading(true);
    try {
      const res = await fetch(`${BACKUP_SERVER}/webhook/mgido-import?code=${code}`);
      if (res.status === 404) throw new Error('not_found');
      if (!res.ok) throw new Error(`server_${res.status}`);
      const raw = await res.json();

      let parsed: any = raw;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      if (!parsed.prayers && !parsed.groups) {
        const firstItem = parsed[0] ?? parsed['0'];
        if (firstItem != null) {
          const inner = firstItem.data ?? firstItem;
          parsed = typeof inner === 'string' ? JSON.parse(inner) : inner;
        } else if (parsed.data != null) {
          parsed = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
        }
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('empty_data');

      if (parsed.prayers)     savePrayers(parsed.prayers);
      if (parsed.groups)      saveGroups(parsed.groups);
      if (parsed.completions) saveCompletions(parsed.completions);
      if (parsed.todayList)   { saveTodayList(parsed.todayList); setTodayList(parsed.todayList); }

      setImportModal(false);
      setImportCode('');
      toast$('서버에서 데이터를 복원했습니다. 앱을 재시작하면 적용됩니다.');
    } catch (e: any) {
      if (e?.message === 'not_found') {
        toast$('비밀번호가 올바르지 않거나 만료되었습니다.');
      } else if (e?.message === 'empty_data') {
        toast$('서버에서 데이터를 받았지만 내용이 비어 있습니다.');
      } else {
        toast$('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setImportLoading(false);
    }
  };

  // ── 데이터 내보내기 (파일 저장) ──────────────────────────────────
  const handleExport = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      prayers, groups, completions, todayList,
    };
    const json = JSON.stringify(data, null, 2);
    const filename = `기도여정-백업-${new Date().toISOString().slice(0, 10)}.json`;

    try {
      const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!perm.granted) return;

      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        perm.directoryUri,
        filename,
        'application/json',
      );
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      toast$(`저장 완료: ${filename}`);
    } catch (e: any) {
      if (!e?.message?.includes('cancel')) {
        toast$('내보내기 중 오류가 발생했습니다.');
      }
    }
  };

  // ── 데이터 가져오기 (파일 선택) ───────────────────────────────────
  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const uri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        // 기도문 배열만 있는 파일
        savePrayers(parsed);
        toast$(`기도문 ${parsed.length}개를 가져왔습니다.`);
      } else if (parsed.prayers) {
        // 전체 백업 파일
        savePrayers(parsed.prayers);
        if (parsed.groups)      saveGroups(parsed.groups);
        if (parsed.completions) saveCompletions(parsed.completions);
        if (parsed.todayList)   { saveTodayList(parsed.todayList); setTodayList(parsed.todayList); }
        toast$('백업을 복원했습니다. 앱을 재시작하면 완전히 적용됩니다.');
      } else {
        toast$('지원하지 않는 파일 형식입니다.');
      }
    } catch (e: any) {
      if (!e?.message?.includes('cancel')) {
        toast$('파일을 읽는 중 오류가 발생했습니다.');
      }
    }
  };

  // ── 전체 초기화 ──────────────────────────────────────────────────
  const handleClearData = () => {
    Alert.alert(
      '전체 데이터 초기화',
      '모든 데이터(완료 기록, 사용자 추가 기도문, 그룹, 오늘 목록)를 초기화할까요?\n이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: () => {
            clearAll();
            toast$('초기화 완료. 앱을 재시작하면 적용됩니다.');
          },
        },
      ]
    );
  };

  return (
    <ScreenWrapper statusBarColor={GREEN} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>설정</Text>
          <Text style={styles.headerSub}>앱 환경 설정</Text>
        </View>

        {/* 통계 */}
        <Text style={styles.sectionLabel}>기도 통계</Text>
        <View style={styles.statsRow}>
          {[
            { num: totalPrayers,    label: '전체\n기도문' },
            { num: userPrayers,     label: '내가\n추가한' },
            { num: totalGroups,     label: '기도\n그룹' },
            { num: completionDays,  label: '기도한\n날' },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statNum}>{s.num}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* 알림 */}
        <Text style={styles.sectionLabel}>알림</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.rowEmoji}>🔔</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>기도 알림</Text>
              <Text style={styles.rowDesc}>스케줄된 기도 시간에 알림</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={handleNotifEnabled}
              trackColor={{ false: '#ccc', true: GREEN }}
              thumbColor="#fff"
            />
          </View>
          {notifEnabled && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: '#F3E5F5' }]}>
                  <Text style={styles.rowEmoji}>🔊</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>알림음</Text>
                </View>
                <Switch
                  value={notifSound}
                  onValueChange={handleNotifSound}
                  trackColor={{ false: '#ccc', true: GREEN }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={styles.rowEmoji}>📳</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>진동</Text>
                </View>
                <Switch
                  value={notifVibrate}
                  onValueChange={handleNotifVibrate}
                  trackColor={{ false: '#ccc', true: GREEN }}
                  thumbColor="#fff"
                />
              </View>
            </>
          )}
        </View>

        {/* 데이터 */}
        <Text style={styles.sectionLabel}>데이터</Text>
        <View style={styles.group}>
          <TouchableOpacity style={styles.row} onPress={handleExport}>
            <View style={[styles.rowIcon, { backgroundColor: '#FFF8E1' }]}>
              <Text style={styles.rowEmoji}>📤</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>데이터 내보내기</Text>
              <Text style={styles.rowDesc}>기도문·그룹·기록을 JSON 파일로 저장</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleImportFile}>
            <View style={[styles.rowIcon, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.rowEmoji}>📂</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>데이터 가져오기</Text>
              <Text style={styles.rowDesc}>백업 JSON 파일에서 복원</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* 서버 백업 */}
        <Text style={styles.sectionLabel}>서버 백업 (7일 보관)</Text>
        <View style={styles.group}>
          <TouchableOpacity style={styles.row} onPress={handleServerExport} disabled={exportLoading}>
            <View style={[styles.rowIcon, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.rowEmoji}>☁️</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>서버로 내보내기</Text>
              <Text style={styles.rowDesc}>비밀번호를 받아 다른 기기에서 복원</Text>
            </View>
            {exportLoading
              ? <ActivityIndicator size="small" color={GREEN} />
              : <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />}
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => { setImportModal(true); setImportCode(''); setPasteHint(''); }}>
            <View style={[styles.rowIcon, { backgroundColor: '#EDE7F6' }]}>
              <Text style={styles.rowEmoji}>☁️</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>서버에서 가져오기</Text>
              <Text style={styles.rowDesc}>비밀번호를 입력해 데이터 복원</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* 관리 */}
        <Text style={styles.sectionLabel}>관리</Text>
        <View style={styles.group}>
          <TouchableOpacity style={styles.row} onPress={handleClearData}>
            <View style={[styles.rowIcon, { backgroundColor: '#FFEBEE' }]}>
              <Text style={styles.rowEmoji}>🗑️</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: '#E86B5E' }]}>전체 데이터 초기화</Text>
              <Text style={styles.rowDesc}>모든 기록 및 설정이 삭제됩니다</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* 앱 정보 */}
        <Text style={styles.sectionLabel}>정보</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: '#F3E5F5' }]}>
              <Text style={styles.rowEmoji}>🙏</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>기도여정</Text>
              <Text style={styles.rowDesc}>버전 2.0.0 (React Native)</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.rowEmoji}>📖</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>기도문 출처</Text>
              <Text style={styles.rowDesc}>한국 천주교 주교회의 공인 기도문</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.rowEmoji}>💾</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>누적 기도 완료</Text>
              <Text style={styles.rowDesc}>총 {totalCompletions}회 기도 완료 기록</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 토스트 */}
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* ── 서버 내보내기 결과 모달 ── */}
      <Modal visible={exportModal} transparent animationType="fade" onRequestClose={() => setExportModal(false)}>
        <TouchableOpacity style={dlg.bg} activeOpacity={1} onPress={() => setExportModal(false)}>
          <TouchableOpacity style={dlg.card} activeOpacity={1}>
            <Text style={dlg.title}>📤 서버 내보내기 완료</Text>
            <Text style={dlg.desc}>아래 비밀번호로 7일 안에 복원할 수 있습니다.</Text>
            <View style={dlg.codeBox}>
              <Text style={dlg.code}>{exportCode}</Text>
            </View>
            <Text style={dlg.expiry}>유효기간: {exportExpiry}까지</Text>
            <TouchableOpacity style={dlg.shareBtn} onPress={handleShareCode}>
              <MaterialCommunityIcons name="share-variant" size={16} color="#fff" />
              <Text style={dlg.shareBtnText}>공유하기 (카카오·문자 등)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dlg.closeBtn} onPress={() => setExportModal(false)}>
              <Text style={dlg.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 서버 가져오기 모달 ── */}
      <Modal visible={importModal} transparent animationType="fade" onRequestClose={() => { if (!importLoading) setImportModal(false); }}>
        <TouchableOpacity style={dlg.bg} activeOpacity={1} onPress={() => { if (!importLoading) setImportModal(false); }}>
          <TouchableOpacity style={dlg.card} activeOpacity={1}>
            <Text style={dlg.title}>☁️ 서버에서 가져오기</Text>
            <Text style={dlg.desc}>서버 내보내기 시 받은 비밀번호를 입력하세요.</Text>
            <TextInput
              style={dlg.codeInput}
              placeholder="비밀번호 (예: A3BKPX7M)"
              placeholderTextColor="#bbb"
              value={importCode}
              onChangeText={t => setImportCode(t.toUpperCase())}
              maxLength={12}
              autoCapitalize="characters"
              editable={!importLoading}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleServerImport}
            />
            {pasteHint ? (
              <Text style={[dlg.hint, pasteHint.startsWith('✓') ? dlg.hintOk : dlg.hintWarn]}>
                {pasteHint}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[dlg.shareBtn, importLoading && dlg.btnDisabled]}
              onPress={handleServerImport}
              disabled={importLoading || importCode.trim().length < 6}
            >
              {importLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={dlg.shareBtnText}>가져오기</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[dlg.closeBtn, importLoading && dlg.btnDisabled]}
              onPress={() => setImportModal(false)}
              disabled={importLoading}
            >
              <Text style={dlg.closeBtnText}>취소</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScreenWrapper>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f4f3ef' },
  scrollContent:{ paddingBottom: 40 },

  header:       { backgroundColor: GREEN, padding: 20, paddingBottom: 24 },
  headerTitle:  { fontSize: 22, fontWeight: '500', color: '#fff' },
  headerSub:    { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  sectionLabel: {
    fontSize: 11, fontWeight: '500', color: '#888',
    letterSpacing: 0.8, textTransform: 'uppercase',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },

  statsRow:  { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  statCard:  {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)',
  },
  statNum:   { fontSize: 22, fontWeight: '500', color: GREEN, lineHeight: 26 },
  statLabel: { fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 4, lineHeight: 14 },

  group: {
    marginHorizontal: 16, backgroundColor: '#fff',
    borderRadius: 14, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.06)', marginLeft: 68 },
  row:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowEmoji:{ fontSize: 18 },
  rowText: { flex: 1 },
  rowTitle:{ fontSize: 15, color: '#1a1a1a' },
  rowDesc: { fontSize: 12, color: '#999', marginTop: 2 },

  toast: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    backgroundColor: '#1a1a1a', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 24,
  },
  toastText: { color: '#fff', fontSize: 13 },
});

const dlg = StyleSheet.create({
  bg:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%' },
  title:{ fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  codeBox: { backgroundColor: '#f4f3ef', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 8 },
  code: { fontSize: 28, fontWeight: '700', color: GREEN, letterSpacing: 4 },
  expiry: { fontSize: 12, color: '#aaa', textAlign: 'center', marginBottom: 20 },
  codeInput: {
    backgroundColor: '#f4f3ef', borderRadius: 12, padding: 14,
    fontSize: 18, color: '#1a1a1a', textAlign: 'center',
    letterSpacing: 3, fontWeight: '600', marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.1)',
  },
  hint:    { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  hintOk:  { color: '#4A9B6F' },
  hintWarn:{ color: '#E86B5E' },
  shareBtn: {
    backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
    marginBottom: 8,
  },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  closeBtn: {
    backgroundColor: '#f0f0f0', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: { color: '#666', fontSize: 15, fontWeight: '500' },
  btnDisabled:  { opacity: 0.5 },
});
