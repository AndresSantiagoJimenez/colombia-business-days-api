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
  }

  public async calculateBusinessDate(req: Request, res: Response): Promise<void> {
    try {
      const { days, hours, date } = req.query;

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

      const resultDate = await this.calculator.calculateBusinessDateTime(
        daysNum,
        hoursNum,
        date as string
      );

      const response: BusinessDaysResponse = {
        date: resultDate.toISOString().replace(/\.\d{3}Z$/, 'Z')
      };

      res.status(200).json(response);

    } catch (error) {
      this.handleError(error, res);
    }
  }

  private validateParameters(days: any, hours: any, date: any): ValidationResult {
    if (days !== undefined) {
      const daysNum = parseInt(days, 10);
      if (isNaN(daysNum) || daysNum < 0) {
        return { isValid: false, error: 'Days must be a positive integer' };
      }
    }

    if (hours !== undefined) {
      const hoursNum = parseInt(hours, 10);
      if (isNaN(hoursNum) || hoursNum < 0) {
        return { isValid: false, error: 'Hours must be a positive integer' };
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