import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useDailyBible } from '../hooks/useDailyBible';

const GREEN = '#2D5016';

interface Props {
  prayerId: string;
}

export const BiblePrayerContent: React.FC<Props> = ({ prayerId }) => {
  const { data, loading, error, retry } = useDailyBible();

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>불러오는 중…</Text>
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>불러오지 못했습니다</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={retry}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isGospel = prayerId === 'bible-gospel';
  const section = isGospel
    ? data.gospel
    : data.readings.length > 0
      ? {
          book: data.readings[0].book,
          content: data.readings.map(r =>
            data.readings.length > 1 ? `【${r.title}】\n${r.content}` : r.content
          ).join('\n\n'),
        }
      : null;

  if (!section?.content) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>내용을 파싱하지 못했습니다</Text>
      </View>
    );
  }

  return (
    <View>
      {section.book ? <Text style={styles.book}>{section.book}</Text> : null}
      <Text style={styles.content}>{section.content}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center:    { alignItems: 'center', paddingVertical: 30 },
  hint:      { fontSize: 14, color: '#999', marginBottom: 12 },
  retryBtn:  { backgroundColor: GREEN, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: '#fff', fontSize: 13 },
  book:      { fontSize: 13, color: '#888', marginBottom: 10 },
  content:   { fontSize: 15, color: '#333', lineHeight: 24 },
});
