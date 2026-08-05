import { Controller, Get, Patch, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.notifications.findForUser(req.user.id);
  }

  @Get('unread-count')
  unreadCount(@Request() req: any) {
    return this.notifications.unreadCount(req.user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Patch('read-all')
  markAllRead(@Request() req: any) {
    return this.notifications.markAllRead(req.user.id);
  }

  @Post('process-mentions')
  processMentions(
    @Body() body: { text: string; link?: string; orderId?: string; orderNumber?: string },
    @Request() req: any,
  ) {
    return this.notifications.processMentions(
      body.text,
      { link: body.link, orderId: body.orderId, orderNumber: body.orderNumber },
      req.user.id,
    );
  }
}