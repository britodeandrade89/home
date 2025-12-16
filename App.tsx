import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowRight, ArrowLeft, Lock, Unlock, Download, Power, Edit3, Bell, MessageSquare, Smartphone
} from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './services/firebase';
import { fetchWeatherData } from './services/weather'; 
import { processVoiceCommandAI, fetchNews, generateNewsReport, generateBeachReport } from './services/gemini';
import { Reminder, Coords, WeatherData } from './types';
import ResizableWidget from './components/ResizableWidget';
import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import ChefModal from './components/ChefModal';
import ChatModal from './components/ChatModal';
import { ErrorBoundary } from 'react-error-boundary';

// COORDENADAS FIXAS DE MARICÁ (Pedido do usuário)
const MARICA_COORDS = { lat: -22.9194, lon: -42.8186 };

// Fallback component for error boundary
function ErrorFallback({error, resetErrorBoundary}: any) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/50 p-4 text-center">
      <p className="text-red-400 font-bold mb-2">Ops! Algo deu errado.</p>
      <pre className="text-xs text-white/50 mb-4 whitespace-pre-wrap">{error.message}</pre>
      <button onClick={resetErrorBoundary} className="bg-white/10 px-4 py-2 rounded-lg text-sm hover:bg-white/20">
        Tentar Novamente
      </button>
    </div>
  );
}

const App = () => {
  // --- STATE ---
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData>({ 
    temperature: '25', weathercode: 0, is_day: 1, apparent_temperature: '27', 
    precipitation_probability: 0, wind_speed: 0, relative_humidity_2m: 70,
    daily: { time: [], weathercode: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [] },
    hourly: { time: [], temperature_2m: [], weathercode: [] }
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
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Widget Positions & Sizes
  const [widgets, setWidgets] = useState({
    clock: { width: 250, height: 120, x: 40, y: 40 },
    reminders: { width: 220, height: 800, x: 0, y: 0 }, 
    weather: { width: 220, height: 800, x: 0, y: 0 }, 
    date: { width: 500, height: 350, x: 0, y: 0 }, 
    prev: { width: 200, height: 100, x: 0, y: 0 },
    next: { width: 200, height: 100, x: 0, y: 0 },
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

  const handleInstallApp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
        setInstallPrompt(null);
        setShowInstallModal(false);
    }
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
      // SAFEGUARD: Check r[0] existence before accessing transcript
      const transcript = Array.from(event.results)
        .map((r: any) => (r && r[0] ? r[0].transcript : ''))
        .join(' ').toLowerCase();
        
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
        // SAFEGUARD: Robust checks for result structure
        if (!e.results || e.results.length === 0 || !e.results[0] || e.results[0].length === 0) return;
        
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
                  speak(`Buscando notícias sobre ${result.text}...`);
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
    
    // Configuração para colunas "fininhas" se a tela permitir, ou proporcionais
    const sidebarWidth = Math.max(200, Math.min(320, w * 0.2)); 
    
    const centerStart = sidebarWidth + 10;
    const centerWidth = w - (sidebarWidth * 2) - 20;

    setWidgets(prev => ({
        ...prev,
        // Lembretes: Cantinho Esquerdo, fino
        reminders: { 
            width: sidebarWidth - 10, 
            height: h - 20, 
            x: 10, 
            y: 10 
        },
        // Clima: Cantinho Direito, fino
        weather: { 
            width: sidebarWidth - 10, 
            height: h - 20, 
            x: w - sidebarWidth + 5, 
            y: 10
        },
        // Relógio: Topo Centro (Reduzido)
        clock: { 
            ...prev.clock, 
            width: Math.min(250, centerWidth * 0.4), 
            x: (w / 2) - (Math.min(250, centerWidth * 0.4) / 2), 
            y: 20 
        },
        // Data: Centro
        date: { 
            width: centerWidth, 
            height: h * 0.4, 
            x: centerStart, 
            y: (h / 2) - ((h * 0.4) / 2) 
        }, 
        // Navegação (Ontem/Amanhã)
        prev: { 
            ...prev.prev, 
            x: centerStart, 
            y: h - prev.prev.height - 20 
        },
        next: { 
            ...prev.next, 
            x: centerStart + centerWidth - prev.next.width, 
            y: h - prev.next.height - 20 
        }
    }));
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

    const loadWeather = async () => {
      const data = await fetchWeatherData(MARICA_COORDS);
      if (data) {
        setWeather(data);
        const bReport = await generateBeachReport(data, 'Maricá');
        setBeachReport(bReport);
      }
    };
    
    loadWeather();
    const wInterval = setInterval(loadWeather, 900000); 

    const handler = (e: any) => { 
        e.preventDefault(); 
        setInstallPrompt(e); 
        setShowInstallModal(true);
    };
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

  useEffect(() => {
    startWakeWordListener();
    return () => {
      if (wakeWordRef.current) wakeWordRef.current.stop();
      if (commandRef.current) commandRef.current.stop();
    };
  }, [startWakeWordListener]);

  const getDateInfo = (d: Date) => ({
    day: d.getDate(),
    weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).toUpperCase().replace('.', ''),
  });
  const today = getDateInfo(currentTime);
  const yesterday = getDateInfo(new Date(new Date().setDate(currentTime.getDate() - 1)));
  const tomorrow = getDateInfo(new Date(new Date().setDate(currentTime.getDate() + 1)));

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

  const getBackgroundStyle = () => {
       const code = weather?.weathercode || 0;
       const hour = currentTime.getHours();
       const isSystemNight = hour >= 18 || hour < 5;
       const isNight = weather?.is_day === 0 || isSystemNight;

       let imageId = ''; 
       let overlayColor = ''; 

       if (code >= 95) { imageId = '1605727216801-e27ce1d0cc28'; overlayColor = 'rgba(20, 0, 30, 0.6)'; }
       else if (code >= 51) { imageId = '1515694346937-94d85e41e6f0'; overlayColor = isNight ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 10, 30, 0.4)'; }
       else if (code >= 2) { 
           if (isNight) { imageId = '1536746803623-cef8708094dd'; overlayColor = 'rgba(0, 0, 0, 0.6)'; } 
           else { imageId = '1534088568595-a066f410bcda'; overlayColor = 'rgba(0, 0, 0, 0.2)'; }
       }
       else {
           if (isNight) { imageId = '1470252649378-9c2974240315'; overlayColor = 'rgba(0, 10, 40, 0.5)'; } 
           else { imageId = '1507525428034-b723cf961d3e'; overlayColor = 'rgba(0, 0, 0, 0.1)'; }
       }
       const finalUrl = `https://images.unsplash.com/photo-${imageId}?q=80&w=1920&auto=format&fit=crop`;
       return { 
         backgroundColor: '#1a1a1a',
         backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor}), url("${finalUrl}")`, 
         backgroundSize: 'cover', backgroundPosition: 'center', transition: 'background-image 1.5s ease-in-out' 
       };
  };

  const InstallPromptModal = () => (
     <div className="absolute top-8 right-8 z-[200] animate-fade-in flex flex-col items-end pointer-events-auto">
        <div className="bg-yellow-500 text-black p-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-sm border-2 border-yellow-300">
           <div className="bg-black/10 p-2 rounded-xl"><Smartphone size={24}/></div>
           <div><h3 className="font-bold text-lg leading-none mb-1">Instalar Aplicativo</h3><p className="text-xs font-semibold opacity-70">Adicione à tela inicial.</p></div>
           <button onClick={handleInstallApp} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold hover:scale-105 transition-transform">Instalar</button>
           <button onClick={(e) => { e.stopPropagation(); setShowInstallModal(false); }} className="p-1 hover:bg-black/10 rounded-full"><Lock size={14}/></button>
        </div>
     </div>
  );

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white cursor-pointer" onClick={handleStartDashboard}>
        <div className="w-20 h-20 rounded-full bg-yellow-500 animate-pulse flex items-center justify-center mb-8"><Power size={40} className="text-black" /></div>
        <h1 className="text-4xl font-bold uppercase tracking-[0.3em] mb-4 text-center px-4">Smart Home</h1>
        <p className="text-xl opacity-70 mb-8 animate-bounce">Toque para Iniciar</p>
        {showInstallModal && <button onClick={handleInstallApp} className="mt-8 bg-white/10 border border-white/20 px-6 py-3 rounded-full flex items-center gap-3 hover:bg-white/20 transition-all text-yellow-400"><Smartphone size={20} /><span className="font-bold uppercase tracking-wider text-sm">Instalar App</span></button>}
      </div>
    );
  }

  const greeting = currentTime.getHours() < 12 ? 'Bom dia' : currentTime.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <main ref={appRef} className="w-full h-screen overflow-hidden relative text-white font-sans select-none transition-all duration-1000" style={getBackgroundStyle()}>
      
      {showInstallModal && <InstallPromptModal />}

      {(isCommandMode || isProcessingAI || newsSearchMode) && (
         <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-black/80 px-6 py-3 rounded-full border border-green-500 flex items-center gap-3 animate-fade-in shadow-2xl pointer-events-none">
            <div className={`w-3 h-3 bg-green-500 rounded-full ${isProcessingAI ? 'animate-bounce' : 'animate-ping'}`} />
            <span className="text-lg font-bold uppercase tracking-widest text-green-400">{isProcessingAI ? "Processando..." : "Ouvindo..."}</span>
         </div>
      )}

      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      <section className="absolute inset-0 z-10 w-full h-full">
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            <ResizableWidget 
                width={widgets.clock.width} height={widgets.clock.height} onResize={(w, h) => updateWidget('clock', { width: w, height: h })}
                locked={isLayoutLocked} position={{ x: widgets.clock.x, y: widgets.clock.y }} onPositionChange={(x, y) => updateWidget('clock', { x, y })}
            >
                <ClockWidget currentTime={currentTime} greeting={greeting} width={widgets.clock.width} />
            </ResizableWidget>
        </ErrorBoundary>

        {/* WIDGET DE LEMBRETES (RESPONSIVO E ESCALÁVEL) */}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
            <ResizableWidget 
                width={widgets.reminders.width} height={widgets.reminders.height} onResize={(w, h) => updateWidget('reminders', { width: w, height: h })}
                locked={isLayoutLocked} position={{ x: widgets.reminders.x, y: widgets.reminders.y }} onPositionChange={(x, y) => updateWidget('reminders', { x, y })}
            >
                <div className={`w-full h-full bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden relative flex flex-col shadow-2xl transition-all duration-300 ${widgets.reminders.width < 250 ? 'p-3' : 'p-6'}`}>
                    <div className="flex items-center gap-2 text-yellow-400 mb-2 shrink-0 border-b border-white/10 pb-2">
                        <Bell size={widgets.reminders.width < 250 ? 20 : 28} />
                        <span className={`font-bold uppercase ${widgets.reminders.width < 250 ? 'text-xs tracking-wider' : 'text-lg tracking-[0.2em]'}`}>Lembretes</span>
                    </div>
                    
                    <div className="flex-1 overflow-hidden relative w-full mask-linear-gradient">
                        {allReminders.length > 0 ? (
                            <div className="w-full animate-vertical-scroll hover:pause-on-hover space-y-4">
                                {[...allReminders, ...allReminders, ...allReminders].map((reminder, idx) => (
                                    <div key={`${reminder.id}-${idx}`} className={`bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group ${widgets.reminders.width < 250 ? 'p-2' : 'p-4'}`}>
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${reminder.type === 'alert' ? 'bg-red-500' : reminder.type === 'action' ? 'bg-blue-500' : 'bg-white/20'}`}></div>
                                        <div className={`flex justify-between pl-2 mb-1 opacity-60 font-bold uppercase ${widgets.reminders.width < 250 ? 'text-[8px] flex-col' : 'text-xs'}`}>
                                            <span>{reminder.time}</span>
                                            <span className={reminder.type === 'alert' ? 'text-red-400' : reminder.type === 'action' ? 'text-blue-300' : 'text-gray-400'}>
                                                {reminder.type === 'alert' ? 'Urgente' : reminder.type === 'action' ? 'Tarefa' : 'Info'}
                                            </span>
                                        </div>
                                        <p className={`font-medium leading-tight pl-2 text-white ${widgets.reminders.width < 250 ? 'text-sm' : 'text-xl'}`}>{reminder.text}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-white/30">
                                <p className="text-sm italic">Vazio.</p>
                            </div>
                        )}
                    </div>
                </div>
            </ResizableWidget>
        </ErrorBoundary>

        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => setWeather({...weather, daily: { time: [], weathercode: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [] }})}>
            <ResizableWidget 
                width={widgets.weather.width} height={widgets.weather.height} onResize={(w, h) => updateWidget('weather', { width: w, height: h })}
                locked={isLayoutLocked} position={{ x: widgets.weather.x, y: widgets.weather.y }} onPositionChange={(x, y) => updateWidget('weather', { x, y })}
            >
                <div className="flex flex-col items-end w-full h-full relative">
                    <div className="absolute top-2 right-2 z-50">
                        <button onClick={(e) => { e.stopPropagation(); setWakeLockActive(!wakeLockActive); }} className={`p-2 rounded-full shadow-lg transition-colors flex items-center gap-2 ${wakeLockActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400 animate-pulse'}`}>
                            {wakeLockActive ? <Lock size={10} /> : <Unlock size={10}/>}
                        </button>
                    </div>
                    <WeatherWidget weather={weather} locationName={locationName} beachReport={beachReport} width={widgets.weather.width} />
                </div>
            </ResizableWidget>
        </ErrorBoundary>

        {/* DATA (ESCALÁVEL) */}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
            <ResizableWidget 
                width={widgets.date.width} height={widgets.date.height} onResize={(w, h) => updateWidget('date', { width: w, height: h })}
                locked={isLayoutLocked} position={{ x: widgets.date.x, y: widgets.date.y }} onPositionChange={(x, y) => updateWidget('date', { x, y })}
            >
                <div className="flex flex-col items-center w-full h-full justify-center overflow-hidden">
                    <div className="text-center drop-shadow-2xl flex flex-col items-center justify-center h-full w-full">
                        <span className="block font-bold mb-0 opacity-80 text-yellow-300 tracking-[0.2em]" style={{ fontSize: `${Math.min(widgets.date.width / 6, 80)}px` }}>HOJE</span>
                        <span className="block font-bold tracking-tighter pointer-events-none leading-none" style={{ fontSize: `${Math.min(widgets.date.width / 2.5, 240)}px` }}>{today.day}</span>
                        <span className="block font-light capitalize mt-0 opacity-60 pointer-events-none leading-none" style={{ fontSize: `${Math.min(widgets.date.width / 8, 70)}px` }}>{today.weekday.split('-')[0]}</span>
                    </div>
                </div>
            </ResizableWidget>
        </ErrorBoundary>

        <ResizableWidget 
            width={widgets.prev.width} height={widgets.prev.height} onResize={(w, h) => updateWidget('prev', { width: w, height: h })}
            locked={isLayoutLocked} position={{ x: widgets.prev.x, y: widgets.prev.y }} onPositionChange={(x, y) => updateWidget('prev', { x, y })}
        >
              <div className="flex items-center gap-2 group w-full h-full overflow-hidden"><ArrowLeft className="text-white opacity-30 shrink-0" size={widgets.prev.width / 5} /> <div className="text-left drop-shadow-lg"><span className="block uppercase tracking-wider text-yellow-400 font-bold mb-0" style={{fontSize: `${widgets.prev.width/15}px`}}>Ontem</span><div className="leading-none"><span className="font-bold text-white block" style={{fontSize: `${widgets.prev.width/4}px`}}>{yesterday.day}</span><span className="font-light text-white/50 uppercase" style={{fontSize: `${widgets.prev.width/10}px`}}>{yesterday.month}</span></div></div></div>
        </ResizableWidget>

        <ResizableWidget 
            width={widgets.next.width} height={widgets.next.height} onResize={(w, h) => updateWidget('next', { width: w, height: h })}
            locked={isLayoutLocked} position={{ x: widgets.next.x, y: widgets.next.y }} onPositionChange={(x, y) => updateWidget('next', { x, y })}
        >
              <div className="flex items-center gap-2 text-right group w-full h-full justify-end overflow-hidden"><div className="text-right drop-shadow-lg"><span className="block uppercase tracking-wider text-yellow-400 font-bold mb-0" style={{fontSize: `${widgets.next.width/15}px`}}>Amanhã</span><div className="leading-none"><span className="font-bold text-white block" style={{fontSize: `${widgets.next.width/4}px`}}>{tomorrow.day}</span><span className="font-light text-white/50 uppercase" style={{fontSize: `${widgets.next.width/10}px`}}>{tomorrow.month}</span></div></div> <ArrowRight className="text-white opacity-30 shrink-0" size={widgets.next.width / 5} /></div>
        </ResizableWidget>
      </section>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-4">
        <button onClick={() => setIsChatOpen(true)} className="p-4 rounded-full shadow-2xl transition-all duration-300 border bg-blue-600 border-blue-400 text-white hover:bg-blue-500 scale-100 active:scale-95"><MessageSquare size={20} /></button>
        <button onClick={() => setIsLayoutLocked(!isLayoutLocked)} className={`p-4 rounded-full shadow-2xl transition-all duration-300 border ${isLayoutLocked ? 'bg-white/5 border-white/10 text-white/20 hover:text-white/50' : 'bg-yellow-500 text-black border-yellow-400 scale-110'}`}>{isLayoutLocked ? <Lock size={20}/> : <Edit3 size={20}/>}</button>
      </div>
    </main>
  );
};

export default App;