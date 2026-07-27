import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

function todayInSeoul(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function buildSystemInstruction(today: string): string {
  return `당신은 "미스킴"이라는 1인 사업가용 개인 비서 앱의 AI 비서입니다. 사용자가 자연어(한국어)로 일정을 말하면, 등록에 필요한 정보(날짜, 시간, 제목, 장소, 종류)를 파악해서 도와줍니다.

오늘 날짜는 ${today} (한국 시간, Asia/Seoul)입니다. "내일", "다음 주 금요일", "이번 주 토요일" 같은 상대적 표현은 반드시 이 날짜를 기준으로 정확한 YYYY-MM-DD로 계산하세요.

규칙:
- 날짜와 제목이 파악되면 action 필드를 채워서 응답하세요. 시간은 명시되지 않으면 null로 두고 넘어가도 됩니다(꼭 안 물어봐도 됨). 날짜나 제목처럼 핵심 정보가 불명확할 때만 되물어보고, 그 경우 action은 비워두세요.
- eventType은 meeting(미팅/회의), lunch(약속/식사), deadline(마감/기한), other(기타) 중 하나로 분류하세요.
- reply는 사용자에게 보여줄 짧고 자연스러운 한국어 답변입니다. action을 채웠다면 "OO(으)로 등록할까요?" 형태로 확인을 구하는 문장으로 쓰세요.
- 일정과 무관한 잡담이나 질문에는 reply로 자연스럽게 답하고 action은 null로 두세요.
- 한 번에 여러 일정을 말해도 가장 먼저 언급된 하나만 처리하고, reply에서 나머지는 따로 말해달라고 안내하세요.`;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING, description: '사용자에게 보여줄 자연어 답변' },
    action: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        date: { type: Type.STRING, description: 'YYYY-MM-DD' },
        time: { type: Type.STRING, nullable: true, description: 'HH:mm, 시간 미정이면 null' },
        title: { type: Type.STRING },
        location: { type: Type.STRING, nullable: true },
        eventType: { type: Type.STRING, enum: ['meeting', 'lunch', 'deadline', 'other'] },
      },
      required: ['date', 'title', 'eventType'],
    },
  },
  required: ['reply'],
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 .env.local에 없습니다.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const messages: ChatMessage[] = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages가 필요합니다.' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const contents = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents,
      config: {
        systemInstruction: buildSystemInstruction(todayInSeoul()),
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const parsed = JSON.parse(response.text ?? '{}');
    return NextResponse.json({ reply: parsed.reply ?? '', action: parsed.action ?? null });
  } catch (error) {
    const err = error as { message?: string };
    return NextResponse.json({ error: err.message || String(error) }, { status: 500 });
  }
}
