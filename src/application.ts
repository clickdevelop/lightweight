require('dotenv').config();
import 'reflect-metadata';
import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container, Constructor } from '../framework/di/container';
import { AuthService } from '../framework/auth/auth.service';
import { sequelize } from '../framework/config/sequelize';
import { env } from '../framework/config/env';
import * as fs from 'fs';
import * as path from 'path';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { authenticate } from '../framework/middleware/auth';
import { paramMetadataKey, contextMetadataKey } from '../framework/decorators';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

// Helper to dynamically load all modules in a directory to execute their decorators
function loadModulesFromDirectory(directory: string, filter: RegExp): void {
    const dirPath = path.join(process.cwd(), 'src', directory);
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath).filter(file => filter.test(file));
    for (const file of files) {
        try {
            require(path.join(dirPath, file));
        } catch (error) {
            console.error(`Failed to load module ${file}:`, error);
        }
    }
}

async function startServer() {
    console.log('Loading application modules to register metadata...');
    loadModulesFromDirectory('models', /\.model\.(ts|js)$/);
    loadModulesFromDirectory('dtos', /\.dto\.(ts|js)$/);
    loadModulesFromDirectory('services', /\.service\.(ts|js)$/);

    // Register and instantiate AuthService for bootstrapping
    container.register('AuthService', AuthService);
    container.resolve('AuthService');

    const app = fastify({
        logger: { level: env.LOG_LEVEL || 'info', transport: { target: 'pino-pretty', options: { colorize: true } } },
    });

    if (env.ARCHITECTURE !== 'none') {
        try {
            await sequelize.authenticate();
            console.log('Database connection established.');
            await sequelize.sync({ force: false });
            console.log('Database synchronized.');

            // Mover a inicialização do AuthService para cá
            container.register('AuthService', AuthService, { scope: 'singleton' });
            const authServiceInstance = container.resolve('AuthService') as AuthService;
            await authServiceInstance['bootstrapAdminUser'](); // Chamar explicitamente o método

        } catch (error) {
            console.error('Database connection failed:', error);
            process.exit(1);
        }
    }

    await app.register(helmet);
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
    await app.register(cookie);
    await app.register(fastifyStatic, { root: path.join(process.cwd(), 'public') });
    if (env.AUTH_ENABLED) {
        const publicRoutes = ['/auth/login', '/docs', '/login.html', '/js/login.js']; // Rotas públicas
        app.addHook('onRequest', authenticate(env.JWT_SECRET!, publicRoutes));
    }

    // Generate schemas from the global metadata storage, using the OpenAPI 3.0 standard for references
    const schemas = validationMetadatasToSchemas({
        refPointerPrefix: '#/components/schemas/',
    });

    // Explicitly register each schema with Fastify before registering swagger
    for (const schemaName in schemas) {
        app.addSchema({
            $id: schemaName,
            ...schemas[schemaName],
        });
    }

    await app.register(swagger, {
        openapi: {
            info: { title: 'LightSpringTS API', version: '1.0.0' },
            // Pass the schemas to the components section for the OpenAPI document
            components: {
                schemas: schemas as any,
            },
        },
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
    console.log('Swagger UI available at /docs');

    const controllersDir = path.join(process.cwd(), 'src', 'controllers');
    if (fs.existsSync(controllersDir)) {
        const controllerFiles = fs.readdirSync(controllersDir).filter(file => /\.controller\.(ts|js)$/.test(file));
        console.log(`Found ${controllerFiles.length} controller(s). Registering routes...`);

        for (const file of controllerFiles) {
            const controllerModule = require(path.join(controllersDir, file));
            for (const key in controllerModule) {
                const ControllerClass = controllerModule[key];
                if (typeof ControllerClass === 'function' && Reflect.getMetadata('basePath', ControllerClass)) {
                    const basePath = Reflect.getMetadata('basePath', ControllerClass);
                    const routes = Reflect.getMetadata('routes', ControllerClass) || [];

                    // Removendo a injeção automática de serviços
                    // const serviceName = `${ControllerClass.name.replace('Controller', '')}Service`;
                    // const serviceInstance = container.resolve(serviceName);

                    // if (!serviceInstance) {
                    //     console.warn(`  [Warning] Could not resolve service '${serviceName}' for controller '${ControllerClass.name}'. Skipping.`);
                    //     continue;
                    // }

                    // Instanciando o controlador sem passar um serviço automaticamente
                    const paramTypes: Constructor[] = Reflect.getMetadata('design:paramtypes', ControllerClass) || [];
                    let controllerInstance;

                    if (paramTypes.length > 0) {
                        // Se o controlador tem parâmetros no construtor, tentar resolvê-los como serviços
                        const dependencies = paramTypes.map(paramType => {
                            // Assumimos que o nome do parâmetro do construtor corresponde ao nome do serviço registrado
                            return container.resolve(paramType.name);
                        });
                        controllerInstance = new ControllerClass(...dependencies);
                    } else {
                        // Se não tem parâmetros no construtor, instanciar diretamente
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
