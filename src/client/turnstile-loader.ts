export function hasTurnstileRender(
  value: unknown,
): value is { render: (...arguments_: unknown[]) => unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "render" in value &&
    typeof value.render === "function"
  );
}
