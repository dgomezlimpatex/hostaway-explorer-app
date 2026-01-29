
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useVerifyPortalShortCode, useVerifyPortalToken, useAuthenticatePortal, extractShortCodeFromIdentifier } from '@/hooks/useClientPortal';
import { PortalSession } from '@/types/clientPortal';
import { ClientPortalAuth } from '@/components/client-portal/ClientPortalAuth';
import { ClientPortalDashboard } from '@/components/client-portal/ClientPortalDashboard';
import { Loader2, AlertCircle } from 'lucide-react';

const SESSION_KEY = 'client_portal_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const ClientPortal = () => {
  // Support both new format (/portal/client-name-abc12def) and legacy (/portal/uuid-token)
  const { identifier, token: legacyToken, clientSlug } = useParams<{ 
    identifier?: string; 
    token?: string;
    clientSlug?: string;
  }>();
  
  // Determine which identifier to use
  const urlIdentifier = identifier || legacyToken || (clientSlug && legacyToken ? legacyToken : undefined);
  
  const [session, setSession] = useState<PortalSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  // Try short_code lookup first (new format)
  const { data: shortCodeData, isLoading: isVerifyingShortCode, error: shortCodeError } = useVerifyPortalShortCode(urlIdentifier);
  
  // Fallback to legacy token lookup if short_code fails
  const shouldTryLegacy = !shortCodeData && !isVerifyingShortCode && urlIdentifier;
  const { data: legacyData, isLoading: isVerifyingLegacy } = useVerifyPortalToken(shouldTryLegacy ? urlIdentifier : undefined);
  
  const portalData = shortCodeData || legacyData;
  const isVerifying = isVerifyingShortCode || (shouldTryLegacy && isVerifyingLegacy);
  const error = !portalData && !isVerifying ? shortCodeError : null;
  
  const authenticateMutation = useAuthenticatePortal();

  // Check for existing session on mount
  useEffect(() => {
    const storedSession = sessionStorage.getItem(SESSION_KEY);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as PortalSession;
        // Verify session is for this identifier and not expired
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

  // Loading states
  if (isCheckingSession || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando portal...</p>
        </div>
      </div>
    );
  }

  // Invalid or inactive portal
  if (error || !portalData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold">Enlace no válido</h1>
          <p className="text-muted-foreground">
            Este enlace no existe o ha sido desactivado.
          </p>
          <p className="text-sm text-muted-foreground">
            Contacta con tu supervisor para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated - show PIN form
  if (!session) {
    return (
      <ClientPortalAuth
        clientName={portalData.clientName}
        onAuthenticate={handleAuthenticate}
        isLoading={authenticateMutation.isPending}
        error={authenticateMutation.error?.message}
      />
    );
  }

  // Authenticated - show dashboard
  return (
    <ClientPortalDashboard
      clientId={session.clientId}
      clientName={session.clientName}
      onLogout={handleLogout}
    />
  );
};

export default ClientPortal;
