import { BusinessHoursConfig, TimeRange } from '../types';

export const COLOMBIA_TIMEZONE: string = 'America/Bogota';
export const HOLIDAYS_URL: string = 'https://content.capta.co/Recruitment/WorkingDays.json';

export const BUSINESS_HOURS: BusinessHoursConfig = {
  workDay: {
    start: 8 * 60,   // 8:00 AM in minutes
    end: 17 * 60     // 5:00 PM in minutes
  },
  lunchBreak: {
    start: 12 * 60,  // 12:00 PM in minutes
    end: 13 * 60     // 1:00 PM in minutes
  }
};

export const WORKING_DAYS: number[] = [1, 2, 3, 4, 5]; // Monday to Friday
export const MINUTES_IN_HOUR: number = 60;
export const MINUTES_IN_DAY: number = 24 * 60;

// Configuración de la aplicación
export const APP_CONFIG = {
  //PORT: process.env.PORT || '3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 horas
  REQUEST_TIMEOUT: 10000 // 10 segundos para requests externos
};