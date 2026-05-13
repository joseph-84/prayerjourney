import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  children: React.ReactNode;
  statusBarColor?: string; // 상태바 뒤에 깔릴 배경색 (기본: 검정)
  style?: ViewStyle;
}

/**
 * Android 16 edge-to-edge 대응 래퍼
 * - 상태바 높이만큼 statusBarColor 배경을 상단에 렌더링
 * - 하단은 탭 네비게이터가 처리하므로 별도 처리 없음
 */
export default function ScreenWrapper({
  children,
  statusBarColor = '#000000',
  style,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, style]}>
      <View style={{ height: insets.top, backgroundColor: statusBarColor }} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  content: { flex: 1 },
});
