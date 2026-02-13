import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { WatchService } from './watch.service';

@Controller('api/v1/watch')
export class WatchController {
  constructor(private readonly watchService: WatchService) {}

  @Get('sets')
  listSets() {
    return this.watchService.listSets();
  }

  @Get('sets/:setId')
  getSet(@Param('setId', ParseIntPipe) setId: number) {
    return this.watchService.getSet(setId);
  }

  @Post('sets')
  createSet(@Body() body: { name: string }) {
    return this.watchService.createSet(body.name);
  }

  @Patch('sets/:setId')
  updateSet(@Param('setId', ParseIntPipe) setId: number, @Body() body: { name: string }) {
    return this.watchService.updateSet(setId, body.name);
  }

  @Delete('sets/:setId')
  deleteSet(@Param('setId', ParseIntPipe) setId: number) {
    return this.watchService.deleteSet(setId);
  }

  @Get('sets/:setId/groups')
  listGroups(@Param('setId', ParseIntPipe) setId: number) {
    return this.watchService.listGroups(setId);
  }

  @Get('sets/:setId/groups/:groupId')
  getGroup(@Param('setId', ParseIntPipe) setId: number, @Param('groupId', ParseIntPipe) groupId: number) {
    return this.watchService.getGroup(setId, groupId);
  }

  @Post('sets/:setId/groups')
  createGroup(@Param('setId', ParseIntPipe) setId: number, @Body() body: { name: string; rotationIntervalSec?: number }) {
    return this.watchService.createGroup(setId, body.name, body.rotationIntervalSec);
  }

  @Patch('sets/:setId/groups/:groupId')
  updateGroup(
    @Param('setId', ParseIntPipe) setId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: { name?: string; rotationIntervalSec?: number },
  ) {
    return this.watchService.updateGroup(setId, groupId, body);
  }

  @Delete('sets/:setId/groups/:groupId')
  deleteGroup(@Param('setId', ParseIntPipe) setId: number, @Param('groupId', ParseIntPipe) groupId: number) {
    return this.watchService.deleteGroup(setId, groupId);
  }

  @Get('groups/:groupId/items')
  listItems(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.watchService.listItems(groupId);
  }

  @Post('groups/:groupId/items')
  createItem(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: { code: string; sortOrder?: number; pinned?: boolean },
  ) {
    return this.watchService.createItem(groupId, body.code, body.sortOrder, body.pinned);
  }

  @Patch('groups/:groupId/items/:itemId')
  updateItem(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: { code?: string; sortOrder?: number; pinned?: boolean },
  ) {
    return this.watchService.updateItem(groupId, itemId, body);
  }

  @Delete('groups/:groupId/items/:itemId')
  deleteItem(@Param('groupId', ParseIntPipe) groupId: number, @Param('itemId', ParseIntPipe) itemId: number) {
    return this.watchService.deleteItem(groupId, itemId);
  }

  @Post('groups/:groupId/items/bulk')
  bulkItems(@Param('groupId', ParseIntPipe) groupId: number, @Body() body: { codes: string[] }) {
    return this.watchService.bulkCreateItems(groupId, body.codes);
  }

  @Post('groups/:groupId/items/reorder')
  reorderItems(@Param('groupId', ParseIntPipe) groupId: number, @Body() body: { orderedCodes: string[] }) {
    return this.watchService.reorderItems(groupId, body.orderedCodes);
  }
}
