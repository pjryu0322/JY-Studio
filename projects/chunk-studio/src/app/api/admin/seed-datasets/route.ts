import { NextResponse } from "next/server";
import { appendAuditLog } from "@/lib/admin/auditLog";
import {
  addSeedDataset,
  getSeedDatasets,
  removeSeedDataset,
} from "@/lib/admin/adminConfigStore";

interface CreateBody {
  name?: string;
  description?: string;
  family?: "guide_manual" | "public_rfp" | "policy_manual" | "unknown_generic";
}

export async function GET() {
  try {
    const seeds = await getSeedDatasets();
    return NextResponse.json({ seeds });
  } catch (error) {
    console.error("[GET /api/admin/seed-datasets]", error);
    return NextResponse.json({ error: "Failed to load seed datasets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBody;
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const seed = await addSeedDataset({
      name,
      description: body.description?.trim() || undefined,
      family: body.family ?? "unknown_generic",
    });
    await appendAuditLog({
      category: "system",
      action: "create_seed_dataset",
      level: "info",
      detail: { id: seed.id, name: seed.name, family: seed.family },
    });
    return NextResponse.json({ seed });
  } catch (error) {
    console.error("[POST /api/admin/seed-datasets]", error);
    return NextResponse.json({ error: "Failed to create seed dataset" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await removeSeedDataset(id);
    await appendAuditLog({
      category: "system",
      action: "remove_seed_dataset",
      level: "warn",
      detail: { id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/seed-datasets]", error);
    return NextResponse.json({ error: "Failed to delete seed dataset" }, { status: 500 });
  }
}
