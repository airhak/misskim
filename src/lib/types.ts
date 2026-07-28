export type EventType = 'meeting' | 'lunch' | 'deadline' | 'other';

export type TagColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';

export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm, 없으면 종일/마감성 일정
  title: string;
  location?: string;
  type: EventType;
  notes?: string; // 내용
  tagColor?: TagColor;
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

export interface Tag {
  color: TagColor;
  label: string; // 사용자가 정의하는 이름 (예: "업무", "친구")
  active: boolean; // 꺼두면 달력/필터에서 이 태그가 붙은 항목이 숨겨짐
}

export const TAG_COLOR_HEX: Record<TagColor, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  gray: '#9ca3af',
};

export const TAG_COLORS: TagColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];

export const DEFAULT_TAGS: Tag[] = TAG_COLORS.map(color => ({ color, label: '', active: true }));
