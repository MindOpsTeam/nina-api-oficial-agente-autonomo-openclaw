import React, { useState } from 'react';
import { MessageSquareText, Info, Send } from 'lucide-react';
import { Button } from '../Button';
import { toast } from 'sonner';
import { StatusBadge } from './StatusBadge';
import type { InstanceStatus } from '@/hooks/useInstance';

const TEXT = {
  title: 'Testar o cérebro',
  subtitle: 'Valide o comportamento da Nina com uma mensagem de exemplo.',
  inputLabel: 'Mensagem de teste',
  placeholder: 'Ex: Olá, quais serviços vocês oferecem?',
  cta: 'Como testar',
  // Ainda não há endpoint síncrono de teste — orientamos o teste pelos canais reais.
  noEndpointTitle: 'Teste pelo WhatsApp ou pelo simulador',
  noEndpointBody:
    'Ainda não há um endpoint síncrono de teste nesta tela. Envie a mensagem acima pelo WhatsApp conectado (ou pelo simulador de áudio em Configurações → APIs) e acompanhe a resposta da Nina por lá.',
  heartbeatLabel: 'Status atual da instância',
  toastTip: 'Copie a mensagem e envie pelo WhatsApp para validar a resposta da Nina.',
} as const;

interface TestBlockProps {
  status: InstanceStatus;
}

const TestBlock: React.FC<TestBlockProps> = ({ status }) => {
  const [message, setMessage] = useState('');

  const handleGuide = () => {
    toast.info(TEXT.noEndpointTitle, { description: TEXT.toastTip });
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
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
      />

      <div className="mt-4 flex items-start gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
        <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-px" />
        <div>
          <p className="text-sm font-medium text-cyan-300">{TEXT.noEndpointTitle}</p>
          <p className="text-xs text-slate-400 mt-1">{TEXT.noEndpointBody}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{TEXT.heartbeatLabel}:</span>
          <StatusBadge status={status} />
        </div>
        <Button variant="outline" size="sm" onClick={handleGuide}>
          <Send className="w-4 h-4 mr-2" />
          {TEXT.cta}
        </Button>
      </div>
    </div>
  );
};

export default TestBlock;
