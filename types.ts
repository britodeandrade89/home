export interface DailyForecast {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
}

export interface WeatherData {
  temperature: number | string;
  weathercode: number;
  is_day: number;
  apparent_temperature: number | string;
  precipitation_probability: number;
  wind_speed: number;
  daily?: DailyForecast;
}

export interface Reminder {
  id: string;
  text: string;
  type: 'info' | 'alert' | 'action';
  time: string;
  createdAt?: any;
}

export interface NewsItem {
  text: string;
  time: string;
  img: string;
}

export interface NewsData {
  politica: NewsItem[];
  esportes: NewsItem[];
  cultura: NewsItem[];
}

export interface Coords {
  lat: number;
  lon: number;
}

// Augment Window for Speech Recognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}