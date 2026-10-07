import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Check,
  X,
  Ban,
  MessageSquare,
  ShieldCheck,
  Send,
  Lock,
  Search,
  Users,
} from 'lucide-react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DirectMessageItem, FriendshipItem, UserPublic } from '../types';
import { decryptE2EE, encryptE2EE, sha256Hex } from '../lib/crypto';

interface FriendsManagerProps {
  currentUser: UserPublic;
}

export const FriendsManager: React.FC<FriendsManagerProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'blocked' | 'add'>('all');
  const [friendships, setFriendships] = useState<FriendshipItem[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<UserPublic[]>([]);
  const [searchHandle, setSearchHandle] = useState('');
  const [statusFeedback, setStatusFeedback] = useState('');
  const [selectedFriendship, setSelectedFriendship] = useState<FriendshipItem | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessageItem[]>([]);
  const [dmInput, setDmInput] = useState('');

  useEffect(() => {
    const qReq = query(
      collection(db, 'friendships'),
      where('requesterId', '==', currentUser.uid)
    );
    const qRec = query(
      collection(db, 'friendships'),
      where('recipientId', '==', currentUser.uid)
    );

    let reqList: FriendshipItem[] = [];
    let recList: FriendshipItem[] = [];

    const merge = () => {
      const map = new Map<string, FriendshipItem>();
      [...reqList, ...recList].forEach((item) => map.set(item.id, item));
      setFriendships(Array.from(map.values()));
    };

    const unsub1 = onSnapshot(
      qReq,
      (snap) => {
        reqList = snap.docs.map((d) => d.data() as FriendshipItem);
        merge();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );

    const unsub2 = onSnapshot(
      qRec,
      (snap) => {
        recList = snap.docs.map((d) => d.data() as FriendshipItem);
        merge();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [currentUser.uid]);

  useEffect(() => {
    const qUsers = query(
      collection(db, 'users'),
      where('presence', 'in', ['online', 'idle', 'dnd', 'offline'])
    );
    const unsub = onSnapshot(
      qUsers,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserPublic)
          .filter((u) => u.uid !== currentUser.uid);
        setDirectoryUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    return () => unsub();
  }, [currentUser.uid]);

  useEffect(() => {
    if (!selectedFriendship) {
      setDirectMessages([]);
      return;
    }

    const qSent = query(
      collection(db, 'directMessages'),
      where('senderId', '==', currentUser.uid)
    );
    const qReceived = query(
      collection(db, 'directMessages'),
      where('recipientId', '==', currentUser.uid)
    );

    let sentList: DirectMessageItem[] = [];
    let recList: DirectMessageItem[] = [];

    const mergeAndDecrypt = async () => {
      const map = new Map<string, DirectMessageItem>();
      [...sentList, ...recList]
        .filter((m) => m.friendshipId === selectedFriendship.id)
        .forEach((m) => map.set(m.id, m));

      const sorted = Array.from(map.values()).sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return ta - tb;
      });

      const decrypted = await Promise.all(
        sorted.map(async (m) => ({
          ...m,
          decryptedText: await decryptE2EE(
            m.ciphertext,
            m.iv,
            selectedFriendship.e2eeChannelFingerprint
          ),
        }))
      );
      setDirectMessages(decrypted);
    };

    const unsub1 = onSnapshot(
      qSent,
      (snap) => {
        sentList = snap.docs.map((d) => d.data() as DirectMessageItem);
        mergeAndDecrypt();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'directMessages')
    );

    const unsub2 = onSnapshot(
      qReceived,
      (snap) => {
        recList = snap.docs.map((d) => d.data() as DirectMessageItem);
        mergeAndDecrypt();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'directMessages')
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [selectedFriendship, currentUser.uid]);

  const sendFriendRequest = async (targetUser: UserPublic) => {
    try {
      const pairIds = [currentUser.uid, targetUser.uid].sort();
      const friendshipId = `fr_${pairIds[0].slice(0, 20)}_${pairIds[1].slice(0, 20)}`.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );
      const hash = await sha256Hex(`${pairIds[0]}:${pairIds[1]}:e2ee`);
      const fingerprint = `DM-${hash.slice(0, 24).toUpperCase()}`;

      await setDoc(doc(db, 'friendships', friendshipId), {
        id: friendshipId,
        requesterId: currentUser.uid,
        requesterName: currentUser.displayName.slice(0, 80),
        requesterAvatar: currentUser.avatarUrl.slice(0, 145000),
        recipientId: targetUser.uid,
        recipientName: targetUser.displayName.slice(0, 80),
        recipientAvatar: targetUser.avatarUrl.slice(0, 145000),
        status: 'pending',
        e2eeChannelFingerprint: fingerprint,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStatusFeedback(`Solicitação de amizade enviada para ${targetUser.displayName}.`);
      setActiveTab('pending');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'friendships');
    }
  };

  const handleSearchAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = searchHandle.trim().replace(/^@/, '').toLowerCase();
    if (!cleaned) return;

    const match = directoryUsers.find(
      (u) =>
        u.username.toLowerCase() === cleaned ||
        u.displayName.toLowerCase() === cleaned
    );

    if (match) {
      await sendFriendRequest(match);
      setSearchHandle('');
    } else {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'users'),
            where('presence', 'in', ['online', 'idle', 'dnd', 'offline'])
          )
        );
        const found = snap.docs
          .map((d) => d.data() as UserPublic)
          .find(
            (u) =>
              u.uid !== currentUser.uid &&
              (u.username.toLowerCase() === cleaned || u.displayName.toLowerCase() === cleaned)
          );
        if (found) {
          await sendFriendRequest(found);
          setSearchHandle('');
        } else {
          setStatusFeedback('Nenhum usuário encontrado com esse nome.');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    }
  };

  const handleAcceptRequest = async (fr: FriendshipItem) => {
    try {
      await updateDoc(doc(db, 'friendships', fr.id), {
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `friendships/${fr.id}`);
    }
  };

  const handleBlockFriendship = async (fr: FriendshipItem) => {
    try {
      await updateDoc(doc(db, 'friendships', fr.id), {
        status: 'blocked',
        updatedAt: serverTimestamp(),
      });
      if (selectedFriendship?.id === fr.id) {
        setSelectedFriendship(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `friendships/${fr.id}`);
    }
  };

  const handleRemoveFriendship = async (fr: FriendshipItem) => {
    try {
      await deleteDoc(doc(db, 'friendships', fr.id));
      if (selectedFriendship?.id === fr.id) {
        setSelectedFriendship(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `friendships/${fr.id}`);
    }
  };

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriendship || !dmInput.trim()) return;

    const peerId =
      selectedFriendship.requesterId === currentUser.uid
        ? selectedFriendship.recipientId
        : selectedFriendship.requesterId;

    const dmId = `dm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const envelope = await encryptE2EE(
        dmInput.trim(),
        selectedFriendship.e2eeChannelFingerprint
      );
      await setDoc(doc(db, 'directMessages', dmId), {
        id: dmId,
        friendshipId: selectedFriendship.id,
        senderId: currentUser.uid,
        senderName: currentUser.displayName.slice(0, 80),
        recipientId: peerId,
        ciphertext: envelope.ciphertext,
        iv: envelope.iv,
        signature: envelope.signature,
        createdAt: serverTimestamp(),
      });
      setDmInput('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `directMessages/${dmId}`);
    }
  };

  const acceptedFriends = friendships.filter((f) => f.status === 'accepted');
  const pendingFriends = friendships.filter((f) => f.status === 'pending');
  const blockedFriends = friendships.filter((f) => f.status === 'blocked');

  return (
    <div className="flex-1 flex flex-col bg-[#080B11] overflow-hidden">
      {/* Top Friends Bar */}
      <div className="h-14 px-4 sm:px-6 border-b border-slate-800/80 flex items-center justify-between bg-[#0B101B]">
        <div className="flex items-center gap-3 overflow-x-auto">
          <div className="hidden sm:flex items-center gap-2 text-sm font-semibold text-white pr-3 border-r border-slate-800">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Amigos</span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#080B11] rounded-lg border border-slate-800/80">
            <button
              onClick={() => {
                setActiveTab('all');
                setSelectedFriendship(null);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#131B2E] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({acceptedFriends.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('pending');
                setSelectedFriendship(null);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-[#131B2E] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pendentes ({pendingFriends.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('blocked');
                setSelectedFriendship(null);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'blocked'
                  ? 'bg-[#131B2E] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bloqueados ({blockedFriends.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('add');
                setSelectedFriendship(null);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'add'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-400 hover:bg-emerald-950/40'
              }`}
            >
              Adicionar Amigo
            </button>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mensagens Diretas Protegidas</span>
        </div>
      </div>

      {selectedFriendship ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 sm:px-6 py-3 bg-[#0E1422] border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-white">
                {selectedFriendship.requesterId === currentUser.uid
                  ? selectedFriendship.recipientName
                  : selectedFriendship.requesterName}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-xs text-emerald-400">Conversa Privada</span>
            </div>
            <button
              onClick={() => setSelectedFriendship(null)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Voltar
            </button>
          </div>

          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3">
            {directMessages.length === 0 ? (
              <div className="p-6 bg-[#0E1422] border border-slate-800/80 rounded-2xl text-center space-y-2 max-w-md mx-auto my-8">
                <Lock className="w-6 h-6 text-indigo-400 mx-auto" />
                <div className="text-sm font-semibold text-white">
                  Conversa Direta Protegida
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Suas mensagens com este amigo são protegidas de ponta a ponta.
                </p>
              </div>
            ) : (
              directMessages.map((dm) => (
                <div
                  key={dm.id}
                  className="p-3.5 bg-[#0E1422] border border-slate-800/80 rounded-2xl space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{dm.senderName}</span>
                    <span className="text-[11px] text-slate-500">Protegida</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{dm.decryptedText}</p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleSendDirectMessage}
            className="p-3 sm:p-4 border-t border-slate-800/80 bg-[#0B101B] flex items-center gap-2.5"
          >
            <input
              type="text"
              value={dmInput}
              onChange={(e) => setDmInput(e.target.value)}
              placeholder="Enviar mensagem direta..."
              maxLength={1000}
              className="flex-1 px-4 py-2.5 bg-[#080B11] border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
          {statusFeedback && (
            <div className="p-3 bg-indigo-950/50 border border-indigo-800/70 rounded-xl text-xs text-indigo-200 flex items-center justify-between">
              <span>{statusFeedback}</span>
              <button
                onClick={() => setStatusFeedback('')}
                className="text-indigo-400 hover:text-white"
              >
                Fechar
              </button>
            </div>
          )}

          {activeTab === 'add' && (
            <div className="space-y-6 max-w-3xl">
              <div className="bg-[#0E1422] border border-slate-800/90 rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    Adicionar Amigo por Nome de Usuário
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Encontre amigos pelo @username ou nome de exibição para conversar em privado.
                  </p>
                </div>

                <form onSubmit={handleSearchAdd} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={searchHandle}
                      onChange={(e) => setSearchHandle(e.target.value)}
                      placeholder="Digite @username ou nome..."
                      className="w-full pl-10 pr-4 py-2.5 bg-[#080B11] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Enviar Pedido
                  </button>
                </form>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400">
                  Membros da Comunidade ({directoryUsers.length})
                </h3>
                {directoryUsers.length === 0 ? (
                  <div className="p-5 bg-[#0E1422] border border-slate-800/80 rounded-2xl text-xs text-slate-400">
                    Nenhum outro membro encontrado no momento.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-2xl bg-[#0E1422]">
                    {directoryUsers.map((u) => {
                      const alreadyLinked = friendships.some(
                        (f) => f.requesterId === u.uid || f.recipientId === u.uid
                      );
                      return (
                        <div
                          key={u.uid}
                          className="p-3.5 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {u.displayName}{' '}
                              <span className="text-xs font-mono text-slate-400">
                                @{u.username}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {u.customStatus || 'Membro da Comunidade'}
                            </div>
                          </div>
                          {alreadyLinked ? (
                            <span className="text-xs text-slate-400">Conectado</span>
                          ) : (
                            <button
                              onClick={() => sendFriendRequest(u)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              Adicionar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'all' && (
            <div className="space-y-3 max-w-4xl">
              <div className="text-xs font-semibold text-slate-400">
                Seus Amigos ({acceptedFriends.length})
              </div>
              {acceptedFriends.length === 0 ? (
                <div className="p-8 bg-[#0E1422] border border-slate-800/80 rounded-2xl text-center space-y-3">
                  <div className="text-sm font-semibold text-white">
                    Sua lista de amigos está vazia
                  </div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Adicione membros da comunidade para iniciar conversas diretas privadas.
                  </p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Adicionar Amigos
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-2xl bg-[#0E1422]">
                  {acceptedFriends.map((fr) => {
                    const isRequester = fr.requesterId === currentUser.uid;
                    const friendName = isRequester ? fr.recipientName : fr.requesterName;
                    return (
                      <div
                        key={fr.id}
                        className="p-4 flex items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {friendName}
                          </div>
                          <div className="text-xs text-emerald-400">Amigo Verificado</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedFriendship(fr)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Mensagem
                          </button>
                          <button
                            onClick={() => handleBlockFriendship(fr)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 border border-slate-800 rounded-lg cursor-pointer"
                            title="Bloquear usuário"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveFriendship(fr)}
                            className="p-1.5 text-slate-400 hover:text-red-400 border border-slate-800 rounded-lg cursor-pointer"
                            title="Remover amigo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="space-y-3 max-w-4xl">
              <div className="text-xs font-semibold text-slate-400">
                Solicitações Pendentes ({pendingFriends.length})
              </div>
              {pendingFriends.length === 0 ? (
                <div className="p-6 bg-[#0E1422] border border-slate-800/80 rounded-2xl text-xs text-slate-400">
                  Nenhuma solicitação de amizade pendente.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-2xl bg-[#0E1422]">
                  {pendingFriends.map((fr) => {
                    const isIncoming = fr.recipientId === currentUser.uid;
                    const peerName = isIncoming ? fr.requesterName : fr.recipientName;
                    return (
                      <div key={fr.id} className="p-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-white">{peerName}</div>
                          <div className="text-xs text-slate-400">
                            {isIncoming ? 'Pedido recebido' : 'Pedido enviado'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isIncoming && (
                            <button
                              onClick={() => handleAcceptRequest(fr)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Aceitar
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveFriendship(fr)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/40 text-slate-300 hover:text-red-300 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'blocked' && (
            <div className="space-y-3 max-w-4xl">
              <div className="text-xs font-semibold text-slate-400">
                Usuários Bloqueados ({blockedFriends.length})
              </div>
              {blockedFriends.length === 0 ? (
                <div className="p-6 bg-[#0E1422] border border-slate-800/80 rounded-2xl text-xs text-slate-400">
                  Nenhum usuário bloqueado.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-2xl bg-[#0E1422]">
                  {blockedFriends.map((fr) => {
                    const peerName =
                      fr.requesterId === currentUser.uid ? fr.recipientName : fr.requesterName;
                    return (
                      <div key={fr.id} className="p-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-300">{peerName}</div>
                          <div className="text-xs text-red-400">Bloqueado</div>
                        </div>
                        <button
                          onClick={() => handleRemoveFriendship(fr)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
