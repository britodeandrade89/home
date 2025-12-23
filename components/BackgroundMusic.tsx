
import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

// Playlist com IDs de vídeos/mixes na vibe solicitada (Ed Sheeran, Rihanna, H.E.R, Chill R&B)
const PLAYLIST_IDS = [
  "2FJoRz34q9s", // H.E.R. - Best Part
  "JGwWNGJdvx8", // Ed Sheeran - Shape of You
  "lWA2pjMjpBs", // Rihanna - Diamonds
  "0RyInjfgNc4", // Rihanna - Umbrella
  "2Vv-BfVoq4g", // Ed Sheeran - Perfect
  "hG4lT4tdyGQ", // Daniel Caesar - Get You
  "fB8qJwRM1v8", // Relaxing R&B Mix
  "kPhpHvnnn0Q"  // Chill Vibes Playlist
];

interface BackgroundMusicProps {
  isPlaying: boolean;
}

const BackgroundMusic: React.FC<BackgroundMusicProps> = ({ isPlaying }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // Carrega a API do YouTube IFrame
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('yt-player', {
        height: '1',
        width: '1',
        videoId: PLAYLIST_IDS[0],
        playerVars: {
          'autoplay': 1,
          'controls': 0,
          'disablekb': 1,
          'fs': 0,
          'loop': 0, // Controlaremos o loop manualmente para trocar de música
          'modestbranding': 1,
          'playsinline': 1,
          'rel': 0,
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange
        }
      });
    };

    return () => {
      // Cleanup simples
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch(e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (playerRef.current && playerRef.current.playVideo) {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying]);

  const onPlayerReady = (event: any) => {
    if (isPlaying) {
      event.target.playVideo();
      event.target.setVolume(50); // Começa com volume médio
    }
  };

  const onPlayerStateChange = (event: any) => {
    // 0 = Ended
    if (event.data === 0) {
      playNext();
    }
  };

  const playNext = () => {
    // Algoritmo simples de shuffle "IA"
    let nextIndex = Math.floor(Math.random() * PLAYLIST_IDS.length);
    // Evita repetir a mesma música
    if (nextIndex === currentTrackIndex) {
        nextIndex = (nextIndex + 1) % PLAYLIST_IDS.length;
    }
    
    setCurrentTrackIndex(nextIndex);
    if (playerRef.current) {
        playerRef.current.loadVideoById(PLAYLIST_IDS[nextIndex]);
    }
  };

  const toggleMute = () => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.unMute();
      } else {
        playerRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="absolute bottom-8 right-8 z-50 flex items-center gap-4 animate-fade-in">
       {/* O Player fica invisível visualmente mas presente no DOM */}
       <div id="yt-player" className="absolute opacity-0 pointer-events-none -z-10 w-px h-px overflow-hidden" />
       
       {isPlaying && (
         <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full">
            <Music size={16} className="text-green-400 animate-pulse" />
            <span className="text-xs text-white/70 uppercase tracking-widest font-bold">Rádio Ambiente</span>
            <button onClick={playNext} className="text-[10px] bg-white/10 px-2 py-1 rounded hover:bg-white/20 transition-colors">
                Próxima
            </button>
            <button onClick={toggleMute} className="ml-2 hover:scale-110 transition-transform">
                {isMuted ? <VolumeX size={20} className="text-red-400"/> : <Volume2 size={20} className="text-white"/>}
            </button>
         </div>
       )}
    </div>
  );
};

export default BackgroundMusic;
