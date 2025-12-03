import React from 'react';
import { CloudRain, Sun, Cloud, Moon, MapPin, Thermometer, Droplets, CloudLightning } from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherWidgetProps {
  weather: WeatherData;
  locationName: string;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, locationName }) => {
  const getWeatherIcon = () => {
    if (weather.weathercode >= 95) return <CloudLightning className="text-purple-300 w-20 h-20 filter drop-shadow-lg" />;
    if (weather.weathercode >= 51) return <CloudRain className="text-blue-300 w-20 h-20 filter drop-shadow-lg" />;
    if (weather.weathercode >= 2) return <Cloud className="text-gray-300 w-20 h-20 filter drop-shadow-lg" />;
    return weather.is_day === 1 ? <Sun className="text-yellow-300 w-20 h-20 filter drop-shadow-lg" /> : <Moon className="text-yellow-100 w-20 h-20 filter drop-shadow-lg" />;
  };

  return (
    <div className="flex items-center gap-6 p-4 rounded-3xl bg-black/20 backdrop-blur-sm border border-white/5 shadow-2xl">
       <div className="flex flex-col items-end text-white">
          <span className="text-7xl font-bold tracking-tighter leading-none drop-shadow-xl">
            {weather.temperature !== '--' ? `${Math.round(Number(weather.temperature))}°` : '--'}
          </span>
          <span className="text-xs uppercase tracking-widest font-bold flex items-center gap-1 mb-2 opacity-90">
             <MapPin size={12} className="text-green-400" /> {locationName}
          </span>
          
          <div className="flex gap-4 mt-1 bg-black/40 px-3 py-1.5 rounded-full border border-white/10">
            <span className="flex items-center gap-1.5 text-base font-bold text-yellow-200">
                <Thermometer size={16} /> 
                {weather.apparent_temperature}°
            </span>
            <div className="w-px h-4 bg-white/20 self-center"></div>
            <span className="flex items-center gap-1.5 text-base font-bold text-blue-200">
                <Droplets size={16} /> 
                {weather.precipitation_probability}%
            </span>
          </div>
       </div>
       <div className="filter drop-shadow-2xl animate-pulse">{getWeatherIcon()}</div>
    </div>
  );
};

export default WeatherWidget;