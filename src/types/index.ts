export interface BusinessDaysRequest {
    days?: number;
    hours?: number;
    date?: string;
  }
  
  export interface BusinessDaysResponse {
    date: string;
  }
  
  export interface ErrorResponse {
    error: string;
    message: string;
  }
  
  export interface Holiday {
    date: string;
    name: string;
  }
  
  export interface TimeRange {
    start: number; // minutes from midnight
    end: number;   // minutes from midnight
  }
  
  export interface BusinessHoursConfig {
    workDay: TimeRange;
    lunchBreak: TimeRange;
  }
  
  export interface DateComponents {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  }
  
  // Enums para errores
  export enum ErrorType {
    INVALID_PARAMETERS = 'InvalidParameters',
    SERVICE_UNAVAILABLE = 'ServiceUnavailable',
    INTERNAL_ERROR = 'InternalError',
    NOT_FOUND = 'NotFound'
  }
  
  // Tipo para validación
  export interface ValidationResult {
    isValid: boolean;
    error?: string;
  }