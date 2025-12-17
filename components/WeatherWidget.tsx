import React, { useEffect, useState } from 'react';
import { Wind, Waves, MapPin, Droplets, ThermometerSun, CloudRain, Calendar, Clock } from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherWidgetProps {
  weather: WeatherData;
  locationName: string;
  beachReport: any;
  width?: number; // Para responsividade
}

const getWeatherIcon = (code: number) => {
  if (code <= 1) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "☁️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "⛈️";
  if (code <= 86) return "🌨️";
  return "⛈️";
};

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, locationName, beachReport, width = 300 }) => {
  const [windDesc, setWindDesc] = useState("...");
  const [icon, setIcon] = useState("☀️");
  const [currentSlide, setCurrentSlide] = useState(0);

  // --- ESCALAS DINÂMICAS DE FONTE (Baseado em width) ---
  const tempSize = Math.max(width / 3.2, 36);
  const iconSize = Math.max(width / 3.5, 30);
  const citySize = Math.max(width / 22, 9);
  
  // Fontes para o conteúdo interno
  const labelSize = Math.max(width / 28, 8); 
  const valueSize = Math.max(width / 18, 11);
  const subSize = Math.max(width / 30, 8); 
  const headerSize = Math.max(width / 25, 10); 
  
  const isNarrow = width < 250;

  // Slides configuration
  // 0: Metrics, 1: Beach, 2: Hourly, 3: Daily
  const totalSlides = 4;

  useEffect(() => {
    const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!weather) return;
    const code = weather.weathercode;
    let localIcon = getWeatherIcon(code);
    if (weather.is_day === 0 && code < 50) localIcon = "🌙";
    setIcon(localIcon);

    const wind = weather.wind_speed;
    let wText = "Suave";
    if (wind > 30) wText = "Forte";
    else if (wind > 15) wText = "Brisa";
    else if (wind > 5) wText = "Leve";
    setWindDesc(wText);
  }, [weather]);

  const renderDailyForecast = () => {
    if (!weather.daily || !weather.daily.time) return null;
    return weather.daily.time.slice(0, 5).map((dateStr, i) => { // Show 5 days to fit better
      const date = new Date(dateStr);
      const dayName = i === 0 ? 'Hoje' : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return (
        <div key={i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0" style={{fontSize: `${subSize}px`}}>
          <span className="font-bold w-8 capitalize opacity-80 truncate">{dayName}</span>
          <div className="flex items-center gap-1">
             <span style={{fontSize: `${valueSize}px`}}>{getWeatherIcon(weather.daily?.weathercode?.[i] ?? 0)}</span>
             {weather.daily?.precipitation_probability_max?.[i] > 20 && (
                <div className="flex items-center text-blue-300 gap-0.5">
                    <CloudRain size={subSize} />
                    <span className="text-[9px]">{weather.daily?.precipitation_probability_max?.[i]}%</span>
                </div>
             )}
          </div>
          <div className="flex gap-1 justify-end">
            <span className="font-bold text-white">{Math.round(weather.daily?.temperature_2m_max?.[i] ?? 0)}°</span>
            <span className="opacity-50">{Math.round(weather.daily?.temperature_2m_min?.[i] ?? 0)}°</span>
          </div>
        </div>
      );
    });
  };

  const renderHourlyForecast = () => {
    if (!weather.hourly || !weather.hourly.time) return null;
    
    // Filter starting at 00:00 of current day (index 0 usually), step 3
    // Assuming API returns aligned data or we find the first 00:00. 
    // OpenMeteo hourly usually starts at 00:00 of the requested day.
    
    const step = 3;
    const nextHours = weather.hourly.time
        .map((t, i) => ({
            time: t,
            temp: weather.hourly?.temperature_2m?.[i] ?? 0,
            code: weather.hourly?.weathercode?.[i] ?? 0,
            pop: weather.hourly?.precipitation_probability?.[i] ?? 0
        }))
        .filter((_, i) => i % step === 0) // Every 3 hours (0, 3, 6, 9...)
        .slice(0, 6); // Take first 6 slots (0h to 15h approx, or up to 18h depending on start)

    return (
        <div className="grid grid-cols-3 gap-1 h-full content-start">
            {nextHours.map((item, i) => {
                const hour = new Date(item.time).getHours();
                return (
                    <div key={i} className="flex flex-col items-center justify-center bg-white/5 rounded-lg py-1 border border-white/5 relative overflow-hidden">
                        <span className="opacity-60 mb-0.5 leading-none" style={{fontSize: `${subSize}px`}}>{hour}h</span>
                        <span className="mb-0.5 leading-none" style={{fontSize: `${valueSize}px`}}>{getWeatherIcon(item.code)}</span>
                        <span className="font-bold z-10 leading-none" style={{fontSize: `${subSize + 2}px`}}>{Math.round(item.temp)}°</span>
                    </div>
                );
            })}
        </div>
    );
  };

  return (
    <div className="animate-float flex flex-col w-full h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-3 shadow-2xl relative overflow-hidden transition-all duration-300">
       
       {/* HEADER (Always Visible) */}
       <div className={`flex ${isNarrow ? 'flex-col items-center text-center' : 'justify-between items-start'} mb-2 shrink-0 border-b border-white/5 pb-2`}>
          <div>
              <div className="font-bold leading-none tracking-tighter drop-shadow-xl text-white transition-all duration-300" style={{ fontSize: `${tempSize}px` }}>
                 {Math.round(Number(weather.temperature))}°
              </div>
              <div className="flex items-center gap-1 font-bold uppercase opacity-90 mt-1 text-yellow-400 justify-center md:justify-start" style={{ fontSize: `${citySize}px` }}>
                 <MapPin size={citySize} /> {locationName.split('-')[0]}
              </div>
          </div>
          <div className="filter drop-shadow-lg animate-pulse transition-all duration-300 leading-none" style={{ fontSize: `${iconSize}px` }}>
             {icon}
          </div>
       </div>

       {/* MAIN CAROUSEL AREA (Fills rest of height) */}
       <div className="flex-1 relative overflow-hidden">
          
          {/* SLIDE 0: Metrics */}
          <div className={`absolute inset-0 transition-opacity duration-700 flex flex-col ${currentSlide === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
             <div className="flex items-center gap-2 mb-2 text-yellow-400 opacity-80 font-bold uppercase tracking-widest" style={{ fontSize: `${headerSize}px` }}>
                  <Wind size={headerSize} /> Detalhes
             </div>
             <div className={`grid ${isNarrow ? 'grid-cols-1' : 'grid-cols-2'} gap-2 flex-1`}>
                {[
                    { label: "Vento", val: `${weather.wind_speed}`, unit: "km/h", icon: Wind, color: "text-blue-300", sub: windDesc },
                    { label: "Chuva", val: `${weather.precipitation_probability}`, unit: "%", icon: CloudRain, color: "text-blue-300", sub: "Prob." },
                    { label: "Sensação", val: `${Math.round(Number(weather.apparent_temperature))}`, unit: "°", icon: ThermometerSun, color: "text-yellow-300", sub: "Real" },
                    { label: "Umidade", val: `${weather.relative_humidity_2m}`, unit: "%", icon: Droplets, color: "text-blue-300", sub: "Ar" }
                ].map((m, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-1.5 border border-white/10 flex flex-col justify-center">
                        <span className={`uppercase opacity-60 flex items-center gap-1 ${m.color}`} style={{ fontSize: `${labelSize}px` }}>
                            <m.icon size={labelSize}/> {m.label}
                        </span>
                        <div className="font-bold leading-tight" style={{ fontSize: `${valueSize}px` }}>
                            {m.val} <span className="font-normal opacity-70" style={{ fontSize: `${subSize}px` }}>{m.unit}</span>
                        </div>
                        {m.sub && <div className="opacity-50 font-medium truncate" style={{ fontSize: `${subSize}px` }}>{m.sub}</div>}
                    </div>
                ))}
             </div>
          </div>

          {/* SLIDE 1: Beach */}
          <div className={`absolute inset-0 transition-opacity duration-700 flex flex-col ${currentSlide === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
             <div className="flex items-center gap-2 mb-2 text-blue-300 font-bold uppercase tracking-widest" style={{ fontSize: `${headerSize}px` }}>
                 <Waves size={headerSize} /> Praia
             </div>
             {beachReport ? (
                <div className="flex-1 bg-blue-900/30 rounded-2xl p-3 border border-blue-500/30 backdrop-blur-sm flex flex-col justify-around">
                    <div className="border-b border-blue-500/20 pb-1 mb-1">
                        <span className="text-yellow-400 font-bold block leading-tight" style={{ fontSize: `${valueSize}px` }}>{beachReport.bestBeach}</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                             <span className="opacity-60" style={{ fontSize: `${subSize}px` }}>Bandeira</span>
                             <span className={`font-bold ${['Perigosa', 'Ruim'].includes(beachReport.swimCondition) ? 'text-red-400' : 'text-green-400'}`} style={{ fontSize: `${valueSize}px` }}>{beachReport.swimCondition}</span>
                        </div>
                        <div className="flex justify-between items-center">
                             <span className="opacity-60" style={{ fontSize: `${subSize}px` }}>Ondas</span>
                             <span className="font-bold text-white" style={{ fontSize: `${valueSize}px` }}>{beachReport.waves}</span>
                        </div>
                        <div className="flex justify-between items-center">
                             <span className="opacity-60" style={{ fontSize: `${subSize}px` }}>Água</span>
                             <span className="font-bold text-blue-200" style={{ fontSize: `${valueSize}px` }}>{beachReport.waterTemp}</span>
                        </div>
                    </div>
                </div>
             ) : (
                <div className="flex-1 bg-white/5 rounded-2xl flex items-center justify-center">
                    <p className="opacity-50" style={{ fontSize: `${subSize}px` }}>Carregando praia...</p>
                </div>
             )}
          </div>

          {/* SLIDE 2: Hourly */}
          <div className={`absolute inset-0 transition-opacity duration-700 flex flex-col ${currentSlide === 2 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
             <div className="flex items-center gap-2 mb-2 text-yellow-400 opacity-80 font-bold uppercase tracking-widest" style={{ fontSize: `${headerSize}px` }}>
                  <Clock size={headerSize} /> Hoje (3h em 3h)
             </div>
             <div className="flex-1 overflow-hidden">
                {renderHourlyForecast()}
             </div>
          </div>

          {/* SLIDE 3: Daily */}
          <div className={`absolute inset-0 transition-opacity duration-700 flex flex-col ${currentSlide === 3 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
             <div className="flex items-center gap-2 mb-2 text-yellow-400 opacity-80 font-bold uppercase tracking-widest" style={{ fontSize: `${headerSize}px` }}>
                  <Calendar size={headerSize} /> Próximos Dias
             </div>
             <div className="flex-1 bg-black/20 rounded-xl p-2 border border-white/5 overflow-y-auto hide-scrollbar">
                {renderDailyForecast()}
             </div>
          </div>

       </div>

       {/* Slide Indicators */}
       <div className="absolute top-2 right-2 flex gap-1 z-20">
            {[0, 1, 2, 3].map(idx => (
                <div key={idx} className={`w-1 h-1 rounded-full transition-colors ${currentSlide === idx ? 'bg-white' : 'bg-white/20'}`} />
            ))}
       </div>

    </div>
  );
};

export default WeatherWidget;