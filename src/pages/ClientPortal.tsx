
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useVerifyPortalShortCode, useVerifyPortalToken, useAuthenticatePortal, extractShortCodeFromIdentifier } from '@/hooks/useClientPortal';
import { PortalSession } from '@/types/clientPortal';
import { ClientPortalAuth } from '@/components/client-portal/ClientPortalAuth';
import { ClientPortalDashboard } from '@/components/client-portal/ClientPortalDashboard';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

const SESSION_KEY = 'client_portal_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const ClientPortal = () => {
  const { identifier, token: legacyToken, clientSlug } = useParams<{
    identifier?: string;
    token?: string;
    clientSlug?: string;
  }>();
  const [searchParams] = useSearchParams();
  const adminBypassToken = searchParams.get('admin_bypass');

  const urlIdentifier = identifier || legacyToken || (clientSlug && legacyToken ? legacyToken : undefined);

  const [session, setSession] = useState<PortalSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [bypassError, setBypassError] = useState<string | null>(null);

  // Skip normal verification entirely while bypass is being processed
  const skipVerification = !!adminBypassToken && !session;

  const { data: shortCodeData, isLoading: isVerifyingShortCode, error: shortCodeError } =
    useVerifyPortalShortCode(skipVerification ? undefined : urlIdentifier);

  const shouldTryLegacy = !skipVerification && !shortCodeData && !isVerifyingShortCode && !!urlIdentifier;
  const { data: legacyData, isLoading: isVerifyingLegacy } =
    useVerifyPortalToken(shouldTryLegacy ? urlIdentifier : undefined);

  const portalData = shortCodeData || legacyData;
  const isVerifying = !skipVerification && (isVerifyingShortCode || (shouldTryLegacy && isVerifyingLegacy));
  const error = !skipVerification && !portalData && !isVerifying ? shortCodeError : null;

  const authenticateMutation = useAuthenticatePortal();

  // Restore session on mount
  useEffect(() => {
    const storedSession = sessionStorage.getItem(SESSION_KEY);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as PortalSession;
        const sessionIdentifier = parsed.shortCode || parsed.portalToken;
        const currentShortCode = urlIdentifier ? extractShortCodeFromIdentifier(urlIdentifier) : null;
        if (
          (sessionIdentifier === currentShortCode || parsed.portalToken === urlIdentifier) &&
          Date.now() - parsed.authenticatedAt < SESSION_DURATION
        ) {
          setSession(parsed);
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
    setIsCheckingSession(false);
  }, [urlIdentifier]);

  // Handle admin bypass token
  useEffect(() => {
    if (!adminBypassToken || session || isCheckingSession) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('verify-portal-bypass', {
          body: { bypassToken: adminBypassToken },
        });
        if (cancelled) return;
        if (fnErr || !data?.clientId) {
          setBypassError(data?.error || fnErr?.message || 'Token de acceso inválido o expirado');
          return;
        }
        const newSession: PortalSession = {
          clientId: data.clientId,
          clientName: data.clientName,
          portalToken: data.portalToken,
          shortCode: data.shortCode,
          authenticatedAt: Date.now(),
          isAdminBypass: true,
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
        setSession(newSession);
      } catch (err: any) {
        if (!cancelled) setBypassError(err?.message || 'Error verificando acceso admin');
      }
    })();

    return () => { cancelled = true; };
  }, [adminBypassToken, session, isCheckingSession]);

  const handleAuthenticate = async (pin: string) => {
    if (!urlIdentifier) return;
    const result = await authenticateMutation.mutateAsync({ identifier: urlIdentifier, pin });
    const newSession: PortalSession = {
      clientId: result.clientId,
      clientName: result.clientName,
      portalToken: result.portalToken,
      shortCode: result.shortCode,
      authenticatedAt: Date.now(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  if (isCheckingSession || isVerifying || (adminBypassToken && !session && !bypassError)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            {adminBypassToken ? 'Verificando acceso de administrador...' : 'Cargando portal...'}
          </p>
        </div>
      </div>
    );
  }

  if (bypassError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold">Acceso de administrador no válido</h1>
          <p className="text-muted-foreground">{bypassError}</p>
        </div>
      </div>
    );
  }

  if (!session && (error || !portalData)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold">Enlace no válido</h1>
          <p className="text-muted-foreground">Este enlace no existe o ha sido desactivado.</p>
          <p className="text-sm text-muted-foreground">Contacta con tu supervisor para obtener acceso.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <ClientPortalAuth
        clientName={portalData!.clientName}
        onAuthenticate={handleAuthenticate}
        isLoading={authenticateMutation.isPending}
        error={authenticateMutation.error?.message}
      />
    );
  }

  return (
    <>
      {session.isAdminBypass && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-2 flex items-center justify-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          Estás viendo este portal como administrador (acceso temporal).
        </div>
      )}
      <ClientPortalDashboard
        clientId={session.clientId}
        clientName={session.clientName}
        onLogout={handleLogout}
      />
    </>
  );
};

export default ClientPortal;

