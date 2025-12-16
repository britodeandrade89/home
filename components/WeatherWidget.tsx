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
  const [lastUpdate, setLastUpdate] = useState("");
  const [icon, setIcon] = useState("☀️");
  const [infoSlide, setInfoSlide] = useState(0);

  // Escalas dinâmicas
  const tempSize = Math.max(width / 3.5, 40);
  const iconSize = Math.max(width / 4, 30);
  const isNarrow = width < 250;

  useEffect(() => {
    const interval = setInterval(() => {
        setInfoSlide((prev) => (prev === 0 ? 1 : 0));
    }, 8000);
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
    if (wind > 30) wText = "Vento Forte";
    else if (wind > 15) wText = "Brisa do Mar";
    else if (wind > 5) wText = "Leve";
    setWindDesc(wText);

    setLastUpdate(new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}));
  }, [weather]);

  const renderDailyForecast = () => {
    if (!weather.daily || !weather.daily.time) return null;
    return weather.daily.time.slice(0, 7).map((dateStr, i) => {
      const date = new Date(dateStr);
      const dayName = i === 0 ? 'Hoje' : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return (
        <div key={i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 text-[10px] md:text-xs">
          <span className="font-bold w-8 capitalize opacity-80 truncate">{dayName}</span>
          <span>{getWeatherIcon(weather.daily?.weathercode?.[i] ?? 0)}</span>
          <div className="flex gap-1 justify-end">
            <span className="font-bold">{Math.round(weather.daily?.temperature_2m_max?.[i] ?? 0)}°</span>
            <span className="opacity-50">{Math.round(weather.daily?.temperature_2m_min?.[i] ?? 0)}°</span>
          </div>
        </div>
      );
    });
  };

  const renderHourlyForecast = () => {
    if (!weather.hourly || !weather.hourly.time) return null;
    const currentHour = new Date().getHours();
    const nextHours = weather.hourly.time
        .map((t, i) => ({
            time: t,
            temp: weather.hourly?.temperature_2m?.[i] ?? 0,
            code: weather.hourly?.weathercode?.[i] ?? 0,
            pop: weather.hourly?.precipitation_probability?.[i] ?? 0
        }))
        .filter((_, i) => i >= currentHour && i < currentHour + 12);

    return nextHours.map((item, i) => {
        const hour = new Date(item.time).getHours();
        return (
            <div key={i} className="flex flex-col items-center justify-center min-w-[45px] bg-white/5 rounded-lg py-1 mx-1 border border-white/5 relative overflow-hidden">
                <span className="text-[9px] opacity-60 mb-0.5">{hour}h</span>
                <span className="text-sm mb-0.5">{getWeatherIcon(item.code)}</span>
                <span className="text-xs font-bold z-10">{Math.round(item.temp)}°</span>
                <div className="w-full h-1 bg-white/10 mt-0.5 rounded-full overflow-hidden flex items-end">
                   <div className={`h-full ${item.pop > 50 ? 'bg-blue-400' : 'bg-blue-600/50'}`} style={{ width: `${item.pop}%` }} />
                </div>
            </div>
        );
    });
  };

  return (
    <div className="animate-float flex flex-col w-full h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-3 md:p-5 shadow-2xl relative overflow-hidden transition-all duration-300">
       <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
           
           {/* HEADER (Escala com largura) */}
           <div className={`flex ${isNarrow ? 'flex-col items-center text-center' : 'justify-between items-start'} mb-2 shrink-0`}>
              <div>
                  <div className="font-bold leading-none tracking-tighter drop-shadow-xl text-white transition-all duration-300" style={{ fontSize: `${tempSize}px` }}>
                     {Math.round(Number(weather.temperature))}°
                  </div>
                  <div className="flex items-center gap-1 text-[10px] md:text-xs font-bold uppercase opacity-90 mt-1 text-yellow-400 justify-center md:justify-start">
                     <MapPin size={10} /> {locationName.split('-')[0]}
                  </div>
              </div>
              <div className="filter drop-shadow-lg animate-pulse transition-all duration-300" style={{ fontSize: `${iconSize}px` }}>
                 {icon}
              </div>
           </div>

           {/* CARROSSEL */}
           <div className="relative min-h-[140px] mb-2 flex-grow-0">
              <div className="absolute top-0 right-0 flex gap-1 z-10">
                 <div className={`w-1 h-1 rounded-full ${infoSlide === 0 ? 'bg-white' : 'bg-white/20'}`} />
                 <div className={`w-1 h-1 rounded-full ${infoSlide === 1 ? 'bg-white' : 'bg-white/20'}`} />
              </div>

              {/* SLIDE 0: Métricas */}
              <div className={`absolute inset-0 transition-opacity duration-700 ${infoSlide === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                 <div className={`grid ${isNarrow ? 'grid-cols-1' : 'grid-cols-2'} gap-2 h-full`}>
                    {[
                        { label: "Vento", val: `${weather.wind_speed}`, unit: "km/h", icon: Wind, color: "text-blue-300", sub: windDesc },
                        { label: "Chuva", val: `${weather.precipitation_probability}`, unit: "%", icon: CloudRain, color: "text-blue-300", sub: "Prob." },
                        { label: "Sensação", val: `${Math.round(Number(weather.apparent_temperature))}`, unit: "°", icon: ThermometerSun, color: "text-yellow-300", sub: "Real" },
                        { label: "Umidade", val: `${weather.relative_humidity_2m}`, unit: "%", icon: Droplets, color: "text-blue-300", sub: "Ar" }
                    ].map((m, i) => (
                        <div key={i} className="bg-white/5 rounded-xl p-2 border border-white/10 flex flex-col justify-center">
                            <span className={`text-[9px] uppercase opacity-60 flex items-center gap-1 ${m.color}`}><m.icon size={10}/> {m.label}</span>
                            <div className="text-sm font-bold">{m.val} <span className="text-[9px] font-normal opacity-70">{m.unit}</span></div>
                        </div>
                    ))}
                 </div>
              </div>

              {/* SLIDE 1: Praia */}
              <div className={`absolute inset-0 transition-opacity duration-700 ${infoSlide === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                 {beachReport ? (
                    <div className="h-full bg-blue-900/30 rounded-2xl p-2 border border-blue-500/30 backdrop-blur-sm flex flex-col justify-between overflow-hidden">
                        <div className="flex items-center gap-2 text-blue-300 font-bold uppercase text-[9px] tracking-widest">
                            <Waves size={12} /> Praia
                        </div>
                        <div className="grid grid-cols-2 gap-x-1 text-[10px]">
                           <div className="col-span-2 border-b border-blue-500/20 pb-0.5 mb-1">
                              <span className="text-yellow-400 font-bold truncate block">{beachReport.bestBeach}</span>
                           </div>
                           <span className="opacity-60">Bandeira:</span> <span className={beachReport.swimCondition === 'Perigosa' ? 'text-red-400' : 'text-green-400'}>{beachReport.swimCondition}</span>
                           <span className="opacity-60">Ondas:</span> <span>{beachReport.waves}</span>
                        </div>
                    </div>
                 ) : (
                    <div className="h-full bg-white/5 rounded-2xl p-2 flex items-center justify-center"><p className="text-[10px] opacity-50">Sem dados praia</p></div>
                 )}
              </div>
           </div>

           <div className="h-px w-full bg-white/10 mb-2 shrink-0"></div>

           <div className="mb-2 shrink-0">
              <div className="flex items-center gap-2 mb-1 text-yellow-400 opacity-80 text-[9px] font-bold uppercase tracking-widest"><Clock size={10} /> Horas</div>
              <div className="flex overflow-x-auto hide-scrollbar pb-1">{renderHourlyForecast()}</div>
           </div>

           <div>
              <div className="flex items-center gap-2 mb-1 text-yellow-400 opacity-80 text-[9px] font-bold uppercase tracking-widest"><Calendar size={10} /> 7 Dias</div>
              <div className="bg-black/20 rounded-xl p-2 border border-white/5">{renderDailyForecast()}</div>
           </div>
       </div>
    </div>
  );
};

export default WeatherWidget;