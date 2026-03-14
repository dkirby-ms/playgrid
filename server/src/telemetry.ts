import * as appInsights from "applicationinsights";

let telemetryClient: appInsights.TelemetryClient | null = null;

export function initializeTelemetry(): void {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING?.trim();

  if (!connectionString) {
    console.log("[telemetry] Application Insights connection string not configured, telemetry disabled");
    return;
  }

  try {
    appInsights
      .setup(connectionString)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true)
      .setUseDiskRetryCaching(true)
      .start();

    telemetryClient = appInsights.defaultClient;

    console.log("[telemetry] Application Insights initialized successfully");
  } catch (error) {
    console.error("[telemetry] Failed to initialize Application Insights:", error);
    telemetryClient = null;
  }
}

export function trackEvent(name: string, properties?: Record<string, string>): void {
  if (!telemetryClient) {
    return;
  }

  try {
    telemetryClient.trackEvent({
      name,
      properties,
    });
  } catch (error) {
    console.error(`[telemetry] Failed to track event '${name}':`, error);
  }
}

export function trackException(error: Error, properties?: Record<string, string>): void {
  if (!telemetryClient) {
    return;
  }

  try {
    telemetryClient.trackException({
      exception: error,
      properties,
    });
  } catch (err) {
    console.error("[telemetry] Failed to track exception:", err);
  }
}

export function trackMetric(name: string, value: number, properties?: Record<string, string>): void {
  if (!telemetryClient) {
    return;
  }

  try {
    telemetryClient.trackMetric({
      name,
      value,
      properties,
    });
  } catch (error) {
    console.error(`[telemetry] Failed to track metric '${name}':`, error);
  }
}

export function flushTelemetry(): Promise<void> {
  if (!telemetryClient) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    telemetryClient?.flush();
    // Give it a moment to flush
    setTimeout(() => resolve(), 100);
  });
}
