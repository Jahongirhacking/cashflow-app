import type { ExportCategorySettings } from '@finance/shared';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

export interface ExportMapDialogProps {
  visible: boolean;
  settings: ExportCategorySettings | undefined;
  saving: boolean;
  onClose: () => void;
  onSave: (map: Record<string, string>) => void;
}

/**
 * One row per app category with the name it gets in the Excel file. Several app categories may
 * share the same Excel name; an empty field means "keep the app name".
 */
export function ExportMapDialog({
  visible,
  settings,
  saving,
  onClose,
  onSave,
}: ExportMapDialogProps) {
  const theme = useTheme();
  const t = useT();
  const [draft, setDraft] = useState<Record<string, string>>({});
  // Seed the draft from the saved map each time the dialog opens (or when settings arrive while open).
  const [source, setSource] = useState<ExportCategorySettings | undefined>(undefined);
  if (visible && settings && source !== settings) {
    setSource(settings);
    setDraft(settings.map);
  } else if (!visible && source) {
    setSource(undefined);
  }

  const groups = useMemo(() => {
    const cats = settings?.categories ?? [];
    return [
      { type: 'EXPENSE' as const, items: cats.filter((c) => c.type === 'EXPENSE') },
      { type: 'INCOME' as const, items: cats.filter((c) => c.type === 'INCOME') },
    ].filter((g) => g.items.length > 0);
  }, [settings]);
  // Quick picks: names already used in the file, plus whatever the user typed in other rows.
  const picks = useMemo(() => {
    const names = new Set<string>(settings?.fileNames ?? []);
    for (const v of Object.values(draft)) if (v.trim()) names.add(v.trim());
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [settings, draft]);
  const renamed = Object.entries(draft).filter(
    ([app, file]) => file.trim() && file.trim().toLowerCase() !== app.toLowerCase(),
  ).length;

  const submit = () => {
    const map: Record<string, string> = {};
    for (const [app, file] of Object.entries(draft)) if (file.trim()) map[app] = file.trim();
    onSave(map);
  };

  return (
    <Dialog
      visible={visible}
      title={t('export.mapTitle')}
      subtitle={t('export.mapSubtitle')}
      onClose={onClose}
      maxWidth={620}
      footer={
        <>
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} disabled={saving} />
          <Button
            title={t('export.mapSave', { count: renamed })}
            onPress={submit}
            loading={saving}
            disabled={!settings}
          />
        </>
      }
    >
      {groups.map((g) => (
        <View key={g.type} style={{ gap: 10 }}>
          <Text variant="label" color="textMuted">
            {g.type === 'INCOME' ? t('common.income') : t('common.expenses')}
          </Text>
          {g.items.map((c) => {
            const value = draft[c.name] ?? '';
            const quick = picks.filter((p) => p.toLowerCase() !== c.name.toLowerCase());
            return (
              <View
                key={`${g.type}-${c.name}`}
                style={[
                  styles.row,
                  { borderColor: theme.colors.border, borderRadius: theme.radii.md },
                ]}
              >
                <View style={styles.rowTop}>
                  <Text variant="bodyStrong" style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    →
                  </Text>
                  <View style={{ flex: 1.4, minWidth: 0 }}>
                    <TextField
                      value={value}
                      onChangeText={(text) => setDraft((d) => ({ ...d, [c.name]: text }))}
                      placeholder={c.name}
                      accessibilityLabel={t('export.mapFieldLabel', { name: c.name })}
                      autoCapitalize="sentences"
                    />
                  </View>
                </View>
                {quick.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.chips}
                  >
                    {quick.map((name) => (
                      <Chip
                        key={name}
                        label={name}
                        selected={value.trim().toLowerCase() === name.toLowerCase()}
                        onPress={() => setDraft((d) => ({ ...d, [c.name]: name }))}
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      {!settings ? (
        <Text variant="caption" color="textMuted">
          {t('common.loading')}
        </Text>
      ) : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, padding: 10, gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', gap: 6 },
});
