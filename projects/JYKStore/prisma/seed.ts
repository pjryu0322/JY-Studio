import {
  PackPricing,
  PackStatus,
  PrismaClient,
  ProviderType,
} from "@prisma/client";
import { mockCategories } from "../src/data/mock-categories";
import { mockPacks } from "../src/data/mock-packs";
import type { KnowledgePack, KnowledgePackStatus } from "../src/types/pack";

const prisma = new PrismaClient();

function mapPackStatus(status: KnowledgePackStatus): PackStatus {
  return status as PackStatus;
}

function mapProviderType(type: KnowledgePack["providerInfo"]["type"]): ProviderType {
  return type as ProviderType;
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

async function seedCategories() {
  for (const category of mockCategories) {
    await prisma.packCategory.upsert({
      where: { categoryId: category.categoryId },
      create: {
        categoryId: category.categoryId,
        name: category.name,
        description: category.description,
        icon: category.icon,
      },
      update: {
        name: category.name,
        description: category.description,
        icon: category.icon,
      },
    });
  }
}

async function seedPack(pack: KnowledgePack) {
  const status = mapPackStatus(pack.status);
  const publishedAt = status === PackStatus.PUBLISHED ? parseDate(pack.updatedAt) : null;

  await prisma.knowledgePack.upsert({
    where: { packId: pack.packId },
    create: {
      packId: pack.packId,
      name: pack.name,
      categoryId: pack.categoryId,
      providerName: pack.provider,
      providerType: mapProviderType(pack.providerInfo.type),
      status,
      pricing: pack.pricing as PackPricing,
      icon: pack.icon,
      shortDescription: pack.shortDescription,
      description: pack.description,
      tags: [...pack.tags],
      rating: pack.rating,
      usageCount: pack.usageCount,
      isVerified: pack.isVerified,
      publishedAt,
      updatedAt: parseDate(pack.updatedAt),
    },
    update: {
      name: pack.name,
      categoryId: pack.categoryId,
      providerName: pack.provider,
      providerType: mapProviderType(pack.providerInfo.type),
      status,
      pricing: pack.pricing as PackPricing,
      icon: pack.icon,
      shortDescription: pack.shortDescription,
      description: pack.description,
      tags: [...pack.tags],
      rating: pack.rating,
      usageCount: pack.usageCount,
      isVerified: pack.isVerified,
      publishedAt,
      updatedAt: parseDate(pack.updatedAt),
    },
  });

  const latest = pack.versionHistory[pack.versionHistory.length - 1];
  const versionLabel = pack.packId === "easy-auth" ? "1.0.0" : latest.version;

  const versionData =
    pack.packId === "easy-auth"
      ? {
          overview: "간편인증 연동 제품 지식",
          features: ["인증 요청", "Callback 처리", "결과 확인", "오류코드 대응"],
          includedKnowledge: [
            "인증 요청 API",
            "Callback URL",
            "결과 확인 API",
            "오류코드",
            "샘플 코드",
          ],
          supportedEnvironments: ["Java", "Spring Boot", "REST API"],
          targetUsers: ["서비스 기획자", "백엔드 개발자", "AI 도구 사용자"],
          useCases: ["회의록 열람 확인", "공공서비스 본인확인", "금융서비스 인증 결과 확인"],
          versionSummary: "간편인증 요청, Callback, 결과 확인, 오류코드 기본 지식팩 구성",
        }
      : {
          overview: pack.overview,
          features: [...pack.features],
          includedKnowledge: [...pack.includedKnowledge],
          supportedEnvironments: [...pack.supportedEnvironments],
          targetUsers: [...pack.targetUsers],
          useCases: [...pack.useCases],
          versionSummary: latest.summary,
        };

  const version = await prisma.knowledgePackVersion.upsert({
    where: {
      packId_version: { packId: pack.packId, version: versionLabel },
    },
    create: {
      packId: pack.packId,
      version: versionLabel,
      ...versionData,
    },
    update: versionData,
  });

  if (pack.packId === "easy-auth") {
    const sourceDoc = await prisma.sourceDocument.upsert({
      where: { id: "seed-easy-auth-guide" },
      create: {
        id: "seed-easy-auth-guide",
        versionId: version.id,
        title: "간편인증 연동 기본 가이드",
        sourceType: "INTEGRATION_GUIDE",
        sourceFormat: "MARKDOWN",
        legacySourceType: "markdown",
        validationStatus: "PASS",
        validationSummary: "필수값을 충족했습니다.",
        content:
          "간편인증 요청, Callback 처리, 인증 결과 확인, 오류코드 대응에 대한 기본 가이드",
      },
      update: {
        versionId: version.id,
        title: "간편인증 연동 기본 가이드",
        sourceType: "INTEGRATION_GUIDE",
        sourceFormat: "MARKDOWN",
        legacySourceType: "markdown",
        validationStatus: "PASS",
        validationSummary: "필수값을 충족했습니다.",
        content:
          "간편인증 요청, Callback 처리, 인증 결과 확인, 오류코드 대응에 대한 기본 가이드",
      },
    });

    const chunks = [
      {
        id: "seed-easy-auth-chunk-1",
        title: "인증 요청 흐름",
        content: "간편인증 요청 API 호출부터 사용자 인증 화면 연결까지의 기본 흐름을 정리합니다.",
        sortOrder: 1,
      },
      {
        id: "seed-easy-auth-chunk-2",
        title: "Callback 처리",
        content: "인증 완료 후 Callback URL로 전달되는 결과 파라미터와 서버 처리 방법을 설명합니다.",
        sortOrder: 2,
      },
      {
        id: "seed-easy-auth-chunk-3",
        title: "인증 결과 확인",
        content: "인증 결과 확인 API를 통해 최종 인증 상태를 검증하는 방법을 안내합니다.",
        sortOrder: 3,
      },
      {
        id: "seed-easy-auth-chunk-4",
        title: "오류코드 대응",
        content: "주요 오류코드별 원인과 대응 절차를 정리합니다.",
        sortOrder: 4,
      },
    ];

    for (const chunk of chunks) {
      await prisma.knowledgeChunk.upsert({
        where: { id: chunk.id },
        create: {
          id: chunk.id,
          versionId: version.id,
          sourceDocumentId: sourceDoc.id,
          chunkType: "guide",
          title: chunk.title,
          content: chunk.content,
          tags: ["간편인증"],
          sortOrder: chunk.sortOrder,
        },
        update: {
          versionId: version.id,
          sourceDocumentId: sourceDoc.id,
          chunkType: "guide",
          title: chunk.title,
          content: chunk.content,
          tags: ["간편인증"],
          sortOrder: chunk.sortOrder,
        },
      });
    }
  }
}

async function main() {
  console.log("Seeding JYKStore database…");

  await seedCategories();
  console.log(`  ✓ ${mockCategories.length} categories`);

  for (const pack of mockPacks) {
    await seedPack(pack);
    console.log(`  ✓ pack ${pack.packId}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
