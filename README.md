# LightSpringTS

A lightweight, high-performance backend framework for Node.js and TypeScript, inspired by Spring Boot.

## Overview

LightSpringTS is designed to be a faster, lighter, and more memory-efficient alternative to Spring Boot for building scalable applications and microservices with TypeScript and Node.js. It aims to solve common Spring Boot issues like high complexity, high resource consumption, and slow startup times, while maintaining a familiar yet simplified structure. LightSpringTS empowers developers to focus 100% on business logic by automating repetitive configurations and offering an intuitive API.

## Key Objectives

- **Lightweight & Performance:** Utilizes Fastify for high performance and low memory consumption, with fast startup times.
- **Scalability:** Supports microservices with REST APIs and asynchronous messaging (e.g., RabbitMQ).
- **Smooth Learning Curve:** Intuitive APIs, CLI for scaffolding, and clear documentation.
- **Business Logic Focus:** Automates database configurations, routes, validations, and documentation.
- **Type Safety:** Full TypeScript integration with decorator support.
- **Flexibility:** Native support for multiple databases (MySQL, PostgreSQL, SQLite, MariaDB, SQL Server) via Sequelize and messaging (RabbitMQ, Kafka, Redis Streams).
- **Dependency Injection:** A lightweight and simple DI system.
- **Security & Stability:** Standard configurations for security, monitoring, and automated testing.

## Project Structure

```
lightspring-ts/
├── src/
│   ├── config/         # Centralizes environment variables
│   ├── controllers/    # Controllers with @Controller for routes
│   ├── services/       # Business services with @Service
│   ├── entities/       # Database models (Sequelize)
│   ├── repositories/   # Repositories for data access
│   ├── middleware/     # Custom middlewares (e.g., authentication)
│   ├── messaging/      # Messaging configurations (e.g., RabbitMQ)
│   ├── decorators/     # Custom decorators (@Controller, @Service, @Inject, etc.)
│   ├── di/             # Dependency Injection container
│   └── main.ts         # Application entry point
├── package.json
├── tsconfig.json
├── lightspringts-cli/  # CLI for scaffolding
└── README.md
```

## Core Features

- **TypeScript-First:** Full TypeScript support with decorators (`@Controller`, `@Service`, `@Inject`, `@Get`, `@Post`, etc.).
- **Sequelize ORM:** Automatic configuration for popular databases with migration support.
- **Dependency Injection:** Lightweight DI container with automatic dependency resolution.
- **Centralized Configuration:** `env.ts` for managing environment variables.
- **Integrated Messaging:** Native RabbitMQ support, with future extensibility to Kafka and Redis Streams.
- **Optimized Performance:** Uses Fastify for REST APIs.
- **Scalability:** Modular architecture for microservices.
- **CLI for Scaffolding:** `lightspringts-cli` to generate controllers, services, entities, and migrations.
- **Automatic Documentation:** Swagger/OpenAPI generation based on decorators and DTOs.

## Getting Started

To get started with LightSpringTS, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-org/lightspring-ts.git
    cd lightspring-ts
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run in development mode:**
    ```bash
    npm run dev
    ```
4.  **Build for production:**
    ```bash
    npm run build
    ```
5.  **Run in production:**
    ```bash
    npm start
    ```

## Contributing

We welcome contributions! Please see our `CONTRIBUTING.md` (to be created) for more details.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
