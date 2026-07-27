'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';
import EventFormModal from '@/components/EventFormModal';
import LocationSettingModal from '@/components/LocationSettingModal';
import AssistantChat from '@/components/AssistantChat';
import {
  buildSpokenText,
  createEvent,
  deleteEvent,
  getEventsBetween,
  getEventsByDate,
  updateEvent,
} from '@/lib/scheduleApi';
import { buildWeatherSummaryText, fetchForecast, getLocationSetting, setLocationSetting } from '@/lib/weatherApi';
import { EVENT_TYPE_LABELS, type LocationSetting, type ScheduleEvent } from '@/lib/types';

const OUTRO_TRACK_ID = '__outro__';
const WEATHER_TRACK_ID = '__weather__';

interface BriefingSegment {
  id: string;
  text: string;
}

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayString(): string {
  return toDateString(new Date());
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 오늘이 포함된 주(월~일)의 날짜 문자열 7개를 반환한다.
function getWeekDates(dateStr: string): string[] {
  const base = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = base.getDay(); // 0=일 ... 6=토
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateString(d);
  });
}

export default function Home() {
  const [date] = useState(todayString);
  const weekDates = useState(() => getWeekDates(todayString()))[0];
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [weekEvents, setWeekEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    mode: 'create' | 'edit';
    event: ScheduleEvent | null;
    targetDate: string;
  } | null>(null);
  const [playingEventId, setPlayingEventId] = useState<string | null>(null);
  const [weatherSummary, setWeatherSummary] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationSetting | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  async function refreshWeek() {
    try {
      const result = await getEventsBetween(weekDates[0], weekDates[6]);
      setWeekEvents(result);
    } catch {
      // 주간 보기는 부가 기능이라 실패해도 오늘 일정 화면은 그대로 둔다.
    }
  }

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
    await refreshWeek();
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
    getEventsBetween(weekDates[0], weekDates[6])
      .then(setWeekEvents)
      .catch(() => setWeekEvents([]));
    getLocationSetting()
      .then(setLocation)
      .catch(() => setLocation(null));
  }, [date, weekDates]);

  useEffect(() => {
    if (!location) return;
    fetchForecast(location.lat, location.lon)
      .then(forecast => setWeatherSummary(buildWeatherSummaryText(forecast)))
      .catch(() => setWeatherSummary(null));
  }, [location]);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

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

  function speakSegment(segments: BriefingSegment[], index: number) {
    if (index >= segments.length) {
      setPlayingEventId(null);
      return;
    }
    const segment = segments[index];
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = 'ko-KR';
    utterance.onstart = () => setPlayingEventId(segment.id);
    utterance.onend = () => speakSegment(segments, index + 1);
    utterance.onerror = () => setPlayingEventId(null);
    window.speechSynthesis.speak(utterance);
  }

  function startBriefing() {
    const segments: BriefingSegment[] = events.map(event => ({
      id: event.id,
      text: buildSpokenText(event),
    }));
    if (weatherSummary) {
      segments.push({ id: WEATHER_TRACK_ID, text: weatherSummary });
    }
    if (segments.length === 0) return;
    segments.push({ id: OUTRO_TRACK_ID, text: '이상입니다.' });
    window.speechSynthesis.cancel();
    speakSegment(segments, 0);
  }

  function stopBriefing() {
    window.speechSynthesis.cancel();
    setPlayingEventId(null);
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>오늘의 일정</h1>
          <span className={styles.dateLabel}>{date}</span>
        </div>

        <button className={styles.buttonPrimary} onClick={() => setIsChatOpen(true)}>
          💬 미스킴에게 말하기
        </button>

        <div className={styles.weatherRow}>
          {weatherSummary ? (
            <span
              className={`${styles.weatherText} ${playingEventId === WEATHER_TRACK_ID ? styles.eventRowPlaying : ''}`}
            >
              {weatherSummary}
            </span>
          ) : (
            <span className={styles.hint}>{location ? '날씨 불러오는 중...' : '근무 지역이 설정되지 않았습니다'}</span>
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

        {!loading && !error && (events.length > 0 || weatherSummary) && (
          <div className={styles.briefingRow}>
            {playingEventId ? (
              <button className={styles.buttonPrimary} onClick={stopBriefing}>■ 브리핑 중지</button>
            ) : (
              <button className={styles.buttonPrimary} onClick={startBriefing}>
                ▶ 오늘 브리핑 듣기
              </button>
            )}
          </div>
        )}

        <div className={styles.eventList}>
          {events.map(event => (
            <div
              key={event.id}
              className={`${styles.eventRow} ${playingEventId === event.id ? styles.eventRowPlaying : ''}`}
              onClick={() => setModalState({ mode: 'edit', event, targetDate: date })}
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

        <button
          className={styles.buttonPrimary}
          onClick={() => setModalState({ mode: 'create', event: null, targetDate: date })}
        >
          + 새 일정 추가
        </button>

        <div className={styles.weekSection}>
          <h2 className={styles.weekTitle}>이번 주 일정</h2>
          {weekDates.map(d => {
            const dayEvents = weekEvents.filter(e => e.date === d);
            const dateObj = new Date(`${d}T00:00:00`);
            const isToday = d === date;
            return (
              <div key={d} className={styles.weekDay}>
                <div
                  className={`${styles.weekDayHeader} ${isToday ? styles.weekDayHeaderToday : ''}`}
                  onClick={() => setModalState({ mode: 'create', event: null, targetDate: d })}
                >
                  <span>
                    {dateObj.getMonth() + 1}/{dateObj.getDate()} ({WEEKDAY_LABELS[dateObj.getDay()]})
                  </span>
                  <span className={styles.hint}>+ 추가</span>
                </div>
                {dayEvents.length === 0 ? (
                  <span className={styles.hint}>일정 없음</span>
                ) : (
                  dayEvents.map(e => (
                    <div
                      key={e.id}
                      className={styles.weekEventLine}
                      onClick={ev => {
                        ev.stopPropagation();
                        setModalState({ mode: 'edit', event: e, targetDate: d });
                      }}
                    >
                      {e.time ? `${e.time} ` : ''}
                      {e.title}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </main>

      {modalState && (
        <EventFormModal
          defaultDate={modalState.targetDate}
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

      {isChatOpen && (
        <AssistantChat onClose={() => setIsChatOpen(false)} onEventCreated={refresh} />
      )}
    </div>
  );
}
