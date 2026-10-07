import React from 'react';
import { ShieldCheck, X, Edit3 } from 'lucide-react';
import { UserPublic } from '../types';
import leadEngineerAvatar from '../assets/images/avatar_lead_engineer_1791381254383.jpg';
import obsidianCover from '../assets/images/cover_obsidian_waves_1791383947099.jpg';

interface UserProfileCardModalProps {
  member: UserPublic;
  isCurrentUser: boolean;
  onEditOwnProfile: () => void;
  onClose: () => void;
}

export const UserProfileCardModal: React.FC<UserProfileCardModalProps> = ({
  member,
  isCurrentUser,
  onEditOwnProfile,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0E1422] border border-slate-800/90 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
        {/* Profile Cover Banner */}
        <div
          className="h-32 w-full relative overflow-hidden"
          style={{ backgroundColor: member.bannerColor || '#4F46E5' }}
        >
          {(member.bannerUrl || obsidianCover) && (
            <img
              src={member.bannerUrl || obsidianCover}
              alt={member.displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0E1422] via-transparent to-black/25" />

          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg border border-white/15 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Avatar + Actions */}
        <div className="px-6 pb-6 relative">
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative">
              <img
                src={member.avatarUrl || leadEngineerAvatar}
                alt={member.displayName}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-2xl object-cover border-4 border-[#0E1422] bg-slate-900 shadow-lg"
              />
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0E1422] ${
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

            {isCurrentUser && (
              <button
                onClick={() => {
                  onClose();
                  onEditOwnProfile();
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Alterar Foto e Capa
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                {member.displayName}
              </h3>
              <div className="text-xs text-slate-400">
                @{member.username} · {member.customStatus || 'Membro da Comunidade'}
              </div>
            </div>

            {member.bio && (
              <div className="p-3.5 bg-[#080B11] border border-slate-800/80 rounded-xl space-y-1">
                <div className="text-[11px] font-semibold text-slate-400">Sobre Mim</div>
                <p className="text-xs text-slate-200 leading-relaxed">{member.bio}</p>
              </div>
            )}

            <div className="p-3 bg-[#080B11] border border-slate-800/80 rounded-xl flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Perfil verificado com proteção ponta a ponta</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
