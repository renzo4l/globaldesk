import { useEffect, useState } from 'react';

/**
 * Mantém um objeto renderizado durante a animação de saída (180ms)
 * quando seu valor passa para null/undefined, permitindo transições GPU-accelerated
 * suaves de entrada (animate-in) e saída (animate-out) em Drawers e Modais.
 */
export function useAnimatedPresence<T>(
  value: T | null | undefined,
  exitDurationMs = 180
): {
  renderedValue: T | null;
  isClosing: boolean;
} {
  const [renderedValue, setRenderedValue] = useState<T | null>(value ?? null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (value) {
      setRenderedValue(value);
      setIsClosing(false);
      return;
    }

    if (renderedValue !== null) {
      setIsClosing(true);
      const timer = window.setTimeout(() => {
        setRenderedValue(null);
        setIsClosing(false);
      }, exitDurationMs);
      return () => window.clearTimeout(timer);
    }
  }, [value, exitDurationMs, renderedValue]);

  return {
    renderedValue: value ?? renderedValue,
    isClosing: !value && renderedValue !== null && isClosing,
  };
}

/**
 * Controla a montagem/desmontagem animada de modais controlados por booleano `isOpen`.
 */
export function useAnimatedOpen(
  isOpen: boolean,
  exitDurationMs = 180
): {
  shouldRender: boolean;
  isClosing: boolean;
} {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (shouldRender) {
      setIsClosing(true);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, exitDurationMs);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, exitDurationMs, shouldRender]);

  return {
    shouldRender: isOpen || shouldRender,
    isClosing: !isOpen && shouldRender && isClosing,
  };
}
