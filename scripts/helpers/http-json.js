async function readJsonResponse(response, path) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  if (!text) {
    return {};
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`${path} returned malformed JSON (${response.status}): ${text.slice(0, 500)}`);
    }
  }

  return {
    message: text.slice(0, 500),
    nonJson: true,
  };
}

function isTransientServerResponse(response, json) {
  if (response.status < 500) {
    return false;
  }

  const message = String(json?.message ?? "");
  return (
    json?.nonJson === true ||
    message.includes("<!DOCTYPE html>") ||
    message.includes("UV_HANDLE_CLOSING") ||
    message.includes("Unexpected token '<'")
  );
}

async function fetchJsonWithRetry({ path, fetcher, allowFailure = false, maxAttempts = 3 }) {
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetcher();
    const json = await readJsonResponse(response, path);
    lastResult = { response, json };

    if (response.ok || !isTransientServerResponse(response, json) || attempt === maxAttempts) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }

  if (!lastResult) {
    throw new Error(`${path} did not return a response.`);
  }

  if (!lastResult.response.ok && !allowFailure) {
    throw new Error(`${path} failed (${lastResult.response.status}): ${JSON.stringify(lastResult.json)}`);
  }

  return lastResult;
}

module.exports = {
  fetchJsonWithRetry,
};
