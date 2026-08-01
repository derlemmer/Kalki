export type RouteSummary = {
  oneWayKm: number;
  roundTripKm: number;
  oneWayMinutes: number;
  roundTripMinutes: number;
};

export function summarizeRoute(distanceMeters: number, durationSeconds: number): RouteSummary {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new Error("Ungültige Routendistanz.");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new Error("Ungültige Fahrzeit.");
  }

  const oneWayKm = Math.round(distanceMeters / 1000);
  const roundTripKm = Math.round((distanceMeters * 2) / 1000);
  const oneWayMinutes = Math.round(durationSeconds / 60);
  const roundTripMinutes = Math.round((durationSeconds * 2) / 60);
  return {
    oneWayKm,
    roundTripKm,
    oneWayMinutes,
    roundTripMinutes,
  };
}
