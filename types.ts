export interface WeatherData {
  temperature: number | string;
  weathercode: number;
  is_day: number;
  apparent_temperature: number | string;
  precipitation_probability: number;
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