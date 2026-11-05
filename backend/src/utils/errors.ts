export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "BUSINESS_ERROR",
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new AppError(status, message);
}
