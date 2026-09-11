import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import {
  dayKey,
  pets as petRepo,
  plantDueDay,
  plants as plantRepo,
  recipes as recipeRepo,
  useLiveQuery,
  vehicles as vehicleRepo,
} from '@/db';
import { events as eventRepo } from '@/db/repositories';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { daysUntil, relativeDay } from '@/features/shared/days';
import { formatShortDate, formatTime, useI18n, type TranslationKey } from '@/i18n';
import { MODULES, modulesOfApp } from '@/mocks/modules';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Divider, DueTag, EmptyRow, LineRow, ListCard, SectionHead, TickRow } from '@/ui';

const ROWS = 3;
const PLANT_ROWS = 5;

/**
 * Was BetterFamily unter Einkaufsliste und Ämtli weiss: was heute zu giessen
 * ist (antippen heisst gegossen), die letzten Rezepte, die naechsten Tiertermine,
 * was am Auto ansteht und die naechsten Familientermine — jede Funktion als
 * Abschnitt im Format des Entwurfs.
 */
export function FamilySections() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const { access } = useCalendarAccess();
  const householdId = household?.id ?? null;
  const today = dayKey();

  const upcoming = useLiveQuery(
    () => eventRepo.listUpcoming(access, new Date().toISOString(), ROWS),
    [access.accountId, access.householdIds, access.calendarIds],
  );
  const recipeList = useLiveQuery(
    () => recipeRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const plantList = useLiveQuery(
    () => plantRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const petList = useLiveQuery(() => petRepo.list(account.id, householdId), [account.id, householdId]);
  const petEventList = useLiveQuery(
    () => petRepo.events(account.id, householdId),
    [account.id, householdId],
  );
  const vehicleList = useLiveQuery(
    () => vehicleRepo.list(account.id, householdId),
    [account.id, householdId],
  );

  const owned = new Set(modulesOfApp().map((module) => module.id));
  const nameOf = (id: string) => MODULES.find((module) => module.id === id)?.name ?? id;
  const open = (id: string) => () => router.push(`/run/${id}`);

  const events = upcoming.data ?? [];
  const recipes = recipeList.data ?? [];
  const plants = plantList.data ?? [];
  const plantsDue = plants.filter((plant) => plantDueDay(plant) <= today);
  const pets = petList.data ?? [];
  const petEvents = (petEventList.data ?? []).filter((event) => event.day >= today);
  const vehicles = vehicleList.data ?? [];
  const vehicleDue = vehicles.flatMap((vehicle) => {
    const lines: { key: string; title: string; day: string | null }[] = [];
    if (vehicle.serviceOn && daysUntil(vehicle.serviceOn) <= 30) {
      lines.push({
        key: `${vehicle.id}-s`,
        title: `${vehicle.name} · ${t('vehicles.service')}`,
        day: vehicle.serviceOn,
      });
    }
    if (vehicle.tyresOn && daysUntil(vehicle.tyresOn) <= 30) {
      lines.push({
        key: `${vehicle.id}-t`,
        title: `${vehicle.name} · ${t('vehicles.tyres')}`,
        day: vehicle.tyresOn,
      });
    }
    if (vehicle.vignetteYear === null || vehicle.vignetteYear < new Date().getFullYear()) {
      lines.push({ key: `${vehicle.id}-v`, title: `${vehicle.name} · ${t('vehicles.vignette')}`, day: null });
    }
    return lines;
  });

  function section(id: string, count: string | undefined, body: ReactNode) {
    if (!owned.has(id)) return null;
    return (
      <View style={{ gap: theme.spacing.sm }}>
        <SectionHead title={nameOf(id)} count={count} onPress={open(id)} />
        <ListCard>{body}</ListCard>
      </View>
    );
  }

  return (
    <>
      {section(
        'plants',
        plantsDue.length > 0 ? t('family.dueToday', { count: plantsDue.length }) : undefined,
        plantsDue.length === 0 ? (
          <EmptyRow
            text={plants.length === 0 ? t('plants.empty.title') : t('plants.calm')}
            onPress={open('plants')}
          />
        ) : (
          plantsDue.slice(0, PLANT_ROWS).map((plant, index) => (
            <View key={plant.id}>
              {index > 0 ? <Divider /> : null}
              <TickRow
                label={plant.name}
                meta={plant.location}
                checked={false}
                // Ein Tipp heisst gegossen.
                onToggle={() => void plantRepo.water(plant.id, today)}
              />
            </View>
          ))
        ),
      )}

      {section(
        'recipes',
        recipes.length > 0 ? String(recipes.length) : undefined,
        recipes.length === 0 ? (
          <EmptyRow text={t('recipes.empty.title')} onPress={open('recipes')} />
        ) : (
          recipes.slice(0, ROWS).map((recipe, index) => (
            <View key={recipe.id}>
              {index > 0 ? <Divider /> : null}
              <LineRow
                title={recipe.title}
                subtitle={t('recipes.summary', {
                  servings: recipe.servings,
                  ingredients: recipe.ingredients.length,
                })}
                onPress={open('recipes')}
              />
            </View>
          ))
        ),
      )}

      {section(
        'pets',
        undefined,
        petEvents.length === 0 ? (
          <EmptyRow
            text={pets.length === 0 ? t('pets.empty.title') : pets.map((pet) => pet.name).join(' · ')}
            onPress={open('pets')}
          />
        ) : (
          petEvents.slice(0, ROWS).map((event, index) => (
            <View key={event.id}>
              {index > 0 ? <Divider /> : null}
              <LineRow
                title={`${pets.find((pet) => pet.id === event.petId)?.name ?? ''} · ${t(`pets.event.${event.kind}` as TranslationKey)}`}
                trailing={<DueTag text={relativeDay(t, language, event.day)} now={event.day === today} />}
                onPress={open('pets')}
              />
            </View>
          ))
        ),
      )}

      {section(
        'vehicles',
        undefined,
        vehicleDue.length === 0 ? (
          <EmptyRow
            text={vehicles.length === 0 ? t('vehicles.empty.title') : t('vehicles.calm')}
            onPress={open('vehicles')}
          />
        ) : (
          vehicleDue.slice(0, ROWS).map((line, index) => (
            <View key={line.key}>
              {index > 0 ? <Divider /> : null}
              <LineRow
                title={line.title}
                trailing={
                  <DueTag
                    text={line.day ? relativeDay(t, language, line.day) : t('vehicles.vignetteMissing')}
                    late
                  />
                }
                onPress={open('vehicles')}
              />
            </View>
          ))
        ),
      )}

      {section(
        'calendar',
        undefined,
        events.length === 0 ? (
          <EmptyRow text={t('family.noEvents')} onPress={open('calendar')} />
        ) : (
          events.map((event, index) => (
            <View key={event.id}>
              {index > 0 ? <Divider /> : null}
              <LineRow
                title={event.title}
                subtitle={formatShortDate(language, event.startsAt)}
                trailing={
                  <DueTag
                    text={event.allDay ? t('today.allDay') : formatTime(language, event.startsAt)}
                  />
                }
                onPress={open('calendar')}
              />
            </View>
          ))
        ),
      )}
    </>
  );
}
