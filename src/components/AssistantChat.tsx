'use client';

import { useEffect, useRef, useState } from 'react';
import styles from '@/app/page.module.css';
import { createEvent, deleteEvent, getEventsBetween } from '@/lib/scheduleApi';
import { KOREAN_CITY_PRESETS, buildWeatherReplyText, fetchForecastForDate, searchLocation } from '@/lib/weatherApi';
import { EVENT_TYPE_LABELS, type EventType, type LocationSetting, type ScheduleEvent } from '@/lib/types';

interface ChatMsg {
  role: 'user' | 'model';
  text: string;
}

interface ChatAction {
  date: string;
  time?: string | null;
  title: string;
  location?: string | null;
  eventType: EventType;
}

interface ChatQuery {
  type: 'schedule' | 'weather';
  dateFrom: string;
  dateTo: string;
  location?: string | null;
}

interface ChatDeleteQuery {
  dateFrom: string;
  dateTo: string;
  keyword: string;
}

interface AssistantChatProps {
  location: LocationSetting | null;
  onClose: () => void;
  onEventCreated: () => void;
}

function dateRange(from: string, to: string): string[] {
  const result: string[] = [];
  const cur = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  let guard = 0;
  while (cur <= end && guard < 60) {
    result.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    );
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return result;
}

// 채팅에서 언급된 지역명을 좌표로 바꾼다. 프리셋 도시(한글) 우선, 없으면 Open-Meteo 검색(영문)을
// 시도하고, 그래도 안 되면 사용자가 설정해둔 근무 지역으로 대체한다.
async function resolveWeatherLocation(
  name: string | null | undefined,
  fallback: LocationSetting | null
): Promise<{ lat: number; lon: number; label: string } | null> {
  if (name) {
    const preset = KOREAN_CITY_PRESETS.find(c => c.name === name || name.includes(c.name) || c.name.includes(name));
    if (preset) return { lat: preset.lat, lon: preset.lon, label: preset.name };
    try {
      const results = await searchLocation(name);
      if (results[0]) return { lat: results[0].lat, lon: results[0].lon, label: results[0].name };
    } catch {
      // 검색 실패는 무시하고 기본 지역으로 넘어간다.
    }
  }
  return fallback ? { lat: fallback.lat, lon: fallback.lon, label: fallback.name } : null;
}

function formatScheduleReply(events: ScheduleEvent[], dateFrom: string, dateTo: string): string {
  if (events.length === 0) {
    return dateFrom === dateTo ? `${dateFrom}에는 일정이 없습니다.` : `${dateFrom} ~ ${dateTo} 기간엔 일정이 없습니다.`;
  }
  const byDate = new Map<string, ScheduleEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }
  return Array.from(byDate.entries())
    .map(([d, list]) => {
      const items = list.map(e => `${e.time ? e.time + ' ' : ''}${e.title}`).join(', ');
      return `${d}: ${items}`;
    })
    .join('\n');
}

export default function AssistantChat({ location, onClose, onEventCreated }: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'model', text: '안녕하세요, 대표님. 일정을 말씀해 주시면 등록해드릴게요.' },
  ]);
  const [pendingAction, setPendingAction] = useState<ChatAction | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<ScheduleEvent[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction, pendingDeletes]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: 'user' as const, text }];
    setMessages(nextMessages);
    setInput('');
    setPendingAction(null);
    setPendingDeletes([]);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '응답을 받지 못했습니다.');
      setMessages(prev => [...prev, { role: 'model', text: data.reply }]);
      if (data.action) setPendingAction(data.action);
      if (data.query) await handleQuery(data.query);
      if (data.deleteQuery) await handleDeleteQuery(data.deleteQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuery(query: ChatQuery) {
    try {
      if (query.type === 'schedule') {
        const events = await getEventsBetween(query.dateFrom, query.dateTo);
        setMessages(prev => [...prev, { role: 'model', text: formatScheduleReply(events, query.dateFrom, query.dateTo) }]);
        return;
      }
      // weather
      const resolved = await resolveWeatherLocation(query.location, location);
      if (!resolved) {
        setMessages(prev => [...prev, { role: 'model', text: '지역을 확인할 수 없어요. 먼저 근무 지역을 설정해주세요.' }]);
        return;
      }
      const dates = dateRange(query.dateFrom, query.dateTo);
      const results = await Promise.all(dates.map(d => fetchForecastForDate(resolved.lat, resolved.lon, d)));
      const lines = results.filter((r): r is NonNullable<typeof r> => r !== null).map(buildWeatherReplyText);
      const text =
        lines.length > 0 ? `[${resolved.label}]\n${lines.join('\n')}` : '해당 날짜의 날씨 예보를 가져오지 못했습니다.';
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: '조회 중 오류가 발생했습니다.' }]);
    }
  }

  async function handleDeleteQuery(dq: ChatDeleteQuery) {
    try {
      const events = await getEventsBetween(dq.dateFrom, dq.dateTo);
      const keyword = dq.keyword.trim().toLowerCase();
      const matches = keyword ? events.filter(e => e.title.toLowerCase().includes(keyword)) : events;
      if (matches.length === 0) {
        setMessages(prev => [...prev, { role: 'model', text: `"${dq.keyword}"이(가) 포함된 일정을 찾지 못했습니다.` }]);
        return;
      }
      setPendingDeletes(matches);
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: '삭제할 일정을 찾는 중 오류가 발생했습니다.' }]);
    }
  }

  async function handleConfirmDelete(event: ScheduleEvent) {
    await deleteEvent(event.id);
    setMessages(prev => [...prev, { role: 'model', text: `✅ "${event.title}" 일정을 삭제했습니다.` }]);
    setPendingDeletes(prev => prev.filter(e => e.id !== event.id));
    onEventCreated();
  }

  function handleCancelDeletes() {
    setMessages(prev => [...prev, { role: 'model', text: '삭제하지 않았습니다.' }]);
    setPendingDeletes([]);
  }

  async function handleConfirm() {
    if (!pendingAction) return;
    await createEvent({
      date: pendingAction.date,
      time: pendingAction.time || undefined,
      title: pendingAction.title,
      location: pendingAction.location || undefined,
      type: pendingAction.eventType,
    });
    setMessages(prev => [...prev, { role: 'model', text: '✅ 등록 완료했습니다.' }]);
    setPendingAction(null);
    onEventCreated();
  }

  function handleCancel() {
    setMessages(prev => [...prev, { role: 'model', text: '취소했습니다.' }]);
    setPendingAction(null);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalBox}
        style={{ width: '420px', height: '560px' }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>미스킴에게 말하기</div>
        <div className={styles.modalBody} style={{ flex: 1, overflowY: 'auto' }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? 'rgb(99, 102, 241)' : 'rgba(255,255,255,0.06)',
                color: m.role === 'user' ? '#fff' : '#e2e8f0',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.6rem',
                maxWidth: '85%',
                fontSize: '0.85rem',
              }}
            >
              {m.text}
            </div>
          ))}
          {pendingAction && (
            <div
              style={{
                border: '1px solid rgba(99,102,241,0.5)',
                borderRadius: '0.6rem',
                padding: '0.6rem 0.75rem',
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div>
                📅 {pendingAction.date} {pendingAction.time ?? ''} · {EVENT_TYPE_LABELS[pendingAction.eventType]}
                <br />
                {pendingAction.title}
                {pendingAction.location ? ` · ${pendingAction.location}` : ''}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className={styles.buttonPrimary} onClick={handleConfirm}>등록</button>
                <button className={styles.button} onClick={handleCancel}>취소</button>
              </div>
            </div>
          )}
          {pendingDeletes.length > 0 && (
            <div
              style={{
                border: '1px solid rgba(239,68,68,0.5)',
                borderRadius: '0.6rem',
                padding: '0.6rem 0.75rem',
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              {pendingDeletes.map(event => (
                <div key={event.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span>
                    🗑️ {event.date} {event.time ?? ''} · {event.title}
                    {event.location ? ` · ${event.location}` : ''}
                  </span>
                  <button className={styles.button} onClick={() => handleConfirmDelete(event)}>삭제</button>
                </div>
              ))}
              <button className={styles.button} onClick={handleCancelDeletes} style={{ alignSelf: 'flex-start' }}>
                모두 취소
              </button>
            </div>
          )}
          {loading && <p className={styles.hint}>생각 중...</p>}
          {error && <p className={styles.errorText}>{error}</p>}
          <div ref={bottomRef} />
        </div>
        <div className={styles.modalFooter}>
          <input
            className={styles.input}
            style={{ flex: 1 }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="예: 내일 오후 2시에 김 사장한테 전화하기"
            autoFocus
          />
          <button className={styles.buttonPrimary} onClick={handleSend} disabled={loading || !input.trim()}>
            보내기
          </button>
        </div>
      </div>
    </div>
  );
}
