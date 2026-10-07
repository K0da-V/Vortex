import React, { useState } from 'react';
import { Bot, ShieldAlert, Sparkles, Clock, Terminal, Check, X } from 'lucide-react';
import { ServerItem } from '../types';
import { inspectMessageWithSentinelBot } from '../lib/bots';
import sentinelAvatar from '../assets/images/avatar_sentinel_bot_1791381269670.jpg';

interface BotCenterModalProps {
  server: ServerItem;
  isOwner: boolean;
  onUpdateBotConfig: (updates: {
    botAutoMod: boolean;
    botWelcome: boolean;
    botAntiRaid: boolean;
    botSlowmodeSeconds: number;
  }) => Promise<void>;
  onClose: () => void;
}

export const BotCenterModal: React.FC<BotCenterModalProps> = ({
  server,
  isOwner,
  onUpdateBotConfig,
  onClose,
}) => {
  const [autoMod, setAutoMod] = useState(server.botAutoMod);
  const [welcome, setWelcome] = useState(server.botWelcome);
  const [antiRaid, setAntiRaid] = useState(server.botAntiRaid);
  const [slowmode, setSlowmode] = useState(server.botSlowmodeSeconds);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Live bot sandbox test
  const [sandboxText, setSandboxText] = useState(
    'Confira este link suspeito: free-nitro airdrop-crypto @everyone @here'
  );

  const inspection = inspectMessageWithSentinelBot(sandboxText, autoMod, antiRaid);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    setSaving(true);
    try {
      await onUpdateBotConfig({
        botAutoMod: autoMod,
        botWelcome: welcome,
        botAntiRaid: antiRaid,
        botSlowmodeSeconds: slowmode,
      });
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#131B2E] border border-slate-800 rounded-lg max-w-3xl w-full p-6 space-y-6 my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3.5">
            <img
              src={sentinelAvatar}
              alt="Sentinel Bot"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg object-cover border border-emerald-500/40"
            />
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Central de Bots & Automação — {server.name}
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie moderação preditiva, proteção Anti-Raid, boas-vindas e comandos de barra
                em tempo real.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded border border-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Bot Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Module 1: Sentinel AutoMod */}
            <div className="p-4 bg-[#0B0F17] border border-slate-800/90 rounded-lg space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Bot className="w-4 h-4" />
                    Sentinel AutoMod
                  </span>
                  <input
                    type="checkbox"
                    checked={autoMod}
                    disabled={!isOwner}
                    onChange={(e) => setAutoMod(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Intercepta e higieniza links de phishing, scams de cripto, malware e flood de
                  caracteres antes da persistência.
                </p>
              </div>
              <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                Status: {autoMod ? 'Ativo no Servidor' : 'Desativado'}
              </div>
            </div>

            {/* Module 2: AuditGuard Anti-Raid */}
            <div className="p-4 bg-[#0B0F17] border border-slate-800/90 rounded-lg space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    AuditGuard Anti-Raid
                  </span>
                  <input
                    type="checkbox"
                    checked={antiRaid}
                    disabled={!isOwner}
                    onChange={(e) => setAntiRaid(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bloqueia disparos em massa de menções (@) e protege canais contra ataques
                  coordenados.
                </p>
              </div>
              <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                Status: {antiRaid ? 'Proteção Máxima' : 'Desativado'}
              </div>
            </div>

            {/* Module 3: Welcome & Auto-Role Bot */}
            <div className="p-4 bg-[#0B0F17] border border-slate-800/90 rounded-lg space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    Welcome & Auto-Role
                  </span>
                  <input
                    type="checkbox"
                    checked={welcome}
                    disabled={!isOwner}
                    onChange={(e) => setWelcome(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Recepciona novos membros com instruções de verificação de chaves E2EE e atribui
                  cargo verificado.
                </p>
              </div>
              <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                Status: {welcome ? 'Recepção Automática' : 'Desativado'}
              </div>
            </div>
          </div>

          {/* Slowmode Configuration */}
          <div className="p-4 bg-[#0B0F17] border border-slate-800/90 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Intervalo de Modo Lento (Slowmode) Controlado por Bot
              </div>
              <p className="text-xs text-slate-400">
                Define o tempo mínimo em segundos entre mensagens nos canais de texto.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[0, 5, 15, 30, 60].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={!isOwner}
                  onClick={() => setSlowmode(sec)}
                  className={`px-2.5 py-1.5 rounded text-xs font-mono tabular-nums transition-colors cursor-pointer ${
                    slowmode === sec
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-[#131B2E] text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {sec === 0 ? 'Off' : `${sec}s`}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Moderation Sandbox */}
          <div className="p-4 bg-[#0B0F17] border border-slate-800/90 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                Simulador de Inspeção do Sentinel AutoMod em Tempo Real
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Teste o filtro antes de salvar
              </span>
            </div>

            <input
              type="text"
              value={sandboxText}
              onChange={(e) => setSandboxText(e.target.value)}
              placeholder="Digite uma frase para testar o filtro do bot..."
              className="w-full px-3 py-2 bg-[#131B2E] border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-indigo-500"
            />

            <div className="p-3 bg-[#131B2E] border border-slate-800/80 rounded text-xs space-y-1 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Resultado da Triagem:</span>
                <span className={inspection.flagged ? 'text-amber-400' : 'text-emerald-400'}>
                  {inspection.flagged
                    ? `INTERCEPTADO (${inspection.reason})`
                    : 'APROVADO SEM RESTRIÇÕES'}
                </span>
              </div>
              <div className="text-slate-300 truncate">
                Saída Higienizada: {inspection.sanitizedText}
              </div>
            </div>
          </div>

          {/* Slash Commands Quick Reference */}
          <div className="p-4 bg-[#0B0F17] border border-slate-800/90 rounded-lg space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              Comandos de Barra Disponíveis no Chat
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-400">
              <div>
                <span className="text-indigo-400">/help</span> — Lista comandos do Sentinel Bot
              </div>
              <div>
                <span className="text-indigo-400">/audit</span> — Relatório de segurança E2EE & 2FA
              </div>
              <div>
                <span className="text-indigo-400">/lock</span> &{' '}
                <span className="text-indigo-400">/unlock</span> — Tranca/destranca canal atual
              </div>
              <div>
                <span className="text-indigo-400">/slowmode 10</span> — Ajusta modo lento via chat
              </div>
              <div>
                <span className="text-indigo-400">/e2ee-verify</span> — Inspeciona chave AES-256-GCM
              </div>
              <div>
                <span className="text-indigo-400">/warn @user</span> — Emite advertência automatizada
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-400">
              {!isOwner && 'Apenas o proprietário do servidor pode alterar políticas de bots.'}
              {savedToast && (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <Check className="w-3.5 h-3.5" /> Políticas de automação atualizadas!
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white border border-slate-800 rounded-md cursor-pointer"
              >
                Fechar
              </button>
              {isOwner && (
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md cursor-pointer"
                >
                  {saving ? 'Salvando...' : 'Salvar Políticas dos Bots'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
