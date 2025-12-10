import React, { useEffect, useState } from 'react';
import { Wind, Waves, MapPin, Anchor } from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherWidgetProps {
  weather: WeatherData;
  locationName: string;
  beachReport: any; // Mantemos para compatibilidade, mas priorizamos a lógica local rápida
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, locationName }) => {
  const [advice, setAdvice] = useState("Analisando condições...");
  const [windDesc, setWindDesc] = useState("...");
  const [lastUpdate, setLastUpdate] = useState("");
  const [icon, setIcon] = useState("☀️");

  // Lógica "Hardcoded" inteligente baseada no exemplo do usuário
  useEffect(() => {
    if (!weather) return;

    // 1. Ícone e Conselho Básico
    const code = weather.weathercode;
    const temp = Number(weather.temperature);
    const humidity = weather.relative_humidity_2m || 0;
    
    let localIcon = "☀️";
    let localAdvice = "Dia lindo! Aproveite a praia.";

    if (code > 2) localIcon = "☁️"; 
    if (code >= 51) { localIcon = "🌧️"; localAdvice = "Pode chover. Leve guarda-chuva se sair."; }
    if (code >= 95) { localIcon = "⛈️"; localAdvice = "Alerta de tempestade. Evite o mar."; }
    
    // Ajuste noturno
    if (weather.is_day === 0 && code < 50) localIcon = "🌙";

    // Lógica de Recomendação (Simulando a IA)
    if (temp > 25 && code < 50) {
        if (humidity < 40) {
            localAdvice = "Sol forte e ar seco. Hidrate-se muito!";
        } else {
            localAdvice = "Água morna (est), vento agradável. Ideal para banho na Barra de Maricá.";
        }
    }

    setAdvice(localAdvice);
    setIcon(localIcon);

    // 2. Descrição do Vento
    const wind = weather.wind_speed;
    let wText = "Suave";
    if (wind > 15) wText = "Brisa do Mar";
    if (wind > 25) wText = "Vento Forte";
    setWindDesc(wText);

    // 3. Hora
    setLastUpdate(new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}));

  }, [weather]);

  return (
    <div className="animate-float flex flex-col w-full h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
        
       {/* HEADER */}
       <div className="flex justify-between items-start mb-4">
          <div>
              <div className="text-7xl font-bold leading-none tracking-tighter drop-shadow-xl">
                 {Math.round(Number(weather.temperature))}°
              </div>
              <div className="flex items-center gap-1 text-sm font-bold uppercase opacity-90 mt-2 text-yellow-400">
                 <MapPin size={12} /> {locationName}
              </div>
              <div className="text-xs opacity-70 mt-1">
                 Sensação {Math.round(Number(weather.apparent_temperature))}° • Umidade {weather.relative_humidity_2m}%
              </div>
          </div>
          <div className="text-7xl filter drop-shadow-lg animate-pulse">
             {icon}
          </div>
       </div>

       <div className="h-px w-full bg-white/20 my-2"></div>

       <div className="text-[10px] font-bold text-blue-300 uppercase mb-3 tracking-widest">
          Condições Atuais
       </div>

       {/* GRID DE DETALHES (Igual ao código fornecido) */}
       <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
             <span className="text-[10px] uppercase opacity-60 block mb-1 flex items-center gap-1"><Wind size={10}/> Vento</span>
             <div className="text-2xl font-bold">{weather.wind_speed} <small className="text-xs font-normal">km/h</small></div>
             <div className="text-[10px] opacity-80 mt-1 text-yellow-200">{windDesc}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
             <span className="text-[10px] uppercase opacity-60 block mb-1 flex items-center gap-1"><Waves size={10}/> Água (Est.)</span>
             <div className="text-2xl font-bold">~23°C</div>
             <div className="text-[10px] opacity-80 mt-1 text-blue-200">Refrescante</div>
          </div>
       </div>

       {/* RECOMENDAÇÃO (Estilo Box) */}
       <div className="bg-gradient-to-r from-yellow-900/40 to-orange-900/40 border-l-4 border-yellow-500 rounded-r-xl p-4 mb-auto">
          <div className="text-yellow-400 font-bold text-xs uppercase mb-1 flex items-center gap-2">
             <Anchor size={12} /> Análise Automática
          </div>
          <p className="text-sm font-medium leading-snug shadow-black drop-shadow-md">
             {advice}
          </p>
       </div>

       {/* FOOTER */}
       <div className="text-center text-[10px] opacity-40 mt-4">
          Atualizado às: {lastUpdate}
       </div>
    </div>
  );
};

export default WeatherWidget;