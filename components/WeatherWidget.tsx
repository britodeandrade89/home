import React, { useEffect, useState } from 'react';
import { Wind, Waves, MapPin, Droplets, ThermometerSun, CloudRain, Calendar, Clock } from 'lucide-react';
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

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, locationName }) => {
  const [windDesc, setWindDesc] = useState("...");
  const [lastUpdate, setLastUpdate] = useState("");
  const [icon, setIcon] = useState("☀️");

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
    if (wind > 30) wText = "Vento Forte"; // Nova lógica solicitada
    else if (wind > 15) wText = "Brisa do Mar";
    else if (wind > 5) wText = "Leve";
    setWindDesc(wText);

    // 3. Hora
    setLastUpdate(new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}));

  }, [weather]);

  // Helper para Previsão Diária
  const renderDailyForecast = () => {
    if (!weather.daily) return null;
    const { time, weathercode, temperature_2m_max, temperature_2m_min } = weather.daily;

    // Pega os próximos 7 dias (index 1 a 7, pulando hoje index 0 se quiser, ou 0 a 6)
    // Vamos mostrar os próximos 5-6 dias para caber bem
    return time.slice(0, 7).map((dateStr, i) => {
      const date = new Date(dateStr);
      const dayName = i === 0 ? 'Hoje' : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      
      return (
        <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
          <span className="text-sm font-bold w-12 capitalize opacity-80">{dayName}</span>
          <span className="text-xl">{getWeatherIcon(weathercode[i])}</span>
          <div className="flex gap-2 text-sm w-20 justify-end">
            <span className="font-bold">{Math.round(temperature_2m_max[i])}°</span>
            <span className="opacity-50">{Math.round(temperature_2m_min[i])}°</span>
          </div>
        </div>
      );
    });
  };

  // Helper para Previsão Horária (Próximas 12h)
  const renderHourlyForecast = () => {
    if (!weather.hourly) return null;
    const currentHour = new Date().getHours();
    
    // Filtra para começar da hora atual
    const nextHours = weather.hourly.time
        .map((t, i) => ({
            time: t,
            temp: weather.hourly!.temperature_2m[i],
            code: weather.hourly!.weathercode[i]
        }))
        .filter((_, i) => i >= currentHour && i < currentHour + 12); // Próximas 12h

    return nextHours.map((item, i) => {
        const hour = new Date(item.time).getHours();
        return (
            <div key={i} className="flex flex-col items-center justify-center min-w-[50px] bg-white/5 rounded-xl py-2 mx-1 border border-white/5">
                <span className="text-[10px] opacity-60 mb-1">{hour}h</span>
                <span className="text-lg mb-1">{getWeatherIcon(item.code)}</span>
                <span className="text-sm font-bold">{Math.round(item.temp)}°</span>
            </div>
        );
    });
  };

  return (
    <div className="animate-float flex flex-col w-full h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
        
       {/* Conteúdo com Scroll automático caso exceda o tamanho do widget */}
       <div className="flex-1 overflow-y-auto hide-scrollbar">
           {/* HEADER PRINCIPAL */}
           <div className="flex justify-between items-start mb-6">
              <div>
                  <div className="text-[9rem] font-bold leading-none tracking-tighter drop-shadow-xl text-white">
                     {Math.round(Number(weather.temperature))}°
                  </div>
                  <div className="flex items-center gap-1 text-base font-bold uppercase opacity-90 mt-[-10px] text-yellow-400 pl-2">
                     <MapPin size={14} /> {locationName}
                  </div>
              </div>
              <div className="text-[6rem] filter drop-shadow-lg animate-pulse">
                 {icon}
              </div>
           </div>

           {/* GRID DE DETALHES COMPLETOS */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              
              {/* Vento */}
              <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col justify-center">
                 <span className="text-[10px] uppercase opacity-60 mb-1 flex items-center gap-1 text-blue-300"><Wind size={12}/> Vento</span>
                 <div className="text-2xl font-bold">{weather.wind_speed} <span className="text-xs font-normal opacity-70">km/h</span></div>
                 <div className={`text-[10px] uppercase font-bold mt-1 ${weather.wind_speed > 30 ? 'text-red-400 animate-pulse' : 'text-white/50'}`}>
                    {windDesc}
                 </div>
              </div>

              {/* Chuva */}
              <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col justify-center">
                 <span className="text-[10px] uppercase opacity-60 mb-1 flex items-center gap-1 text-blue-300"><CloudRain size={12}/> Chuva</span>
                 <div className="text-2xl font-bold">{weather.precipitation_probability}%</div>
                 <div className="text-[10px] text-white/50 mt-1 uppercase font-bold">Probabilidade</div>
              </div>

              {/* Sensação */}
              <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col justify-center">
                 <span className="text-[10px] uppercase opacity-60 mb-1 flex items-center gap-1 text-yellow-300"><ThermometerSun size={12}/> Sensação</span>
                 <div className="text-2xl font-bold">{Math.round(Number(weather.apparent_temperature))}°</div>
                 <div className="text-[10px] text-white/50 mt-1 uppercase font-bold">Real Feel</div>
              </div>

              {/* Umidade */}
              <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col justify-center">
                 <span className="text-[10px] uppercase opacity-60 mb-1 flex items-center gap-1 text-blue-300"><Droplets size={12}/> Umidade</span>
                 <div className="text-2xl font-bold">{weather.relative_humidity_2m}%</div>
                 <div className="text-[10px] text-white/50 mt-1 uppercase font-bold">Do Ar</div>
              </div>
           </div>

           <div className="h-px w-full bg-white/10 my-4"></div>

           {/* PREVISÃO HORÁRIA (HOJE) */}
           <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 text-yellow-400 opacity-80 text-xs font-bold uppercase tracking-widest">
                  <Clock size={12} /> Ao Longo do Dia
              </div>
              <div className="flex overflow-x-auto hide-scrollbar pb-2">
                  {renderHourlyForecast()}
              </div>
           </div>

           <div className="h-px w-full bg-white/10 my-4"></div>

           {/* PREVISÃO 7 DIAS */}
           <div>
              <div className="flex items-center gap-2 mb-3 text-yellow-400 opacity-80 text-xs font-bold uppercase tracking-widest">
                  <Calendar size={12} /> Próximos 7 Dias
              </div>
              <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                  {renderDailyForecast()}
              </div>
           </div>

           {/* FOOTER */}
           <div className="text-center text-[10px] opacity-30 mt-6 pb-2">
              Atualizado às: {lastUpdate}
           </div>
       </div>
    </div>
  );
};

export default WeatherWidget;