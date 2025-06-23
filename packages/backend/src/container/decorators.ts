import 'reflect-metadata';
import { getContainer } from './service-container';
import { ServiceConstructor } from './interfaces';

// Metadata keys
const INJECTABLE_METADATA = Symbol('injectable');
const INJECT_METADATA = Symbol('inject');
const INJECT_PARAM_METADATA = Symbol('inject:param');

export function Injectable(token?: string | symbol): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(INJECTABLE_METADATA, true, target);
    
    const container = getContainer();
    const serviceToken = token || target;
    
    container.register({
      token: serviceToken,
      implementation: target,
      dependencies: Reflect.getMetadata('design:paramtypes', target) || [],
      singleton: true
    });

    return target;
  };
}

export function Inject(token: string | symbol | ServiceConstructor): ParameterDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const existingTokens = Reflect.getMetadata(INJECT_PARAM_METADATA, target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_PARAM_METADATA, existingTokens, target);
  };
}

export function InjectProperty(token: string | symbol | ServiceConstructor): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    const container = getContainer();
    
    Object.defineProperty(target, propertyKey, {
      get() {
        return container.resolve(token);
      },
      enumerable: true,
      configurable: true
    });
  };
}

export function Singleton(token?: string | symbol): ClassDecorator {
  return (target: any) => {
    return Injectable(token)(target);
  };
}

export function Service(token?: string | symbol): ClassDecorator {
  return Injectable(token);
}

// Auto-wire decorator for automatic dependency resolution
export function AutoWire(): ClassDecorator {
  return (target: any) => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', target) || [];
    const injectedParams = Reflect.getMetadata(INJECT_PARAM_METADATA, target) || [];
    
    const dependencies = paramTypes.map((type: any, index: number) => {
      return injectedParams[index] || type;
    });

    const container = getContainer();
    container.register({
      token: target,
      implementation: target,
      dependencies,
      singleton: true
    });

    return target;
  };
}