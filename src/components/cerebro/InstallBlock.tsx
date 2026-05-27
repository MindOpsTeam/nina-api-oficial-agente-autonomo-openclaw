import React, { useState } from 'react';
import { Terminal, Loader2, Copy, Check, KeyRound, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '../Button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TEXT = {
  title: 'Instalar na sua VPS',
  subtitle: 'Gere um comando único para instalar o OpenClaw da Nina no seu servidor.',
  generate: 'Gerar comando de instalação',
  regenerate: 'Gerar novo comando',
  generating: 'Gerando...',
  commandLabel: 'Cole e execute este comando',
  copied: 'Comando copiado!',
  expiresPrefix: 'O token expira em',
  expiresSuffix: 'minutos. Gere um novo se expirar.',
  steps: [
    'Acesse sua VPS Ubuntu via SSH como root.',
    'Cole o comando abaixo no terminal e pressione Enter.',
    'Aguarde a instalação concluir — a instância aparecerá em "Status da instância".',
  ],
  oneTimeNote:
    'O comando carrega apenas um token de instalação de uso único. Nenhum outro segredo é exposto.',
  error: 'Falha ao gerar o comando de instalação',
} as const;

const InstallBlock: React.FC = () => {
  const [generating, setGenerating] = useState(false);
  const [installCommand, setInstallCommand] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(30);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('onboarding-issue-token');
      if (error) throw error;
      if (!data?.install_command) throw new Error(TEXT.error);

      setInstallCommand(data.install_command);
      setExpiresIn(typeof data.expires_in_minutes === 'number' ? data.expires_in_minutes : 30);
      setCopied(false);
      toast.success('Comando de instalação gerado');
    } catch (err) {
      console.error('[InstallBlock] Erro ao gerar token:', err);
      toast.error(err instanceof Error ? err.message : TEXT.error);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!installCommand) return;
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    toast.success(TEXT.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-center gap-3 mb-1">
        <Terminal className="w-5 h-5 text-cyan-400" />
        <h3 className="font-semibold text-white">{TEXT.title}</h3>
      </div>
      <p className="text-sm text-slate-400 mb-5">{TEXT.subtitle}</p>

      <ol className="space-y-2 mb-5">
        {TEXT.steps.map((step, idx) => (
          <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
            <span className="flex-shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-bold text-cyan-400">
              {idx + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <Button onClick={handleGenerate} disabled={generating}>
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {TEXT.generating}
          </>
        ) : (
          <>
            <KeyRound className="w-4 h-4 mr-2" />
            {installCommand ? TEXT.regenerate : TEXT.generate}
          </>
        )}
      </Button>

      {installCommand && (
        <div className="mt-5 space-y-3">
          <label className="text-xs font-medium text-slate-400 block">{TEXT.commandLabel}</label>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-4 pr-12 text-xs text-emerald-300 font-mono whitespace-pre-wrap break-all">
              {installCommand}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              title="Copiar comando"
              className="absolute right-2 top-2 rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-400">
            <Clock className="w-4 h-4 flex-shrink-0" />
            {TEXT.expiresPrefix} {expiresIn} {TEXT.expiresSuffix}
          </div>
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-px" />
            {TEXT.oneTimeNote}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstallBlock;
