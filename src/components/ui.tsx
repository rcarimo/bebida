import { type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, radius } from '../theme';
import { Icon, type IconName } from './Icon';

export function tap(strong = false) {
  void Haptics.impactAsync(strong ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium).catch(
    () => {},
  );
}

export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function T({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[styles.text, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <T style={[styles.label, style]}>{children}</T>;
}

export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
    >
      <Icon name={icon} />
    </Pressable>
  );
}

export function Header({ title, subtitle, onBack, right }: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack && <IconButton icon="back" label="Voltar" onPress={onBack} />}
      <View style={{ flex: 1, gap: 2 }}>
        <T style={styles.headerTitle} numberOfLines={1}>
          {title}
        </T>
        {subtitle ? <T style={styles.muted}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}

type BtnVariant = 'primary' | 'light' | 'outline' | 'dashed' | 'danger';

export function Button({
  title,
  onPress,
  onLongPress,
  delayLongPress,
  icon,
  variant = 'primary',
  height = 80,
  fontSize = 24,
  disabled,
  style,
  subtitle,
}: {
  title: string;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  icon?: IconName;
  variant?: BtnVariant;
  height?: number;
  fontSize?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
}) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      style={({ pressed }) => [
        styles.btn,
        { height, backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border ? 2 : 0 },
        variant === 'dashed' && { borderStyle: 'dashed' },
        pressed && styles.pressed,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <View style={styles.btnRow}>
        {icon && <Icon name={icon} color={v.fg} size={fontSize + 4} strokeWidth={2.6} />}
        <T style={{ color: v.fg, fontSize, fontWeight: '800' }}>{title}</T>
      </View>
      {subtitle ? <T style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{subtitle}</T> : null}
    </Pressable>
  );
}

const variants: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.accent, fg: colors.accentText },
  light: { bg: colors.text, fg: colors.accentText },
  outline: { bg: 'transparent', fg: colors.text, border: colors.border },
  dashed: { bg: 'transparent', fg: colors.accent, border: colors.border },
  danger: { bg: 'transparent', fg: colors.danger, border: colors.border },
};

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoFocus,
  autoCapitalize,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'email-address';
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        onSubmitEditing={onSubmitEditing}
        style={styles.input}
      />
    </View>
  );
}

/** Folha que sobe de baixo, com campos grandes. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <T style={styles.headerTitle}>{title}</T>
          {children}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 18 },
  fill: { flex: 1 },
  text: { color: colors.text, fontSize: 16 },
  muted: { color: colors.muted, fontSize: 15 },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  btn: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16 },
  input: {
    backgroundColor: colors.surface2,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    borderRadius: radius.sm,
    height: 60,
    paddingHorizontal: 16,
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    gap: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
});
