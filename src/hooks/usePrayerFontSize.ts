/**
 * usePrayerFontSize
 * 두 손가락 핀치 제스처로 기도문 글씨 크기를 조절하는 커스텀 훅
 * - MMKV로 설정값 영구 저장
 * - 핀치 아웃(벌리기) → 글씨 커짐 / 핀치 인(모으기) → 글씨 작아짐
 */
import { useRef, useState, useCallback } from 'react';
import { PanResponder, GestureResponderEvent } from 'react-native';
import { mmkv } from '../utils/storage';

const STORAGE_KEY = 'prayer_font_size';
const DEFAULT_SIZE = 15;
const MIN_SIZE = 12;
const MAX_SIZE = 28;
// 이 픽셀 이상 변해야 한 단계 조절
const STEP_THRESHOLD = 8;

function getTwoFingerDistance(evt: GestureResponderEvent): number | null {
  const { touches } = evt.nativeEvent;
  if (touches.length < 2) return null;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function usePrayerFontSize() {
  // 저장된 값 읽기 (없으면 DEFAULT_SIZE)
  const [fontSize, setFontSizeState] = useState<number>(() => {
    const saved = mmkv.getNumber(STORAGE_KEY);
    return saved != null ? saved : DEFAULT_SIZE;
  });

  const fontSizeRef = useRef(fontSize);
  const lastDistRef = useRef<number | null>(null);
  const accDeltaRef = useRef<number>(0);

  const setFontSize = useCallback((size: number) => {
    const clamped = Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));
    fontSizeRef.current = clamped;
    mmkv.set(STORAGE_KEY, clamped);
    setFontSizeState(clamped);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      // 두 손가락일 때만 제스처 처리
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: (e) => {
        const dist = getTwoFingerDistance(e);
        lastDistRef.current = dist;
        accDeltaRef.current = 0;
      },

      onPanResponderMove: (e) => {
        const dist = getTwoFingerDistance(e);
        if (dist === null || lastDistRef.current === null) return;

        const delta = dist - lastDistRef.current;
        accDeltaRef.current += delta;

        if (Math.abs(accDeltaRef.current) >= STEP_THRESHOLD) {
          const steps = Math.floor(Math.abs(accDeltaRef.current) / STEP_THRESHOLD);
          const direction = accDeltaRef.current > 0 ? 1 : -1;
          setFontSize(fontSizeRef.current + steps * direction);
          accDeltaRef.current = accDeltaRef.current % STEP_THRESHOLD;
        }

        lastDistRef.current = dist;
      },

      onPanResponderRelease: () => {
        lastDistRef.current = null;
        accDeltaRef.current = 0;
      },

      onPanResponderTerminate: () => {
        lastDistRef.current = null;
        accDeltaRef.current = 0;
      },
    })
  ).current;

  return {
    fontSize,
    panHandlers: panResponder.panHandlers,
    resetFontSize: () => setFontSize(DEFAULT_SIZE),
  };
}
