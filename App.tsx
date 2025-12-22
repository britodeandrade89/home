
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowRight, ArrowLeft, Lock, Unlock, Download, Power, Edit3, Bell, Smartphone, Maximize
} from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from './services/firebase';
import { fetchWeatherData } from './services/weather'; 
import { processVoiceCommandAI, generateNewsReport, generateBeachReport } from './services/gemini';
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
  const [beachReport, setBeachReport] = useState<any[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Layout inicial (será recalculado no resize)
  const [widgets, setWidgets] = useState({
    clock: { width: 300, height: 120, x: 0, y: 0 },
    reminders: { width: 300, height: 600, x: 0, y: 0 }, 
    weather: { width: 350, height: 600, x: 0, y: 0 }, 
    date: { width: 400, height: 300, x: 0, y: 0 }, 
    prev: { width: 180, height: 100, x: 0, y: 0 },
    next: { width: 180, height: 100, x: 0, y: 0 },
  });

  const updateWidget = (key: string, updates: any) => {
    setWidgets(prev => ({ ...prev, [key]: { ...prev[key as keyof typeof prev], ...updates } }));
  };

  // 1. RECALCULAR LAYOUT (Responsivo e Fixo)
  const recalculateLayout = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Definições de tamanho
    const sideColWidth = Math.max(300, w * 0.25); // 25% da tela ou 300px
    const padding = 20;

    setWidgets({
      // Relógio: Topo Centro
      clock: { 
        width: 300, 
        height: 120, 
        x: (w / 2) - 150, 
        y: padding 
      },
      // Lembretes: Coluna Esquerda Total (menos padding)
      reminders: { 
        width: sideColWidth, 
        height: h - (padding * 2), 
        x: padding, 
        y: padding 
      },
      // Clima: Coluna Direita Total
      weather: { 
        width: sideColWidth + 50, 
        height: h - (padding * 2), 
        x: w - (sideColWidth + 50) - padding, 
        y: padding 
      },
      // Data: Centro Absoluto
      date: { 
        width: w * 0.3, 
        height: 300, 
        x: (w / 2) - ((w * 0.3) / 2), 
        y: (h / 2) - 150 
      },
      // Ontem: Canto Inferior Esquerdo (ancorado na coluna central)
      prev: { 
        width: 200, 
        height: 120, 
        x: sideColWidth + (padding * 2), 
        y: h - 140 
      },
      // Amanhã: Canto Inferior Direito (ancorado na coluna central)
      next: { 
        width: 200, 
        height: 120, 
        x: w - (sideColWidth + 50 + padding + 200 + padding), 
        y: h - 140 
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', recalculateLayout);
    recalculateLayout();
    return () => window.removeEventListener('resize', recalculateLayout);
  }, [recalculateLayout]);

  // 2. FETCH DE DADOS ROBUSTO
  const loadData = useCallback(async () => {
    try {
      // Clima
      const data = await fetchWeatherData(MARICA_COORDS);
      if (data) {
        setWeather(data);
        // Praia (Gemini)
        const report = await generateBeachReport(data, 'Maricá');
        setBeachReport(report);
      }
    } catch (e) {
      console.error("Erro no ciclo de dados:", e);
    }
  }, []);

  useEffect(() => {
    loadData(); // Carga inicial
    const interval = setInterval(loadData, 300000); // Atualiza dados a cada 5 min
    return () => clearInterval(interval);
  }, [loadData]);

  // 3. AUTO RELOAD DA PÁGINA (Prevenção de congelamento)
  useEffect(() => {
    const pageReload = setInterval(() => {
      window.location.reload();
    }, 1800000); // Recarrega a página inteira a cada 30 minutos
    return () => clearInterval(pageReload);
  }, []);

  // Relógio local
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Firebase (Lembretes)
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
    // Fundo padrão caso weather ainda seja null
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
    recalculateLayout(); // Força layout correto ao iniciar
    // Tenta tela cheia
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

  // Mock weather para renderização inicial se a API demorar
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
          {/* A pointer-events-none no container pai garante que o fundo não bloqueie cliques, mas widgets precisam ter pointer-events-auto */}
          
          {/* RELÓGIO (Topo Centro) */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.clock.width} height={widgets.clock.height} locked={isLayoutLocked} position={{ x: widgets.clock.x, y: widgets.clock.y }} onResize={(w, h) => updateWidget('clock', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('clock', { x, y })}>
              <ClockWidget currentTime={currentTime} greeting={currentTime.getHours() < 12 ? 'Bom dia' : 'Boa tarde'} width={widgets.clock.width} />
            </ResizableWidget>
          </div>

          {/* LEMBRETES (Esquerda Fixa) */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.reminders.width} height={widgets.reminders.height} locked={isLayoutLocked} position={{ x: widgets.reminders.x, y: widgets.reminders.y }} onResize={(w, h) => updateWidget('reminders', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('reminders', { x, y })}>
              <RemindersWidget reminders={reminders} onAdd={addReminder} onDelete={deleteReminder} />
            </ResizableWidget>
          </div>

          {/* CLIMA (Direita Fixa) */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.weather.width} height={widgets.weather.height} locked={isLayoutLocked} position={{ x: widgets.weather.x, y: widgets.weather.y }} onResize={(w, h) => updateWidget('weather', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('weather', { x, y })}>
              <WeatherWidget weather={displayWeather} locationName="Maricá - RJ" beachReport={beachReport} width={widgets.weather.width} />
            </ResizableWidget>
          </div>

          {/* DATA CENTRAL */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.date.width} height={widgets.date.height} locked={isLayoutLocked} position={{ x: widgets.date.x, y: widgets.date.y }} onResize={(w, h) => updateWidget('date', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('date', { x, y })}>
              <div className="flex flex-col items-center justify-center h-full text-center drop-shadow-2xl animate-fade-in pointer-events-none">
                <span className="font-bold opacity-60 text-yellow-400 tracking-[0.5em] mb-4" style={{ fontSize: `${widgets.date.width / 10}px` }}>HOJE</span>
                <span className="font-bold leading-none my-4" style={{ fontSize: `${widgets.date.width / 1.8}px` }}>{today.day}</span>
                <span className="font-light uppercase tracking-[0.3em] text-blue-100" style={{ fontSize: `${widgets.date.width / 9}px` }}>{today.weekday}</span>
              </div>
            </ResizableWidget>
          </div>

          {/* ONTEM */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.prev.width} height={widgets.prev.height} locked={isLayoutLocked} position={{ x: widgets.prev.x, y: widgets.prev.y }} onResize={(w, h) => updateWidget('prev', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('prev', { x, y })}>
              <div className="flex items-center gap-4 opacity-50 hover:opacity-100 transition-opacity p-4">
                  <ArrowLeft size={widgets.prev.width / 4} />
                  <div className="text-left">
                    <span className="block uppercase tracking-widest text-yellow-400 font-bold" style={{ fontSize: `${widgets.prev.width / 10}px` }}>Ontem</span>
                    <span className="font-bold block" style={{ fontSize: `${widgets.prev.width / 4}px` }}>{yesterday.day}</span>
                  </div>
              </div>
            </ResizableWidget>
          </div>

          {/* AMANHÃ */}
          <div className="pointer-events-auto">
            <ResizableWidget width={widgets.next.width} height={widgets.next.height} locked={isLayoutLocked} position={{ x: widgets.next.x, y: widgets.next.y }} onResize={(w, h) => updateWidget('next', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('next', { x, y })}>
              <div className="flex items-center gap-4 justify-end opacity-50 hover:opacity-100 transition-opacity p-4">
                  <div className="text-right">
                    <span className="block uppercase tracking-widest text-yellow-400 font-bold" style={{ fontSize: `${widgets.next.width / 10}px` }}>Amanhã</span>
                    <span className="font-bold block" style={{ fontSize: `${widgets.next.width / 4}px` }}>{tomorrow.day}</span>
                  </div>
                  <ArrowRight size={widgets.next.width / 4} />
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
