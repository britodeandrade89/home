import React, { useEffect, useState } from 'react';
import { Wind, Waves, MapPin, Droplets, ThermometerSun, CloudRain, Calendar, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherWidgetProps {
  weather: WeatherData;
  locationName: string;
  beachReport: any;
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

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, locationName, beachReport }) => {
  const [windDesc, setWindDesc] = useState("...");
  const [lastUpdate, setLastUpdate] = useState("");
  const [icon, setIcon] = useState("☀️");
  
  // Estado para controlar o carrossel de informações (0: Métricas, 1: Praia)
  const [infoSlide, setInfoSlide] = useState(0);

  useEffect(() => {
    // Alterna os slides a cada 8 segundos
    const interval = setInterval(() => {
        setInfoSlide((prev) => (prev === 0 ? 1 : 0));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!weather) return;

    // 1. Ícone Principal
    const code = weather.weathercode;
    let localIcon = getWeatherIcon(code);
    
    // Ajuste noturno simples
    if (weather.is_day === 0 && code < 50) localIcon = "🌙";
    setIcon(localIcon);

    // 2. Descrição do Vento Atualizada
    const wind = weather.wind_speed;
    let wText = "Suave";
    if (wind > 30) wText = "Vento Forte";
    else if (wind > 15) wText = "Brisa do Mar";
    else if (wind > 5) wText = "Leve";
    setWindDesc(wText);

    // 3. Hora
    setLastUpdate(new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}));

  }, [weather]);

  // Helper para Previsão Diária
  const renderDailyForecast = () => {
    if (!weather.daily || !weather.daily.time) return null;
    const { time, weathercode, temperature_2m_max, temperature_2m_min } = weather.daily;

    return time.slice(0, 7).map((dateStr, i) => {
      const date = new Date(dateStr);
      const dayName = i === 0 ? 'Hoje' : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      
      const code = weathercode?.[i] ?? 0;
      const max = Math.round(temperature_2m_max?.[i] ?? 0);
      const min = Math.round(temperature_2m_min?.[i] ?? 0);

      return (
        <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
          <span className="text-sm font-bold w-12 capitalize opacity-80">{dayName}</span>
          <span className="text-xl">{getWeatherIcon(code)}</span>
          <div className="flex gap-2 text-sm w-20 justify-end">
            <span className="font-bold">{max}°</span>
            <span className="opacity-50">{min}°</span>
          </div>
        </div>
      );
    });
  };

  // Helper para Previsão Horária com Barra de Chuva
  const renderHourlyForecast = () => {
    if (!weather.hourly || !weather.hourly.time) return null;
    const currentHour = new Date().getHours();
    
    const nextHours = weather.hourly.time
        .map((t, i) => ({
            time: t,
            temp: weather.hourly?.temperature_2m?.[i] ?? 0,
            code: weather.hourly?.weathercode?.[i] ?? 0,
            pop: weather.hourly?.precipitation_probability?.[i] ?? 0 // Probability of Precipitation
        }))
        .filter((_, i) => i >= currentHour && i < currentHour + 12);

    return nextHours.map((item, i) => {
        const hour = new Date(item.time).getHours();
        return (
            <div key={i} className="flex flex-col items-center justify-center min-w-[55px] bg-white/5 rounded-xl py-2 mx-1 border border-white/5 relative overflow-hidden group">
                <span className="text-[10px] opacity-60 mb-1">{hour}h</span>
                <span className="text-lg mb-1">{getWeatherIcon(item.code)}</span>
                <span className="text-sm font-bold z-10">{Math.round(item.temp)}°</span>
                
                {/* Barra de Probabilidade de Chuva */}
                <div className="w-full h-1.5 bg-white/10 mt-1 rounded-full overflow-hidden flex items-end relative" title={`Chuva: ${item.pop}%`}>
                   <div 
                     className={`h-full ${item.pop > 50 ? 'bg-blue-400' : 'bg-blue-600/50'}`} 
                     style={{ width: `${item.pop}%` }} 
                   />
                </div>
                {item.pop > 20 && <span className="text-[8px] text-blue-300 font-bold mt-0.5">{item.pop}%</span>}
            </div>
        );
    });
  };

  return (
    <div className="animate-float flex flex-col w-full h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden transition-all duration-300">
        
       <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
           
           {/* 1. HEADER FIXO (Temperatura e Local) */}
           <div className="flex justify-between items-start mb-4 shrink-0">
              <div>
                  <div className="text-[7rem] lg:text-[8rem] font-bold leading-none tracking-tighter drop-shadow-xl text-white">
                     {Math.round(Number(weather.temperature))}°
                  </div>
                  <div className="flex items-center gap-1 text-base font-bold uppercase opacity-90 mt-[-5px] text-yellow-400 pl-2">
                     <MapPin size={14} /> {locationName}
                  </div>
              </div>
              <div className="text-[5rem] filter drop-shadow-lg animate-pulse">
                 {icon}
              </div>
           </div>

           {/* 2. ÁREA ROTATIVA (CARROSSEL) */}
           <div className="relative min-h-[160px] mb-4">
              {/* Indicadores de Slide */}
              <div className="absolute top-0 right-0 flex gap-1 z-10">
                 <div className={`w-1.5 h-1.5 rounded-full transition-colors ${infoSlide === 0 ? 'bg-white' : 'bg-white/20'}`} />
                 <div className={`w-1.5 h-1.5 rounded-full transition-colors ${infoSlide === 1 ? 'bg-white' : 'bg-white/20'}`} />
              </div>

              {/* SLIDE 0: Métricas Climáticas */}
              <div className={`absolute inset-0 transition-opacity duration-700 ${infoSlide === 0 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}>
                 <div className="grid grid-cols-2 gap-2 h-full">
                    {/* Vento */}
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col justify-center">
                        <span className="text-[10px] uppercase opacity-60 mb-1 flex items-center gap-1 text-blue-300"><Wind size={12}/> Vento</span>
                        <div className="text-xl font-bold">{weather.wind_speed} <span className="text-xs font-normal opacity-70">km/h</span></div>
                        <div className={`text-[10px] uppercase font-bold mt-1 truncate ${weather.wind_speed > 30 ? 'text-red-400 animate-pulse' : 'text-white/50'}`}>{windDesc}</div>
                    </div>
                    {/* Chuva */}
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col justify-center">
                        <span className="text-[10px] uppercase opacity-60 mb-1 flex items-center gap-1 text-blue-300"><CloudRain size={12}/> Chuva</span>
                        <div className="text-xl font-bold">{weather.precipitation_probability}%</div>
                        <div className="text-[10px] text-white/50 mt-1 uppercase font-bold">Probabilidade</div>
                    </div>
                    {/* Sensação */}
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col justify-center">
                        <span className="text-[10px] uppercase opacity-60 mb-1 flex items-center gap-1 text-yellow-300"><ThermometerSun size={12}/> Sensação</span>
                        <div className="text-xl font-bold">{Math.round(Number(weather.apparent_temperature))}°</div>
                        <div className="text-[10px] text-white/50 mt-1 uppercase font-bold">Real Feel</div>
                    </div>
                    {/* Umidade */}
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col justify-center">
                        <span className="text-[10px] uppercase opacity-60 mb-1 flex items-center gap-1 text-blue-300"><Droplets size={12}/> Umidade</span>
                        <div className="text-xl font-bold">{weather.relative_humidity_2m}%</div>
                        <div className="text-[10px] text-white/50 mt-1 uppercase font-bold">Do Ar</div>
                    </div>
                 </div>
              </div>

              {/* SLIDE 1: Condições do Mar */}
              <div className={`absolute inset-0 transition-opacity duration-700 flex flex-col ${infoSlide === 1 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}>
                 {beachReport ? (
                    <div className="h-full bg-blue-900/30 rounded-2xl p-3 border border-blue-500/30 backdrop-blur-sm flex flex-col justify-between">
                        <div className="flex items-center gap-2 text-blue-300 font-bold uppercase text-xs tracking-widest">
                            <Waves size={14} /> Condições do Mar
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 text-xs">
                           <div className="col-span-2 border-b border-blue-500/20 pb-1 mb-1">
                              <span className="opacity-60 block text-[9px]">Melhor Praia</span>
                              <span className="text-yellow-400 font-bold text-sm truncate block">{beachReport.bestBeach || "Analisando..."}</span>
                           </div>
                           <div>
                               <span className="opacity-60 block text-[9px]">Bandeira</span>
                               <span className={`font-bold ${beachReport.swimCondition === 'Perigosa' ? 'text-red-400' : 'text-green-400'}`}>{beachReport.swimCondition || "--"}</span>
                           </div>
                           <div>
                               <span className="opacity-60 block text-[9px]">Ondas</span>
                               <span className="font-bold text-white">{beachReport.waves || "--"}</span>
                           </div>
                           <div>
                               <span className="opacity-60 block text-[9px]">Água</span>
                               <span className="font-bold text-white">{beachReport.waterTemp || "--"}</span>
                           </div>
                           <div>
                               <span className="opacity-60 block text-[9px]">Lagomar</span>
                               <span className="font-bold text-white">{beachReport.lagomarProb || "--"}</span>
                           </div>
                        </div>
                    </div>
                 ) : (
                    <div className="h-full bg-white/5 rounded-2xl p-4 flex items-center justify-center text-center">
                        <p className="text-xs opacity-50">Dados da praia indisponíveis no momento.</p>
                    </div>
                 )}
              </div>
           </div>

           <div className="h-px w-full bg-white/10 mb-4 shrink-0"></div>

           {/* 3. PREVISÃO HORÁRIA FIXA */}
           <div className="mb-4 shrink-0">
              <div className="flex items-center gap-2 mb-2 text-yellow-400 opacity-80 text-xs font-bold uppercase tracking-widest">
                  <Clock size={12} /> Próximas Horas
              </div>
              <div className="flex overflow-x-auto hide-scrollbar pb-1">
                  {renderHourlyForecast()}
              </div>
           </div>

           {/* 4. PREVISÃO 7 DIAS FIXA */}
           <div>
              <div className="flex items-center gap-2 mb-2 text-yellow-400 opacity-80 text-xs font-bold uppercase tracking-widest">
                  <Calendar size={12} /> Próximos 7 Dias
              </div>
              <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
                  {renderDailyForecast()}
              </div>
           </div>

           {/* FOOTER */}
           <div className="text-center text-[9px] opacity-30 mt-4 pb-1">
              Atualizado às: {lastUpdate}
           </div>
       </div>
    </div>
  );
};

export default WeatherWidget;