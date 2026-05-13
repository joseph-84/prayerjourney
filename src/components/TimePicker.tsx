import { useEffect } from 'react';
import { Alert } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

interface TimePickerProps {
  value: string;       // "HH:MM" 24시간 형식
  onChange: (time: string) => void;
  onClose: () => void;
}

export default function TimePicker({ value, onChange, onClose }: TimePickerProps) {
  useEffect(() => {
    const parts = value.split(':').map(Number);
    const hh = parts[0] ?? 9;
    const mm = parts[1] ?? 0;

    const date = new Date();
    date.setHours(hh, mm, 0, 0);

    try {
      DateTimePickerAndroid.open({
        mode: 'time',
        value: date,
        is24Hour: false,
        onChange: (event, selectedDate) => {
          if (event.type === 'set' && selectedDate) {
            const h = selectedDate.getHours();
            const m = selectedDate.getMinutes();
            onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
          }
          onClose();
        },
      });
    } catch (e: any) {
      Alert.alert('TimePicker 오류', String(e?.message ?? e));
      onClose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
