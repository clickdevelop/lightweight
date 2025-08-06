import 'reflect-metadata';

export type Constructor<T = any> = new (...args: any[]) => T;

interface ServiceOptions {
  scope?: 'singleton' | 'request' | 'transient';
}

const serviceMetadataKey = Symbol('service');
const injectMetadataKey = Symbol('inject');

export class Container {
  private static instance: Container;
  private services = new Map<string | symbol, { constructor: Constructor; options?: ServiceOptions; instance?: any }>();

  private constructor() {}

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  public register<T>(name: string | symbol, constructor: Constructor<T>, options?: ServiceOptions): void {
    this.services.set(name, { constructor, options });
  }

  public resolve<T>(name: string | symbol): T {
    const serviceEntry = this.services.get(name);

    if (!serviceEntry) {
      throw new Error(`Service with name ${String(name)} not found.`);
    }

    const { constructor, options } = serviceEntry;

    if (options?.scope === 'singleton' && serviceEntry.instance) {
      return serviceEntry.instance;
    }

    const paramTypes: Constructor[] = Reflect.getMetadata('design:paramtypes', constructor) || [];
    const dependencies = paramTypes.map((paramType, index) => {
      const injectName = Reflect.getMetadata(injectMetadataKey, constructor, `param_${index}`);
      if (injectName) {
        return this.resolve(injectName);
      }
      // Se não houver @Inject, e for uma classe, lançar erro para forçar explicitação.
      // Para tipos primitivos, retorna undefined.
      if (paramType && paramType.prototype && paramType.prototype.constructor === paramType) {
          throw new Error(`Service dependency for parameter ${index} of ${constructor.name} not explicitly injected. Use @Inject decorator.`);
      }
      return undefined; // Para tipos primitivos ou classes não gerenciadas
    });

    const instance = new constructor(...dependencies);

    if (options?.scope === 'singleton') {
      serviceEntry.instance = instance;
    }

    return instance;
  }
}

export const container = Container.getInstance();
