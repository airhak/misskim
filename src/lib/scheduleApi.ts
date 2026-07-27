import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ScheduleEvent } from './types';

const EVENTS_COLLECTION = 'events';

// Firestore는 필드 값으로 undefined를 허용하지 않아서, 저장 전에 undefined 필드를 통째로 제거한다.
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

// time이 없는 일정(마감 등)도 있어서 Firestore orderBy 대신 클라이언트에서 정렬한다.
// orderBy('time')을 쓰면 그 필드가 없는 문서는 쿼리 결과에서 통째로 빠지기 때문.
function sortByTime(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
}

export async function getEventsByDate(date: string): Promise<ScheduleEvent[]> {
  const q = query(collection(db, EVENTS_COLLECTION), where('date', '==', date));
  const snapshot = await getDocs(q);
  const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ScheduleEvent);
  return sortByTime(events);
}

export async function getEventsBetween(startDate: string, endDate: string): Promise<ScheduleEvent[]> {
  const q = query(
    collection(db, EVENTS_COLLECTION),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date')
  );
  const snapshot = await getDocs(q);
  const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ScheduleEvent);
  const byDate = new Map<string, ScheduleEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }
  return Array.from(byDate.values()).flatMap(sortByTime);
}

export async function createEvent(event: Omit<ScheduleEvent, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, EVENTS_COLLECTION), stripUndefined(event));
  return docRef.id;
}

export async function updateEvent(id: string, patch: Partial<Omit<ScheduleEvent, 'id'>>): Promise<void> {
  await updateDoc(doc(db, EVENTS_COLLECTION, id), stripUndefined(patch));
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, EVENTS_COLLECTION, id));
}

function formatTimeKorean(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h < 12 ? '오전' : '오후';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minutePart = m > 0 ? ` ${m}분` : '';
  return `${period} ${hour12}시${minutePart}`;
}

// 브리핑 재생 시 브라우저 음성 합성(Web Speech API)에 그대로 넘기는 문장.
export function buildSpokenText(event: ScheduleEvent): string {
  const timePart = event.time ? formatTimeKorean(event.time) : null;

  if (event.type === 'deadline') {
    const when = timePart ? `${timePart} 마감,` : '오늘 마감,';
    return `${when} ${event.title} 준비하셔야 합니다.`;
  }

  const locationPart = event.location ? `${event.location}에서 ` : '';
  const when = timePart ? `${timePart}, ` : '';
  return `${when}${locationPart}${event.title}이 있습니다.`;
}
