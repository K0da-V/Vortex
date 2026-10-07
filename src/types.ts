import { Timestamp } from 'firebase/firestore';

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface UserPublic {
  uid: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  bannerColor: string;
  bannerUrl?: string;
  bio: string;
  customStatus: string;
  presence: PresenceStatus;
  e2eePublicKey: string;
  e2eeFingerprint: string;
  twoFactorEnabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPrivate {
  uid: string;
  email: string;
  totpSecret: string;
  twoFactorVerified: boolean;
  recoveryHash: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ServerItem {
  id: string;
  name: string;
  description: string;
  iconText: string;
  bannerUrl: string;
  ownerId: string;
  inviteCode: string;
  isPublic: boolean;
  e2eeKeyId: string;
  botAutoMod: boolean;
  botWelcome: boolean;
  botAntiRaid: boolean;
  botSlowmodeSeconds: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ChannelType = 'text' | 'voice' | 'video';

export interface ChannelItem {
  id: string;
  serverId: string;
  name: string;
  category: string;
  type: ChannelType;
  topic: string;
  isLocked: boolean;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MessageItem {
  id: string;
  serverId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: 'admin' | 'moderator' | 'member' | 'bot';
  ciphertext: string;
  iv: string;
  signature: string;
  isEncrypted: boolean;
  isPinned: boolean;
  isFlaggedByBot: boolean;
  botModerationNote: string;
  replyToId: string;
  replyToAuthor: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  decryptedText?: string;
}

export interface FriendshipItem {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  status: 'pending' | 'accepted' | 'blocked';
  e2eeChannelFingerprint: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DirectMessageItem {
  id: string;
  friendshipId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  ciphertext: string;
  iv: string;
  signature: string;
  createdAt: Timestamp;
  decryptedText?: string;
}

export interface RoomParticipant {
  peerId: string;
  uid: string;
  displayName: string;
  avatarUrl: string;
  roomId: string;
  serverId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  e2eeFingerprint: string;
  joinedAt: number;
}
