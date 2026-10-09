import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader';
import { useTransactionEditor } from '@/features/transactions/TransactionEditorProvider';

/** The Add tab is intercepted in the tab bar; this route only handles direct navigation to /add. */
export default function AddScreen() {
  const router = useRouter();
  const editor = useTransactionEditor();

  useFocusEffect(
    useCallback(() => {
      editor.open({ mode: 'create' });
      router.replace('/transactions');
    }, [editor, router]),
  );

  return <FullScreenLoader />;
}
