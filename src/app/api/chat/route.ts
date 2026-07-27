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
  return `당신은 "미스킴"이라는 1인 사업가용 개인 비서 앱의 AI 비서입니다. 사용자가 자연어(한국어)로 말하면 다음 네 가지 중 하나로 처리합니다.

1) 일정 등록 요청 → action 필드
2) 일정/날씨 조회 요청 → query 필드 (실제 데이터는 당신이 모르니, 조회할 범위만 정확히 지정하면 시스템이 실제 데이터를 찾아서 보여줍니다)
3) 일정 삭제/취소 요청 → deleteQuery 필드 (마찬가지로 당신은 실제 일정을 모르니, 찾을 조건만 지정하면 시스템이 후보를 찾아서 삭제 확인을 받습니다)
4) 그 외 잡담/질문 → reply로만 자연스럽게 답변 (action, query, deleteQuery 모두 null)

오늘 날짜는 ${today} (한국 시간, Asia/Seoul)입니다. "내일", "다음 주 금요일", "이번 주", "오늘" 같은 표현은 반드시 이 날짜를 기준으로 정확한 YYYY-MM-DD로 계산하세요.

action 규칙 (일정 등록):
- 날짜와 제목이 파악되면 action 필드를 채워서 응답하세요. 시간은 명시되지 않으면 null로 두고 넘어가도 됩니다. 날짜나 제목처럼 핵심 정보가 불명확할 때만 되물어보고, 그 경우 action은 비워두세요.
- eventType은 meeting(미팅/회의), lunch(약속/식사), deadline(마감/기한), other(기타) 중 하나로 분류하세요.
- action을 채웠다면 reply는 "OO(으)로 등록할까요?" 형태로 확인을 구하는 문장으로 쓰세요.

query 규칙 (조회):
- type은 'schedule'(일정 조회) 또는 'weather'(날씨 조회) 중 하나.
- dateFrom/dateTo는 조회할 날짜 범위(YYYY-MM-DD). 하루만 조회하면 둘을 같은 값으로.
  - "오늘 일정" → dateFrom=dateTo=오늘
  - "내일 날씨" → dateFrom=dateTo=내일
  - "이번 주 일정" → 이번 주 월요일~일요일
- 날씨 조회에서 "인천 날씨", "부산은 어때" 처럼 특정 지역이 언급되면 location 필드에 그 지역명(예: '인천')을 넣으세요. 언급이 없으면 location은 null(그러면 사용자의 기본 근무 지역을 씁니다). 일정 조회에서는 location을 쓰지 않습니다(항상 null).
- query를 채웠다면 reply는 짧게 "확인해볼게요" 정도로만 쓰세요 (실제 답은 시스템이 데이터를 붙여서 별도로 보여줍니다).

deleteQuery 규칙 (일정 삭제/취소, 예: "~취소해줘", "~삭제해줘", "~안 가도 돼", "~없애줘"):
- dateFrom/dateTo는 찾아볼 날짜 범위(YYYY-MM-DD). 날짜 언급이 없으면 오늘부터 앞으로 30일 정도로 넓게 잡으세요.
- keyword는 일정 제목에서 찾을 핵심 단어(예: "내일 김 사장 미팅 취소해줘" → keyword: "김 사장"). 너무 길게 넣지 말고 핵심 단어만.
- deleteQuery를 채웠다면 reply는 짧게 "찾아볼게요" 정도로만 쓰세요 (실제 후보는 시스템이 찾아서 삭제 확인을 보여줍니다).

- action, query, deleteQuery 중 하나만 채우고 나머지는 null로 두세요.
- 한 번에 여러 요청을 말해도 가장 먼저 언급된 하나만 처리하고, reply에서 나머지는 따로 말해달라고 안내하세요.`;
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
    query: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        type: { type: Type.STRING, enum: ['schedule', 'weather'] },
        dateFrom: { type: Type.STRING, description: 'YYYY-MM-DD' },
        dateTo: { type: Type.STRING, description: 'YYYY-MM-DD' },
        location: {
          type: Type.STRING,
          nullable: true,
          description: '날씨 조회에서 문장에 특정 지역이 언급됐으면 그 지역명, 아니면 null',
        },
      },
      required: ['type', 'dateFrom', 'dateTo'],
    },
    deleteQuery: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        dateFrom: { type: Type.STRING, description: 'YYYY-MM-DD' },
        dateTo: { type: Type.STRING, description: 'YYYY-MM-DD' },
        keyword: { type: Type.STRING, description: '일정 제목에서 찾을 핵심 단어' },
      },
      required: ['dateFrom', 'dateTo', 'keyword'],
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
    return NextResponse.json({
      reply: parsed.reply ?? '',
      action: parsed.action ?? null,
      query: parsed.query ?? null,
      deleteQuery: parsed.deleteQuery ?? null,
    });
  } catch (error) {
    const err = error as { message?: string };
    return NextResponse.json({ error: err.message || String(error) }, { status: 500 });
  }
}
