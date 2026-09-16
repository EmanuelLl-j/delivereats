import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { isolatedEnvironment, poll } from './isolated-environment.mjs';

test('Cuatro servicios aislados, sin fixtures permanentes', { timeout: 240_000 }, async t => {
  const local = await isolatedEnvironment();
  try {
    const { db, bases, mails, id } = local;
    async function request(service, path, body, token, method = body === undefined ? 'GET' : 'POST', expected) {
      const response = await fetch(bases[service] + path, { method, headers: { ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
      const data = await response.json().catch(() => null);
      if (expected) assert.equal(response.status, expected, service + path + ': ' + (data?.message ?? 'estado incorrecto'));
      else assert.ok(response.ok, service + path + ': ' + response.status + ' ' + (data?.message ?? ''));
      return data;
    }
    const password = 'Aa9!' + randomBytes(20).toString('hex');
    let customer, merchant, merchantTwo, other, driver, order, address, profile;
    const catalog = [];
    const documents = [];
    await t.test('Registro, RabbitMQ y correo SMTP real hacia receptor aislado', async () => {
      customer = await request('users', '/auth/register', { firstName: 'Prueba', lastName: 'Aislada', email: 'customer-' + id + '@example.test', password, role: 'CUSTOMER' });
      assert.ok(customer.accessToken); assert.equal(customer.developmentToken, undefined);
      const mail = await poll(() => mails.find(mail => mail.recipient.includes('customer-' + id) && mail.raw.includes('token')));
      const token = mail.raw.replace(/=\r\n/g, '').match(/[a-f0-9]{64}/)?.[0]; assert.ok(token);
      await request('users', '/auth/verify-email', { token });
      await request('users', '/auth/verify-email', { token }, undefined, 'POST', 401);
      assert.ok((await request('users', '/auth/profile', undefined, customer.accessToken)).emailVerifiedAt);
    });
    await t.test('Fixtures solo en bases temporales y aceptación legal versionada', async () => {
      for (const role of ['MERCHANT', 'CUSTOMER', 'DRIVER']) {
        const account = await request('users', '/auth/register', { firstName: 'Temporal', lastName: role, email: 'account-' + role.toLowerCase() + '-' + id + '@example.test', password, role });
        await db.users.user.update({ where: { id: account.user.id }, data: { emailVerifiedAt: new Date() } });
        if (role === 'MERCHANT') merchant = account; else if (role === 'DRIVER') driver = account; else other = account;
      }
      merchantTwo = await request('users', '/auth/register', { firstName: 'Segundo', lastName: 'Comercio', email: 'second-merchant-' + id + '@example.test', password, role: 'MERCHANT' });
      await db.users.user.update({ where: { id: merchantTwo.user.id }, data: { emailVerifiedAt: new Date() } });
      for (const type of ['GENERAL_TERMS', 'PRIVACY_POLICY', 'MERCHANT_TERMS', 'DRIVER_TERMS', 'SHIPPING_TERMS', 'PROHIBITED_ITEMS_POLICY']) documents.push(await db.users.legalDocument.create({ data: { type, title: 'Fixture exclusivo de prueba', version: 'e2e-' + id, content: 'Documento temporal de prueba sin validez para usuarios reales.', status: 'PUBLISHED', effectiveAt: new Date(), publishedAt: new Date(), mandatory: true } }));
      for (const account of [customer, merchant, merchantTwo, other, driver]) await request('users', '/legal/acceptances', { documentIds: documents.map(row => row.id) }, account.accessToken);
      address = await request('users', '/users/me/addresses', { label: 'Prueba aislada', address: 'Destino temporal de pruebas', latitude: -13.16, longitude: -74.22 }, customer.accessToken);
      profile = await db.drivers.driverProfile.create({ data: { userId: driver.user.id, documentNumber: '12345678', vehicleType: 'MOTORCYCLE', applicationStatus: 'APPROVED', approvedAt: new Date() } });
      assert.equal(Number(profile.rating), 0);
      await db.orders.paymentConfiguration.create({ data: { method: 'CASH', enabled: true } });
    });
    await t.test('Archivo privado, firma temporal y aislamiento entre usuarios', async () => {
      const form = new FormData(); form.set('file', new Blob([Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])], { type: 'image/png' }), 'isolated.png');
      const asset = await request('users', '/files?purpose=PACKAGE', form, customer.accessToken);
      assert.ok(asset.id); assert.equal(asset.url, undefined);
      await request('users', '/files/' + asset.id + '/url', undefined, other.accessToken, 'GET', 403);
      const signed = await request('users', '/files/' + asset.id + '/url', undefined, customer.accessToken);
      assert.equal((await fetch(signed.url)).status, 200);
      const tampered = new URL(signed.url); tampered.searchParams.set('signature', '0'.repeat(64)); assert.equal((await fetch(tampered)).status, 403);
    });
    await t.test('Catálogo, cotización y checkout reales sin exponer datos privados', async () => {
      const shop = await db.orders.merchant.create({ data: { ownerUserId: merchant.user.id, name: 'Comercio efímero', description: 'Solo fixture aislado', category: 'RESTAURANT', ruc: '20123456789', phone: '+51911111111', email: 'shop-' + id + '@example.test', address: 'Origen de prueba', latitude: -13.159, longitude: -74.221, deliveryEstimateMin: 15, deliveryEstimateMax: 30, applicationStatus: 'APPROVED', isActive: true } });
      const category = await request('orders', '/merchants/' + shop.id + '/categories', { name: 'Categoría temporal' }, merchant.accessToken);
      const product = await request('orders', '/merchants/' + shop.id + '/products', { categoryId: category.id, name: 'Producto efímero', description: 'Producto exclusivo de esta prueba', price: 20 }, merchant.accessToken);
      const secondShop = await db.orders.merchant.create({ data: { ...shop, id: randomUUID(), ownerUserId: merchantTwo.user.id, name: 'Segundo comercio efímero', ruc: '20987654321', email: 'shop2-' + id + '@example.test' } });
      const secondCategory = await request('orders', '/merchants/' + secondShop.id + '/categories', { name: 'Segunda categoría temporal' }, merchantTwo.accessToken);
      const secondProduct = await request('orders', '/merchants/' + secondShop.id + '/products', { categoryId: secondCategory.id, name: 'Segundo producto efímero', description: 'Segundo producto exclusivo de esta prueba', price: 10 }, merchantTwo.accessToken);
      catalog.push({ shop, category, product }, { shop: secondShop, category: secondCategory, product: secondProduct });
      await request('orders', '/cart/items', { productId: secondProduct.id, quantity: 1 }, customer.accessToken);
      const publicShop = await request('orders', '/merchants/' + shop.id); assert.equal(publicShop.email, undefined); assert.equal(publicShop.ruc, undefined); assert.equal(publicShop.ownerUserId, undefined);
      await request('orders', '/cart/items', { productId: product.id, quantity: 2 }, customer.accessToken);
      const input = { deliveryAddressId: address.id, deliveryAddress: address.address, deliveryLatitude: Number(address.latitude), deliveryLongitude: Number(address.longitude), paymentMethod: 'CASH' };
      const quote = await request('orders', '/cart/quote', input, customer.accessToken);
      await request('orders', '/cart/checkout', { ...input, expectedTotal: 0.01 }, customer.accessToken, 'POST', 409);
      const checkout = await request('orders', '/cart/checkout', { ...input, expectedTotal: quote.total }, customer.accessToken);
      order = checkout.order; assert.equal(order.status, 'CONFIRMED'); assert.equal(Number(order.subtotal), 50); assert.equal(order.subOrders.length, 2);
      await request('orders', '/orders/' + order.id, undefined, other.accessToken, 'GET', 403);
      await request('orders', '/admin/payments', undefined, customer.accessToken, 'GET', 403);
    });
    await t.test('Preparación, asignación real y bloqueo de entrega anticipada', async () => {
      await request('drivers', '/drivers/me/location', { latitude: -13.159, longitude: -74.221, timestamp: new Date().toISOString() }, driver.accessToken);
      await request('drivers', '/drivers/me/availability', { status: 'AVAILABLE' }, driver.accessToken, 'PATCH');
      const sub = order.subOrders.find(row => row.merchantId === catalog[0].shop.id);
      const second = order.subOrders.find(row => row.merchantId === catalog[1].shop.id);
      await request('orders', '/orders/suborders/' + sub.id + '/status', { status: 'PREPARING' }, merchant.accessToken, 'PATCH');
      await request('orders', '/orders/suborders/' + sub.id + '/status', { status: 'READY_FOR_PICKUP' }, merchant.accessToken, 'PATCH');
      const partiallyReady = await request('orders', '/orders/' + order.id, undefined, customer.accessToken);
      assert.equal(partiallyReady.subOrders.find(row => row.id === second.id).status, 'CONFIRMED');
      assert.equal(await db.drivers.driverAssignment.count({ where: { orderId: order.id } }), 0);
      await request('orders', '/orders/suborders/' + second.id + '/status', { status: 'PREPARING' }, merchant.accessToken, 'PATCH', 403);
      await request('orders', '/orders/suborders/' + second.id + '/status', { status: 'PREPARING' }, merchantTwo.accessToken, 'PATCH');
      await request('orders', '/orders/suborders/' + second.id + '/status', { status: 'READY_FOR_PICKUP' }, merchantTwo.accessToken, 'PATCH');
      const offer = await poll(() => request('drivers', '/drivers/me/offers/active', undefined, driver.accessToken));
      profile.assignmentId = offer.id;
      await request('drivers', '/drivers/me/offers/' + offer.id + '/accept', {}, driver.accessToken);
      await request('drivers', '/drivers/me/assignments/' + offer.id + '/status', { status: 'DELIVERED' }, driver.accessToken, 'POST', 409);
      const detail = await request('drivers', '/drivers/me/assignments/' + offer.id + '/order', undefined, driver.accessToken); assert.equal(detail.payments, undefined);
    });
    await t.test('Chat privado idempotente; LiveKit ausente no simula llamadas', async () => {
      const path = '/communications/orders/' + order.id;
      await request('drivers', path, undefined, other.accessToken, 'GET', 403);
      const conversation = await request('drivers', path, undefined, customer.accessToken); assert.equal(conversation.audioAvailable, false); assert.equal(conversation.counterpart.email, undefined);
      const message = { clientMessageId: randomUUID(), body: 'Mensaje temporal de prueba' };
      const one = await request('drivers', path + '/messages', message, customer.accessToken);
      const two = await request('drivers', path + '/messages', message, customer.accessToken); assert.equal(one.id, two.id);
      await request('drivers', path + '/read', {}, driver.accessToken);
      await request('drivers', path + '/calls', {}, customer.accessToken, 'POST', 503);
    });
    await t.test('Recogida, entrega, CASH y ganancia real; reembolso no duplicado', async () => {
      await request('drivers', '/drivers/me/assignments/' + profile.assignmentId + '/pickups/' + order.subOrders[0].id, {}, driver.accessToken);
      await request('drivers', '/drivers/me/assignments/' + profile.assignmentId + '/status', { status: 'DELIVERED' }, driver.accessToken, 'POST', 409);
      await request('drivers', '/drivers/me/assignments/' + profile.assignmentId + '/pickups/' + order.subOrders[1].id, {}, driver.accessToken);
      await request('drivers', '/drivers/me/assignments/' + profile.assignmentId + '/status', { status: 'DELIVERED' }, driver.accessToken);
      const complete = await request('orders', '/orders/' + order.id, undefined, customer.accessToken); assert.equal(complete.status, 'DELIVERED'); assert.equal(complete.paymentStatus, 'PAID');
      await poll(() => request('drivers', '/drivers/me/earnings?period=day', undefined, driver.accessToken), row => row.completed === 1);
      const refund = await request('orders', '/orders/' + order.id + '/refunds', { reason: 'Solicitud temporal para verificar el flujo' }, customer.accessToken); assert.equal(refund.status, 'REQUESTED');
      await request('orders', '/orders/' + order.id + '/refunds', { reason: 'Solicitud temporal duplicada' }, customer.accessToken, 'POST', 409);
    });
    await t.test('Rechazo multi-comercio y archivo de categoría sin reactivar productos', async () => {
      for (const entry of catalog) await request('orders', '/cart/items', { productId: entry.product.id, quantity: 1 }, customer.accessToken);
      const input = { deliveryAddressId: address.id, deliveryAddress: address.address, deliveryLatitude: Number(address.latitude), deliveryLongitude: Number(address.longitude), paymentMethod: 'CASH' };
      const quote = await request('orders', '/cart/quote', input, customer.accessToken);
      const created = await request('orders', '/cart/checkout', { ...input, expectedTotal: quote.total }, customer.accessToken);
      const target = created.order.subOrders.find(row => row.merchantId === catalog[0].shop.id);
      await request('orders', '/orders/suborders/' + target.id + '/status', { status: 'CANCELLED', reason: 'No se puede atender esta solicitud temporal' }, merchant.accessToken, 'PATCH');
      const cancelled = await request('orders', '/orders/' + created.order.id, undefined, customer.accessToken);
      assert.equal(cancelled.status, 'CANCELLED'); assert.ok(cancelled.subOrders.every(row => row.status === 'CANCELLED'));
      assert.equal(await db.orders.refund.count({ where: { orderId: created.order.id } }), 0);
      await request('orders', '/merchants/categories/' + catalog[0].category.id, { isActive: false }, merchant.accessToken, 'PATCH');
      await request('orders', '/merchants/products/' + catalog[0].product.id, { isAvailable: true }, merchant.accessToken, 'PATCH', 404);
      await request('orders', '/cart/items', { productId: catalog[0].product.id, quantity: 1 }, customer.accessToken, 'POST', 400);
      await request('orders', '/merchants/' + catalog[0].shop.id + '/products', { categoryId: catalog[0].category.id, name: 'No debe publicarse', description: 'Intento en categoría archivada', price: 10 }, merchant.accessToken, 'POST', 404);
    });
    await t.test('Envíos: capacidad, prohibición, revisión y cotización de un uso', async () => {
      await db.orders.logisticsConfig.create({ data: { vehicleType: 'MOTORCYCLE', maxWeightKg: 20, maxLengthCm: 60, maxWidthCm: 60, maxHeightCm: 60, baseFee: 4, perKmFee: 1, perKgFee: 0.1, perLiterFee: 0.01, serviceFee: 1, fragileFee: 1, maxDistanceKm: 20 } });
      for (const status of ['ALLOWED','RESTRICTED','PROHIBITED']) await db.orders.itemPolicy.create({ data: { category: status, description: 'Política efímera de integración', status } });
      const input = { pickupAddress: 'Origen temporal de prueba', pickupLatitude: -13.159, pickupLongitude: -74.221, dropoffAddress: 'Destino temporal de prueba', dropoffLatitude: -13.16, dropoffLongitude: -74.22, recipientName: 'Receptor temporal', packageCategory: 'ALLOWED', contentDescription: 'Descripción completa de contenido para prueba aislada', weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10, declaredValue: 5, fragile: false, vehicleType: 'MOTORCYCLE' };
      await request('orders', '/shipments/quote', { ...input, weightKg: 21 }, customer.accessToken, 'POST', 400);
      await request('orders', '/shipments/quote', { ...input, packageCategory: 'PROHIBITED' }, customer.accessToken, 'POST', 403);
      const restricted = await request('orders', '/shipments/quote', { ...input, packageCategory: 'RESTRICTED' }, customer.accessToken);
      const declarations = { paymentMethod: 'CASH', truthfulDescription: true, noProhibitedItems: true, acceptsShippingPolicy: true, acceptsItemsPolicy: true };
      const review = await request('orders', '/shipments', { ...declarations, quoteId: restricted.id }, customer.accessToken);
      assert.equal(review.order.status, 'REQUIRES_REVIEW'); assert.equal(review.order.assignedDriverId, null);
      assert.equal(await db.orders.paymentIntent.count({ where: { orderId: review.order.id } }), 0);
      const quote = await request('orders', '/shipments/quote', input, customer.accessToken);
      await request('orders', '/shipments', { ...declarations, quoteId: quote.id, truthfulDescription: false }, customer.accessToken, 'POST', 400);
      const created = await request('orders', '/shipments', { ...declarations, quoteId: quote.id }, customer.accessToken);
      profile.shipmentId = created.order.id;
      await request('orders', '/shipments', { ...declarations, quoteId: quote.id }, customer.accessToken, 'POST', 409);
    });
    await t.test('Códigos por fase y CASH del envío, sin revelar códigos al repartidor', async () => {
      const shipmentId = profile.shipmentId;
      await request('drivers', '/drivers/me/location', { latitude: -13.159, longitude: -74.221, timestamp: new Date().toISOString() }, driver.accessToken);
      const offer = await poll(() => request('drivers', '/drivers/me/offers/active', undefined, driver.accessToken));
      assert.equal(offer.orderId, shipmentId);
      await request('drivers', '/drivers/me/offers/' + offer.id + '/accept', {}, driver.accessToken);
      await request('orders', '/shipments/' + shipmentId + '/codes', undefined, other.accessToken, 'GET', 404);
      const pickup = await request('orders', '/shipments/' + shipmentId + '/codes', undefined, customer.accessToken); assert.equal(pickup.phase, 'PICKUP');
      const detail = await request('drivers', '/drivers/me/assignments/' + offer.id + '/order', undefined, driver.accessToken);
      assert.equal(detail.shipment.pickupVerificationCode, undefined); assert.equal(detail.shipment.deliveryVerificationCode, undefined);
      const wrong = pickup.code.slice(0,5) + ((Number(pickup.code.at(-1)) + 1) % 10);
      await request('drivers', '/drivers/me/assignments/' + offer.id + '/verify', { phase: 'PICKUP', code: wrong }, driver.accessToken, 'POST', 400);
      await request('drivers', '/drivers/me/assignments/' + offer.id + '/verify', { phase: 'PICKUP', code: pickup.code }, driver.accessToken);
      const delivery = await request('orders', '/shipments/' + shipmentId + '/codes', undefined, customer.accessToken); assert.equal(delivery.phase, 'DELIVERY');
      await request('drivers', '/drivers/me/assignments/' + offer.id + '/verify', { phase: 'DELIVERY', code: delivery.code }, driver.accessToken);
      const finished = await request('orders', '/orders/' + shipmentId, undefined, customer.accessToken); assert.equal(finished.status, 'DELIVERED'); assert.equal(finished.paymentStatus, 'PAID');
      const hidden = await request('orders', '/shipments/' + shipmentId + '/codes', undefined, customer.accessToken); assert.equal(hidden.code, null);
      assert.equal((await db.orders.paymentIntent.findFirst({ where: { orderId: shipmentId } })).status, 'PAID');
    });
    await t.test('Mercado Pago ausente no se ofrece; webhook falso rechazado', async () => {
      const methods = await request('orders', '/payments/methods', undefined, customer.accessToken); assert.deepEqual(methods.map(row => row.method), ['CASH']);
      await request('orders', '/payments/webhook/mercadopago?data.id=123', {}, undefined, 'POST', 403);
    });
    await t.test('Exportación de cuatro dominios y soporte autorizado', async () => {
      const exported = await request('users', '/privacy/export', undefined, customer.accessToken);
      assert.ok(exported.orders.orders.some(row => row.id === order.id));
      assert.equal(exported.deliveries.messages.length, 1);
      assert.ok(Array.isArray(exported.notifications.notifications));
      assert.equal(exported.user.passwordHash, undefined);
      assert.ok(exported.files.every(file => file.objectKey === undefined));
      assert.ok(exported.orders.orders.filter(row => row.shipment).every(row => row.shipment.pickupVerificationCode === undefined));
      const ticket = { orderId: order.id, type: 'INCIDENT', subject: 'Consulta temporal', description: 'Consulta sobre la entrega de integración' };
      await request('users', '/support/tickets', ticket, other.accessToken, 'POST', 403);
      await request('users', '/support/tickets', ticket, driver.accessToken);
      const unrelated = await request('users', '/privacy/export', undefined, other.accessToken);
      assert.equal(unrelated.orders.orders.length, 0); assert.equal(unrelated.deliveries.messages.length, 0);
    });
    await t.test('Refresh de un uso y revocación tras logout', async () => {
      const fresh = await request('users', '/auth/refresh', { refreshToken: other.refreshToken });
      await request('users', '/auth/refresh', { refreshToken: other.refreshToken }, undefined, 'POST', 401);
      await request('users', '/auth/logout', { refreshToken: fresh.refreshToken }, fresh.accessToken);
      await request('users', '/auth/profile', undefined, fresh.accessToken, 'GET', 401);
    });
    await t.test('Baja revisada: bloquea operaciones activas y revoca acceso sin borrar historia', async () => {
      const passwordHash = (await db.users.user.findUnique({ where: { id: other.user.id }, select: { passwordHash: true } })).passwordHash;
      const email = 'isolated-admin-' + id + '@example.test';
      await db.users.user.create({ data: { firstName: 'Admin', lastName: 'Temporal', email, passwordHash, role: 'ADMIN', emailVerifiedAt: new Date() } });
      const admin = await request('users', '/auth/login', { email, password });
      const active = await request('users', '/privacy/requests', { type: 'DELETION', description: 'Solicitud temporal con envío en revisión' }, customer.accessToken);
      await request('users', '/admin/privacy/' + active.id, { status: 'RESOLVED', response: 'Revisión de baja temporal' }, admin.accessToken, 'PATCH', 409);
      const session = await request('users', '/auth/login', { email: other.user.email, password });
      const closing = await request('users', '/privacy/requests', { type: 'DELETION', description: 'Solicito desactivar esta cuenta efímera' }, session.accessToken);
      await request('users', '/admin/privacy/' + closing.id, { status: 'RESOLVED', response: 'Cuenta desactivada; historial sujeto a política de conservación' }, admin.accessToken, 'PATCH');
      assert.equal((await db.users.user.findUnique({ where: { id: other.user.id } })).status, 'DELETED');
      await request('users', '/auth/profile', undefined, session.accessToken, 'GET', 401);
      await request('users', '/auth/login', { email: other.user.email, password }, undefined, 'POST', 401);
      await request('users', '/users/' + other.user.id + '/status', { status: 'ACTIVE' }, admin.accessToken, 'PATCH', 409);
    });
  } finally { await local.close(); }
});
