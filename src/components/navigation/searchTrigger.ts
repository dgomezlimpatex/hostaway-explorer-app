import { cloneElement, type ButtonHTMLAttributes, type MouseEvent, type ReactElement } from 'react';

export type SearchTriggerElement = ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;

/**
 * Give a custom search button the click that opens the global search, keeping
 * its own onClick (which may cancel with preventDefault) and an accessible name.
 */
export const withSearchTrigger = (trigger: SearchTriggerElement, openSearch: () => void) =>
  cloneElement(trigger, {
    'aria-label': trigger.props['aria-label'] ?? 'Buscar en la aplicación',
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      trigger.props.onClick?.(event);
      if (!event.defaultPrevented) openSearch();
    },
  });
