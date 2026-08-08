import { DailyLoverEvent } from "@/types";
import localEvents from "@/data/events.json";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_EVENTS_API_URL ||
  "https://prueba-daily.agentesia.cloud/api/v1/public";

/**
 * Service to fetch public events.
 * Falls back seamlessly to local static events.json if API is offline or not configured.
 */
export async function getPublicEvents(city?: string): Promise<DailyLoverEvent[]> {
  try {
    const url = city && city !== "all" ? `${API_BASE_URL}/events?city=${city}` : `${API_BASE_URL}/events`;
    const res = await fetch(url, { next: { revalidate: 60 } });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {
    // API offline fallback to local static data
  }

  const events = localEvents as DailyLoverEvent[];
  if (city && city !== "all") {
    return events.filter((e) => e.city === city);
  }
  return events;
}
