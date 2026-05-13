/**
 * usePrayerFontSize
 * 두 손가락 핀치 제스처로 기도문 글씨 크기를 조절하는 커스텀 훅
 * - Gesture.Simultaneous(Native, Pinch)로 ScrollView와 동시 동작
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
  const [fontSize, setFontSizeState] = useState<number>(() => {
    const saved = mmkv.getNumber(STORAGE_KEY);
    return saved ?? DEFAULT_SIZE;
  });

  const currentSizeRef = useRef(fontSize);
  currentSizeRef.current = fontSize;

  const startSizeRef = useRef(fontSize);

  const handlePinchBegin = useCallback(() => {
    startSizeRef.current = currentSizeRef.current;
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

  // Native 제스처와 Pinch를 동시에 실행 → ScrollView 스크롤과 충돌 없음
  const nativeGesture = useMemo(() => Gesture.Native(), []);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          'worklet';
          runOnJS(handlePinchBegin)();
        })
        .onUpdate((e) => {
          'worklet';
          runOnJS(handlePinchUpdate)(e.scale);
        }),
    [handlePinchBegin, handlePinchUpdate],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(nativeGesture, pinchGesture),
    [nativeGesture, pinchGesture],
  );

  return {
    fontSize,
    pinchGesture: composedGesture,
    resetFontSize: () => {
      currentSizeRef.current = DEFAULT_SIZE;
      mmkv.set(STORAGE_KEY, DEFAULT_SIZE);
      setFontSizeState(DEFAULT_SIZE);
    },
  };
}
