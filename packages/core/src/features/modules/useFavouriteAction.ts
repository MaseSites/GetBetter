import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import type { HeaderAction } from '@/ui';

/**
 * Der Favoritenstern oben rechts. Jeder Modul-Bildschirm bekommt denselben,
 * damit sich das Markieren ueberall gleich anfuehlt.
 */
export function useFavouriteAction(moduleId: string): HeaderAction {
  const t = useTranslate();
  const { toggleFavourite, isFavourite } = useApp();
  const favourite = isFavourite(moduleId);

  return {
    icon: favourite ? 'starFilled' : 'star',
    label: favourite ? t('detail.removeFavourite') : t('detail.addFavourite'),
    active: favourite,
    onPress: () => {
      void toggleFavourite(moduleId);
    },
  };
}
