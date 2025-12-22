
import React, { useEffect, useState } from 'react';
import { Wind, Waves, MapPin, Droplets, ThermometerSun, CloudRain, ArrowUp, ArrowDown, ThumbsUp, AlertTriangle, Skull } from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherWidgetProps {
  weather: WeatherData;
  locationName: string;
  beachReport: any[];
  width?: number;
}

const getWeatherIcon = (code: number) => {
  if (code <= 1) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "☁️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "⛈️";
  return "⛈️";
};

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, locationName, beachReport, width = 300 }) => {
  const [currentSlide, setCurrentSlide] = useState(1); // Começa mostrando PRAIA
  const [subSlide, setSubSlide] = useState(0);

  const tempSize = Math.max(width / 3, 48);
  const hugeValueSize = Math.max(width / 4, 40);
  const labelSize = Math.max(width / 11, 16);
  const subLabelSize = Math.max(width / 18, 12);

  const hasBeachData = Array.isArray(beachReport) && beachReport.length > 0;
  const hasHourlyData = weather.hourly && weather.hourly.time && weather.hourly.time.length > 0;
  const hasDailyData = weather.daily && weather.daily.time && weather.daily.time.length > 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setSubSlide(prev => {
        const next = prev + 1;
        
        // Rotação Global: 0 (Métricas) -> 1 (Praia) -> 2 (Horário) -> 3 (Diário)
        if (currentSlide === 0 && next >= 4) { 
           setCurrentSlide(1); return 0;
        }

        if (currentSlide === 1) {
            if (!hasBeachData || next >= beachReport.length) {
                setCurrentSlide(2); return 0;
            }
        }

        if (currentSlide === 2) {
             if (!hasHourlyData || next >= 1) { 
                setCurrentSlide(3); return 0;
             }
        }

        if (currentSlide === 3) {
             if (!hasDailyData || next >= 5) {
                setCurrentSlide(0); return 0;
             }
        }
        
        return next;
      });
    }, 5000); // 5 SEGUNDOS conforme solicitado
    return () => clearInterval(interval);
  }, [currentSlide, beachReport, hasBeachData, hasHourlyData, hasDailyData]);

  const renderHugeMetric = (label: string, value: string, unit: string, Icon: any, color: string) => (
    <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center">
      <div className={`mb-6 ${color}`}><Icon size={width / 3.5} /></div>
      <div className="uppercase opacity-60 font-bold tracking-[0.2em] mb-3" style={{ fontSize: `${labelSize}px` }}>{label}</div>
      <div className="font-bold leading-none flex items-baseline gap-1" style={{ fontSize: `${hugeValueSize * 1.2}px` }}>
        {value}<span className="opacity-50 font-light" style={{ fontSize: `${hugeValueSize/1.5}px` }}>{unit}</span>
      </div>
    </div>
  );

  const renderHugeBeach = (beach: any) => {
    if (!beach) return null;

    const isBest = beach.recommendation === "Melhor Opção";
    const isDangerous = beach.condition === "Perigosa";

    return (
        <div className="flex flex-col items-center justify-between h-full animate-fade-in text-center p-2 relative">
            
            {isBest && (
                <div className="absolute top-0 bg-yellow-400 text-black px-4 py-1 rounded-full font-bold uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse z-20">
                    🏆 Melhor Escolha
                </div>
            )}
            
            <div className="mt-8 mb-2">
                {isDangerous ? (
                    <Skull size={width / 4} className="text-red-500 opacity-80" />
                ) : isBest ? (
                    <ThumbsUp size={width / 4} className="text-green-400" />
                ) : (
                    <Waves size={width / 4} className="text-blue-400" />
                )}
            </div>

            <div>
                <div className="text-white font-bold uppercase tracking-tight leading-none mb-1" style={{ fontSize: `${labelSize * 1.5}px` }}>{beach.name}</div>
                <div className={`font-bold uppercase tracking-widest ${isDangerous ? 'text-red-500' : isBest ? 'text-green-400' : 'text-yellow-400'}`} style={{ fontSize: `${labelSize}px` }}>
                    {beach.condition}
                </div>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 w-full grid grid-cols-2 gap-4 border border-white/10 mt-4">
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 text-cyan-300 mb-1">
                        <ThermometerSun size={20} />
                        <span className="uppercase text-[10px] font-bold">Água</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{beach.water}</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 text-blue-300 mb-1">
                        <Waves size={20} />
                        <span className="uppercase text-[10px] font-bold">Ondas</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{beach.waves}</span>
                </div>
            </div>
        </div>
    );
  };

  const renderVerticalHourly = () => {
    if (!hasHourlyData) return null;
    
    const hourlyData = weather.hourly!.time
      .map((t, i) => ({ 
        time: t, 
        temp: weather.hourly?.temperature_2m?.[i] ?? 0, 
        code: weather.hourly?.weathercode?.[i] ?? 0,
        pop: weather.hourly?.precipitation_probability?.[i] ?? 0
      }))
      .filter((_, i) => i % 3 === 0)
      .slice(0, 9); 

    return (
      <div className="flex flex-col justify-between h-full py-1 animate-fade-in overflow-hidden">
        <div className="text-center opacity-40 uppercase tracking-widest mb-1 font-bold" style={{ fontSize: `${subLabelSize}px` }}>Previsão 24h</div>
        {hourlyData.map((item, i) => (
          <div key={i} className="flex items-center justify-between border-b border-white/5 pb-0.5 last:border-0">
            <span className="font-bold w-12 text-left" style={{ fontSize: `${labelSize * 0.7}px` }}>{new Date(item.time).getHours()}h</span>
            <span style={{ fontSize: `${labelSize}px` }}>{getWeatherIcon(item.code)}</span>
            <div className="flex items-center gap-1 text-blue-300 font-bold" style={{ fontSize: `${labelSize * 0.9}px` }}>
              <CloudRain size={labelSize * 0.9} /> {item.pop}%
            </div>
            <span className="font-bold text-white text-right w-12" style={{ fontSize: `${labelSize * 0.8}px` }}>{Math.round(item.temp)}°</span>
          </div>
        ))}
      </div>
    );
  };

  const renderHugeDaily = (index: number) => {
    if (!hasDailyData) return null;
    const day = weather.daily?.time?.[index];
    if (!day) return null;
    
    const date = new Date(day);
    const dayName = index === 0 ? 'Hoje' : date.toLocaleDateString('pt-BR', { weekday: 'long' });
    const max = Math.round(weather.daily?.temperature_2m_max?.[index] ?? 0);
    const min = Math.round(weather.daily?.temperature_2m_min?.[index] ?? 0);
    const rain = weather.daily?.precipitation_probability_max?.[index] ?? 0;

    return (
      <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center p-4">
        <div className="text-yellow-400 font-bold uppercase mb-6 tracking-[0.2em]" style={{ fontSize: `${labelSize}px` }}>{dayName}</div>
        <div className="mb-6" style={{ fontSize: `${width / 3}px` }}>{getWeatherIcon(weather.daily?.weathercode?.[index] ?? 0)}</div>
        
        <div className="flex gap-12 items-center mb-6">
           <div className="flex flex-col items-center">
              <ArrowUp className="text-red-400 mb-2" size={labelSize} />
              <span className="font-bold" style={{ fontSize: `${hugeValueSize * 1.1}px` }}>{max}°</span>
           </div>
           <div className="flex flex-col items-center">
              <ArrowDown className="text-blue-400 mb-2" size={labelSize} />
              <span className="font-bold" style={{ fontSize: `${hugeValueSize * 1.1}px` }}>{min}°</span>
           </div>
        </div>

        <div className="bg-blue-600/20 px-8 py-3 rounded-2xl flex items-center gap-4 text-blue-300 font-black border border-blue-500/30" style={{ fontSize: `${labelSize * 1.1}px` }}>
          <CloudRain size={labelSize * 1.2} /> {rain}%
        </div>
      </div>
    );
  };

  return (
    <div className="animate-float flex flex-col w-full h-full bg-black/70 backdrop-blur-3xl border-2 border-white/10 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
       {/* HEADER FIXO */}
       <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-6 shrink-0">
          <div>
              <div className="font-bold leading-none tracking-tighter text-white" style={{ fontSize: `${tempSize}px` }}>
                 {Math.round(Number(weather.temperature))}°
              </div>
              <div className="flex items-center gap-2 font-bold uppercase text-yellow-400 mt-2" style={{ fontSize: `${width/18}px` }}>
                 <MapPin size={width/18} /> {locationName.split('-')[0]}
              </div>
          </div>
          <div className="animate-pulse" style={{ fontSize: `${width/3.5}px` }}>
             {getWeatherIcon(weather.weathercode)}
          </div>
       </div>

       {/* ÁREA DE CONTEÚDO ROTATIVA */}
       <div className="flex-1 overflow-hidden relative">
          {currentSlide === 0 && (
             subSlide === 0 ? renderHugeMetric("Vento", `${weather.wind_speed}`, "km/h", Wind, "text-blue-300") :
             subSlide === 1 ? renderHugeMetric("Chuva", `${weather.precipitation_probability}`, "%", CloudRain, "text-blue-400") :
             subSlide === 2 ? renderHugeMetric("Sensação", `${Math.round(Number(weather.apparent_temperature))}`, "°", ThermometerSun, "text-yellow-400") :
             renderHugeMetric("Umidade", `${weather.relative_humidity_2m}`, "%", Droplets, "text-blue-200")
          )}

          {currentSlide === 1 && hasBeachData && renderHugeBeach(beachReport[subSlide % beachReport.length])}
          {currentSlide === 2 && hasHourlyData && renderVerticalHourly()}
          {currentSlide === 3 && hasDailyData && renderHugeDaily(subSlide)}
       </div>

       {/* INDICADOR */}
       <div className="flex gap-3 justify-center mt-6 shrink-0">
          {[0, 1, 2, 3].map(i => (
             <div key={i} className={`h-2 rounded-full transition-all duration-500 ${currentSlide === i ? 'w-12 bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'w-3 bg-white/10'}`} />
          ))}
       </div>
    </div>
  );
};

export default WeatherWidget;
