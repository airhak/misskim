// 아침 브리핑에 쓰는 목소리 설정. 실제 음성 생성은 매일 아침 예약 작업(Claude Code 스케줄)이
// Higgsfield MCP 도구(generate_audio)를 호출해서 만들고, 결과 URL을 각 이벤트 문서에 저장한다.
// 이 앱(Next.js) 코드 자체는 음성을 생성하지 않고, 이미 만들어진 audioUrl을 재생만 한다.
export const BRIEFING_VOICE = {
  model: 'text2speech_v2',
  variant: 'elevenlabs',
  voiceType: 'preset',
  voiceId: 'c25f78a0-714e-42af-8da3-a399cef94968',
  name: 'Hana',
} as const;

export const OUTRO_AUDIO_URL = '/audio/outro.mp3';
