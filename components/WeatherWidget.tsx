import React from 'react';
import { CloudRain, Sun, Cloud, Moon, MapPin, Thermometer, Droplets, CloudLightning } from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherWidgetProps {
  weather: WeatherData;
  locationName: string;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, locationName }) => {
  const getWeatherIcon = () => {
    if (weather.weathercode >= 95) return <CloudLightning className="text-purple-300 w-16 h-16" />;
    if (weather.weathercode >= 51) return <CloudRain className="text-blue-300 w-16 h-16" />;
    if (weather.weathercode >= 2) return <Cloud className="text-gray-300 w-16 h-16" />;
    return weather.is_day === 1 ? <Sun className="text-yellow-300 w-16 h-16" /> : <Moon className="text-yellow-100 w-16 h-16" />;
  };

  return (
    <div className="flex items-center gap-4">
       <div className="flex flex-col items-end drop-shadow-lg text-white">
          <span className="text-6xl font-medium tracking-tight leading-none">
            {weather.temperature !== '--' ? `${Math.round(Number(weather.temperature))}°` : '--'}
          </span>
          <span className="text-xs uppercase tracking-widest opacity-90 mt-1 font-medium flex items-center gap-1">
             <MapPin size={10} className="text-green-400" /> {locationName}
          </span>
          <div className="flex gap-3 mt-2 text-sm font-light opacity-80">
            <span className="flex items-center gap-1"><Thermometer size={14} /> {weather.apparent_temperature}°</span>
            <span className="flex items-center gap-1"><Droplets size={14} /> {weather.precipitation_probability}%</span>
          </div>
       </div>
       <div className="drop-shadow-xl">{getWeatherIcon()}</div>
    </div>
  );
};

export default WeatherWidget;