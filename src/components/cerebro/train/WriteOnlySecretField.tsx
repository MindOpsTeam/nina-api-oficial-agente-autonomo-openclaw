import React, { useState } from 'react';
import { Loader2, Save, ShieldCheck, ShieldAlert, PlugZap, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../../Button';
import type { KeyValidation } from '@/services/cerebroService';

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

const TEXT = {
  test: 'Testar conexão',
  testing: 'Validando…',
  ok: 'Conexão OK',
  saveFirst: 'Salve a chave antes de testar a conexão.',
  noWrite: 'O token não tem permissão de escrita no repositório.',
  failed: 'Falha na validação.',
} as const;

interface WriteOnlySecretFieldProps {
  label: string;
  placeholder: string;
  configured: boolean;
  /** Faz o save (chama a edge fn). Retorna true em sucesso. */
  onSave: (value: string) => Promise<boolean>;
  /** Valida a conexão real (lê a chave do Vault). Habilita o botão "Testar conexão". */
  onTest?: () => Promise<KeyValidation>;
  /** Quando true, sucesso exige can_write=true (ex.: PAT do GitHub precisa escrever). */
  requireCanWrite?: boolean;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  instruction?: React.ReactNode;
}

/**
 * Campo de segredo WRITE-ONLY: o valor nunca é lido de volta. Só envia para a edge fn,
 * exibe status configurado/não-configurado e (opcional) valida a conexão real.
 */
const WriteOnlySecretField: React.FC<WriteOnlySecretFieldProps> = ({
  label,
  placeholder,
  configured,
  onSave,
  onTest,
  requireCanWrite = false,
  icon,
  hint,
  instruction,
}) => {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<KeyValidation | null>(null);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    const ok = await onSave(value.trim());
    setSaving(false);
    if (ok) {
      setValue('');
      setResult(null); // chave nova: limpa validação antiga
    }
  };

  const handleTest = async () => {
    if (!onTest) return;
    setTesting(true);
    setResult(null);
    const r = await onTest();
    setTesting(false);
    setResult(r);
  };

  const passed = result?.ok && (!requireCanWrite || result.canWrite);
  const resultMessage = result
    ? passed
      ? TEXT.ok
      : result.ok && requireCanWrite && !result.canWrite
      ? TEXT.noWrite
      : result.error || TEXT.failed
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-400">
          {icon}
          {label}
        </label>
        <span
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            configured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
          }`}
        >
          {configured ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
          {configured ? 'Configurado' : 'Não configurado'}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={inputClass}
        />
        <Button onClick={handleSave} disabled={saving || !value.trim()} className="flex-shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </Button>
      </div>
      {hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
      {instruction && <div className="text-xs text-slate-500 mt-1.5">{instruction}</div>}

      {onTest && (
        <div className="mt-2.5 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !configured}
            title={!configured ? TEXT.saveFirst : undefined}
          >
            {testing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                {TEXT.testing}
              </>
            ) : (
              <>
                <PlugZap className="w-3.5 h-3.5 mr-1.5" />
                {TEXT.test}
              </>
            )}
          </Button>

          {!configured && !testing && !result && (
            <span className="text-xs text-slate-500">{TEXT.saveFirst}</span>
          )}

          {result && !testing && (
            <span
              className={`flex items-center gap-1.5 text-xs font-medium ${passed ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {resultMessage}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default WriteOnlySecretField;
