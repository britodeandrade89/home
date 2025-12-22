import React, { useEffect, useState } from 'react';
import { Wind, Waves, MapPin, Droplets, ThermometerSun, CloudRain, Calendar, Clock, ArrowUp, ArrowDown } from 'lucide-react';
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
  const [currentSlide, setCurrentSlide] = useState(0); // 0: Métricas, 1: Praia, 2: Horário, 3: Diário
  const [subSlide, setSubSlide] = useState(0);

  const tempSize = Math.max(width / 3, 48);
  const hugeValueSize = Math.max(width / 4, 40);
  const labelSize = Math.max(width / 11, 16);
  const subLabelSize = Math.max(width / 18, 12);

  useEffect(() => {
    const interval = setInterval(() => {
      setSubSlide(prev => {
        const next = prev + 1;
        // Rotação Global
        if (currentSlide === 0 && next >= 4) { setCurrentSlide(1); return 0; }
        if (currentSlide === 1 && next >= (beachReport?.length || 1)) { setCurrentSlide(2); return 0; }
        if (currentSlide === 2 && next >= 1) { setCurrentSlide(3); return 0; }
        if (currentSlide === 3 && next >= 5) { setCurrentSlide(0); return 0; }
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [currentSlide, beachReport]);

  const renderHugeMetric = (label: string, value: string, unit: string, Icon: any, color: string) => (
    <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center">
      <div className={`mb-6 ${color}`}><Icon size={width / 3.5} /></div>
      <div className="uppercase opacity-60 font-bold tracking-[0.2em] mb-3" style={{ fontSize: `${labelSize}px` }}>{label}</div>
      <div className="font-bold leading-none flex items-baseline gap-1" style={{ fontSize: `${hugeValueSize * 1.2}px` }}>
        {value}<span className="opacity-50 font-light" style={{ fontSize: `${hugeValueSize/1.5}px` }}>{unit}</span>
      </div>
    </div>
  );

  const renderHugeBeach = (beach: any) => (
    <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center p-4">
      <Waves size={width / 5} className="text-blue-400 mb-6" />
      <div className="text-yellow-400 font-bold uppercase tracking-tight mb-4" style={{ fontSize: `${labelSize * 1.3}px` }}>{beach.name}</div>
      <div className={`font-bold mb-6 ${beach.condition === 'Perigosa' ? 'text-red-500' : 'text-green-400'}`} style={{ fontSize: `${labelSize}px` }}>
        {beach.condition}
      </div>
      <div className="grid grid-cols-2 gap-10 w-full">
         <div>
            <div className="opacity-50 uppercase mb-1" style={{ fontSize: `${subLabelSize}px` }}>Água</div>
            <div className="font-bold" style={{ fontSize: `${hugeValueSize / 1.2}px` }}>{beach.water}</div>
         </div>
         <div>
            <div className="opacity-50 uppercase mb-1" style={{ fontSize: `${subLabelSize}px` }}>Ondas</div>
            <div className="font-bold" style={{ fontSize: `${hugeValueSize / 1.2}px` }}>{beach.waves}</div>
         </div>
      </div>
    </div>
  );

  const renderVerticalHourly = () => {
    // Cobertura total: 0, 3, 6, 9, 12, 15, 18, 21, 00(next)
    // Mostramos 9 itens para cobrir o ciclo completo até o inicio do dia seguinte
    const hourlyData = weather.hourly?.time
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
        {hourlyData?.map((item, i) => (
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

          {currentSlide === 1 && beachReport && renderHugeBeach(beachReport[subSlide % beachReport.length])}
          {currentSlide === 2 && renderVerticalHourly()}
          {currentSlide === 3 && renderHugeDaily(subSlide)}
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