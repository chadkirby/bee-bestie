import { describe, it, expect, vi } from 'vitest';
import { memoize } from './memoize.js';

describe('memoize decorator', () => {
  it('should cache async method results', async () => {
    class TestClass {
      private callCount = 0;

      @memoize(5)
      async expensiveOperation(x: number, y: number): Promise<number> {
        this.callCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return x + y;
      }

      getCallCount(): number {
        return this.callCount;
      }
    }

    const test = new TestClass();

    // First call should execute the method
    const result1 = await test.expensiveOperation(1, 2);
    expect(result1).toBe(3);
    expect(test.getCallCount()).toBe(1);

    // Second call with same arguments should use cache
    const result2 = await test.expensiveOperation(1, 2);
    expect(result2).toBe(3);
    expect(test.getCallCount()).toBe(1); // No increment

    // Different arguments should call the method again
    const result3 = await test.expensiveOperation(2, 3);
    expect(result3).toBe(5);
    expect(test.getCallCount()).toBe(2);

    // Original arguments should still be cached
    const result4 = await test.expensiveOperation(1, 2);
    expect(result4).toBe(3);
    expect(test.getCallCount()).toBe(2);
  });

  it('should cache synchronous method results', () => {
    class TestClass {
      private callCount = 0;

      @memoize(3)
      syncOperation(text: string): string {
        this.callCount++;
        return text.toUpperCase();
      }

      getCallCount(): number {
        return this.callCount;
      }
    }

    const test = new TestClass();

    // First call should execute the method
    const result1 = test.syncOperation('hello');
    expect(result1).toBe('HELLO');
    expect(test.getCallCount()).toBe(1);

    // Second call with same argument should use cache
    const result2 = test.syncOperation('hello');
    expect(result2).toBe('HELLO');
    expect(test.getCallCount()).toBe(1); // No increment

    // Different argument should call the method again
    const result3 = test.syncOperation('world');
    expect(result3).toBe('WORLD');
    expect(test.getCallCount()).toBe(2);

    // Original argument should still be cached
    const result4 = test.syncOperation('hello');
    expect(result4).toBe('HELLO');
    expect(test.getCallCount()).toBe(2);
  });

  it('should handle different argument types correctly', () => {
    class TestClass {
      private callCount = 0;

      @memoize(10)
      operation(x: any): string {
        this.callCount++;
        return `called-with-${typeof x}-${x}`;
      }

      getCallCount(): number {
        return this.callCount;
      }
    }

    const test = new TestClass();

    const result1 = test.operation('test');
    expect(result1).toBe('called-with-string-test');
    expect(test.getCallCount()).toBe(1);

    const result2 = test.operation(42);
    expect(result2).toBe('called-with-number-42');
    expect(test.getCallCount()).toBe(2);

    const result3 = test.operation(true);
    expect(result3).toBe('called-with-boolean-true');
    expect(test.getCallCount()).toBe(3);

    // Same argument should use cache
    const result4 = test.operation('test');
    expect(result4).toBe('called-with-string-test');
    expect(test.getCallCount()).toBe(3);
  });

  it('should handle multiple arguments correctly', async () => {
    class TestClass {
      private callCount = 0;

      @memoize(5)
      multiArgOperation(a: string, b: number, c: boolean): string {
        this.callCount++;
        return `${a}-${b}-${c}`;
      }

      getCallCount(): number {
        return this.callCount;
      }
    }

    const test = new TestClass();

    const result1 = test.multiArgOperation('test', 42, true);
    expect(result1).toBe('test-42-true');
    expect(test.getCallCount()).toBe(1);

    // Same arguments should use cache
    const result2 = test.multiArgOperation('test', 42, true);
    expect(result2).toBe('test-42-true');
    expect(test.getCallCount()).toBe(1);

    // Different order of arguments should call method again
    const result3 = test.multiArgOperation('test', true, 42);
    expect(result3).toBe('test-true-42');
    expect(test.getCallCount()).toBe(2);
  });
});
