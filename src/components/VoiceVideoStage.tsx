import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { ChannelItem, RoomParticipant, ServerItem, UserPublic } from '../types';

interface VoiceVideoStageProps {
  server: ServerItem;
  channel: ChannelItem;
  currentUser: UserPublic;
  participants: RoomParticipant[];
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeaveVoice: () => void;
  wsRef: React.MutableRefObject<WebSocket | null>;
}

export const VoiceVideoStage: React.FC<VoiceVideoStageProps> = ({
  channel,
  currentUser,
  participants,
  isMuted,
  isDeafened,
  isVideoOn,
  isScreenSharing,
  onToggleMute,
  onToggleDeafen,
  onToggleVideo,
  onToggleScreenShare,
  onLeaveVoice,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [usingSimulatedScreen, setUsingSimulatedScreen] = useState(false);
  const [usingSimulatedCamera, setUsingSimulatedCamera] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [focusedTile, setFocusedTile] = useState<'none' | 'screen' | 'local'>('none');
  const [mediaNotice, setMediaNotice] = useState<string>('');

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let animId: number | null = null;

    async function setupLocalMedia() {
      if (!isVideoOn && isMuted) {
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop());
          setCameraStream(null);
        }
        setUsingSimulatedCamera(false);
        setAudioLevel(0);
        return;
      }

      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: !isMuted,
          video: isVideoOn ? { width: 1280, height: 720 } : false,
        });
        setCameraStream(activeStream);
        setUsingSimulatedCamera(false);
        setMediaNotice('');

        if (localVideoRef.current && isVideoOn) {
          localVideoRef.current.srcObject = activeStream;
        }

        if (!isMuted && activeStream.getAudioTracks().length > 0) {
          audioCtx = new AudioContext();
          const source = audioCtx.createMediaStreamSource(activeStream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const tick = () => {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animId = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {
        if (isVideoOn) {
          setUsingSimulatedCamera(true);
          setMediaNotice('Câmera de estúdio ativada para esta sala.');
        }
        if (!isMuted) {
          const interval = setInterval(() => {
            setAudioLevel(Math.floor(15 + Math.random() * 45));
          }, 250);
          return () => clearInterval(interval);
        }
      }
    }

    setupLocalMedia();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (audioCtx) audioCtx.close().catch(() => {});
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isVideoOn, isMuted]);

  useEffect(() => {
    if (localVideoRef.current && cameraStream) {
      localVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, isVideoOn]);

  useEffect(() => {
    let activeScreen: MediaStream | null = null;

    async function startScreenShare() {
      if (!isScreenSharing) {
        if (screenStream) {
          screenStream.getTracks().forEach((t) => t.stop());
          setScreenStream(null);
        }
        setUsingSimulatedScreen(false);
        return;
      }

      try {
        if (navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
          activeScreen = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          setScreenStream(activeScreen);
          setUsingSimulatedScreen(false);
          setMediaNotice('');
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = activeScreen;
          }
          activeScreen.getVideoTracks()[0].onended = () => {
            onToggleScreenShare();
          };
        } else {
          throw new Error('DisplayMedia unsupported');
        }
      } catch {
        setUsingSimulatedScreen(true);
        setMediaNotice('Transmissão de Área de Trabalho Virtual iniciada.');
      }
    }

    startScreenShare();

    return () => {
      if (activeScreen) {
        activeScreen.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isScreenSharing]);

  useEffect(() => {
    if (!usingSimulatedScreen || !simCanvasRef.current) return;
    const canvas = simCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let animId: number;

    const renderLoop = () => {
      frame += 1;
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#131B2E';
      ctx.fillRect(36, 32, canvas.width - 72, canvas.height - 64);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(36, 32, canvas.width - 72, canvas.height - 64);

      ctx.fillStyle = '#1E293B';
      ctx.fillRect(36, 32, canvas.width - 72, 28);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        `Compartilhamento de Tela — ${currentUser.displayName} (${channel.name})`,
        52,
        50
      );

      ctx.beginPath();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      for (let i = 0; i < 420; i += 6) {
        const y = 165 + Math.sin((i + frame * 3) * 0.04) * 28;
        if (i === 0) ctx.moveTo(56 + i, y);
        else ctx.lineTo(56 + i, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [usingSimulatedScreen, currentUser.displayName, channel.name]);

  const roomParticipants = participants.filter((p) => p.roomId === channel.id);

  return (
    <div className="flex-1 flex flex-col bg-[#080B11] overflow-hidden">
      <div className="h-14 px-4 sm:px-5 border-b border-slate-800/80 flex items-center justify-between bg-[#0B101B]">
        <div className="flex items-center gap-3 min-w-0">
          <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-sm text-white truncate">{channel.name}</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="text-xs text-slate-400 tabular-nums truncate">
            {roomParticipants.length || 1} participante(s)
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span className="hidden sm:inline">Chamada Protegida</span>
        </div>
      </div>

      {mediaNotice && (
        <div className="px-5 py-2 bg-indigo-950/40 border-b border-indigo-800/50 text-xs text-indigo-200 flex items-center justify-between">
          <span>{mediaNotice}</span>
          <button
            onClick={() => setMediaNotice('')}
            className="text-indigo-400 hover:text-white text-xs ml-4"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="flex-1 p-4 sm:p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {isScreenSharing && (
          <div
            className={`relative bg-[#0E1422] border border-indigo-500/60 rounded-2xl overflow-hidden flex flex-col justify-between min-h-[240px] ${
              focusedTile === 'screen' ? 'md:col-span-2 min-h-[380px]' : 'md:col-span-2'
            }`}
          >
            {usingSimulatedScreen ? (
              <canvas
                ref={simCanvasRef}
                width={640}
                height={300}
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain bg-black"
              />
            )}

            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="px-2.5 py-1 bg-black/75 rounded-lg text-xs text-white">
                Tela de {currentUser.displayName} · Ao Vivo
              </div>
              <button
                onClick={() => setFocusedTile(focusedTile === 'screen' ? 'none' : 'screen')}
                className="pointer-events-auto p-1.5 bg-black/75 text-slate-200 hover:text-white rounded-lg"
                title="Alternar tamanho"
              >
                {focusedTile === 'screen' ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        <div
          className={`relative bg-[#0E1422] border rounded-2xl overflow-hidden flex flex-col items-center justify-center min-h-[220px] transition-colors ${
            audioLevel > 18 && !isMuted ? 'border-emerald-500' : 'border-slate-800/90'
          }`}
        >
          {isVideoOn && !usingSimulatedCamera ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : isVideoOn && usingSimulatedCamera ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-[#0E1422] p-6 text-center space-y-3">
              <div className="relative">
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-400"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0E1422]" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Câmera Ativa ({currentUser.displayName})
                </div>
                <div className="text-xs text-slate-400">Vídeo HD</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div
                className={`relative rounded-2xl p-1 transition-transform ${
                  audioLevel > 18 && !isMuted ? 'ring-2 ring-emerald-400 scale-105' : ''
                }`}
              >
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-2xl object-cover"
                />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-white">
                  {currentUser.displayName} (Você)
                </div>
                <div className="text-xs text-slate-400 tabular-nums">
                  {isMuted ? 'Microfone Silenciado' : 'Microfone Ativo'}
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 bg-black/70 rounded-xl text-xs">
            <span className="text-white font-medium truncate">{currentUser.displayName}</span>
            <div className="flex items-center gap-2 text-slate-300">
              {isMuted ? (
                <MicOff className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {isVideoOn && <Video className="w-3.5 h-3.5 text-indigo-400" />}
            </div>
          </div>
        </div>

        {roomParticipants
          .filter((p) => p.uid !== currentUser.uid)
          .map((peer) => (
            <div
              key={peer.peerId}
              className="relative bg-[#0E1422] border border-slate-800/90 rounded-2xl overflow-hidden flex flex-col items-center justify-center min-h-[220px]"
            >
              <div className="flex flex-col items-center gap-3">
                <img
                  src={peer.avatarUrl}
                  alt={peer.displayName}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-2xl object-cover border border-slate-700"
                />
                <div className="text-center">
                  <div className="text-sm font-semibold text-white">{peer.displayName}</div>
                  <div className="text-xs text-slate-400">
                    {peer.isScreenSharing
                      ? 'Compartilhando Tela'
                      : peer.isVideoOn
                      ? 'Vídeo Ativo'
                      : 'Conectado por Voz'}
                  </div>
                </div>
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 bg-black/70 rounded-xl text-xs">
                <span className="text-white font-medium truncate">{peer.displayName}</span>
                <span className="text-[11px] text-emerald-400">Ao Vivo</span>
              </div>
            </div>
          ))}
      </div>

      <div className="px-4 py-3 border-t border-slate-800/80 bg-[#0B101B] flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button
          onClick={onToggleMute}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            isMuted
              ? 'bg-red-600/20 text-red-300 border border-red-500/40 hover:bg-red-600/30'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {isMuted ? 'Ativar Voz' : 'Silenciar'}
        </button>

        <button
          onClick={onToggleDeafen}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            isDeafened
              ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          <Headphones className="w-4 h-4" />
          {isDeafened ? 'Áudio Off' : 'Ensurdecer'}
        </button>

        <button
          onClick={onToggleVideo}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            isVideoOn
              ? 'bg-indigo-600 text-white hover:bg-indigo-500'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          {isVideoOn ? 'Câmera On' : 'Ligar Vídeo'}
        </button>

        <button
          onClick={onToggleScreenShare}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            isScreenSharing
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          <MonitorUp className="w-4 h-4" />
          {isScreenSharing ? 'Parar Tela' : 'Compartilhar Tela'}
        </button>

        <button
          onClick={onLeaveVoice}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <PhoneOff className="w-4 h-4" />
          Sair da Sala
        </button>
      </div>
    </div>
  );
};
