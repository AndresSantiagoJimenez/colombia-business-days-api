import moment from 'moment-timezone';
import { HolidayService } from './HolidayService';
import { 
  COLOMBIA_TIMEZONE, 
  BUSINESS_HOURS, 
  WORKING_DAYS, 
  MINUTES_IN_HOUR 
} from '../config';

export class BusinessDateCalculator {
  private holidayService: HolidayService;

  constructor() {
    this.holidayService = new HolidayService();
  }

  public async calculateBusinessDateTime(
    days: number = 0,
    hours: number = 0,
    startDate?: string
  ): Promise<Date> {
    let currentDate: moment.Moment;
    
    if (startDate) {
      currentDate = moment.utc(startDate).tz(COLOMBIA_TIMEZONE);
    } else {
      currentDate = moment().tz(COLOMBIA_TIMEZONE);
    }

    // Validar que la fecha sea válida
    if (!currentDate.isValid()) {
      throw new Error('Invalid date provided');
    }

    // Ajustar a tiempo hábil (AHORA ES ASYNC)
    currentDate = await this.adjustToBusinessTime(currentDate);

    if (days > 0) {
      currentDate = await this.addBusinessDays(currentDate, days);
    }

    if (hours > 0) {
      currentDate = await this.addBusinessHours(currentDate, hours);
    }

    return currentDate.utc().toDate();
  }

  // CAMBIO IMPORTANTE: Esta función ahora es async
  private async adjustToBusinessTime(date: moment.Moment): Promise<moment.Moment> {
      let adjustedDate = date.clone();
      
      console.log(`🔄 Adjusting to business time: ${adjustedDate.format('YYYY-MM-DD HH:mm')}`);
      
      // Mientras no sea día hábil, avanzar al siguiente día
      while (!(await this.isBusinessDay(adjustedDate))) {
          console.log('📅 Not business day, moving to next day');
          adjustedDate = this.getNextDayStart(adjustedDate);
      }

      const currentMinutes = this.getMinutesFromMidnight(adjustedDate);
      const workDayStart = BUSINESS_HOURS.workDay.start;
      const workDayEnd = BUSINESS_HOURS.workDay.end;
      const lunchStart = BUSINESS_HOURS.lunchBreak.start;
      const lunchEnd = BUSINESS_HOURS.lunchBreak.end;

      console.log(`⏰ Current: ${currentMinutes}min (${Math.floor(currentMinutes/60)}:${currentMinutes%60}), Work: ${workDayStart}-${workDayEnd}, Lunch: ${lunchStart}-${lunchEnd}`);

      // Si antes del horario laboral, ajustar al inicio
      if (currentMinutes < workDayStart) {
          console.log('🌅 Before work hours, adjusting to 8:00');
          adjustedDate = this.setTimeToMinutes(adjustedDate, workDayStart);
      }
      // Si después del horario laboral, ir al siguiente día hábil
      else if (currentMinutes >= workDayEnd) {
          console.log('🌇 After work hours, moving to next day');
          adjustedDate = this.getNextDayStart(adjustedDate);
          adjustedDate = await this.adjustToBusinessTime(adjustedDate);
      }
      // Si durante almuerzo, ajustar al final del almuerzo
      else if (this.isDuringLunchBreak(adjustedDate)) {
          console.log('🍽️ During lunch break, adjusting to 13:00');
          adjustedDate = this.setTimeToMinutes(adjustedDate, lunchEnd);
      } else {
          console.log('✅ Already in business hours');
      }

      return adjustedDate;
  }

  private async addBusinessHours(date: moment.Moment, hours: number): Promise<moment.Moment> {
      let currentDate = date.clone();
      let minutesRemaining = hours * MINUTES_IN_HOUR;

      console.log(`🕒 Starting hours calculation: ${hours} hours from ${currentDate.format('YYYY-MM-DD HH:mm')}`);

      while (minutesRemaining > 0) {
          // Asegurarnos de que estamos en horario laboral válido
          currentDate = await this.adjustToBusinessTime(currentDate);
          
          const currentMinutes = this.getMinutesFromMidnight(currentDate);
          const workDayStart = BUSINESS_HOURS.workDay.start;
          const workDayEnd = BUSINESS_HOURS.workDay.end;
          const lunchStart = BUSINESS_HOURS.lunchBreak.start;
          const lunchEnd = BUSINESS_HOURS.lunchBreak.end;

          console.log(`📊 Current: ${currentMinutes}min (${Math.floor(currentMinutes/60)}:${currentMinutes%60}), Remaining: ${minutesRemaining}min`);

          // Si estamos durante el almuerzo, saltar al final del almuerzo
          if (this.isDuringLunchBreak(currentDate)) {
              console.log('⏰ Skipping lunch break (12:00-13:00)');
              currentDate = this.setTimeToMinutes(currentDate, lunchEnd);
              continue;
          }

          // Determinar el final del bloque actual
          let blockEnd: number;
          if (currentMinutes < lunchStart) {
              blockEnd = lunchStart; // Bloque mañana (antes del almuerzo)
              console.log('🌅 Morning block (8:00-12:00)');
          } else {
              blockEnd = workDayEnd; // Bloque tarde (después del almuerzo)
              console.log('🌇 Afternoon block (13:00-17:00)');
          }

          const availableMinutes = Math.min(blockEnd - currentMinutes, minutesRemaining);
          
          console.log(`➡️ Adding ${availableMinutes} minutes (${Math.floor(availableMinutes/60)}h ${availableMinutes%60}m)`);

          if (availableMinutes > 0) {
              currentDate = this.addMinutes(currentDate, availableMinutes);
              minutesRemaining -= availableMinutes;
          }

          // Si terminamos en el fin del día laboral o aún tenemos minutos, ir al siguiente día
          if (minutesRemaining > 0) {
              console.log('📅 Moving to next business day');
              currentDate = this.setTimeToMinutes(currentDate.add(1, 'day'), workDayStart);
          }
      }

      console.log(`✅ Final result: ${currentDate.format('YYYY-MM-DD HH:mm')}`);
      return currentDate;
  }

  private async isBusinessDay(date: moment.Moment): Promise<boolean> {
    // Primero verificar si es día de semana (lunes a viernes)
    const isWeekday = WORKING_DAYS.includes(date.isoWeekday());
    if (!isWeekday) {
      return false;
    }
    
    // Luego verificar si no es festivo
    return !(await this.holidayService.isHoliday(date.toDate()));
  }

  // Nueva función auxiliar para obtener inicio del siguiente día
  private getNextDayStart(date: moment.Moment): moment.Moment {
    return this.setTimeToMinutes(date.add(1, 'day'), BUSINESS_HOURS.workDay.start);
  }

  private getNextBusinessDayStart(date: moment.Moment): Promise<moment.Moment> {
    return this.adjustToBusinessTime(this.getNextDayStart(date));
  }

  private getMinutesFromMidnight(date: moment.Moment): number {
    return date.hours() * MINUTES_IN_HOUR + date.minutes();
  }

  private setTimeToMinutes(date: moment.Moment, minutes: number): moment.Moment {
    const hours = Math.floor(minutes / MINUTES_IN_HOUR);
    const mins = minutes % MINUTES_IN_HOUR;
    return date.hours(hours).minutes(mins).seconds(0).milliseconds(0);
  }

  private addMinutes(date: moment.Moment, minutes: number): moment.Moment {
    return date.add(minutes, 'minutes');
  }

  private isDuringLunchBreak(date: moment.Moment): boolean {
    const minutes = this.getMinutesFromMidnight(date);
    return minutes >= BUSINESS_HOURS.lunchBreak.start && 
           minutes < BUSINESS_HOURS.lunchBreak.end;
  }
}