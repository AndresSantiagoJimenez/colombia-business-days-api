# Colombia Business Days API
API REST para cálculo de fechas hábiles en Colombia considerando días festivos nacionales, horarios laborales y zona horaria. Desarrollada en TypeScript con arquitectura MVC.

## Características
1. Cálculo de fechas hábiles en Colombia

2. Considera días festivos nacionales

3. Horario laboral: Lunes a Viernes, 8:00 AM - 5:00 PM

4. Horario de almuerzo: 12:00 PM - 1:00 PM

5. Zona horaria: America/Bogotá con respuesta en UTC

6. Datos de festivos con respaldo automático

7. Validación completa de parámetros

8. Arquitectura escalable con TypeScript

## Estructura del Proyecto
src/
├── controllers/     # Lógica de endpoints API
├── services/        # Lógica de negocio y modelos
├── config/          # Configuraciones y constantes
├── types/           # Definiciones TypeScript
├── middleware/      # Middlewares personalizados
└── server.ts        # Servidor principal

## Instalación
## Opción 1: Docker (Recomendada)
# Desarrollo (con hot-reload)
docker-compose up business-days-api-dev

# Producción
docker-compose up business-days-api

## Opción 2: Instalación Local
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Producción
npm run build
npm start

## Configuración Docker
# Dockerfile.dev (Desarrollo)
- Hot-reload automático

- Incluye todas las dependencias de desarrollo

- Volúmenes montados para desarrollo en tiempo real

# Dockerfile (Producción)
- Imagen optimizada y segura

- Solo dependencias de producción

- Construcción previa de TypeScript

## Uso de la API
# Endpoints Disponibles
Método	   Endpoint	         Descripción
GET	       /	             Información general de la API
GET	       /health	         Estado de salud del servicio
GET	       /business-date	 Cálculo de fechas hábiles
GET	       /calculate	     Endpoint alternativo

# Parámetros para Cálculo
Parámetro	Tipo	            Requerido	Descripción
days	    integer	            Opcional	Días hábiles a sumar
hours	    integer	            Opcional	Horas hábiles a sumar
date	    string (ISO 8601)	Opcional	Fecha inicial en UTC (ej: 2025-01-14T15:00:00Z)

## Ejemplos de Uso
# Sumar 1 hora hábil desde ahora
curl "http://localhost:3000/business-date?hours=1"

# Sumar 1 día hábil
curl "http://localhost:3000/business-date?days=1"

# Combinar días y horas desde fecha específica
curl "http://localhost:3000/business-date?days=1&hours=4&date=2025-01-14T15:00:00Z"

# Caso con festivos (salta 17-18 abril 2025)
curl "http://localhost:3000/business-date?days=5&hours=4&date=2025-04-10T15:00:00Z"

## Respuestas
# Éxito (200 OK):
{
  "date": "2025-10-27T14:00:00Z"
}


# Error (400 Bad Request)::
{
  "error": "InvalidParameters",
  "message": "Detalle del error"
}

## Reglas de Negocio
- Días hábiles: Lunes a Viernes

- Horario laboral: 8:00 AM - 5:00 PM (hora Colombia)

- Almuerzo: 12:00 PM - 1:00 PM (excluido del cálculo)

- Festivos: Excluidos automáticamente

- Zona horaria: Cálculos en America/Bogota, respuesta en UTC

- Ajuste automático: Si la fecha inicial no es hábil, se ajusta al próximo horario/día hábil

## Arquitectura MVC
- Models (Modelos): services/ - Lógica de negocio y acceso a datos

- Views (Vistas): Respuestas JSON estructuradas

- Controllers (Controladores): controllers/ - Manejo de requests/responses

- Config: Configuraciones y constantes centralizadas

- Types: Tipado TypeScript para type safety

## Scripts Disponibles
npm run dev          # Desarrollo con hot-reload
npm run build        # Compilación TypeScript
npm start           # Producción
npm test            # Ejecutar pruebas
npm run lint        # Análisis de código

## Tecnologías
- TypeScript - Lenguaje tipado

- Express.js - Framework web

- Moment.js - Manejo de fechas y zonas horarias

- Axios - Cliente HTTP para servicios externos

- Docker - Contenerización

- Jest - Framework de testing

## Requisitos
- Node.js 18+ o Docker

- npm 9+

## Variables de Entorno
PORT=3000
NODE_ENV=development
HOLIDAYS_URL=https://content.capta.co/Recruitment/WorkingDays.json

## Despliegue
# Con Docker Compose
docker-compose up -d business-days-api

# Manual
npm run build
npm start

## Nota:
Los días festivos se obtienen automáticamente del servicio externo. En caso de indisponibilidad, se utilizan datos de respaldo predefinidos para 2024-2025.
