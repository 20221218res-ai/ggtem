const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function isDemoModeEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const configuredValue = process.env.GGITEM_ENABLE_DEMO_ACCOUNTS?.trim().toLowerCase();

  return configuredValue ? ENABLED_VALUES.has(configuredValue) : false;
}

export function isDemoToolEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const configuredValue = process.env.GGITEM_ENABLE_DEMO_TOOLS?.trim().toLowerCase();

  return configuredValue ? ENABLED_VALUES.has(configuredValue) : false;
}
