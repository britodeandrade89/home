import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowRight, ArrowLeft, Lock, Unlock, Download, Power, Edit3, Bell, Smartphone
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
      <button onClick={resetErrorBoundary} className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform">Reiniciar Dashboard</button>
    </div>
  );
}

const App = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData>({ 
    temperature: '25', weathercode: 0, is_day: 1, apparent_temperature: '27', 
    precipitation_probability: 0, wind_speed: 0, relative_humidity_2m: 70,
    daily: { time: [], weathercode: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [] },
    hourly: { time: [], temperature_2m: [], weathercode: [] }
  });
  const [beachReport, setBeachReport] = useState<any[]>([]); // Inicializa vazio, mas o Widget agora lida com isso
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [widgets, setWidgets] = useState({
    clock: { width: 250, height: 120, x: 40, y: 40 },
    reminders: { width: 320, height: 800, x: 10, y: 10 }, 
    weather: { width: 400, height: 800, x: 0, y: 10 }, 
    date: { width: 500, height: 450, x: 0, y: 0 }, 
    prev: { width: 180, height: 120, x: 0, y: 0 },
    next: { width: 180, height: 120, x: 0, y: 0 },
  });

  const updateWidget = (key: string, updates: any) => {
    setWidgets(prev => ({ ...prev, [key]: { ...prev[key as keyof typeof prev], ...updates } }));
  };

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sideWidth = Math.max(260, w * 0.22);
      
      setWidgets(prev => ({
        ...prev,
        reminders: { ...prev.reminders, width: sideWidth, height: h - 180, x: 20, y: 20 },
        weather: { ...prev.weather, width: sideWidth + 80, height: h - 40, x: w - (sideWidth + 100), y: 20 },
        date: { ...prev.date, width: w * 0.45, x: (w/2) - (w*0.225), y: (h/2) - 180 },
        clock: { ...prev.clock, x: (w/2) - (prev.clock.width/2), y: 20 },
        prev: { ...prev.prev, x: (w/2) - (w*0.225) - 40, y: h - 140 }, 
        next: { ...prev.next, x: (w/2) + (w*0.225) - 140, y: h - 140 }  
      }));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const loadWeather = async () => {
      try {
        const data = await fetchWeatherData(MARICA_COORDS);
        if (data) {
          setWeather(data);
          const report = await generateBeachReport(data, 'Maricá');
          setBeachReport(report || []);
        }
      } catch (e) {
        console.error("Erro ao carregar clima:", e);
      }
    };
    loadWeather();
    const wInt = setInterval(loadWeather, 900000);
    return () => { clearInterval(timer); clearInterval(wInt); };
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
      backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.85)), url("https://images.unsplash.com/photo-${imageId}?q=80&w=1920&auto=format&fit=crop")`,
      backgroundSize: 'cover', backgroundPosition: 'center'
    };
  };

  useEffect(() => {
    const code = weather?.weathercode || 0;
    document.body.classList.remove('rain-active', 'storm-active', 'sun-active');
    if (code >= 51 && code < 95) document.body.classList.add('rain-active');
    if (code >= 95) document.body.classList.add('storm-active', 'rain-active');
    if (code <= 3) document.body.classList.add('sun-active');
  }, [weather]);

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white cursor-pointer select-none" onClick={() => setHasStarted(true)}>
        <Power size={80} className="text-yellow-500 animate-pulse mb-6" />
        <h1 className="text-5xl font-bold tracking-[0.5em]">SMART HOME</h1>
        <p className="mt-4 opacity-50 text-sm tracking-widest">TOQUE PARA INICIAR</p>
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

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <main className="w-full h-screen overflow-hidden relative select-none text-white" style={getBackgroundStyle()}>
        <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

        <section className="absolute inset-0 z-10">
          {/* RELÓGIO */}
          <ResizableWidget width={widgets.clock.width} height={widgets.clock.height} locked={isLayoutLocked} position={{ x: widgets.clock.x, y: widgets.clock.y }} onResize={(w, h) => updateWidget('clock', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('clock', { x, y })}>
            <ClockWidget currentTime={currentTime} greeting={currentTime.getHours() < 12 ? 'Bom dia' : 'Boa tarde'} width={widgets.clock.width} />
          </ResizableWidget>

          {/* LEMBRETES (Lado Esquerdo) */}
          <ResizableWidget width={widgets.reminders.width} height={widgets.reminders.height} locked={isLayoutLocked} position={{ x: widgets.reminders.x, y: widgets.reminders.y }} onResize={(w, h) => updateWidget('reminders', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('reminders', { x, y })}>
            <RemindersWidget reminders={reminders} onAdd={addReminder} onDelete={deleteReminder} />
          </ResizableWidget>

          {/* CLIMA (Lado Direito) */}
          <ResizableWidget width={widgets.weather.width} height={widgets.weather.height} locked={isLayoutLocked} position={{ x: widgets.weather.x, y: widgets.weather.y }} onResize={(w, h) => updateWidget('weather', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('weather', { x, y })}>
            <WeatherWidget weather={weather} locationName="Maricá - RJ" beachReport={beachReport} width={widgets.weather.width} />
          </ResizableWidget>

          {/* DATA CENTRAL */}
          <ResizableWidget width={widgets.date.width} height={widgets.date.height} locked={isLayoutLocked} position={{ x: widgets.date.x, y: widgets.date.y }} onResize={(w, h) => updateWidget('date', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('date', { x, y })}>
            <div className="flex flex-col items-center justify-center h-full text-center drop-shadow-2xl animate-fade-in pointer-events-none">
              <span className="font-bold opacity-60 text-yellow-400 tracking-[0.5em] mb-4" style={{ fontSize: `${widgets.date.width / 10}px` }}>HOJE</span>
              <span className="font-bold leading-none my-4" style={{ fontSize: `${widgets.date.width / 1.8}px` }}>{today.day}</span>
              <span className="font-light uppercase tracking-[0.3em] text-blue-100" style={{ fontSize: `${widgets.date.width / 9}px` }}>{today.weekday}</span>
            </div>
          </ResizableWidget>

          {/* ONTEM (Canto Inferior Esquerdo) */}
          <ResizableWidget width={widgets.prev.width} height={widgets.prev.height} locked={isLayoutLocked} position={{ x: widgets.prev.x, y: widgets.prev.y }} onResize={(w, h) => updateWidget('prev', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('prev', { x, y })}>
            <div className="flex items-center gap-4 opacity-50 hover:opacity-100 transition-opacity">
                <ArrowLeft size={widgets.prev.width / 4} />
                <div className="text-left">
                  <span className="block uppercase tracking-widest text-yellow-400 font-bold" style={{ fontSize: `${widgets.prev.width / 10}px` }}>Ontem</span>
                  <span className="font-bold block" style={{ fontSize: `${widgets.prev.width / 4}px` }}>{yesterday.day}</span>
                  <span className="opacity-60 uppercase" style={{ fontSize: `${widgets.prev.width / 12}px` }}>{yesterday.month}</span>
                </div>
            </div>
          </ResizableWidget>

          {/* AMANHÃ (Canto Inferior Direito) */}
          <ResizableWidget width={widgets.next.width} height={widgets.next.height} locked={isLayoutLocked} position={{ x: widgets.next.x, y: widgets.next.y }} onResize={(w, h) => updateWidget('next', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('next', { x, y })}>
            <div className="flex items-center gap-4 justify-end opacity-50 hover:opacity-100 transition-opacity">
                <div className="text-right">
                  <span className="block uppercase tracking-widest text-yellow-400 font-bold" style={{ fontSize: `${widgets.next.width / 10}px` }}>Amanhã</span>
                  <span className="font-bold block" style={{ fontSize: `${widgets.next.width / 4}px` }}>{tomorrow.day}</span>
                  <span className="opacity-60 uppercase" style={{ fontSize: `${widgets.next.width / 12}px` }}>{tomorrow.month}</span>
                </div>
                <ArrowRight size={widgets.next.width / 4} />
            </div>
          </ResizableWidget>
        </section>

        {/* FOOTER LOCK */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
          <button onClick={() => setIsLayoutLocked(!isLayoutLocked)} className={`p-6 rounded-full shadow-2xl transition-all duration-300 border-2 ${isLayoutLocked ? 'bg-white/5 border-white/10 text-white/20' : 'bg-yellow-500 text-black border-yellow-300 scale-125'}`}>
            {isLayoutLocked ? <Lock size={28}/> : <Edit3 size={28}/>}
          </button>
        </div>
      </main>
    </ErrorBoundary>
  );
};

export default App;