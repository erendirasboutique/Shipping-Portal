"use client";

// Ship-day card for the dashboard: Saturday's weather in Fontana, USPS holidays,
// and weather alerts where this week's packages are headed.
// Weather comes from Open-Meteo (free, no account or key needed).

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const HOME = { name: "Fontana, CA", lat: 34.0922, lon: -117.435 };

// USPS holidays (no mail delivery). Update this list each year.
const USPS_HOLIDAYS: [string, string][] = [
  ["2026-10-12", "Columbus Day"],
  ["2026-11-11", "Veterans Day"],
  ["2026-11-26", "Thanksgiving"],
  ["2026-12-25", "Christmas"],
  ["2027-01-01", "New Year's Day"],
  ["2027-01-18", "Martin Luther King Jr. Day"],
  ["2027-02-15", "Presidents' Day"],
  ["2027-05-31", "Memorial Day"],
  ["2027-06-19", "Juneteenth"],
  ["2027-07-05", "Independence Day (observed)"],
  ["2027-09-06", "Labor Day"],
  ["2027-10-11", "Columbus Day"],
  ["2027-11-11", "Veterans Day"],
  ["2027-11-25", "Thanksgiving"],
  ["2027-12-25", "Christmas"],
  ["2028-01-01", "New Year's Day"],
];

const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

type Alert = { kind: "holiday" | "rain" | "heat" | "cold"; title: string; body: string; tag: string; warn?: boolean };

function ymd(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fromYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function nextSaturday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return d;
}
function dayName(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" }) {
  return fromYmd(s).toLocaleDateString("en-US", opts);
}

// Open-Meteo weather codes → words
function describe(code: number) {
  if (code === 0) return "Sunny";
  if (code <= 2) return "Mostly sunny";
  if (code === 3) return "Cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}

const ICONS = {
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  cloud: "M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z",
  rain: "M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3M8 19v2M12 19v2M16 19v2",
  heat: "M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z",
  cal: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  snow: "M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9",
};

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function shortDays(days: string[]) {
  const names = days.map((d) => dayName(d, { weekday: "short" }));
  return names.length > 2 ? names[0] + "–" + names[names.length - 1] : names.join(" & ");
}

export default function ShipDayCard() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const shipDay = useMemo(() => ymd(nextSaturday()), []);
  const isToday = shipDay === ymd(new Date());
  const [home, setHome] = useState<{ code: number; hi: number; rain: number } | null>(null);
  const [homeErr, setHomeErr] = useState(false);
  const [toShip, setToShip] = useState<number | null>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<Alert[]>([]);
  const [checking, setChecking] = useState(true);

  // Holidays: anything from today through 3 days after ship day.
  const holidayAlerts: Alert[] = useMemo(() => {
    const today = ymd(new Date());
    const end = fromYmd(shipDay);
    end.setDate(end.getDate() + 3);
    const endS = ymd(end);
    return USPS_HOLIDAYS.filter(([d]) => d >= today && d <= endS).map(([d, name]) => {
      const onShipDay = d === shipDay;
      return {
        kind: "holiday" as const,
        warn: true,
        title: name + " · " + dayName(d),
        body: onShipDay
          ? "Post offices are closed on your ship day. Drop packages off Friday or schedule them for the next business day."
          : "No USPS delivery that day. Packages keep moving the next business day, so some may land a day later.",
        tag: "USPS holiday",
      };
    });
  }, [shipDay]);

  // Saturday weather at home
  useEffect(() => {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=" + HOME.lat + "&longitude=" + HOME.lon +
      "&daily=weather_code,temperature_2m_max,precipitation_probability_max&temperature_unit=fahrenheit" +
      "&timezone=America%2FLos_Angeles&forecast_days=8";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const i = (d?.daily?.time || []).indexOf(shipDay);
        if (i < 0) throw new Error("no day");
        setHome({
          code: d.daily.weather_code[i],
          hi: Math.round(d.daily.temperature_2m_max[i]),
          rain: d.daily.precipitation_probability_max[i] ?? 0,
        });
      })
      .catch(() => setHomeErr(true));
  }, [shipDay]);

  // Packages on the way + weather where they're going
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 10);
        const { data } = await (supabase as any)
          .from("shipping_orders")
          .select("*")
          .not("tracking_number", "is", null)
          .gte("created_at", since.toISOString())
          .limit(500);
        const rows: any[] = (data || []).filter((o: any) => o.status !== "refunded");

        // Still to ship this week: bought in the last 7 days and not packed yet
        const weekAgo = Date.now() - 7 * 864e5;
        if (!cancelled) setToShip(rows.filter((o) => !o.packed_at && new Date(o.created_at).getTime() >= weekAgo).length);

        // On the way: not delivered yet
        const moving = rows.filter((o) => !o.delivered_at && o.to_city && o.to_state);
        const groups = new Map<string, { city: string; state: string; names: string[] }>();
        for (const o of moving) {
          const key = o.to_city.trim().toLowerCase() + "|" + o.to_state.trim().toUpperCase();
          const g = groups.get(key) || { city: o.to_city.trim(), state: o.to_state.trim().toUpperCase(), names: [] };
          g.names.push(o.to_name || "");
          groups.set(key, g);
        }
        const top = Array.from(groups.values()).sort((a, b) => b.names.length - a.names.length).slice(0, 8);

        const found: Alert[] = [];
        await Promise.all(
          top.map(async (g) => {
            try {
              const geo = await fetch(
                "https://geocoding-api.open-meteo.com/v1/search?count=10&countryCode=US&name=" + encodeURIComponent(g.city)
              ).then((r) => r.json());
              const stateName = STATES[g.state] || g.state;
              const place = (geo?.results || []).find((p: any) => p.admin1 === stateName);
              if (!place) return;
              const wx = await fetch(
                "https://api.open-meteo.com/v1/forecast?latitude=" + place.latitude + "&longitude=" + place.longitude +
                "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=5"
              ).then((r) => r.json());
              const days: string[] = wx?.daily?.time || [];
              const where = g.city + ", " + g.state;
              const count = g.names.length;
              const pk = count + " package" + (count === 1 ? "" : "s");
              const who = count === 1 && g.names[0] ? g.names[0].split(" ")[0] + "’s package is" : pk + " are";

              const rainy = days.filter((_, i) => (wx.daily.precipitation_probability_max[i] ?? 0) >= 60);
              const hot = days.map((d, i) => [d, wx.daily.temperature_2m_max[i]] as [string, number]).filter(([, t]) => t >= 100);
              const cold = days.map((d, i) => [d, wx.daily.temperature_2m_min[i]] as [string, number]).filter(([, t]) => t <= 25);

              if (hot.length) {
                const peak = Math.round(Math.max(...hot.map(([, t]) => t)));
                found.push({ kind: "heat", title: "Heat in " + where + " · " + peak + "°", body: who + " headed there. Worth a heads-up to bring it inside quickly.", tag: pk });
              } else if (rainy.length) {
                found.push({ kind: "rain", title: "Rain in " + where + " " + shortDays(rainy), body: who + " headed there. Poly mailers hold up fine; paper boxes can get soaked on a porch.", tag: pk });
              } else if (cold.length) {
                const low = Math.round(Math.min(...cold.map(([, t]) => t)));
                found.push({ kind: "cold", title: "Freezing in " + where + " · " + low + "°", body: who + " headed there. Snow or ice can slow delivery a day.", tag: pk });
              }
            } catch {}
          })
        );
        if (!cancelled) setWeatherAlerts(found.slice(0, 4));
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const alerts = [...holidayAlerts, ...weatherAlerts];
  const shipDayHoliday = holidayAlerts.find((a) => a.body.startsWith("Post offices are closed"));
  const homeIcon = !home ? ICONS.cloud : home.rain >= 50 ? ICONS.rain : home.code <= 2 ? ICONS.sun : ICONS.cloud;

  return (
    <div className="mt-4 grid gap-4 md:mt-5 md:gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* Next ship day */}
      <section className="card flex flex-col gap-4 !rounded-3xl !p-5 md:!rounded-[2rem] md:!p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow">{isToday ? "Ship day is today" : "Next ship day"}</p>
          <span className="text-xs text-ink/55">{HOME.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-sand/30 text-taupe md:h-[72px] md:w-[72px]">
            <Icon d={homeIcon} size={34} />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-[28px] leading-tight text-taupe md:text-[32px]">{dayName(shipDay)}</p>
            <p className="text-sm text-ink/80">
              {home ? `${describe(home.code)} · ${home.hi}° high · ${home.rain >= 20 ? home.rain + "% chance of rain" : "no rain"}` : homeErr ? "Forecast unavailable right now" : "Checking the forecast…"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-cream px-3 py-2.5 dark:bg-transparent dark:ring-1 dark:ring-sand/40">
            <p className="text-xs text-ink/55">USPS</p>
            <p className={`text-sm ${shipDayHoliday ? "text-red-700" : ""}`}>{shipDayHoliday ? "Closed that day" : holidayAlerts.length ? "Holiday this week" : "Normal service"}</p>
          </div>
          <div className="rounded-2xl bg-cream px-3 py-2.5 dark:bg-transparent dark:ring-1 dark:ring-sand/40">
            <p className="text-xs text-ink/55">Not packed yet</p>
            <p className="text-sm">{toShip == null ? "…" : `${toShip} package${toShip === 1 ? "" : "s"}`}</p>
          </div>
        </div>
      </section>

      {/* Heads up this week */}
      <section className="card flex flex-col gap-2.5 !rounded-3xl !p-5 md:!rounded-[2rem] md:!p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow">Heads up this week</p>
          <span className="text-xs text-ink/55">{checking ? "Checking…" : alerts.length ? `${alerts.length} alert${alerts.length === 1 ? "" : "s"}` : ""}</span>
        </div>
        {alerts.map((a, i) => (
          <div key={i} className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 md:items-center ${a.warn ? "bg-[#fbf1dc] dark:bg-transparent dark:ring-1 dark:ring-[#e6c88f]/40" : "bg-cream dark:bg-transparent dark:ring-1 dark:ring-sand/40"}`}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white dark:bg-transparent ${a.warn ? "text-[#7a5a1e] dark:text-[#e6c88f]" : "text-taupe"}`}>
              <Icon d={a.kind === "holiday" ? ICONS.cal : a.kind === "rain" ? ICONS.rain : a.kind === "heat" ? ICONS.heat : ICONS.snow} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px]">{a.title}</p>
              <p className="text-[13px] leading-snug text-ink/60">{a.body}</p>
            </div>
            <span className="hidden shrink-0 whitespace-nowrap text-xs text-ink/55 sm:inline">{a.tag}</span>
          </div>
        ))}
        {!checking && !alerts.length && (
          <div className="flex flex-1 items-center gap-3 rounded-2xl bg-cream px-4 py-4 text-sm text-ink/60 dark:bg-transparent dark:ring-1 dark:ring-sand/40">
            <span className="text-taupe"><Icon d={ICONS.sun} /></span>
            All clear: no USPS holidays and no bad weather where your packages are headed.
          </div>
        )}
      </section>
    </div>
  );
}
