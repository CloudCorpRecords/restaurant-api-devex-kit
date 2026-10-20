import { randomUUID } from "node:crypto";
import type { ApiErrorBody } from "./types.ts";

export function newRequestId(): string {
  return randomUUID();
}

// DevEx principle: every error response has the same shape and always
// carries the request id in both the body and the x-request-id header,
// so a developer can paste either into a support message.
export function errorBody(
  code: string,
  message: string,
  requestId: string,
  hint?: string,
): ApiErrorBody {
  const error: ApiErrorBody["error"] = { code, message };
  if (hint !== undefined) error.hint = hint;
  return { error, requestId };
}
