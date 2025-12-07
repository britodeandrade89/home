import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowRight, ArrowLeft, Lock, Unlock, Download, Power, Edit3
} from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from './services/firebase';
import { fetchWeatherData } from './services/weather';
import { processVoiceCommandAI, fetchNews, generateNewsReport } from './services/gemini';
import { Reminder, NewsData, Coords, WeatherData } from './types';
import ResizableWidget from './components/ResizableWidget';
import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import ChefModal from './components/ChefModal';
import RemindersWidget from './components/RemindersWidget';

const App = () => {
  // --- STATE ---
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData>({ temperature: '25', weathercode: 0, is_day: 1, apparent_temperature: '27', precipitation_probability: 0 });
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationName, setLocationName] = useState('Localizando...');
  
  const [reminders, setReminders] = useState<Reminder[]>([]);
  
  // Voice & System
  const [isCommandMode, setIsCommandMode] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [newsSearchMode, setNewsSearchMode] = useState(false);
  const [isFirebaseAvailable, setIsFirebaseAvailable] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  // Layout Lock
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);

  // Widget Positions (Single Screen)
  const [widgets, setWidgets] = useState({
    clock: { scale: 1, x: 40, y: 40 },
    weather: { scale: 1, x: 0, y: 40 },
    reminders: { scale: 1, x: 0, y: 200 },
    date: { scale: 2, x: 0, y: 0 }, // Scale 2.0 as requested
    prev: { scale: 1, x: 40, y: 0 },
    next: { scale: 1, x: 0, y: 0 },
  });

  // Refs
  const appRef = useRef<HTMLDivElement>(null);
  const wakeWordRef = useRef<any>(null);
  const commandRef = useRef<any>(null);

  // --- HELPERS ---
  const updateWidget = (key: string, updates: any) => {
    setWidgets(prev => ({ ...prev, [key]: { ...prev[key as keyof typeof prev], ...updates } }));
  };

  const speak = (text: string, rate: number = 1.1) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = rate; 
      
      // Tenta encontrar uma voz masculina ou mais grave
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        (v.lang.includes('pt-BR') || v.lang.includes('pt-PT')) && 
        (v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('felipe') || v.name.toLowerCase().includes('male'))
      ) || voices.find(v => v.lang.includes('pt-BR'));
      
      if (preferredVoice) {
          utterance.voice = preferredVoice;
          // Se não achou uma voz explicitamente masculina, tenta baixar o tom (pitch)
          if (!preferredVoice.name.toLowerCase().includes('male') && !preferredVoice.name.toLowerCase().includes('daniel')) {
              utterance.pitch = 0.8; 
          }
      }

      // Parar reconhecimento enquanto fala para evitar loop
      if (wakeWordRef.current) wakeWordRef.current.stop();
      
      utterance.onend = () => {
          // Reiniciar reconhecimento após falar
          if (!isCommandMode) {
            try { wakeWordRef.current.start(); } catch(e) {}
          }
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);
      } catch (e) { 
        setWakeLockActive(false); 
      }
    }
  };

  const handleStartDashboard = () => {
    setHasStarted(true);
    requestWakeLock();
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } catch(e) {}
  };

  // --- DATA SYNC ---
  const saveLocalReminder = (text: string, type: 'info' | 'alert' | 'action') => {
    const newReminder: Reminder = {
      id: Date.now().toString(),
      text,
      type,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date()
    };
    const updated = [newReminder, ...reminders];
    setReminders(updated);
    localStorage.setItem('local_reminders', JSON.stringify(updated));
  };

  const addReminderToDB = async (text: string, type: 'info' | 'alert' | 'action' = 'info') => {
    if (db && isFirebaseAvailable) {
      try {
        await addDoc(collection(db, "smart_home_reminders"), {
          text,
          type,
          createdAt: serverTimestamp(),
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });
      } catch (e) { 
        setIsFirebaseAvailable(false);
        saveLocalReminder(text, type);
      }
    } else {
      saveLocalReminder(text, type);
    }
  };

  const deleteReminder = async (id: string) => {
    const newReminders = reminders.filter(r => r.id !== id);
    setReminders(newReminders);
    localStorage.setItem('local_reminders', JSON.stringify(newReminders));

    if (db && isFirebaseAvailable) {
      try {
        if (isNaN(Number(id))) {
            await deleteDoc(doc(db, "smart_home_reminders", id));
        }
      } catch (e) { console.error(e); }
    }
  };

  // --- VOICE ---
  const startWakeWordListener = useCallback(() => {
    if (!window.webkitSpeechRecognition) return;
    if (wakeWordRef.current) wakeWordRef.current.stop();
    if (commandRef.current) commandRef.current.stop();

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join(' ').toLowerCase();
      const lastSlice = transcript.slice(-40);
      if (lastSlice.includes('olá smart home') || lastSlice.includes('ola smart home')) {
        recognition.stop();
        startCommandListener();
      }
    };

    recognition.onend = () => {
      // Check if TTS is speaking before restarting
      if (!window.speechSynthesis.speaking && !isCommandMode) {
         try { recognition.start(); } catch (e) {}
      }
    };

    wakeWordRef.current = recognition;
    try { recognition.start(); } catch (e) {}
  }, [isCommandMode]);

  const startCommandListener = useCallback(() => {
    setIsCommandMode(true);
    if (!newsSearchMode) speak("Estou ouvindo.");

    setTimeout(() => {
      const cmd = new window.webkitSpeechRecognition();
      cmd.continuous = false;
      cmd.interimResults = false;
      cmd.lang = 'pt-BR';

      cmd.onresult = async (e: any) => {
        const command = e.results[0][0].transcript;
        setIsProcessingAI(true);
        
        if (newsSearchMode) {
           speak("Buscando notícia...");
           const report = await generateNewsReport(command);
           speak(report, 1.25);
           setNewsSearchMode(false);
        } else {
          const result = await processVoiceCommandAI(command);
          if (result) {
            if (result.action === 'read_news_init') {
              if (result.text) {
                // Topic detected immediately
                speak(result.response || "Buscando...");
                const report = await generateNewsReport(result.text);
                speak(report, 1.25);
              } else {
                // Ask for topic
                setNewsSearchMode(true);
                speak(result.response || "Qual notícia?");
              }
            } else if (result.action === 'add_reminder' && result.text) {
               await addReminderToDB(result.text, result.type || 'info');
               speak(`Adicionado: ${result.text}`);
            } else if (result.response) {
               speak(result.response);
            }
          } else {
            speak("Não entendi.");
          }
        }
        setIsProcessingAI(false);
      };

      cmd.onerror = () => {
        if (!newsSearchMode) speak("Não entendi.");
        setIsCommandMode(false);
        setNewsSearchMode(false);
        startWakeWordListener();
      };

      cmd.onend = () => {
         setIsCommandMode(false);
         if (newsSearchMode) startCommandListener(); else startWakeWordListener();
      };
      
      commandRef.current = cmd;
      cmd.start();
    }, 1200);
  }, [startWakeWordListener, newsSearchMode]); 

  // --- LAYOUT & EFFECTS ---

  // Handle auto-positioning on resize/rotate
  const handleResize = useCallback(() => {
    // Only auto-adjust if we want strict positioning or if screen changed drastically
    const w = window.innerWidth;
    const h = window.innerHeight;

    setWidgets(prev => ({
        ...prev,
        // CLOCK: Top Left
        clock: { ...prev.clock, x: 40, y: 40 },
        
        // WEATHER: Top Right
        weather: { 
          ...prev.weather, 
          x: w - 380, // Approx widget width
          y: 40 
        },

        // REMINDERS: Right side, below weather
        reminders: {
          ...prev.reminders,
          x: w - 380,
          y: 220 // Below weather
        },

        // YESTERDAY: Bottom Left
        prev: { 
          ...prev.prev, 
          x: 40, 
          y: h - 180 
        },

        // TOMORROW: Bottom Right
        next: { 
          ...prev.next, 
          x: w - 250, 
          y: h - 180 
        },

        // TODAY: Center (Scale 2.0)
        date: { 
           ...prev.date,
           x: (w / 2) - 150, // Approx half width of widget at scale 1
           y: (h / 2) - 150 
        }
    }));
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));
    handleResize(); // Initial calculation

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
    }, 1000);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLocationName("Local Atual"); 
        },
        (err) => console.warn("GPS erro", err)
      );
    }

    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

    // Firebase Sync
    if (db) {
        const q = query(collection(db, "smart_home_reminders"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
          setReminders(snapshot.docs.map(doc => ({ 
              id: doc.id, 
              ...doc.data(), 
              time: doc.data().time || '--:--', 
              type: (doc.data().type || 'info') as 'info'|'alert'|'action' 
          } as Reminder)));
          setIsFirebaseAvailable(true);
        }, () => setIsFirebaseAvailable(false));
        return () => unsub();
    }

    return () => {
      clearInterval(timer); 
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [handleResize]);

  // Weather Sync
  useEffect(() => {
    if (!coords) return;
    const loadWeather = async () => {
      const data = await fetchWeatherData(coords);
      if (data) setWeather(data);
    };
    loadWeather();
    const interval = setInterval(loadWeather, 300000);
    return () => clearInterval(interval);
  }, [coords]);

  // Voice Init
  useEffect(() => {
    startWakeWordListener();
    return () => {
      if (wakeWordRef.current) wakeWordRef.current.stop();
      if (commandRef.current) commandRef.current.stop();
    };
  }, [startWakeWordListener]);


  // --- DATE HELPERS ---
  const getDateInfo = (d: Date) => ({
    day: d.getDate(),
    weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).toUpperCase().replace('.', ''),
  });
  const today = getDateInfo(currentTime);
  const yesterday = getDateInfo(new Date(new Date().setDate(currentTime.getDate() - 1)));
  const tomorrow = getDateInfo(new Date(new Date().setDate(currentTime.getDate() + 1)));

  // --- BACKGROUND & ATMOSPHERE ---
  const getBackgroundStyle = () => {
     const code = weather.weathercode;
     const isDay = weather.is_day === 1;
     const temp = Number(weather.temperature);
     const rainProb = weather.precipitation_probability;
     
     // Base Image ID from Unsplash (Direct High Quality IDs)
     let imageId = '1622396481328-9b1b78cdd9fd'; // Fallback Sunny
     let overlayColor = 'rgba(0,0,0,0.3)'; // Default dimmer

     // 1. TEMPESTADES (Prioridade Máxima) - 95, 96, 99
     if (code >= 95) {
        imageId = '1605727216801-e27ce1d0cc28'; // Lightning storm
        overlayColor = 'rgba(20, 0, 30, 0.4)'; // Purple/Dark tint
     }
     // 2. NEVE / GRANIZO - 71-77, 85, 86
     else if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
        imageId = '1478265866628-9781c7d87995'; // Snow landscape
        overlayColor = 'rgba(200, 220, 255, 0.2)'; // Icy blue tint
     }
     // 3. CHUVA (Várias intensidades) - 51-67, 80-82
     else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
        if (rainProb > 80 || code >= 63) {
            // Chuva Forte
            imageId = '1515694346937-94d85e41e6f0'; // Rain on glass/Dark
            overlayColor = 'rgba(0, 10, 30, 0.5)'; // Dark blue tint
        } else {
            // Chuva Leve / Garoa
            imageId = '1496034663008-e0d0a0858d46'; // Rain nature
            overlayColor = 'rgba(50, 60, 70, 0.3)'; // Grey tint
        }
     }
     // 4. NEVOEIRO - 45, 48
     else if (code === 45 || code === 48) {
        imageId = '1487621167305-5d248087c724'; // Foggy forest
        overlayColor = 'rgba(150, 150, 150, 0.2)'; // Grey mist
     }
     // 5. NUBLADO (Com nuances) - 2, 3
     else if (code === 2 || code === 3) {
        if (isDay) {
            imageId = rainProb > 40 
                ? '1534088568595-a066f410bcda' // Darker clouds
                : '1595865728041-a368c48bab5f'; // Fluffy clouds
            overlayColor = 'rgba(0,0,0,0.2)';
        } else {
            imageId = '1536746803623-cef8708094dd'; // Night clouds
            overlayColor = 'rgba(10, 10, 20, 0.5)';
        }
     }
     // 6. CÉU LIMPO (Com nuances de temperatura) - 0, 1
     else {
        if (isDay) {
            if (temp > 28) {
                // Calor Extremo
                imageId = '1504370805625-d32c54b16100'; // Hot sunny field/flare
                overlayColor = 'rgba(255, 100, 0, 0.1)'; // Warm orange tint
            } else if (temp < 15) {
                // Frio com sol
                imageId = '1477601263568-180e2c6d046e'; // Winter sun/crisp
                overlayColor = 'rgba(0, 100, 255, 0.1)'; // Cool blue tint
            } else {
                // Dia agradável
                imageId = '1622396481328-9b1b78cdd9fd'; // Standard beautiful sky
                overlayColor = 'rgba(0,0,0,0.1)';
            }
        } else {
            // Noite Estrelada
            imageId = '1532978873691-590b122e7876'; // Stars
            overlayColor = 'rgba(0, 0, 20, 0.4)'; // Deep night blue
        }
     }

     const finalUrl = `https://images.unsplash.com/photo-${imageId}?q=80&w=1920&auto=format&fit=crop`;

     return { 
       backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor}), url("${finalUrl}")`, 
       backgroundSize: 'cover', 
       backgroundPosition: 'center', 
       transition: 'background-image 1.5s ease-in-out' 
     };
  };

  // --- START SCREEN ---
  if (!hasStarted) {
    return (
      <div 
        className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white cursor-pointer"
        onClick={handleStartDashboard}
      >
        <div className="w-20 h-20 rounded-full bg-yellow-500 animate-pulse flex items-center justify-center mb-8">
          <Power size={40} className="text-black" />
        </div>
        <h1 className="text-4xl font-bold uppercase tracking-[0.3em] mb-4 text-center px-4">Smart Home</h1>
        <p className="text-xl opacity-70 mb-8 animate-bounce">Toque para Iniciar</p>
      </div>
    );
  }

  // --- MAIN RENDER ---
  const greeting = currentTime.getHours() < 12 ? 'Bom dia' : currentTime.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <main ref={appRef} className="w-full h-screen overflow-hidden relative text-white font-sans select-none transition-all duration-1000" style={getBackgroundStyle()}>
      
      {/* Voice Activity Overlay */}
      {(isCommandMode || isProcessingAI || newsSearchMode) && (
         <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-black/80 px-6 py-3 rounded-full border border-green-500 flex items-center gap-3 animate-fade-in shadow-2xl pointer-events-none">
            <div className={`w-3 h-3 bg-green-500 rounded-full ${isProcessingAI ? 'animate-bounce' : 'animate-ping'}`} />
            <span className="text-lg font-bold uppercase tracking-widest text-green-400">
              {isProcessingAI ? "Processando..." : "Ouvindo..."}
            </span>
         </div>
      )}

      {/* --- WIDGETS LAYER --- */}
      <section className="absolute inset-0 z-10 w-full h-full">
        
        {/* CLOCK (TOP LEFT) */}
        <ResizableWidget 
            scale={widgets.clock.scale} 
            locked={isLayoutLocked}
            onScaleChange={(s) => updateWidget('clock', { scale: s })} 
            position={{ x: widgets.clock.x, y: widgets.clock.y }}
            onPositionChange={(x, y) => updateWidget('clock', { x, y })}
        >
             <ClockWidget currentTime={currentTime} greeting={greeting} />
        </ResizableWidget>

        {/* WEATHER (TOP RIGHT) */}
        <ResizableWidget 
            scale={widgets.weather.scale}
            locked={isLayoutLocked}
            onScaleChange={(s) => updateWidget('weather', { scale: s })} 
            position={{ x: widgets.weather.x, y: widgets.weather.y }}
            onPositionChange={(x, y) => updateWidget('weather', { x, y })}
        >
           <div className="flex flex-col items-end">
             <div className="flex gap-2 mb-2">
                <button 
                    onClick={(e) => { e.stopPropagation(); setWakeLockActive(!wakeLockActive); }} 
                    className={`p-2 rounded-full shadow-lg transition-colors flex items-center gap-2 ${wakeLockActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400 animate-pulse'}`}
                    title={wakeLockActive ? "Desativar tela sempre ativa" : "Ativar tela sempre ativa"}
                >
                    {wakeLockActive ? (
                        <Lock size={16} />
                    ) : (
                        <>
                            <Unlock size={16}/>
                            <span className="text-xs font-bold uppercase whitespace-nowrap">Tela Sempre Ativa</span>
                        </>
                    )}
                </button>
                {installPrompt && (
                    <button onClick={(e) => { e.stopPropagation(); installPrompt.prompt(); }} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full shadow-lg">
                        <Download size={20} />
                    </button>
                )}
              </div>
              <WeatherWidget weather={weather} locationName={locationName} />
           </div>
        </ResizableWidget>

        {/* REMINDERS (RIGHT - BELOW WEATHER) */}
        <ResizableWidget 
            scale={widgets.reminders.scale}
            locked={isLayoutLocked}
            onScaleChange={(s) => updateWidget('reminders', { scale: s })}
            position={{ x: widgets.reminders.x, y: widgets.reminders.y }}
            onPositionChange={(x, y) => updateWidget('reminders', { x, y })}
        >
           <RemindersWidget 
              reminders={reminders} 
              onAdd={(txt) => addReminderToDB(txt)}
              onDelete={deleteReminder}
           />
        </ResizableWidget>

        {/* TODAY DATE (CENTER - 2X SCALE) */}
        <ResizableWidget 
            scale={widgets.date.scale} 
            locked={isLayoutLocked}
            onScaleChange={(s) => updateWidget('date', { scale: s })}
            position={{ x: widgets.date.x, y: widgets.date.y }}
            onPositionChange={(x, y) => updateWidget('date', { x, y })}
        >
            <div className="text-center drop-shadow-2xl">
               <span className="block text-2xl tracking-[0.5em] text-yellow-300 font-bold mb-2">HOJE</span>
               <span className="block text-[10rem] leading-[0.8] font-bold tracking-tighter pointer-events-none">{today.day}</span>
               <span className="block text-4xl font-light capitalize mt-4 opacity-80 pointer-events-none">
                 {today.weekday.split('-')[0]}
               </span>
            </div>
        </ResizableWidget>

        {/* YESTERDAY (BOTTOM LEFT) */}
        <ResizableWidget 
            scale={widgets.prev.scale} 
            locked={isLayoutLocked}
            onScaleChange={(s) => updateWidget('prev', { scale: s })}
            position={{ x: widgets.prev.x, y: widgets.prev.y }}
            onPositionChange={(x, y) => updateWidget('prev', { x, y })}
        >
              <div className="flex items-center gap-4 group">
                <ArrowLeft className="text-white w-16 h-16 opacity-50" /> 
                <div className="text-left drop-shadow-lg">
                  <span className="text-lg block uppercase tracking-wider text-yellow-400 font-bold mb-1">Ontem</span>
                  <div className="leading-none">
                     <span className="text-6xl font-bold text-white block">{yesterday.day}</span>
                     <span className="text-xl font-light text-white/70 uppercase">{yesterday.month}</span>
                  </div>
                </div>
              </div>
        </ResizableWidget>

        {/* TOMORROW (BOTTOM RIGHT) */}
        <ResizableWidget 
            scale={widgets.next.scale} 
            locked={isLayoutLocked}
            onScaleChange={(s) => updateWidget('next', { scale: s })}
            position={{ x: widgets.next.x, y: widgets.next.y }}
            onPositionChange={(x, y) => updateWidget('next', { x, y })}
        >
              <div className="flex items-center gap-4 text-right group">
                <div className="text-right drop-shadow-lg">
                  <span className="text-lg block uppercase tracking-wider text-yellow-400 font-bold mb-1">Amanhã</span>
                  <div className="leading-none">
                     <span className="text-6xl font-bold text-white block">{tomorrow.day}</span>
                     <span className="text-xl font-light text-white/70 uppercase">{tomorrow.month}</span>
                  </div>
                </div> 
                <ArrowRight className="text-white w-16 h-16 opacity-50" />
              </div>
        </ResizableWidget>

      </section>

      {/* --- LOCK TOGGLE (BOTTOM CENTER/RIGHT) --- */}
      <div className="absolute bottom-6 right-1/2 translate-x-1/2 z-50">
        <button 
          onClick={() => setIsLayoutLocked(!isLayoutLocked)}
          className={`p-4 rounded-full shadow-2xl transition-all duration-300 border ${
             isLayoutLocked 
               ? 'bg-white/5 border-white/10 text-white/20 hover:text-white/50' 
               : 'bg-yellow-500 text-black border-yellow-400 scale-110'
          }`}
          title={isLayoutLocked ? "Desbloquear Layout" : "Bloquear Layout"}
        >
           {isLayoutLocked ? <Lock size={20}/> : <Edit3 size={20}/>}
        </button>
      </div>

    </main>
  );
};

export default App;