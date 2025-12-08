import { Coords, WeatherData } from '../types';

export const fetchCityName = async (lat: number, lon: number): Promise<string> => {
  // Para Maricá fixo, nem precisamos gastar quota de API de geocoding, 
  // mas mantemos a função para compatibilidade.
  return "Maricá - RJ"; 
};

export const fetchWeatherData = async (coords: Coords): Promise<WeatherData | null> => {
  try {
    // URL baseada no exemplo fornecido, mas mantendo daily para a previsão futura
    // Coordenadas fixas de Maricá se preferir, ou as passadas pelo App
    const lat = coords.lat; 
    const lon = coords.lon;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo`;

    const res = await fetch(url);
    const data = await res.json();
    
    if (!data || !data.current) throw new Error("Dados inválidos da API");

    const current = data.current;
    
    return {
      temperature: current.temperature_2m,
      apparent_temperature: current.apparent_temperature,
      weathercode: current.weather_code,
      is_day: current.is_day,
      precipitation_probability: 0, // A API current simples não retorna prob de chuva instantanea, usamos o weathercode para inferir
      wind_speed: current.wind_speed_10m,
      relative_humidity_2m: current.relative_humidity_2m,
      daily: data.daily
    };
  } catch (e) {
    console.error("Erro clima Open-Meteo:", e);
    return null;
  }
};