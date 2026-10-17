import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { withoutSearchParam } from './entityLinks';

export const ENTITY_DETAIL_TITLE_ATTR = 'data-entity-detail-title';

/** Move focus to the visible detail title once it is rendered. */
export const focusEntityDetailTitle = () => {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const titles = [...document.querySelectorAll<HTMLElement>(`[${ENTITY_DETAIL_TITLE_ATTR}]`)];
    // Prefer a title inside an open dialog (mobile) over one behind it.
    const target = titles.find((title) => title.closest('[role="dialog"]')) || titles[0];
    target?.focus({ preventScroll: false });
  }));
};

let searchOrigin: HTMLElement | null = null;

/** Remember where the user opened the global search from, to return focus there. */
export const rememberSearchOrigin = (element: Element | null) => {
  searchOrigin = element instanceof HTMLElement && element !== document.body ? element : null;
};

/**
 * After a linked detail closes, return focus to where the search was opened if
 * focus was left on the page body; if that control is gone (e.g. the mobile menu
 * closed), to the page title, which does not open the mobile keyboard. Waits for
 * closing dialogs to finish, since they restore focus on unmount.
 */
export const restoreFocusAfterLinkedDetail = () => {
  const started = performance.now();
  const tick = () => {
    if (document.querySelector('[role="dialog"]') && performance.now() - started < 1500) {
      requestAnimationFrame(tick);
      return;
    }
    setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (searchOrigin?.isConnected) { searchOrigin.focus(); return; }
      const heading = document.querySelector<HTMLElement>('h1');
      if (!heading) return;
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus();
    }, 0);
  };
  requestAnimationFrame(tick);
};

/**
 * Bridge between an id in the URL (`?param=id`) and a listing's local selection.
 * - A new navigation with the param selects that id (also on reload and Back/Forward).
 * - Once shown, choosing another record or closing removes the param (replace),
 *   so the detail does not reopen from a stale URL.
 * - Going Back to an entry without the param closes the linked detail.
 */
export function useLinkedSelection(
  param: string,
  selectedId: string | null,
  select: (id: string | null) => boolean | void,
  /** True once the detail (or its "not available" notice) for selectedId is rendered. */
  resolved: boolean,
) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const linkedId = params.get(param);
  const shown = useRef<string | null>(null);
  const lastLinked = useRef<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const selectRef = useRef(select);
  selectRef.current = select;

  const clearLink = useCallback(() => {
    setParams((current) => withoutSearchParam(current, param), { replace: true });
  }, [param, setParams]);

  // Layout effect: apply the linked selection before paint, so the previous
  // record is never shown for a frame.
  useLayoutEffect(() => {
    if (linkedId) {
      shown.current = selectedRef.current === linkedId ? linkedId : null;
      if (selectRef.current(linkedId) === false) clearLink();
      else pendingFocus.current = linkedId;
    } else if (navigationType === 'POP' && lastLinked.current && selectedRef.current === lastLinked.current) {
      selectRef.current(null);
    }
    lastLinked.current = linkedId;
    // Each navigation (new key) is a new request, even for the same id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    if (!linkedId) { shown.current = null; return; }
    if (selectedId === linkedId) shown.current = linkedId;
    else if (shown.current === linkedId) {
      shown.current = null;
      clearLink();
      restoreFocusAfterLinkedDetail();
    }
  }, [selectedId, linkedId, clearLink]);

  useEffect(() => {
    if (!resolved || !linkedId || selectedId !== linkedId || pendingFocus.current !== linkedId) return;
    pendingFocus.current = null;
    focusEntityDetailTitle();
  }, [resolved, selectedId, linkedId]);

  return { linkedId, clearLink };
}
