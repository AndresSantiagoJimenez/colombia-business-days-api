import moment from 'moment-timezone';
import { HolidayService } from './HolidayService';
import { 
  COLOMBIA_TIMEZONE, 
  BUSINESS_HOURS, 
  WORKING_DAYS, 
  MINUTES_IN_HOUR 
} from '../config';

export class BusinessDateCalculator {
  // === NUEVAS PROPIEDADES PARA DÍA 3 ===
  private holidayService: HolidayService;
  private holidayCache: Set<string> = new Set();
  private cacheLoaded: boolean = false;

  constructor() {
    this.holidayService = new HolidayService();
    this.inicializarCache();
  }

  // === MÉTODOS NUEVOS PARA CACHE ===
  public getCacheStatus() {
    return {
      localCache: {
        size: this.holidayCache.size,
        loaded: this.cacheLoaded
      },
      holidayService: this.holidayService.getCacheStatus ? this.holidayService.getCacheStatus() : { message: 'getCacheStatus not available' }
    };
  }

  public getHolidayService(): HolidayService {
    return this.holidayService;
  }

  private async inicializarCache(): Promise<void> {
    try {
      console.log('Inicializando cache de festivos...');
      await this.holidayService.preloadHolidays();
      await this.actualizarCacheLocal();
      console.log(`Cache de festivos inicializado: ${this.holidayCache.size} festivos`);
    } catch (error) {
      console.warn('Cache de festivos no pudo inicializarse:', error);
    }
  }

  private async actualizarCacheLocal(): Promise<void> {
    try {
      const holidays = await this.holidayService.getHolidays();
      this.holidayCache.clear();
      
      for (const [dateKey] of holidays) {
        this.holidayCache.add(dateKey);
      }
      
      this.cacheLoaded = true;
      console.log(`Cache local actualizado: ${this.holidayCache.size} festivos en cache`);
    } catch (error) {
      console.warn('No se pudo actualizar cache local:', error);
    }
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

    if (!currentDate.isValid()) {
      throw new Error('Invalid date provided');
    }

    console.log(`CALCULANDO: ${days} días + ${hours} horas desde ${currentDate.format('YYYY-MM-DD HH:mm')}`);

    // 1. Ajustar a tiempo hábil inicial
    currentDate = await this.adjustToBusinessTime(currentDate);
    
    // ESTRATEGIA OPTIMIZADA PARA GRANDES CANTIDADES
    if (days > 50 && hours === 0) {
      // Caso optimizado: muchos días, cero horas
      console.log('Usando estrategia optimizada para días masivos');
      currentDate = await this.agregarDiasMasivosOptimizado(currentDate, days);
    } else if (days > 0 || hours > 0) {
      // Caso general: usar método unificado
      const totalBusinessMinutes = this.calcularMinutosHabilesTotales(days, hours);
      console.log(`Minutos hábiles a agregar: ${totalBusinessMinutes}min`);
      currentDate = await this.agregarMinutosHabilesUnificado(currentDate, totalBusinessMinutes);
    }

    console.log(`RESULTADO FINAL: ${currentDate.format('YYYY-MM-DD HH:mm')}`);
    return currentDate.utc().toDate();
  }

  /**
   * Convierte días y horas a minutos hábiles totales
   */
  private calcularMinutosHabilesTotales(dias: number, horas: number): number {
    const minutosPorDiaHabil = (BUSINESS_HOURS.workDay.end - BUSINESS_HOURS.workDay.start) - 
                              (BUSINESS_HOURS.lunchBreak.end - BUSINESS_HOURS.lunchBreak.start);
    
    const totalMinutos = (dias * minutosPorDiaHabil) + (horas * MINUTES_IN_HOUR);
    
    // DEBUG DETALLADO
    console.log(`DEBUG Conversión Detallada:`);
    console.log(`Días: ${dias} × ${minutosPorDiaHabil}min/día = ${dias * minutosPorDiaHabil}min`);
    console.log(`Horas: ${horas} × ${MINUTES_IN_HOUR}min/hora = ${horas * MINUTES_IN_HOUR}min`);
    console.log(`TOTAL: ${totalMinutos}min`);
    
    return totalMinutos;
  }

  /**
   * Agrega minutos hábiles de manera unificada
   */
  private async agregarMinutosHabilesUnificado(
    fechaInicio: moment.Moment, 
    minutosTotales: number
  ): Promise<moment.Moment> {
    let fechaActual = fechaInicio.clone();
    let minutosRestantes = minutosTotales;

    console.log(`Iniciando adición unificada: ${minutosRestantes} minutos`);

    // Aumentar límite para grandes cantidades
    let iteracion = 0;
    const limiteIteraciones = Math.max(1000, minutosTotales / 480 * 2); //  Límite dinámico
    
    while (minutosRestantes > 0 && iteracion < limiteIteraciones) {
      iteracion++;
      
      // Asegurar que estamos en horario hábil
      fechaActual = await this.adjustToBusinessTime(fechaActual);
      
      const horaActual = this.obtenerMinutosDesdeMedianoche(fechaActual);
      const minutosDisponiblesHoy = this.calcularMinutosDisponiblesHoy(horaActual);
      
      // Log cada 50 iteraciones para no saturar console
      if (iteracion % 50 === 0) {
        console.log(`Iteración ${iteracion}: ${fechaActual.format('YYYY-MM-DD')} | Restante: ${minutosRestantes}min`);
      }

      if (minutosDisponiblesHoy >= minutosRestantes) {
        // Podemos completar todo hoy
        console.log(`Completando ${minutosRestantes} minutos hoy`);
        fechaActual = this.agregarMinutosEnDia(fechaActual, minutosRestantes);
        minutosRestantes = 0;
      } else {
        // Usar lo disponible hoy y continuar mañana
        fechaActual = this.agregarMinutosEnDia(fechaActual, minutosDisponiblesHoy);
        minutosRestantes -= minutosDisponiblesHoy;
        
        // Avanzar al siguiente día hábil
        fechaActual = await this.obtenerInicioSiguienteDiaHabil(fechaActual);
      }
    }

    if (iteracion >= limiteIteraciones) {
      console.error(`Límite de iteraciones alcanzado: ${iteracion}`);
      console.error(`Minutos restantes: ${minutosRestantes}`);
      console.error(`Fecha actual: ${fechaActual.format('YYYY-MM-DD HH:mm')}`);
    }

    return fechaActual;
  }

  /**
   * Calcula minutos hábiles disponibles en el día actual
   */
/**
 * Calcula minutos hábiles disponibles en el día actual - VERSIÓN CORREGIDA
 */
  private calcularMinutosDisponiblesHoy(horaActual: number): number {
    const inicioJornada = BUSINESS_HOURS.workDay.start;
    const finJornada = BUSINESS_HOURS.workDay.end;
    const inicioAlmuerzo = BUSINESS_HOURS.lunchBreak.start;
    const finAlmuerzo = BUSINESS_HOURS.lunchBreak.end;

    // VERIFICACIÓN DE DEBUG
    console.log(` DEBUG Disponibles - Hora: ${horaActual}, Almuerzo: ${inicioAlmuerzo}-${finAlmuerzo}, Jornada: ${inicioJornada}-${finJornada}`);

    let minutosDisponibles = 0;

    if (horaActual < inicioAlmuerzo) {
      // Antes del almuerzo: tiempo desde ahora hasta almuerzo
      minutosDisponibles = (inicioAlmuerzo - horaActual);
      console.log(`Antes almuerzo: ${minutosDisponibles}min hasta almuerzo`);
    } 
    
    // SIEMPRE agregar tiempo después del almuerzo (si estamos antes del fin de jornada)
    if (horaActual < finAlmuerzo) {
      // Si estamos antes o durante almuerzo, tiempo después de almuerzo
      minutosDisponibles += (finJornada - finAlmuerzo);
      console.log(`Después almuerzo: ${finJornada - finAlmuerzo}min`);
    } else if (horaActual >= finAlmuerzo) {
      // Si estamos después del almuerzo, tiempo desde ahora hasta fin de jornada
      minutosDisponibles += (finJornada - horaActual);
      console.log(`Después almuerzo (desde actual): ${finJornada - horaActual}min`);
    }

    console.log(`TOTAL disponibles: ${minutosDisponibles}min`);
    return Math.max(0, minutosDisponibles);
  }

  /**
   * Agrega minutos dentro de un mismo día, saltando el horario de almuerzo
   */
  private agregarMinutosEnDia(fecha: moment.Moment, minutosAAgregar: number): moment.Moment {
    let fechaActual = fecha.clone();
    let minutosRestantes = minutosAAgregar;

    console.log(`Agregando ${minutosAAgregar} minutos en el día: ${fechaActual.format('HH:mm')}`);

    while (minutosRestantes > 0) {
      const horaActual = this.obtenerMinutosDesdeMedianoche(fechaActual);
      const inicioAlmuerzo = BUSINESS_HOURS.lunchBreak.start;
      const finAlmuerzo = BUSINESS_HOURS.lunchBreak.end;
      const finJornada = BUSINESS_HOURS.workDay.end;

      // Si estamos en horario de almuerzo, saltar al final
      if (this.estaEnHorarioAlmuerzo(fechaActual)) {
        console.log('Saltando horario de almuerzo');
        fechaActual = this.establecerTiempoEnMinutos(fechaActual, finAlmuerzo);
        continue;
      }

      // Calcular segmento disponible
      let finSegmento: number;
      if (horaActual < inicioAlmuerzo) {
        finSegmento = inicioAlmuerzo;
      } else {
        finSegmento = finJornada;
      }

      const segmentoDisponible = finSegmento - horaActual;
      const minutosAAgregarAhora = Math.min(minutosRestantes, segmentoDisponible);

      console.log(`Segmento: ${horaActual}→${finSegmento} (${segmentoDisponible}min) | Agregando: ${minutosAAgregarAhora}min`);
      
      fechaActual = this.agregarMinutos(fechaActual, minutosAAgregarAhora);
      minutosRestantes -= minutosAAgregarAhora;

      // Si llegamos al inicio del almuerzo, saltarlo
      if (minutosRestantes > 0 && this.obtenerMinutosDesdeMedianoche(fechaActual) === inicioAlmuerzo) {
        fechaActual = this.establecerTiempoEnMinutos(fechaActual, finAlmuerzo);
      }
    }

    return fechaActual;
  }

  // MÉTODOS AUXILIARES (ya los tienes, los renombro para consistencia)

  private async adjustToBusinessTime(date: moment.Moment): Promise<moment.Moment> {
    let adjustedDate = date.clone();
    
    console.log(`Ajustando a tiempo hábil: ${adjustedDate.format('YYYY-MM-DD HH:mm')}`);
    
    while (!(await this.esDiaHabil(adjustedDate))) {
      console.log('No es día hábil, avanzando al siguiente día');
      adjustedDate = this.obtenerInicioSiguienteDia(adjustedDate);
    }

    const minutosActual = this.obtenerMinutosDesdeMedianoche(adjustedDate);
    const inicioJornada = BUSINESS_HOURS.workDay.start;
    const finJornada = BUSINESS_HOURS.workDay.end;

    if (minutosActual < inicioJornada) {
      console.log('Antes del horario laboral, ajustando a 8:00');
      adjustedDate = this.establecerTiempoEnMinutos(adjustedDate, inicioJornada);
    }
    else if (minutosActual >= finJornada) {
      console.log('Después del horario laboral, avanzando al siguiente día');
      adjustedDate = await this.obtenerInicioSiguienteDiaHabil(adjustedDate);
    }
    else if (this.estaEnHorarioAlmuerzo(adjustedDate)) {
      console.log('Durante almuerzo, ajustando a 13:00');
      adjustedDate = this.establecerTiempoEnMinutos(adjustedDate, BUSINESS_HOURS.lunchBreak.end);
    } else {
      console.log('Ya en horario hábil');
    }

    return adjustedDate;
  }

  // Método auxiliar para formatear clave
  private formatearClaveFecha(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async esDiaHabil(fecha: moment.Moment): Promise<boolean> {
    // Verificar día de semana primero (más rápido)
    const esDiaSemana = WORKING_DAYS.includes(fecha.isoWeekday());
    if (!esDiaSemana) {
      return false;
    }
    
    // 🆕 Usar cache local si está disponible
    const dateKey = this.formatearClaveFecha(fecha.toDate());
    
    if (this.cacheLoaded) {
      return !this.holidayCache.has(dateKey);
    }
    
    // Fallback al servicio si el cache no está listo
    return !(await this.holidayService.isHoliday(fecha.toDate()));
  }

  private async obtenerInicioSiguienteDiaHabil(fecha: moment.Moment): Promise<moment.Moment> {
    let siguienteDia = this.obtenerInicioSiguienteDia(fecha);
    while (!(await this.esDiaHabil(siguienteDia))) {
      siguienteDia = this.obtenerInicioSiguienteDia(siguienteDia);
    }
    return siguienteDia;
  }

  private obtenerInicioSiguienteDia(fecha: moment.Moment): moment.Moment {
    return this.establecerTiempoEnMinutos(fecha.add(1, 'day'), BUSINESS_HOURS.workDay.start);
  }

  private obtenerMinutosDesdeMedianoche(fecha: moment.Moment): number {
    return fecha.hours() * MINUTES_IN_HOUR + fecha.minutes();
  }

  private establecerTiempoEnMinutos(fecha: moment.Moment, minutos: number): moment.Moment {
    const horas = Math.floor(minutos / MINUTES_IN_HOUR);
    const mins = minutos % MINUTES_IN_HOUR;
    return fecha.hours(horas).minutes(mins).seconds(0).milliseconds(0);
  }

  private agregarMinutos(fecha: moment.Moment, minutos: number): moment.Moment {
    return fecha.add(minutos, 'minutes');
  }

  private estaEnHorarioAlmuerzo(fecha: moment.Moment): boolean {
    const minutos = this.obtenerMinutosDesdeMedianoche(fecha);
    return minutos >= BUSINESS_HOURS.lunchBreak.start && 
           minutos < BUSINESS_HOURS.lunchBreak.end;
  }

  /**
   * Método optimizado para grandes cantidades de días
   */
  private async agregarDiasMasivosOptimizado(
    fechaInicio: moment.Moment, 
    dias: number
  ): Promise<moment.Moment> {
    if (dias <= 10) {
      // Para pocos días, usar el método normal
      return await this.agregarMinutosHabilesUnificado(
        fechaInicio, 
        dias * 480 // 480 minutos por día hábil
      );
    }

    console.log(`Usando método optimizado para ${dias} días`);
    
    let fechaActual = fechaInicio.clone();
    let diasRestantes = dias;
    let iteracion = 0;

    // Estrategia: avanzar en bloques de semanas cuando sea posible
    while (diasRestantes > 0 && iteracion < 1000) {
      iteracion++;
      
      const diasEnSemanaActual = await this.calcularDiasHabilesEnSemana(fechaActual);
      const semanasCompletas = Math.floor(diasRestantes / diasEnSemanaActual);
      const diasEnUltimaSemana = diasRestantes % diasEnSemanaActual;
      
      if (semanasCompletas > 0) {
        // Avanzar semanas completas
        const diasASaltar = semanasCompletas * 7;
        fechaActual = fechaActual.add(diasASaltar, 'days');
        diasRestantes -= semanasCompletas * diasEnSemanaActual;
        console.log(`Saltando ${semanasCompletas} semanas (${diasASaltar} días)`);
      } else {
        // Avanzar días individuales en la última semana
        fechaActual = await this.avanzarDiasHabilesIndividuales(fechaActual, diasEnUltimaSemana);
        diasRestantes = 0;
      }
    }

    return fechaActual;
  }

  /**
   * Calcular días hábiles en una semana
   */
  private async calcularDiasHabilesEnSemana(fecha: moment.Moment): Promise<number> {
    let diasHabiles = 0;
    let fechaTemp = fecha.clone().startOf('isoWeek'); // Empezar el lunes
    
    for (let i = 0; i < 5; i++) { // Lunes a viernes
      if (await this.esDiaHabil(fechaTemp)) {
        diasHabiles++;
      }
      fechaTemp = fechaTemp.add(1, 'day');
    }
    
    return diasHabiles;
  }

  /**
   * Avanzar N días hábiles individualmente
   */
  private async avanzarDiasHabilesIndividuales(
    fecha: moment.Moment, 
    dias: number
  ): Promise<moment.Moment> {
    let fechaActual = fecha.clone();
    let diasAvanzados = 0;

    while (diasAvanzados < dias) {
      fechaActual = fechaActual.add(1, 'day');
      if (await this.esDiaHabil(fechaActual)) {
        diasAvanzados++;
      }
    }

    return this.establecerTiempoEnMinutos(fechaActual, BUSINESS_HOURS.workDay.start);
  }


}