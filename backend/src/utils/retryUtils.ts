/**
 * Retry Utilities with Exponential Backoff
 * Provides reusable retry logic for database and service connections
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 32000,
    backoffMultiplier: 2,
};

/**
 * Sleep utility - returns a promise that resolves after specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for current retry attempt with exponential backoff
 */
export function calculateBackoffDelay(
    retryCount: number,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
    const exponentialDelay =
        config.initialDelayMs * Math.pow(config.backoffMultiplier, retryCount);
    return Math.min(exponentialDelay, config.maxDelayMs);
}

/**
 * Execute a function with automatic retry and exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    label: string = 'Operation'
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
        try {
            console.log(`[${label}] Attempt ${attempt + 1}/${config.maxRetries}`);
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < config.maxRetries - 1) {
                const delay = calculateBackoffDelay(attempt, config);
                console.warn(
                    `[${label}] Attempt ${attempt + 1} failed: ${lastError.message}. ` +
                    `Retrying in ${delay}ms...`
                );
                await sleep(delay);
            } else {
                console.error(
                    `[${label}] All ${config.maxRetries} attempts failed. Last error: ${lastError.message}`
                );
            }
        }
    }

    throw lastError || new Error(`${label} failed after ${config.maxRetries} attempts`);
}
