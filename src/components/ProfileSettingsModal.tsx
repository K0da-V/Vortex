import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  X,
  Check,
  Camera,
  ImagePlus,
  Upload,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { PresenceStatus, UserPrivate, UserPublic } from '../types';
import leadEngineerAvatar from '../assets/images/avatar_lead_engineer_1791381254383.jpg';
import creativeDirectorAvatar from '../assets/images/avatar_creative_director_1791384015712.jpg';
import sentinelAvatar from '../assets/images/avatar_sentinel_bot_1791381269670.jpg';
import obsidianCover from '../assets/images/cover_obsidian_waves_1791383947099.jpg';
import auroraCover from '../assets/images/cover_nordic_aurora_1791383958552.jpg';
import hubCover from '../assets/images/banner_community_hub_1791381283275.jpg';

interface ProfileSettingsModalProps {
  userPublic: UserPublic;
  userPrivate: UserPrivate;
  onSaveProfile: (updates: Partial<UserPublic>) => Promise<void>;
  onClose: () => void;
}

const PRESET_AVATARS = [
  { label: 'Engenheiro Líder', url: leadEngineerAvatar },
  { label: 'Diretora Criativa', url: creativeDirectorAvatar },
  { label: 'Emblema Sentinel', url: sentinelAvatar },
];

const PRESET_COVERS = [
  { label: 'Ondas Obsidiana', url: obsidianCover },
  { label: 'Aurora Nórdica', url: auroraCover },
  { label: 'Estúdio Acústico', url: hubCover },
];

const BANNER_COLORS = [
  '#4F46E5',
  '#0D9488',
  '#2563EB',
  '#7C3AED',
  '#E11D48',
  '#0F172A',
];

function compressImageFile(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = String(event.target?.result || '');
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  userPublic,
  onSaveProfile,
  onClose,
}) => {
  const [displayName, setDisplayName] = useState(userPublic.displayName);
  const [username, setUsername] = useState(userPublic.username);
  const [bio, setBio] = useState(userPublic.bio);
  const [customStatus, setCustomStatus] = useState(userPublic.customStatus);
  const [presence, setPresence] = useState<PresenceStatus>(userPublic.presence);
  const [avatarUrl, setAvatarUrl] = useState(userPublic.avatarUrl || leadEngineerAvatar);
  const [bannerColor, setBannerColor] = useState(userPublic.bannerColor || '#4F46E5');
  const [bannerUrl, setBannerUrl] = useState(userPublic.bannerUrl || obsidianCover);
  const [customAvatarUrlInput, setCustomAvatarUrlInput] = useState('');
  const [customBannerUrlInput, setCustomBannerUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 256, 256, 0.85);
      setAvatarUrl(compressed);
      setUploadNotice('Foto de perfil atualizada.');
      setTimeout(() => setUploadNotice(''), 3000);
    } catch {
      setUploadNotice('Não foi possível processar a imagem selecionada.');
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 960, 360, 0.82);
      setBannerUrl(compressed);
      setUploadNotice('Capa de perfil atualizada.');
      setTimeout(() => setUploadNotice(''), 3000);
    } catch {
      setUploadNotice('Não foi possível processar a imagem de capa.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveProfile({
        displayName: displayName.trim().slice(0, 60) || 'Membro Vortex',
        username:
          username
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 40) || 'membro',
        bio: bio.trim().slice(0, 300),
        customStatus: customStatus.trim().slice(0, 100),
        presence,
        avatarUrl: avatarUrl.slice(0, 145000),
        bannerColor,
        bannerUrl: bannerUrl.slice(0, 145000),
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#0E1422] border border-slate-800/90 rounded-t-2xl sm:rounded-2xl max-w-3xl w-full overflow-hidden max-h-[92vh] flex flex-col shadow-2xl">
        <input
          ref={avatarFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />
        <input
          ref={coverFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleCoverUpload}
          className="hidden"
        />

        {/* Interactive Profile Banner / Cover Preview */}
        <div
          className="h-36 sm:h-44 w-full relative group shrink-0 overflow-hidden"
          style={{ backgroundColor: bannerColor }}
        >
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt="Capa do Perfil"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0E1422] via-black/30 to-black/20" />

          <div className="absolute top-3.5 left-4 right-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => coverFileInputRef.current?.click()}
                className="px-3 py-1.5 bg-black/70 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg border border-white/15 backdrop-blur-md flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                Alterar Capa do Perfil
              </button>
              {bannerUrl && (
                <button
                  type="button"
                  onClick={() => setBannerUrl('')}
                  className="p-1.5 bg-black/70 hover:bg-red-600/80 text-slate-200 hover:text-white rounded-lg border border-white/15 backdrop-blur-md transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="Remover imagem de capa e usar cor sólida"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-black/70 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg border border-white/15 backdrop-blur-md transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute -bottom-10 left-6 right-6 flex items-end justify-between z-10">
            <div className="flex items-end gap-4">
              <div className="relative group/avatar">
                <img
                  src={avatarUrl || leadEngineerAvatar}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-[#0E1422] bg-slate-900 shadow-lg"
                />
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="absolute inset-0 rounded-2xl bg-black/65 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-medium gap-1 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <span>Trocar Foto</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 pt-14 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                {displayName || 'Membro Vortex'}
              </h2>
              <div className="text-xs text-slate-400">
                @{username} · {customStatus || 'Online'}
              </div>
            </div>

            {uploadNotice && (
              <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{uploadNotice}</span>
              </div>
            )}
          </div>

          {/* Photo & Cover Customization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-4 bg-[#080B11] border border-slate-800/80 rounded-xl space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Foto de Perfil
                </span>
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Enviar Foto
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {PRESET_AVATARS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setAvatarUrl(preset.url)}
                    className={`p-2 rounded-lg border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      avatarUrl === preset.url
                        ? 'bg-indigo-600/15 border-indigo-500 text-white'
                        : 'bg-[#0E1422] border-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <span className="text-[11px] font-medium truncate w-full text-center">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="url"
                  value={customAvatarUrlInput}
                  onChange={(e) => setCustomAvatarUrlInput(e.target.value)}
                  placeholder="Ou cole a URL de uma foto..."
                  className="flex-1 px-3 py-1.5 bg-[#0E1422] border border-slate-800 rounded-md text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customAvatarUrlInput.trim()) {
                      setAvatarUrl(customAvatarUrlInput.trim());
                      setCustomAvatarUrlInput('');
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-md whitespace-nowrap cursor-pointer"
                >
                  Aplicar
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#080B11] border border-slate-800/80 rounded-xl space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Capa de Perfil
                </span>
                <button
                  type="button"
                  onClick={() => coverFileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Enviar Capa
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {PRESET_COVERS.map((cover) => (
                  <button
                    key={cover.label}
                    type="button"
                    onClick={() => setBannerUrl(cover.url)}
                    className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      bannerUrl === cover.url
                        ? 'bg-indigo-600/15 border-indigo-500 text-white'
                        : 'bg-[#0E1422] border-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    <img
                      src={cover.url}
                      alt={cover.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-10 rounded object-cover"
                    />
                    <span className="text-[11px] font-medium truncate w-full text-center">
                      {cover.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  {BANNER_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setBannerColor(color);
                        setBannerUrl('');
                      }}
                      className={`w-6 h-6 rounded-md border transition-transform cursor-pointer ${
                        bannerColor === color && !bannerUrl
                          ? 'border-white scale-110'
                          : 'border-white/20'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Cor sólida ${color}`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-1 max-w-[210px]">
                  <input
                    type="url"
                    value={customBannerUrlInput}
                    onChange={(e) => setCustomBannerUrlInput(e.target.value)}
                    placeholder="URL de capa..."
                    className="w-full px-2.5 py-1 bg-[#0E1422] border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customBannerUrlInput.trim()) {
                        setBannerUrl(customBannerUrlInput.trim());
                        setCustomBannerUrlInput('');
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Identity & Presence Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Nome de Exibição
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#080B11] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Nome de Usuário (@username)
              </label>
              <input
                type="text"
                required
                maxLength={40}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#080B11] border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Status Personalizado
              </label>
              <input
                type="text"
                maxLength={100}
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                placeholder="Ex: Disponível para chamadas..."
                className="w-full px-3.5 py-2.5 bg-[#080B11] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Estado de Presença
              </label>
              <select
                value={presence}
                onChange={(e) => setPresence(e.target.value as PresenceStatus)}
                className="w-full px-3.5 py-2.5 bg-[#080B11] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="online">Online (Disponível)</option>
                <option value="idle">Ausente (Idle)</option>
                <option value="dnd">Não Perturbe</option>
                <option value="offline">Invisível</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Biografia do Perfil (Sobre Mim)
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#080B11] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Clean Privacy Confirmation Banner (No Sensitive Keys/Emails Exposed) */}
          <div className="p-3.5 bg-[#080B11] border border-slate-800/80 rounded-xl flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2 text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Dados sensíveis, e-mail e chaves privadas estão ocultos e protegidos.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div>
              {savedNotice && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Perfil, foto e capa salvos com sucesso!
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white border border-slate-800 rounded-lg cursor-pointer min-h-[40px]"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[40px]"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
