import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';

import App from './App';
import { snoozeAlarm } from './src/utils/notifications';

// 백그라운드/종료 상태에서 알림 버튼 처리
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;
  if (type === EventType.ACTION_PRESS) {
    if (pressAction?.id === 'snooze' && notification) {
      await snoozeAlarm(
        notification.id ?? 'unknown',
        notification.title ?? '🙏 기도 시간',
        notification.body ?? '기도 시간입니다',
      );
    }
    // 확인 또는 다시알림 모두 원래 알림 닫기
    if (notification?.id) {
      await notifee.cancelNotification(notification.id);
    }
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
