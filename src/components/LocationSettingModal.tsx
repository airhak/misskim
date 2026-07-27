'use client';

import { useState } from 'react';
import styles from '@/app/page.module.css';
import { KOREAN_CITY_PRESETS, searchLocation, type LocationCandidate } from '@/lib/weatherApi';
import type { LocationSetting } from '@/lib/types';

interface LocationSettingModalProps {
  current: LocationSetting | null;
  onSave: (location: LocationSetting) => void;
  onClose: () => void;
}

export default function LocationSettingModal({ current, onSave, onClose }: LocationSettingModalProps) {
  const [query, setQuery] = useState(current?.name ?? '');
  const [candidates, setCandidates] = useState<LocationCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const results = await searchLocation(query.trim());
      setCandidates(results);
      if (results.length === 0) setError('일치하는 지역이 없습니다.');
    } catch {
      setError('지역 검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(candidate: LocationCandidate) {
    const label = [candidate.name, candidate.admin1, candidate.country].filter(Boolean).join(', ');
    onSave({ name: label, lat: candidate.lat, lon: candidate.lon });
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} style={{ width: '380px' }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>근무 지역 설정</div>
        <div className={styles.modalBody}>
          {current && (
            <p style={{ fontSize: '0.78rem', color: '#64748b' }}>현재: {current.name}</p>
          )}

          <div className={styles.typeRow}>
            {KOREAN_CITY_PRESETS.map(city => (
              <button
                key={city.name}
                type="button"
                className={styles.typeButton}
                onClick={() => handleSelect(city)}
              >
                {city.name}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.5rem' }}>
            목록에 없는 지역은 영문으로 검색하세요 (예: Jeju, Suncheon).
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className={styles.input}
              placeholder="예: Jeju"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1 }}
            />
            <button className={styles.button} onClick={handleSearch} disabled={loading || !query.trim()}>
              검색
            </button>
          </div>
          {loading && <p className={styles.hint}>검색 중...</p>}
          {error && <p className={styles.errorText}>{error}</p>}
          {candidates.map((c, i) => (
            <div
              key={i}
              className={styles.eventRow}
              style={{ cursor: 'pointer' }}
              onClick={() => handleSelect(c)}
            >
              <span className={styles.eventTitle}>
                {[c.name, c.admin1, c.country].filter(Boolean).join(', ')}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.button} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
