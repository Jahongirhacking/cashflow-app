import type { Category, CreateCategoryInput } from '@finance/shared';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ErrorState } from '@/components/feedback/StateViews';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/features/categories/api';
import { CategoryForm } from '@/features/categories/components/CategoryForm';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useInteractionState } from '@/hooks/useInteractionState';
import { getUserMessage } from '@/lib/api';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

type EditorState =
  { mode: 'create'; type: 'INCOME' | 'EXPENSE' } | { mode: 'edit'; category: Category } | null;

export default function CategoriesScreen() {
  const t = useT();
  const toast = useToast();
  const { isMobile, isDesktop } = useBreakpoint();
  const categories = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const expenses = (categories.data ?? []).filter((c) => c.type === 'EXPENSE');
  const incomes = (categories.data ?? []).filter((c) => c.type === 'INCOME');

  const submit = (values: CreateCategoryInput) => {
    if (!editor) return;
    if (editor.mode === 'create')
      create.mutate(values, {
        onSuccess: () => {
          toast.success(t('cat.added'));
          setEditor(null);
        },
        onError: (e) => toast.error(getUserMessage(e)),
      });
    else
      update.mutate(
        { id: editor.category.id, patch: values },
        {
          onSuccess: () => {
            toast.success(t('cat.updated'));
            setEditor(null);
          },
          onError: (e) => toast.error(getUserMessage(e)),
        },
      );
  };
  const toggleKind = (c: Category) =>
    update.mutate(
      { id: c.id, patch: { kind: c.kind === 'FIXED' ? 'VARIABLE' : 'FIXED' } },
      {
        onSuccess: (u) =>
          toast.success(
            t('cat.nowKind', {
              name: u.name,
              kind: u.kind === 'FIXED' ? t('cat.fixedLower') : t('cat.variableLower'),
            }),
          ),
        onError: (e) => toast.error(getUserMessage(e)),
      },
    );

  const section = (title: string, items: Category[], type: 'INCOME' | 'EXPENSE') => (
    <Card padding="none" style={isDesktop ? styles.gridItem : null}>
      <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
        <SectionHeader
          title={title}
          subtitle={t('cat.count', { count: items.length })}
          right={
            <Button
              title={t('common.add')}
              size="sm"
              variant="secondary"
              icon={Plus}
              onPress={() => setEditor({ mode: 'create', type })}
            />
          }
        />
      </View>
      {items.map((c, i) => (
        <CategoryRow
          key={c.id}
          category={c}
          first={i === 0}
          onPress={() => setEditor({ mode: 'edit', category: c })}
          onToggleKind={type === 'EXPENSE' ? () => toggleKind(c) : undefined}
        />
      ))}
    </Card>
  );

  return (
    <Screen
      title={t('cat.title')}
      subtitle={t('cat.subtitle')}
      headerRight={
        !isMobile ? (
          <Button
            title={t('cat.add')}
            icon={Plus}
            onPress={() => setEditor({ mode: 'create', type: 'EXPENSE' })}
          />
        ) : undefined
      }
    >
      {categories.isPending ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={18} />
          <Skeleton height={18} width="70%" />
        </View>
      ) : categories.isError ? (
        <ErrorState
          message={getUserMessage(categories.error)}
          onRetry={() => void categories.refetch()}
        />
      ) : (
        <View style={[styles.grid, isDesktop ? styles.gridDesktop : null]}>
          {section(t('cat.expenses'), expenses, 'EXPENSE')}
          {section(t('cat.income'), incomes, 'INCOME')}
        </View>
      )}
      <Dialog
        visible={editor !== null}
        title={editor?.mode === 'edit' ? t('cat.edit') : t('cat.add')}
        onClose={() => setEditor(null)}
        maxWidth={440}
      >
        {editor ? (
          <CategoryForm
            key={editor.mode === 'edit' ? editor.category.id : 'new'}
            mode={editor.mode}
            initial={editor.mode === 'edit' ? editor.category : null}
            defaultType={editor.mode === 'create' ? editor.type : undefined}
            submitting={create.isPending || update.isPending}
            onSubmit={submit}
            onDelete={editor.mode === 'edit' ? () => setDeleting(editor.category) : undefined}
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        visible={deleting !== null}
        title={t('cat.deleteConfirm')}
        message={deleting ? t('cat.deleteBody', { name: deleting.name }) : undefined}
        confirmLabel={t('common.delete')}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t('cat.deleted'));
              setDeleting(null);
              setEditor(null);
            },
            onError: (e) => toast.error(getUserMessage(e)),
          })
        }
      />
    </Screen>
  );
}

function CategoryRow({
  category,
  first,
  onPress,
  onToggleKind,
}: {
  category: Category;
  first: boolean;
  onPress: () => void;
  onToggleKind?: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const { hovered, pressed, handlers } = useInteractionState();
  const fixed = category.kind === 'FIXED';
  // The Fixed/Variable toggle is a sibling of the main pressable (nested buttons are invalid on web).
  return (
    <View
      style={[
        styles.row,
        first ? null : { borderTopWidth: 1, borderTopColor: theme.colors.border },
        hovered || pressed ? { backgroundColor: theme.colors.surfaceMuted } : null,
      ]}
    >
      <Pressable
        {...handlers}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${category.name}${category.kind ? `, ${category.kind === 'FIXED' ? t('cat.fixedLower') : t('cat.variableLower')}` : ''}`}
        style={styles.main}
      >
        <CategoryIcon name={category.name} size={18} color={theme.colors.textSecondary} />
        <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
          {category.name}
        </Text>
        {category.isDefault ? (
          <Text variant="caption" color="textMuted">
            {t('cat.default')}
          </Text>
        ) : null}
      </Pressable>
      {onToggleKind ? (
        <Pressable
          onPress={onToggleKind}
          accessibilityRole="button"
          accessibilityLabel={t('cat.markAs', {
            name: category.name,
            kind: fixed ? t('cat.variableLower') : t('cat.fixedLower'),
          })}
          hitSlop={6}
          style={[
            styles.kind,
            {
              backgroundColor: fixed ? theme.colors.infoSoft : theme.colors.surfaceMuted,
              borderRadius: theme.radii.full,
            },
          ]}
        >
          <Text
            variant="caption"
            color={fixed ? 'info' : 'textSecondary'}
            style={{ fontWeight: '600' }}
          >
            {fixed ? t('cat.fixed') : t('cat.variable')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 16 },
  gridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  gridItem: { flex: 1, minWidth: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  kind: { paddingHorizontal: 10, paddingVertical: 4 },
});
