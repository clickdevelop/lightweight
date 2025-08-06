import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { container } from '../di/container';
import { redisClient } from '../cache/redis';
import { AppEventEmitter } from '../events/EventEmitter';
import { FastifySchema } from 'fastify';

import { v4 as uuidv4 } from 'uuid';

const injectMetadataKey = Symbol('inject');
export const uuidMetadataKey = Symbol('uuid');
export const paramMetadataKey = Symbol('param');
export const contextMetadataKey = Symbol('context');

// Helper type for route options
type RouteOptions = {
  schema?: FastifySchema;
  response?: any;
  body?: any;
};

export function Ctx() {
  return function (target: Object, propertyKey: string | symbol, parameterIndex: number) {
    Reflect.defineMetadata(contextMetadataKey, { index: parameterIndex }, target, propertyKey);
  };
}

export function Param(paramName: string) {
  return function (target: Object, propertyKey: string | symbol, parameterIndex: number) {
    const existingParams = Reflect.getOwnMetadata(paramMetadataKey, target, propertyKey) || [];
    existingParams.push({ name: paramName, index: parameterIndex });
    Reflect.defineMetadata(paramMetadataKey, existingParams, target, propertyKey);
  };
}

export function Uuid() {
  return function (target: Object, propertyKey: string | symbol, parameterIndex: number) {
    const existingUuidParams: number[] = Reflect.getOwnMetadata(uuidMetadataKey, target, propertyKey) || [];
    existingUuidParams.push(parameterIndex);
    Reflect.defineMetadata(uuidMetadataKey, existingUuidParams, target, propertyKey);
  };
}

export function Service(options?: { scope?: 'singleton' | 'request' | 'transient' }) {
  return function (constructor: Function) {
    container.register(constructor.name, constructor as any, options);
  };
}

export function Inject(name: string | symbol) {
  return function (target: Object, propertyKey: string | symbol, parameterIndex: number) {
    Reflect.defineMetadata(injectMetadataKey, name, target, `param_${parameterIndex}`);
  };
}

export function Controller(path: string) {
  return function (constructor: Function) {
    Reflect.defineMetadata('basePath', path, constructor);
  };
}

function createRouteDecorator(method: string) {
  return function (path: string = '/', options: RouteOptions = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const routes = Reflect.getMetadata('routes', target.constructor) || [];

      const routeOptions: any = { ...options.schema };

      if (options.response) {
        const responseSchemaName = options.response.name;
        routeOptions.response = {
          200: { $ref: responseSchemaName },
        };
      }

      if (options.body) {
        const bodySchemaName = options.body.name;
        routeOptions.body = { $ref: bodySchemaName };
      }

      routes.push({ 
        method: method.toUpperCase(), 
        path: path, 
        handlerName: propertyKey, 
        options: routeOptions 
      });
      Reflect.defineMetadata('routes', routes, target.constructor);
    };
  };
}

export const Get = createRouteDecorator('get');
export const Post = createRouteDecorator('post');
export const Put = createRouteDecorator('put');
export const Delete = createRouteDecorator('delete');

// --- END ROUTE DECORATORS ---

export function Body() {
  return function (target: Object, propertyKey: string | symbol, parameterIndex: number) {
    const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey);
    const paramType = paramTypes[parameterIndex];
    Reflect.defineMetadata('bodyParam', { index: parameterIndex, type: paramType }, target, propertyKey);
  };
}

export function Validated() {
  return function (target: Object, propertyKey: string | symbol, parameterIndex: number) {
    const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey);
    const paramType = paramTypes[parameterIndex];

    const originalMethod = (target as any)[propertyKey];
    (target as any)[propertyKey] = async function (...args: any[]) {
      const bodyParam = Reflect.getMetadata('bodyParam', target, propertyKey);
      if (bodyParam && bodyParam.index === parameterIndex) {
        const dtoInstance = plainToClass(paramType, args[parameterIndex]);
        const errors = await validate(dtoInstance);
        if (errors.length > 0) {
          throw new Error(JSON.stringify(errors)); // Or a custom validation error
        }
        args[parameterIndex] = dtoInstance;
      }
      return originalMethod.apply(this, args);
    };
  };
}

export function Cacheable(ttl: number = 60) { // ttl in seconds
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!redisClient) {
        return originalMethod.apply(this, args);
      }

      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      try {
        const cachedResult = await redisClient.get(cacheKey);
        if (cachedResult) {
          console.log(`Cache hit for key: ${cacheKey}`);
          return JSON.parse(cachedResult);
        }
      } catch (err) {
        console.error('Redis GET error:', err);
        return originalMethod.apply(this, args);
      }

      console.log(`Cache miss for key: ${cacheKey}`);
      const result = await originalMethod.apply(this, args);
      
      try {
        if (redisClient) {
          await redisClient.setex(cacheKey, ttl, JSON.stringify(result));
        }
      } catch (err) {
        console.error('Redis SETEX error:', err);
      }
      
      return result;
    };

    return descriptor;
  };
}

export function Roles(...roles: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('roles', roles, target, propertyKey);
  };
}

export function EventHandler(eventName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    setTimeout(() => {
      const eventEmitter = container.resolve('AppEventEmitter') as AppEventEmitter;
      eventEmitter.on(eventName, originalMethod.bind(target));
    }, 0);

    return descriptor;
  };
}