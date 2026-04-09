import { withRetry } from '@/infrastructure/ai/retry';

describe('withRetry', () => {
  it('succeeds on first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn, 3, 1);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on status 429 and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
      .mockResolvedValue('ok');

    const result = await withRetry(fn, 3, 1);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on status 500 and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 500, message: 'Server error' })
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, 3, 1);

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately for non-retryable status code 400', async () => {
    const error = { status: 400, message: 'Bad request' };
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, 3, 1)).rejects.toEqual(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries when error has no status code (network errors)', async () => {
    const error = new Error('Network failure');
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, 3, 1);

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries for network errors', async () => {
    const error = new Error('Network failure');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, 2, 1)).rejects.toThrow('Network failure');
    // initial attempt + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('exhausts all retries and throws the last error', async () => {
    const error = { status: 429, message: 'Rate limited' };
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, 2, 1)).rejects.toEqual(error);
    // initial attempt + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('applies exponential backoff between retries', async () => {
    vi.useFakeTimers();
    // Stabilize jitter to 0
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 502 })
      .mockRejectedValueOnce({ status: 502 })
      .mockResolvedValue('done');

    const promise = withRetry(fn, 3, 100);

    // First attempt fails immediately, then waits baseDelay * 2^0 = 100ms
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second attempt fails, then waits baseDelay * 2^1 = 200ms
    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe('done');

    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
