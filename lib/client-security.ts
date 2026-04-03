const csrfCookieName = "ks_csrf";
const csrfHeaderName = "x-csrf-token";

export function getCsrfHeaders() {
  if (typeof document === "undefined") {
    return {} as Record<string, string>;
  }

  const token = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${csrfCookieName}=`))
    ?.split("=")[1];

  if (!token) {
    return {} as Record<string, string>;
  }

  return {
    [csrfHeaderName]: decodeURIComponent(token)
  } satisfies Record<string, string>;
}
