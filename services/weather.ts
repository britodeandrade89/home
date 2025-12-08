import { Coords, WeatherData } from '../types';

export const fetchCityName = async (lat: number, lon: number): Promise<string> => {
  try {
    // Using OpenStreetMap Nominatim for Reverse Geocoding (Free, no key required)
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
    const data = await res.json();
    
    if (data && data.address) {
      // Priority: city -> town -> village -> municipality -> suburb
      const city = data.address.city || data.address.town || data.address.village || data.address.municipality || data.address.suburb;
      const state = data.address.state_code || data.address.state; // e.g., "RJ"
      
      if (city) {
         // Return formatted name like "Maricá - RJ" or just "Maricá"
         return state ? `${city} - ${state}` : city;
      }
    }
    return "Local Desconhecido";
  } catch (e) {
    console.error("Erro ao buscar nome da cidade:", e);
    return "Local Atual"; // Fallback
  }
};

export const fetchWeatherData = async (coords: Coords): Promise<WeatherData | null> => {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,relative_humidity_2m,surface_pressure,visibility&hourly=precipitation_probability,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=America/Sao_Paulo`
    );
    const data = await res.json();
    
    if (data.current) {
      const h = new Date().getHours();
      return {
        temperature: data.current.temperature_2m,
        apparent_temperature: data.current.apparent_temperature,
        weathercode: data.current.weather_code,
        is_day: data.current.is_day,
        precipitation_probability: data.hourly?.precipitation_probability?.[h] || 0,
        wind_speed: data.current.wind_speed_10m,
        // New fields
        relative_humidity_2m: data.current.relative_humidity_2m,
        surface_pressure: data.current.surface_pressure,
        visibility: data.current.visibility,
        uv_index: data.hourly?.uv_index?.[h] || 0,
        uv_index_max: data.daily?.uv_index_max,
        daily: data.daily
      };
    }
    return null;
  } catch (e) {
    console.error("Erro clima", e);
    return null;
  }
};