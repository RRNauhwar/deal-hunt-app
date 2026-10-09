let _loc = { lat: null, lon: null, area: null };

export function getLocation() {
  return _loc;
}
export function setLocation(l) {
  _loc = l;
  try {
    sessionStorage.setItem("dh_loc", JSON.stringify(l));
  } catch (e) {}
}
export function loadSavedLocation() {
  try {
    const s = sessionStorage.getItem("dh_loc");
    if (s) {
      _loc = JSON.parse(s);
      return _loc;
    }
  } catch (e) {}
  return null;
}

export function detectGPS(onOk, onErr) {
  if (!navigator.geolocation) {
    onErr?.("Geolocation not supported");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async ({ coords: { latitude: lat, longitude: lon } }) => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
          { headers: { "Accept-Language": "en" } }
        );
        const d = await r.json();
        const a = d.address || {};
        const area =
          [
            a.suburb || a.neighbourhood || a.village,
            a.city || a.town || a.state_district,
          ]
            .filter(Boolean)
            .join(", ") || "Your area";
        setLocation({ lat, lon, area });
        onOk?.(area, lat, lon);
      } catch {
        setLocation({ lat, lon, area: "Location detected" });
        onOk?.("Location detected", lat, lon);
      }
    },
    (err) =>
      onErr?.(
        err.code === 1
          ? "Location access denied. Enter manually."
          : "Could not detect location."
      ),
    { timeout: 8000 }
  );
}

export async function searchArea(q) {
  if (!q || q.length < 2) return [];
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&limit=6&addressdetails=1&countrycodes=in`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await r.json();
    return data.map((item) => {
      const a = item.address || {};
      const parts = [
        a.suburb || a.neighbourhood || a.village,
        a.city || a.town || a.state_district,
        a.state,
      ].filter(Boolean);
      return {
        display:
          parts.join(", ") ||
          item.display_name.split(",").slice(0, 3).join(", "),
        lat: +item.lat,
        lon: +item.lon,
      };
    });
  } catch {
    return [];
  }
}
