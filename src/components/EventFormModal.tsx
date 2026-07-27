'use client';

import { useState } from 'react';
import styles from '@/app/page.module.css';
import type { EventType, ScheduleEvent } from '@/lib/types';
import { EVENT_TYPE_LABELS } from '@/lib/types';

interface EventFormModalProps {
  date: string;
  initial: ScheduleEvent | null;
  onSave: (event: Omit<ScheduleEvent, 'id'>) => Promise<void>;
  onClose: () => void;
}

const EVENT_TYPES: EventType[] = ['meeting', 'lunch', 'deadline', 'other'];

export default function EventFormModal({ date, initial, onSave, onClose }: EventFormModalProps) {
  const [time, setTime] = useState(initial?.time ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [type, setType] = useState<EventType>(initial?.type ?? 'meeting');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        date,
        time: time || undefined,
        title: title.trim(),
        location: location.trim() || undefined,
        type,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>{initial ? '일정 수정' : '새 일정 추가'}</div>
        <div className={styles.modalBody}>
          <label className={styles.formLabel}>
            시간 (없으면 종일/마감 일정)
            <input
              className={styles.input}
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </label>
          <label className={styles.formLabel}>
            제목
            <input
              className={styles.input}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: K 그룹 미팅"
              autoFocus
            />
          </label>
          <label className={styles.formLabel}>
            장소
            <input
              className={styles.input}
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="예: 김포 현대 아울렛"
            />
          </label>
          <label className={styles.formLabel}>
            종류
            <div className={styles.typeRow}>
              {EVENT_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.typeButton} ${type === t ? styles.typeButtonActive : ''}`}
                  onClick={() => setType(t)}
                >
                  {EVENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </label>
          <label className={styles.formLabel}>
            메모
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </label>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.button} onClick={onClose} disabled={saving}>취소</button>
          <button className={styles.buttonPrimary} onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
