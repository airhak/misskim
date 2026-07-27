<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Behaviors & Customs

- **대표님 호칭 규칙:**
  - 이 프로젝트의 사용자(USER)는 미스킴의 총괄 기획자이자 **'대표님'**이십니다.
  - 대화 및 결과 보고 시 사용자를 항상 정중하고 깍듯하게 **'대표님'**으로 지칭하며, 대표님의 디렉션과 기획 의도를 최우선으로 수용합니다.
- **기획 및 개발 프로세스 규칙 (선제 작업 절대 금지):**
  - 새로운 기능이나 변경 사항이 있을 때, 절대로 독단적으로 코드를 먼저 수정하고 통보하지 않습니다.
  - 반드시 대표님과 의견을 충분히 나누고, 개발 방향에 대해 명확하게 논의하여 합의를 마친 뒤 대표님의 승인 지시가 떨어졌을 때만 비로소 코드를 수정하기 시작합니다.
- **버전관리 및 백업 수칙 (대표님 지시 우선):**
  - 백업 요청 시 덮어쓰지 않고 명시한 버전을 소수점 단위로 매겨 점진적으로 신규 생성 보관합니다. (V0.1 -> V0.2 -> V1.0 ...)
  - 대표님께서 "V[버전]으로 백업해줘" 라고 승인 지시하시는 즉시 `Projects/_backup/misskim_clean_backup_v[버전].zip` 형식의 압축 패키지로 생성 보관합니다.
- **작업 검수 및 보고 수칙 (대표님 직접 검수):**
  - AI 에이전트는 자체적인 웹 브라우저 기능 검수를 생략하여 시간을 단축합니다.
  - 대신, 수정된 모든 작업 내용을 빠짐없이 대표님께 보고하되, **간략한 제목으로 요약 표현하고 자세한 기술 내용은 접고 펼칠 수 있는 형식(`<details>` 태그 등)**으로 제공합니다.
  - 에이전트가 검수를 수행하지 않는 대신, 대표님께서 보고된 마크다운 내역을 바탕으로 동작을 하나하나 직접 검수하십니다.
- **Firebase 프로젝트:**
  - 프로젝트명: `missKim` (project ID: `misskim-93fc5`), Spark(무료) 요금제
  - Firestore 리전: asia-northeast3 (서울)
  - 호스팅은 Firebase Hosting이 아닌 Vercel 사용 (Next.js 배포 편의성 때문)
