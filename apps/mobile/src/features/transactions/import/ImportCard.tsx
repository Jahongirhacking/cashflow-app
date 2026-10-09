import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';
import { useCategories } from '@/features/categories/api';
import { formatShortDate } from '@/features/transactions/utils';
import { useT } from '@/i18n';
import { getUserMessage } from '@/lib/api';
import { useTheme } from '@/theme';
import {
  formatMoney,
  formatSignedMoney,
  IMPORT_CHUNK_SIZE,
  type ImportCategoryInfo,
  type ImportPreview,
  type ImportResult,
} from '@finance/shared';
import { useRouter } from 'expo-router';
import { FileSpreadsheet, Upload } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { pickWorkbook, useImportCommit, useImportPreview } from './api';

interface Progress {
  done: number;
  total: number;
}

interface CommitOptions {
  skipDuplicates: boolean;
  createCategories: boolean;
  categoryMap: Record<string, string>;
}

/** Settings → Data: upload an .xlsx export, map its categories 1:1 to the app's, review, then import in chunks. */
export function ImportCard() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const preview = useImportPreview();
  const commit = useImportCommit();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const choose = async () => {
    try {
      const picked = await pickWorkbook();
      if (!picked) return;
      setResult(null);
      preview.mutate(picked, {
        onSuccess: () => setOpen(true),
        onError: (e) => toast.error(getUserMessage(e, t('import.readError'))),
      });
    } catch {
      toast.error(t('import.pickerError'));
    }
  };

  /** Sends the rows in chunks so no single request is large; resumes from the failed chunk on retry. */
  const run = async (
    p: ImportPreview,
    options: CommitOptions,
    startChunk = 0,
    carried?: ImportResult,
  ) => {
    const chunks: ImportPreview['rows'][] = [];
    for (let i = 0; i < p.rows.length; i += IMPORT_CHUNK_SIZE)
      chunks.push(p.rows.slice(i, i + IMPORT_CHUNK_SIZE));
    const total: ImportResult = carried ?? { imported: 0, skipped: 0, categoriesCreated: [] };
    setProgress({ done: startChunk * IMPORT_CHUNK_SIZE, total: p.rows.length });
    for (let c = startChunk; c < chunks.length; c += 1) {
      try {
        const r = await commit.mutateAsync({ rows: chunks[c] ?? [], ...options });
        total.imported += r.imported;
        total.skipped += r.skipped;
        total.categoriesCreated = [
          ...new Set([...total.categoriesCreated, ...r.categoriesCreated]),
        ];
        setProgress({
          done: Math.min(p.rows.length, (c + 1) * IMPORT_CHUNK_SIZE),
          total: p.rows.length,
        });
      } catch (error) {
        setProgress(null);
        toast.error(
          `${getUserMessage(error, t('import.failed'))} ${t('import.alreadyImported', { count: total.imported })}`,
          {
            label: t('import.resume'),
            onPress: () => void run(p, options, c, total),
          },
        );
        return;
      }
    }
    setProgress(null);
    setResult(total);
    setOpen(false);
    toast.success(
      `${t('import.importedToast', { count: total.imported })}${total.skipped ? t('import.skippedToast', { count: total.skipped }) : ''}`,
    );
  };

  return (
    <Card>
      <View style={styles.header}>
        <FileSpreadsheet size={20} color={theme.colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text variant="subheading">{t('import.title')}</Text>
          <Text variant="caption" color="textSecondary">
            {t('import.body')}
          </Text>
        </View>
      </View>
      <View style={[styles.actions, { marginTop: theme.spacing.lg }]}>
        <Button
          title={t('import.choose')}
          icon={Upload}
          onPress={() => void choose()}
          loading={preview.isPending}
        />
        {result ? (
          <Text variant="caption" color="income">
            {t('import.done', { imported: result.imported })}
            {result.skipped ? t('import.skippedN', { count: result.skipped }) : ''}
            {result.categoriesCreated.length
              ? t('import.createdN', { count: result.categoriesCreated.length })
              : ''}
            .{' '}
            <Text variant="caption" color="info" onPress={() => router.push('/transactions')}>
              {t('import.view')}
            </Text>
          </Text>
        ) : null}
      </View>

      <Dialog
        visible={open && preview.data !== undefined}
        title={t('import.review')}
        onClose={() => (progress ? undefined : setOpen(false))}
        maxWidth={680}
      >
        {preview.data ? (
          <PreviewBody
            key={`${preview.data.fileName}-${preview.data.rows.length}`}
            p={preview.data}
            progress={progress}
            onCancel={() => setOpen(false)}
            onImport={(options) => void run(preview.data, options)}
          />
        ) : null}
      </Dialog>
    </Card>
  );
}

const NEW = '__new__';

function PreviewBody({
  p,
  progress,
  onCancel,
  onImport,
}: {
  p: ImportPreview;
  progress: Progress | null;
  onCancel: () => void;
  onImport: (options: CommitOptions) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const appCategories = useCategories();
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const mapping = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of p.categories) out[c.name] = overrides[c.name] ?? c.suggested ?? NEW;
    return out;
  }, [p.categories, overrides]);
  const categoryMap = useMemo(
    () => Object.fromEntries(Object.entries(mapping).filter(([, v]) => v !== NEW)),
    [mapping],
  );
  const newCount = Object.values(mapping).filter((v) => v === NEW).length;
  const toImport = p.rows.filter((r) => !(skipDuplicates && r.duplicate)).length;
  const sample = p.rows.slice(0, 6);
  const busy = progress !== null;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Text variant="caption" color="textSecondary">
        {t('import.fileLine', { file: p.fileName, sheet: p.sheetName, rows: p.rows.length })}
        {p.skippedRows ? t('import.skippedRows', { count: p.skippedRows }) : ''}
        {p.minDate && p.maxDate
          ? ` · ${formatShortDate(p.minDate)} – ${formatShortDate(p.maxDate)}`
          : ''}
      </Text>
      <View style={styles.stats}>
        <Stat label={t('common.income')} value={formatMoney(p.income)} tone="income" />
        <Stat label={t('common.expenses')} value={formatMoney(p.expenses)} tone="expense" />
        <Stat
          label={t('import.duplicates')}
          value={String(p.duplicates)}
          hint={t('import.alreadyInSheet')}
        />
      </View>

      <View style={{ gap: 8 }}>
        <View style={styles.rowBetween}>
          <Text variant="label" color="textMuted">
            {t('import.mapTitle', { count: p.categories.length })}
          </Text>
          <Text
            variant="caption"
            color="info"
            onPress={() => router.push('/categories')}
            accessibilityRole="link"
          >
            {t('import.editCategories')}
          </Text>
        </View>
        {p.categories.map((c) => (
          <CategoryMapRow
            key={c.name}
            info={c}
            value={mapping[c.name] ?? NEW}
            options={(appCategories.data ?? []).filter((a) => a.type === c.type).map((a) => a.name)}
            onChange={(v) => setOverrides((o) => ({ ...o, [c.name]: v }))}
          />
        ))}
        <Text variant="caption" color="textMuted">
          {newCount > 0 ? t('import.willCreate', { count: newCount }) : t('import.allMapped')}{' '}
          {t('import.remembered')}
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text variant="label" color="textMuted">
          {t('import.firstRows')}
        </Text>
        {sample.map((r) => (
          <View key={r.sourceRow} style={styles.row}>
            <Text variant="caption" color="textMuted" style={{ width: 34 }}>
              {r.sourceRow}
            </Text>
            <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
              {r.name}
              {r.duplicate ? `  ${t('import.duplicate')}` : ''}
            </Text>
            <Text variant="caption" color="textSecondary" style={{ width: 86 }}>
              {r.date}
            </Text>
            <Text
              variant="caption"
              color={r.type === 'INCOME' ? 'income' : 'text'}
              style={{ width: 110, textAlign: 'right', fontVariant: ['tabular-nums'] }}
            >
              {formatSignedMoney(r.amount, r.type)}
            </Text>
          </View>
        ))}
        {p.rows.length > sample.length ? (
          <Text variant="caption" color="textMuted">
            {t('import.andMore', { count: p.rows.length - sample.length })}
          </Text>
        ) : null}
      </View>

      {p.warnings.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text variant="label" color="warning">
            {t('import.notes', { count: p.warnings.length })}
          </Text>
          {p.warnings.slice(0, 4).map((w) => (
            <Text key={`${w.sourceRow}-${w.message}`} variant="caption" color="textSecondary">
              {t('import.row', { row: w.sourceRow, message: w.message })}
            </Text>
          ))}
          {p.warnings.length > 4 ? (
            <Text variant="caption" color="textMuted">
              {t('import.moreNotes', { count: p.warnings.length - 4 })}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.switchRow}>
        <Switch
          value={skipDuplicates}
          onValueChange={setSkipDuplicates}
          accessibilityLabel={t('import.skipDupLabel')}
          trackColor={{ true: theme.colors.income, false: theme.colors.borderStrong }}
          disabled={busy}
        />
        <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
          {t('import.skipDup')}
        </Text>
      </View>

      {progress ? (
        <View
          style={{ gap: 6 }}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: progress.total, now: progress.done }}
        >
          <Text variant="caption" color="textSecondary">
            {t('import.importing', {
              done: progress.done.toLocaleString('en-US'),
              total: progress.total.toLocaleString('en-US'),
            })}
          </Text>
          <View style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}>
            <View
              style={[
                styles.bar,
                {
                  width: `${Math.max(3, (progress.done / Math.max(1, progress.total)) * 100)}%`,
                  backgroundColor: theme.colors.income,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button title={t('common.cancel')} variant="ghost" onPress={onCancel} disabled={busy} />
        <Button
          title={t('import.importN', { count: toImport })}
          onPress={() => onImport({ skipDuplicates, createCategories: true, categoryMap })}
          loading={busy}
          disabled={toImport === 0}
        />
      </View>
    </View>
  );
}

function CategoryMapRow({
  info,
  value,
  options,
  onChange,
}: {
  info: ImportCategoryInfo;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const badge =
    info.source === 'exact'
      ? t('import.badge.exact')
      : info.source === 'saved'
        ? t('import.badge.saved')
        : info.source === 'keyword'
          ? t('import.badge.keyword')
          : t('import.badge.new');
  // Selected option first so the current mapping is visible without scrolling.
  const ordered = value === NEW ? options : [value, ...options.filter((o) => o !== value)];
  const typeLabel =
    info.type === 'INCOME' ? t('common.income').toLowerCase() : t('common.expense').toLowerCase();
  return (
    <View
      style={[styles.mapRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}
    >
      <View style={styles.rowBetween}>
        <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
          {info.name}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('import.rowsType', { count: info.count, type: typeLabel, badge })}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
      >
        {value === NEW ? (
          <Chip
            label={t('import.create', { name: info.name })}
            selected
            onPress={() => onChange(NEW)}
          />
        ) : null}
        {ordered.map((name) => (
          <Chip
            key={name}
            label={name}
            selected={value === name}
            tone={info.type === 'INCOME' ? 'income' : 'expense'}
            onPress={() => onChange(name)}
          />
        ))}
        {value !== NEW ? (
          <Chip
            label={t('import.create', { name: info.name })}
            selected={false}
            onPress={() => onChange(NEW)}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = 'text',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'text' | 'income' | 'expense';
}) {
  return (
    <View style={{ flex: 1, minWidth: 120 }}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="bodyStrong" color={tone} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-end',
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mapRow: { borderWidth: 1, padding: 10, gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
});
