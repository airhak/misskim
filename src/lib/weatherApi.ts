import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { LocationSetting } from './types';

const SETTINGS_COLLECTION = 'settings';
const LOCATION_DOC_ID = 'location';

export async function getLocationSetting(): Promise<LocationSetting | null> {
  const snap = await getDoc(doc(db, SETTINGS_COLLECTION, LOCATION_DOC_ID));
  return snap.exists() ? (snap.data() as LocationSetting) : null;
}

export async function setLocationSetting(location: LocationSetting): Promise<void> {
  await setDoc(doc(db, SETTINGS_COLLECTION, LOCATION_DOC_ID), location);
}

export interface LocationCandidate {
  name: string;
  admin1?: string;
  country?: string;
  lat: number;
  lon: number;
}

// Open-Meteo 지오코딩은 한글 지명 검색이 안 돼서(로마자만 인식), 자주 쓰는 도시는 미리 좌표를 박아둔다.
export const KOREAN_CITY_PRESETS: LocationCandidate[] = [
  { name: '서울', lat: 37.5665, lon: 126.978 },
  { name: '인천', lat: 37.4563, lon: 126.7052 },
  { name: '김포', lat: 37.6152, lon: 126.7159 },
  { name: '수원', lat: 37.2636, lon: 127.0286 },
  { name: '성남', lat: 37.4201, lon: 127.1267 },
  { name: '고양', lat: 37.6584, lon: 126.832 },
  { name: '부산', lat: 35.1796, lon: 129.0756 },
  { name: '대구', lat: 35.8714, lon: 128.6014 },
  { name: '대전', lat: 36.3504, lon: 127.3845 },
  { name: '광주', lat: 35.1595, lon: 126.8526 },
  { name: '울산', lat: 35.5384, lon: 129.3114 },
  { name: '세종', lat: 36.4801, lon: 127.289 },
];

// Open-Meteo 지오코딩 API — API 키 불필요.
export async function searchLocation(query: string): Promise<LocationCandidate[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=ko&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  const results: {
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }[] = data.results ?? [];
  return results.map(r => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export interface ForecastResult {
  date: string;
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  precipitationChance: number; // 오후(12~18시) 시간대 중 최댓값
}

// 브리핑 화면/음성이 그때그때 실시간으로 이 함수를 호출해서 예보를 받는다. API 키 불필요.
export async function fetchForecast(lat: number, lon: number): Promise<ForecastResult> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min&hourly=precipitation_probability&timezone=Asia%2FSeoul&forecast_days=1`;
  const res = await fetch(url);
  const data = await res.json();

  const tempMax = data.daily.temperature_2m_max[0];
  const tempMin = data.daily.temperature_2m_min[0];
  const tempAvg = Math.round(((tempMax + tempMin) / 2) * 10) / 10;

  // 시간 문자열은 "2026-07-27T12:00" 형태(이미 Asia/Seoul 로컬 시각)라 Date로 파싱하면
  // 실행 서버 타임존에 따라 어긋날 수 있어 문자열에서 직접 시(hour)를 추출한다.
  const hours: string[] = data.hourly.time;
  const precip: number[] = data.hourly.precipitation_probability;
  let afternoonMax = 0;
  for (let i = 0; i < hours.length; i++) {
    const hour = parseInt(hours[i].slice(11, 13), 10);
    if (hour >= 12 && hour <= 18) {
      afternoonMax = Math.max(afternoonMax, precip[i] ?? 0);
    }
  }

  return {
    date: data.daily.time[0],
    tempMin,
    tempMax,
    tempAvg,
    precipitationChance: afternoonMax,
  };
}

// TTS로 그대로 넘겨서 날씨 음성을 만드는 문구. 화면 표시에도 동일하게 쓴다.
export function buildWeatherSummaryText(forecast: ForecastResult): string {
  const rainPart =
    forecast.precipitationChance >= 50 ? '오후에는 비가 내립니다. 우산을 준비하셔야 합니다. ' : '';
  return `${rainPart}오늘 평균 기온은 ${Math.round(forecast.tempAvg)}도 입니다.`;
}
