import axios from 'axios';
import { Holiday } from '../types';
import { HOLIDAYS_URL, APP_CONFIG } from '../config';

export class HolidayService {
  private holidays: Map<string, Holiday> = new Map();
  private lastFetch: number = 0;
  private useFallback: boolean = false;
  private fetchPromise: Promise<void> | null = null; // 🆕 Evitar múltiples requests simultáneos
  private isPreloaded: boolean = false; // 🆕 Control de pre-carga

  // Festivos de Colombia 2024-2025 como respaldo
  private readonly FALLBACK_HOLIDAYS: Holiday[] = [
    // 2024
    { date: "2024-01-01T00:00:00.000Z", name: "Año Nuevo" },
    { date: "2024-01-08T00:00:00.000Z", name: "Día de los Reyes Magos" },
    { date: "2024-03-25T00:00:00.000Z", name: "Día de San José" },
    { date: "2024-03-28T00:00:00.000Z", name: "Jueves Santo" },
    { date: "2024-03-29T00:00:00.000Z", name: "Viernes Santo" },
    { date: "2024-05-01T00:00:00.000Z", name: "Día del Trabajo" },
    { date: "2024-05-13T00:00:00.000Z", name: "Día de la Ascensión" },
    { date: "2024-06-03T00:00:00.000Z", name: "Corpus Christi" },
    { date: "2024-06-10T00:00:00.000Z", name: "Sagrado Corazón" },
    { date: "2024-07-01T00:00:00.000Z", name: "San Pedro y San Pablo" },
    { date: "2024-07-20T00:00:00.000Z", name: "Día de la Independencia" },
    { date: "2024-08-07T00:00:00.000Z", name: "Batalla de Boyacá" },
    { date: "2024-08-19T00:00:00.000Z", name: "La Asunción" },
    { date: "2024-10-14T00:00:00.000Z", name: "Día de la Raza" },
    { date: "2024-11-04T00:00:00.000Z", name: "Todos los Santos" },
    { date: "2024-11-11T00:00:00.000Z", name: "Independencia de Cartagena" },
    { date: "2024-12-08T00:00:00.000Z", name: "Día de la Inmaculada Concepción" },
    { date: "2024-12-25T00:00:00.000Z", name: "Navidad" },
    
    // 2025
    { date: "2025-01-01T00:00:00.000Z", name: "Año Nuevo" },
    { date: "2025-01-06T00:00:00.000Z", name: "Día de los Reyes Magos" },
    { date: "2025-03-24T00:00:00.000Z", name: "Día de San José" },
    { date: "2025-04-17T00:00:00.000Z", name: "Jueves Santo" },
    { date: "2025-04-18T00:00:00.000Z", name: "Viernes Santo" },
    { date: "2025-05-01T00:00:00.000Z", name: "Día del Trabajo" },
    { date: "2025-06-02T00:00:00.000Z", name: "Día de la Ascensión" },
    { date: "2025-06-23T00:00:00.000Z", name: "Corpus Christi" },
    { date: "2025-06-30T00:00:00.000Z", name: "Sagrado Corazón" },
    { date: "2025-06-30T00:00:00.000Z", name: "San Pedro y San Pablo" },
    { date: "2025-07-20T00:00:00.000Z", name: "Día de la Independencia" },
    { date: "2025-08-07T00:00:00.000Z", name: "Batalla de Boyacá" },
    { date: "2025-08-18T00:00:00.000Z", name: "La Asunción" },
    { date: "2025-10-13T00:00:00.000Z", name: "Día de la Raza" },
    { date: "2025-11-03T00:00:00.000Z", name: "Todos los Santos" },
    { date: "2025-11-17T00:00:00.000Z", name: "Independencia de Cartagena" },
    { date: "2025-12-08T00:00:00.000Z", name: "Día de la Inmaculada Concepción" },
    { date: "2025-12-25T00:00:00.000Z", name: "Navidad" }
  ];

  public async getHolidays(): Promise<Map<string, Holiday>> {
    const now = Date.now();
    
    // 🆕 Si ya tenemos datos y no han expirado, retornar inmediatamente
    if (this.holidays.size > 0 && (now - this.lastFetch) < APP_CONFIG.CACHE_DURATION) {
      return this.holidays;
    }
    
    // 🆕 Si ya hay un fetch en progreso, esperar a que termine
    if (this.fetchPromise) {
      await this.fetchPromise;
      return this.holidays;
    }
    
    // Hacer nuevo fetch
    this.fetchPromise = this.fetchHolidays();
    await this.fetchPromise;
    this.fetchPromise = null;
    
    return this.holidays;
  }

  private async fetchHolidays(): Promise<void> {
    try {
      console.log('🔄 Fetching holidays from external service...');
      const response = await axios.get<Holiday[]>(HOLIDAYS_URL, {
        timeout: APP_CONFIG.REQUEST_TIMEOUT
      });
      
      // 🆕 Crear nuevo Map primero para evitar estado inconsistente
      const newHolidays = new Map<string, Holiday>();
      
      response.data.forEach(holiday => {
        const dateKey = holiday.date.split('T')[0];
        newHolidays.set(dateKey, holiday);
      });
      
      // 🆕 Atomic update
      this.holidays = newHolidays;
      this.lastFetch = Date.now();
      this.useFallback = false;
      console.log(`✅ Holidays loaded successfully: ${this.holidays.size} holidays`);
      
    } catch (error) {
      console.warn('⚠️ Unable to fetch holidays from external service, using fallback data');
      this.useFallbackData();
    }
  }

  private useFallbackData(): void {
    // 🆕 Crear nuevo Map en lugar de modificar el existente
    const newHolidays = new Map<string, Holiday>();
    
    this.FALLBACK_HOLIDAYS.forEach(holiday => {
      const dateKey = holiday.date.split('T')[0];
      newHolidays.set(dateKey, holiday);
    });
    
    this.holidays = newHolidays;
    this.lastFetch = Date.now();
    this.useFallback = true;
    console.log(`🛡️ Using fallback holidays data: ${this.holidays.size} holidays`);
  }

  // 🆕 Nuevo método: Pre-cargar festivos al inicializar
  public async preloadHolidays(): Promise<void> {
    if (this.isPreloaded) {
      return;
    }

    try {
      console.log('🚀 Pre-loading holidays...');
      await this.getHolidays();
      this.isPreloaded = true;
      console.log('✅ Holidays preloaded successfully');
    } catch (error) {
      console.warn('⚠️ Holiday preload failed, will load on first request:', error);
    }
  }

  // 🆕 Nuevo método: Verificar si es festivo sin obtener todos los holidays
  public async isHoliday(date: Date): Promise<boolean> {
    const holidays = await this.getHolidays();
    const dateKey = this.formatDateKey(date);
    return holidays.has(dateKey);
  }

  // 🆕 Nuevo método: Obtener festivos por rango (para optimización)
  public async getHolidaysInRange(startDate: Date, endDate: Date): Promise<Set<string>> {
    const holidays = await this.getHolidays();
    const holidaySet = new Set<string>();
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateKey = this.formatDateKey(currentDate);
      if (holidays.has(dateKey)) {
        holidaySet.add(dateKey);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return holidaySet;
  }

  public isUsingFallback(): boolean {
    return this.useFallback;
  }

  // 🆕 Nuevo método: Obtener estadísticas del cache
  public getCacheStatus(): { size: number; lastFetch: Date; usingFallback: boolean } {
    return {
      size: this.holidays.size,
      lastFetch: new Date(this.lastFetch),
      usingFallback: this.useFallback
    };
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}