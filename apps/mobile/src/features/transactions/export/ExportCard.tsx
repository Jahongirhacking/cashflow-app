import { Download, FileSpreadsheet, Tags } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';
import { getUserMessage } from '@/lib/api';
import { downloadFile } from '@/lib/api/download';
import { useTheme } from '@/theme';
import { useExportCategories, useSaveExportMap } from './api';
import { ExportMapDialog } from './ExportMapDialog';

/** Settings → Data: download every transaction as .xlsx in the import layout, with renamed categories. */
export function ExportCard() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const settings = useExportCategories();
  const save = useSaveExportMap();
  const renamed = settings.data
    ? Object.entries(settings.data.map).filter(
        ([app, file]) => file.trim().toLowerCase() !== app.toLowerCase(),
      ).length
    : 0;

  const run = async () => {
    setBusy(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadFile('/transactions/export', `finance-transactions-${stamp}.xlsx`);
      toast.success(t('export.done'));
    } catch (error) {
      toast.error(getUserMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionHeader title={t('export.title')} subtitle={t('export.subtitle')} />
      <View style={styles.row}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.full },
          ]}
        >
          <FileSpreadsheet size={20} color={theme.colors.textSecondary} />
        </View>
        <Text variant="caption" color="textSecondary" style={{ flex: 1, minWidth: 0 }}>
          {t('export.body')}
        </Text>
      </View>
      <View style={[styles.mapRow, { marginTop: theme.spacing.md }]}>
        <Tags size={16} color={theme.colors.textSecondary} />
        <Text variant="caption" color="textSecondary" style={{ flex: 1, minWidth: 0 }}>
          {renamed > 0 ? t('export.mapStatus', { count: renamed }) : t('export.mapNone')}
        </Text>
        <Button
          title={t('export.mapEdit')}
          size="sm"
          variant="ghost"
          onPress={() => setMapOpen(true)}
          disabled={settings.isPending}
        />
      </View>
      <View style={{ marginTop: theme.spacing.md }}>
        <Button
          title={t('export.download')}
          icon={Download}
          variant="secondary"
          onPress={() => void run()}
          loading={busy}
        />
      </View>
      <ExportMapDialog
        visible={mapOpen}
        settings={settings.data}
        saving={save.isPending}
        onClose={() => setMapOpen(false)}
        onSave={(map) =>
          save.mutate(map, {
            onSuccess: () => {
              toast.success(t('export.mapSaved'));
              setMapOpen(false);
            },
            onError: (e) => toast.error(getUserMessage(e)),
          })
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
