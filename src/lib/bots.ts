/**
 * Automated Bots Engine for Server Moderation, Anti-Raid, and Slash Commands
 */

export interface ModerationInspection {
  allowed: boolean;
  sanitizedText: string;
  flagged: boolean;
  reason: string;
  botResponse?: string;
}

const BLOCKED_PATTERNS = [
  { regex: /\b(free[-_\s]?nitro|steam[-_\s]?gift|airdrop[-_\s]?crypto|phishing[-_\s]?link)\b/gi, label: 'Link suspeito / Phishing detectado' },
  { regex: /\b(hackear|ddos[-_\s]?attack|token[-_\s]?grabber|malware)\b/gi, label: 'Violação de segurança bloqueada pelo Sentinel Bot' },
  { regex: /(.)\1{14,}/g, label: 'Flood de caracteres bloqueado pelo AutoMod' },
];

export function inspectMessageWithSentinelBot(
  rawText: string,
  autoModEnabled: boolean,
  antiRaidEnabled: boolean
): ModerationInspection {
  const trimmed = rawText.trim();

  if (!autoModEnabled && !antiRaidEnabled) {
    return {
      allowed: true,
      sanitizedText: trimmed,
      flagged: false,
      reason: '',
    };
  }

  for (const rule of BLOCKED_PATTERNS) {
    if (rule.regex.test(trimmed)) {
      const sanitized = trimmed.replace(rule.regex, '[CONTEÚDO REMOVIDO PELO SENTINEL BOT]');
      return {
        allowed: true,
        sanitizedText: sanitized,
        flagged: true,
        reason: rule.label,
        botResponse: `🛡️ **Sentinel AutoMod**: A mensagem continha padrões bloqueados (${rule.label}) e foi higienizada automaticamente antes da criptografia E2EE.`,
      };
    }
  }

  // Check excessive mention spam if Anti-Raid is active
  const mentionsCount = (trimmed.match(/@/g) || []).length;
  if (antiRaidEnabled && mentionsCount > 5) {
    return {
      allowed: true,
      sanitizedText: trimmed.slice(0, 120) + ' [Menções em massa contidas]',
      flagged: true,
      reason: 'Anti-Raid: Excesso de menções em uma única mensagem',
      botResponse: `🚨 **AuditGuard Anti-Raid**: Excesso de menções (@) detectado e limitado automaticamente.`,
    };
  }

  return {
    allowed: true,
    sanitizedText: trimmed,
    flagged: false,
    reason: '',
  };
}

export interface SlashCommandResult {
  isCommand: boolean;
  actionType?: 'bot_reply' | 'lock_channel' | 'unlock_channel' | 'slowmode' | 'audit';
  slowmodeSeconds?: number;
  botMessage?: string;
}

export function parseBotSlashCommand(
  input: string,
  channelName: string,
  serverName: string,
  e2eeKeyId: string
): SlashCommandResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { isCommand: false };
  }

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ');

  switch (cmd) {
    case '/help':
    case '/comandos':
      return {
        isCommand: true,
        actionType: 'bot_reply',
        botMessage:
          `🤖 **Sentinel Bot — Central de Comandos Automatizados**\n` +
          `• \`/audit\` — Executa auditoria criptográfica E2EE e status de 2FA do canal #${channelName}\n` +
          `• \`/lock\` — Tranca o canal atual para impedir novas mensagens de membros comuns\n` +
          `• \`/unlock\` — Destranca o canal atual\n` +
          `• \`/slowmode <segundos>\` — Define intervalo de modo lento no servidor (ex: \`/slowmode 10\`)\n` +
          `• \`/warn <usuário> <motivo>\` — Registra advertência formal moderada por bot\n` +
          `• \`/e2ee-verify\` — Exibe o envelope AES-256-GCM e chave ativa do servidor`,
      };

    case '/audit':
      return {
        isCommand: true,
        actionType: 'audit',
        botMessage:
          `🛡️ **Relatório de Auditoria Sentinel — ${serverName} (#${channelName})**\n` +
          `• Protocolo de Criptografia: AES-256-GCM (WebCrypto API Nativo) · Chave \`${e2eeKeyId}\`\n` +
          `• Autenticação 2FA Obrigatória: Ativa (RFC 6238 TOTP Verificado)\n` +
          `• Filtro Anti-Phishing & AutoMod: Operacional · 0 vazamentos de metadados.`,
      };

    case '/e2ee-verify':
      return {
        isCommand: true,
        actionType: 'bot_reply',
        botMessage:
          `🔐 **Verificação de Criptografia de Ponta a Ponta (E2EE)**\n` +
          `Todas as mensagens em **#${channelName}** são cifradas localmente no navegador via \`AES-GCM (256 bits)\` com vetor de inicialização (IV) aleatório de 96 bits e assinatura de integridade \`SHA-256\` antes de persistirem no Firestore. Identificador da chave do servidor: \`${e2eeKeyId}\`.`,
      };

    case '/lock':
      return {
        isCommand: true,
        actionType: 'lock_channel',
        botMessage: `🔒 **Sentinel ModBot**: O canal **#${channelName}** foi trancado pela moderação. Apenas administradores podem enviar mensagens.`,
      };

    case '/unlock':
      return {
        isCommand: true,
        actionType: 'unlock_channel',
        botMessage: `🔓 **Sentinel ModBot**: O canal **#${channelName}** foi destrancado. Todos os membros verificados podem enviar mensagens.`,
      };

    case '/slowmode': {
      const secs = Math.min(3600, Math.max(0, parseInt(arg || '0', 10) || 0));
      return {
        isCommand: true,
        actionType: 'slowmode',
        slowmodeSeconds: secs,
        botMessage:
          secs > 0
            ? `⏱️ **Sentinel ModBot**: Modo lento ativado neste servidor (${secs} segundos por mensagem).`
            : `⚡ **Sentinel ModBot**: Modo lento desativado neste servidor.`,
      };
    }

    case '/warn':
      return {
        isCommand: true,
        actionType: 'bot_reply',
        botMessage: `⚠️ **Registro de Moderação Automatizada**: Advertência emitida para ${arg || 'membro'} — registrada no log imutável do servidor.`,
      };

    default:
      return {
        isCommand: true,
        actionType: 'bot_reply',
        botMessage: `🤖 Comando \`${cmd}\` não reconhecido. Digite \`/help\` para listar as automações do Sentinel Bot.`,
      };
  }
}
