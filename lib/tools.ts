import fs from "fs";
import path from "path";
import { logActivity } from "@/lib/db";
import { nearestVenue, venueKeyFor } from "@/lib/venues";

const FREE_FOOD = /free food|pizza|boba|snacks|refreshments|dinner provided/i;
const DINING_SLUGS: Record<string, string> = {
  "timothy-dwight-college": "timothy-dwight",
  "berkeley-college": "berkeley",
  "branford-college": "branford",
  "davenport-college": "davenport",
  "ezra-stiles-college": "ezra-stiles",
  "hopper-college": "grace-hopper",
  "jonathan-edwards-college": "jonathan-edwards",
  "morse-college": "morse",
  "pauli-murray-college": "pauli-murray",
  "pierson-college": "pierson",
  "saybrook-college": "saybrook",
  "silliman-college": "silliman",
  "trumbull-college": "trumbull",
  "benjamin-franklin-college": "benjamin-franklin",
  "schwarzman-center": "schwarzman",
};

type Hall = {
  name?: string;
  slug?: string;
  geolocation?: { latitude?: number; longitude?: number };
  operating_status?: string;
  operating_days_by_menu_type?: Array<Record<string, unknown>>;
};

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function newHavenParts() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const day = (parts.weekday ?? "Tue").slice(0, 3).toLowerCase();
  return {
    day,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    year: parts.year ?? "2026",
    month: parts.month ?? "11",
    dayOfMonth: parts.day ?? "17",
    minutes: Number(parts.hour ?? "0") * 60 + Number(parts.minute ?? "0"),
  };
}

function minutesOf(clock: unknown): number | null {
  if (typeof clock !== "string") return null;
  const [hour, minute] = clock.split(":");
  const h = Number(hour);
  const m = Number(minute);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export async function readInbox(): Promise<unknown[]> {
  const started = Date.now();
  try {
    const dir = path.join(process.cwd(), "emails");
    if (!fs.existsSync(dir)) {
      logActivity("Scout", "checking panlists… quiet", Date.now() - started);
      return [];
    }
    const files = fs
      .readdirSync(dir)
      .filter((file) => /\.(eml|txt|html)$/i.test(file));
    const emails = files.slice(0, 40).map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const subject = raw.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() ?? file;
      const split = raw.split(/\r?\n\r?\n/);
      const body = (split.length > 1 ? split.slice(1).join("\n\n") : raw)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);
      return { file, subject, body, source: `panlist: ${file} — subject: ${subject}` };
    });
    logActivity(
      "Scout",
      emails.length === 0
        ? "checking panlists… quiet"
        : `checking panlists… ${emails.length} on the list`,
      Date.now() - started,
    );
    return emails;
  } catch (error) {
    console.error("read_inbox failed", error);
    logActivity("Scout", "checking panlists… couldn't read them", Date.now() - started);
    return [];
  }
}

export async function getEvents(): Promise<unknown[]> {
  const started = Date.now();
  try {
    const data = (await fetchJson(
      "https://events.yale.edu/api/2/events?days=7&pp=100",
    )) as { events?: Array<{ event?: Record<string, unknown> }> };
    const now = newHavenParts();
    const events = (data.events ?? [])
      .map((wrapper) => wrapper.event)
      .filter((event): event is Record<string, unknown> => Boolean(event))
      .map((event) => {
        const instances = event.event_instances as
          | Array<{ event_instance?: { start?: string; end?: string } }>
          | undefined;
        const instance = instances?.[0]?.event_instance;
        const geo = event.geo as { latitude?: string | number; longitude?: string | number } | undefined;
        const lat = geo?.latitude != null ? Number(geo.latitude) : undefined;
        const lng = geo?.longitude != null ? Number(geo.longitude) : undefined;
        const where = String(event.location_name || event.address || "Yale");
        const blurb = String(event.description_text || "").replace(/\s+/g, " ").trim();
        const venue =
          (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
            ? nearestVenue(lat, lng)
            : undefined) ?? venueKeyFor(where);
        return {
          title: String(event.title || "Untitled event"),
          when: instance?.start ?? "",
          end: instance?.end ?? "",
          where,
          blurb: blurb.slice(0, 360),
          freeFood: FREE_FOOD.test(blurb) || FREE_FOOD.test(String(event.title || "")),
          link: typeof event.url === "string" ? event.url : undefined,
          lat,
          lng,
          venue: venue ?? null,
          today: String(instance?.start ?? "").startsWith(now.date),
          source: "events.yale.edu",
        };
      });
    const tonight = events.filter((event) => event.today).length;
    logActivity("Vista", `checking the calendar… ${tonight} tonight`, Date.now() - started);
    return events;
  } catch (error) {
    console.error("get_events failed", error);
    logActivity("Vista", "checking the calendar… didn't answer", Date.now() - started);
    return [];
  }
}

export async function getDining(hall?: string): Promise<unknown[]> {
  const started = Date.now();
  try {
    const schools = (await fetchJson(
      "https://yalehospitality.api.nutrislice.com/menu/api/schools/?format=json",
    )) as Hall[];
    const now = newHavenParts();
    const wanted = hall?.trim().toLowerCase();
    const halls = schools.filter((school) => {
      if (!wanted) return true;
      const name = `${school.name ?? ""} ${school.slug ?? ""}`.toLowerCase();
      const venue = school.slug ? DINING_SLUGS[school.slug] : undefined;
      return name.includes(wanted) || wanted.includes((school.slug ?? "").replace(/-/g, " ")) || venue === wanted;
    });

    const rows = await Promise.all(
      halls.map(async (school) => {
        const slug = school.slug ?? "";
        const geo = school.geolocation;
        const venue =
          DINING_SLUGS[slug] ??
          (geo?.latitude != null && geo.longitude != null
            ? nearestVenue(geo.latitude, geo.longitude)
            : undefined) ??
          venueKeyFor(school.name);
        const meals = (school.operating_days_by_menu_type ?? []).map((block) => {
          const start = minutesOf(block[`${now.day}_start`]);
          const end = minutesOf(block[`${now.day}_end`]);
          const enabled = Boolean(block[`${now.day}_enabled`]);
          return {
            name: String(block.menu_type_name ?? "meal"),
            start: String(block[`${now.day}_start`] ?? ""),
            end: String(block[`${now.day}_end`] ?? ""),
            enabled,
            openNow: enabled && start != null && end != null && now.minutes >= start && now.minutes < end,
          };
        });
        const dinner = meals.find((meal) => meal.name.toLowerCase() === "dinner");
        let dinnerItems: string[] = [];
        if (dinner?.enabled && slug) {
          try {
            const menu = (await fetchJson(
              `https://yalehospitality.api.nutrislice.com/menu/api/digest/school/${slug}/menu-type/dinner/date/${now.year}/${now.month}/${now.dayOfMonth}/?format=json`,
            )) as { menu_items?: string[] };
            dinnerItems = (menu.menu_items ?? []).filter((item) => typeof item === "string").slice(0, 12);
          } catch (error) {
            console.error("dining menu failed", slug, error);
          }
        }
        return {
          name: school.name,
          slug,
          venue: venue ?? null,
          lat: geo?.latitude,
          lng: geo?.longitude,
          operatingStatus: school.operating_status,
          openNow: meals.some((meal) => meal.openNow),
          meals: meals.map(({ name, start, end, enabled, openNow }) => ({
            name,
            start,
            end,
            enabled,
            openNow,
          })),
          dinnerItems,
          source: `nutrislice: ${slug} / dinner`,
        };
      }),
    );
    const open = rows.filter((row) => row.openNow).length;
    logActivity("Chef", `${open} halls open`, Date.now() - started);
    return rows;
  } catch (error) {
    console.error("get_dining failed", error);
    logActivity("Chef", "dining feed didn't answer", Date.now() - started);
    return [];
  }
}
