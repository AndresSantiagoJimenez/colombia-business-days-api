import express from 'express';
import { BusinessDaysController } from './controllers/BusinessDaysController';
import { APP_CONFIG } from './config';

class Server {
  private app: express.Application;
  private port: number;
  private controller: BusinessDaysController;

  constructor() {
    this.app = express();
    //IMPORTANTE: Render usa process.env.PORT
    this.port = parseInt(process.env.PORT || '10000', 10);
    this.controller = new BusinessDaysController();
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  private configureMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Logging middleware
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private configureRoutes(): void {
    this.app.use((req, res, next) => {
      console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      console.log('Health check called');
      res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: APP_CONFIG.NODE_ENV
      });
    });

    // Business days calculation endpoints
    this.app.get('/business-date', (req, res) => {
      this.controller.calculateBusinessDate(req, res);
    });

    this.app.get('/calculate', (req, res) => {
      this.controller.calculateBusinessDate(req, res);
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Colombia Business Days API',
        endpoints: {
          health: '/health',
          businessDate: '/business-date',
          calculate: '/calculate'
        },
        usage: {
          example1: '/business-date?hours=1',
          example2: '/business-date?days=1&hours=4&date=2025-01-14T15:00:00Z'
        }
      });
    });
  }

  private configureErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'NotFound',
        message: 'Endpoint not found'
      });
    });

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error);
      res.status(500).json({
        error: 'InternalError',
        message: 'An unexpected error occurred'
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`Server running on port ${this.port}`);
      console.log(`Environment: ${APP_CONFIG.NODE_ENV}`);
      console.log(`Endpoints:`);
      console.log(`   http://localhost:${this.port}/`);
      console.log(`   http://localhost:${this.port}/health`);
      console.log(`   http://localhost:${this.port}/business-date`);
      console.log(`   http://localhost:${this.port}/calculate`);
    });
  }
}

// Start the server
const server = new Server();
server.start();

export default server;