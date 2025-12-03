import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowRight, ArrowLeft, Bell, ChefHat, Plus, Lock, Unlock, Download, Newspaper, Activity
} from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './services/firebase';
import { fetchWeatherData } from './services/weather';
import { processVoiceCommandAI, fetchNews } from './services/gemini';
import { Reminder, NewsData, Coords, WeatherData } from './types';
import ResizableWidget from './components/ResizableWidget';
import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import NewsWidget from './components/NewsWidget';
import ChefModal from './components/ChefModal';

const App = () => {
  // State: Time & Location
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData>({ temperature: '25', weathercode: 0, is_day: 1, apparent_temperature: '27', precipitation_probability: 0 });
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationName, setLocationName] = useState('Localizando...');
  
  // State: Data
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newReminderText, setNewReminderText] = useState('');
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newsData, setNewsData] = useState<NewsData>({ 
    politica: [{ text: "Carregando...", time: "--:--", img: "" }], 
    esportes: [{ text: "Carregando...", time: "--:--", img: "" }], 
    cultura: [{ text: "Carregando...", time: "--:--", img: "" }] 
  });
  const [newsIndexP, setNewsIndexP] = useState(0);
  const [newsIndexE, setNewsIndexE] = useState(0);
  const [newsIndexC, setNewsIndexC] = useState(0);

  // State: System
  const [isFirebaseAvailable, setIsFirebaseAvailable] = useState(true);
  
  // State: UI
  const [greeting, setGreeting] = useState('Bem-vindo');
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [sidebarSplit, setSidebarSplit] = useState(0.5);
  const [isChefOpen, setIsChefOpen] = useState(false);
  
  // State: Voice
  const [isCommandMode, setIsCommandMode] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  // State: Widget Scales
  const [scaleTL, setScaleTL] = useState(1);
  const [scaleTR, setScaleTR] = useState(1);
  const [scaleCenter, setScaleCenter] = useState(1);
  const [scaleBL, setScaleBL] = useState(1);
  const [scaleBR, setScaleBR] = useState(1);
  
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Refs
  const sidebarRef = useRef<HTMLElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const isResizingWidth = useRef(false);
  const isResizingHeight = useRef(false);
  const wakeWordRef = useRef<any>(null);
  const commandRef = useRef<any>(null);

  // --- Helpers ---
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.1;
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt-PT'));
      if (ptVoice) utterance.voice = ptVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

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
    // Try Firebase first if available
    if (db && isFirebaseAvailable) {
      try {
        await addDoc(collection(db, "smart_home_reminders"), {
          text,
          type,
          createdAt: serverTimestamp(),
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });
      } catch (e) { 
        console.warn("Firestore save failed, switching to local:", e);
        setIsFirebaseAvailable(false);
        saveLocalReminder(text, type);
      }
    } else {
      // Fallback to LocalStorage
      saveLocalReminder(text, type);
    }
  };

  // --- Voice Logic ---
  const startWakeWordListener = useCallback(() => {
    if (!window.webkitSpeechRecognition) return;
    if (wakeWordRef.current) wakeWordRef.current.stop();
    if (commandRef.current) commandRef.current.stop();

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript).join(' ').toLowerCase();
      
      const lastSlice = transcript.slice(-40);
      if (lastSlice.includes('smart home') || lastSlice.includes('ok smart')) {
        recognition.stop();
        startCommandListener();
      }
    };

    recognition.onend = () => {
      if (!isCommandMode && !isChefOpen) {
        try { recognition.start(); } catch (e) {}
      }
    };

    wakeWordRef.current = recognition;
    try { recognition.start(); } catch (e) {}
  }, [isCommandMode, isChefOpen]);

  const startCommandListener = useCallback(() => {
    setIsCommandMode(true);
    speak("Estou ouvindo.");

    setTimeout(() => {
      const cmd = new window.webkitSpeechRecognition();
      cmd.continuous = false;
      cmd.interimResults = false;
      cmd.lang = 'pt-BR';

      cmd.onresult = async (e: any) => {
        const command = e.results[0][0].transcript;
        setIsProcessingAI(true);
        
        const result = await processVoiceCommandAI(command);

        if (result) {
          if (result.action === 'add_reminder' && result.text) {
             await addReminderToDB(result.text, result.type || 'info');
             speak(`Lembrete adicionado: ${result.text}`);
          } else if (result.response) {
             speak(result.response);
          }
        } else {
          speak("Não entendi o comando.");
        }

        setIsProcessingAI(false);
      };

      cmd.onerror = () => {
        speak("Não entendi.");
        setIsCommandMode(false);
        startWakeWordListener();
      };

      cmd.onend = () => {
         setIsCommandMode(false);
         startWakeWordListener();
      };
      
      commandRef.current = cmd;
      cmd.start();
    }, 1200);
  }, [startWakeWordListener, isFirebaseAvailable, reminders]); // Added deps to ensure state freshness in closure

  // --- Effects ---

  useEffect(() => {
    // Clock
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const h = now.getHours();
      const g = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
      setGreeting(g);
    }, 1000);

    // Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLocationName("Local Atual"); 
        },
        (err) => console.warn("GPS erro", err)
      );
    }

    // Install Prompt
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Initial Data Load (Hybrid: Firebase + LocalStorage Fallback)
    let unsub: (() => void) | undefined;

    if (db) {
      try {
        const q = query(collection(db, "smart_home_reminders"), orderBy("createdAt", "desc"));
        unsub = onSnapshot(q, (snapshot) => {
          setReminders(snapshot.docs.map(doc => ({ 
              id: doc.id, 
              ...doc.data(), 
              time: doc.data().time || '--:--', 
              type: (doc.data().type || 'info') as 'info'|'alert'|'action' 
          } as Reminder)));
          setIsFirebaseAvailable(true);
        }, (error) => {
          console.error("Firestore blocked or failed, using local storage.", error);
          setIsFirebaseAvailable(false);
        });
      } catch (e) {
         console.error("Firestore init error", e);
         setIsFirebaseAvailable(false);
      }
    } else {
      setIsFirebaseAvailable(false);
    }

    return () => { if (unsub) unsub(); clearInterval(timer); window.removeEventListener('beforeinstallprompt', handler); };
  }, []);

  // Separate Effect for Offline/Local Mode
  useEffect(() => {
    if (!isFirebaseAvailable) {
      const localData = localStorage.getItem('local_reminders');
      if (localData) {
        try {
          setReminders(JSON.parse(localData));
        } catch (e) {
          console.error("Error parsing local reminders", e);
        }
      }
    }
  }, [isFirebaseAvailable]);

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

  // Wake Word Init
  useEffect(() => {
    startWakeWordListener();
    return () => {
      if (wakeWordRef.current) wakeWordRef.current.stop();
      if (commandRef.current) commandRef.current.stop();
    };
  }, [startWakeWordListener]);

  // News Data & Rotation with Real-time Fetch
  useEffect(() => {
    let mounted = true;

    const updateNews = async () => {
       const getCategoryNews = async (categoryTerm: string, seed: number) => {
            try {
              const headlines = await fetchNews(categoryTerm);
              if (!mounted) return [];
              if (headlines.length === 0) return [{ text: "Sem notícias recentes.", time: "--:--", img: `https://picsum.photos/150/150?random=${seed}` }];
              
              return headlines.map((h, i) => ({
                  text: h,
                  time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                  img: `https://picsum.photos/150/150?random=${seed + i}`
              }));
            } catch (e) {
              console.error(e);
              return [{ text: "Erro ao atualizar.", time: "--:--", img: `https://picsum.photos/150/150?random=${seed}` }];
            }
       };

       const [p, e, c] = await Promise.all([
            getCategoryNews('Política Brasileira', 101),
            getCategoryNews('Esportes Brasil', 202),
            getCategoryNews('Cultura e Entretenimento Brasil', 303)
       ]);
       
       if (mounted) {
         setNewsData({ politica: p, esportes: e, cultura: c });
       }
    };

    updateNews(); // Initial fetch
    const newsInterval = setInterval(updateNews, 1800000); // Update every 30 minutes

    // Visual Rotation Logic
    const t1 = setInterval(() => setNewsIndexP(i => {
       // Safe rotation based on current data length
       const len = newsData.politica?.length || 1;
       return (i + 1) % len;
    }), 10000);
    
    const t2 = setTimeout(() => {
      if(!mounted) return;
      setInterval(() => setNewsIndexE(i => {
         const len = newsData.esportes?.length || 1;
         return (i + 1) % len;
      }), 10000);
    }, 2000);

    const t3 = setTimeout(() => {
      if(!mounted) return;
      setInterval(() => setNewsIndexC(i => {
         const len = newsData.cultura?.length || 1;
         return (i + 1) % len;
      }), 10000);
    }, 4000);

    return () => { 
        mounted = false;
        clearInterval(newsInterval); 
        clearInterval(t1); 
        clearTimeout(t2); 
        clearTimeout(t3); 
    };
  }, []); // Only run on mount, internal logic handles updates

  // Resize Logic
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      if (isResizingWidth.current && appRef.current) {
        const newWidth = appRef.current.getBoundingClientRect().right - clientX;
        setSidebarWidth(Math.max(250, Math.min(600, newWidth)));
      }
      if (isResizingHeight.current && sidebarRef.current) {
        const rect = sidebarRef.current.getBoundingClientRect();
        const newSplit = (clientY - rect.top) / rect.height;
        setSidebarSplit(Math.max(0.2, Math.min(0.8, newSplit)));
      }
    };

    const handleUp = () => {
      isResizingWidth.current = false;
      isResizingHeight.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, []);

  // Wake Lock
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
        } catch (e) { setWakeLockActive(false); }
      }
    };
    document.addEventListener('click', requestWakeLock);
    return () => document.removeEventListener('click', requestWakeLock);
  }, []);

  // --- Handlers ---
  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;
    await addReminderToDB(newReminderText);
    setNewReminderText('');
    setShowAddReminder(false);
  };

  const handleInstallApp = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choice: any) => {
      if (choice.outcome === 'accepted') setInstallPrompt(null);
    });
  };

  // --- Render Data Helpers ---
  const getDateInfo = (d: Date) => ({
    day: d.getDate(),
    weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d),
  });
  const today = getDateInfo(currentTime);
  const yesterday = getDateInfo(new Date(new Date().setDate(currentTime.getDate() - 1)));
  const tomorrow = getDateInfo(new Date(new Date().setDate(currentTime.getDate() + 1)));

  // Mock Cyclical Reminders
  const getCyclicalReminders = (): Reminder[] => {
    const day = currentTime.getDay();
    const hour = currentTime.getHours();
    const list: Reminder[] = [];

    if (day === 1 && hour >= 19) list.push({ type: 'alert', text: "Marmitas: André não tem aula amanhã.", time: "19:00", id: 'c1' });
    if (day === 2) {
      list.push({ type: 'action', text: "Terapia da Marcelly", time: "Dia", id: 'c2' });
      list.push({ type: 'action', text: "Terapia do André", time: "Dia", id: 'c3' });
    }
    
    return list;
  };
  const allReminders = [...getCyclicalReminders(), ...reminders];

  const getBackgroundStyle = () => {
     // Using Picsum for background
     const img = weather.is_day 
       ? 'https://picsum.photos/1920/1080?grayscale&blur=2' 
       : 'https://picsum.photos/1920/1080?grayscale&blur=4';
     return { backgroundImage: `url("${img}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
  };

  return (
    <main ref={appRef} className="w-full h-screen overflow-hidden relative text-white font-sans flex select-none" style={getBackgroundStyle()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0" />
      
      {/* Voice Overlay */}
      {(isCommandMode || isProcessingAI) && (
         <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-black/80 px-6 py-3 rounded-full border border-green-500 flex items-center gap-3 animate-fade-in shadow-2xl shadow-green-900/50">
            <div className={`w-3 h-3 bg-green-500 rounded-full ${isProcessingAI ? 'animate-bounce' : 'animate-ping'}`} />
            <span className="text-lg font-bold uppercase tracking-widest text-green-400">
              {isProcessingAI ? "Processando..." : "Ouvindo..."}
            </span>
         </div>
      )}

      {/* LEFT SECTION (Main) */}
      <section className="flex-1 relative z-10 flex flex-col justify-between p-8">
        <div className="flex justify-between items-start">
          <ResizableWidget scale={scaleTL} onScaleChange={setScaleTL} origin="top left">
             <ClockWidget currentTime={currentTime} greeting={greeting} />
          </ResizableWidget>

          <div className="flex flex-col items-end gap-4">
            <div className="flex gap-2">
              {installPrompt && <button onClick={handleInstallApp} className="bg-white/10 hover:bg-white/20 p-3 rounded-full backdrop-blur-md transition-colors"><Download size={20} /></button>}
              <button 
                onClick={() => setIsChefOpen(true)} 
                className="bg-gradient-to-r from-yellow-500 to-orange-500 p-3 rounded-full shadow-lg hover:scale-110 transition-transform active:scale-95"
              >
                 <ChefHat className="text-white" />
              </button>
            </div>
            <ResizableWidget scale={scaleTR} onScaleChange={setScaleTR} origin="top right">
               <WeatherWidget weather={weather} locationName={locationName} />
            </ResizableWidget>
          </div>
        </div>

        {/* CENTER DATE */}
        <div className="flex justify-center items-center">
          <ResizableWidget scale={scaleCenter} onScaleChange={setScaleCenter} origin="center">
            <div className="text-center drop-shadow-2xl">
               <span className="block text-2xl tracking-[0.5em] text-yellow-300 font-bold mb-2">HOJE</span>
               <span className="block text-[10rem] leading-[0.8] font-bold tracking-tighter">{today.day}</span>
               <span className="block text-4xl font-light capitalize mt-4 opacity-80">
                 {today.weekday.split('-')[0]}
               </span>
            </div>
          </ResizableWidget>
        </div>
        
        {/* FOOTER */}
        <div className="flex justify-between items-end opacity-70">
           <ResizableWidget scale={scaleBL} onScaleChange={setScaleBL} origin="bottom left">
              <div className="flex items-center gap-2 hover:opacity-100 transition-opacity">
                <ArrowLeft className="text-white/50" /> 
                <div className="text-left">
                  <span className="text-xs block uppercase tracking-wider text-white/50">Ontem</span>
                  <span className="text-2xl font-medium">{yesterday.day}</span>
                </div>
              </div>
           </ResizableWidget>
           <ResizableWidget scale={scaleBR} onScaleChange={setScaleBR} origin="bottom right">
              <div className="flex items-center gap-2 text-right hover:opacity-100 transition-opacity">
                <div className="text-right">
                  <span className="text-xs block uppercase tracking-wider text-white/50">Amanhã</span>
                  <span className="text-2xl font-medium">{tomorrow.day}</span>
                </div> 
                <ArrowRight className="text-white/50" />
              </div>
           </ResizableWidget>
        </div>
      </section>

      {/* RESIZER HANDLE */}
      <div 
        className="w-4 relative z-50 cursor-col-resize flex items-center justify-center hover:bg-white/10 transition-colors group"
        onMouseDown={(e) => { e.preventDefault(); isResizingWidth.current = true; }}
        onTouchStart={(e) => { e.preventDefault(); isResizingWidth.current = true; }}
      >
         <div className="w-1 h-16 bg-white/20 rounded-full group-hover:bg-yellow-400 transition-colors" />
      </div>

      {/* SIDEBAR */}
      <aside ref={sidebarRef} style={{ width: sidebarWidth }} className="relative z-20 bg-black/60 backdrop-blur-2xl border-l border-white/10 flex flex-col shadow-2xl h-full">
         
         {/* Top Section: Reminders */}
         <div className="flex-1 flex flex-col border-b border-white/10 overflow-hidden relative" style={{ height: `${sidebarSplit * 100}%` }}>
            <div className="p-6 flex items-center justify-between bg-white/5 z-10 backdrop-blur-md">
               <div className="flex items-center gap-2 text-yellow-300">
                 <Bell size={20} /> 
                 <span className="font-bold tracking-widest text-sm">LEMBRETES</span>
               </div>
               <div className="flex gap-3 items-center">
                  <div title={isFirebaseAvailable ? "Online" : "Offline (Local)"} className={isFirebaseAvailable ? "text-green-500" : "text-red-500"}>
                    <Activity size={16} />
                  </div>
                  <div 
                    onClick={() => { if(!wakeLockActive) { /* Trigger wake lock request via effect */ } }}
                    title={wakeLockActive ? "Tela Ativa" : "Toque para ativar"} 
                    className="text-white/50 cursor-pointer hover:text-white"
                  >
                    {wakeLockActive ? <Lock size={16} className="text-green-400"/> : <Unlock size={16}/>}
                  </div>
                  <button onClick={() => setShowAddReminder(!showAddReminder)} className="hover:text-yellow-400 transition-colors"><Plus size={20}/></button>
               </div>
            </div>
            
            {showAddReminder && (
              <form onSubmit={handleAddReminder} className="px-6 py-3 animate-fade-in flex gap-2 bg-white/5">
                 <input 
                   autoFocus 
                   value={newReminderText} 
                   onChange={e => setNewReminderText(e.target.value)} 
                   className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" 
                   placeholder="Novo lembrete..." 
                 />
                 <button className="bg-yellow-500 text-black px-4 rounded font-bold hover:bg-yellow-400">→</button>
              </form>
            )}

            <div className="flex-1 overflow-hidden relative pause-on-hover">
               <div className="absolute top-0 left-0 w-full p-6 flex flex-col gap-3 animate-vertical-scroll">
                  {/* Duplicate list for seamless scrolling */}
                  {[...allReminders, ...allReminders].map((r, i) => (
                     <div key={`${r.id}-${i}`} className={`p-4 rounded-xl border backdrop-blur-sm transition-colors hover:bg-white/10 ${r.type === 'alert' ? 'bg-red-500/20 border-red-500/30' : 'bg-white/5 border-white/5'}`}>
                        <div className="flex justify-between text-[10px] opacity-70 mb-1 font-bold uppercase tracking-wider">
                           <span className={r.type === 'alert' ? 'text-red-300' : 'text-white/50'}>
                             {r.type === 'alert' ? 'Urgente' : r.type === 'action' ? 'Tarefa' : 'Info'}
                           </span>
                           <span>{r.time}</span>
                        </div>
                        <p className="text-lg font-light leading-snug">{r.text}</p>
                     </div>
                  ))}
                  {allReminders.length === 0 && <p className="text-center opacity-30 mt-10">Sem lembretes ativos.</p>}
               </div>
            </div>
         </div>

         {/* Splitter Handle */}
         <div 
            className="h-4 cursor-row-resize flex items-center justify-center hover:bg-white/10 -my-2 z-50 relative group" 
            onMouseDown={(e) => { e.preventDefault(); isResizingHeight.current = true; document.body.style.cursor = 'row-resize'; }}
            onTouchStart={(e) => { e.preventDefault(); isResizingHeight.current = true; }}
         >
             <div className="w-12 h-1 bg-white/20 rounded-full group-hover:bg-yellow-400 transition-colors" />
         </div>

         {/* Bottom Section: News */}
         <div className="flex-1 p-6 flex flex-col overflow-hidden bg-black/20">
            <div className="flex items-center gap-2 mb-4 text-blue-300">
              <Newspaper size={20} /> 
              <span className="font-bold tracking-widest text-sm">NOTÍCIAS</span>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto hide-scrollbar pb-20">
               <NewsWidget category="Política" color="bg-blue-500" data={newsData.politica} index={newsIndexP} />
               <NewsWidget category="Esportes" color="bg-green-500" data={newsData.esportes} index={newsIndexE} />
               <NewsWidget category="Cultura" color="bg-purple-500" data={newsData.cultura} index={newsIndexC} />
            </div>
         </div>
      </aside>

      <ChefModal isOpen={isChefOpen} onClose={() => setIsChefOpen(false)} />
    </main>
  );
};

export default App;