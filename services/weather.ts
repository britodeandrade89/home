import { Coords, WeatherData } from '../types';

export const fetchWeatherData = async (coords: Coords): Promise<WeatherData | null> => {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America/Sao_Paulo`
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
        daily: data.daily
      };
    }
    return null;
  } catch (e) {
    console.error("Erro clima", e);
    return null;
  }
};