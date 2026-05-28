import React from 'react';
import SecretsTab from './train/SecretsTab';
import RepoConfig from './train/RepoConfig';

/**
 * Passo 1 da jornada: todas as chaves/credenciais num único card —
 * status dos secrets + chave Anthropic (SecretsTab) e repositório + PAT (RepoConfig).
 */
const KeysStep: React.FC = () => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
    <SecretsTab />
    <div className="border-t border-slate-800" />
    <RepoConfig />
  </div>
);

export default KeysStep;
