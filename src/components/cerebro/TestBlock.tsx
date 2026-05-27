import React, { useState } from 'react';
import { MessageSquareText, Loader2, Send, Sparkles, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '../Button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from './StatusBadge';
import type { InstanceStatus } from '@/hooks/useInstance';

const TEXT = {
  title: 'Testar o cérebro',
  subtitle: 'Envie uma mensagem e veja a resposta real da Nina, sem disparar nada no WhatsApp.',
  inputLabel: 'Mensagem de teste',
  placeholder: 'Ex: Olá, quais serviços vocês oferecem?',
  cta: 'Testar',
  thinking: 'Pensando… (pode levar até ~35s)',
  responseLabel: 'Resposta da Nina',
  latencyPrefix: 'Respondeu em',
  emptyResponse: '(a Nina respondeu vazio)',
  hint: 'A mensagem conversa com o seu OpenClaw e nunca é enviada a um WhatsApp real.',
  heartbeatLabel: 'Status da instância',
} as const;

const ERR = {
  empty: 'Digite uma mensagem para testar.',
  noInstance: 'Nenhuma instância OpenClaw online — instale/conecte primeiro.',
  dispatch: 'Falha ao falar com o cérebro. Tente novamente.',
  timeout: 'O cérebro demorou demais pra responder, tente de novo.',
  agent: 'O agente retornou um erro. Tente novamente.',
  generic: 'Erro ao testar o cérebro. Tente novamente.',
} as const;

/** Mapeia o erro do functions.invoke (não-2xx) para uma mensagem amigável. */
async function mapInvokeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  switch (ctx?.status) {
    case 409:
      return ERR.noInstance;
    case 502:
      return ERR.dispatch;
    case 504:
      return ERR.timeout;
  }
  if (ctx && typeof ctx.json === 'function') {
    try {
      const payload = await ctx.json();
      if (payload?.message) return payload.message as string;
    } catch {
      /* corpo não-JSON: cai no genérico */
    }
  }
  return ERR.generic;
}

type Phase = 'idle' | 'loading' | 'success' | 'error';

interface TestResult {
  content: string;
  latencyMs: number;
}

interface TestBlockProps {
  status: InstanceStatus;
}

const TestBlock: React.FC<TestBlockProps> = ({ status }) => {
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<TestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLoading = phase === 'loading';
  const canTest = !isLoading && message.trim().length > 0;

  const handleTest = async () => {
    if (!message.trim()) {
      toast.error(ERR.empty);
      return;
    }

    setPhase('loading');
    setResult(null);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke('nina-test', {
        body: { message: message.trim() },
      });

      if (error) {
        setErrorMsg(await mapInvokeError(error));
        setPhase('error');
        return;
      }

      // O backend pode devolver HTTP 200 com { error: 'agent_error' }.
      if (data?.error) {
        setErrorMsg(data.error === 'agent_error' ? ERR.agent : (data.message ?? ERR.generic));
        setPhase('error');
        return;
      }

      setResult({ content: data?.content ?? '', latencyMs: data?.latency_ms ?? 0 });
      setPhase('success');
    } catch (err) {
      console.error('[TestBlock] Erro ao testar o cérebro:', err);
      setErrorMsg(ERR.generic);
      setPhase('error');
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-center gap-3 mb-1">
        <MessageSquareText className="w-5 h-5 text-cyan-400" />
        <h3 className="font-semibold text-white">{TEXT.title}</h3>
      </div>
      <p className="text-sm text-slate-400 mb-5">{TEXT.subtitle}</p>

      <label className="text-xs font-medium text-slate-400 mb-1.5 block">{TEXT.inputLabel}</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={TEXT.placeholder}
        rows={3}
        disabled={isLoading}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none disabled:opacity-60"
      />
      <p className="mt-2 text-xs text-slate-500">{TEXT.hint}</p>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{TEXT.heartbeatLabel}:</span>
          <StatusBadge status={status} />
        </div>
        <Button onClick={handleTest} disabled={!canTest}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testando…
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {TEXT.cta}
            </>
          )}
        </Button>
      </div>

      {isLoading && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin flex-shrink-0" />
          <p className="text-sm text-cyan-300">{TEXT.thinking}</p>
        </div>
      )}

      {phase === 'success' && result && (
        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">{TEXT.responseLabel}</span>
          </div>
          <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">
            {result.content || <span className="text-slate-500">{TEXT.emptyResponse}</span>}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            {TEXT.latencyPrefix} {(result.latencyMs / 1000).toFixed(1)}s
          </div>
        </div>
      )}

      {phase === 'error' && errorMsg && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-px" />
          <p className="text-sm text-red-300">{errorMsg}</p>
        </div>
      )}
    </div>
  );
};

export default TestBlock;
