import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WatchService {
  constructor(private readonly prisma: PrismaService) {}

  listSets() {
    return this.prisma.watch_set.findMany({
      orderBy: { id: 'asc' },
      include: { groups: { include: { items: { orderBy: { sort_order: 'asc' } } } } },
    });
  }

  getSet(id: number) {
    return this.prisma.watch_set.findUnique({
      where: { id },
      include: { groups: { include: { items: { orderBy: { sort_order: 'asc' } } } } },
    });
  }

  createSet(name: string) {
    return this.prisma.watch_set.create({ data: { name } });
  }

  updateSet(id: number, name: string) {
    return this.prisma.watch_set.update({ where: { id }, data: { name } });
  }

  deleteSet(id: number) {
    return this.prisma.watch_set.delete({ where: { id } });
  }

  listGroups(setId: number) {
    return this.prisma.watch_group.findMany({
      where: { set_id: setId },
      orderBy: { id: 'asc' },
      include: { items: { orderBy: { sort_order: 'asc' } } },
    });
  }

  getGroup(setId: number, groupId: number) {
    return this.prisma.watch_group.findFirst({
      where: { id: groupId, set_id: setId },
      include: { items: { orderBy: { sort_order: 'asc' } } },
    });
  }

  createGroup(setId: number, name: string, rotationIntervalSec?: number) {
    return this.prisma.watch_group.create({
      data: {
        set_id: setId,
        name,
        rotation_interval_sec: rotationIntervalSec ?? 5,
      },
    });
  }

  updateGroup(setId: number, groupId: number, payload: { name?: string; rotationIntervalSec?: number }) {
    return this.prisma.watch_group.updateMany({
      where: { id: groupId, set_id: setId },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.rotationIntervalSec !== undefined ? { rotation_interval_sec: payload.rotationIntervalSec } : {}),
      },
    });
  }

  deleteGroup(setId: number, groupId: number) {
    return this.prisma.watch_group.deleteMany({ where: { id: groupId, set_id: setId } });
  }

  listItems(groupId: number) {
    return this.prisma.watch_item.findMany({ where: { group_id: groupId }, orderBy: { sort_order: 'asc' } });
  }

  async createItem(groupId: number, code: string, sortOrder?: number, pinned?: boolean) {
    const resolvedSortOrder =
      sortOrder ??
      ((await this.prisma.watch_item.aggregate({ where: { group_id: groupId }, _max: { sort_order: true } }))._max
        .sort_order ?? -1) + 1;

    try {
      return await this.prisma.watch_item.create({
        data: { group_id: groupId, code, sort_order: resolvedSortOrder, pinned: pinned ?? false },
      });
    } catch (error) {
      this.handleDuplicateError(error);
    }
  }

  async updateItem(groupId: number, itemId: number, payload: { code?: string; sortOrder?: number; pinned?: boolean }) {
    try {
      return await this.prisma.watch_item.updateMany({
        where: { id: itemId, group_id: groupId },
        data: {
          ...(payload.code !== undefined ? { code: payload.code } : {}),
          ...(payload.sortOrder !== undefined ? { sort_order: payload.sortOrder } : {}),
          ...(payload.pinned !== undefined ? { pinned: payload.pinned } : {}),
        },
      });
    } catch (error) {
      this.handleDuplicateError(error);
    }
  }

  deleteItem(groupId: number, itemId: number) {
    return this.prisma.watch_item.deleteMany({ where: { id: itemId, group_id: groupId } });
  }

  async bulkCreateItems(groupId: number, codes: string[]) {
    const existing = await this.prisma.watch_item.findMany({
      where: { group_id: groupId, code: { in: codes } },
      select: { code: true },
    });

    const existingCodes = new Set(existing.map((item: { code: string }) => item.code));
    const filtered = [...new Set(codes)].filter((code) => !existingCodes.has(code));

    const maxOrder =
      (await this.prisma.watch_item.aggregate({ where: { group_id: groupId }, _max: { sort_order: true } }))._max
        .sort_order ?? -1;

    if (filtered.length === 0) {
      return { created: 0, skipped: codes.length };
    }

    await this.prisma.watch_item.createMany({
      data: filtered.map((code, idx) => ({
        group_id: groupId,
        code,
        sort_order: maxOrder + idx + 1,
      })),
    });

    return { created: filtered.length, skipped: codes.length - filtered.length };
  }

  async reorderItems(groupId: number, orderedCodes: string[]) {
    const uniqueCodes = [...new Set(orderedCodes)];
    const existing = await this.prisma.watch_item.findMany({ where: { group_id: groupId } });
    const codeSet = new Set(existing.map((item: { code: string }) => item.code));

    for (const code of uniqueCodes) {
      if (!codeSet.has(code)) {
        throw new NotFoundException(`Code not found in group: ${code}`);
      }
    }

    await this.prisma.$transaction(
      uniqueCodes.map((code, idx) =>
        this.prisma.watch_item.updateMany({
          where: { group_id: groupId, code },
          data: { sort_order: idx },
        }),
      ),
    );

    return this.listItems(groupId);
  }

  private handleDuplicateError(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
      throw new BadRequestException('Duplicate code in same group is not allowed');
    }

    throw error;
  }
}
