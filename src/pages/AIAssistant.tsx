import { FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, Loader2, Pencil, RefreshCw, Send, ShieldCheck, Sparkles, Trash2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { useToast } from '@/hooks/use-toast';
import { isAiAllowedUser } from '@/utils/aiAccess';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AiProposal = {
  id: string;
  title: string;
  summary: string;
  status: 'pending' | 'applied' | 'discarded' | 'failed';
  actions: Array<Record<string, unknown>>;
  created_at: string;
};

type AiMemory = {
  id: string;
  category: string;
  content: string;
  is_active: boolean;
  updated_at: string;
};

type AiLearningSuggestion = {
  id: string;
  status: 'pending' | 'approved' | 'edited' | 'discarded';
  category: string;
  title: string;
  content: string;
  confidence: number;
  evidence: Array<{ eventId?: string; summary?: string }>;
  created_at: string;
};

function fromUntypedTable(table: string) {
  return supabase.from(table as never);
}

function formatMadridDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function describeAction(action: Record<string, unknown>) {
  if (action.type === 'assign_task') {
    return `Asignar tarea ${String(action.taskId || '').slice(0, 8)} a trabajador ${String(action.cleanerId || '').slice(0, 8)}`;
  }
  if (action.type === 'create_task') {
    return `Crear tarea para propiedad ${String(action.propertyId || '').slice(0, 8)} el ${action.date || 'día indicado'}`;
  }
  return `Acción ${String(action.type || 'desconocida')}`;
}

export default function AIAssistant() {
  const { user, profile, isLoading } = useAuth();
  const { activeSede } = useSede();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = useMemo(() => formatMadridDate(new Date()), []);
  const defaultTo = useMemo(() => formatMadridDate(addDays(new Date(), 15)), []);

  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [latestUsage, setLatestUsage] = useState<{ estimatedCostUsd?: number; model?: string } | null>(null);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryText, setEditingMemoryText] = useState('');
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editingSuggestionText, setEditingSuggestionText] = useState('');

  const allowed = isAiAllowedUser(user, profile);

  const memoriesQuery = useQuery({
    queryKey: ['ai-memories', user?.id],
    enabled: allowed && !!user?.id,
    queryFn: async () => {
      const { data, error } = await fromUntypedTable('ai_memories')
        .select('id,category,content,is_active,updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AiMemory[];
    },
  });

  const proposalsQuery = useQuery({
    queryKey: ['ai-proposals', user?.id],
    enabled: allowed && !!user?.id,
    queryFn: async () => {
      const { data, error } = await fromUntypedTable('ai_action_proposals')
        .select('id,title,summary,status,actions,created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as unknown as AiProposal[];
    },
  });

  const learningSuggestionsQuery = useQuery({
    queryKey: ['ai-learning-suggestions', user?.id],
    enabled: allowed && !!user?.id,
    queryFn: async () => {
      const { data, error } = await fromUntypedTable('ai_learning_suggestions')
        .select('id,status,category,title,content,confidence,evidence,created_at')
        .in('status', ['pending', 'edited'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as AiLearningSuggestion[];
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: text,
          conversationId,
          dateFrom,
          dateTo,
          sedeId: activeSede?.id || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onMutate: async (text) => {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: text }]);
      setMessage('');
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId || null);
      if (data.message?.content) {
        setMessages((current) => [
          ...current,
          { id: data.message.id || crypto.randomUUID(), role: 'assistant', content: data.message.content },
        ]);
      }
      setLatestUsage(data.usage || null);
      queryClient.invalidateQueries({ queryKey: ['ai-memories'] });
      queryClient.invalidateQueries({ queryKey: ['ai-proposals'] });
    },
    onError: (error) => {
      toast({
        title: 'Error en el copiloto',
        description: error instanceof Error ? error.message : 'No se pudo responder.',
        variant: 'destructive',
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const { data, error } = await supabase.functions.invoke('apply-ai-actions', {
        body: { proposalId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? 'Propuesta aplicada' : 'Propuesta aplicada con errores',
        description: `${data.results?.length ?? 0} acciones procesadas.`,
        variant: data.success ? 'default' : 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['ai-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo aplicar',
        description: error instanceof Error ? error.message : 'Error desconocido.',
        variant: 'destructive',
      });
    },
  });

  const discardProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await fromUntypedTable('ai_action_proposals')
        .update({ status: 'discarded', updated_at: new Date().toISOString() } as never)
        .eq('id', proposalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-proposals'] }),
  });

  const toggleMemoryMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await fromUntypedTable('ai_memories')
        .update({ is_active: active, updated_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-memories'] }),
  });

  const updateMemoryMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await fromUntypedTable('ai_memories')
        .update({ content, updated_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingMemoryId(null);
      setEditingMemoryText('');
      queryClient.invalidateQueries({ queryKey: ['ai-memories'] });
    },
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromUntypedTable('ai_memories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-memories'] }),
  });

  const analyzeLearningMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-learning-review', {
        body: { limit: 100 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Revisión completada',
        description: `${data.analyzed ?? 0} eventos analizados. ${data.inserted ?? 0} aprendizajes sugeridos.`,
      });
      queryClient.invalidateQueries({ queryKey: ['ai-learning-suggestions'] });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo analizar',
        description: error instanceof Error ? error.message : 'Error desconocido.',
        variant: 'destructive',
      });
    },
  });

  const updateSuggestionMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await fromUntypedTable('ai_learning_suggestions')
        .update({ content, status: 'edited', updated_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingSuggestionId(null);
      setEditingSuggestionText('');
      queryClient.invalidateQueries({ queryKey: ['ai-learning-suggestions'] });
    },
  });

  const approveSuggestionMutation = useMutation({
    mutationFn: async (suggestion: AiLearningSuggestion) => {
      if (!user?.id) throw new Error('Usuario no disponible.');
      const { error: memoryError } = await fromUntypedTable('ai_memories').insert({
        owner_user_id: user.id,
        owner_email: user.email?.toLowerCase() || 'dgomezlimpatex@gmail.com',
        category: suggestion.category || 'operativa',
        content: suggestion.content,
        source: 'learning_suggestion',
      } as never);
      if (memoryError) throw memoryError;

      const { error: suggestionError } = await fromUntypedTable('ai_learning_suggestions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', suggestion.id);
      if (suggestionError) throw suggestionError;
    },
    onSuccess: () => {
      toast({ title: 'Aprendizaje aprobado', description: 'Ya forma parte de la memoria activa del copiloto.' });
      queryClient.invalidateQueries({ queryKey: ['ai-learning-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['ai-memories'] });
    },
  });

  const discardSuggestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromUntypedTable('ai_learning_suggestions')
        .update({
          status: 'discarded',
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-learning-suggestions'] }),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || chatMutation.isPending) return;
    chatMutation.mutate(text);
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 pb-28 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Copiloto IA</h1>
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Privado
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Planificación operativa privada para {profile?.email || user?.email}.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[360px]">
            <div>
              <Label htmlFor="date-from" className="text-xs">Desde</Label>
              <Input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="date-to" className="text-xs">Hasta</Label>
              <Input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="flex min-h-[70vh] flex-col">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" /> Chat operativo
              </CardTitle>
              <CardDescription>
                Pregunta por tareas, reservas, carga futura o pide una propuesta. Las acciones requieren confirmación.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 p-4">
              <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-white p-3">
                {messages.length === 0 ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-muted-foreground">
                    <Bot className="mb-3 h-10 w-10 text-slate-300" />
                    <p className="max-w-md text-sm">
                      Prueba con: “Revisa los próximos 15 días y dime qué tareas están sin asignar”.
                    </p>
                  </div>
                ) : (
                  messages.map((item) => (
                    <div
                      key={item.id}
                      className={item.role === 'user' ? 'ml-auto max-w-[85%] rounded-2xl bg-blue-600 p-3 text-sm text-white' : 'mr-auto max-w-[90%] whitespace-pre-wrap rounded-2xl border bg-slate-50 p-3 text-sm'}
                    >
                      {item.content}
                    </div>
                  ))
                )}
                {chatMutation.isPending && (
                  <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border bg-slate-50 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Pensando con contexto operativo...
                  </div>
                )}
              </div>

              {latestUsage?.estimatedCostUsd !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Última respuesta: coste estimado ${latestUsage.estimatedCostUsd} · modelo {latestUsage.model}
                </p>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe al copiloto..."
                  className="min-h-[72px] flex-1 resize-none"
                />
                <Button type="submit" disabled={chatMutation.isPending || !message.trim()} className="sm:w-28">
                  {chatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Tabs defaultValue="proposals" className="space-y-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="proposals">Propuestas</TabsTrigger>
              <TabsTrigger value="memory">Memoria</TabsTrigger>
              <TabsTrigger value="learning">Aprendizaje</TabsTrigger>
            </TabsList>

            <TabsContent value="proposals">
              <Card>
                <CardHeader>
                  <CardTitle>Propuestas pendientes</CardTitle>
                  <CardDescription>Revisa antes de aplicar. Nada se ejecuta automáticamente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {proposalsQuery.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : proposalsQuery.data?.length ? (
                    proposalsQuery.data.map((proposal) => (
                      <div key={proposal.id} className="rounded-xl border bg-white p-3">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{proposal.title}</p>
                            <p className="text-xs text-muted-foreground">{proposal.summary}</p>
                          </div>
                          <Badge variant={proposal.status === 'pending' ? 'default' : 'outline'}>
                            {proposal.status}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                          {(proposal.actions || []).slice(0, 4).map((action, index) => (
                            <p key={index}>• {describeAction(action)}</p>
                          ))}
                          {proposal.actions.length > 4 && <p>• {proposal.actions.length - 4} acciones más...</p>}
                        </div>
                        {proposal.status === 'pending' && (
                          <>
                            <Button
                              className="mt-3 w-full"
                              size="sm"
                              onClick={() => {
                                if (window.confirm('¿Aplicar esta propuesta de la IA?')) {
                                  applyMutation.mutate(proposal.id);
                                }
                              }}
                              disabled={applyMutation.isPending}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Aplicar propuesta
                            </Button>
                            <Button
                              className="mt-2 w-full"
                              size="sm"
                              variant="outline"
                              onClick={() => discardProposalMutation.mutate(proposal.id)}
                              disabled={discardProposalMutation.isPending}
                            >
                              Descartar
                            </Button>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Todavía no hay propuestas.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="memory">
              <Card>
                <CardHeader>
                  <CardTitle>Memoria operativa</CardTitle>
                  <CardDescription>Recuerdos que el copiloto usará en próximas respuestas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {memoriesQuery.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : memoriesQuery.data?.length ? (
                    memoriesQuery.data.map((memory) => (
                      <div key={memory.id} className="rounded-xl border bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge variant={memory.is_active ? 'default' : 'outline'}>{memory.category}</Badge>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingMemoryId(memory.id);
                                setEditingMemoryText(memory.content);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMemoryMutation.mutate({ id: memory.id, active: !memory.is_active })}
                            >
                              {memory.is_active ? 'Desactivar' : 'Activar'}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMemoryMutation.mutate(memory.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {editingMemoryId === memory.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingMemoryText}
                              onChange={(e) => setEditingMemoryText(e.target.value)}
                              className="min-h-[96px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateMemoryMutation.mutate({ id: memory.id, content: editingMemoryText.trim() })}
                                disabled={!editingMemoryText.trim() || updateMemoryMutation.isPending}
                              >
                                Guardar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingMemoryId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className={memory.is_active ? 'text-sm' : 'text-sm text-muted-foreground line-through'}>
                            {memory.content}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Aún no hay memoria guardada.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="learning">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Aprendizajes sugeridos</CardTitle>
                      <CardDescription>
                        Reglas detectadas a partir de tus acciones. Solo se guardan si las apruebas.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => analyzeLearningMutation.mutate()}
                      disabled={analyzeLearningMutation.isPending}
                    >
                      {analyzeLearningMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Analizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {learningSuggestionsQuery.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : learningSuggestionsQuery.data?.length ? (
                    learningSuggestionsQuery.data.map((suggestion) => (
                      <div key={suggestion.id} className="rounded-xl border bg-white p-3">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{suggestion.title}</p>
                              <Badge variant="outline">{suggestion.category}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Confianza {Math.round(Number(suggestion.confidence || 0) * 100)}%
                            </p>
                          </div>
                          <Badge variant={suggestion.status === 'edited' ? 'secondary' : 'default'}>
                            {suggestion.status === 'edited' ? 'editado' : 'pendiente'}
                          </Badge>
                        </div>

                        {editingSuggestionId === suggestion.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingSuggestionText}
                              onChange={(e) => setEditingSuggestionText(e.target.value)}
                              className="min-h-[110px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateSuggestionMutation.mutate({ id: suggestion.id, content: editingSuggestionText.trim() })}
                                disabled={!editingSuggestionText.trim() || updateSuggestionMutation.isPending}
                              >
                                Guardar edición
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingSuggestionId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm">{suggestion.content}</p>
                        )}

                        {suggestion.evidence?.length > 0 && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-muted-foreground">
                            <p className="mb-1 font-medium text-slate-700">Ejemplos usados:</p>
                            {suggestion.evidence.slice(0, 3).map((item, index) => (
                              <p key={`${suggestion.id}-${index}`}>- {item.summary || 'Evento operativo observado'}</p>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveSuggestionMutation.mutate(suggestion)}
                            disabled={approveSuggestionMutation.isPending}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingSuggestionId(suggestion.id);
                              setEditingSuggestionText(suggestion.content);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => discardSuggestionMutation.mutate(suggestion.id)}
                            disabled={discardSuggestionMutation.isPending}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Descartar
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No hay aprendizajes pendientes. Pulsa Analizar cuando hayas trabajado un rato con tareas o inventario.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
