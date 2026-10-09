import { X } from 'lucide-react-native';
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface DialogProps {
  visible: boolean;
  title: string;
  /** Optional line under the title. */
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Sticky footer (buttons). On phones each button stretches to share the width. */
  footer?: ReactNode;
  maxWidth?: number;
}

/** Unwrap a fragment so the footer buttons can be laid out individually. */
function footerChildren(footer: ReactNode): ReactNode[] {
  if (isValidElement<{ children?: ReactNode }>(footer) && footer.type === Fragment) {
    return Children.toArray(footer.props.children);
  }
  return Children.toArray(footer);
}

/**
 * Centered dialog on tablets/desktop, bottom sheet with a grab handle on phones.
 * The body scrolls, the header and footer stay put, the keyboard never covers the footer.
 */
export function Dialog({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = 520,
}: DialogProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { isMobile } = useBreakpoint();
  const { height: windowHeight } = useWindowDimensions();
  const sheetStyle = isMobile
    ? {
        width: '100%' as const,
        maxHeight: Math.round(windowHeight * 0.92),
        borderTopLeftRadius: theme.radii.xl,
        borderTopRightRadius: theme.radii.xl,
        paddingBottom: Math.max(insets.bottom, 8),
      }
    : {
        width: '100%' as const,
        maxWidth,
        maxHeight: Math.round(windowHeight * 0.9),
        borderRadius: theme.radii.xl,
      };
  const buttons = footer ? footerChildren(footer) : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isMobile ? 'slide' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.root, isMobile ? styles.bottom : styles.center]}>
        <Pressable
          accessibilityLabel={t('common.closeDialog')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.kav, isMobile ? null : { alignItems: 'center' }]}
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface, shadowColor: '#000' },
              sheetStyle,
            ]}
          >
            {isMobile ? (
              <View style={styles.handleWrap}>
                <View style={[styles.handle, { backgroundColor: theme.colors.borderStrong }]} />
              </View>
            ) : null}
            <View
              style={[
                styles.header,
                { borderBottomColor: theme.colors.border, paddingTop: isMobile ? 6 : 16 },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="heading" accessibilityRole="header">
                  {title}
                </Text>
                {subtitle ? (
                  <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={8}
                style={[styles.closeButton, { borderRadius: theme.radii.full }]}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.body, isMobile ? { padding: 16 } : null]}
              style={styles.scroll}
            >
              {children}
            </ScrollView>
            {buttons.length > 0 ? (
              <View
                style={[
                  styles.footer,
                  { borderTopColor: theme.colors.border },
                  isMobile ? styles.footerMobile : null,
                ]}
              >
                {isMobile
                  ? buttons.map((child, i) => (
                      <View key={i} style={styles.footerCell}>
                        {isValidElement(child)
                          ? cloneElement(child as ReactElement<{ fullWidth?: boolean }>, {
                              fullWidth: true,
                            })
                          : child}
                      </View>
                    ))
                  : buttons}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  bottom: { justifyContent: 'flex-end' },
  kav: { width: '100%', maxHeight: '100%' },
  sheet: {
    overflow: 'hidden',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  handleWrap: { alignItems: 'center', paddingTop: 8 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  // RN defaults to flexShrink 0; without this the scroll area overflows the sheet instead of scrolling.
  scroll: { flexGrow: 0, flexShrink: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeButton: { padding: 6 },
  body: { padding: 20, gap: 16 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  footerMobile: { paddingHorizontal: 16, paddingVertical: 12 },
  footerCell: { flex: 1 },
});
