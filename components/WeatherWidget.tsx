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
  const [currentSlide, setCurrentSlide] = useState(0); // 0: Metrics, 1: Beach, 2: Hourly, 3: Daily
  const [subSlide, setSubSlide] = useState(0); // Rotação interna de cada categoria

  const tempSize = Math.max(width / 3, 48);
  const hugeValueSize = Math.max(width / 4.5, 32);
  const labelSize = Math.max(width / 12, 14);
  const subLabelSize = Math.max(width / 20, 10);

  // Lógica de rotação a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setSubSlide(prev => {
        const next = prev + 1;
        
        // Verifica limites de cada slide para pular para o próximo global
        if (currentSlide === 0 && next >= 4) { setCurrentSlide(1); return 0; }
        if (currentSlide === 1 && next >= (beachReport?.length || 1)) { setCurrentSlide(2); return 0; }
        if (currentSlide === 2 && next >= 1) { setCurrentSlide(3); return 0; } // Hourly mostra tudo vertical ou 1 por 1? Vamos 1 por 1 vertical.
        if (currentSlide === 3 && next >= 5) { setCurrentSlide(0); return 0; }
        
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [currentSlide, beachReport]);

  const renderHugeMetric = (label: string, value: string, unit: string, Icon: any, color: string) => (
    <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center">
      <div className={`mb-4 ${color}`}><Icon size={width / 4} /></div>
      <div className="uppercase opacity-60 font-bold tracking-widest mb-2" style={{ fontSize: `${labelSize}px` }}>{label}</div>
      <div className="font-bold leading-none flex items-baseline gap-1" style={{ fontSize: `${hugeValueSize}px` }}>
        {value}<span className="opacity-50 font-light" style={{ fontSize: `${hugeValueSize/2}px` }}>{unit}</span>
      </div>
    </div>
  );

  const renderHugeBeach = (beach: any) => (
    <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center p-2">
      <Waves size={width / 6} className="text-blue-400 mb-4" />
      <div className="text-yellow-400 font-bold uppercase tracking-tighter mb-2" style={{ fontSize: `${labelSize * 1.2}px` }}>{beach.name}</div>
      <div className={`font-bold mb-4 ${beach.condition === 'Perigosa' ? 'text-red-500' : 'text-green-400'}`} style={{ fontSize: `${labelSize}px` }}>
        {beach.condition}
      </div>
      <div className="grid grid-cols-2 gap-8 w-full">
         <div>
            <div className="opacity-50 uppercase" style={{ fontSize: `${subLabelSize}px` }}>Água</div>
            <div className="font-bold" style={{ fontSize: `${hugeValueSize / 1.5}px` }}>{beach.water}</div>
         </div>
         <div>
            <div className="opacity-50 uppercase" style={{ fontSize: `${subLabelSize}px` }}>Ondas</div>
            <div className="font-bold" style={{ fontSize: `${hugeValueSize / 1.5}px` }}>{beach.waves}</div>
         </div>
      </div>
    </div>
  );

  const renderVerticalHourly = () => {
    const hourlyData = weather.hourly?.time
      .map((t, i) => ({ time: t, temp: weather.hourly?.temperature_2m?.[i] ?? 0, code: weather.hourly?.weathercode?.[i] ?? 0 }))
      .filter((_, i) => i % 3 === 0)
      .slice(0, 5);

    return (
      <div className="flex flex-col justify-between h-full py-4 animate-fade-in">
        {hourlyData?.map((item, i) => (
          <div key={i} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
            <span className="font-bold opacity-60" style={{ fontSize: `${labelSize}px` }}>{new Date(item.time).getHours()}h</span>
            <span style={{ fontSize: `${labelSize * 1.5}px` }}>{getWeatherIcon(item.code)}</span>
            <span className="font-bold text-white" style={{ fontSize: `${labelSize * 1.2}px` }}>{Math.round(item.temp)}°</span>
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
      <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center">
        <div className="text-yellow-400 font-bold uppercase mb-4" style={{ fontSize: `${labelSize}px` }}>{dayName}</div>
        <div className="mb-4" style={{ fontSize: `${width / 3.5}px` }}>{getWeatherIcon(weather.daily?.weathercode?.[index] ?? 0)}</div>
        <div className="flex gap-8 items-center mb-4">
           <div className="flex flex-col">
              <ArrowUp className="text-red-400 mx-auto" size={labelSize} />
              <span className="font-bold" style={{ fontSize: `${hugeValueSize}px` }}>{max}°</span>
           </div>
           <div className="flex flex-col">
              <ArrowDown className="text-blue-400 mx-auto" size={labelSize} />
              <span className="font-bold" style={{ fontSize: `${hugeValueSize}px` }}>{min}°</span>
           </div>
        </div>
        {rain > 0 && (
          <div className="flex items-center gap-2 text-blue-300 font-bold" style={{ fontSize: `${labelSize}px` }}>
            <CloudRain size={labelSize} /> {rain}% <span className="text-xs opacity-50">CHUVA</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-float flex flex-col w-full h-full bg-black/60 backdrop-blur-3xl border-2 border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
       
       {/* HEADER FIXO */}
       <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-4">
          <div>
              <div className="font-bold leading-none tracking-tighter text-white" style={{ fontSize: `${tempSize}px` }}>
                 {Math.round(Number(weather.temperature))}°
              </div>
              <div className="flex items-center gap-2 font-bold uppercase text-yellow-400 mt-2" style={{ fontSize: `${width/20}px` }}>
                 <MapPin size={width/20} /> {locationName.split('-')[0]}
              </div>
          </div>
          <div className="animate-pulse" style={{ fontSize: `${width/4}px` }}>
             {getWeatherIcon(weather.weathercode)}
          </div>
       </div>

       {/* ÁREA DE CONTEÚDO ROTATIVA */}
       <div className="flex-1 overflow-hidden">
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

       {/* INDICADOR DE POSIÇÃO NO RODAPÉ */}
       <div className="flex gap-2 justify-center mt-4">
          {[0, 1, 2, 3].map(i => (
             <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${currentSlide === i ? 'w-8 bg-yellow-400' : 'w-2 bg-white/20'}`} />
          ))}
       </div>
    </div>
  );
};

export default WeatherWidget;