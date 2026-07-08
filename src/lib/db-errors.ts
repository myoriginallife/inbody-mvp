export function isDatabaseUnavailableError(error: unknown) {
  const maybeError = error as {
    message?: string;
    code?: string;
    cause?: { message?: string; code?: string };
  };

  const message =
    maybeError?.message ??
    maybeError?.cause?.message ??
    (error instanceof Error ? error.message : String(error));
  const code = maybeError?.code ?? maybeError?.cause?.code ?? "";

  return (
    code === "ECONNREFUSED" ||
    code === "P1001" ||
    message.includes("ECONNREFUSED") ||
    message.includes("Can't reach database server") ||
    message.includes("P1001")
  );
}
