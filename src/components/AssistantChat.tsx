'use client';

import { useEffect, useRef, useState } from 'react';
import styles from '@/app/page.module.css';
import { createEvent } from '@/lib/scheduleApi';
import { EVENT_TYPE_LABELS, type EventType } from '@/lib/types';

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

interface AssistantChatProps {
  onClose: () => void;
  onEventCreated: () => void;
}

export default function AssistantChat({ onClose, onEventCreated }: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'model', text: '안녕하세요, 대표님. 일정을 말씀해 주시면 등록해드릴게요.' },
  ]);
  const [pendingAction, setPendingAction] = useState<ChatAction | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: 'user' as const, text }];
    setMessages(nextMessages);
    setInput('');
    setPendingAction(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
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
