import { Coords, WeatherData } from '../types';

export const fetchCityName = async (lat: number, lon: number): Promise<string> => {
  // Para Maricá fixo, nem precisamos gastar quota de API de geocoding, 
  // mas mantemos a função para compatibilidade.
  return "Maricá - RJ"; 
};

export const fetchWeatherData = async (coords: Coords): Promise<WeatherData | null> => {
  try {
    const lat = coords.lat; 
    const lon = coords.lon;

    // Added hourly=temperature_2m to the request
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,is_day,precipitation&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo`;

    const res = await fetch(url);
    const data = await res.json();
    
    if (!data || !data.current) throw new Error("Dados inválidos da API");

    const current = data.current;
    
    return {
      temperature: current.temperature_2m,
      apparent_temperature: current.apparent_temperature,
      weathercode: current.weather_code,
      is_day: current.is_day,
      // API 'current' generally has 'precipitation' or we use hourly for probability
      precipitation_probability: data.hourly?.precipitation_probability?.[new Date().getHours()] || 0,
      wind_speed: current.wind_speed_10m,
      relative_humidity_2m: current.relative_humidity_2m,
      daily: data.daily,
      hourly: data.hourly
    };
  } catch (e) {
    console.error("Erro clima Open-Meteo:", e);
    return null;
  }
};