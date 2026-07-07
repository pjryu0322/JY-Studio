export const BEARER_SECURITY_SCHEME = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JYKStore API Key",
};

export function bearerSecurity() {
  return [{ BearerAuth: [] as string[] }];
}
