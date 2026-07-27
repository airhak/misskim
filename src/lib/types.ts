export type EventType = 'meeting' | 'lunch' | 'deadline' | 'other';

export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm, 없으면 종일/마감성 일정
  title: string;
  location?: string;
  type: EventType;
  notes?: string;
  audioUrl?: string; // 매일 아침 예약 작업이 미리 생성해두는 이 일정의 개별 음성 브리핑
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: '미팅',
  lunch: '약속',
  deadline: '마감',
  other: '기타',
};
