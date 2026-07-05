import { FormEvent, useMemo, useState } from 'react';
import { Bot, MessageSquareText, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { AssignmentProposalResult } from '@/types/cleaningPlanning';
import type { PlanningCopilotMessage, PlanningCopilotSnapshot } from '@/types/planningCopilot';
import { buildPlanningCopilotReply } from '@/services/planning/copilot/planningCopilotLocal';
import { describePlanningScope } from '@/services/planning/copilot/planningSnapshot';
import { proposalsToCopilotActions } from '@/types/planningCopilot';

interface PlanningCopilotPanelProps {
  snapshot: PlanningCopilotSnapshot;
  isGenerating?: boolean;
  isApplying?: boolean;
  onGenerateProposal: () => AssignmentProposalResult;
  onClearProposal: () => void;
}

const nowIso = () => new Date().toISOString();
const messageId = () => `planning-copilot-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildInitialMessage = (snapshot: PlanningCopilotSnapshot): PlanningCopilotMessage => ({
  id: messageId(),
  role: 'assistant',
  createdAt: nowIso(),
  content: [
    'Soy Hermes dentro de planificación.',
    `Trabajo solo sobre esta vista: ${describePlanningScope(snapshot)}.`,
    'Preparo recomendaciones, pero tú confirmas antes de guardar y notificar.',
  ].join(' '),
});

export const PlanningCopilotPanel = ({
  snapshot,
  isGenerating,
  isApplying,
  onGenerateProposal,
  onClearProposal,
}: PlanningCopilotPanelProps) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<PlanningCopilotMessage[]>(() => [buildInitialMessage(snapshot)]);
  const scopeLabel = useMemo(() => describePlanningScope(snapshot), [snapshot]);
  const proposal = snapshot.activeProposal;
  const canGenerate = !isGenerating && !isApplying && snapshot.visibleUnassignedTasks.length > 0;

  const appendMessage = (message: PlanningCopilotMessage) => {
    setMessages((current) => [...current, message]);
  };

  const generateProposal = (source: 'button' | 'instruction' = 'button') => {
    if (!canGenerate) return null;
    const generated = onGenerateProposal();
    appendMessage({
      id: messageId(),
      role: 'assistant',
      createdAt: nowIso(),
      content: source === 'button'
        ? `He preparado un plan recomendado: ${generated.proposals.length} asignaciones y ${generated.conflicts.length} decisiones pendientes.`
        : `Plan recalculado con tu instrucción: ${generated.proposals.length} asignaciones y ${generated.conflicts.length} decisiones pendientes.`,
      actions: proposalsToCopilotActions(generated.proposals),
      proposal: generated,
      conflicts: generated.conflicts,
    });
    return generated;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating || isApplying) return;

    appendMessage({ id: messageId(), role: 'user', content: trimmed, createdAt: nowIso() });
    setInput('');

    const reply = buildPlanningCopilotReply(trimmed, snapshot);
    if (reply.shouldGenerateProposal) {
      const generated = generateProposal('instruction');
      if (!generated) {
        appendMessage({
          id: messageId(),
          role: 'assistant',
          createdAt: nowIso(),
          content: 'No hay limpiezas sin responsable en esta vista para proponer ahora.',
          actions: [],
        });
      }
      return;
    }

    appendMessage({
      id: messageId(),
      role: 'assistant',
      createdAt: nowIso(),
      content: reply.message,
      actions: reply.actions,
      proposal: snapshot.activeProposal,
      conflicts: snapshot.activeProposal?.conflicts,
    });
  };

  const askHermes = (command: string) => {
    const reply = buildPlanningCopilotReply(command, snapshot);
    appendMessage({ id: messageId(), role: 'user', content: command, createdAt: nowIso() });
    appendMessage({
      id: messageId(),
      role: 'assistant',
      createdAt: nowIso(),
      content: reply.message,
      actions: reply.actions,
      proposal: snapshot.activeProposal,
      conflicts: snapshot.activeProposal?.conflicts,
    });
  };

  return (
    <Card className="border-[#310984]/12 bg-white text-[#171321] shadow-lg shadow-[#310984]/8">
      <CardHeader className="space-y-3 border-b border-[#310984]/10 pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
              <Bot className="h-5 w-5 text-[#310984]" /> Hermes te ayuda a cerrar el día
            </CardTitle>
            <p className="mt-1 text-sm leading-5 text-[#6b627a]">
              Planifica esta vista, explica pendientes y prepara cambios. Tú confirmas antes de guardar y notificar.
            </p>
          </div>
          <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
            <ShieldCheck className="mr-1 h-3 w-3" /> con confirmación
          </Badge>
        </div>
        <div className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3 text-xs text-[#6b627a]">
          {scopeLabel}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <div className="rounded-3xl border border-[#310984]/10 bg-[#faf8ff] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-[#171321]">Plan recomendado por Hermes</p>
              {!proposal ? (
                <p className="mt-1 text-sm text-[#6b627a]">Todavía no hay plan recomendado. Usa el botón principal de arriba para prepararlo.</p>
              ) : (
                <p className="mt-1 text-sm text-[#6b627a]">
                  {proposal.proposals.length} asignación{proposal.proposals.length === 1 ? '' : 'es'} preparadas · {proposal.conflicts.length} decisión{proposal.conflicts.length === 1 ? '' : 'es'} pendiente{proposal.conflicts.length === 1 ? '' : 's'}.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {proposal && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]"
                  onClick={onClearProposal}
                >
                  Limpiar plan
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-[44px] border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]" onClick={() => askHermes('resumen')}>
            Resumen
          </Button>
          <Button type="button" variant="outline" className="min-h-[44px] border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]" onClick={() => askHermes('explica pendientes')}>
            Explicar pendientes
          </Button>
        </div>

        <details className="rounded-2xl border border-[#310984]/10 bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-[#310984]">
            <span className="inline-flex items-center gap-2"><MessageSquareText className="h-4 w-4" /> Añadir instrucción o ver conversación avanzada</span>
          </summary>

          <div className="mt-3 space-y-3">
            <ScrollArea className="h-[220px] rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3">
              <div className="space-y-3 pr-2">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-5 ${message.role === 'user' ? 'bg-[#310984] text-white' : 'bg-white text-[#171321] shadow-sm'}`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.actions && message.actions.length > 0 && (
                        <p className={message.role === 'user' ? 'mt-2 text-[11px] text-white/70' : 'mt-2 text-[11px] text-[#6b627a]'}>
                          {message.actions.length} acción{message.actions.length === 1 ? '' : 'es'} preparadas · requieren confirmación.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <form onSubmit={handleSubmit} className="space-y-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ej.: planifica evitando usar a Ana salvo emergencia…"
                className="min-h-[74px] resize-none border-[#310984]/12 bg-white text-[#171321] placeholder:text-[#6b627a]/55"
              />
              <Button
                type="submit"
                className="w-full bg-[#310984] text-white shadow-lg shadow-[#310984]/20 hover:bg-[#4c1bb0]"
                disabled={!input.trim() || isGenerating || isApplying}
              >
                <Send className="mr-2 h-4 w-4" /> Enviar instrucción a Hermes
              </Button>
            </form>
          </div>
        </details>
      </CardContent>
    </Card>
  );
};
