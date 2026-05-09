const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function isDemoModeEnabled() {
  const configuredValue = process.env.GGITEM_ENABLE_DEMO_ACCOUNTS?.trim().toLowerCase();

  if (configuredValue) {
    return ENABLED_VALUES.has(configuredValue);
  }

  return process.env.NODE_ENV !== "production";
}

export function isDemoToolEnabled() {
  const configuredValue = process.env.GGITEM_ENABLE_DEMO_TOOLS?.trim().toLowerCase();

  if (configuredValue) {
    return ENABLED_VALUES.has(configuredValue);
  }

  return process.env.NODE_ENV !== "production";
}
