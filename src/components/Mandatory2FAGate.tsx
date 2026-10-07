import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  RefreshCw,
  LogOut,
  Eye,
  EyeOff,
  Users,
} from 'lucide-react';
import { computeTotpCode, verifyTotpCode } from '../lib/crypto';
import { UserPrivate, UserPublic } from '../types';

interface Mandatory2FAGateProps {
  userPublic: UserPublic;
  userPrivate: UserPrivate;
  onVerified: () => Promise<void>;
  onSignOut: () => void;
  onSwitchAccount: () => void;
}

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '•••@•••';
  const name = parts[0];
  const domain = parts[1];
  const visible = name.slice(0, 2);
  return `${visible}••••@${domain}`;
}

export const Mandatory2FAGate: React.FC<Mandatory2FAGateProps> = ({
  userPublic,
  userPrivate,
  onVerified,
  onSignOut,
  onSwitchAccount,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [showSetupSecret, setShowSetupSecret] = useState(false);
  const [liveCodePreview, setLiveCodePreview] = useState('••••••');

  useEffect(() => {
    let mounted = true;
    const updateTimer = async () => {
      const sec = 30 - (Math.floor(Date.now() / 1000) % 30);
      if (mounted) {
        setSecondsRemaining(sec);
        if (showSetupSecret) {
          const current = await computeTotpCode(userPrivate.totpSecret, 0);
          if (mounted) setLiveCodePreview(current);
        } else {
          setLiveCodePreview('••••••');
        }
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [userPrivate.totpSecret, showSetupSecret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      const isValid = await verifyTotpCode(userPrivate.totpSecret, code);
      if (!isValid) {
        setError('Código de 6 dígitos inválido ou expirado. Tente novamente.');
        setVerifying(false);
        return;
      }
      await onVerified();
    } catch {
      setError('Falha ao validar código 2FA. Tente novamente.');
      setVerifying(false);
    }
  };

  const handleAutoFillAuthenticator = async () => {
    const current = await computeTotpCode(userPrivate.totpSecret, 0);
    setCode(current);
    setError('');
  };

  return (
    <div className="min-h-screen w-full bg-[#080B11] text-[#F1F5F9] flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar Contract */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between pb-4 border-b border-slate-800/80">
        <span className="font-display text-lg font-bold tracking-tight text-white">
          Vortex
        </span>
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
          <span>Verificação em Duas Etapas Obrigatória</span>
          <span aria-hidden="true">·</span>
          <span>Sessão Não Persistente</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSwitchAccount}
            className="px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg hover:bg-indigo-600/20 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            Usar Outra Conta Google
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white border border-slate-800 rounded-lg hover:bg-slate-800/60 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </header>

      {/* Centered Clean 2FA Verification Card (Sensitive Data Hidden by Default) */}
      <main className="w-full max-w-md mx-auto my-auto py-8">
        <div className="bg-[#0E1422] border border-slate-800/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="font-display text-xl font-bold text-white">
              Confirmação de Segurança (2FA)
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Olá, <span className="text-slate-200 font-medium">{userPublic.displayName}</span> (
              {maskEmail(userPrivate.email)}). Digite o código de 6 dígitos para acessar a
              comunidade.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="totp-input"
                className="block text-xs font-medium text-slate-300 text-center"
              >
                Código de Verificação de 6 Dígitos
              </label>
              <input
                id="totp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 bg-[#080B11] border border-slate-700 rounded-xl font-mono text-xl tracking-[0.35em] text-center text-white focus:outline-none focus:border-indigo-500 tabular-nums"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {verifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Confirmar e Entrar
                </>
              )}
            </button>
          </form>

          {/* Masked Helper Section (Secrets Hidden by Default) */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleAutoFillAuthenticator}
                className="flex-1 py-2 px-3 bg-[#080B11] hover:bg-slate-800/70 text-indigo-300 border border-slate-800 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Gerar Código Rápido
              </button>
              <button
                type="button"
                onClick={() => setShowSetupSecret(!showSetupSecret)}
                className="py-2 px-3 bg-[#080B11] hover:bg-slate-800/70 text-slate-400 hover:text-white border border-slate-800 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Mostrar ou ocultar detalhes do autenticador"
              >
                {showSetupSecret ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" /> Ocultar
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" /> Configurar App
                  </>
                )}
              </button>
            </div>

            {showSetupSecret && (
              <div className="p-3.5 bg-[#080B11] border border-slate-800/90 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Código atual do autenticador:</span>
                  <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                    {liveCodePreview} ({secondsRemaining}s)
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Por segurança, sua chave secreta e e-mail completo permanecem ocultos para
                  terceiros.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full max-w-5xl mx-auto pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
        <span>Vortex Comunidades</span>
        <span>Login não fica salvo no dispositivo</span>
      </footer>
    </div>
  );
};
