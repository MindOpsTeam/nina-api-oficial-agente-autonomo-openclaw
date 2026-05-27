import React, { useState } from 'react';
import { Loader2, Save, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '../../Button';

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

interface WriteOnlySecretFieldProps {
  label: string;
  placeholder: string;
  configured: boolean;
  /** Faz o save (chama a edge fn). Retorna true em sucesso. */
  onSave: (value: string) => Promise<boolean>;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  instruction?: React.ReactNode;
}

/**
 * Campo de segredo WRITE-ONLY: o valor nunca é lido de volta. Só envia para a edge fn
 * e exibe um status configurado/não-configurado (booleano), nunca o valor.
 */
const WriteOnlySecretField: React.FC<WriteOnlySecretFieldProps> = ({
  label,
  placeholder,
  configured,
  onSave,
  icon,
  hint,
  instruction,
}) => {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    const ok = await onSave(value.trim());
    setSaving(false);
    if (ok) setValue('');
  };

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
    </div>
  );
};

export default WriteOnlySecretField;
