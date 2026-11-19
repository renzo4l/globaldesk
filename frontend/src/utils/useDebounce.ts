import { useEffect, useState } from 'react';

/**
 * Hook de debounce para barras de pesquisa e filtros textuais (200ms-250ms),
 * evitando re-filtragens pesadas de tabelas a cada tecla pressionada.
 */
export function useDebounce<T>(value: T, delayMs = 220): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
