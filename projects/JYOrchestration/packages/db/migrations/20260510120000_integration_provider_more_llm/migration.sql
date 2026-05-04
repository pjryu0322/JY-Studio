-- 추가 LLM 제공자(사용자 연동 등록용). 기존 행에 영향 없음.
ALTER TYPE "IntegrationProvider" ADD VALUE 'ANTHROPIC';
ALTER TYPE "IntegrationProvider" ADD VALUE 'GOOGLE_AI';
