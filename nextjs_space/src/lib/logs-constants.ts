// Extraido de logs-store.ts (constantes + helpers)
import type { WeatherCondition } from "@/types";

export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  SOLEADO: "Soleado",
  NUBLADO: "Nublado",
  LLUVIOSO: "Lluvioso",
  TORMENTA: "Tormenta",
  VIENTO: "Viento",
  NIEBLA: "Niebla",
  OTRO: "Otro",
};

export const WEATHER_ICONS: Record<WeatherCondition, string> = {
  SOLEADO: "☀️",
  NUBLADO: "☁️",
  LLUVIOSO: "🌧️",
  TORMENTA: "⛈️",
  VIENTO: "💨",
  NIEBLA: "🌫️",
  OTRO: "🌡️",
};
