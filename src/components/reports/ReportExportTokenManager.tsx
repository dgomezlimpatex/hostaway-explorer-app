import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Trash2, Plus, Link2, Eye, EyeOff } from 'lucide-react';

export default function ReportExportTokenManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTokenName, setNewTokenName] = useState('');
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());

  const { data: tokens, isLoading } = useQuery({
    queryKey: ['report-export-tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_export_tokens')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createToken = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data, error } = await supabase
        .from('report_export_tokens')
        .insert({ name: name || 'Token de exportación', created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['report-export-tokens'] });
      setNewTokenName('');
      setVisibleTokens(prev => new Set(prev).add(data.id));
      toast({ title: 'Token creado', description: 'Copia el token y pégalo en tu script de Google Sheets.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleToken = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('report_export_tokens')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-export-tokens'] });
      toast({ title: 'Token actualizado' });
    },
  });

  const deleteToken = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('report_export_tokens')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-export-tokens'] });
      toast({ title: 'Token eliminado' });
    },
  });

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: 'Copiado', description: 'Token copiado al portapapeles' });
  };

  const toggleVisibility = (id: string) => {
    setVisibleTokens(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'qyipyygojlfhdghnraus';
  const endpointUrl = `https://${projectId}.supabase.co/functions/v1/daily-report-csv`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Exportación automática a Google Sheets
        </CardTitle>
        <CardDescription>
          Genera un token de acceso para que tu Google Sheets pueda obtener los reportes diarios automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new token */}
        <div className="flex gap-2">
          <Input
            placeholder="Nombre del token (ej: Sheets principal)"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
          />
          <Button
            onClick={() => createToken.mutate(newTokenName)}
            disabled={createToken.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Crear token
          </Button>
        </div>

        {/* Endpoint info */}
        <div className="bg-muted p-3 rounded-md text-sm">
          <p className="font-medium mb-1">URL del endpoint:</p>
          <code className="text-xs break-all">{endpointUrl}?token=TU_TOKEN&date=YYYY-MM-DD</code>
        </div>

        {/* Token list */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Cargando tokens...</p>
        ) : tokens && tokens.length > 0 ? (
          <div className="space-y-2">
            {tokens.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 border rounded-md gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.name}</span>
                    <Badge variant={t.is_active ? 'default' : 'secondary'}>
                      {t.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono truncate">
                    {visibleTokens.has(t.id) ? t.token : '••••••••••••••••'}
                  </div>
                  {t.last_used_at && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Último uso: {new Date(t.last_used_at).toLocaleString('es-ES')}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => toggleVisibility(t.id)}>
                    {visibleTokens.has(t.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => copyToken(t.token)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleToken.mutate({ id: t.id, is_active: !t.is_active })}
                  >
                    {t.is_active ? '⏸️' : '▶️'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteToken.mutate(t.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No hay tokens creados. Crea uno para empezar.</p>
        )}
      </CardContent>
    </Card>
  );
}
