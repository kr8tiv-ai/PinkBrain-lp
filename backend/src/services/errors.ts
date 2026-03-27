/**
 * Strategy validation and lookup error types.
 *
 * StrategyValidationError: Thrown when strategy input fails business rules
 *   or on-chain validation. Structured for programmatic handling:
 *   - field: which input field failed
 *   - rule: machine-readable rule identifier (TOKEN_MINT_NOT_FOUND, etc.)
 *   - value: the offending value
 *
 * StrategyNotFoundError: Thrown when a strategy ID doesn't exist in the DB.
 */

export class StrategyValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly rule: string,
    public readonly value: unknown,
  ) {
    super(
      `Strategy validation failed on "${field}": ${rule} (value: ${JSON.stringify(value)})`,
    );
    this.name = 'StrategyValidationError';
  }
}

export class StrategyNotFoundError extends Error {
  constructor(public readonly strategyId: string) {
    super(`Strategy not found: ${strategyId}`);
    this.name = 'StrategyNotFoundError';
  }
}

export class RunNotFoundError extends Error {
  constructor(public readonly runId: string) {
    super(`Run not found: ${runId}`);
    this.name = 'RunNotFoundError';
  }
}

export class RunStateError extends Error {
  constructor(
    public readonly runId: string,
    public readonly fromState: string,
    public readonly toState: string,
    public readonly reason: string,
  ) {
    super(
      `Run "${runId}" invalid state transition: ${fromState} → ${toState} (${reason})`,
    );
    this.name = 'RunStateError';
  }
}
