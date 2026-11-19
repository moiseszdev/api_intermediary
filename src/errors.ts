export class OriginError extends Error {
  constructor(message: string, public status = 502, public transient = false) { super(message); }
}
export class BusinessError extends OriginError {
  constructor(public readonly errors: unknown[]) { super('A origem Bimer retornou erros de negócio', 502, false); }
}
