# Chart Vision AI

AI 기반 트레이딩 차트 분석 사이트. 차트 이미지를 업로드하면 추세·지지선·저항선·패턴·롱/숏 시나리오·리스크를 자동 분석합니다.

## 주요 기능

- 이미지 업로드 (파일 선택 / 드래그 앤 드롭 / Ctrl+V 붙여넣기)
- AI 차트 분석 (추세, 지지선, 저항선, 패턴, 롱/숏 시나리오, 리스크, 신뢰도)
- 종목 · 타임프레임 · 분석 목적 선택
- 분석 히스토리 (최대 10개, localStorage 저장)
- Anthropic API 키 없이도 Mock 모드로 즉시 실행 가능
- 다크 테마 · 모바일 반응형

## 기술 스택

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Anthropic Claude Vision API

## 빠른 시작 (로컬)

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.local.example .env.local
# .env.local 에 ANTHROPIC_API_KEY 입력 (없으면 Mock 모드로 동작)

# 3. 개발 서버 실행
npm run dev
# → http://localhost:3000
```

## 환경변수

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | 권장 | Anthropic API 키. 없으면 Mock 모드 |
| `ANTHROPIC_MODEL` | 선택 | 기본값: `claude-3-5-sonnet-latest` |

> API 키 없이 실행하면 더미 분석 결과(Mock 모드)로 동작하며, 결과 카드에 경고 배너가 표시됩니다.

## Vercel 배포

```bash
# Vercel CLI 사용 시
npm i -g vercel
vercel --prod
```

또는 GitHub 저장소를 Vercel에 연결하면 push 시 자동 배포됩니다.

**Vercel 환경변수 설정:** Project Settings → Environment Variables
- `ANTHROPIC_API_KEY` = 실제 API 키

## 파일 구조

```
app/
  api/
    analyze-chart/route.ts      # 차트 분석 API
    detect-chart-meta/route.ts  # 메타 자동 감지 API
  layout.tsx
  page.tsx
components/
  chart-upload.tsx              # 이미지 업로드 영역
  analysis-options.tsx          # 종목·타임프레임·목적 선택
  analysis-result.tsx           # 분석 결과 카드
  analysis-history.tsx          # 히스토리 목록
  risk-disclaimer.tsx           # 면책 문구
hooks/
  use-analysis-history.ts       # 히스토리 상태 관리
lib/
  analyze-chart.ts              # AI Provider (Claude / Mock)
  image-utils.ts                # 이미지 처리 유틸
  types.ts                      # TypeScript 타입 정의
```

## 면책 사항

본 분석은 참고용이며 실제 매매 책임은 사용자 본인에게 있습니다.
