import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Helper to make a URL slug from client name (mirrors ClientPortalSection)
const createClientSlug = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

interface BypassResponse {
  bypassToken: string;
  shortCode: string;
  portalToken: string;
  clientId: string;
  clientName: string;
  expiresAt: number;
}

export const useAdminPortalBypass = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ clientId, clientName }: { clientId: string; clientName: string }) => {
      const { data, error } = await supabase.functions.invoke<BypassResponse>(
        'admin-portal-bypass',
        { body: { clientId } },
      );
      if (error) throw error;
      if (!data?.bypassToken) throw new Error('No se pudo generar el token de acceso');

      const slug = createClientSlug(clientName);
      const url = `${window.location.origin}/portal/${slug}-${data.shortCode}?admin_bypass=${encodeURIComponent(data.bypassToken)}`;
      // Navigate in this tab: opening a popup after the request may be blocked.
      window.location.assign(url);
      return data;
    },
    onError: (err: Error) => {
      console.error('admin portal bypass error:', err);
      toast({
        title: 'Error',
        description: err?.message || 'No se pudo abrir el portal del cliente',
        variant: 'destructive',
      });
    },
  });
};
