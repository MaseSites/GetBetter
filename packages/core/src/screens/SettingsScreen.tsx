import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { APPS_WITH_HOUSEHOLD, currentApp } from '@/app/identity';
import type { UsernameSave } from '@/auth/accounts';
import { StylePicker } from '@/features/onboarding/StylePicker';
import { AccountFieldSheet } from '@/features/personalize/AccountFieldSheet';
import { BackdropPicker } from '@/features/personalize/BackdropPicker';
import {
  SettingsGroup,
  SettingsList,
  SettingsProfile,
  SettingsRow,
} from '@/features/personalize/SettingsList';
import { checkUsername, type UsernameCheck } from '@/features/personalize/username';
import {
  LANGUAGES,
  LANGUAGE_LABEL,
  formatMonth,
  useI18n,
  type Language,
  type TranslationKey,
} from '@/i18n';
import { useApp } from '@/state/AppContext';
import { BACKDROPS, resolveBackdrop } from '@/theme/backdrops';
import { Header, Screen, Sheet } from '@/ui';

/** Was eine besetzte oder unmoegliche Wahl am Feld sagt. */
const USERNAME_MESSAGE: Readonly<
  Record<Exclude<UsernameCheck, 'ok'> | Exclude<UsernameSave, 'ok'>, TranslationKey>
> = {
  empty: 'settings.username.empty',
  invalid: 'settings.username.invalid',
  taken: 'settings.username.taken',
  offline: 'settings.username.offline',
};

/** Steht in der Zeile, solange die App ihre eigene Version nicht kennt. */
const NO_VERSION = '—';

/** Welches Blatt gerade offen ist. */
type Sheeted = 'nickname' | 'username' | 'assistant' | 'language' | 'style' | 'backdrop' | null;

/**
 * Die Einstellungen: oben, wer du bist, darunter je Thema ein Bereich — Konto,
 * Darstellung, Assistent, Haushalt, App. Jede Zeile traegt ihr Zeichen und
 * ihren Wert; ein Tipp oeffnet das Blatt dazu, der neue Wert steht sofort da.
 */
export function SettingsScreen() {
  const { t, language } = useI18n();
  const router = useRouter();
  const {
    account,
    household,
    role,
    appearance,
    setFirstName,
    setUsername,
    setAssistantName,
    setLanguage,
    signOut,
  } = useApp();
  const [sheet, setSheet] = useState<Sheeted>(null);

  const app = currentApp();
  const hasHousehold = APPS_WITH_HOUSEHOLD.includes(app.id);
  // BetterAi fuehrt keinen Assistenten, nur das offene KI-Gespraech.
  const hasAssistant = app.id !== 'betterai';
  const version = Constants.expoConfig?.version ?? NO_VERSION;

  if (!account) return null;

  const backdrop = resolveBackdrop(account.backdrop, app.id);
  const backdropLabel =
    backdrop.kind === 'preset'
      ? t(BACKDROPS[backdrop.key].labelKey)
      : backdrop.kind === 'upload'
        ? t('personalize.backdrop.own')
        : t('personalize.backdrop.app');

  async function saveUsername(wanted: string): Promise<TranslationKey | null> {
    if (!account) return null;
    const free = await checkUsername(wanted, account.id);
    if (free !== 'ok') return USERNAME_MESSAGE[free];
    // Zwischen Frage und Antwort kann ihn jemand belegen — der Dienst entscheidet.
    const saved = await setUsername(wanted);
    return saved === 'ok' ? null : USERNAME_MESSAGE[saved];
  }

  return (
    <Screen
      header={
        <Header
          title={t('settings.title')}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
        />
      }
    >
      <SettingsProfile
        name={account.firstName || t('settings.nickname.none')}
        handle={`@${account.username}`}
        email={account.email}
        actionLabel={t('settings.profile.edit')}
        onAction={() => setSheet('nickname')}
      />

      <SettingsGroup title={t('settings.account')} hint={t('settings.email.fixed')}>
        <SettingsList>
          <SettingsRow
            first
            icon="person"
            label={t('settings.nickname')}
            value={account.firstName || t('settings.nickname.none')}
            chevron
            onPress={() => setSheet('nickname')}
          />
          <SettingsRow
            icon="at"
            label={t('settings.username')}
            value={`@${account.username}`}
            chevron
            onPress={() => setSheet('username')}
          />
          <SettingsRow icon="mail" label={t('settings.email')} value={account.email} />
          <SettingsRow
            icon="language"
            label={t('settings.language')}
            value={LANGUAGE_LABEL[language]}
            chevron
            onPress={() => setSheet('language')}
          />
          <SettingsRow
            icon="calendar"
            label={t('settings.since')}
            value={formatMonth(language, new Date(account.createdAt))}
          />
        </SettingsList>
      </SettingsGroup>

      <SettingsGroup title={t('settings.appearance')} hint={t('settings.appearance.hint')}>
        <SettingsList>
          <SettingsRow
            first
            icon="palette"
            label={t('settings.style')}
            value={t(`appearance.mode.${appearance.mode}` as TranslationKey)}
            chevron
            onPress={() => setSheet('style')}
          />
          <SettingsRow
            icon="image"
            label={t('settings.backdrop')}
            value={backdropLabel}
            chevron
            onPress={() => setSheet('backdrop')}
          />
        </SettingsList>
      </SettingsGroup>

      {hasAssistant ? (
        <SettingsGroup title={t('personalize.assistant.title')}>
          <SettingsList>
            <SettingsRow
              first
              icon="sparkles"
              label={t('personalize.assistant.name')}
              value={account.assistantName || t('settings.assistant.none')}
              chevron
              onPress={() => setSheet('assistant')}
            />
          </SettingsList>
        </SettingsGroup>
      ) : null}

      {hasHousehold ? (
        <SettingsGroup title={t('settings.household')}>
          <SettingsList>
            <SettingsRow
              first
              icon="home"
              label={household ? household.name : t('settings.household.none')}
              value={
                household
                  ? role === 'admin'
                    ? t('household.role.admin')
                    : t('household.role.member')
                  : undefined
              }
              chevron
              onPress={() => router.push('/manage-household')}
            />
            <SettingsRow
              icon="people"
              label={t('settings.household.join')}
              muted
              chevron
              onPress={() => router.push('/join-household')}
            />
          </SettingsList>
        </SettingsGroup>
      ) : null}

      <SettingsGroup title={t('settings.app')}>
        <SettingsList>
          <SettingsRow
            first
            icon="info"
            label={t('settings.app.version')}
            value={`${app.name} ${version}`}
          />
          <SettingsRow
            icon="logout"
            label={t('auth.signOut')}
            danger
            onPress={() => {
              void signOut();
            }}
          />
        </SettingsList>
      </SettingsGroup>

      <AccountFieldSheet
        visible={sheet === 'nickname'}
        title={t('settings.nickname')}
        label={t('settings.nickname')}
        hint={t('settings.nickname.hint')}
        value={account.firstName}
        autoCapitalize="words"
        onClose={() => setSheet(null)}
        onSave={async (next) => {
          await setFirstName(next);
          return null;
        }}
      />

      <AccountFieldSheet
        visible={sheet === 'username'}
        title={t('settings.username')}
        label={t('settings.username')}
        hint={t('settings.username.hint')}
        value={account.username}
        autoCapitalize="none"
        onClose={() => setSheet(null)}
        onSave={saveUsername}
      />

      <AccountFieldSheet
        visible={sheet === 'assistant'}
        title={t('personalize.assistant.name')}
        label={t('personalize.assistant.name')}
        hint={t('personalize.assistant.hint')}
        value={account.assistantName ?? ''}
        autoCapitalize="words"
        onClose={() => setSheet(null)}
        onSave={async (next) => {
          await setAssistantName(next);
          return null;
        }}
      />

      <Sheet visible={sheet === 'style'} onClose={() => setSheet(null)} title={t('settings.style')}>
        <StylePicker />
      </Sheet>

      <Sheet
        visible={sheet === 'backdrop'}
        onClose={() => setSheet(null)}
        title={t('settings.backdrop')}
      >
        <View>
          <BackdropPicker />
        </View>
      </Sheet>

      <Sheet
        visible={sheet === 'language'}
        onClose={() => setSheet(null)}
        title={t('settings.language')}
      >
        <SettingsList>
          {LANGUAGES.map((code: Language, index) => (
            <SettingsRow
              key={code}
              first={index === 0}
              label={LANGUAGE_LABEL[code]}
              selected={language === code}
              onPress={() => {
                void setLanguage(code);
                setSheet(null);
              }}
            />
          ))}
        </SettingsList>
      </Sheet>
    </Screen>
  );
}
