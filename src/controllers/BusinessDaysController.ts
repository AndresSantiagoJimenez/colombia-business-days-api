import { Request, Response } from 'express';
import { BusinessDateCalculator } from '../services/BusinessDateCalculator';
import { 
  BusinessDaysRequest, 
  BusinessDaysResponse, 
  ErrorResponse, 
  ErrorType,
  ValidationResult 
} from '../types';

export class BusinessDaysController {
  private calculator: BusinessDateCalculator;

  constructor(calculator?: BusinessDateCalculator) {
    this.calculator = calculator || new BusinessDateCalculator();
    this.inicializarPreload(); // Inicializar pre-loading en segundo plano
  }

  /**
   * Inicializar pre-loading de recursos en segundo plano
   */
  private inicializarPreload(): void {
    // Usar setTimeout para no bloquear el startup del servidor
    setTimeout(async () => {
      try {
        console.log('Inicializando pre-loading de recursos...');
        
        // Llamar al método de pre-loading del calculator si existe
        if (typeof (this.calculator as any).inicializarCache === 'function') {
          await (this.calculator as any).inicializarCache();
        }
        
        console.log('Pre-loading de recursos completado');
      } catch (error) {
        console.warn('Pre-loading falló, pero la app sigue funcionando:', error);
      }
    }, 1000); // Esperar 1 segundo después del startup
  }

  public async calculateBusinessDate(req: Request, res: Response): Promise<void> {
    try {
      const { days, hours, date } = req.query;

      // Agregar log de performance
      const startTime = Date.now();
      
      const validationResult = this.validateParameters(days, hours, date);
      if (!validationResult.isValid) {
        const errorResponse: ErrorResponse = {
          error: ErrorType.INVALID_PARAMETERS,
          message: validationResult.error!
        };
        res.status(400).json(errorResponse);
        return;
      }

      const daysNum = days ? parseInt(days as string, 10) : 0;
      const hoursNum = hours ? parseInt(hours as string, 10) : 0;

      if (daysNum === 0 && hoursNum === 0) {
        const errorResponse: ErrorResponse = {
          error: ErrorType.INVALID_PARAMETERS,
          message: 'At least one of days or hours must be provided and greater than 0'
        };
        res.status(400).json(errorResponse);
        return;
      }

      console.log(`Calculando: ${daysNum} días + ${hoursNum} horas desde ${date || 'now'}`);

      const resultDate = await this.calculator.calculateBusinessDateTime(
        daysNum,
        hoursNum,
        date as string
      );

      // Log de performance
      const endTime = Date.now();
      console.log(`Tiempo de cálculo: ${endTime - startTime}ms`);

      const response: BusinessDaysResponse = {
        date: resultDate.toISOString().replace(/\.\d{3}Z$/, 'Z')
      };

      res.status(200).json(response);

    } catch (error) {
      this.handleError(error, res);
    }
  }

    // Nuevo endpoint para verificar estado del cache
  // Nuevo endpoint para verificar estado del cache - VERSIÓN CORREGIDA
  public async getCacheStatus(req: Request, res: Response): Promise<void> {
    try {
      // Usar el método público getCacheStatus del calculator
      const cacheStatus = this.calculator.getCacheStatus();
      
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        cache: cacheStatus
      });
    } catch (error) {
      console.error('Error getting cache status:', error);
      res.status(500).json({
        error: ErrorType.INTERNAL_ERROR,
        message: 'Failed to get cache status'
      });
    }
  }

  private validateParameters(days: any, hours: any, date: any): ValidationResult {
    if (days !== undefined) {
      const daysNum = parseInt(days, 10);
      if (isNaN(daysNum) || daysNum < 0) {
        return { isValid: false, error: 'Days must be a positive integer' };
      }
      
      // Validación para números muy grandes
      if (daysNum > 100000) {
        return { isValid: false, error: 'Days value too large. Maximum allowed: 100,000' };
      }
    }

    if (hours !== undefined) {
      const hoursNum = parseInt(hours, 10);
      if (isNaN(hoursNum) || hoursNum < 0) {
        return { isValid: false, error: 'Hours must be a positive integer' };
      }
      
      // Validación para números muy grandes
      if (hoursNum > 100000) {
        return { isValid: false, error: 'Hours value too large. Maximum allowed: 100,000' };
      }
    }

    if (date !== undefined) {
      try {
        const testDate = new Date(date as string);
        if (isNaN(testDate.getTime())) {
          return { isValid: false, error: 'Invalid date format. Use ISO 8601 format with Z suffix' };
        }
      } catch {
        return { isValid: false, error: 'Invalid date format. Use ISO 8601 format with Z suffix' };
      }
    }

    return { isValid: true };
  }

  private handleError(error: unknown, res: Response): void {
    console.error('Error calculating business date:', error);
    
    let errorResponse: ErrorResponse;
    
    if (error instanceof Error) {
      if (error.message.includes('Unable to fetch holidays')) {
        errorResponse = {
          error: ErrorType.SERVICE_UNAVAILABLE,
          message: 'Holidays service is temporarily unavailable'
        };
        res.status(503).json(errorResponse);
      } else if (error.message.includes('Invalid date')) {
        errorResponse = {
          error: ErrorType.INVALID_PARAMETERS,
          message: error.message
        };
        res.status(400).json(errorResponse);
      } else if (error.message.includes('too large')) {
        errorResponse = {
          error: ErrorType.INVALID_PARAMETERS,
          message: error.message
        };
        res.status(400).json(errorResponse);
      } else {
        errorResponse = {
          error: ErrorType.INTERNAL_ERROR,
          message: 'An internal server error occurred'
        };
        res.status(500).json(errorResponse);
      }
    } else {
      errorResponse = {
        error: ErrorType.INTERNAL_ERROR,
        message: 'An unexpected error occurred'
      };
      res.status(500).json(errorResponse);
    }
  }
}