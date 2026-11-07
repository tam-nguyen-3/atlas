import { ClientError } from "./errors";

// Requests from a previous session must never publish results or log out a new user.
export class RequestScope {
  private generation = 0;
  private controllers = new Set<AbortController>();
  onUnauthorized: () => void = () => {};

  reset() {
    this.generation++;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  async run<T>(
    work: (signal: AbortSignal) => Promise<T>,
    externalSignal?: AbortSignal,
    protectedRequest = true,
  ): Promise<T> {
    const generation = this.generation;
    const controller = new AbortController();
    this.controllers.add(controller);
    const signal = externalSignal
      ? AbortSignal.any([controller.signal, externalSignal])
      : controller.signal;
    try {
      signal.throwIfAborted();
      const value = await work(signal);
      signal.throwIfAborted();
      return value;
    } catch (error) {
      // Check before processing errors too: an old 401 cannot revoke a new session.
      if (generation !== this.generation || signal.aborted)
        throw new DOMException("Request cancelled", "AbortError");
      if (
        protectedRequest &&
        error instanceof ClientError &&
        error.status === 401
      )
        this.onUnauthorized();
      throw error;
    } finally {
      this.controllers.delete(controller);
    }
  }
}
