import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { OrderStatus } from './generated/prisma';
import { CurrentUser, Public, Roles } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import { CartService } from './cart.service';
import { CommerceService } from './commerce.service';
import {
  AddCartItemDto,
  CheckoutDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateMerchantDto,
  CreateProductDto,
  CreatePromotionDto,
  PaymentReviewDto,
  PaymentEvidenceDto,
  MerchantApplicationDto,
  SubOrderTransitionDto,
  RatingDto,
  TransitionOrderDto,
  UpdateCartItemDto,
  UpdateMerchantDto,
  UpdateProductDto,
  UpdatePromotionDto,
} from './dto';
import { OrdersService } from './orders.service';
import { PaymentService } from './payments/payment.service';
import { PromotionsService } from './promotions.service';

@ApiTags('Comercios y catálogo')
@Controller('merchants')
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Public()
  @Get()
  list(@Query('category') category?: string, @Query('search') search?: string) {
    return this.commerce.listMerchants(category, search);
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.commerce.merchant(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateMerchantDto) {
    return this.commerce.createMerchant(dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateMerchantDto) {
    return this.commerce.updateMerchant(user.sub, user.role === UserRole.ADMIN, id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Post(':id/categories')
  addCategory(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.commerce.addCategory(user.sub, user.role === UserRole.ADMIN, id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Post(':id/products')
  addProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.commerce.addProduct(user.sub, user.role === UserRole.ADMIN, id, dto);
  }

  @ApiBearerAuth() @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Patch('categories/:id') updateCategory(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.commerce.updateCategory(user.sub, user.role === UserRole.ADMIN, id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Patch('products/:id')
  updateProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.commerce.updateProduct(user.sub, user.role === UserRole.ADMIN, id, dto);
  }
}

@ApiBearerAuth()
@ApiTags('Portal comercio')
@Roles(UserRole.MERCHANT)
@Controller('commerce')
export class MerchantPortalController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('me')
  mine(@CurrentUser() user: JwtPayload) {
    return this.commerce.myMerchant(user.sub);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtPayload) {
    return this.commerce.dashboard(user.sub);
  }

  @Post('application') application(@CurrentUser() user: JwtPayload, @Body() dto: MerchantApplicationDto) {
    return this.commerce.apply(user.sub, dto);
  }
}

@ApiBearerAuth()
@ApiTags('Carrito')
@Roles(UserRole.CUSTOMER)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post('quote')
  quote(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto) { return this.cart.quote(user.sub, dto); }

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.cart.get(user.sub);
  }

  @Post('items')
  add(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    return this.cart.add(user.sub, dto);
  }

  @Patch('items/:id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateCartItemDto) {
    return this.cart.update(user.sub, id, dto);
  }

  @Delete('items/:id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cart.remove(user.sub, id);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Crear un pedido y sus subpedidos con cálculo server-side' })
  checkout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CheckoutDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.cart.checkout(user.sub, dto, correlationId);
  }
}

@ApiBearerAuth()
@ApiTags('Pedidos')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @Patch('suborders/:id/status') subOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: SubOrderTransitionDto) { return this.orders.transitionSubOrder(user, id, dto); }

  @Roles(UserRole.CUSTOMER, UserRole.MERCHANT, UserRole.ADMIN)
  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('status') status?: OrderStatus) {
    return this.orders.list(user, status);
  }

  @Roles(UserRole.CUSTOMER, UserRole.MERCHANT, UserRole.ADMIN)
  @Get(':id')
  detail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orders.get(user, id);
  }

  @Roles(UserRole.CUSTOMER, UserRole.MERCHANT, UserRole.ADMIN)
  @Patch(':id/status')
  transition(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TransitionOrderDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.orders.transition(user, id, dto.status, correlationId);
  }

  @Roles(UserRole.CUSTOMER)
  @Post(':id/rating')
  rate(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: RatingDto) {
    return this.orders.rate(user.sub, id, dto);
  }
}

@ApiBearerAuth()
@ApiTags('Pagos')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentService) {}

  @Get('methods') methods() { return this.payments.methods(); }

  @Roles(UserRole.CUSTOMER)
  @Post('orders/:id') retry(@CurrentUser() user: JwtPayload, @Param('id') id: string) { return this.payments.retryOwn(id, user.sub); }

  @Roles(UserRole.CUSTOMER)
  @Post(':id/evidence') evidence(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: PaymentEvidenceDto) { return this.payments.evidence(id, user.sub, dto); }

  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.payments.get(id, user.sub, user.role === UserRole.ADMIN);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/review')
  review(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PaymentReviewDto,
  ) {
    return this.payments.review(id, user.sub, dto.approved, dto.reason);
  }

  @Public()
  @Post('webhook/mercadopago')
  webhook(
    @Headers('x-request-id') requestId: string,
    @Headers('x-signature') signature: string,
    @Query('data.id') queryId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.payments.verifyMercadoPago(queryId ?? '', requestId ?? '', signature ?? '', correlationId);
  }
}

@ApiBearerAuth()
@ApiTags('Promociones')
@Roles(UserRole.ADMIN)
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list() {
    return this.promotions.list();
  }

  @Post()
  create(@Body() dto: CreatePromotionDto) {
    return this.promotions.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.promotions.update(id, dto);
  }
}

@ApiTags('Comunicación interna')
@SkipThrottle()
@Controller('internal/orders')
export class InternalOrdersController {
  constructor(private readonly orders: OrdersService) {}

  private authorize(secret?: string): void {
    if (!process.env.INTERNAL_SERVICE_SECRET || secret !== process.env.INTERNAL_SERVICE_SECRET) {
      throw new UnauthorizedException('Credencial interna inválida');
    }
  }

  @Public()
  @Get(':id/context')
  context(@Headers('x-internal-service-secret') secret: string | undefined, @Param('id') id: string) {
    this.authorize(secret);
    return this.orders.context(id);
  }

  @Public() @Get(':id/participation/:userId')
  participation(@Headers('x-internal-service-secret') secret: string, @Param('id') id: string, @Param('userId') userId: string) {
    this.authorize(secret);
    return this.orders.participation(id, userId);
  }

  @Public()
  @Get(':id/details')
  details(
    @Headers('x-internal-service-secret') secret: string | undefined,
    @Param('id') id: string,
  ) {
    this.authorize(secret);
    return this.orders.internalDetails(id);
  }

  @Public()
  @Post(':id/assign')
  assign(
    @Headers('x-internal-service-secret') secret: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Param('id') id: string,
    @Body() body: { driverId: string },
  ) {
    this.authorize(secret);
    return this.orders.internalAssign(id, body.driverId, correlationId);
  }

  @Public()
  @Post(':id/driver-status')
  driverStatus(
    @Headers('x-internal-service-secret') secret: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Param('id') id: string,
    @Body() body: { driverId: string; status: OrderStatus },
  ) {
    this.authorize(secret);
    return this.orders.internalTransition(id, body.status, body.driverId, correlationId);
  }

  @Public()
  @Post(':id/pickups/:subOrderId')
  pickup(
    @Headers('x-internal-service-secret') secret: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Param('id') id: string,
    @Param('subOrderId') subOrderId: string,
    @Body() body: { driverId: string },
  ) {
    this.authorize(secret);
    return this.orders.markPickup(id, subOrderId, body.driverId, correlationId);
  }
}
