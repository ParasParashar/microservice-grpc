import { status as grpcStatus } from '@grpc/grpc-js';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failureCount = 0;
    private lastFailureTime = 0;

    constructor(
        private readonly failureThreshold = 5,
        private readonly recoveryTimeout = 10000,
    ) { }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            const elapsedTime = Date.now() - this.lastFailureTime;
            if (elapsedTime < this.recoveryTimeout) {
                throw new Error('Circuit is open. Please try again later.');
            }
            this.state = 'HALF_OPEN';
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    private onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    private onFailure(error: unknown) {
        const code = this.getErrorCode(error);

        if (!this.shouldTrackFailure(code)) {
            this.failureCount = 0;
            this.state = 'CLOSED';
            return;
        }

        this.failureCount += 1;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }

    private shouldTrackFailure(code?: number) {
        return (
            code === grpcStatus.UNAVAILABLE || code === grpcStatus.DEADLINE_EXCEEDED
        );
    }

    private getErrorCode(error: unknown): number | undefined {
        if (typeof error !== 'object' || error === null) return undefined;

        const maybeCode = (error as { code?: number; response?: { code?: number } }).code;
        const responseCode = (error as { response?: { code?: number } }).response?.code;

        return typeof maybeCode === 'number'
            ? maybeCode
            : typeof responseCode === 'number'
                ? responseCode
                : undefined;
    }
}
