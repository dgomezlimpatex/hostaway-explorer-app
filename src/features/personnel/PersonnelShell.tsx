import React, { useEffect, useRef } from "react";
import {
  Link,
  useLocation,
  useNavigationType,
  useSearchParams,
} from "react-router-dom";
import { Users, ChartNoAxesCombined, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import "./personnel.css";
export function usePersonnelParams() {
  const [params, setParams] = useSearchParams();
  const change = (
    key: string,
    value: string,
    extra: Record<string, string> = {},
  ) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [k, v] of Object.entries({ ...extra, [key]: value })) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (key === "date") next.delete("day");
        return next;
      },
      { replace: true },
    );
  return { params, change };
}
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
export function PersonnelShell({
  children,
  hours = false,
}: {
  children: React.ReactNode;
  hours?: boolean;
}) {
  const { userRole } = useAuth();
  const location = useLocation();
  const navigation = useNavigationType();
  const canManage = userRole === "admin" || userRole === "manager";
  const previousPath = useRef("");
  useEffect(() => {
    const key = `personnel-scroll:${location.pathname}${location.search}`;
    const changedPath = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    const raf = requestAnimationFrame(() => {
      if (navigation === "POP" || changedPath)
        window.scrollTo(
          0,
          navigation === "POP" ? Number(sessionStorage.getItem(key) || 0) : 0,
        );
    });
    const save = () => sessionStorage.setItem(key, String(window.scrollY));
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", save);
    };
  }, [location.pathname, location.search, navigation]);
  return (
    <div className="personnel">
      <header className="personnel-top">
        <div className="personnel-top-inner">
          <Link
            to="/"
            className="personnel-brand"
            aria-label="LIMPATEX, volver al menú"
          >
            <span className="personnel-monogram">L</span>
            <span>
              <strong>LIMPATEX</strong>
              <small>Gestión de personal</small>
            </span>
          </Link>
          <nav className="personnel-nav" aria-label="Personal">
            <Link to="/workers" aria-current={!hours ? "page" : undefined}>
              <Users size={17} />
              Equipo
            </Link>
            {canManage && (
              <Link
                to="/workers/hours"
                aria-current={hours ? "page" : undefined}
              >
                <ChartNoAxesCombined size={17} />
                Control de horas
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="personnel-main">{children}</main>
    </div>
  );
}
export const PersonnelBack = ({
  to = "/workers",
  children = "Volver al equipo",
}: {
  to?: string;
  children?: React.ReactNode;
}) => (
  <Link className="p-back" to={to}>
    <ArrowLeft size={14} />
    {children}
  </Link>
);
