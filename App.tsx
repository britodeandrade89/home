import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowRight, ArrowLeft, Bell, Plus, Lock, Unlock, Download, Newspaper, Activity, Power, ChefHat
} from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from './services/firebase';
import { fetchWeatherData } from './services/weather';
import { processVoiceCommandAI, fetchNews, generateNewsReport } from './services/gemini';
import { Reminder, NewsData, Coords, WeatherData } from './types';
import ResizableWidget from './components/ResizableWidget';
import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import NewsWidget from './components/NewsWidget';
import ChefModal from './components/ChefModal';
import ReminderItem from './components/ReminderItem';

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
  const [hasStarted, setHasStarted] = useState(false); // To force user interaction for wake lock
  
  // State: UI
  const [greeting, setGreeting] = useState('Bem-vindo');
  const [sidebarWidth, setSidebarWidth] = useState(100);
  const [sidebarSplit, setSidebarSplit] = useState(0.5);
  const [isChefOpen, setIsChefOpen] = useState(false);
  
  // State: Voice
  const [isCommandMode, setIsCommandMode] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [newsSearchMode, setNewsSearchMode] = useState(false);
  
  // SIDEBAR CONSTANT
  const SIDEBAR_WIDTH_INITIAL = 100;

  // State: Widget Scales & Positions
  // Logic updated to ensure widgets are visible on Tablets
  const [widgets, setWidgets] = useState({
    clock: { scale: 1, x: 40, y: 40 },
    // Position Weather to the left of the sidebar with some padding
    weather: { scale: 1, x: window.innerWidth - SIDEBAR_WIDTH_INITIAL - 350, y: 40 }, 
    date: { scale: 1, x: (window.innerWidth - SIDEBAR_WIDTH_INITIAL) / 2 - 150, y: window.innerHeight / 2 - 150 },
    prev: { scale: 1, x: 40, y: window.innerHeight - 200 },
    // Position Next relative to sidebar
    next: { scale: 1, x: window.innerWidth - SIDEBAR_WIDTH_INITIAL - 350, y: window.innerHeight - 200 },
  });
  
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
      const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt-PT'));
      if (ptVoice) utterance.voice = ptVoice;
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
        console.warn("Wake Lock failed", e);
      }
    }
  };

  const handleStartDashboard = () => {
    setHasStarted(true);
    requestWakeLock();
    // Try to enter fullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } catch(e) {}
  };

  // --- DATA OPERATIONS ---
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
    // 1. Optimistic Update
    const newReminders = reminders.filter(r => r.id !== id);
    setReminders(newReminders);
    localStorage.setItem('local_reminders', JSON.stringify(newReminders));

    // 2. Firebase Delete
    if (db && isFirebaseAvailable) {
      try {
        if (isNaN(Number(id))) {
            await deleteDoc(doc(db, "smart_home_reminders", id));
        }
      } catch (e) {
        console.error("Error deleting from DB", e);
      }
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
      
      // Updated Wake Word Logic: "Olá Smart Home"
      if (lastSlice.includes('olá smart home') || lastSlice.includes('ola smart home')) {
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
    if (!newsSearchMode) {
      speak("Estou ouvindo.");
    }

    setTimeout(() => {
      const cmd = new window.webkitSpeechRecognition();
      cmd.continuous = false;
      cmd.interimResults = false;
      cmd.lang = 'pt-BR';

      cmd.onresult = async (e: any) => {
        const command = e.results[0][0].transcript;
        setIsProcessingAI(true);
        
        if (newsSearchMode) {
           const allNews = [...newsData.politica, ...newsData.esportes, ...newsData.cultura];
           const lowerCmd = command.toLowerCase();
           const match = allNews.find(n => n.text.toLowerCase().includes(lowerCmd) || lowerCmd.includes(n.text.toLowerCase().split(' ')[0]));
           
           if (match) {
             speak("Encontrei. Lendo reportagem...", 1.1);
             const report = await generateNewsReport(match.text);
             speak(report, 1.25);
           } else {
             speak("Não encontrei essa notícia na lista atual.", 1.1);
           }
           setNewsSearchMode(false);
        } 
        else {
          const result = await processVoiceCommandAI(command);

          if (result) {
            if (result.action === 'read_news_init') {
              setNewsSearchMode(true);
              speak(result.response || "Qual notícia?");
            }
            else if (result.action === 'add_reminder' && result.text) {
               await addReminderToDB(result.text, result.type || 'info');
               speak(`Lembrete adicionado: ${result.text}`);
            } else if (result.response) {
               speak(result.response);
            }
          } else {
            speak("Não entendi o comando.");
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
         if (newsSearchMode) {
            startCommandListener();
         } else {
            startWakeWordListener();
         }
      };
      
      commandRef.current = cmd;
      cmd.start();
    }, 1200);
  }, [startWakeWordListener, isFirebaseAvailable, reminders, newsSearchMode, newsData]); 

  // --- Effects ---

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const h = now.getHours();
      setGreeting(h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');
    }, 1000);

    // Dynamic resize handler to keep widgets on screen
    const handleResize = () => {
        // Safe width calculation (subtract sidebar)
        const safeWidth = window.innerWidth - sidebarWidth;
        const safeHeight = window.innerHeight;

        setWidgets(prev => ({
            ...prev,
            // Anchor Weather to right edge of Safe Area with Clamp
            weather: { 
              ...prev.weather, 
              x: Math.min(safeWidth - 380, Math.max(20, safeWidth - 380)) 
            },
            // Anchor Next to bottom-right of Safe Area with Clamp
            next: { 
              ...prev.next, 
              x: Math.min(safeWidth - 350, Math.max(20, safeWidth - 350)),
              y: safeHeight - 200 
            },
            prev: { ...prev.prev, x: 40, y: safeHeight - 200 },
            date: { ...prev.date, x: safeWidth / 2 - 150, y: safeHeight / 2 - 150 }
        }));
    };
    
    // Call once on mount to fix initial positions
    handleResize();
    
    window.addEventListener('resize', handleResize);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLocationName("Local Atual"); 
        },
        (err) => console.warn("GPS erro", err)
      );
    }

    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

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
         setIsFirebaseAvailable(false);
      }
    } else {
      setIsFirebaseAvailable(false);
    }

    return () => { if (unsub) unsub(); clearInterval(timer); window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('resize', handleResize); };
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isFirebaseAvailable) {
      const localData = localStorage.getItem('local_reminders');
      if (localData) {
        try { setReminders(JSON.parse(localData)); } catch (e) {}
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

  useEffect(() => {
    startWakeWordListener();
    return () => {
      if (wakeWordRef.current) wakeWordRef.current.stop();
      if (commandRef.current) commandRef.current.stop();
    };
  }, [startWakeWordListener]);

  useEffect(() => {
    let mounted = true;
    const updateNews = async () => {
       const getCategoryNews = async (categoryTerm: string, seed: number) => {
            try {
              const headlines = await fetchNews(categoryTerm);
              if (!mounted) return [];
              // Use fallback inside fetchNews if possible, but double check here
              const finalHeadlines = headlines.length > 0 ? headlines : ["Sem notícias recentes.", "Verifique a conexão."];
              
              return finalHeadlines.map((h, i) => ({
                  text: h,
                  time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                  img: `https://picsum.photos/150/150?random=${seed + i}`
              }));
            } catch (e) {
              return [{ text: "Erro ao atualizar.", time: "--:--", img: `https://picsum.photos/150/150?random=${seed}` }];
            }
       };

       const [p, e, c] = await Promise.all([
            getCategoryNews('Política Brasileira', 101),
            getCategoryNews('Esportes Brasil', 202),
            getCategoryNews('Cultura e Entretenimento Brasil', 303)
       ]);
       if (mounted) setNewsData({ politica: p, esportes: e, cultura: c });
    };

    updateNews();
    const newsInterval = setInterval(updateNews, 1800000); 

    const t1 = setInterval(() => setNewsIndexP(i => (i + 1) % (newsData.politica?.length || 1)), 10000);
    const t2 = setTimeout(() => { if(mounted) setInterval(() => setNewsIndexE(i => (i + 1) % (newsData.esportes?.length || 1)), 10000); }, 2000);
    const t3 = setTimeout(() => { if(mounted) setInterval(() => setNewsIndexC(i => (i + 1) % (newsData.cultura?.length || 1)), 10000); }, 4000);

    return () => { mounted = false; clearInterval(newsInterval); clearInterval(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); 

  // Side bar resize
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      if (isResizingWidth.current && appRef.current) {
        const newWidth = appRef.current.getBoundingClientRect().right - clientX;
        const boundedWidth = Math.max(80, Math.min(600, newWidth));
        setSidebarWidth(boundedWidth);
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

  // Handlers
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

    // Segunda (1) a partir das 19h ATÉ Terça (2) 23:59
    if ((day === 1 && hour >= 19) || day === 2) {
        list.push({ 
          type: 'alert', 
          text: "Terças o André não vai pra escola - Marcelly não precisa agilizar marmitas se não quiser", 
          time: "Aviso", 
          id: 'auto_1' 
        });
    }

    // Terças-feiras (2)
    if (day === 2) {
      list.push({ type: 'action', text: "Marcelly tem terapia", time: "Dia todo", id: 'auto_2' });
      list.push({ type: 'action', text: "André tem terapia", time: "Dia todo", id: 'auto_3' });
      list.push({ type: 'info', text: "Terapia da familia Bispo", time: "Dia todo", id: 'auto_4' });
      list.push({ type: 'action', text: "Volei do André - Ir de carona, saindo às 16h40", time: "16:40", id: 'auto_5' });
    }

    // Quartas-feiras (3)
    if (day === 3) {
      list.push({ type: 'action', text: "Quartas é dia de volei no Clério", time: "Noite", id: 'auto_6' });
    }

    return list;
  };
  const allReminders = [...getCyclicalReminders(), ...reminders];

  const getBackgroundStyle = () => {
     const code = weather.weathercode;
     const isDay = weather.is_day === 1;
     
     // USE STATIC UNSPLASH IMAGES TO AVOID CERTIFICATE ERRORS
     let imgUrl = 'https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?q=80&w=1920&auto=format&fit=crop'; // Default Sunny
     
     if (code === 0 || code === 1) {
        // Clear
        imgUrl = isDay 
          ? 'https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?q=80&w=1920&auto=format&fit=crop' 
          : 'https://images.unsplash.com/photo-1506765515384-028b60a970df?q=80&w=1920&auto=format&fit=crop';
     } else if (code >= 2 && code <= 48) {
        // Cloudy/Fog
        imgUrl = isDay
          ? 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?q=80&w=1920&auto=format&fit=crop'
          : 'https://images.unsplash.com/photo-1536746803623-cef8708094dd?q=80&w=1920&auto=format&fit=crop';
     } else if (code >= 51 && code <= 67) {
        // Rain
        imgUrl = 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=1920&auto=format&fit=crop';
     } else if (code >= 80) {
        // Storm
        imgUrl = 'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?q=80&w=1920&auto=format&fit=crop';
     }
     
     return { 
       backgroundImage: `url("${imgUrl}")`, 
       backgroundSize: 'cover', 
       backgroundPosition: 'center', 
       transition: 'background-image 1s ease-in-out' 
     };
  };

  // --- START SCREEN OVERLAY ---
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
        <div className="flex gap-4 text-sm opacity-50 mb-12">
           <div className="flex items-center gap-2"><Lock size={14}/> Tela sempre ativa</div>
           <div className="flex items-center gap-2"><Activity size={14}/> Comandos de Voz</div>
        </div>
        
        <div className="text-[10px] text-white/30 text-center tracking-wider">
           <p>Desenvolvido por: André Brito ®</p>
           <p>Versão: 1.0 • Contato: britodeandrade@gmail.com | +55 21 994 527 694</p>
        </div>
      </div>
    );
  }

  return (
    <main ref={appRef} className="w-full h-screen overflow-hidden relative text-white font-sans flex select-none transition-all duration-1000" style={getBackgroundStyle()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
      
      {/* Voice Overlay */}
      {(isCommandMode || isProcessingAI || newsSearchMode) && (
         <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-black/80 px-6 py-3 rounded-full border border-green-500 flex items-center gap-3 animate-fade-in shadow-2xl shadow-green-900/50 pointer-events-none">
            <div className={`w-3 h-3 bg-green-500 rounded-full ${isProcessingAI ? 'animate-bounce' : 'animate-ping'}`} />
            <span className="text-lg font-bold uppercase tracking-widest text-green-400">
              {isProcessingAI ? "Processando..." : newsSearchMode ? "Qual notícia?" : "Ouvindo..."}
            </span>
         </div>
      )}

      {/* DRAGGABLE MAIN AREA */}
      <section className="flex-1 relative z-10 w-full h-full overflow-hidden">
        
        {/* WIDGETS */}
        <ResizableWidget 
            scale={widgets.clock.scale} 
            onScaleChange={(s) => updateWidget('clock', { scale: s })} 
            position={{ x: widgets.clock.x, y: widgets.clock.y }}
            onPositionChange={(x, y) => updateWidget('clock', { x, y })}
        >
             <ClockWidget currentTime={currentTime} greeting={greeting} />
        </ResizableWidget>

        <ResizableWidget 
            scale={widgets.weather.scale} 
            onScaleChange={(s) => updateWidget('weather', { scale: s })} 
            position={{ x: widgets.weather.x, y: widgets.weather.y }}
            onPositionChange={(x, y) => updateWidget('weather', { x, y })}
        >
           <div className="flex flex-col items-end">
             <div className="flex gap-2 mb-2">
                {installPrompt && (
                    <button onClick={(e) => { e.stopPropagation(); handleInstallApp(); }} className="bg-green-500 hover:bg-green-400 text-black p-2 rounded-full shadow-lg animate-pulse">
                        <Download size={20} />
                    </button>
                )}
                {/* Chef Button Removed */}
              </div>
              <WeatherWidget weather={weather} locationName={locationName} />
           </div>
        </ResizableWidget>

        <ResizableWidget 
            scale={widgets.date.scale} 
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

        <ResizableWidget 
            scale={widgets.prev.scale} 
            onScaleChange={(s) => updateWidget('prev', { scale: s })}
            position={{ x: widgets.prev.x, y: widgets.prev.y }}
            onPositionChange={(x, y) => updateWidget('prev', { x, y })}
        >
              <div className="flex items-center gap-4 group">
                <ArrowLeft className="text-white w-16 h-16 group-hover:-translate-x-2 transition-transform" /> 
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
                <ArrowRight className="text-white w-16 h-16 group-hover:translate-x-2 transition-transform" />
              </div>
        </ResizableWidget>

        {/* FOOTER */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white/30 text-center tracking-wider pointer-events-none z-0">
           <p>Desenvolvido por: André Brito ®</p>
           <p>Versão: 1.0 • Contato: britodeandrade@gmail.com | +55 21 994 527 694</p>
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
      <aside ref={sidebarRef} style={{ width: sidebarWidth }} className="relative z-20 bg-black/60 backdrop-blur-2xl border-l border-white/10 flex flex-col shadow-2xl h-full transition-all duration-300">
         {/* Lembretes */}
         <div className="flex-1 flex flex-col border-b border-white/10 overflow-hidden relative" style={{ height: `${sidebarSplit * 100}%` }}>
            <div className="p-6 flex items-center justify-between bg-black/40 backdrop-blur-md z-10 border-b border-white/5">
               <div className="flex items-center gap-2 text-yellow-400"><Bell size={20} /> <span className="font-bold tracking-widest text-sm">LEMBRETES</span></div>
               <div className="flex gap-3">
                  <button 
                    onClick={() => setWakeLockActive(!wakeLockActive)} 
                    title={wakeLockActive ? "Tela Sempre Ativa" : "Tela Pode Desligar"} 
                    className={`transition-colors ${wakeLockActive ? 'text-green-400' : 'text-white/30'}`}
                  >
                    {wakeLockActive ? <Lock size={18} /> : <Unlock size={18}/>}
                  </button>
                  <button onClick={() => setShowAddReminder(!showAddReminder)} className="text-white hover:text-yellow-400 transition-colors"><Plus size={20}/></button>
               </div>
            </div>
            
            {showAddReminder && (
              <form onSubmit={handleAddReminder} className="p-4 bg-white/5 animate-fade-in flex gap-2 border-b border-white/5">
                 <input 
                    autoFocus 
                    value={newReminderText} 
                    onChange={e => setNewReminderText(e.target.value)} 
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" 
                    placeholder="Novo lembrete..." 
                 />
                 <button className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 rounded-lg font-bold transition-colors">→</button>
              </form>
            )}

            <div className="flex-1 overflow-hidden relative pause-on-hover bg-gradient-to-b from-transparent to-black/20">
               <div className="absolute top-0 left-0 w-full p-4 flex flex-col gap-3">
                  <div className="text-xs text-center mb-2 opacity-30 uppercase tracking-widest">Deslize para remover</div>
                  {allReminders.map((r, i) => (
                    <ReminderItem 
                      key={`${r.id}-${i}`} 
                      reminder={r} 
                      onDelete={deleteReminder} 
                    />
                  ))}
                  {allReminders.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-40 text-white/30">
                          <Activity size={32} className="mb-2 opacity-50"/>
                          <p className="text-sm">Sem lembretes ativos.</p>
                      </div>
                  )}
               </div>
            </div>
         </div>

         {/* Splitter Handle */}
         <div 
            className="h-1 cursor-row-resize flex items-center justify-center hover:bg-yellow-500/50 transition-colors z-50 relative group" 
            onMouseDown={(e) => { e.preventDefault(); isResizingHeight.current = true; document.body.style.cursor = 'row-resize'; }}
            onTouchStart={(e) => { e.preventDefault(); isResizingHeight.current = true; }}
         >
             <div className="w-16 h-1 bg-white/20 rounded-full group-hover:h-1.5 transition-all" />
         </div>

         {/* Notícias */}
         <div className="flex-1 p-6 flex flex-col overflow-hidden bg-black/20">
            <div className="flex items-center gap-2 mb-4 text-blue-300">
                <Newspaper size={20} /> 
                <span className="font-bold tracking-widest text-sm">NOTÍCIAS</span>
                {newsSearchMode && <span className="ml-auto text-xs animate-pulse text-green-400">Ouvindo escolha...</span>}
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto hide-scrollbar">
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