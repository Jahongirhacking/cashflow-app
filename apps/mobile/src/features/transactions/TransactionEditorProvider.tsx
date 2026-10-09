import { type CreateTransactionInput, generateId, type Transaction } from '@finance/shared';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { useToast } from '@/components/feedback/ToastProvider';
import { Dialog } from '@/components/ui/Dialog';
import { useT } from '@/i18n';
import { getUserMessage } from '@/lib/api';
import { useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from './api';
import { TransactionForm } from './components/TransactionForm';

export interface EditorRequest {
  mode: 'create' | 'edit';
  transaction?: Transaction;
  defaults?: Partial<CreateTransactionInput>;
}

interface TransactionEditorContextValue {
  open: (request: EditorRequest) => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<TransactionEditorContextValue | null>(null);

/**
 * One add/edit sheet for the whole app: opened from the Add tab, the list, the dashboard…
 * Owns the mutations and the success/error feedback so screens stay thin.
 */
export function TransactionEditorProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<EditorRequest | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const clientId = useRef<string>(generateId());
  const toast = useToast();
  const t = useT();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();

  const open = useCallback((next: EditorRequest) => {
    clientId.current = generateId(); // one idempotency key per form session
    setRequest(next);
  }, []);
  const close = useCallback(() => {
    setRequest(null);
    setConfirmDelete(false);
  }, []);

  const submit = (values: CreateTransactionInput) => {
    if (!request) return;
    if (request.mode === 'create') {
      create.mutate(
        { ...values, clientId: clientId.current },
        {
          onSuccess: () => {
            toast.success(t('tx.added'));
            close();
          },
          onError: (error) =>
            toast.error(getUserMessage(error, t('tx.saveFailed')), {
              label: 'Retry',
              onPress: () => submit(values),
            }),
        },
      );
    } else if (request.transaction) {
      update.mutate(
        { id: request.transaction.id, patch: values },
        {
          onSuccess: () => {
            toast.success(t('tx.updated'));
            close();
          },
          onError: (error) =>
            toast.error(getUserMessage(error, t('tx.saveFailed')), {
              label: 'Retry',
              onPress: () => submit(values),
            }),
        },
      );
    }
  };

  const confirmRemove = () => {
    const id = request?.transaction?.id;
    if (!id) return;
    remove.mutate(id, {
      onSuccess: () => {
        toast.success(t('tx.deleted'));
        close();
      },
      onError: (error) => {
        setConfirmDelete(false);
        toast.error(getUserMessage(error, t('tx.deleteFailed')));
      },
    });
  };

  const value = useMemo(() => ({ open, close, isOpen: request !== null }), [open, close, request]);
  const submitting = create.isPending || update.isPending;

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog
        visible={request !== null}
        title={request?.mode === 'edit' ? t('tx.edit') : t('tx.add')}
        onClose={close}
      >
        {request ? (
          <TransactionForm
            key={request.transaction?.id ?? 'new'}
            mode={request.mode}
            initial={request.transaction ?? null}
            defaults={request.defaults}
            submitting={submitting}
            onSubmit={submit}
            onDelete={request.mode === 'edit' ? () => setConfirmDelete(true) : undefined}
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        visible={confirmDelete}
        title={t('tx.deleteConfirm')}
        message={
          request?.transaction
            ? `"${request.transaction.name}" will be removed from your spreadsheet.`
            : undefined
        }
        confirmLabel={t('common.delete')}
        destructive
        loading={remove.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Ctx.Provider>
  );
}

export function useTransactionEditor(): TransactionEditorContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTransactionEditor must be used within TransactionEditorProvider');
  return ctx;
}
