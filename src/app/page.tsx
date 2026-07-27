'use client';

import { useRef, useEffect, useState } from 'react';
import styles from './page.module.css';
import EventFormModal from '@/components/EventFormModal';
import LocationSettingModal from '@/components/LocationSettingModal';
import { createEvent, deleteEvent, getEventsByDate, updateEvent } from '@/lib/scheduleApi';
import { getLocationSetting, getWeatherByDate, setLocationSetting } from '@/lib/weatherApi';
import { EVENT_TYPE_LABELS, type LocationSetting, type ScheduleEvent, type WeatherDoc } from '@/lib/types';
import { OUTRO_AUDIO_URL } from '@/lib/voice';

const OUTRO_TRACK_ID = '__outro__';
const WEATHER_TRACK_ID = '__weather__';

interface BriefingTrack {
  url: string;
  eventId: string;
}

function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Home() {
  const [date] = useState(todayString);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; event: ScheduleEvent | null } | null>(
    null
  );
  const [playingEventId, setPlayingEventId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [weather, setWeather] = useState<WeatherDoc | null>(null);
  const [location, setLocation] = useState<LocationSetting | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  async function refresh() {
    try {
      const result = await getEventsByDate(date);
      setEvents(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '일정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getEventsByDate(date)
      .then(result => {
        setEvents(result);
        setError(null);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : '일정을 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
    getWeatherByDate(date)
      .then(setWeather)
      .catch(() => setWeather(null));
    getLocationSetting()
      .then(setLocation)
      .catch(() => setLocation(null));
  }, [date]);

  async function handleLocationSave(next: LocationSetting) {
    await setLocationSetting(next);
    setLocation(next);
    setIsLocationModalOpen(false);
  }

  async function handleSave(patch: Omit<ScheduleEvent, 'id'>) {
    if (modalState?.mode === 'edit' && modalState.event) {
      await updateEvent(modalState.event.id, patch);
    } else {
      await createEvent(patch);
    }
    setModalState(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (playingEventId) stopBriefing();
    await deleteEvent(id);
    await refresh();
  }

  function playTrack(playlist: BriefingTrack[], index: number) {
    if (index >= playlist.length) {
      setPlayingEventId(null);
      audioRef.current = null;
      return;
    }
    const track = playlist[index];
    const audio = new Audio(track.url);
    audioRef.current = audio;
    setPlayingEventId(track.eventId);
    audio.onended = () => playTrack(playlist, index + 1);
    audio.play().catch(() => {
      setPlayingEventId(null);
      audioRef.current = null;
    });
  }

  function startBriefing() {
    const playlist: BriefingTrack[] = events
      .filter(event => event.audioUrl)
      .map(event => ({ url: event.audioUrl as string, eventId: event.id }));
    if (weather?.audioUrl) {
      playlist.push({ url: weather.audioUrl, eventId: WEATHER_TRACK_ID });
    }
    if (playlist.length === 0) return;
    playlist.push({ url: OUTRO_AUDIO_URL, eventId: OUTRO_TRACK_ID });
    playTrack(playlist, 0);
  }

  function stopBriefing() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingEventId(null);
  }

  const readyCount = events.filter(event => event.audioUrl).length;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>오늘의 일정</h1>
          <span className={styles.dateLabel}>{date}</span>
        </div>

        <div className={styles.weatherRow}>
          {weather ? (
            <span
              className={`${styles.weatherText} ${playingEventId === WEATHER_TRACK_ID ? styles.eventRowPlaying : ''}`}
            >
              {weather.summaryText}
            </span>
          ) : (
            <span className={styles.hint}>{location ? '오늘 날씨 정보 없음' : '근무 지역이 설정되지 않았습니다'}</span>
          )}
          <button className={styles.deleteButton} onClick={() => setIsLocationModalOpen(true)}>
            지역 설정{location ? ` (${location.name})` : ''}
          </button>
        </div>

        {loading && <p className={styles.hint}>불러오는 중...</p>}
        {error && <p className={styles.errorText}>{error}</p>}

        {!loading && !error && events.length === 0 && (
          <p className={styles.hint}>오늘 등록된 일정이 없습니다.</p>
        )}

        {!loading && !error && (events.length > 0 || weather?.audioUrl) && (
          <div className={styles.briefingRow}>
            {playingEventId ? (
              <button className={styles.buttonPrimary} onClick={stopBriefing}>■ 브리핑 중지</button>
            ) : (
              <button className={styles.buttonPrimary} onClick={startBriefing} disabled={readyCount === 0 && !weather?.audioUrl}>
                ▶ 오늘 브리핑 듣기
              </button>
            )}
            {readyCount < events.length && (
              <span className={styles.hint}>
                {readyCount}/{events.length}개 음성 준비됨 (나머지는 내일 아침 자동 생성)
              </span>
            )}
          </div>
        )}

        <div className={styles.eventList}>
          {events.map(event => (
            <div
              key={event.id}
              className={`${styles.eventRow} ${playingEventId === event.id ? styles.eventRowPlaying : ''}`}
              onClick={() => setModalState({ mode: 'edit', event })}
            >
              <span className={styles.eventTime}>{event.time || '종일'}</span>
              <span className={styles.eventBadge}>{EVENT_TYPE_LABELS[event.type]}</span>
              <span className={styles.eventTitle}>{event.title}</span>
              {event.location && <span className={styles.eventLocation}>{event.location}</span>}
              <button
                className={styles.deleteButton}
                onClick={e => {
                  e.stopPropagation();
                  handleDelete(event.id);
                }}
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <button className={styles.buttonPrimary} onClick={() => setModalState({ mode: 'create', event: null })}>
          + 새 일정 추가
        </button>
      </main>

      {modalState && (
        <EventFormModal
          date={date}
          initial={modalState.event}
          onSave={handleSave}
          onClose={() => setModalState(null)}
        />
      )}

      {isLocationModalOpen && (
        <LocationSettingModal
          current={location}
          onSave={handleLocationSave}
          onClose={() => setIsLocationModalOpen(false)}
        />
      )}
    </div>
  );
}
