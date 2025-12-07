import React from 'react';
import { CloudRain, Sun, Cloud, Moon, MapPin, Thermometer, Droplets, CloudLightning, Wind, Waves, Map, Anchor } from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherWidgetProps {
  weather: WeatherData;
  locationName: string;
  beachReport: any;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, locationName, beachReport }) => {
  const getWeatherIcon = (code: number, isDay: number = 1) => {
    if (code >= 95) return <CloudLightning className="text-purple-300 w-16 h-16 drop-shadow-lg" />;
    if (code >= 51) return <CloudRain className="text-blue-300 w-16 h-16 drop-shadow-lg" />;
    if (code >= 2) return <Cloud className="text-gray-300 w-16 h-16 drop-shadow-lg" />;
    return isDay === 1 ? <Sun className="text-yellow-300 w-16 h-16 drop-shadow-lg" /> : <Moon className="text-yellow-100 w-16 h-16 drop-shadow-lg" />;
  };

  const getWeekDay = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d).toUpperCase();
  };

  return (
    <div className="flex flex-col w-[350px] h-[500px] rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
       
       {/* 1. STICKY HEADER (Current) */}
       <div className="flex items-center justify-between p-6 bg-black/20 shrink-0">
          <div className="flex flex-col text-white">
             <span className="text-6xl font-bold tracking-tighter leading-none drop-shadow-xl">
               {weather.temperature !== '--' ? `${Math.round(Number(weather.temperature))}°` : '--'}
             </span>
             <span className="text-xs uppercase tracking-widest font-bold flex items-center gap-1 mb-1 opacity-90">
                <MapPin size={12} className="text-green-400" /> {locationName}
             </span>
             <div className="flex gap-2 text-xs opacity-80">
                <span className="flex items-center gap-1"><Thermometer size={10}/> {weather.apparent_temperature}°</span>
                <span className="flex items-center gap-1"><Droplets size={10}/> {weather.precipitation_probability}%</span>
             </div>
          </div>
          <div className="animate-pulse">{getWeatherIcon(weather.weathercode, weather.is_day)}</div>
       </div>

       {/* 2. SCROLLABLE CONTENT (Vertical) */}
       <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar">
          
          {/* MARINE & BEACH CONDITIONS */}
          <div className="p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-blue-300 border-b border-white/10 pb-1 mb-2">Condições do Mar (Maricá)</h3>
            
            <div className="grid grid-cols-2 gap-3">
               <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-white/70 text-[10px] uppercase mb-1">
                     <Wind size={12} /> Vento
                  </div>
                  <span className="text-xl font-bold">{weather.wind_speed} <span className="text-xs font-normal">km/h</span></span>
                  <p className="text-[10px] opacity-60 leading-tight mt-1">{beachReport?.windComment || "Calculando..."}</p>
               </div>
               
               <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-white/70 text-[10px] uppercase mb-1">
                     <Waves size={12} /> Água
                  </div>
                  <span className="text-xl font-bold">{beachReport?.waterTemp || "--"}</span>
                  <p className="text-[10px] opacity-60 leading-tight mt-1">
                     Banho: <span className={beachReport?.swimCondition === 'Boa' ? 'text-green-400' : 'text-red-400'}>{beachReport?.swimCondition || "--"}</span>
                  </p>
               </div>
            </div>

            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-3 rounded-xl border border-white/10">
               <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2 text-xs font-bold text-yellow-300">
                      <Anchor size={14} /> Recomendação da IA
                   </div>
                   {beachReport?.lagomarProb === 'Alta' && <span className="text-[9px] bg-green-500 text-black px-1.5 rounded font-bold">LAGOMAR</span>}
               </div>
               <p className="text-sm font-medium mb-1">{beachReport?.bestBeach || "Analisando praias..."}</p>
               <p className="text-[11px] opacity-70 mb-2 leading-snug">{beachReport?.reason}</p>
               {beachReport?.routeLink && (
                  <a href={beachReport.routeLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[10px] bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors w-fit">
                     <Map size={12} /> Ver Rota no Maps
                  </a>
               )}
            </div>
          </div>

          {/* 3. HORIZONTAL FORECAST (Scrollable) */}
          <div className="p-4 pt-0">
             <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-300 border-b border-white/10 pb-1 mb-2">Próximos Dias</h3>
             <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {weather.daily?.time.slice(0, 6).map((time, i) => (
                   <div key={time} className="flex flex-col items-center bg-white/5 p-2 rounded-xl min-w-[60px] border border-white/5">
                      <span className="text-[10px] opacity-60 uppercase mb-1">{i === 0 ? 'Hoje' : getWeekDay(time)}</span>
                      <div className="mb-1 scale-75">{getWeatherIcon(weather.daily!.weathercode[i])}</div>
                      <span className="text-sm font-bold">{Math.round(weather.daily!.temperature_2m_max[i])}°</span>
                      <span className="text-[10px] opacity-50">{Math.round(weather.daily!.temperature_2m_min[i])}°</span>
                      {weather.daily!.precipitation_probability_max[i] > 30 && (
                         <div className="flex items-center gap-0.5 text-[9px] text-blue-300 mt-1">
                            <Droplets size={8} /> {weather.daily!.precipitation_probability_max[i]}%
                         </div>
                      )}
                   </div>
                ))}
                {!weather.daily && <div className="text-xs opacity-50">Carregando previsão...</div>}
             </div>
          </div>

       </div>
    </div>
  );
};

export default WeatherWidget;