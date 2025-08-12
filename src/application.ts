require('dotenv').config();
import 'reflect-metadata';
import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container, Constructor } from '../framework/di/container';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
// {{AUTH_IMPORTS_START}}
import { AuthService } from '../framework/auth/auth.service';
import { authenticate } from '../framework/middleware/auth';
// {{AUTH_IMPORTS_END}}
import { sequelize } from '../framework/config/sequelize';
import { env } from '../framework/config/env';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { paramMetadataKey, contextMetadataKey } from '../framework/decorators';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

// Helper to dynamically load all modules in a directory to execute their decorators
function loadModulesFromDirectory(directory: string, filter: RegExp): void {
    const dirPath = path.join(process.cwd(), 'src', directory);
    console.log(`[DEBUG] loadModulesFromDirectory: Checking directory: ${dirPath}`); // DEBUG
    if (!fs.existsSync(dirPath)) {
        console.log(`[DEBUG] loadModulesFromDirectory: Directory does not exist: ${dirPath}`); // DEBUG
        return;
    }

    const files = fs.readdirSync(dirPath).filter(file => filter.test(file));
    console.log(`[DEBUG] loadModulesFromDirectory: Found files in ${directory}:`, files); // DEBUG

    for (const file of files) {
        try {
            require(path.join(dirPath, file));
            console.log(`[DEBUG] loadModulesFromDirectory: Successfully loaded module: ${file}`); // DEBUG
        } catch (error) {
            console.error(`[DEBUG] Failed to load module ${file}:`, error); // DEBUG
        }
    }
}

async function startServer() {
    console.log('Loading application modules to register metadata...');
    console.log('Loading models...');
    loadModulesFromDirectory('models', /\.model\.(ts|js)$/);
    console.log('Models loaded.');
    console.log('Loading dtos...');
    loadModulesFromDirectory('dtos', /\.dto\.(ts|js)$/);
    console.log('DTOs loaded.');
    console.log('Loading services...');
    loadModulesFromDirectory('services', /\.service\.(ts|js)$/);
    console.log('Services loaded.');

    // {{AUTH_SETUP_START}}
    if (env.AUTH_ENABLED) {
        container.register('AuthService', AuthService, { scope: 'singleton' });
    }
    // {{AUTH_SETUP_END}}

    const app = fastify({
        logger: { level: env.LOG_LEVEL || 'info', transport: { target: 'pino-pretty', options: { colorize: true } } },
    });

    if (env.ARCHITECTURE !== 'none') {
        try {
            await sequelize.authenticate();
            console.log('Database connection established.');

            // Executar migrations automaticamente
            console.log('Running database migrations...');
            execSync('npx sequelize-cli db:migrate', { stdio: 'inherit' });
            console.log('Database migrations completed.');

        } catch (error) {
            console.error('Database connection/migration failed:', error);
            process.exit(1);
        }
    }

    await app.register(helmet);
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
    await app.register(cookie);
    await app.register(fastifyStatic, { root: path.join(process.cwd(), 'public') });
    
    // {{AUTH_HOOK_START}}
    if (env.AUTH_ENABLED) {
        const publicRoutes = ['/auth/login', '/docs', '/login.html', '/js/login.js', '/users']; // Tornando /users público para o primeiro usuário
        app.addHook('onRequest', authenticate(env.JWT_SECRET!, publicRoutes));
    }
    // {{AUTH_HOOK_END}}

    const schemas = validationMetadatasToSchemas({
        refPointerPrefix: '#/definitions/',
    });

    for (const schemaName in schemas) {
        app.addSchema({
            $id: `#/definitions/${schemaName}`,
            ...schemas[schemaName],
        });
    }

    await app.register(swagger, {
        openapi: {
            info: { title: 'LightSpringTS API', version: '1.0.0' },
            components: {
                schemas: schemas as any,
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
            security: [{ bearerAuth: [] }],
        },
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
    console.log('Swagger UI available at /docs');

    const controllersDir = path.join(process.cwd(), 'src', 'controllers');
    console.log(`[DEBUG] Controller directory path: ${controllersDir}`); // DEBUG
    if (fs.existsSync(controllersDir)) {
        console.log(`[DEBUG] Controller directory exists: ${controllersDir}`); // DEBUG
        const controllerFiles = fs.readdirSync(controllersDir).filter(file => /\.controller\.(ts|js)$/.test(file));
        console.log(`[DEBUG] Found controller files:`, controllerFiles); // DEBUG
        console.log(`Found ${controllerFiles.length} controller(s). Registering routes...`);

        for (const file of controllerFiles) {
            const controllerModule = require(path.join(controllersDir, file));
            for (const key in controllerModule) {
                const ControllerClass = controllerModule[key];
                if (typeof ControllerClass === 'function' && Reflect.getMetadata('basePath', ControllerClass)) {
                    const basePath = Reflect.getMetadata('basePath', ControllerClass);
                    console.log(`[DEBUG] Found Controller: ${ControllerClass.name} with basePath: ${basePath}`); // DEBUG
                    const routes = Reflect.getMetadata('routes', ControllerClass) || [];

                    const paramTypes: Constructor[] = Reflect.getMetadata('design:paramtypes', ControllerClass) || [];
                    let controllerInstance;

                    if (paramTypes.length > 0) {
                        const dependencies = paramTypes.map(paramType => {
                            return container.resolve(paramType.name);
                        });
                        controllerInstance = new ControllerClass(...dependencies);
                    } else {
                        controllerInstance = new ControllerClass();
                    }

                    console.log(`  - Registering routes for ${ControllerClass.name} at base path '${basePath}'`);

                    routes.forEach((route: any) => {
                        const fullPath = path.join(basePath, route.path).replace(/\\/g, '/');
                        const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete';
                        if (typeof app[method] === 'function') {
                            app[method](fullPath, route.options, (req: FastifyRequest, reply: FastifyReply) => {
                                const args = [];
                                const params = Reflect.getMetadata(paramMetadataKey, controllerInstance, route.handlerName) || [];
                                params.forEach((param: any) => {
                                    args[param.index] = (req.params as any)[param.name];
                                });

                                const bodyParam = Reflect.getMetadata('bodyParam', controllerInstance, route.handlerName);
                                if (bodyParam) {
                                    args[bodyParam.index] = req.body;
                                }

                                const contextParam = Reflect.getMetadata(contextMetadataKey, controllerInstance, route.handlerName);
                                if (contextParam) {
                                    args[contextParam.index] = reply;
                                }
                                
                                return controllerInstance[route.handlerName](...args);
                            });
                            console.log(`    - Route: ${route.method.toUpperCase()} ${fullPath}`);
                        }
                    });
                }
            }
        }
    }

    try {
        await app.listen({ port: env.PORT, host: '0.0.0.0' });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

startServer();
