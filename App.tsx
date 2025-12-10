import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowRight, ArrowLeft, Lock, Unlock, Download, Power, Edit3, Bell, MessageSquare
} from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './services/firebase';
import { fetchWeatherData } from './services/weather'; // fetchCityName removido do uso direto para forçar Maricá
import { processVoiceCommandAI, fetchNews, generateNewsReport } from './services/gemini';
import { Reminder, Coords, WeatherData } from './types';
import ResizableWidget from './components/ResizableWidget';
import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import ChefModal from './components/ChefModal';
import ChatModal from './components/ChatModal';

// COORDENADAS FIXAS DE MARICÁ (Pedido do usuário)
const MARICA_COORDS = { lat: -22.9194, lon: -42.8186 };

const App = () => {
  // --- STATE ---
  const [currentTime, setCurrentTime] = useState(new Date());
  // Inicializando weather com valores seguros para não quebrar
  const [weather, setWeather] = useState<WeatherData>({ 
    temperature: '25', weathercode: 0, is_day: 1, apparent_temperature: '27', 
    precipitation_probability: 0, wind_speed: 0, relative_humidity_2m: 70 
  });
  const [locationName, setLocationName] = useState('Maricá - RJ');
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
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Widget Positions & Sizes
  const [widgets, setWidgets] = useState({
    clock: { width: 300, height: 150, x: 40, y: 40 },
    weather: { width: 350, height: 500, x: 0, y: 40 }, 
    // Increased size for date widget (approx double visual impact)
    date: { width: 1200, height: 1000, x: 0, y: 0 }, 
    prev: { width: 250, height: 150, x: 40, y: 0 },
    next: { width: 250, height: 150, x: 0, y: 0 },
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
      
      if (preferredVoice) utterance.voice = preferredVoice;

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
      } catch (e) { setWakeLockActive(false); }
    }
  };

  const handleStartDashboard = () => {
    setHasStarted(true);
    requestWakeLock();
    try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); } catch(e) {}
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
        if (!e.results || e.results.length === 0 || !e.results[0]) return;
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
                  speak("Buscando...");
                  const report = await generateNewsReport(result.text);
                  speak(report, 1.25);
               } else {
                  setNewsSearchMode(true);
                  speak(result.response || "Qual notícia?");
               }
            } else if (result.action === 'add_reminder' && result.text) {
               await addReminderToDB(result.text, result.type || 'info');
               speak(`Adicionado: ${result.text}`);
            } else if (result.action === 'chat') {
               setIsChatOpen(true);
               speak(result.response || "Abrindo chat.");
            } else if (result.response) speak(result.response);
          } else speak("Não entendi.");
        }
        setIsProcessingAI(false);
      };

      cmd.onerror = () => {
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
        weather: { ...prev.weather, x: w - prev.weather.width - 40, y: 40 },
        prev: { ...prev.prev, x: 40, y: h - prev.prev.height - 40 },
        next: { ...prev.next, x: w - prev.next.width - 40, y: h - prev.next.height - 40 },
        date: { ...prev.date, x: (w / 2) - (prev.date.width / 2), y: (h / 2) - (prev.date.height / 2) } 
    }));
  }, []);

  useEffect(() => {
    // REMOVIDO: setInterval com window.location.reload()
    // Isso evita o refresh da página que resetava o app.
  }, []);

  useEffect(() => {
    if (reminders.length === 0) return;
    const interval = setInterval(() => setCurrentReminderIndex(prev => (prev + 1) % reminders.length), 5000);
    return () => clearInterval(interval);
  }, [reminders]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));
    handleResize();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Weather Sync - A cada 15 min ou carga inicial
    const loadWeather = async () => {
      // Usa coordenadas FIXAS de Maricá
      const data = await fetchWeatherData(MARICA_COORDS);
      if (data) setWeather(data);
    };
    
    loadWeather();
    // Este intervalo garante que os dados atualizem sem recarregar a página
    const wInterval = setInterval(loadWeather, 900000); 

    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

    if (db) {
        const q = query(collection(db, "smart_home_reminders"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
          setReminders(snapshot.docs.map(doc => ({ 
              id: doc.id, ...doc.data(), time: doc.data().time || '--:--', type: (doc.data().type || 'info') as 'info'|'alert'|'action' 
          } as Reminder)));
          setIsFirebaseAvailable(true);
        }, () => setIsFirebaseAvailable(false));
        return () => unsub();
    }

    return () => {
      clearInterval(timer); clearInterval(wInterval);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [handleResize]);

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

  // Cyclical Reminders
  const getCyclicalReminders = (): Reminder[] => {
    const day = currentTime.getDay();
    const hour = currentTime.getHours();
    const list: Reminder[] = [];
    if ((day === 1 && hour >= 19) || day === 2) {
        list.push({ type: 'alert', text: "Terças o André não vai pra escola - Marcelly não precisa agilizar marmitas", time: "Aviso", id: 'auto_1' });
    }
    if (day === 2) {
      list.push({ type: 'action', text: "Marcelly tem terapia", time: "Dia todo", id: 'auto_2' });
      list.push({ type: 'action', text: "André tem terapia", time: "Dia todo", id: 'auto_3' });
      list.push({ type: 'info', text: "Terapia da familia Bispo", time: "Dia todo", id: 'auto_4' });
      list.push({ type: 'action', text: "Volei do André - Ir de carona 16h40", time: "16:40", id: 'auto_5' });
    }
    if (day === 3) list.push({ type: 'action', text: "Quartas é dia de volei no Clério", time: "Noite", id: 'auto_6' });
    return list;
  };
  const allReminders = [...getCyclicalReminders(), ...reminders];

  // --- BACKGROUND ---
  const getBackgroundStyle = () => {
       const code = weather?.weathercode || 0;
       const isDay = weather?.is_day === 1;
       let imageId = '1622396481328-9b1b78cdd9fd'; 
       let overlayColor = 'rgba(0,0,0,0.3)'; 
       if (code >= 95) { imageId = '1605727216801-e27ce1d0cc28'; overlayColor = 'rgba(20, 0, 30, 0.4)'; }
       else if ((code >= 51)) { imageId = '1515694346937-94d85e41e6f0'; overlayColor = 'rgba(0, 10, 30, 0.5)'; }
       else if (code >= 2) { imageId = isDay ? '1534088568595-a066f410bcda' : '1536746803623-cef8708094dd'; overlayColor = 'rgba(10, 10, 20, 0.5)'; }
       else if (!isDay) { imageId = '1532978873691-590b122e7876'; overlayColor = 'rgba(0, 0, 20, 0.4)'; }

       const finalUrl = `https://images.unsplash.com/photo-${imageId}?q=80&w=1920&auto=format&fit=crop`;
       return { 
         backgroundColor: '#1a1a1a',
         backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor}), url("${finalUrl}")`, 
         backgroundSize: 'cover', backgroundPosition: 'center', transition: 'background-image 1.5s ease-in-out' 
       };
  };

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white cursor-pointer" onClick={handleStartDashboard}>
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

      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      <section className="absolute inset-0 z-10 w-full h-full">
        <ResizableWidget 
            width={widgets.clock.width} height={widgets.clock.height} onResize={(w, h) => updateWidget('clock', { width: w, height: h })}
            locked={isLayoutLocked} position={{ x: widgets.clock.x, y: widgets.clock.y }} onPositionChange={(x, y) => updateWidget('clock', { x, y })}
        >
             <ClockWidget currentTime={currentTime} greeting={greeting} />
        </ResizableWidget>

        <ResizableWidget 
            width={widgets.weather.width} height={widgets.weather.height} onResize={(w, h) => updateWidget('weather', { width: w, height: h })}
            locked={isLayoutLocked} position={{ x: widgets.weather.x, y: widgets.weather.y }} onPositionChange={(x, y) => updateWidget('weather', { x, y })}
        >
           <div className="flex flex-col items-end w-full h-full">
             <div className="flex gap-2 mb-2 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); setWakeLockActive(!wakeLockActive); }} className={`p-2 rounded-full shadow-lg transition-colors flex items-center gap-2 ${wakeLockActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400 animate-pulse'}`}>
                    {wakeLockActive ? <Lock size={16} /> : <Unlock size={16}/>}
                </button>
              </div>
              <WeatherWidget weather={weather} locationName={locationName} beachReport={beachReport} />
           </div>
        </ResizableWidget>

        <ResizableWidget 
            width={widgets.date.width} height={widgets.date.height} onResize={(w, h) => updateWidget('date', { width: w, height: h })}
            locked={isLayoutLocked} position={{ x: widgets.date.x, y: widgets.date.y }} onPositionChange={(x, y) => updateWidget('date', { x, y })}
        >
            <div className="flex flex-col items-center w-full h-full justify-center">
              <div className="text-center drop-shadow-2xl">
                {/* Dobro do tamanho das fontes originais */}
                <span className="block text-8xl tracking-[0.5em] text-yellow-300 font-bold mb-6">HOJE</span>
                <span className="block text-[24rem] leading-[0.8] font-bold tracking-tighter pointer-events-none">{today.day}</span>
                <span className="block text-9xl font-light capitalize mt-8 opacity-80 pointer-events-none">{today.weekday.split('-')[0]}</span>
              </div>
              
              {/* Reminder Box Aumentado Proporcionalmente */}
              <div className="mt-20 w-[95%] bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden relative h-32 flex items-center shrink-0">
                 <div className="absolute left-0 top-0 bottom-0 w-3 bg-yellow-400/50"></div>
                 <div className="flex items-center gap-6 px-8 w-full">
                    <Bell size={42} className="text-yellow-400 shrink-0" />
                    <div className="flex-1 overflow-hidden">
                       {allReminders.length > 0 ? (
                         <div className="animate-fade-in" key={currentReminderIndex}>
                            <p className="text-2xl font-bold uppercase text-white/50 mb-1">{allReminders[currentReminderIndex]?.time} • {allReminders[currentReminderIndex]?.type === 'alert' ? 'Urgente' : 'Lembrete'}</p>
                            <p className="text-4xl font-medium truncate leading-tight">{allReminders[currentReminderIndex]?.text}</p>
                         </div>
                       ) : (<p className="text-2xl text-white/40 italic">Sem lembretes.</p>)}
                    </div>
                 </div>
              </div>
            </div>
        </ResizableWidget>

        <ResizableWidget 
            width={widgets.prev.width} height={widgets.prev.height} onResize={(w, h) => updateWidget('prev', { width: w, height: h })}
            locked={isLayoutLocked} position={{ x: widgets.prev.x, y: widgets.prev.y }} onPositionChange={(x, y) => updateWidget('prev', { x, y })}
        >
              <div className="flex items-center gap-4 group w-full h-full"><ArrowLeft className="text-white w-16 h-16 opacity-50 shrink-0" /> <div className="text-left drop-shadow-lg"><span className="text-lg block uppercase tracking-wider text-yellow-400 font-bold mb-1">Ontem</span><div className="leading-none"><span className="text-6xl font-bold text-white block">{yesterday.day}</span><span className="text-xl font-light text-white/70 uppercase">{yesterday.month}</span></div></div></div>
        </ResizableWidget>

        <ResizableWidget 
            width={widgets.next.width} height={widgets.next.height} onResize={(w, h) => updateWidget('next', { width: w, height: h })}
            locked={isLayoutLocked} position={{ x: widgets.next.x, y: widgets.next.y }} onPositionChange={(x, y) => updateWidget('next', { x, y })}
        >
              <div className="flex items-center gap-4 text-right group w-full h-full justify-end"><div className="text-right drop-shadow-lg"><span className="text-lg block uppercase tracking-wider text-yellow-400 font-bold mb-1">Amanhã</span><div className="leading-none"><span className="text-6xl font-bold text-white block">{tomorrow.day}</span><span className="text-xl font-light text-white/70 uppercase">{tomorrow.month}</span></div></div> <ArrowRight className="text-white w-16 h-16 opacity-50 shrink-0" /></div>
        </ResizableWidget>
      </section>

      <div className="absolute bottom-6 right-1/2 translate-x-1/2 z-50 flex gap-4">
        <button 
          onClick={() => setIsChatOpen(true)}
          className="p-4 rounded-full shadow-2xl transition-all duration-300 border bg-blue-600 border-blue-400 text-white hover:bg-blue-500 scale-100 active:scale-95"
        >
          <MessageSquare size={20} />
        </button>

        <button onClick={() => setIsLayoutLocked(!isLayoutLocked)} className={`p-4 rounded-full shadow-2xl transition-all duration-300 border ${isLayoutLocked ? 'bg-white/5 border-white/10 text-white/20 hover:text-white/50' : 'bg-yellow-500 text-black border-yellow-400 scale-110'}`}>
           {isLayoutLocked ? <Lock size={20}/> : <Edit3 size={20}/>}
        </button>
      </div>
    </main>
  );
};

export default App;