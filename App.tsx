import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowRight, ArrowLeft, Lock, Unlock, Download, Power, Edit3, Bell
} from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from './services/firebase';
import { fetchWeatherData, fetchCityName } from './services/weather';
import { processVoiceCommandAI, fetchNews, generateNewsReport, generateBeachReport } from './services/gemini';
import { Reminder, NewsData, Coords, WeatherData } from './types';
import ResizableWidget from './components/ResizableWidget';
import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import ChefModal from './components/ChefModal';

const App = () => {
  // --- STATE ---
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData>({ temperature: '25', weathercode: 0, is_day: 1, apparent_temperature: '27', precipitation_probability: 0, wind_speed: 0 });
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationName, setLocationName] = useState('Localizando...');
  const [beachReport, setBeachReport] = useState<any>(null);
  
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [currentReminderIndex, setCurrentReminderIndex] = useState(0);
  
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
    date: { scale: 2, x: 0, y: 0 }, 
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
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        (v.lang.includes('pt-BR') || v.lang.includes('pt-PT')) && 
        (v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('felipe') || v.name.toLowerCase().includes('male'))
      ) || voices.find(v => v.lang.includes('pt-BR'));
      
      if (preferredVoice) {
          utterance.voice = preferredVoice;
          if (!preferredVoice.name.toLowerCase().includes('male') && !preferredVoice.name.toLowerCase().includes('daniel')) {
              utterance.pitch = 0.8; 
          }
      }

      if (wakeWordRef.current) wakeWordRef.current.stop();
      
      utterance.onend = () => {
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
      if (!event.results || event.results.length === 0) return;
      
      const transcript = Array.from(event.results).map((r: any) => (r[0] ? r[0].transcript : '')).join(' ').toLowerCase();
      const lastSlice = transcript.slice(-40);
      if (lastSlice.includes('olá smart home') || lastSlice.includes('ola smart home')) {
        recognition.stop();
        startCommandListener();
      }
    };

    recognition.onend = () => {
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
        if (!e.results || e.results.length === 0 || !e.results[0] || e.results[0].length === 0) {
           return;
        }

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
                speak(result.response || "Buscando...");
                const report = await generateNewsReport(result.text);
                speak(report, 1.25);
              } else {
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

  const handleResize = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setWidgets(prev => ({
        ...prev,
        clock: { ...prev.clock, x: 40, y: 40 },
        weather: { ...prev.weather, x: w - 380, y: 40 },
        prev: { ...prev.prev, x: 40, y: h - 180 },
        next: { ...prev.next, x: w - 250, y: h - 180 },
        date: { ...prev.date, x: (w / 2) - 150, y: (h / 2) - 200 } // Centered
    }));
  }, []);

  // 15 MINUTE FORCED RELOAD LOGIC (Updated to 15 mins = 900000 ms)
  useEffect(() => {
    const forcedRefreshInterval = setInterval(() => {
        console.log("Auto-refreshing page for fresh data...");
        window.location.reload(); 
    }, 900000); 

    return () => clearInterval(forcedRefreshInterval);
  }, []);

  // Reminder Rotation
  useEffect(() => {
    if (reminders.length === 0) return;
    const interval = setInterval(() => {
      setCurrentReminderIndex(prev => (prev + 1) % reminders.length);
    }, 5000); // Rotate every 5 seconds
    return () => clearInterval(interval);
  }, [reminders]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));
    handleResize();

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
    }, 1000);

    // Initial Location Fetch
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          // Fetch exact city name
          const cityName = await fetchCityName(pos.coords.latitude, pos.coords.longitude);
          setLocationName(cityName);
        },
        (err) => {
            console.warn("GPS erro, usando Maricá fallback", err);
            // Fallback Maricá coordinates
            const fallbackLat = -22.9194;
            const fallbackLon = -42.8186;
            setCoords({ lat: fallbackLat, lon: fallbackLon });
            setLocationName("Maricá - RJ");
        },
        { timeout: 5000 }
      );
    }

    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

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

  // Weather & Beach Report Sync (Runs every 15 min separately from page reload)
  useEffect(() => {
    if (!coords) return;
    const loadWeather = async () => {
      const data = await fetchWeatherData(coords);
      if (data) {
          setWeather(data);
          const report = await generateBeachReport(data, locationName);
          if (report) setBeachReport(report);
      }
    };
    loadWeather();
    // Fetch data every 15 minutes as well (900000ms) to sync with page reload cycle
    const interval = setInterval(loadWeather, 900000);
    return () => clearInterval(interval);
  }, [coords, locationName]);

  // Voice Init
  useEffect(() => {
    startWakeWordListener();
    return () => {
      if (wakeWordRef.current) wakeWordRef.current.stop();
      if (commandRef.current) commandRef.current.stop();
    };
  }, [startWakeWordListener]);


  // --- HELPERS ---
  const getDateInfo = (d: Date) => ({
    day: d.getDate(),
    weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).toUpperCase().replace('.', ''),
  });
  const today = getDateInfo(currentTime);
  const yesterday = getDateInfo(new Date(new Date().setDate(currentTime.getDate() - 1)));
  const tomorrow = getDateInfo(new Date(new Date().setDate(currentTime.getDate() + 1)));

  // --- BACKGROUND ---
  const getBackgroundStyle = () => {
     try {
       const code = weather?.weathercode || 0;
       const isDay = weather?.is_day === 1;
       const temp = Number(weather?.temperature) || 25;
       const rainProb = weather?.precipitation_probability || 0;
       
       let imageId = '1622396481328-9b1b78cdd9fd'; 
       let overlayColor = 'rgba(0,0,0,0.3)'; 

       if (code >= 95) {
          imageId = '1605727216801-e27ce1d0cc28'; 
          overlayColor = 'rgba(20, 0, 30, 0.4)'; 
       }
       else if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
          imageId = '1478265866628-9781c7d87995'; 
          overlayColor = 'rgba(200, 220, 255, 0.2)'; 
       }
       else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
          if (rainProb > 80 || code >= 63) {
              imageId = '1515694346937-94d85e41e6f0'; 
              overlayColor = 'rgba(0, 10, 30, 0.5)'; 
          } else {
              imageId = '1496034663008-e0d0a0858d46'; 
              overlayColor = 'rgba(50, 60, 70, 0.3)'; 
          }
       }
       else if (code === 45 || code === 48) {
          imageId = '1487621167305-5d248087c724'; 
          overlayColor = 'rgba(150, 150, 150, 0.2)'; 
       }
       else if (code === 2 || code === 3) {
          if (isDay) {
              imageId = rainProb > 40 
                  ? '1534088568595-a066f410bcda' 
                  : '1595865728041-a368c48bab5f'; 
              overlayColor = 'rgba(0,0,0,0.2)';
          } else {
              imageId = '1536746803623-cef8708094dd'; 
              overlayColor = 'rgba(10, 10, 20, 0.5)';
          }
       }
       else {
          if (isDay) {
              if (temp > 28) {
                  imageId = '1504370805625-d32c54b16100'; 
                  overlayColor = 'rgba(255, 100, 0, 0.1)'; 
              } else if (temp < 15) {
                  imageId = '1477601263568-180e2c6d046e'; 
                  overlayColor = 'rgba(0, 100, 255, 0.1)'; 
              } else {
                  imageId = '1622396481328-9b1b78cdd9fd'; 
                  overlayColor = 'rgba(0,0,0,0.1)';
              }
          } else {
              imageId = '1532978873691-590b122e7876'; 
              overlayColor = 'rgba(0, 0, 20, 0.4)'; 
          }
       }

       const finalUrl = `https://images.unsplash.com/photo-${imageId}?q=80&w=1920&auto=format&fit=crop`;

       return { 
         backgroundColor: '#1a1a1a', // Fallback solid color
         backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor}), url("${finalUrl}")`, 
         backgroundSize: 'cover', 
         backgroundPosition: 'center', 
         transition: 'background-image 1.5s ease-in-out' 
       };
     } catch (e) {
       return { backgroundColor: '#222' }; // Safe fallback if anything explodes
     }
  };

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

  const greeting = currentTime.getHours() < 12 ? 'Bom dia' : currentTime.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <main ref={appRef} className="w-full h-screen overflow-hidden relative text-white font-sans select-none transition-all duration-1000" style={getBackgroundStyle()}>
      
      {(isCommandMode || isProcessingAI || newsSearchMode) && (
         <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-black/80 px-6 py-3 rounded-full border border-green-500 flex items-center gap-3 animate-fade-in shadow-2xl pointer-events-none">
            <div className={`w-3 h-3 bg-green-500 rounded-full ${isProcessingAI ? 'animate-bounce' : 'animate-ping'}`} />
            <span className="text-lg font-bold uppercase tracking-widest text-green-400">
              {isProcessingAI ? "Processando..." : "Ouvindo..."}
            </span>
         </div>
      )}

      <section className="absolute inset-0 z-10 w-full h-full">
        
        <ResizableWidget 
            scale={widgets.clock.scale} 
            locked={isLayoutLocked}
            onScaleChange={(s) => updateWidget('clock', { scale: s })} 
            position={{ x: widgets.clock.x, y: widgets.clock.y }}
            onPositionChange={(x, y) => updateWidget('clock', { x, y })}
        >
             <ClockWidget currentTime={currentTime} greeting={greeting} />
        </ResizableWidget>

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
              <WeatherWidget weather={weather} locationName={locationName} beachReport={beachReport} />
           </div>
        </ResizableWidget>

        <ResizableWidget 
            scale={widgets.date.scale} 
            locked={isLayoutLocked}
            onScaleChange={(s) => updateWidget('date', { scale: s })}
            position={{ x: widgets.date.x, y: widgets.date.y }}
            onPositionChange={(x, y) => updateWidget('date', { x, y })}
        >
            <div className="flex flex-col items-center">
              <div className="text-center drop-shadow-2xl">
                <span className="block text-2xl tracking-[0.5em] text-yellow-300 font-bold mb-2">HOJE</span>
                <span className="block text-[10rem] leading-[0.8] font-bold tracking-tighter pointer-events-none">{today.day}</span>
                <span className="block text-4xl font-light capitalize mt-4 opacity-80 pointer-events-none">
                  {today.weekday.split('-')[0]}
                </span>
              </div>
              
              {/* Reminders Footer Integrated Here */}
              <div className="mt-8 w-[300px] bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden relative h-16 flex items-center">
                 <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400/50"></div>
                 <div className="flex items-center gap-3 px-4 w-full">
                    <Bell size={16} className="text-yellow-400 shrink-0" />
                    <div className="flex-1 overflow-hidden">
                       {reminders.length > 0 ? (
                         <div className="animate-fade-in key={currentReminderIndex}">
                            <p className="text-xs font-bold uppercase text-white/50 mb-0.5">
                               {reminders[currentReminderIndex].time} • {reminders[currentReminderIndex].type === 'alert' ? 'Urgente' : 'Lembrete'}
                            </p>
                            <p className="text-sm font-medium truncate leading-tight">
                               {reminders[currentReminderIndex].text}
                            </p>
                         </div>
                       ) : (
                         <p className="text-xs text-white/40 italic">Sem lembretes para agora.</p>
                       )}
                    </div>
                 </div>
              </div>
            </div>
        </ResizableWidget>

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