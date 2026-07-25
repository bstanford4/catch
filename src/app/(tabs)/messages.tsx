import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Screen } from '@/components/ui/screen';
import { messageThreads } from '@/data/demo';
import { colors, radius, spacing } from '@/constants/theme';

export default function MessagesScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>KEEP THE PLAN MOVING</Text>
          <Text style={styles.title}>Messages</Text>
        </View>
        <Pressable accessibilityLabel="Message settings" style={styles.headerButton}>
          <Ionicons color={colors.forest} name="settings-outline" size={20} />
        </Pressable>
      </View>

      <View style={styles.notice}>
        <Ionicons color={colors.orangeDark} name="lock-closed" size={17} />
        <Text style={styles.noticeText}>Chat stays attached to a proposal or catch.</Text>
      </View>

      <View style={styles.list}>
        {messageThreads.map((thread) => (
          <Pressable
            accessibilityLabel={`${thread.name}. ${thread.preview}`}
            key={thread.id}
            style={({ pressed }) => [styles.thread, pressed && styles.pressed]}>
            <Avatar
              initials={thread.initials}
              size={52}
              tone={thread.system ? 'green' : 'gold'}
            />
            <View style={styles.threadContent}>
              <View style={styles.threadHeading}>
                <Text numberOfLines={1} style={styles.threadName}>
                  {thread.name}
                </Text>
                <Text style={styles.timestamp}>{thread.timestamp}</Text>
              </View>
              <Text style={styles.context}>{thread.context}</Text>
              <Text numberOfLines={1} style={styles.preview}>
                {thread.preview}
              </Text>
            </View>
            {thread.unread ? (
              <View style={styles.unread}>
                <Text style={styles.unreadText}>{thread.unread}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  eyebrow: {
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.paper,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleOrange,
    padding: 13,
  },
  noticeText: {
    color: colors.orangeDark,
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    marginTop: spacing.md,
  },
  thread: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 94,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 15,
  },
  pressed: {
    opacity: 0.76,
  },
  threadContent: {
    flex: 1,
    gap: 2,
  },
  threadHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  threadName: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  timestamp: {
    color: colors.muted,
    fontSize: 11,
  },
  context: {
    color: colors.orangeDark,
    fontSize: 11,
    fontWeight: '800',
  },
  preview: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  unread: {
    minWidth: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.orange,
  },
  unreadText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
});

