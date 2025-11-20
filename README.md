# Final Bell API

Backend API for the Final Bell Personal Trainer Platform and E-commerce Marketing Site.

## 🚀 Features

### Core Features
- **User Authentication** - JWT-based auth with refresh tokens and HTTP-only cookies
- **Role-Based Access Control** - Admin, Trainer, and Client roles
- **Workout & Meal Plans** - Templates and assignments for personal training
- **Progress Tracking** - Weight, measurements, and photo tracking
- **Stripe Integration** - Payment processing for e-commerce products
- **CSV Automation** - Automated product sync from muaythai-boxing.com FTP server
- **Messaging System** - Client-trainer communication
- **Subscription Management** - Stripe-based subscriptions

### Technical Features
- **Rate Limiting** - Protection against abuse and DDoS
- **Error Handling** - Comprehensive error logging and monitoring
- **Docker Support** - Full containerization with Docker Compose
- **CI/CD Ready** - GitHub Actions workflows for testing and deployment
- **Security** - Helmet.js, CORS, input validation, and SQL injection protection
- **Testing** - Jest testing framework with coverage reports

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js 5
- **Database**: MySQL 8.0 with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **Payments**: Stripe API
- **Security**: Helmet, CORS, express-rate-limit
- **Testing**: Jest, Supertest
- **DevOps**: Docker, GitHub Actions

## Setup Instructions

### 1. Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- npm or yarn

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Copy the example environment file and update it with your values:

```bash
cp .env.example .env
```

Edit `.env` and configure:
- `DATABASE_URL`: Your PostgreSQL connection string
- `JWT_SECRET`: A strong secret key for JWT tokens
- `REFRESH_TOKEN_SECRET`: A different secret key for refresh tokens
- Other optional configuration

### 4. Database Setup

#### Option 1: Local PostgreSQL

Install PostgreSQL and create a database:

```bash
# Create database
createdb final_bell_db

# Update DATABASE_URL in .env
DATABASE_URL="postgresql://username:password@localhost:5432/final_bell_db?schema=public"
```

#### Option 2: Prisma Postgres (Cloud)

```bash
# Start a local Prisma Postgres server
npx prisma dev

# Or connect to Prisma Postgres cloud
# Follow the prompts to create a cloud database
```

#### Option 3: Docker PostgreSQL

```bash
docker run --name final-bell-postgres \
  -e POSTGRES_DB=final_bell_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -d postgres:15
```

### 5. Run Database Migrations

```bash
# Create and run the initial migration
npx prisma migrate dev --name init

# This will:
# - Create all database tables
# - Generate the Prisma Client
# - Apply the migration to your database
```

### 6. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:8080`

## API Endpoints

### Health Check
- `GET /health` - Database health check

### Authentication (Coming Soon)
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user

### Users (Coming Soon)
- `GET /api/v1/users/profile` - Get current user profile
- `PUT /api/v1/users/profile` - Update profile
- `GET /api/v1/users/:id` - Get user by ID

### Workouts (Coming Soon)
- `GET /api/v1/workouts` - Get user's workouts
- `POST /api/v1/workouts` - Create workout
- `PUT /api/v1/workouts/:id` - Update workout
- `DELETE /api/v1/workouts/:id` - Delete workout

## Database Schema

The database includes the following main models:

- **User**: Core user model with role-based access
- **TrainerProfile**: Extended profile for trainers
- **ClientProfile**: Extended profile for clients
- **Exercise**: Exercise library
- **WorkoutTemplate**: Reusable workout templates
- **Workout**: Assigned workouts for clients
- **MealPlanTemplate**: Reusable meal plans
- **MealPlan**: Assigned meal plans
- **ProgressEntry**: Progress tracking with photos
- **Measurement**: Body measurements
- **Message**: In-app messaging
- **Subscription**: Payment subscriptions

## Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create a new migration
npx prisma migrate dev --name description_of_changes

# View database in Prisma Studio
npx prisma studio

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy
```

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Project Structure

```
src/
├── config/           # Configuration files
│   ├── database.ts   # Prisma client setup
│   └── env.ts        # Environment variables
├── middleware/       # Express middleware
├── routes/           # API routes
├── controllers/      # Request handlers
├── services/         # Business logic
├── utils/            # Utility functions
├── generated/        # Generated Prisma Client
└── server.ts         # Application entry point
```

## Next Steps

1. Set up authentication system (JWT)
2. Implement API routes for users, workouts, exercises
3. Add file upload for progress photos
4. Integrate Stripe for payments
5. Add email notifications
6. Implement real-time messaging (Socket.IO)

## License

ISC
