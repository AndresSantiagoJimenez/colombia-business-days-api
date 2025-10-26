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
    
    // Mientras no sea día hábil, avanzar al siguiente día
    while (!(await this.isBusinessDay(adjustedDate))) {
      adjustedDate = this.getNextDayStart(adjustedDate);
    }

    const currentMinutes = this.getMinutesFromMidnight(adjustedDate);

    // Si antes del horario laboral, ajustar al inicio
    if (currentMinutes < BUSINESS_HOURS.workDay.start) {
      adjustedDate = this.setTimeToMinutes(adjustedDate, BUSINESS_HOURS.workDay.start);
    }
    // Si después del horario laboral, ir al siguiente día hábil
    else if (currentMinutes >= BUSINESS_HOURS.workDay.end) {
      adjustedDate = this.getNextDayStart(adjustedDate);
      adjustedDate = await this.adjustToBusinessTime(adjustedDate);
    }
    // Si durante almuerzo, ajustar al final del almuerzo
    else if (this.isDuringLunchBreak(adjustedDate)) {
      adjustedDate = this.setTimeToMinutes(adjustedDate, BUSINESS_HOURS.lunchBreak.end);
    }

    return adjustedDate;
  }

  private async addBusinessDays(date: moment.Moment, days: number): Promise<moment.Moment> {
    let currentDate = date.clone();
    let daysAdded = 0;

    while (daysAdded < days) {
      currentDate = currentDate.add(1, 'day');
      currentDate = this.setTimeToMinutes(currentDate, BUSINESS_HOURS.workDay.start);
      
      if (await this.isBusinessDay(currentDate)) {
        daysAdded++;
      }
    }

    return currentDate;
  }

  private async addBusinessHours(date: moment.Moment, hours: number): Promise<moment.Moment> {
    let currentDate = date.clone();
    let minutesRemaining = hours * MINUTES_IN_HOUR;

    while (minutesRemaining > 0) {
      const currentMinutes = this.getMinutesFromMidnight(currentDate);
      const workDayEnd = BUSINESS_HOURS.workDay.end;
      const lunchStart = BUSINESS_HOURS.lunchBreak.start;
      const lunchEnd = BUSINESS_HOURS.lunchBreak.end;

      let availableMinutes: number;

      if (currentMinutes < lunchStart) {
        availableMinutes = Math.min(lunchStart - currentMinutes, minutesRemaining);
        currentDate = this.addMinutes(currentDate, availableMinutes);
      } else if (currentMinutes >= lunchEnd) {
        availableMinutes = Math.min(workDayEnd - currentMinutes, minutesRemaining);
        if (availableMinutes > 0) {
          currentDate = this.addMinutes(currentDate, availableMinutes);
        } else {
          currentDate = this.getNextDayStart(currentDate);
          currentDate = await this.adjustToBusinessTime(currentDate);
        }
      } else {
        currentDate = this.setTimeToMinutes(currentDate, lunchEnd);
        continue;
      }

      minutesRemaining -= availableMinutes;

      if (minutesRemaining > 0 && this.getMinutesFromMidnight(currentDate) >= workDayEnd) {
        currentDate = this.getNextDayStart(currentDate);
        currentDate = await this.adjustToBusinessTime(currentDate);
      }
    }

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