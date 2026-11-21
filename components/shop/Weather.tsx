"use client";

import { useEffect, useState } from "react";

export type Weather = "sun" | "rain" | "snow";
const KEY = "shop-weather";
const EVENT = "shop-weather-change";

export const WEATHER_LABEL: Record<Weather, string> = { sun: "Nắng Ấm ☀️", rain: "Mưa Dầm 🌧️", snow: "Tuyết Rơi ❄️" };

function read(): Weather {
  try {
    const v = localStorage.getItem(KEY);
    return v === "rain" || v === "snow" ? v : "sun";
  } catch {
    return "sun";
  }
}

/** Thời tiết của Tiệm Quà: lưu trong trình duyệt (chỉ tiện ích hiển thị); đọc sau khi mount để không lệch HTML */
export function useWeather(): [Weather, (w: Weather) => void] {
  const [w, setW] = useState<Weather>("sun");
  useEffect(() => {
    const sync = () => setW(read());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const set = (next: Weather) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    setW(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [w, set];
}

// Vị trí hạt cố định theo chỉ số (không Math.random) → ổn định giữa các lần render
const DROPS = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 100) / 50,
  dur: 0.7 + ((i * 29) % 10) / 20,
}));
const FLAKES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 41) % 100,
  delay: ((i * 67) % 100) / 12,
  dur: 6 + ((i * 31) % 10) / 2,
  size: 8 + ((i * 17) % 4) * 3,
}));

/** Lớp hiệu ứng thời tiết phủ lên tiệm (không bắt chuột; tắt hẳn khi người dùng chọn giảm chuyển động) */
export function WeatherLayer({ weather }: { weather: Weather }) {
  if (weather === "sun") {
    return (
      <div aria-hidden className="weather-layer" data-weather="sun">
        <span className="weather-sun" />
      </div>
    );
  }
  return (
    <div aria-hidden className="weather-layer" data-weather={weather}>
      {weather === "rain"
        ? DROPS.map((d, i) => <span key={i} className="weather-drop" style={{ left: `${d.left}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }} />)
        : FLAKES.map((f, i) => (
            <span key={i} className="weather-flake" style={{ left: `${f.left}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s`, fontSize: `${f.size}px` }}>
              ❄
            </span>
          ))}
    </div>
  );
}
