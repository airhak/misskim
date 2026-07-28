import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_TAGS, type Tag } from './types';

const SETTINGS_COLLECTION = 'settings';
const TAGS_DOC_ID = 'tags';

export async function getTags(): Promise<Tag[]> {
  const snap = await getDoc(doc(db, SETTINGS_COLLECTION, TAGS_DOC_ID));
  if (!snap.exists()) return DEFAULT_TAGS;
  const stored = (snap.data().tags as Tag[] | undefined) ?? [];
  // 저장된 값이 색상 몇 개를 빠뜨렸을 수 있으니 기본값과 합쳐서 항상 7개를 보장한다.
  return DEFAULT_TAGS.map(def => stored.find(t => t.color === def.color) ?? def);
}

export async function setTags(tags: Tag[]): Promise<void> {
  await setDoc(doc(db, SETTINGS_COLLECTION, TAGS_DOC_ID), { tags });
}
