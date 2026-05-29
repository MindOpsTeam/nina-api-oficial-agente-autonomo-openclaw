import React, { useState } from 'react';
import { Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Switch } from '../../ui/switch';
import { Button } from '../../Button';
import type { CustomSkill } from '@/hooks/useCustomKnowledgeSkills';

const TEXT = {
  confirm: 'Excluir esta habilidade?',
  cancel: 'Cancelar',
  delete: 'Excluir',
} as const;

interface CustomSkillItemProps {
  skill: CustomSkill;
  onEdit: (skill: CustomSkill) => void;
  onToggle: (id: string, enabled: boolean) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const CustomSkillItem: React.FC<CustomSkillItemProps> = ({ skill, onEdit, onToggle, onDelete }) => {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setBusy(true);
    await onToggle(skill.id, checked);
    setBusy(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    await onDelete(skill.id);
    setBusy(false);
    setConfirming(false);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100 truncate">{skill.name}</span>
            <code className="text-[11px] text-slate-500">custom-{skill.slug}</code>
          </div>
          {skill.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{skill.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch checked={skill.enabled} onCheckedChange={handleToggle} disabled={busy} />
          <button
            onClick={() => onEdit(skill)}
            className="p-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-cyan-400"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="p-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-red-400"
            title="Excluir"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {confirming && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <span className="flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {TEXT.confirm}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
              {TEXT.cancel}
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={busy}>
              {TEXT.delete}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSkillItem;
