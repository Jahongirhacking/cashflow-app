import type { TransactionType } from '@finance/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';

export interface BulkTypeDialogProps {
  visible: boolean;
  count: number;
  loading: boolean;
  onClose: () => void;
  onApply: (type: TransactionType) => void;
}

/** Record every selected transaction as income or as expense. */
export function BulkTypeDialog({ visible, count, loading, onClose, onApply }: BulkTypeDialogProps) {
  const t = useT();
  const [type, setType] = useState<TransactionType>('EXPENSE');
  return (
    <Dialog
      visible={visible}
      title={t('tx.bulk.typeTitle')}
      onClose={onClose}
      maxWidth={460}
      footer={
        <>
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} disabled={loading} />
          <Button
            title={t('tx.bulk.apply', { count })}
            onPress={() => onApply(type)}
            loading={loading}
          />
        </>
      }
    >
      <Text color="textSecondary">{t('tx.bulk.typeBody', { count })}</Text>
      <Segmented
        value={type}
        options={[
          { value: 'EXPENSE', label: t('common.expense'), tint: 'expense' },
          { value: 'INCOME', label: t('common.income'), tint: 'income' },
        ]}
        onChange={setType}
        accessibilityLabel={t('form.type')}
      />
    </Dialog>
  );
}
