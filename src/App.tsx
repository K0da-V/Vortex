import React, { useState, useEffect, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Hash,
  Volume2,
  Video,
  Plus,
  Settings,
  ShieldCheck,
  Lock,
  Bot,
  Users,
  Pin,
  Trash2,
  Reply,
  Search,
  Send,
  Mic,
  MicOff,
  PhoneOff,
  Copy,
  Check,
  KeyRound,
  LogOut,
  MonitorUp,
  Eye,
  X,
  Menu,
  Camera,
  ImagePlus,
  MessageSquare,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  ChannelItem,
  ChannelType,
  MessageItem,
  RoomParticipant,
  ServerItem,
  UserPrivate,
  UserPublic,
} from './types';
import {
  decryptE2EE,
  encryptE2EE,
  generateIdentityKeyMetadata,
  generateTotpSecret,
  sha256Hex,
} from './lib/crypto';
import {
  inspectMessageWithSentinelBot,
  parseBotSlashCommand,
} from './lib/bots';
import { Mandatory2FAGate } from './components/Mandatory2FAGate';
import { VoiceVideoStage } from './components/VoiceVideoStage';
import { FriendsManager } from './components/FriendsManager';
import { BotCenterModal } from './components/BotCenterModal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { UserProfileCardModal } from './components/UserProfileCardModal';

import leadEngineerAvatar from './assets/images/avatar_lead_engineer_1791381254383.jpg';
import sentinelAvatar from './assets/images/avatar_sentinel_bot_1791381269670.jpg';
import communityBanner from './assets/images/banner_community_hub_1791381283275.jpg';
import obsidianCover from './assets/images/cover_obsidian_waves_1791383947099.jpg';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userPublic, setUserPublic] = useState<UserPublic | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivate | null>(null);
  const [session2FAVerified, setSession2FAVerified] = useState(false);
  const [authError, setAuthError] = useState('');

  // Workspace Navigation State
  const [viewMode, setViewMode] = useState<'friends' | 'server'>('server');
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserPublic[]>([]);

  // Responsive Mobile/Tablet Drawers
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showMemberSidebar, setShowMemberSidebar] = useState(true);
  const [mobileMembersDrawerOpen, setMobileMembersDrawerOpen] = useState(false);

  // Chat Input & Filtering State
  const [chatInput, setChatInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<MessageItem | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [slowmodeCooldown, setSlowmodeCooldown] = useState(0);
  const [inspectedMessage, setInspectedMessage] = useState<MessageItem | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Modals State
  const [showBotModal, setShowBotModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileCardUser, setSelectedProfileCardUser] = useState<UserPublic | null>(
    null
  );
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);

  // New Server / Channel Form State
  const [newServerName, setNewServerName] = useState('');
  const [newServerDesc, setNewServerDesc] = useState('');
  const [inviteJoinInput, setInviteJoinInput] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('Canais de Texto');
  const [newChannelType, setNewChannelType] = useState<ChannelType>('text');
  const [newChannelTopic, setNewChannelTopic] = useState('');

  // Real-Time Voice / Video / Screen Share State (WebSocket + WebRTC)
  const wsRef = useRef<WebSocket | null>(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<ChannelItem | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<RoomParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [typingIndicators, setTypingIndicators] = useState<
    { uid: string; displayName: string; channelId: string }[]
  >([]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Firebase Auth Listener & User Provisioning
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (usr) => {
      setFirebaseUser(usr);
      if (!usr) {
        setUserPublic(null);
        setUserPrivate(null);
        setSession2FAVerified(false);
        setAuthReady(true);
        return;
      }

      try {
        const pubRef = doc(db, 'users', usr.uid);
        const privRef = doc(db, 'users', usr.uid, 'private', 'security');
        const pubSnap = await getDoc(pubRef);

        if (!pubSnap.exists()) {
          const identity = await generateIdentityKeyMetadata(usr.uid);
          const cleanName = (usr.displayName || 'Engenheiro Vortex').slice(0, 60);
          const handle =
            cleanName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '')
              .slice(0, 24) || `dev_${usr.uid.slice(0, 6)}`;

          const newPub = {
            uid: usr.uid,
            displayName: cleanName,
            username: handle,
            avatarUrl: usr.photoURL || leadEngineerAvatar,
            bannerColor: '#4F46E5',
            bannerUrl: obsidianCover,
            bio: 'Membro verificado com criptografia de ponta a ponta (AES-256-GCM) e 2FA TOTP.',
            customStatus: 'Conectado via E2EE Zero-Trust',
            presence: 'online',
            e2eePublicKey: identity.publicKey,
            e2eeFingerprint: identity.fingerprint,
            twoFactorEnabled: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(pubRef, newPub);
        }

        const privSnap = await getDoc(privRef);
        if (!privSnap.exists()) {
          const secret = generateTotpSecret(16);
          const recHash = await sha256Hex(`recovery:${usr.uid}:${secret}`);
          await setDoc(privRef, {
            uid: usr.uid,
            email: (usr.email || 'verificado@vortex.app').slice(0, 150),
            totpSecret: secret,
            twoFactorVerified: false,
            recoveryHash: `REC-${recHash.slice(0, 24).toUpperCase()}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const freshPub = await getDoc(pubRef);
        const freshPriv = await getDoc(privRef);
        if (freshPub.exists()) setUserPublic(freshPub.data() as UserPublic);
        if (freshPriv.exists()) setUserPrivate(freshPriv.data() as UserPrivate);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${usr.uid}`);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // 2. Connect to Real-Time WebSocket Server (/ws) once 2FA is verified
  useEffect(() => {
    if (!session2FAVerified || !userPublic) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connection:init' || data.type === 'room:participants') {
          setRoomParticipants(data.allParticipants || []);
        } else if (data.type === 'chat:typing-update') {
          setTypingIndicators(data.typing || []);
        }
      } catch {
        // Ignore malformed packets
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [session2FAVerified, userPublic?.uid]);

  // 3. Load Servers & Seed Default Community Server if none exist
  useEffect(() => {
    if (!session2FAVerified || !userPublic) return;

    const qServers = query(collection(db, 'servers'), where('isPublic', '==', true));

    const unsub = onSnapshot(
      qServers,
      async (snap) => {
        const list = snap.docs.map((d) => d.data() as ServerItem);
        if (list.length === 0) {
          await seedInitialCommunityServer(userPublic);
          return;
        }
        setServers(list);
        if (!selectedServerId || !list.some((s) => s.id === selectedServerId)) {
          setSelectedServerId(list[0].id);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'servers')
    );

    return () => unsub();
  }, [session2FAVerified, userPublic?.uid, selectedServerId]);

  // 4. Load Community Users Directory
  useEffect(() => {
    if (!session2FAVerified || !userPublic) return;

    const qUsers = query(
      collection(db, 'users'),
      where('presence', 'in', ['online', 'idle', 'dnd', 'offline'])
    );
    const unsub = onSnapshot(
      qUsers,
      (snap) => {
        const users = snap.docs.map((d) => d.data() as UserPublic);
        setAllUsers(users);
        const me = users.find((u) => u.uid === userPublic.uid);
        if (me) setUserPublic(me);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    return () => unsub();
  }, [session2FAVerified, userPublic?.uid]);

  // 5. Load Channels for Selected Server
  useEffect(() => {
    if (!session2FAVerified || !selectedServerId) return;

    const qChannels = query(
      collection(db, 'servers', selectedServerId, 'channels'),
      where('serverId', '==', selectedServerId)
    );

    const unsub = onSnapshot(
      qChannels,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ChannelItem);
        list.sort((a, b) => a.name.localeCompare(b.name));
        setChannels(list);
        if (
          list.length > 0 &&
          (!selectedChannelId || !list.some((c) => c.id === selectedChannelId))
        ) {
          const defaultText = list.find((c) => c.type === 'text') || list[0];
          setSelectedChannelId(defaultText.id);
        }
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `servers/${selectedServerId}/channels`
        )
    );

    return () => unsub();
  }, [session2FAVerified, selectedServerId]);

  // 6. Load & Decrypt E2EE Messages for Selected Server & Channel
  useEffect(() => {
    if (!session2FAVerified || !selectedServerId || !selectedChannelId) return;

    const currentServer = servers.find((s) => s.id === selectedServerId);
    const e2eeKeyId = currentServer?.e2eeKeyId || `KEY-${selectedServerId}`;

    const qMessages = query(
      collection(db, 'servers', selectedServerId, 'messages'),
      where('serverId', '==', selectedServerId)
    );

    const unsub = onSnapshot(
      qMessages,
      async (snap) => {
        const rawList = snap.docs
          .map((d) => d.data() as MessageItem)
          .filter((m) => m.channelId === selectedChannelId);

        rawList.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return ta - tb;
        });

        const decrypted = await Promise.all(
          rawList.map(async (msg) => ({
            ...msg,
            decryptedText: await decryptE2EE(msg.ciphertext, msg.iv, e2eeKeyId),
          }))
        );

        setMessages(decrypted);
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 60);
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `servers/${selectedServerId}/messages`
        )
    );

    return () => unsub();
  }, [session2FAVerified, selectedServerId, selectedChannelId, servers]);

  // Slowmode countdown timer
  useEffect(() => {
    if (slowmodeCooldown <= 0) return;
    const t = setInterval(() => {
      setSlowmodeCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [slowmodeCooldown]);

  // Seed default community server with channels and welcome messages
  async function seedInitialCommunityServer(owner: UserPublic) {
    const serverId = `srv_vortex_core_${owner.uid.slice(0, 8)}`.replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );
    const e2eeKeyId = `AES256-VTX-${owner.uid.slice(0, 6).toUpperCase()}`;

    try {
      const existingCheck = await getDoc(doc(db, 'servers', serverId));
      if (existingCheck.exists()) return;

      await setDoc(doc(db, 'servers', serverId), {
        id: serverId,
        name: 'Vortex Core · Arquitetura & Dev',
        description:
          'Comunidade oficial de engenharia de software, segurança de ponta a ponta (E2EE) e colaboração em tempo real.',
        iconText: 'VX',
        bannerUrl: communityBanner,
        ownerId: owner.uid,
        inviteCode: 'VORTEX2026',
        isPublic: true,
        e2eeKeyId,
        botAutoMod: true,
        botWelcome: true,
        botAntiRaid: true,
        botSlowmodeSeconds: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const initialChannels: {
        id: string;
        name: string;
        category: string;
        type: ChannelType;
        topic: string;
      }[] = [
        {
          id: `ch_geral_${serverId.slice(-6)}`,
          name: 'geral',
          category: 'Canais de Texto',
          type: 'text',
          topic: 'Discussões gerais da comunidade com criptografia de ponta a ponta AES-256-GCM.',
        },
        {
          id: `ch_seguranca_${serverId.slice(-6)}`,
          name: 'auditoria-e2ee',
          category: 'Canais de Texto',
          type: 'text',
          topic: 'Verificação de chaves públicas X25519, envelopes AES-GCM e logs do Sentinel Bot.',
        },
        {
          id: `ch_voz_${serverId.slice(-6)}`,
          name: 'Lounge de Voz E2EE',
          category: 'Canais de Voz & Vídeo',
          type: 'voice',
          topic: 'Canal de voz em tempo real com proteção DTLS-SRTP.',
        },
        {
          id: `ch_video_${serverId.slice(-6)}`,
          name: 'War Room · Vídeo & Tela',
          category: 'Canais de Voz & Vídeo',
          type: 'video',
          topic: 'Chamadas de vídeo HD e compartilhamento de tela integrado em tempo real.',
        },
      ];

      for (const ch of initialChannels) {
        await setDoc(doc(db, 'servers', serverId, 'channels', ch.id), {
          id: ch.id,
          serverId,
          name: ch.name,
          category: ch.category,
          type: ch.type,
          topic: ch.topic,
          isLocked: false,
          ownerId: owner.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const welcomeText =
        `🛡️ **Sentinel Bot — Bem-vindo ao Vortex Core!**\n` +
        `Este servidor opera com **Criptografia de Ponta a Ponta (AES-256-GCM)** e **Autenticação 2FA Obrigatória**.\n` +
        `• Digite \`/help\` para explorar os comandos automatizados de moderação.\n` +
        `• Clique em **Foto & Capa** no seu cartão de perfil para personalizar seu avatar e banner panorâmico.`;
      const env = await encryptE2EE(welcomeText, e2eeKeyId);
      const msgId = `msg_welcome_${Date.now()}`;

      await setDoc(doc(db, 'servers', serverId, 'messages', msgId), {
        id: msgId,
        serverId,
        channelId: initialChannels[0].id,
        authorId: owner.uid,
        authorName: 'Sentinel AutoMod Bot',
        authorAvatar: sentinelAvatar,
        authorRole: 'bot',
        ciphertext: env.ciphertext,
        iv: env.iv,
        signature: env.signature,
        isEncrypted: true,
        isPinned: true,
        isFlaggedByBot: false,
        botModerationNote: 'Mensagem automática de boas-vindas e verificação E2EE',
        replyToId: '',
        replyToAuthor: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSelectedServerId(serverId);
      setSelectedChannelId(initialChannels[0].id);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `servers/${serverId}`);
    }
  }

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir o login com o Google.'
      );
    }
  };

  const handleComplete2FA = async () => {
    if (!userPrivate || !userPublic) return;
    try {
      await updateDoc(doc(db, 'users', userPublic.uid, 'private', 'security'), {
        twoFactorVerified: true,
        updatedAt: serverTimestamp(),
      });
      setSession2FAVerified(true);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${userPublic.uid}/private/security`
      );
    }
  };

  const handleJoinVoiceOrVideoChannel = (channel: ChannelItem) => {
    if (!userPublic) return;
    setActiveVoiceChannel(channel);
    setSelectedChannelId(channel.id);
    setMobileNavOpen(false);
    const shouldEnableVideo = channel.type === 'video';
    setIsVideoOn(shouldEnableVideo);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:join',
          uid: userPublic.uid,
          displayName: userPublic.displayName,
          avatarUrl: userPublic.avatarUrl,
          roomId: channel.id,
          serverId: channel.serverId,
          isMuted,
          isDeafened,
          isVideoOn: shouldEnableVideo,
          isScreenSharing: false,
          e2eeFingerprint: userPublic.e2eeFingerprint,
        })
      );
    }
  };

  const handleLeaveVoiceChannel = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
    }
    setActiveVoiceChannel(null);
    setIsVideoOn(false);
    setIsScreenSharing(false);
    const firstText = channels.find((c) => c.type === 'text');
    if (firstText) setSelectedChannelId(firstText.id);
  };

  const syncVoiceMediaState = (nextState: {
    isMuted?: boolean;
    isDeafened?: boolean;
    isVideoOn?: boolean;
    isScreenSharing?: boolean;
  }) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:update-media',
          ...nextState,
        })
      );
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentServer = servers.find((s) => s.id === selectedServerId);
    const currentChannel = channels.find((c) => c.id === selectedChannelId);
    if (!userPublic || !currentServer || !currentChannel || !chatInput.trim()) return;

    if (slowmodeCooldown > 0 && currentServer.ownerId !== userPublic.uid) {
      return;
    }

    const rawInput = chatInput.trim();
    setChatInput('');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat:typing',
          uid: userPublic.uid,
          displayName: userPublic.displayName,
          channelId: currentChannel.id,
          isTyping: false,
        })
      );
    }

    const slash = parseBotSlashCommand(
      rawInput,
      currentChannel.name,
      currentServer.name,
      currentServer.e2eeKeyId
    );

    if (slash.isCommand) {
      try {
        if (
          slash.actionType === 'lock_channel' &&
          currentServer.ownerId === userPublic.uid
        ) {
          await updateDoc(
            doc(db, 'servers', currentServer.id, 'channels', currentChannel.id),
            {
              isLocked: true,
              updatedAt: serverTimestamp(),
            }
          );
        } else if (
          slash.actionType === 'unlock_channel' &&
          currentServer.ownerId === userPublic.uid
        ) {
          await updateDoc(
            doc(db, 'servers', currentServer.id, 'channels', currentChannel.id),
            {
              isLocked: false,
              updatedAt: serverTimestamp(),
            }
          );
        } else if (
          slash.actionType === 'slowmode' &&
          currentServer.ownerId === userPublic.uid &&
          typeof slash.slowmodeSeconds === 'number'
        ) {
          await updateDoc(doc(db, 'servers', currentServer.id), {
            botSlowmodeSeconds: slash.slowmodeSeconds,
            updatedAt: serverTimestamp(),
          });
        }

        if (slash.botMessage) {
          const botEnvelope = await encryptE2EE(
            slash.botMessage,
            currentServer.e2eeKeyId
          );
          const botMsgId = `msg_bot_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}`;
          await setDoc(
            doc(db, 'servers', currentServer.id, 'messages', botMsgId),
            {
              id: botMsgId,
              serverId: currentServer.id,
              channelId: currentChannel.id,
              authorId: userPublic.uid,
              authorName: 'Sentinel AutoMod Bot',
              authorAvatar: sentinelAvatar,
              authorRole: 'bot',
              ciphertext: botEnvelope.ciphertext,
              iv: botEnvelope.iv,
              signature: botEnvelope.signature,
              isEncrypted: true,
              isPinned: false,
              isFlaggedByBot: false,
              botModerationNote: `Resposta automática ao comando ${rawInput.split(' ')[0]}`,
              replyToId: '',
              replyToAuthor: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }
          );
        }
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `servers/${currentServer.id}/messages`
        );
      }
      return;
    }

    const inspection = inspectMessageWithSentinelBot(
      rawInput,
      currentServer.botAutoMod,
      currentServer.botAntiRaid
    );

    try {
      const envelope = await encryptE2EE(
        inspection.sanitizedText,
        currentServer.e2eeKeyId
      );
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await setDoc(doc(db, 'servers', currentServer.id, 'messages', msgId), {
        id: msgId,
        serverId: currentServer.id,
        channelId: currentChannel.id,
        authorId: userPublic.uid,
        authorName: userPublic.displayName.slice(0, 80),
        authorAvatar: userPublic.avatarUrl.slice(0, 145000),
        authorRole: currentServer.ownerId === userPublic.uid ? 'admin' : 'member',
        ciphertext: envelope.ciphertext,
        iv: envelope.iv,
        signature: envelope.signature,
        isEncrypted: true,
        isPinned: false,
        isFlaggedByBot: inspection.flagged,
        botModerationNote: inspection.reason.slice(0, 300),
        replyToId: replyTarget ? replyTarget.id : '',
        replyToAuthor: replyTarget ? replyTarget.authorName.slice(0, 80) : '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setReplyTarget(null);

      if (currentServer.botSlowmodeSeconds > 0) {
        setSlowmodeCooldown(currentServer.botSlowmodeSeconds);
      }

      if (inspection.flagged && inspection.botResponse) {
        const botEnv = await encryptE2EE(
          inspection.botResponse,
          currentServer.e2eeKeyId
        );
        const botMsgId = `msg_bot_${Date.now()}_mod`;
        await setDoc(
          doc(db, 'servers', currentServer.id, 'messages', botMsgId),
          {
            id: botMsgId,
            serverId: currentServer.id,
            channelId: currentChannel.id,
            authorId: userPublic.uid,
            authorName: 'Sentinel AutoMod Bot',
            authorAvatar: sentinelAvatar,
            authorRole: 'bot',
            ciphertext: botEnv.ciphertext,
            iv: botEnv.iv,
            signature: botEnv.signature,
            isEncrypted: true,
            isPinned: false,
            isFlaggedByBot: true,
            botModerationNote: inspection.reason.slice(0, 300),
            replyToId: msgId,
            replyToAuthor: userPublic.displayName.slice(0, 80),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
      }
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.CREATE,
        `servers/${currentServer.id}/messages`
      );
    }
  };

  const handleTogglePinMessage = async (msg: MessageItem) => {
    try {
      await updateDoc(
        doc(db, 'servers', msg.serverId, 'messages', msg.id),
        {
          isPinned: !msg.isPinned,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `servers/${msg.serverId}/messages/${msg.id}`
      );
    }
  };

  const handleDeleteMessage = async (msg: MessageItem) => {
    try {
      await deleteDoc(doc(db, 'servers', msg.serverId, 'messages', msg.id));
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `servers/${msg.serverId}/messages/${msg.id}`
      );
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPublic || !newServerName.trim()) return;

    const cleanName = newServerName.trim().slice(0, 80);
    const serverId = `srv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const inviteCode = `VTX${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const e2eeKeyId = `AES256-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const iconText = cleanName
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();

    try {
      await setDoc(doc(db, 'servers', serverId), {
        id: serverId,
        name: cleanName,
        description:
          newServerDesc.trim().slice(0, 300) ||
          'Comunidade criptografada de ponta a ponta com moderação Sentinel.',
        iconText: iconText || 'VX',
        bannerUrl: communityBanner,
        ownerId: userPublic.uid,
        inviteCode,
        isPublic: true,
        e2eeKeyId,
        botAutoMod: true,
        botWelcome: true,
        botAntiRaid: true,
        botSlowmodeSeconds: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const defaultChId = `ch_geral_${Date.now()}`;
      const voiceChId = `ch_voz_${Date.now()}`;

      await setDoc(doc(db, 'servers', serverId, 'channels', defaultChId), {
        id: defaultChId,
        serverId,
        name: 'geral',
        category: 'Canais de Texto',
        type: 'text',
        topic: 'Canal principal criptografado ponta a ponta.',
        isLocked: false,
        ownerId: userPublic.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'servers', serverId, 'channels', voiceChId), {
        id: voiceChId,
        serverId,
        name: 'Sala de Voz & Vídeo',
        category: 'Canais de Voz & Vídeo',
        type: 'video',
        topic: 'Chamadas de voz, vídeo e compartilhamento de tela.',
        isLocked: false,
        ownerId: userPublic.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewServerName('');
      setNewServerDesc('');
      setShowCreateServerModal(false);
      setViewMode('server');
      setSelectedServerId(serverId);
      setSelectedChannelId(defaultChId);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `servers/${serverId}`);
    }
  };

  const handleJoinByInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inviteJoinInput.trim().toUpperCase();
    if (!code) return;

    const match = servers.find((s) => s.inviteCode.toUpperCase() === code);
    if (match) {
      setSelectedServerId(match.id);
      setViewMode('server');
      setInviteJoinInput('');
      setShowCreateServerModal(false);
    } else {
      try {
        const snap = await getDocs(
          query(collection(db, 'servers'), where('isPublic', '==', true))
        );
        const found = snap.docs
          .map((d) => d.data() as ServerItem)
          .find((s) => s.inviteCode.toUpperCase() === code);
        if (found) {
          setSelectedServerId(found.id);
          setViewMode('server');
          setInviteJoinInput('');
          setShowCreateServerModal(false);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'servers');
      }
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentServer = servers.find((s) => s.id === selectedServerId);
    if (!userPublic || !currentServer || !newChannelName.trim()) return;

    const chId = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cleanName = newChannelName
      .trim()
      .slice(0, 60)
      .replace(/\s+/g, newChannelType === 'text' ? '-' : ' ');

    try {
      await setDoc(doc(db, 'servers', currentServer.id, 'channels', chId), {
        id: chId,
        serverId: currentServer.id,
        name: cleanName,
        category: newChannelCategory.trim().slice(0, 60) || 'Canais',
        type: newChannelType,
        topic: newChannelTopic.trim().slice(0, 200),
        isLocked: false,
        ownerId: userPublic.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewChannelName('');
      setNewChannelTopic('');
      setShowCreateChannelModal(false);
      setSelectedChannelId(chId);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.CREATE,
        `servers/${currentServer.id}/channels/${chId}`
      );
    }
  };

  // Loading state
  if (!authReady) {
    return (
      <div className="min-h-screen w-full bg-[#080B11] text-[#F1F5F9] flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-mono text-slate-400">
            Inicializando Cofre Criptográfico Vortex...
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated Landing Screen (Strict 3-Zone Top Bar Contract + Elegant Editorial Layout)
  if (!firebaseUser || !userPublic || !userPrivate) {
    return (
      <div className="min-h-screen w-full bg-[#080B11] text-[#F1F5F9] flex flex-col justify-between overflow-y-auto">
        {/* Top Bar Contract: Zone 1 Brand | Zone 2 Nav Links | Zone 3 Primary Action */}
        <header className="w-full max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800/80">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-white"
          >
            Vortex
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <a href="#comunidades" className="hover:text-white transition-colors">
              Comunidades
            </a>
            <a href="#voz-video" className="hover:text-white transition-colors">
              Voz e Vídeo
            </a>
            <a href="#bots" className="hover:text-white transition-colors">
              Bots de Moderação
            </a>
            <a href="#seguranca" className="hover:text-white transition-colors">
              Criptografia E2EE
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGoogleSignIn}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors whitespace-nowrap cursor-pointer min-h-[40px]"
            >
              Entrar na Plataforma
            </button>
          </div>
        </header>

        {/* Main Hero & Architectural Grid */}
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-16">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="text-xs font-mono text-indigo-400 tabular-nums">
                Criptografia de Ponta a Ponta AES-256-GCM · Autenticação 2FA Obrigatória · WebRTC
              </div>

              <h1 className="font-display text-2xl sm:text-4xl font-bold text-white leading-tight">
                Comunidades em tempo real com voz, vídeo, tela compartilhada e segurança Zero-Trust.
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                Crie servidores organizados em canais de texto, salas de voz de baixa latência e
                transmissões de tela em HD. Personalize sua foto e capa de perfil, gerencie amigos
                P2P e conte com bots automatizados e verificação 2FA TOTP obrigatória.
              </p>

              {authError && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300 max-w-xl">
                  {authError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={handleGoogleSignIn}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer min-h-[48px]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Autenticar com Google + 2FA Obrigatório
                </button>
              </div>

              <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-xs text-slate-400 font-mono tabular-nums">
                <div>
                  <div className="text-white font-semibold text-sm">AES-256-GCM</div>
                  <div>Cifragem Local WebCrypto</div>
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">RFC 6238 TOTP</div>
                  <div>2FA Obrigatório por Sessão</div>
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">Perfil & Capas HD</div>
                  <div>Customização Completa</div>
                </div>
              </div>
            </div>

            {/* Right Visual Showcase */}
            <div className="lg:col-span-5 bg-[#0E1422] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl">
              <div className="relative h-48 w-full">
                <img
                  src={obsidianCover}
                  alt="Estúdio de Comunidade Vortex"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0E1422] via-black/40 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-white">
                    Vortex Core · Arquitetura & Dev
                  </span>
                  <span className="text-xs font-mono text-emerald-400 tabular-nums">
                    E2EE Verificado
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={sentinelAvatar}
                    alt="Sentinel Bot"
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white">
                      Sentinel AutoMod Bot · Moderação Automatizada
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      Comandos /lock, /slowmode, /audit e filtro anti-phishing integrados.
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-[#080B11] border border-slate-800/90 rounded-xl font-mono text-xs text-slate-300 space-y-1 tabular-nums">
                  <div className="text-emerald-400">
                    Envelope Criptográfico: AES-256-GCM + HMAC-SHA256
                  </div>
                  <div className="text-slate-400 truncate">
                    Canais: #geral · #auditoria-e2ee · War Room (Vídeo + Tela)
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3-Column Feature Architecture */}
          <section
            id="seguranca"
            className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-800/80"
          >
            <div className="p-5 bg-[#0E1422] border border-slate-800/90 rounded-2xl space-y-2">
              <div className="text-xs font-mono text-indigo-400">01. Voz, Vídeo & Tela</div>
              <h3 className="text-base font-semibold text-white">
                Salas Multimídia e Captura de Tela Integrada
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Alterne entre canais de texto e salas de voz/vídeo em qualquer dispositivo.
                Compartilhe sua tela em alta definição com verificação de chave DTLS-SRTP.
              </p>
            </div>

            <div className="p-5 bg-[#0E1422] border border-slate-800/90 rounded-2xl space-y-2">
              <div className="text-xs font-mono text-emerald-400">02. Bots Automatizados</div>
              <h3 className="text-base font-semibold text-white">
                Moderação Inteligente & Gestão de Servidores
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                O Sentinel Bot filtra ameaças automaticamente antes da cifragem e responde a
                comandos de barra como /audit, /lock, /unlock, /slowmode e /warn.
              </p>
            </div>

            <div className="p-5 bg-[#0E1422] border border-slate-800/90 rounded-2xl space-y-2">
              <div className="text-xs font-mono text-amber-400">03. Foto, Capa & Segurança</div>
              <h3 className="text-base font-semibold text-white">
                Perfis Personalizáveis, E2EE e 2FA Obrigatório
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Envie sua própria foto de perfil e capa panorâmica, converse via DMs cifradas
                AES-256-GCM e proteja sua conta com autenticação TOTP obrigatória.
              </p>
            </div>
          </section>
        </main>

        <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Vortex — Plataforma de Comunidades Criptografadas</span>
          <span className="font-mono tabular-nums">AES-256-GCM · RFC 6238 TOTP</span>
        </footer>
      </div>
    );
  }

  // Mandatory 2FA Gate before entering workspace
  if (!session2FAVerified) {
    return (
      <Mandatory2FAGate
        userPublic={userPublic}
        userPrivate={userPrivate}
        onVerified={handleComplete2FA}
        onSignOut={() => signOut(auth)}
      />
    );
  }

  const currentServer = servers.find((s) => s.id === selectedServerId) || servers[0];
  const currentChannel =
    channels.find((c) => c.id === selectedChannelId) || channels[0];
  const isServerOwner = currentServer?.ownerId === userPublic.uid;

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceVideoChannels = channels.filter(
    (c) => c.type === 'voice' || c.type === 'video'
  );

  const filteredMessages = messages.filter((m) => {
    if (showPinnedOnly && !m.isPinned) return false;
    if (
      searchFilter.trim() &&
      !(m.decryptedText || '')
        .toLowerCase()
        .includes(searchFilter.trim().toLowerCase()) &&
      !m.authorName.toLowerCase().includes(searchFilter.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const activeChannelTyping = typingIndicators.filter(
    (t) => t.channelId === currentChannel?.id && t.uid !== userPublic.uid
  );

  // Reusable Navigation Drawer Content (Server Rail + Channel List + Profile Cover Dock)
  const renderSidebarNavigation = () => (
    <div className="flex h-full overflow-hidden">
      {/* 1. Leftmost Server Rail (72px) */}
      <aside className="w-[72px] bg-[#06090F] border-r border-slate-800/80 flex flex-col items-center py-3 gap-3 shrink-0 z-20">
        {/* Direct Messages / Friends Hub Button */}
        <button
          onClick={() => {
            setViewMode('friends');
            setMobileNavOpen(false);
          }}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
            viewMode === 'friends'
              ? 'bg-indigo-600 text-white rounded-xl'
              : 'bg-[#111827] text-slate-300 hover:bg-indigo-600/80 hover:text-white'
          }`}
          title="Amigos & Mensagens Diretas (E2EE)"
        >
          <Users className="w-5 h-5" />
        </button>

        <div className="w-8 h-[1px] bg-slate-800/90" />

        {/* Server Icons List */}
        <div className="flex-1 w-full flex flex-col items-center gap-2.5 overflow-y-auto py-1">
          {servers.map((srv) => {
            const isSelected =
              viewMode === 'server' && currentServer?.id === srv.id;
            return (
              <button
                key={srv.id}
                onClick={() => {
                  setViewMode('server');
                  setSelectedServerId(srv.id);
                }}
                className={`relative group w-12 h-12 flex items-center justify-center font-display text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white rounded-xl'
                    : 'bg-[#111827] text-slate-300 hover:bg-slate-800 hover:text-white rounded-2xl'
                }`}
                title={srv.name}
              >
                {isSelected && (
                  <span className="absolute -left-3 w-1.5 h-7 bg-indigo-400 rounded-r" />
                )}
                <span>{srv.iconText}</span>
              </button>
            );
          })}

          {/* Create or Join Server Button */}
          <button
            onClick={() => {
              setShowCreateServerModal(true);
              setMobileNavOpen(false);
            }}
            className="w-12 h-12 rounded-2xl bg-[#111827] hover:bg-emerald-600 text-emerald-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Criar ou Entrar em um Servidor"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Security Indicator & Sign Out */}
        <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => {
              setShowProfileModal(true);
              setMobileNavOpen(false);
            }}
            className="w-10 h-10 rounded-xl bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-center text-emerald-400 hover:bg-emerald-900/50 cursor-pointer"
            title="Personalizar Foto, Capa & Cofre E2EE"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            onClick={() => signOut(auth)}
            className="w-10 h-10 rounded-xl bg-[#111827] hover:bg-red-950/60 text-slate-400 hover:text-red-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Sair da Sessão"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. Secondary Sidebar: Channels & Active Voice Dock + Elegant Profile Cover Card */}
      {currentServer && (
        <aside className="w-64 bg-[#0B101B] border-r border-slate-800/80 flex flex-col shrink-0">
          {/* Server Banner & Header */}
          <div className="relative h-24 border-b border-slate-800/80 overflow-hidden shrink-0">
            <img
              src={currentServer.bannerUrl || communityBanner}
              alt={currentServer.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B101B] via-black/50 to-black/25" />
            <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold text-white truncate">
                  {currentServer.name}
                </h2>
                <div className="text-[11px] font-mono text-emerald-400 tabular-nums truncate">
                  E2EE · {currentServer.e2eeKeyId}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBotModal(true);
                  setMobileNavOpen(false);
                }}
                className="p-1.5 bg-black/60 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg border border-slate-700/80 transition-colors shrink-0 cursor-pointer"
                title="Central de Bots & Automação"
              >
                <Bot className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Invite Code Strip */}
          <div className="px-3 py-2 bg-[#080B11]/80 border-b border-slate-800/80 flex items-center justify-between text-xs shrink-0">
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              Convite: <strong className="text-slate-200">{currentServer.inviteCode}</strong>
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentServer.inviteCode);
                setCopiedInvite(true);
                setTimeout(() => setCopiedInvite(false), 2000);
              }}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px] cursor-pointer"
            >
              {copiedInvite ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copiar
                </>
              )}
            </button>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {/* Text Channels Category */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-400">
                <span>Canais de Texto (E2EE)</span>
                {isServerOwner && (
                  <button
                    onClick={() => {
                      setNewChannelType('text');
                      setNewChannelCategory('Canais de Texto');
                      setShowCreateChannelModal(true);
                      setMobileNavOpen(false);
                    }}
                    className="text-slate-400 hover:text-white cursor-pointer"
                    title="Criar Canal de Texto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {textChannels.map((ch) => {
                const active = viewMode === 'server' && selectedChannelId === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setViewMode('server');
                      setSelectedChannelId(ch.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      active
                        ? 'bg-indigo-600/20 text-white font-semibold border border-indigo-500/30'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Hash className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate">{ch.name}</span>
                    </div>
                    {ch.isLocked && (
                      <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Voice & Video Channels Category */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-400">
                <span>Canais de Voz & Vídeo</span>
                {isServerOwner && (
                  <button
                    onClick={() => {
                      setNewChannelType('video');
                      setNewChannelCategory('Canais de Voz & Vídeo');
                      setShowCreateChannelModal(true);
                      setMobileNavOpen(false);
                    }}
                    className="text-slate-400 hover:text-white cursor-pointer"
                    title="Criar Sala de Voz/Vídeo"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {voiceVideoChannels.map((ch) => {
                const isConnectedHere = activeVoiceChannel?.id === ch.id;
                const channelPeers = roomParticipants.filter(
                  (p) => p.roomId === ch.id
                );

                return (
                  <div key={ch.id} className="space-y-1">
                    <button
                      onClick={() => {
                        setViewMode('server');
                        handleJoinVoiceOrVideoChannel(ch);
                      }}
                      className={`w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        isConnectedHere
                          ? 'bg-emerald-950/50 text-emerald-300 font-semibold border border-emerald-700/50'
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {ch.type === 'video' ? (
                          <Video className="w-4 h-4 text-indigo-400 shrink-0" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate">{ch.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {channelPeers.length > 0 ? `${channelPeers.length} ativo(s)` : 'Entrar'}
                      </span>
                    </button>

                    {channelPeers.length > 0 && (
                      <div className="pl-6 space-y-1 py-0.5">
                        {channelPeers.map((peer) => (
                          <div
                            key={peer.peerId}
                            className="flex items-center justify-between text-[11px] text-slate-300 pr-2"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              <span className="truncate">{peer.displayName}</span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-500">
                              {peer.isScreenSharing
                                ? 'Tela'
                                : peer.isVideoOn
                                ? 'Vídeo'
                                : 'Voz'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Voice/Video Docked Bar */}
          {activeVoiceChannel && (
            <div className="p-3 bg-[#080B11] border-t border-emerald-900/60 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Voz & Vídeo E2EE Conectado
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {activeVoiceChannel.name}
                  </div>
                </div>
                <button
                  onClick={handleLeaveVoiceChannel}
                  className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Desconectar da Sala"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => {
                    const next = !isMuted;
                    setIsMuted(next);
                    syncVoiceMediaState({ isMuted: next });
                  }}
                  className={`py-1.5 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
                    isMuted
                      ? 'bg-red-950/60 text-red-300'
                      : 'bg-[#131B2E] text-slate-300 hover:text-white'
                  }`}
                >
                  {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isMuted ? 'Mudo' : 'Voz'}
                </button>
                <button
                  onClick={() => {
                    const next = !isVideoOn;
                    setIsVideoOn(next);
                    syncVoiceMediaState({ isVideoOn: next });
                    setSelectedChannelId(activeVoiceChannel.id);
                  }}
                  className={`py-1.5 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
                    isVideoOn
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#131B2E] text-slate-300 hover:text-white'
                  }`}
                >
                  <Video className="w-3 h-3" />
                  Vídeo
                </button>
                <button
                  onClick={() => {
                    const next = !isScreenSharing;
                    setIsScreenSharing(next);
                    syncVoiceMediaState({ isScreenSharing: next });
                    setSelectedChannelId(activeVoiceChannel.id);
                  }}
                  className={`py-1.5 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
                    isScreenSharing
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#131B2E] text-slate-300 hover:text-white'
                  }`}
                >
                  <MonitorUp className="w-3 h-3" />
                  Tela
                </button>
              </div>
            </div>
          )}

          {/* Elegant Current User Profile Card with Cover Banner & Avatar */}
          <div className="bg-[#080B11] border-t border-slate-800/80 shrink-0 overflow-hidden">
            {/* Mini Profile Cover Preview */}
            <div
              onClick={() => {
                setShowProfileModal(true);
                setMobileNavOpen(false);
              }}
              className="h-11 w-full relative cursor-pointer group overflow-hidden"
              style={{ backgroundColor: userPublic.bannerColor || '#4F46E5' }}
              title="Clique para alterar foto e capa do perfil"
            >
              {(userPublic.bannerUrl || obsidianCover) && (
                <img
                  src={userPublic.bannerUrl || obsidianCover}
                  alt="Capa do Perfil"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#080B11] via-black/20 to-transparent" />
              <div className="absolute top-1.5 right-2 px-2 py-0.5 rounded bg-black/65 text-[10px] font-medium text-slate-200 flex items-center gap-1 opacity-90 group-hover:opacity-100">
                <ImagePlus className="w-2.5 h-2.5 text-indigo-400" />
                <span>Foto & Capa</span>
              </div>
            </div>

            <div className="px-3 pb-3 -mt-3.5 flex items-end justify-between gap-2 relative z-10">
              <div
                onClick={() => {
                  setShowProfileModal(true);
                  setMobileNavOpen(false);
                }}
                className="flex items-end gap-2.5 min-w-0 cursor-pointer group"
              >
                <div className="relative shrink-0">
                  <img
                    src={userPublic.avatarUrl || leadEngineerAvatar}
                    alt={userPublic.displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-cover border-2 border-[#080B11] bg-slate-900 shadow"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#080B11] ${
                      userPublic.presence === 'online'
                        ? 'bg-emerald-500'
                        : userPublic.presence === 'idle'
                        ? 'bg-amber-500'
                        : userPublic.presence === 'dnd'
                        ? 'bg-red-500'
                        : 'bg-slate-500'
                    }`}
                  />
                </div>
                <div className="min-w-0 pb-0.5">
                  <div className="text-xs font-semibold text-white group-hover:text-indigo-300 truncate">
                    {userPublic.displayName}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate tabular-nums">
                    @{userPublic.username}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowProfileModal(true);
                  setMobileNavOpen(false);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                title="Alterar Foto, Capa e Perfil"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );

  // Reusable Member & Bots Directory Content
  const renderMembersDirectory = () => (
    <div className="space-y-6">
      {/* Automated Server Bots Section */}
      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-slate-400">
          Bots Automatizados — 2
        </div>

        <div
          onClick={() => {
            setShowBotModal(true);
            setMobileMembersDrawerOpen(false);
          }}
          className="p-2.5 bg-[#131B2E] border border-slate-800/90 rounded-xl flex items-center gap-2.5 cursor-pointer hover:border-emerald-600/50 transition-colors"
        >
          <div className="relative shrink-0">
            <img
              src={sentinelAvatar}
              alt="Sentinel AutoMod"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[#131B2E]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              Sentinel AutoMod
            </div>
            <div className="text-[11px] font-mono text-emerald-400 truncate">
              {currentServer?.botAutoMod ? 'Filtro Ativo' : 'Em Espera'}
            </div>
          </div>
        </div>

        <div
          onClick={() => {
            setShowBotModal(true);
            setMobileMembersDrawerOpen(false);
          }}
          className="p-2.5 bg-[#131B2E] border border-slate-800/90 rounded-xl flex items-center gap-2.5 cursor-pointer hover:border-indigo-500/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-600/40 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              AuditGuard Anti-Raid
            </div>
            <div className="text-[11px] font-mono text-indigo-300 truncate">
              Verificador 2FA & E2EE
            </div>
          </div>
        </div>
      </div>

      {/* Community Members Section */}
      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-slate-400">
          Membros Verificados (2FA) — {allUsers.length}
        </div>

        <div className="space-y-1.5">
          {allUsers.map((member) => (
            <button
              key={member.uid}
              onClick={() => {
                setSelectedProfileCardUser(member);
                setMobileMembersDrawerOpen(false);
              }}
              className="w-full p-2 rounded-xl hover:bg-[#131B2E] transition-colors flex items-center gap-2.5 text-left cursor-pointer"
            >
              <div className="relative shrink-0">
                <img
                  src={member.avatarUrl || leadEngineerAvatar}
                  alt={member.displayName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0B101B] ${
                    member.presence === 'online'
                      ? 'bg-emerald-500'
                      : member.presence === 'idle'
                      ? 'bg-amber-500'
                      : member.presence === 'dnd'
                      ? 'bg-red-500'
                      : 'bg-slate-500'
                  }`}
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">
                  {member.displayName}
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate tabular-nums">
                  {member.customStatus || member.e2eeFingerprint.slice(0, 14)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#080B11] text-[#F1F5F9] flex flex-col lg:flex-row overflow-hidden select-none">
      {/* Desktop Left Navigation (Hidden on Mobile/Tablet, shown on lg+) */}
      <div className="hidden lg:flex h-full shrink-0">{renderSidebarNavigation()}</div>

      {/* Mobile & Tablet Slide-Over Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 h-full flex shadow-2xl">
            {renderSidebarNavigation()}
          </div>
        </div>
      )}

      {/* Mobile & Tablet Slide-Over Member Directory Drawer */}
      {mobileMembersDrawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileMembersDrawerOpen(false)}
          />
          <aside className="relative z-10 w-72 h-full bg-[#0B101B] border-l border-slate-800/90 p-4 overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-display text-sm font-bold text-white">
                Membros & Bots
              </span>
              <button
                onClick={() => setMobileMembersDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderMembersDirectory()}
          </aside>
        </div>
      )}

      {/* Main Center Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-14 lg:pb-0">
        {viewMode === 'friends' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile Top Header for Friends View */}
            <div className="lg:hidden h-13 px-4 bg-[#0B101B] border-b border-slate-800/80 flex items-center justify-between shrink-0">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="p-2 -ml-1 text-slate-300 hover:text-white rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="font-display text-sm font-bold text-white">
                Amigos & DMs E2EE
              </span>
              <button
                onClick={() => setShowProfileModal(true)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg"
              >
                <img
                  src={userPublic.avatarUrl || leadEngineerAvatar}
                  alt={userPublic.displayName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-lg object-cover border border-slate-700"
                />
              </button>
            </div>
            <FriendsManager currentUser={userPublic} />
          </div>
        ) : currentChannel &&
          (currentChannel.type === 'voice' || currentChannel.type === 'video') ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile Top Bar for Voice/Video View */}
            <div className="lg:hidden h-13 px-4 bg-[#0B101B] border-b border-slate-800/80 flex items-center justify-between shrink-0">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="p-2 -ml-1 text-slate-300 hover:text-white rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="font-display text-sm font-bold text-white truncate">
                {currentChannel.name}
              </span>
              <button
                onClick={() => setShowProfileModal(true)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg"
              >
                <Camera className="w-4 h-4 text-indigo-400" />
              </button>
            </div>
            <VoiceVideoStage
              server={currentServer}
              channel={currentChannel}
              currentUser={userPublic}
              participants={roomParticipants}
              isMuted={isMuted}
              isDeafened={isDeafened}
              isVideoOn={isVideoOn}
              isScreenSharing={isScreenSharing}
              onToggleMute={() => {
                const next = !isMuted;
                setIsMuted(next);
                syncVoiceMediaState({ isMuted: next });
              }}
              onToggleDeafen={() => {
                const next = !isDeafened;
                setIsDeafened(next);
                syncVoiceMediaState({ isDeafened: next });
              }}
              onToggleVideo={() => {
                const next = !isVideoOn;
                setIsVideoOn(next);
                syncVoiceMediaState({ isVideoOn: next });
              }}
              onToggleScreenShare={() => {
                const next = !isScreenSharing;
                setIsScreenSharing(next);
                syncVoiceMediaState({ isScreenSharing: next });
              }}
              onLeaveVoice={handleLeaveVoiceChannel}
              wsRef={wsRef}
            />
          </div>
        ) : (
          /* Text Channel View */
          <main className="flex-1 flex flex-col bg-[#080B11] overflow-hidden">
            {/* Top Channel Bar (Responsive across Mobile, Tablet, Desktop) */}
            <header className="h-14 px-3 sm:px-5 border-b border-slate-800/80 bg-[#0B101B]/90 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setMobileNavOpen(true)}
                  className="lg:hidden p-2 -ml-1 text-slate-300 hover:text-white rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                  title="Abrir Servidores e Canais"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <Hash className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-semibold text-sm text-white truncate">
                  {currentChannel?.name || 'geral'}
                </span>
                {currentChannel?.isLocked && (
                  <span className="text-xs font-mono text-amber-400 flex items-center gap-1">
                    · <Lock className="w-3 h-3" /> Trancado
                  </span>
                )}
                <span className="text-slate-600 hidden md:inline" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs text-slate-400 truncate hidden md:inline">
                  {currentChannel?.topic}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Search Messages */}
                <div className="relative hidden sm:block">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filtrar mensagens..."
                    className="pl-8 pr-3 py-1.5 bg-[#080B11] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 w-36 md:w-44"
                  />
                </div>

                {/* Filter Pinned */}
                <button
                  onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    showPinnedOnly
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-[#080B11] text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  title="Mostrar apenas mensagens fixadas"
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Fixadas</span>
                </button>

                {/* Quick Profile Photo & Cover Button */}
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#080B11] text-indigo-300 border border-slate-800 hover:border-indigo-500/50 flex items-center gap-1.5 cursor-pointer"
                  title="Alterar Foto de Perfil e Capa"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Foto & Capa</span>
                </button>

                {/* Bot Automation Console */}
                <button
                  onClick={() => setShowBotModal(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#080B11] text-emerald-400 border border-slate-800 hover:border-emerald-600/50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Sentinel Bot</span>
                </button>

                {/* Toggle Members Sidebar (Desktop xl+ or Mobile Drawer) */}
                <button
                  onClick={() => {
                    if (window.innerWidth < 1280) {
                      setMobileMembersDrawerOpen(true);
                    } else {
                      setShowMemberSidebar(!showMemberSidebar);
                    }
                  }}
                  className="p-2 rounded-lg border bg-[#080B11] text-slate-300 border-slate-800 hover:text-white transition-colors cursor-pointer"
                  title="Lista de membros e bots"
                >
                  <Users className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Center Body + Optional Right Member Directory */}
            <div className="flex-1 flex overflow-hidden">
              {/* Message Stream & Composer */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5 select-text">
                  {/* Channel E2EE Cryptographic Banner */}
                  <div className="p-4 bg-[#0E1422] border border-slate-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          Início de #{currentChannel?.name} · Criptografia de Ponta a Ponta Ativa
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Mensagens cifradas localmente via{' '}
                        <span className="font-mono text-indigo-300">AES-256-GCM</span> (Chave{' '}
                        <span className="font-mono text-emerald-400">
                          {currentServer?.e2eeKeyId}
                        </span>
                        ). Clique em qualquer membro para ver sua capa de perfil ou digite{' '}
                        <code className="text-indigo-300 font-mono">/help</code>.
                      </p>
                    </div>
                  </div>

                  {/* Messages List */}
                  {filteredMessages.map((msg) => {
                    const canDelete =
                      msg.authorId === userPublic.uid || isServerOwner;
                    const timestampStr = msg.createdAt?.toDate
                      ? msg.createdAt.toDate().toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'agora';

                    const authorProfile = allUsers.find((u) => u.uid === msg.authorId);

                    return (
                      <div
                        key={msg.id}
                        className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-colors ${
                          msg.authorRole === 'bot'
                            ? 'bg-[#0E1422] border-emerald-800/50'
                            : msg.isPinned
                            ? 'bg-[#0E1422]/90 border-indigo-500/40'
                            : 'bg-[#0E1422]/60 border-slate-800/70 hover:border-slate-700/80'
                        }`}
                      >
                        {/* Reply Reference */}
                        {msg.replyToId && (
                          <div className="text-[11px] text-slate-400 font-mono mb-1.5 flex items-center gap-1.5">
                            <Reply className="w-3 h-3 text-indigo-400" />
                            <span>Respondendo a {msg.replyToAuthor}</span>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <img
                            onClick={() => {
                              if (authorProfile) setSelectedProfileCardUser(authorProfile);
                            }}
                            src={
                              authorProfile?.avatarUrl ||
                              msg.authorAvatar ||
                              (msg.authorRole === 'bot'
                                ? sentinelAvatar
                                : leadEngineerAvatar)
                            }
                            alt={msg.authorName}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0 mt-0.5 cursor-pointer hover:opacity-90 transition-opacity"
                          />

                          <div className="flex-1 min-w-0 space-y-1">
                            {/* Clean Unboxed Metadata Header */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  if (authorProfile) setSelectedProfileCardUser(authorProfile);
                                }}
                                className="font-semibold text-white hover:text-indigo-300 cursor-pointer"
                              >
                                {authorProfile?.displayName || msg.authorName}
                              </button>
                              <span className="text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono text-[11px] text-indigo-400">
                                {msg.authorRole === 'bot'
                                  ? 'Bot Automatizado'
                                  : msg.authorRole === 'admin'
                                  ? 'Admin'
                                  : 'Membro'}
                              </span>
                              <span className="text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                {timestampStr}
                              </span>
                              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
                                ·
                              </span>
                              <span className="hidden sm:inline font-mono text-[11px] text-emerald-400/90 tabular-nums">
                                E2EE {msg.signature.slice(0, 10)}
                              </span>
                              {msg.isPinned && (
                                <>
                                  <span className="text-slate-600" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="font-mono text-[11px] text-amber-400">
                                    Fixada
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Decrypted Message Body */}
                            <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed break-words">
                              {msg.decryptedText}
                            </div>

                            {msg.isFlaggedByBot && msg.botModerationNote && (
                              <div className="text-[11px] font-mono text-amber-400 pt-1">
                                Filtro Sentinel Bot: {msg.botModerationNote}
                              </div>
                            )}
                          </div>

                          {/* Message Actions Toolbar */}
                          <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 bg-[#080B11] border border-slate-800 rounded-lg p-1 shrink-0">
                            <button
                              onClick={() => setInspectedMessage(msg)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 rounded cursor-pointer"
                              title="Inspecionar Envelope Criptográfico (AES-256-GCM)"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setReplyTarget(msg)}
                              className="p-1.5 text-slate-400 hover:text-indigo-400 rounded cursor-pointer"
                              title="Responder mensagem"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleTogglePinMessage(msg)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 rounded cursor-pointer"
                              title={msg.isPinned ? 'Desafixar' : 'Fixar no canal'}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteMessage(msg)}
                                className="p-1.5 text-slate-400 hover:text-red-400 rounded cursor-pointer"
                                title="Excluir mensagem"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Typing Indicator Bar */}
                {activeChannelTyping.length > 0 && (
                  <div className="px-5 py-1 text-[11px] font-mono text-indigo-300 bg-[#080B11]">
                    {activeChannelTyping.map((t) => t.displayName).join(', ')} está digitando...
                  </div>
                )}

                {/* Reply Banner */}
                {replyTarget && (
                  <div className="px-4 py-2 bg-[#0E1422] border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-300 truncate">
                      Respondendo a <strong>{replyTarget.authorName}</strong>
                    </span>
                    <button
                      onClick={() => setReplyTarget(null)}
                      className="text-slate-400 hover:text-white ml-2"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Message Composer */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 sm:p-4 border-t border-slate-800/80 bg-[#0B101B] flex items-center gap-2.5"
                >
                  {currentChannel?.isLocked && !isServerOwner ? (
                    <div className="w-full py-2.5 px-4 bg-[#080B11] border border-slate-800 rounded-xl text-xs text-amber-400 font-mono flex items-center justify-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      Canal trancado pelo Sentinel ModBot. Apenas administradores podem enviar.
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => {
                          setChatInput(e.target.value);
                          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                            wsRef.current.send(
                              JSON.stringify({
                                type: 'chat:typing',
                                uid: userPublic.uid,
                                displayName: userPublic.displayName,
                                channelId: currentChannel?.id,
                                isTyping: e.target.value.length > 0,
                              })
                            );
                          }
                        }}
                        placeholder={`Mensagem cifrada em #${
                          currentChannel?.name || 'geral'
                        } ou /help...`}
                        maxLength={1500}
                        className="flex-1 px-4 py-2.5 bg-[#080B11] border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[42px]"
                      />
                      <button
                        type="submit"
                        disabled={slowmodeCooldown > 0 && !isServerOwner}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer min-h-[42px]"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {slowmodeCooldown > 0 && !isServerOwner
                            ? `Aguarde ${slowmodeCooldown}s`
                            : 'Cifrar & Enviar'}
                        </span>
                      </button>
                    </>
                  )}
                </form>
              </div>

              {/* 4. Right Member & Automated Bots Directory (Desktop xl+) */}
              {showMemberSidebar && (
                <aside className="w-64 bg-[#0B101B] border-l border-slate-800/80 p-4 overflow-y-auto hidden xl:block shrink-0">
                  {renderMembersDirectory()}
                </aside>
              )}
            </div>
          </main>
        )}
      </div>

      {/* Mobile & Tablet Fixed Bottom Navigation Bar (< lg) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#0B101B]/95 backdrop-blur-md border-t border-slate-800/90 grid grid-cols-4 items-center z-40">
        <button
          onClick={() => setMobileNavOpen(true)}
          className="h-full flex flex-col items-center justify-center text-slate-400 hover:text-white cursor-pointer"
        >
          <Menu className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">Servidores</span>
        </button>

        <button
          onClick={() => setViewMode('server')}
          className={`h-full flex flex-col items-center justify-center cursor-pointer ${
            viewMode === 'server' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">Canais</span>
        </button>

        <button
          onClick={() => setViewMode('friends')}
          className={`h-full flex flex-col items-center justify-center cursor-pointer ${
            viewMode === 'friends' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">Amigos</span>
        </button>

        <button
          onClick={() => setShowProfileModal(true)}
          className="h-full flex flex-col items-center justify-center text-slate-400 hover:text-white cursor-pointer"
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-medium mt-0.5">Foto & Capa</span>
        </button>
      </nav>

      {/* Modal: User Profile Card with Cover Banner & Avatar */}
      {selectedProfileCardUser && (
        <UserProfileCardModal
          member={selectedProfileCardUser}
          isCurrentUser={selectedProfileCardUser.uid === userPublic.uid}
          onEditOwnProfile={() => setShowProfileModal(true)}
          onClose={() => setSelectedProfileCardUser(null)}
        />
      )}

      {/* Modal: E2EE Cryptographic Packet Inspector */}
      {inspectedMessage && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0E1422] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 select-text">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display text-base font-bold text-white">
                  Inspeção de Pacote Criptográfico E2EE
                </h3>
              </div>
              <button
                onClick={() => setInspectedMessage(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs tabular-nums">
              <div className="p-3 bg-[#080B11] border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400">Algoritmo & Chave do Servidor:</div>
                <div className="text-emerald-400">
                  AES-256-GCM (WebCrypto) · {currentServer?.e2eeKeyId}
                </div>
              </div>

              <div className="p-3 bg-[#080B11] border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400">Vetor de Inicialização (IV - 96 bits Base64):</div>
                <div className="text-indigo-300 break-all">{inspectedMessage.iv}</div>
              </div>

              <div className="p-3 bg-[#080B11] border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400">
                  Payload Cifrado Armazenado no Firestore (Ciphertext):
                </div>
                <div className="text-slate-300 break-all max-h-28 overflow-y-auto">
                  {inspectedMessage.ciphertext}
                </div>
              </div>

              <div className="p-3 bg-[#080B11] border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400">Assinatura de Integridade SHA-256:</div>
                <div className="text-amber-300 break-all">{inspectedMessage.signature}</div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setInspectedMessage(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Fechar Inspeção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bot Automation & Moderation Center */}
      {showBotModal && currentServer && (
        <BotCenterModal
          server={currentServer}
          isOwner={isServerOwner}
          onUpdateBotConfig={async (updates) => {
            try {
              await updateDoc(doc(db, 'servers', currentServer.id), {
                ...updates,
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              handleFirestoreError(
                err,
                OperationType.UPDATE,
                `servers/${currentServer.id}`
              );
            }
          }}
          onClose={() => setShowBotModal(false)}
        />
      )}

      {/* Modal: Profile Photo, Cover Banner & Security Vault Customization */}
      {showProfileModal && (
        <ProfileSettingsModal
          userPublic={userPublic}
          userPrivate={userPrivate}
          onSaveProfile={async (updates) => {
            try {
              await updateDoc(doc(db, 'users', userPublic.uid), {
                ...updates,
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              handleFirestoreError(
                err,
                OperationType.UPDATE,
                `users/${userPublic.uid}`
              );
            }
          }}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Modal: Create or Join Server */}
      {showCreateServerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0E1422] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display text-base font-bold text-white">
                Criar ou Entrar em Comunidade Criptografada
              </h3>
              <button
                onClick={() => setShowCreateServerModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateServer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Nome do Novo Servidor
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="Ex: Laboratório CyberSec Brasil"
                  className="w-full px-3.5 py-2.5 bg-[#080B11] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Descrição da Comunidade
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={newServerDesc}
                  onChange={(e) => setNewServerDesc(e.target.value)}
                  placeholder="Canais de voz, vídeo e auditoria com Sentinel Bot..."
                  className="w-full px-3.5 py-2.5 bg-[#080B11] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Provisionar Servidor com Chave AES-256-GCM
              </button>
            </form>

            <div className="border-t border-slate-800 pt-4">
              <form onSubmit={handleJoinByInvite} className="space-y-3">
                <label className="block text-xs font-medium text-slate-300">
                  Ou entre usando um Código de Convite Existente
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inviteJoinInput}
                    onChange={(e) => setInviteJoinInput(e.target.value)}
                    placeholder="Ex: VORTEX2026"
                    className="flex-1 px-3.5 py-2 bg-[#080B11] border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Entrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Channel */}
      {showCreateChannelModal && currentServer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0E1422] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display text-base font-bold text-white">
                Criar Novo Canal em {currentServer.name}
              </h3>
              <button
                onClick={() => setShowCreateChannelModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Tipo de Canal
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['text', 'voice', 'video'] as ChannelType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewChannelType(t)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border cursor-pointer ${
                        newChannelType === t
                          ? 'bg-indigo-600/20 border-indigo-500 text-white'
                          : 'bg-[#080B11] border-slate-800 text-slate-400'
                      }`}
                    >
                      {t === 'text' ? 'Texto E2EE' : t === 'voice' ? 'Sala de Voz' : 'Vídeo & Tela'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Nome do Canal
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="Ex: arquitetura-sistemas"
                  className="w-full px-3.5 py-2.5 bg-[#080B11] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Tópico / Descrição
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={newChannelTopic}
                  onChange={(e) => setNewChannelTopic(e.target.value)}
                  placeholder="Finalidade deste canal..."
                  className="w-full px-3.5 py-2.5 bg-[#080B11] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateChannelModal(false)}
                  className="px-4 py-2 text-xs text-slate-300 border border-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Criar Canal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
