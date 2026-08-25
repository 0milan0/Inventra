import { useSettings } from '@/contexts/settings-context';
import { useEffect, useState } from 'react';

/**
 * Web-variant: om static rendering te ondersteunen moet dit pas na hydratie
 * herberekend worden. Zelfde functienaam/signatuur als de native hook.
 */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const { colorScheme } = useSettings();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
