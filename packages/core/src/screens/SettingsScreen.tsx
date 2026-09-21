import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { APPS_WITH_HOUSEHOLD, currentApp } from '@/app/identity';
import type { UsernameSave } from '@/auth/accounts';
import { useSpeechVoices } from '@/features/assistant/useSpeechVoices';
import { VoicePicker } from '@/features/assistant/VoicePicker';
import { AvatarSheet } from '@/features/avatar/AvatarSheet';
import { useAvatarStyle } from '@/features/avatar/useAvatarStyle';
import { StylePicker } from '@/features/onboarding/StylePicker';
import { AccountFieldSheet } from '@/features/personalize/AccountFieldSheet';
import { AiUsageRow } from '@/features/personalize/AiUsageRow';
import { BackdropPicker } from '@/features/personalize/BackdropPicker';
import {
  SettingsGroup,
  SettingsList,
  SettingsProfile,
  SettingsRow,
} from '@/features/personalize/SettingsList';
import { dateOfDay, useAiBudget } from '@/features/personalize/useAiBudget';
import { checkUsername, type UsernameCheck } from '@/features/personalize/username';
import { LockMark } from '@/features/plan/PlanLock';
import { usePlanSheet } from '@/features/plan/PlanSheet';
import { PLAN_ROW_VALUE, planStateOf } from '@/features/plan/planState';
import { PLAN_PRICES_CHF } from '@/features/plan/prices';
import { usePlanStatus } from '@/features/plan/usePlanStatus';
import {
  LANGUAGES,
  LANGUAGE_LABEL,
  formatDayMonth,
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
type Sheeted =
  | 'nickname'
  | 'username'
  | 'assistant'
  | 'avatar'
  | 'voice'
  | 'language'
  | 'style'
  | 'backdrop'
  | null;

/** Diese Blaetter gibt es nur mit Abo — ohne oeffnet die Zeile das Abo. */
type LockedSheet = 'assistant' | 'avatar' | 'voice' | 'backdrop';

/**
 * Die Einstellungen: oben, wer du bist, darunter je Thema ein Bereich — Konto,
 * Darstellung, Assistent, Haushalt, App. Jede Zeile traegt ihr Zeichen und
 * ihren Wert; ein Tipp oeffnet das Blatt dazu, der neue Wert steht sofort da.
 *
 * Ohne Abo tragen Hintergrund und Assistent ein Schloss und den Wert „Abo“:
 * ein Tipp oeffnet das Abo-Fenster statt des Blatts. Hell oder dunkel bleibt frei.
 */
export function SettingsScreen() {
  const { t, language } = useI18n();
  const router = useRouter();
  const {
    account,
    household,
    role,
    appearance,
    personal,
    setFirstName,
    setUsername,
    setAssistantName,
    setAssistantVoice,
    setLanguage,
    signOut,
  } = useApp();
  const [sheet, setSheet] = useState<Sheeted>(null);
  const voices = useSpeechVoices();
  const avatar = useAvatarStyle();
  const plan = usePlanSheet();

  const app = currentApp();
  const hasHousehold = APPS_WITH_HOUSEHOLD.includes(app.id);
  // BetterAi fuehrt keinen Assistenten, nur das offene KI-Gespraech.
  const hasAssistant = app.id !== 'betterai';
  const version = Constants.expoConfig?.version ?? NO_VERSION;
  // Das KI-Kontingent dieser App — in allen Apps, auch in BetterAi.
  const aiBudget = useAiBudget(account?.id ?? null, app.id);
  const paidHere = account?.paidApps?.includes(app.id) === true;
  // Neu gefragt nach einer Anfrage und sobald der Abgleich ein Abo bringt.
  const planStatus = usePlanStatus(account?.id ?? null, app.id, `${plan.revision}:${String(paidHere)}`);

  if (!account) return null;

  const locked = !personal.canPersonalize;
  const planPrice = planStatus ? planStatus.priceChf : PLAN_PRICES_CHF[app.id];
  const planCancelsOn = account.planCancels?.[app.id] ?? planStatus?.cancelsOn ?? null;
  const planState = planStateOf({
    priceChf: planPrice,
    paid: planStatus ? planStatus.plan === 'paid' : paidHere,
    pending: planStatus?.request === 'pending',
    cancelled: planCancelsOn !== null,
  });

  /** Ein Blatt, das es nur mit Abo gibt: ohne Abo oeffnet sich das Abo. */
  function openLocked(next: LockedSheet) {
    if (locked) plan.open();
    else setSheet(next);
  }

  /** Aus einem offenen Blatt heraus: erst zu, dann das Abo — nie zwei Blaetter uebereinander. */
  function switchToPlan() {
    setSheet(null);
    plan.open();
  }

  // Der Name der gewaehlten Stimme — solange der Browser die Liste noch nicht
  // nachgereicht hat, steht dort „Standard“ statt einer leeren Zeile.
  // Ohne eigene Wahl spricht die beste Stimme — dann steht auch die hier.
  const voice = voices.find((entry) => entry.uri === personal.voice) ?? voices[0];
  const voiceLabel = voice ? voice.label : t('settings.voice.default');

  const backdrop = resolveBackdrop(personal.backdrop, app.id);
  const backdropLabel =
    backdrop.kind === 'preset'
      ? t(BACKDROPS[backdrop.key].labelKey)
      : backdrop.kind === 'upload'
        ? t('personalize.backdrop.own')
        : t('personalize.backdrop.app');

  /** Ohne Abo: statt des Werts „Abo“ und rechts das Schloss. */
  const lockedValue = (value: string) => (locked ? t('plan.locked') : value);
  const lock = locked ? <LockMark /> : undefined;

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
          {/* Hell oder dunkel geht immer — darum bleibt diese Zeile offen. */}
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
            value={lockedValue(backdropLabel)}
            trailing={lock}
            chevron={!locked}
            onPress={() => openLocked('backdrop')}
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
              value={lockedValue(personal.assistantName || t('settings.assistant.none'))}
              trailing={lock}
              chevron={!locked}
              onPress={() => openLocked('assistant')}
            />
            <SettingsRow
              icon="happy"
              label={t('avatar.title')}
              value={lockedValue(t(`avatar.kind.${avatar.kind}`))}
              trailing={lock}
              chevron={!locked}
              onPress={() => openLocked('avatar')}
            />
            <SettingsRow
              icon="mic"
              label={t('settings.voice')}
              value={lockedValue(voiceLabel)}
              trailing={lock}
              chevron={!locked}
              onPress={() => openLocked('voice')}
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

      <SettingsGroup
        title={t('settings.app')}
        {...(aiBudget
          ? {
              hint: t('settings.ai.hint', {
                date: formatDayMonth(language, dateOfDay(aiBudget.resetsOn)),
              }),
            }
          : {})}
      >
        <SettingsList>
          <SettingsRow
            first
            icon="star"
            label={t('plan.row')}
            value={t(PLAN_ROW_VALUE[planState])}
            chevron
            onPress={plan.open}
          />
          {aiBudget ? <AiUsageRow budget={aiBudget} first={false} /> : null}
          <SettingsRow
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
        value={personal.assistantName}
        autoCapitalize="words"
        onClose={() => setSheet(null)}
        onSave={async (next) => {
          await setAssistantName(next);
          return null;
        }}
      />

      {hasAssistant ? (
        <AvatarSheet visible={sheet === 'avatar'} onClose={() => setSheet(null)} />
      ) : null}

      <Sheet visible={sheet === 'voice'} onClose={() => setSheet(null)} title={t('settings.voice')}>
        <VoicePicker
          value={personal.voice}
          onChange={(uri) => void setAssistantVoice(uri)}
          onPlan={switchToPlan}
        />
      </Sheet>

      <Sheet visible={sheet === 'style'} onClose={() => setSheet(null)} title={t('settings.style')}>
        <StylePicker onLocked={switchToPlan} />
      </Sheet>

      <Sheet
        visible={sheet === 'backdrop'}
        onClose={() => setSheet(null)}
        title={t('settings.backdrop')}
      >
        <View>
          <BackdropPicker onLocked={switchToPlan} />
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
