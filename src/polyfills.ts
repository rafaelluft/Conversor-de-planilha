// Browser compatibility polyfills for Safari on macOS, iOS, and older engines

// 1. Promise.withResolvers
if (typeof (Promise as any).withResolvers === 'undefined') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// 2. Promise.try
if (typeof (Promise as any).try === 'undefined') {
  (Promise as any).try = function <T>(fn: (...args: any[]) => T | PromiseLike<T>, ...args: any[]): Promise<T> {
    return new Promise((resolve) => {
      resolve(fn(...args));
    });
  };
}

// 3. Object.groupBy
if (typeof (Object as any).groupBy === 'undefined') {
  (Object as any).groupBy = function <T, K extends PropertyKey>(
    items: Iterable<T>,
    callback: (item: T, index: number) => K
  ): Record<K, T[]> {
    const result = Object.create(null) as Record<K, T[]>;
    let index = 0;
    for (const item of items) {
      const key = callback(item, index++);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
    }
    return result;
  };
}

// 4. Array.prototype.at
if (!(Array.prototype as any).at) {
  (Array.prototype as any).at = function (n: number) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    if (n < 0 || n >= this.length) return undefined;
    return this[n];
  };
}

// 5. Array.prototype.toReversed
if (!(Array.prototype as any).toReversed) {
  (Array.prototype as any).toReversed = function () {
    return Array.from(this).reverse();
  };
}

// 6. Array.prototype.toSorted
if (!(Array.prototype as any).toSorted) {
  (Array.prototype as any).toSorted = function (compareFn?: (a: any, b: any) => number) {
    return Array.from(this).sort(compareFn);
  };
}

// 7. Uint8Array.fromBase64
if (typeof (Uint8Array as any).fromBase64 === 'undefined') {
  (Uint8Array as any).fromBase64 = function (b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };
}

export {};
