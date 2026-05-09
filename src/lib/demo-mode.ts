const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function isDemoModeEnabled() {
  const configuredValue = process.env.GGITEM_ENABLE_DEMO_ACCOUNTS?.trim().toLowerCase();

  return configuredValue ? ENABLED_VALUES.has(configuredValue) : false;
}

export function isDemoToolEnabled() {
  const configuredValue = process.env.GGITEM_ENABLE_DEMO_TOOLS?.trim().toLowerCase();

  return configuredValue ? ENABLED_VALUES.has(configuredValue) : false;
}
