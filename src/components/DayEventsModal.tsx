'use client';

import styles from '@/app/page.module.css';
import { EVENT_TYPE_LABELS, TAG_COLOR_HEX, type ScheduleEvent, type Tag } from '@/lib/types';

interface DayEventsModalProps {
  date: string;
  events: ScheduleEvent[];
  tags: Tag[];
  onEdit: (event: ScheduleEvent) => void;
  onAddNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function DayEventsModal({ date, events, tags, onEdit, onAddNew, onDelete, onClose }: DayEventsModalProps) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} style={{ width: '380px' }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>{date}</div>
        <div className={styles.modalBody}>
          {events.length === 0 && <p className={styles.hint}>등록된 일정이 없습니다.</p>}
          {events.map(event => {
            const tag = tags.find(t => t.color === event.tagColor);
            return (
              <div key={event.id} className={styles.eventRow} onClick={() => onEdit(event)}>
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
                    onDelete(event.id);
                  }}
                >
                  삭제
                </button>
              </div>
            );
          })}
        </div>
        <div className={styles.modalFooter} style={{ justifyContent: 'space-between' }}>
          <button className={styles.buttonPrimary} onClick={onAddNew}>+ 새 일정</button>
          <button className={styles.button} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
