import QuickLRU from 'quick-lru';

/**
 * Memoization decorator that uses QuickLRU to cache method results.
 * @param maxSize - Maximum number of items to cache
 * @returns A decorator function
 */
export function memoize(maxSize: number) {
  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // Create a cache for this method
    const cache = new QuickLRU<string, any>({ maxSize });

    descriptor.value = function (...args: any[]) {
      // Create a cache key from the method name and serialized arguments
      const key = `${propertyKey}:${JSON.stringify(args)}`;

      // Check if result is in cache
      if (cache.has(key)) {
        return cache.get(key);
      }

      // Call original method and cache the result
      const result = originalMethod.apply(this, args);

      // For promises, cache the promise itself and let it resolve naturally
      if (result && typeof result.then === 'function') {
        cache.set(key, result);
        return result;
      }

      // Cache non-promise results
      cache.set(key, result);
      return result;
    };

    return descriptor;
  };
}

