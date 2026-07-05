import { FormEvent, useMemo, useState } from 'react';
import { Bot, Send, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
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
    `Estoy limitado al alcance visible: ${describePlanningScope(snapshot)}.`,
    'Puedo proponer, explicar conflictos y preparar acciones, pero tú confirmas antes de guardar y notificar.',
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

  const appendMessage = (message: PlanningCopilotMessage) => {
    setMessages((current) => [...current, message]);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating || isApplying) return;

    appendMessage({ id: messageId(), role: 'user', content: trimmed, createdAt: nowIso() });
    setInput('');

    const reply = buildPlanningCopilotReply(trimmed, snapshot);
    if (reply.shouldGenerateProposal) {
      const generated = onGenerateProposal();
      appendMessage({
        id: messageId(),
        role: 'assistant',
        createdAt: nowIso(),
        content: `${reply.message}\n\nResultado: ${generated.proposals.length} asignaciones propuestas y ${generated.conflicts.length} conflictos. Revisa el panel de propuesta antes de confirmar.`,
        actions: proposalsToCopilotActions(generated.proposals),
        proposal: generated,
        conflicts: generated.conflicts,
      });
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

  const runQuickCommand = (command: string) => {
    setInput(command);
  };

  return (
    <Card className="border-[#8b5cf6]/25 bg-gradient-to-b from-[#180f29] to-[#090512] text-white shadow-2xl shadow-[#310984]/20">
      <CardHeader className="space-y-3 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
              <Bot className="h-5 w-5 text-[#c7b8ff]" /> Copiloto Hermes
            </CardTitle>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Propuestas sobre filtros visibles. Confirmación humana obligatoria; notificaciones inmediatas solo después de confirmar.
            </p>
          </div>
          <Badge variant="outline" className="border-emerald-300/25 bg-emerald-400/10 text-emerald-100">
            <ShieldCheck className="mr-1 h-3 w-3" /> seguro
          </Badge>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/62">
          {scopeLabel}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {['planifica', 'explica conflictos', 'resumen', 'aplica'].map((command) => (
            <Button
              key={command}
              type="button"
              size="sm"
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => runQuickCommand(command)}
            >
              <Sparkles className="mr-1 h-3 w-3" /> {command}
            </Button>
          ))}
          {snapshot.activeProposal && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-white/55 hover:bg-white/10 hover:text-white"
              onClick={onClearProposal}
            >
              limpiar propuesta
            </Button>
          )}
        </div>

        <ScrollArea className="h-[320px] rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="space-y-3 pr-2">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <Bot className="mt-1 h-4 w-4 shrink-0 text-[#c7b8ff]" />}
                <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm leading-5 ${message.role === 'user' ? 'bg-[#310984] text-white' : 'bg-white/[0.06] text-white/78'}`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.actions && message.actions.length > 0 && (
                    <p className="mt-2 text-[11px] text-white/45">
                      {message.actions.length} acción{message.actions.length === 1 ? '' : 'es'} preparadas · requieren confirmación.
                    </p>
                  )}
                </div>
                {message.role === 'user' && <UserRound className="mt-1 h-4 w-4 shrink-0 text-white/45" />}
              </div>
            ))}
          </div>
        </ScrollArea>

        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ej.: planifica los filtros visibles sin usar a Ana salvo emergencia…"
            className="min-h-[74px] resize-none border-white/10 bg-black/25 text-white placeholder:text-white/35"
          />
          <Button
            type="submit"
            className="w-full bg-[#310984] text-white shadow-lg shadow-[#310984]/30 hover:bg-[#4c1bb0]"
            disabled={!input.trim() || isGenerating || isApplying}
          >
            <Send className="mr-2 h-4 w-4" /> Enviar a Hermes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
