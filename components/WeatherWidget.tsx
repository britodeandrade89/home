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
  const [infoSlide, setInfoSlide] = useState(0);

  // --- ESCALAS DINÂMICAS DE FONTE (Baseado em width) ---
  const tempSize = Math.max(width / 3.2, 36);
  const iconSize = Math.max(width / 3.5, 30);
  const citySize = Math.max(width / 22, 9);
  
  // Fontes para o conteúdo interno
  const labelSize = Math.max(width / 28, 8); // Vento, Chuva labels
  const valueSize = Math.max(width / 18, 12); // Valores 25km/h
  const subSize = Math.max(width / 30, 8); // Subtextos
  
  const headerSize = Math.max(width / 25, 9); // Títulos de seção
  
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
  }, [weather]);

  const renderDailyForecast = () => {
    if (!weather.daily || !weather.daily.time) return null;
    return weather.daily.time.slice(0, 7).map((dateStr, i) => {
      const date = new Date(dateStr);
      const dayName = i === 0 ? 'Hoje' : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return (
        <div key={i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0" style={{fontSize: `${subSize}px`}}>
          <span className="font-bold w-8 capitalize opacity-80 truncate">{dayName}</span>
          <span style={{fontSize: `${valueSize}px`}}>{getWeatherIcon(weather.daily?.weathercode?.[i] ?? 0)}</span>
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
            <div key={i} className="flex flex-col items-center justify-center min-w-[40px] bg-white/5 rounded-lg py-1 mx-1 border border-white/5 relative overflow-hidden flex-shrink-0" style={{ width: width / 5 }}>
                <span className="opacity-60 mb-0.5 leading-none" style={{fontSize: `${subSize}px`}}>{hour}h</span>
                <span className="mb-0.5 leading-none" style={{fontSize: `${valueSize}px`}}>{getWeatherIcon(item.code)}</span>
                <span className="font-bold z-10 leading-none" style={{fontSize: `${subSize + 2}px`}}>{Math.round(item.temp)}°</span>
                <div className="w-full h-1 bg-white/10 mt-0.5 rounded-full overflow-hidden flex items-end">
                   <div className={`h-full ${item.pop > 50 ? 'bg-blue-400' : 'bg-blue-600/50'}`} style={{ width: `${item.pop}%` }} />
                </div>
            </div>
        );
    });
  };

  return (
    <div className="animate-float flex flex-col w-full h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-3 shadow-2xl relative overflow-hidden transition-all duration-300">
       <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
           
           {/* HEADER */}
           <div className={`flex ${isNarrow ? 'flex-col items-center text-center' : 'justify-between items-start'} mb-2 shrink-0`}>
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

           {/* CARROSSEL */}
           <div className="relative mb-2 flex-grow-0" style={{ minHeight: `${width * 0.5}px` }}>
              <div className="absolute top-0 right-0 flex gap-1 z-10">
                 <div className={`w-1 h-1 rounded-full ${infoSlide === 0 ? 'bg-white' : 'bg-white/20'}`} />
                 <div className={`w-1 h-1 rounded-full ${infoSlide === 1 ? 'bg-white' : 'bg-white/20'}`} />
              </div>

              {/* SLIDE 0: Métricas */}
              <div className={`absolute inset-0 transition-opacity duration-700 ${infoSlide === 0 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}>
                 <div className={`grid ${isNarrow ? 'grid-cols-1' : 'grid-cols-2'} gap-2 h-full`}>
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

              {/* SLIDE 1: Praia */}
              <div className={`absolute inset-0 transition-opacity duration-700 ${infoSlide === 1 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}>
                 {beachReport ? (
                    <div className="h-full bg-blue-900/30 rounded-2xl p-2 border border-blue-500/30 backdrop-blur-sm flex flex-col justify-between overflow-hidden">
                        <div className="flex items-center gap-2 text-blue-300 font-bold uppercase tracking-widest" style={{ fontSize: `${headerSize}px` }}>
                            <Waves size={headerSize + 2} /> Praia
                        </div>
                        <div className="grid grid-cols-2 gap-x-1" style={{ fontSize: `${subSize}px` }}>
                           <div className="col-span-2 border-b border-blue-500/20 pb-0.5 mb-1">
                              <span className="text-yellow-400 font-bold truncate block" style={{ fontSize: `${valueSize}px` }}>{beachReport.bestBeach}</span>
                           </div>
                           <span className="opacity-60">Bandeira:</span> 
                           <span className={`font-bold ${['Perigosa', 'Ruim'].includes(beachReport.swimCondition) ? 'text-red-400' : 'text-green-400'}`}>{beachReport.swimCondition}</span>
                           
                           <span className="opacity-60">Ondas:</span> 
                           <span className="font-bold">{beachReport.waves}</span>

                           <span className="opacity-60">Água:</span> 
                           <span className="font-bold">{beachReport.waterTemp}</span>
                        </div>
                    </div>
                 ) : (
                    <div className="h-full bg-white/5 rounded-2xl p-2 flex items-center justify-center text-center">
                        <p className="opacity-50" style={{ fontSize: `${subSize}px` }}>Carregando dados da praia...</p>
                    </div>
                 )}
              </div>
           </div>

           <div className="h-px w-full bg-white/10 mb-2 shrink-0"></div>

           <div className="mb-2 shrink-0">
              <div className="flex items-center gap-2 mb-1 text-yellow-400 opacity-80 font-bold uppercase tracking-widest" style={{ fontSize: `${headerSize}px` }}>
                  <Clock size={headerSize} /> Horas
              </div>
              <div className="flex overflow-x-auto hide-scrollbar pb-1">{renderHourlyForecast()}</div>
           </div>

           <div>
              <div className="flex items-center gap-2 mb-1 text-yellow-400 opacity-80 font-bold uppercase tracking-widest" style={{ fontSize: `${headerSize}px` }}>
                  <Calendar size={headerSize} /> 7 Dias
              </div>
              <div className="bg-black/20 rounded-xl p-2 border border-white/5">{renderDailyForecast()}</div>
           </div>
       </div>
    </div>
  );
};

export default WeatherWidget;