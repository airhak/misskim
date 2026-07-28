'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PanelLeft, PanelRight, CalendarDays } from 'lucide-react';
import styles from '../page.module.css';
import calStyles from './calendar.module.css';
import EventFormModal from '@/components/EventFormModal';
import { createEvent, deleteEvent, getEventsBetween, updateEvent } from '@/lib/scheduleApi';
import { getTags, setTags as saveTags } from '@/lib/tagsApi';
import { EVENT_TYPE_LABELS, TAG_COLOR_HEX, type ScheduleEvent, type Tag, type TagColor } from '@/lib/types';

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 6주(42칸) 고정 그리드 — 어떤 달이든 앞/뒤 달 날짜로 채워서 항상 같은 모양으로 보여준다.
function getMonthGridDates(year: number, month: number): { date: string; inMonth: boolean }[] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return { date: toDateString(d), inMonth: d.getMonth() === month };
  });
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface FormState {
  mode: 'create' | 'edit';
  event: ScheduleEvent | null;
  targetDate: string;
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [tags, setTagsState] = useState<Tag[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toDateString(new Date()));
  const [formState, setFormState] = useState<FormState | null>(null);
  const [showTags, setShowTags] = useState(true);
  const [showCalendar, setShowCalendar] = useState(true);
  const [showDetail, setShowDetail] = useState(true);

  const gridDates = getMonthGridDates(cursor.year, cursor.month);
  const rangeStart = gridDates[0].date;
  const rangeEnd = gridDates[gridDates.length - 1].date;

  async function refresh() {
    try {
      const result = await getEventsBetween(rangeStart, rangeEnd);
      setEvents(result);
    } catch {
      setEvents([]);
    }
  }

  useEffect(() => {
    getEventsBetween(rangeStart, rangeEnd)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    getTags()
      .then(setTagsState)
      .catch(() => setTagsState([]));
  }, []);

  function isTagActive(color?: TagColor): boolean {
    if (!color) return true;
    const tag = tags.find(t => t.color === color);
    return tag ? tag.active : true;
  }

  function handleTagLabelChange(color: TagColor, label: string) {
    setTagsState(prev => prev.map(t => (t.color === color ? { ...t, label } : t)));
  }

  async function handleTagLabelBlur() {
    await saveTags(tags);
  }

  async function handleTagActiveToggle(color: TagColor) {
    const next = tags.map(t => (t.color === color ? { ...t, active: !t.active } : t));
    setTagsState(next);
    await saveTags(next);
  }

  function goToMonth(delta: number) {
    setCursor(c => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  async function handleSaveEvent(patch: Omit<ScheduleEvent, 'id'>) {
    if (formState?.mode === 'edit' && formState.event) {
      await updateEvent(formState.event.id, patch);
    } else {
      await createEvent(patch);
    }
    setFormState(null);
    await refresh();
  }

  async function handleDeleteEvent(id: string) {
    await deleteEvent(id);
    await refresh();
  }

  const selectedDayEvents = events.filter(e => e.date === selectedDate);
  const today = toDateString(new Date());

  return (
    <div className={styles.page}>
      <main className={styles.main} style={{ maxWidth: '1100px' }}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>달력</h1>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              className={`${styles.button} ${showTags ? styles.typeButtonActive : ''}`}
              onClick={() => setShowTags(v => !v)}
              title="태그 사이드바 표시/숨김"
            >
              <PanelLeft size={16} />
            </button>
            <button
              className={`${styles.button} ${showCalendar ? styles.typeButtonActive : ''}`}
              onClick={() => setShowCalendar(v => !v)}
              title="달력 표시/숨김"
            >
              <CalendarDays size={16} />
            </button>
            <button
              className={`${styles.button} ${showDetail ? styles.typeButtonActive : ''}`}
              onClick={() => setShowDetail(v => !v)}
              title="세부 일정 패널 표시/숨김"
            >
              <PanelRight size={16} />
            </button>
            <Link href="/" className={styles.button}>← 목록으로</Link>
          </div>
        </div>

        <div className={calStyles.layout}>
          {showTags && (
          <aside className={calStyles.sidebar}>
            <h2 className={styles.weekTitle}>태그</h2>
            {tags.map(tag => (
              <div key={tag.color} className={calStyles.tagRow}>
                <button
                  type="button"
                  className={`${calStyles.tagDot} ${tag.active ? '' : calStyles.tagDotInactive}`}
                  style={{ background: TAG_COLOR_HEX[tag.color] }}
                  onClick={() => handleTagActiveToggle(tag.color)}
                  title={tag.active ? '클릭하면 숨김' : '클릭하면 표시'}
                />
                <input
                  className={styles.input}
                  value={tag.label}
                  placeholder={tag.color}
                  onChange={e => handleTagLabelChange(tag.color, e.target.value)}
                  onBlur={handleTagLabelBlur}
                  style={{ flex: 1 }}
                />
              </div>
            ))}
          </aside>
          )}

          {showCalendar && (
          <div className={calStyles.gridArea}>
            <div className={calStyles.monthNav}>
              <button className={styles.button} onClick={() => goToMonth(-1)}>‹</button>
              <span className={styles.title} style={{ fontSize: '1.1rem' }}>
                {cursor.year}년 {cursor.month + 1}월
              </span>
              <button className={styles.button} onClick={() => goToMonth(1)}>›</button>
            </div>

            <div className={calStyles.weekdayRow}>
              {WEEKDAY_LABELS.map(w => (
                <span key={w} className={calStyles.weekdayLabel}>{w}</span>
              ))}
            </div>

            <div className={calStyles.grid}>
              {gridDates.map(({ date: d, inMonth }) => {
                const dayEvents = events.filter(e => e.date === d && isTagActive(e.tagColor));
                const uniqueColors = Array.from(
                  new Set(dayEvents.map(e => e.tagColor).filter((c): c is TagColor => Boolean(c)))
                );
                const dayNum = parseInt(d.slice(8, 10), 10);
                return (
                  <div
                    key={d}
                    className={`${calStyles.cell} ${inMonth ? '' : calStyles.cellOutside} ${d === today ? calStyles.cellToday : ''} ${d === selectedDate ? calStyles.cellSelected : ''}`}
                    onClick={() => setSelectedDate(d)}
                  >
                    <div className={calStyles.cellHeader}>
                      <span>{dayNum}</span>
                      <span className={calStyles.dotRow}>
                        {uniqueColors.map(c => (
                          <span key={c} className={calStyles.tagDotSmall} style={{ background: TAG_COLOR_HEX[c] }} />
                        ))}
                      </span>
                    </div>
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.id} className={calStyles.cellEvent}>{e.title}</div>
                    ))}
                    {dayEvents.length > 3 && <div className={styles.hint}>+{dayEvents.length - 3}개 더</div>}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {showDetail && (
          <aside className={calStyles.detailPanel}>
            <h2 className={styles.weekTitle}>{selectedDate}</h2>
            <div className={calStyles.detailList}>
              {selectedDayEvents.length === 0 && <p className={styles.hint}>등록된 일정이 없습니다.</p>}
              {selectedDayEvents.map(event => {
                const tag = tags.find(t => t.color === event.tagColor);
                return (
                  <div
                    key={event.id}
                    className={styles.eventRow}
                    style={{ flexWrap: 'wrap' }}
                    onClick={() => setFormState({ mode: 'edit', event, targetDate: selectedDate })}
                  >
                    {tag && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: '0.6rem',
                          height: '0.6rem',
                          borderRadius: '999px',
                          background: TAG_COLOR_HEX[tag.color],
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span className={styles.eventTime}>{event.time || '종일'}</span>
                    <span className={styles.eventBadge}>{EVENT_TYPE_LABELS[event.type]}</span>
                    <span className={styles.eventTitle}>{event.title}</span>
                    <button
                      className={styles.deleteButton}
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id);
                      }}
                    >
                      삭제
                    </button>
                    {event.notes && <p className={styles.hint} style={{ width: '100%', margin: 0 }}>{event.notes}</p>}
                  </div>
                );
              })}
            </div>
            <button
              className={styles.buttonPrimary}
              onClick={() => setFormState({ mode: 'create', event: null, targetDate: selectedDate })}
            >
              + 새 일정
            </button>
          </aside>
          )}
        </div>
      </main>

      {formState && (
        <EventFormModal
          defaultDate={formState.targetDate}
          initial={formState.event}
          tags={tags}
          onSave={handleSaveEvent}
          onClose={() => setFormState(null)}
        />
      )}
    </div>
  );
}
