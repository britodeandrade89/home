
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowRight, ArrowLeft, Lock, Unlock, Download, Power, Edit3, Bell, Smartphone, Maximize
} from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from './services/firebase';
import { fetchWeatherData } from './services/weather'; 
import { processVoiceCommandAI, generateNewsReport, generateBeachReport, BEACH_FALLBACK } from './services/gemini';
import { Reminder, WeatherData } from './types';
import ResizableWidget from './components/ResizableWidget';
import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import RemindersWidget from './components/RemindersWidget';
import ChatModal from './components/ChatModal';
import { ErrorBoundary } from 'react-error-boundary';

const MARICA_COORDS = { lat: -22.9194, lon: -42.8186 };

function ErrorFallback({error, resetErrorBoundary}: any) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black p-10 text-center z-50 fixed inset-0">
      <p className="text-red-500 font-bold mb-4 text-2xl">Ocorreu um erro.</p>
      <p className="text-white/50 mb-6 font-mono text-sm">{error.message}</p>
      <button onClick={() => window.location.reload()} className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform">Recarregar Página</button>
    </div>
  );
}

const App = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [beachReport, setBeachReport] = useState<any[]>(BEACH_FALLBACK);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [widgets, setWidgets] = useState({
    clock: { width: 300, height: 100, x: 0, y: 0 },
    reminders: { width: 300, height: 600, x: 0, y: 0 }, 
    weather: { width: 350, height: 600, x: 0, y: 0 }, 
    date: { width: 400, height: 300, x: 0, y: 0 }, 
    prev: { width: 180, height: 100, x: 0, y: 0 },
    next: { width: 180, height: 100, x: 0, y: 0 },
  });

  const updateWidget = (key: string, updates: any) => {
    setWidgets(prev => ({ ...prev, [key]: { ...prev[key as keyof typeof prev], ...updates } }));
  };

  // LAYOUT RÍGIDO - 3 COLUNAS
  const recalculateLayout = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Configurações de Espaçamento
    const padding = 20;
    const sideColumnWidth = w * 0.28; // 28% para as laterais
    const centerColumnWidth = w * 0.44; // 44% para o centro

    setWidgets({
      // 1. COLUNA ESQUERDA (Lembretes) - Altura Total
      reminders: { 
        width: sideColumnWidth - padding, 
        height: h - (padding * 2), 
        x: padding, 
        y: padding 
      },

      // 2. COLUNA DIREITA (Clima) - Altura Total
      weather: { 
        width: sideColumnWidth - padding, 
        height: h - (padding * 2), 
        x: w - (sideColumnWidth) - padding + padding, // Ajuste para encostar na direita
        y: padding 
      },

      // 3. COLUNA CENTRAL (Relógio + Data + Footer)
      // Relógio: Topo do Centro
      clock: { 
        width: centerColumnWidth, 
        height: 120, 
        x: sideColumnWidth + padding, 
        y: padding + 10 // Um pouco abaixo do topo
      },
      
      // Data: Centro Absoluto da tela (mas dentro da coluna central)
      date: { 
        width: centerColumnWidth, 
        height: 250, 
        x: sideColumnWidth + padding, 
        y: (h / 2) - 125 // Centralizado verticalmente
      },

      // Ontem: Canto Inferior Esquerdo da COLUNA CENTRAL
      prev: { 
        width: centerColumnWidth / 2.5, 
        height: 100, 
        x: sideColumnWidth + padding, 
        y: h - 140 
      },

      // Amanhã: Canto Inferior Direito da COLUNA CENTRAL
      next: { 
        width: centerColumnWidth / 2.5, 
        height: 100, 
        x: w - sideColumnWidth - padding - (centerColumnWidth / 2.5), 
        y: h - 140 
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', recalculateLayout);
    recalculateLayout();
    return () => window.removeEventListener('resize', recalculateLayout);
  }, [recalculateLayout]);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchWeatherData(MARICA_COORDS);
      if (data) {
        setWeather(data);
        const report = await generateBeachReport(data, 'Maricá');
        if (report && report.length > 0) {
          setBeachReport(report);
        }
      }
    } catch (e) {
      console.error("Erro no ciclo de dados:", e);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const pageReload = setInterval(() => {
      window.location.reload();
    }, 1800000); 
    return () => clearInterval(pageReload);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (db) {
      const q = query(collection(db, "smart_home_reminders"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => {
        setReminders(snapshot.docs.map(doc => ({ 
          id: doc.id, ...doc.data() 
        } as Reminder)));
      });
    }
  }, []);

  const addReminder = async (text: string) => {
    if (db) {
      await addDoc(collection(db, "smart_home_reminders"), {
        text,
        type: 'info',
        createdAt: serverTimestamp(),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
    }
  };

  const deleteReminder = async (id: string) => {
    if (db) await deleteDoc(doc(db, "smart_home_reminders", id));
  };

  const getBackgroundStyle = () => {
    const code = weather?.weathercode || 0;
    let imageId = '1507525428034-b723cf961d3e'; 
    if (code >= 51) imageId = '1515694346937-94d85e41e6f0'; 
    if (code >= 95) imageId = '1605727216801-e27ce1d0cc28'; 

    return { 
      backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url("https://images.unsplash.com/photo-${imageId}?q=80&w=1920&auto=format&fit=crop")`,
      backgroundSize: 'cover', 
      backgroundPosition: 'center'
    };
  };

  const startApp = () => {
    setHasStarted(true);
    recalculateLayout(); 
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen denied", e));
    }
  };

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white cursor-pointer select-none" onClick={startApp}>
        <Maximize size={80} className="text-yellow-500 animate-pulse mb-6" />
        <h1 className="text-5xl font-bold tracking-[0.5em]">SMART HOME</h1>
        <p className="mt-4 opacity-50 text-sm tracking-widest">TOQUE PARA INICIAR EM TELA CHEIA</p>
      </div>
    );
  }

  const getDateInfo = (d: Date) => ({
    day: d.getDate(),
    weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).toUpperCase().replace('.', '')
  });

  const today = getDateInfo(currentTime);
  const yesterday = getDateInfo(new Date(new Date().setDate(currentTime.getDate() - 1)));
  const tomorrow = getDateInfo(new Date(new Date().setDate(currentTime.getDate() + 1)));

  const displayWeather = weather || {
    temperature: '--', weathercode: 0, is_day: 1, apparent_temperature: '--', 
    precipitation_probability: 0, wind_speed: 0, relative_humidity_2m: 0,
    daily: { time: [], weathercode: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [] },
    hourly: { time: [], temperature_2m: [], weathercode: [] }
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <main className="w-full h-screen overflow-hidden relative select-none text-white bg-black" style={getBackgroundStyle()}>
        <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

        <section className="absolute inset-0 z-10 pointer-events-none">
          
          {/* 1. RELÓGIO (Centro Topo) */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.clock.width} height={widgets.clock.height} locked={isLayoutLocked} position={{ x: widgets.clock.x, y: widgets.clock.y }} onResize={(w, h) => updateWidget('clock', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('clock', { x, y })}>
              <ClockWidget currentTime={currentTime} greeting={currentTime.getHours() < 12 ? 'Bom dia' : 'Boa tarde'} width={widgets.clock.width} />
            </ResizableWidget>
          </div>

          {/* 2. LEMBRETES (Esquerda Total) */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.reminders.width} height={widgets.reminders.height} locked={isLayoutLocked} position={{ x: widgets.reminders.x, y: widgets.reminders.y }} onResize={(w, h) => updateWidget('reminders', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('reminders', { x, y })}>
              <RemindersWidget reminders={reminders} onAdd={addReminder} onDelete={deleteReminder} />
            </ResizableWidget>
          </div>

          {/* 3. CLIMA (Direita Total) */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.weather.width} height={widgets.weather.height} locked={isLayoutLocked} position={{ x: widgets.weather.x, y: widgets.weather.y }} onResize={(w, h) => updateWidget('weather', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('weather', { x, y })}>
              <WeatherWidget weather={displayWeather} locationName="Maricá - RJ" beachReport={beachReport} width={widgets.weather.width} />
            </ResizableWidget>
          </div>

          {/* 4. DATA CENTRAL (Meio) */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.date.width} height={widgets.date.height} locked={isLayoutLocked} position={{ x: widgets.date.x, y: widgets.date.y }} onResize={(w, h) => updateWidget('date', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('date', { x, y })}>
              <div className="flex flex-col items-center justify-center h-full text-center drop-shadow-2xl animate-fade-in pointer-events-none">
                <span className="font-bold opacity-70 text-yellow-400 tracking-[0.4em] mb-0" style={{ fontSize: `${widgets.date.width / 14}px` }}>HOJE</span>
                <span className="font-bold leading-none my-2 text-white" style={{ fontSize: `${widgets.date.width / 1.6}px` }}>{today.day}</span>
                <span className="font-light uppercase tracking-[0.3em] text-blue-100" style={{ fontSize: `${widgets.date.width / 10}px` }}>{today.weekday}</span>
              </div>
            </ResizableWidget>
          </div>

          {/* 5. ONTEM (Canto Inferior Esquerdo da Coluna Central) */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.prev.width} height={widgets.prev.height} locked={isLayoutLocked} position={{ x: widgets.prev.x, y: widgets.prev.y }} onResize={(w, h) => updateWidget('prev', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('prev', { x, y })}>
              <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity p-2">
                  <ArrowLeft size={widgets.prev.width / 5} />
                  <div className="text-left">
                    <span className="block uppercase tracking-widest text-yellow-400 font-bold" style={{ fontSize: `${widgets.prev.width / 8}px` }}>Ontem</span>
                    <span className="font-bold block" style={{ fontSize: `${widgets.prev.width / 3.5}px` }}>{yesterday.day}</span>
                  </div>
              </div>
            </ResizableWidget>
          </div>

          {/* 6. AMANHÃ (Canto Inferior Direito da Coluna Central) */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.next.width} height={widgets.next.height} locked={isLayoutLocked} position={{ x: widgets.next.x, y: widgets.next.y }} onResize={(w, h) => updateWidget('next', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('next', { x, y })}>
              <div className="flex items-center gap-3 justify-end opacity-50 hover:opacity-100 transition-opacity p-2">
                  <div className="text-right">
                    <span className="block uppercase tracking-widest text-yellow-400 font-bold" style={{ fontSize: `${widgets.next.width / 8}px` }}>Amanhã</span>
                    <span className="font-bold block" style={{ fontSize: `${widgets.next.width / 3.5}px` }}>{tomorrow.day}</span>
                  </div>
                  <ArrowRight size={widgets.next.width / 5} />
              </div>
            </ResizableWidget>
          </div>
        </section>

        {/* FOOTER LOCK */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <button onClick={() => setIsLayoutLocked(!isLayoutLocked)} className={`p-4 md:p-6 rounded-full shadow-2xl transition-all duration-300 border-2 ${isLayoutLocked ? 'bg-white/5 border-white/10 text-white/20' : 'bg-yellow-500 text-black border-yellow-300 scale-125'}`}>
            {isLayoutLocked ? <Lock size={24}/> : <Edit3 size={24}/>}
          </button>
        </div>
      </main>
    </ErrorBoundary>
  );
};

export default App;
