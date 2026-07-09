export type RuntimeEnvMode = "production" | "development" | "test" | string;

export type RuntimeEnvCheck = {
  ok: boolean;
  mode: RuntimeEnvMode;
  errors: string[];
  warnings: string[];
  required: Array<{
    name: string;
    configured: boolean;
    requiredInProduction: boolean;
  }>;
  optional: Array<{
    name: string;
    configured: boolean;
    valid: boolean;
  }>;
};

const PRODUCTION_REQUIRED = [
  "DATABASE_URL",
  "JYKSTORE_API_KEY_SECRET",
  "JYKSTORE_ADMIN_OPS_TOKEN",
] as const;

function trimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

function isConfigured(value: string | undefined): boolean {
  return trimmed(value).length > 0;
}

function resolveMode(env: NodeJS.ProcessEnv): RuntimeEnvMode {
  return env.NODE_ENV ?? "development";
}

function isProductionMode(mode: RuntimeEnvMode): boolean {
  return mode === "production";
}

function validatePositiveInt(raw: string | undefined): { configured: boolean; valid: boolean } {
  if (!isConfigured(raw)) return { configured: false, valid: true };
  const value = Number(raw);
  const valid = Number.isFinite(value) && Number.isInteger(value) && value > 0;
  return { configured: true, valid };
}

function validateQuotaEnforcement(raw: string | undefined): { configured: boolean; valid: boolean } {
  if (!isConfigured(raw)) return { configured: false, valid: true };
  const normalized = raw!.trim().toUpperCase();
  return { configured: true, valid: normalized === "ENFORCE" || normalized === "WARN_ONLY" };
}

const MCP_OPTIONAL_ENV = [
  "JYKSTORE_BASE_URL",
  "JYKSTORE_API_BASE_URL",
  "JYKSTORE_API_KEY",
  "JYKSTORE_MCP_TRANSPORT",
  "JYKSTORE_MCP_PORT",
  "JYKSTORE_MCP_ALLOWED_PACK_IDS",
  "JYKSTORE_MCP_ALLOWED_ORIGINS",
  "JYKSTORE_MCP_MAX_RESPONSE_BYTES",
  "JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES",
] as const;

const QUOTA_OPTIONAL_ENV = [
  "JYKSTORE_QUOTA_PER_MINUTE",
  "JYKSTORE_QUOTA_PER_DAY",
  "JYKSTORE_QUOTA_ENFORCEMENT",
] as const;

export function evaluateRuntimeEnv(env: NodeJS.ProcessEnv = process.env): RuntimeEnvCheck {
  const mode = resolveMode(env);
  const production = isProductionMode(mode);
  const errors: string[] = [];
  const warnings: string[] = [];

  const required = PRODUCTION_REQUIRED.map((name) => {
    const configured = isConfigured(env[name]);
    const requiredInProduction = true;
    if (production && !configured) {
      errors.push(`Missing required env: ${name}`);
    } else if (!production && !configured) {
      warnings.push(`Optional in ${mode}: ${name} is not configured`);
    }
    return { name, configured, requiredInProduction };
  });

  const optional: RuntimeEnvCheck["optional"] = [];

  for (const name of QUOTA_OPTIONAL_ENV) {
    let check: { configured: boolean; valid: boolean };
    if (name === "JYKSTORE_QUOTA_ENFORCEMENT") {
      check = validateQuotaEnforcement(env[name]);
    } else {
      check = validatePositiveInt(env[name]);
    }
    optional.push({ name, ...check });
    if (check.configured && !check.valid) {
      const message = `Invalid env: ${name}`;
      if (production) errors.push(message);
      else warnings.push(message);
    }
  }

  for (const name of MCP_OPTIONAL_ENV) {
    if (name === "JYKSTORE_MCP_PORT" || name === "JYKSTORE_MCP_MAX_RESPONSE_BYTES" || name === "JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES") {
      const check = validatePositiveInt(env[name]);
      optional.push({ name, ...check });
      if (check.configured && !check.valid) {
        warnings.push(`Invalid env: ${name}`);
      }
      continue;
    }
    if (name === "JYKSTORE_MCP_TRANSPORT") {
      const configured = isConfigured(env[name]);
      const valid =
        !configured ||
        env[name]!.trim().toLowerCase() === "stdio" ||
        env[name]!.trim().toLowerCase() === "http";
      optional.push({ name, configured, valid });
      if (configured && !valid) warnings.push(`Invalid env: ${name}`);
      continue;
    }
    optional.push({ name, configured: isConfigured(env[name]), valid: true });
  }

  const baseUrlConfigured =
    isConfigured(env.JYKSTORE_BASE_URL) || isConfigured(env.JYKSTORE_API_BASE_URL);
  optional.push({
    name: "JYKSTORE_BASE_URL|JYKSTORE_API_BASE_URL",
    configured: baseUrlConfigured,
    valid: true,
  });

  return {
    ok: errors.length === 0,
    mode,
    errors,
    warnings,
    required,
    optional,
  };
}
