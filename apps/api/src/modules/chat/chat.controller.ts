import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private chat: ChatService) {}

  @Get('channels')
  listChannels(@Request() req: any) {
    return this.chat.listChannels(req.user.id);
  }

  @Get('unread')
  unreadTotal(@Request() req: any) {
    return this.chat.unreadTotal(req.user.id);
  }

  @Post('channels')
  createChannel(
    @Body() body: { name: string; description?: string; isPrivate?: boolean; memberIds?: string[] },
    @Request() req: any,
  ) {
    return this.chat.createChannel(body, req.user.id);
  }

  @Post('channels/seed')
  seedChannels(@Request() req: any) {
    return this.chat.seedDefaultChannels(req.user.id);
  }

  @Post('dm/:userId')
  getOrCreateDm(@Param('userId') otherUserId: string, @Request() req: any) {
    return this.chat.getOrCreateDm(req.user.id, otherUserId);
  }

  @Get('channels/:id/messages')
  getMessages(@Param('id') id: string, @Request() req: any) {
    return this.chat.getMessages(id, req.user.id);
  }

  @Post('channels/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() body: { text: string },
    @Request() req: any,
  ) {
    return this.chat.sendMessage(id, req.user.id, body.text);
  }

  @Delete('channels/:id')
  deleteChannel(@Param('id') id: string) {
    return this.chat.deleteChannel(id);
  }
}