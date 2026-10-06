import { useCallback, useEffect, useRef, useState } from 'react';

/** Ignore layout-induced scrolling during the collapse animation and tiny direction changes. */
export function usePlanningScrollChrome(day?: string) {
  const [collapsed, setCollapsed] = useState(false);
  const hidden = useRef(false);
  const quietUntil = useRef(0);
  const positions = useRef({page: 0, timeline: 0});
  const travel = useRef({page: 0, timeline: 0});
  const onScroll = useCallback((position: number, source: 'page' | 'timeline') => {
    const next = Math.max(0, position);
    const delta = next - positions.current[source];
    positions.current[source] = next;
    if (!window.matchMedia('(min-width: 1024px)').matches || performance.now() < quietUntil.current) return;
    travel.current[source] = Math.sign(delta) === Math.sign(travel.current[source])
      ? travel.current[source] + delta : delta;
    const shouldHide = next > 48 && travel.current[source] > 32;
    const shouldShow = next <= 8 || travel.current[source] < -24;
    const value = shouldHide ? true : shouldShow ? false : hidden.current;
    if (value === hidden.current) return;
    hidden.current = value;
    quietUntil.current = performance.now() + 400;
    travel.current = {page: 0, timeline: 0};
    setCollapsed(value);
  }, []);
  useEffect(() => {
    hidden.current = false;
    setCollapsed(false);
    positions.current = {page: window.scrollY, timeline: 0};
    travel.current = {page: 0, timeline: 0};
    quietUntil.current = 0;
  }, [day]);
  useEffect(() => {
    const scroll = () => onScroll(window.scrollY, 'page');
    const media = window.matchMedia('(min-width: 1024px)');
    const resize = () => {
      if (!media.matches) { hidden.current = false; setCollapsed(false); }
    };
    window.addEventListener('scroll', scroll, {passive: true});
    media.addEventListener('change', resize);
    return () => { window.removeEventListener('scroll', scroll); media.removeEventListener('change', resize); };
  }, [onScroll]);
  return {collapsed, onScroll};
}
