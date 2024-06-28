/**
 * Provides a simple way of creating the rough equivalent of an async critical section.
 *
 * @description
 * AsyncLock can be used to sequentialize async operations (ensure they don't overlap).
 *
 * @example
 * const myLock = new AsyncLock();
 *
 * private async MyFuncAsync(): Promise<void> {
 *   await myLock.LockAsync(async () => {
 *     await operation1Async();
 *     await operation2Async();
 *   });
 * }
 */
export class AsyncLock {
    private currentOperation: Promise<unknown> = Promise.resolve();
    public lockAsync<T>(func: () => T | Promise<T>): Promise<T> {
        const newOperation = this.currentOperation.then(func, func);
        this.currentOperation = newOperation;
        return newOperation;
    }
}
