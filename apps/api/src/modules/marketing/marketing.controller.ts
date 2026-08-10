import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { MarketingService, SegmentRules } from './marketing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('marketing')
export class MarketingController {
  constructor(private marketing: MarketingService) {}

  // ---- Segments ----

  @Get('segments')
  listSegments() {
    return this.marketing.listSegments();
  }

  @Post('segments')
  createSegment(@Body() body: { name: string; description?: string; rules: SegmentRules }) {
    return this.marketing.createSegment(body);
  }

  @Post('segments/preview')
  previewSegment(@Body() body: { rules: SegmentRules }) {
    return this.marketing.previewSegment(body.rules);
  }

  @Post('segments/seed')
  seedSegments() {
    return this.marketing.seedDefaultSegments();
  }

  @Patch('segments/:id')
  updateSegment(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; rules?: SegmentRules },
  ) {
    return this.marketing.updateSegment(id, body);
  }

  @Delete('segments/:id')
  deleteSegment(@Param('id') id: string) {
    return this.marketing.deleteSegment(id);
  }

  // ---- Campaigns ----

  @Get('campaigns')
  listCampaigns() {
    return this.marketing.listCampaigns();
  }

  @Post('campaigns')
  createCampaign(@Body() body: {
    name: string;
    message: string;
    segmentId?: string;
    channel?: string;
    scheduledAt?: string;
  }) {
    return this.marketing.createCampaign(body);
  }

  @Post('campaigns/:id/send')
  sendCampaign(@Param('id') id: string) {
    return this.marketing.sendCampaign(id);
  }

  @Get('campaigns/:id/sends')
  getCampaignSends(@Param('id') id: string) {
    return this.marketing.getCampaignSends(id);
  }

  @Delete('campaigns/:id')
  deleteCampaign(@Param('id') id: string) {
    return this.marketing.deleteCampaign(id);
  }

  // ---- Flows ----

  @Get('flows')
  listFlows() {
    return this.marketing.listFlows();
  }

  @Post('flows')
  createFlow(@Body() body: {
    name: string;
    description?: string;
    trigger: string;
    triggerConfig?: any;
    segmentId?: string;
    message: string;
    delayHours?: number;
  }) {
    return this.marketing.createFlow(body);
  }

  @Patch('flows/:id/toggle')
  toggleFlow(@Param('id') id: string) {
    return this.marketing.toggleFlow(id);
  }

  @Delete('flows/:id')
  deleteFlow(@Param('id') id: string) {
    return this.marketing.deleteFlow(id);
  }
}