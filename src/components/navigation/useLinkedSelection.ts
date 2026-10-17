import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

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
 * Keeps a listing's selection and `?param=id` in step.
 * - A navigation (global search, link, reload, Back/Forward) selects the id in
 *   the URL, or closes the detail when the param is absent.
 * - A selection made on the page is written to the URL with replace, and closing
 *   removes the param, so a closed detail never reopens from a stale URL.
 * `select` may return false to decline (e.g. unsaved changes); the URL then
 * keeps the current selection.
 */
export function useLinkedSelection(
  param: string,
  selectedId: string | null,
  select: (id: string | null) => boolean | void,
  /** True once the detail (or its "not available" notice) for selectedId is rendered. */
  resolved: boolean,
  /** Params that belong to the previous record and are dropped when the selection changes. */
  resetOnChange: readonly string[] = [],
) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const linkedId = params.get(param);
  const linkedRef = useRef(linkedId);
  linkedRef.current = linkedId;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const selectRef = useRef(select);
  selectRef.current = select;
  const resetRef = useRef(resetOnChange);
  resetRef.current = resetOnChange;
  const previousSelected = useRef(selectedId);
  const pendingFocus = useRef<string | null>(null);

  const writeSelection = useCallback((id: string | null) => {
    setParams((current) => {
      const next = new URLSearchParams([...current].filter(([key]) => key !== param && !resetRef.current.includes(key)));
      if (id) next.set(param, id);
      return next;
    }, { replace: true });
  }, [param, setParams]);

  // Layout effect: apply a navigation before paint, so the previous record is
  // never shown for a frame. Each navigation has a new key, even for the same id.
  useLayoutEffect(() => {
    if (linkedId === selectedRef.current) return;
    if (selectRef.current(linkedId) === false) writeSelection(selectedRef.current);
    else if (linkedId) pendingFocus.current = linkedId;
    else restoreFocusAfterLinkedDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // A selection changed on the page (list, close, filters) is mirrored to the URL.
  useEffect(() => {
    if (previousSelected.current === selectedId) return;
    previousSelected.current = selectedId;
    if (selectedId === linkedRef.current) return;
    writeSelection(selectedId);
    if (!selectedId) restoreFocusAfterLinkedDetail();
  }, [selectedId, writeSelection]);

  useEffect(() => {
    if (!resolved || !linkedId || selectedId !== linkedId || pendingFocus.current !== linkedId) return;
    pendingFocus.current = null;
    focusEntityDetailTitle();
  }, [resolved, selectedId, linkedId]);

  return { linkedId };
}
