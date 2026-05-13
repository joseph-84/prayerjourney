import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';

import { AppContext, useAppData } from './src/hooks/useAppData';
import Navigation from './src/navigation';
import { requestNotifPermission, requestExactAlarmPermission, rescheduleFromStorage, snoozeAlarm } from './src/utils/notifications';

function AppProviders() {
  const appData = useAppData();

  useEffect(() => {
    // 알림 권한 요청 및 재스케줄
    (async () => {
      const granted = await requestNotifPermission();
      await requestExactAlarmPermission();
      if (granted) await rescheduleFromStorage().catch(() => {});
    })();

    // 포그라운드 상태에서 알림 버튼 처리
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      const { notification, pressAction } = detail;
      if (type === EventType.ACTION_PRESS) {
        if (pressAction?.id === 'snooze' && notification) {
          snoozeAlarm(
            notification.id ?? 'unknown',
            notification.title ?? '🙏 기도 시간',
            notification.body ?? '기도 시간입니다',
          );
        }
        if (notification?.id) {
          notifee.cancelNotification(notification.id);
        }
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AppContext.Provider value={appData}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
        translucent={false}
        animated={false}
      />
      <NavigationContainer>
        <Navigation />
      </NavigationContainer>
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppProviders />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
