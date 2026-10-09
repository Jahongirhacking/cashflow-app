import { type ConnectSpreadsheetInput, extractSpreadsheetId } from '@finance/shared';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Check, Copy, ExternalLink } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useConnectSpreadsheet, useSpreadsheetStatus } from '@/features/spreadsheet/api';
import { useSpreadsheetAccess } from '@/features/spreadsheet/SpreadsheetAccessProvider';
import { ApiError, getUserMessage } from '@/lib/api';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

const STEP_KEYS = [
  'setup.step.create',
  'setup.step.share',
  'setup.step.connect',
  'setup.step.verify',
] as const;
type Step = 0 | 1 | 2 | 3;

export function SetupWizard({ reconnect }: { reconnect: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const status = useSpreadsheetStatus();
  const connect = useConnectSpreadsheet(reconnect);
  const { clearAccessLost } = useSpreadsheetAccess();
  const serviceEmail = status.data?.serviceAccountEmail ?? null;

  const onConnect = (input: ConnectSpreadsheetInput) => {
    setStep(3);
    connect.mutate(input, {
      onSuccess: () => {
        clearAccessLost();
        setTimeout(() => router.replace('/'), 900);
      },
    });
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Stepper step={step} />
      {step === 0 ? <CreateStep onNext={() => setStep(1)} /> : null}
      {step === 1 ? (
        <ShareStep
          email={serviceEmail}
          loading={status.isPending}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      ) : null}
      {step === 2 ? <ConnectStep onSubmit={onConnect} onBack={() => setStep(1)} /> : null}
      {step === 3 ? (
        <VerifyStep
          pending={connect.isPending}
          error={connect.error}
          spreadsheetName={connect.data?.spreadsheetName ?? null}
          serviceEmail={serviceEmail}
          onRetry={() => {
            connect.reset();
            setStep(2);
          }}
        />
      ) : null}
    </View>
  );
}

function Stepper({ step }: { step: Step }) {
  const theme = useTheme();
  const t = useT();
  const STEPS = STEP_KEYS.map((k) => t(k));
  return (
    <View
      style={styles.stepper}
      accessibilityRole="progressbar"
      accessibilityLabel={t('setup.stepOf', { step: step + 1, total: STEPS.length })}
    >
      {STEPS.map((label, index) => {
        const done = index < step;
        const active = index === step;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                {
                  borderColor: active || done ? theme.colors.text : theme.colors.borderStrong,
                  borderRadius: theme.radii.full,
                },
                done ? { backgroundColor: theme.colors.text } : null,
              ]}
            >
              {done ? (
                <Check size={12} color={theme.colors.onPrimary} strokeWidth={3} />
              ) : (
                <Text variant="caption" style={{ fontWeight: '700' }}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              variant="caption"
              color={active ? 'text' : 'textMuted'}
              style={{ fontWeight: active ? '600' : '400' }}
            >
              {label}
            </Text>
            {index < STEPS.length - 1 ? (
              <View style={[styles.stepLine, { backgroundColor: theme.colors.border }]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Card padding="lg">
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>{children}</View>
    </Card>
  );
}

function CreateStep({ onNext }: { onNext: () => void }) {
  const t = useT();
  return (
    <StepCard title={t('setup.create.title')}>
      <Text color="textSecondary">{t('setup.create.body')}</Text>
      <View style={styles.actions}>
        <Button
          title={t('setup.create.open')}
          variant="secondary"
          icon={ExternalLink}
          onPress={() => void Linking.openURL('https://sheets.google.com/')}
        />
        <Button title={t('setup.create.next')} onPress={onNext} />
      </View>
    </StepCard>
  );
}

function ShareStep({
  email,
  loading,
  onNext,
  onBack,
}: {
  email: string | null;
  loading: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const copy = async () => {
    if (!email) return;
    await Clipboard.setStringAsync(email);
    toast.success('Email copied');
  };
  return (
    <StepCard title={t('setup.share.title')}>
      <Text color="textSecondary">{t('setup.share.body')}</Text>
      <View
        style={[
          styles.emailBox,
          { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.md },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.textSecondary} />
        ) : (
          <Text variant="mono" selectable style={{ flex: 1 }} color={email ? 'text' : 'warning'}>
            {email ?? t('setup.share.notConfigured')}
          </Text>
        )}
        <Button
          title={t('setup.share.copy')}
          size="sm"
          variant="secondary"
          icon={Copy}
          onPress={() => void copy()}
          disabled={!email}
        />
      </View>
      <View style={{ gap: 6 }}>
        {[
          'Open your spreadsheet.',
          'Click Share.',
          'Add the My Cashify service-account email.',
          'Select Editor.',
          'Click Send.',
        ].map((line, i) => (
          <Text key={line} color="textSecondary">
            {i + 1}. {line}
          </Text>
        ))}
      </View>
      <View style={styles.actions}>
        <Button title={t('common.back')} variant="ghost" onPress={onBack} />
        <Button title={t('setup.share.next')} onPress={onNext} />
      </View>
    </StepCard>
  );
}

function ConnectStep({
  onSubmit,
  onBack,
}: {
  onSubmit: (input: ConnectSpreadsheetInput) => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const schema = useMemo(
    () =>
      z.object({
        spreadsheetUrl: z
          .string()
          .trim()
          .min(1, t('setup.connect.required'))
          .refine((value) => extractSpreadsheetId(value) !== null, t('setup.connect.invalid')),
      }),
    [t],
  );
  const form = useForm<ConnectSpreadsheetInput>({
    resolver: zodResolver(schema),
    defaultValues: { spreadsheetUrl: '' },
    mode: 'onSubmit',
  });
  const error = form.formState.errors.spreadsheetUrl?.message;
  return (
    <StepCard title={t('setup.connect.title')}>
      <Controller
        control={form.control}
        name="spreadsheetUrl"
        render={({ field }) => (
          <TextInput
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="https://docs.google.com/spreadsheets/d/1abc.../edit"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel={t('setup.connect.label')}
            onSubmitEditing={() => void form.handleSubmit(onSubmit)()}
            style={[
              styles.input,
              theme.typography.body,
              {
                color: theme.colors.text,
                borderColor: error ? theme.colors.expense : theme.colors.borderStrong,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surface,
              },
            ]}
          />
        )}
      />
      {error ? (
        <Text variant="caption" color="expense" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button title={t('common.back')} variant="ghost" onPress={onBack} />
        <Button
          title={t('setup.connect.button')}
          onPress={() => void form.handleSubmit(onSubmit)()}
        />
      </View>
    </StepCard>
  );
}

function VerifyStep({
  pending,
  error,
  spreadsheetName,
  serviceEmail,
  onRetry,
}: {
  pending: boolean;
  error: unknown;
  spreadsheetName: string | null;
  serviceEmail: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const auth = useAuth();
  const [dots, setDots] = useState('');
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setDots((d) => (d.length >= 3 ? '' : `${d}.`)), 400);
    return () => clearInterval(timer);
  }, [pending]);

  if (pending) {
    return (
      <StepCard title={t('setup.verify.title')}>
        <View style={styles.row}>
          <ActivityIndicator color={theme.colors.textSecondary} />
          <Text color="textSecondary">
            {t('setup.verify.checking')}
            {dots}
          </Text>
        </View>
      </StepCard>
    );
  }

  if (error) {
    const accessProblem =
      error instanceof ApiError &&
      (error.code === 'SPREADSHEET_ACCESS_DENIED' || error.code === 'SPREADSHEET_NOT_FOUND');
    const serverConfigProblem = error instanceof ApiError && error.code === 'CONFIGURATION_ERROR';
    return (
      <StepCard
        title={
          serverConfigProblem
            ? 'Server is not fully configured'
            : 'Unable to access your spreadsheet'
        }
      >
        {serverConfigProblem ? (
          // Server configuration messages are written for people; show them as-is.
          <Text color="expense" accessibilityRole="alert">
            {error.message}
          </Text>
        ) : accessProblem ? (
          <>
            <Text color="textSecondary">Make sure that:</Text>
            {[
              'The URL is correct',
              `${serviceEmail ?? 'the service account'} has Editor access`,
              'The spreadsheet still exists',
            ].map((line) => (
              <View key={line} style={styles.row}>
                <Check size={16} color={theme.colors.income} />
                <Text color="textSecondary">{line}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text color="expense" accessibilityRole="alert">
            {getUserMessage(error)}
          </Text>
        )}
        <View style={styles.actions}>
          <Button title={t('common.tryAgain')} onPress={onRetry} />
        </View>
      </StepCard>
    );
  }

  return (
    <StepCard title="Connected ✓">
      <Text color="textSecondary">
        {spreadsheetName ?? auth.user?.spreadsheetName ?? 'Your spreadsheet'} is ready. Taking you
        to your dashboard…
      </Text>
    </StepCard>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  stepDot: {
    width: 24,
    height: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: { flex: 1, height: 1, marginHorizontal: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  emailBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  input: { height: 48, borderWidth: 1, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
