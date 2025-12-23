
import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music, SkipForward, Radio } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

// Playlist com IDs curados: H.E.R, Ed Sheeran, Rihanna, e vibes similares
const PLAYLIST_IDS = [
  "2FJoRz34q9s", // H.E.R. - Best Part
  "JGwWNGJdvx8", // Ed Sheeran - Shape of You
  "lWA2pjMjpBs", // Rihanna - Diamonds
  "0RyInjfgNc4", // Rihanna - Umbrella
  "2Vv-BfVoq4g", // Ed Sheeran - Perfect
  "hG4lT4tdyGQ", // Daniel Caesar - Get You
  "kPhpHvnnn0Q", // Chill Vibes Playlist
  "fB8qJwRM1v8"  // Relaxing R&B Mix
];

interface BackgroundMusicProps {
  isPlaying: boolean;
}

const BackgroundMusic: React.FC<BackgroundMusicProps> = ({ isPlaying }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // Função de inicialização
    const initPlayer = () => {
      if (playerRef.current) return; // Já inicializado

      try {
        playerRef.current = new window.YT.Player('yt-player', {
          height: '360', // Tamanho padrão (oculto via CSS) para garantir renderização
          width: '640',
          videoId: PLAYLIST_IDS[0], // Começa com o primeiro
          playerVars: {
            'autoplay': 1,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'loop': 0,
            'modestbranding': 1,
            'playsinline': 1,
            'rel': 0,
            'origin': window.location.origin
          },
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
          }
        });
      } catch (error) {
        console.error("Erro ao criar player YT:", error);
      }
    };

    // Verifica se a API já existe no global
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Carrega script se ainda não existir
      if (!document.getElementById('yt-api-script')) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        tag.id = 'yt-api-script';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      // Callback global
      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    }

    return () => {
      // Cleanup opcional
    };
  }, []);

  // Monitora mudança de estado isPlaying
  useEffect(() => {
    if (playerRef.current && playerReady && typeof playerRef.current.playVideo === 'function') {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying, playerReady]);

  const onPlayerReady = (event: any) => {
    setPlayerReady(true);
    event.target.setVolume(40); // Volume inicial agradável
    if (isPlaying) {
      event.target.playVideo();
    }
  };

  const onPlayerStateChange = (event: any) => {
    // 0 = Ended (Terminou o vídeo)
    if (event.data === 0) {
      playNext();
    }
  };

  const onPlayerError = (event: any) => {
    console.warn("Erro no player do YouTube (código " + event.data + "). Pulando faixa...");
    // 150 ou 101 = vídeo não embeddable. Pula para o próximo.
    playNext();
  };

  const playNext = () => {
    if (!playerRef.current || !playerRef.current.loadVideoById) return;
    
    // Escolhe um índice aleatório diferente do atual (simplificado)
    const nextIndex = Math.floor(Math.random() * PLAYLIST_IDS.length);
    const nextId = PLAYLIST_IDS[nextIndex];
    
    playerRef.current.loadVideoById(nextId);
  };

  const toggleMute = () => {
    if (playerRef.current && typeof playerRef.current.mute === 'function') {
      if (isMuted) {
        playerRef.current.unMute();
      } else {
        playerRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="absolute bottom-8 right-8 z-50 flex flex-col items-end gap-2 animate-fade-in pointer-events-auto">
       {/* 
         NOTA: O player precisa ter algum tamanho no DOM para alguns navegadores processarem o autoplay corretamente.
         Usamos opacity-0 e posicionamento absoluto para "esconder" visualmente sem remover do layout flow completamente.
       */}
       <div className="absolute opacity-0 pointer-events-none -z-10 w-1 h-1 overflow-hidden" style={{ right: '10000px' }}>
          <div id="yt-player"></div>
       </div>
       
       {isPlaying && (
         <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-full shadow-2xl hover:bg-black/80 transition-all group">
            <div className={`p-2 rounded-full ${isMuted ? 'bg-red-500/20' : 'bg-green-500/20'} ${!isMuted ? 'animate-pulse' : ''}`}>
              {isMuted ? <VolumeX size={18} className="text-red-400" /> : <Music size={18} className="text-green-400" />}
            </div>
            
            <div className="flex flex-col mr-2">
               <div className="flex items-center gap-1">
                 <Radio size={10} className="text-yellow-500" />
                 <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Rádio TV</span>
               </div>
               <span className="text-xs text-white font-bold whitespace-nowrap">
                 {playerReady ? "Tocando Hits" : "Carregando..."}
               </span>
            </div>

            <div className="h-6 w-px bg-white/10 mx-1"></div>

            <button onClick={playNext} className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full" title="Próxima Música">
                <SkipForward size={20} />
            </button>
            
            <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full" title={isMuted ? "Ativar Som" : "Mudo"}>
                {isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
            </button>
         </div>
       )}
    </div>
  );
};

export default BackgroundMusic;
