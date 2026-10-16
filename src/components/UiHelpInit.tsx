'use client';

import { useEffect, useRef } from 'react';

/** Inicjalizuje wspólny poradnik po hydracji i przy powrocie przez router. */
export function UiHelpInit() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = marker.current?.closest('[data-ui-help]');
    root?.removeAttribute('data-ui-help-defer');
    document.dispatchEvent(new Event('ui:help-init'));
    return () => {
      document.dispatchEvent(new CustomEvent('ui:help-dispose', { detail: { root } }));
    };
  }, []);
  return <span ref={marker} hidden />;
}
