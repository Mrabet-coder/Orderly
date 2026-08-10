import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { BordereauService } from './bordereau.service';

@Module({
  providers: [OrdersService, BordereauService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}