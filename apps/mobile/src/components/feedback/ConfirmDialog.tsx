import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();
  return (
    <Dialog
      visible={visible}
      title={title}
      onClose={onCancel}
      maxWidth={420}
      footer={
        <>
          <Button
            title={cancelLabel ?? t('common.cancel')}
            variant="ghost"
            onPress={onCancel}
            disabled={loading}
          />
          <Button
            title={confirmLabel ?? t('common.confirm')}
            variant={destructive ? 'danger' : 'primary'}
            onPress={onConfirm}
            loading={loading}
          />
        </>
      }
    >
      {message ? <Text color="textSecondary">{message}</Text> : null}
    </Dialog>
  );
}
