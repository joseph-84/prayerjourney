/**
 * usePrayerFontSize
 * 두 손가락 핀치 제스처로 기도문 글씨 크기를 조절하는 커스텀 훅
 * - 두 손가락이 닿는 순간 스크롤 비활성화 → 방향 무관하게 핀치로 동작
 * - 손가락을 떼면 스크롤 즉시 재활성화
 * - MMKV로 설정값 영구 저장
 */
import { useState, useRef, useMemo, useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { mmkv } from '../utils/storage';

const STORAGE_KEY = 'prayer_font_size';
const DEFAULT_SIZE = 15;
const MIN_SIZE = 12;
const MAX_SIZE = 28;

export function usePrayerFontSize() {
  const [fontSize,      setFontSizeState]  = useState<number>(() => {
    const saved = mmkv.getNumber(STORAGE_KEY);
    return saved ?? DEFAULT_SIZE;
  });
  // 두 손가락이 닿으면 false → ScrollView 스크롤 차단
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const currentSizeRef = useRef(fontSize);
  currentSizeRef.current = fontSize;

  const startSizeRef = useRef(fontSize);

  const handlePinchBegin = useCallback(() => {
    startSizeRef.current = currentSizeRef.current;
    setScrollEnabled(false);   // 두 손가락 인식 즉시 스크롤 차단
  }, []);

  const handlePinchEnd = useCallback(() => {
    setScrollEnabled(true);    // 손가락 떼면 스크롤 재활성화
  }, []);

  const handlePinchUpdate = useCallback((scale: number) => {
    const newSize = Math.max(
      MIN_SIZE,
      Math.min(MAX_SIZE, Math.round(startSizeRef.current * scale)),
    );
    if (newSize !== currentSizeRef.current) {
      currentSizeRef.current = newSize;
      mmkv.set(STORAGE_KEY, newSize);
      setFontSizeState(newSize);
    }
  }, []);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        // onBegin: 손가락 1개도 발생 → 사용 금지
        // onStart: 두 손가락이 인식돼 제스처가 실제로 활성화될 때만 발생
        .onStart(() => {
          'worklet';
          runOnJS(handlePinchBegin)();   // startSize 저장 + scrollEnabled=false
        })
        .onUpdate((e) => {
          'worklet';
          runOnJS(handlePinchUpdate)(e.scale);
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(handlePinchEnd)();     // 성공/실패 모두 scrollEnabled=true 복원
        }),
    [handlePinchBegin, handlePinchUpdate, handlePinchEnd],
  );

  return {
    fontSize,
    scrollEnabled,
    pinchGesture,
    resetFontSize: () => {
      currentSizeRef.current = DEFAULT_SIZE;
      mmkv.set(STORAGE_KEY, DEFAULT_SIZE);
      setFontSizeState(DEFAULT_SIZE);
    },
  };
}
