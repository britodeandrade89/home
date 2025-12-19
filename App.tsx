import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowRight, ArrowLeft, Lock, Unlock, Download, Power, Edit3, Bell, Smartphone
} from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './services/firebase';
import { fetchWeatherData } from './services/weather'; 
import { processVoiceCommandAI, generateNewsReport, generateBeachReport } from './services/gemini';
import { Reminder, WeatherData } from './types';
import ResizableWidget from './components/ResizableWidget';
import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import ChatModal from './components/ChatModal';
import { ErrorBoundary } from 'react-error-boundary';

const MARICA_COORDS = { lat: -22.9194, lon: -42.8186 };

function ErrorFallback({error, resetErrorBoundary}: any) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/50 p-4 text-center">
      <p className="text-red-400 font-bold mb-2">Erro.</p>
      <button onClick={resetErrorBoundary} className="bg-white/10 px-4 py-2 rounded-lg text-sm">Reset</button>
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
  const [beachReport, setBeachReport] = useState<any[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [widgets, setWidgets] = useState({
    clock: { width: 250, height: 120, x: 40, y: 40 },
    reminders: { width: 240, height: 800, x: 10, y: 10 }, 
    weather: { width: 340, height: 800, x: 0, y: 10 }, 
    date: { width: 500, height: 450, x: 0, y: 0 }, 
    prev: { width: 180, height: 100, x: 0, y: 0 },
    next: { width: 180, height: 100, x: 0, y: 0 },
  });

  const updateWidget = (key: string, updates: any) => {
    setWidgets(prev => ({ ...prev, [key]: { ...prev[key as keyof typeof prev], ...updates } }));
  };

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sideWidth = Math.max(220, w * 0.18);
      setWidgets(prev => ({
        ...prev,
        reminders: { ...prev.reminders, width: sideWidth, height: h - 20, x: 10, y: 10 },
        weather: { ...prev.weather, width: sideWidth + 60, height: h - 20, x: w - (sideWidth + 70), y: 10 },
        date: { ...prev.date, width: w * 0.4, x: (w/2) - (w*0.2), y: (h/2) - 180 },
        clock: { ...prev.clock, x: (w/2) - (prev.clock.width/2), y: 20 },
        prev: { ...prev.prev, x: (w/2) - (w*0.2), y: h - 120 },
        next: { ...prev.next, x: (w/2) + (w*0.2) - 180, y: h - 120 }
      }));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const loadWeather = async () => {
      const data = await fetchWeatherData(MARICA_COORDS);
      if (data) {
        setWeather(data);
        const report = await generateBeachReport(data, 'Maricá');
        setBeachReport(report);
      }
    };
    loadWeather();
    const wInt = setInterval(loadWeather, 900000);
    return () => { clearInterval(timer); clearInterval(wInt); };
  }, []);

  const getBackgroundStyle = () => {
    const code = weather?.weathercode || 0;
    const isNight = weather?.is_day === 0;
    let imageId = '1507525428034-b723cf961d3e'; // Sol
    if (code >= 51) imageId = '1515694346937-94d85e41e6f0'; // Chuva
    if (code >= 95) imageId = '1605727216801-e27ce1d0cc28'; // Trovão

    return { 
      backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url("https://images.unsplash.com/photo-${imageId}?q=80&w=1920&auto=format&fit=crop")`,
      backgroundSize: 'cover', backgroundPosition: 'center'
    };
  };

  // Efeitos Climáticos no Body
  useEffect(() => {
    const code = weather?.weathercode || 0;
    document.body.classList.remove('rain-active', 'storm-active', 'sun-active');
    if (code >= 51 && code < 95) document.body.classList.add('rain-active');
    if (code >= 95) document.body.classList.add('storm-active', 'rain-active');
    if (code <= 3) document.body.classList.add('sun-active');
  }, [weather]);

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white cursor-pointer" onClick={() => setHasStarted(true)}>
        <Power size={60} className="text-yellow-500 animate-pulse mb-4" />
        <h1 className="text-4xl font-bold tracking-widest">SMART HOME</h1>
      </div>
    );
  }

  const today = {
    day: currentTime.getDate(),
    weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(currentTime),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(currentTime).toUpperCase()
  };

  return (
    <main className="w-full h-screen overflow-hidden relative select-none" style={getBackgroundStyle()}>
      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      <section className="absolute inset-0 z-10">
        <ResizableWidget width={widgets.clock.width} height={widgets.clock.height} locked={isLayoutLocked} position={{ x: widgets.clock.x, y: widgets.clock.y }} onResize={(w, h) => updateWidget('clock', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('clock', { x, y })}>
          <ClockWidget currentTime={currentTime} greeting={currentTime.getHours() < 12 ? 'Bom dia' : 'Boa tarde'} width={widgets.clock.width} />
        </ResizableWidget>

        <ResizableWidget width={widgets.weather.width} height={widgets.weather.height} locked={isLayoutLocked} position={{ x: widgets.weather.x, y: widgets.weather.y }} onResize={(w, h) => updateWidget('weather', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('weather', { x, y })}>
          <WeatherWidget weather={weather} locationName="Maricá - RJ" beachReport={beachReport} width={widgets.weather.width} />
        </ResizableWidget>

        <ResizableWidget width={widgets.date.width} height={widgets.date.height} locked={isLayoutLocked} position={{ x: widgets.date.x, y: widgets.date.y }} onResize={(w, h) => updateWidget('date', { width: w, height: h })} onPositionChange={(x, y) => updateWidget('date', { x, y })}>
          <div className="flex flex-col items-center justify-center h-full text-center drop-shadow-2xl animate-fade-in">
            <span className="font-bold opacity-60 text-yellow-400 tracking-[0.4em]" style={{ fontSize: `${widgets.date.width / 12}px` }}>HOJE</span>
            <span className="font-bold leading-none my-4" style={{ fontSize: `${widgets.date.width / 2}px` }}>{today.day}</span>
            <span className="font-light uppercase tracking-[0.2em] text-blue-100" style={{ fontSize: `${widgets.date.width / 10}px` }}>{today.weekday}</span>
          </div>
        </ResizableWidget>
        
        {/* Outros widgets permanecem como definidos anteriormente */}
      </section>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button onClick={() => setIsLayoutLocked(!isLayoutLocked)} className={`p-5 rounded-full shadow-2xl transition-all ${isLayoutLocked ? 'bg-white/5 text-white/20' : 'bg-yellow-500 text-black scale-110'}`}>
          {isLayoutLocked ? <Lock size={24}/> : <Edit3 size={24}/>}
        </button>
      </div>
    </main>
  );
};

export default App;