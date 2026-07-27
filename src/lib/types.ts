export type EventType = 'meeting' | 'lunch' | 'deadline' | 'other';

export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm, 없으면 종일/마감성 일정
  title: string;
  location?: string;
  type: EventType;
  notes?: string;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: '미팅',
  lunch: '약속',
  deadline: '마감',
  other: '기타',
};

export interface LocationSetting {
  name: string;
  lat: number;
  lon: number;
}
