import assert from 'node:assert/strict';
import { test } from 'node:test';

const baseUrl = process.env.E2E_BASE_URL;
const run = baseUrl ? test : test.skip;

async function request(path, options = {}, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const rawBody = await response.text();
  const body = rawBody ? JSON.parse(rawBody) : null;
  assert.ok(response.ok, `${path} -> ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function waitFor(path, token, predicate, timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await request(path, {}, token);
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert.fail(`Timeout esperando ${path}`);
}

run('cliente creates the documented multi-merchant order', async () => {
  const login = await request('/api/users/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'cliente@delivereats.local', password: 'Demo12345!' }),
  });
  const token = login.accessToken;
  const cart = await request('/api/orders/cart', {}, token);
  for (const item of cart.items) {
    await request(`/api/orders/cart/items/${item.id}`, { method: 'DELETE' }, token);
  }
  await request(
    '/api/orders/cart/items',
    {
      method: 'POST',
      body: JSON.stringify({ productId: '71000000-0000-4000-8000-000000000001', quantity: 1 }),
    },
    token,
  );
  await request(
    '/api/orders/cart/items',
    {
      method: 'POST',
      body: JSON.stringify({ productId: '72000000-0000-4000-8000-000000000002', quantity: 1 }),
    },
    token,
  );
  const checkout = await request(
    '/api/orders/cart/checkout',
    {
      method: 'POST',
      body: JSON.stringify({
        deliveryAddressId: 'aaaaaaaa-2222-4222-8222-222222222222',
        deliveryAddress: 'Jr. 28 de Julio 325, Ayacucho',
        deliveryLatitude: -13.1603,
        deliveryLongitude: -74.2257,
        paymentMethod: 'YAPE',
        promoCode: 'PDGP10',
      }),
    },
    token,
  );
  assert.equal(checkout.order.subOrders.length, 2);
  assert.equal(Number(checkout.order.subtotal), 87);
  assert.equal(Number(checkout.order.discount), 8.7);
  assert.equal(Number(checkout.order.total), 87.65);
  assert.equal(checkout.payment.client.sandbox, true);

  const [admin, merchant, driver] = await Promise.all([
    request('/api/users/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@delivereats.local', password: 'Demo12345!' }),
    }),
    request('/api/users/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'comercio@delivereats.local', password: 'Demo12345!' }),
    }),
    request('/api/users/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'driver@delivereats.local', password: 'Demo12345!' }),
    }),
  ]);
  await request(
    `/api/orders/payments/${checkout.payment.id}/mock-decision`,
    { method: 'POST', body: JSON.stringify({ approved: true }) },
    admin.accessToken,
  );
  await request(
    `/api/orders/orders/${checkout.order.id}/status`,
    { method: 'PATCH', body: JSON.stringify({ status: 'SEARCHING_DRIVER' }) },
    merchant.accessToken,
  );
  const offer = await waitFor(
    '/api/drivers/drivers/me/offers/active',
    driver.accessToken,
    (value) => value?.orderId === checkout.order.id,
    25_000,
  );
  const assignment = await request(
    `/api/drivers/drivers/me/offers/${offer.id}/accept`,
    { method: 'POST', body: '{}' },
    driver.accessToken,
  );
  await request(
    `/api/orders/orders/${checkout.order.id}/status`,
    { method: 'PATCH', body: JSON.stringify({ status: 'PREPARING' }) },
    merchant.accessToken,
  );
  await request(
    `/api/orders/orders/${checkout.order.id}/status`,
    { method: 'PATCH', body: JSON.stringify({ status: 'READY_FOR_PICKUP' }) },
    merchant.accessToken,
  );
  const ready = await request(`/api/orders/orders/${checkout.order.id}`, {}, admin.accessToken);
  assert.equal(ready.subOrders.length, 2);
  for (const subOrder of ready.subOrders) {
    await request(
      `/api/drivers/drivers/me/assignments/${assignment.id}/pickups/${subOrder.id}`,
      { method: 'POST', body: '{}' },
      driver.accessToken,
    );
  }
  await request(
    '/api/drivers/drivers/me/location',
    {
      method: 'POST',
      body: JSON.stringify({
        orderId: checkout.order.id,
        latitude: -13.159,
        longitude: -74.224,
        speed: 22,
        timestamp: new Date().toISOString(),
      }),
    },
    driver.accessToken,
  );
  const tracked = await request(
    `/api/drivers/tracking/orders/${checkout.order.id}/location`,
    {},
    token,
  );
  assert.equal(tracked.driverId, '91000000-0000-4000-8000-000000000001');
  await request(
    `/api/drivers/drivers/me/assignments/${assignment.id}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'DELIVERED' }) },
    driver.accessToken,
  );
  const delivered = await request(`/api/orders/orders/${checkout.order.id}`, {}, token);
  assert.equal(delivered.status, 'DELIVERED');
  await request(
    `/api/orders/orders/${checkout.order.id}/rating`,
    { method: 'POST', body: JSON.stringify({ score: 5, comment: 'Entrega demo completa' }) },
    token,
  );
  const driverProfile = await request('/api/drivers/drivers/me', {}, driver.accessToken);
  assert.equal(driverProfile.status, 'AVAILABLE');
  const notifications = await waitFor(
    '/api/notifications/notifications',
    token,
    (value) => Array.isArray(value) && value.some((item) => item.title === 'Pedido entregado'),
  );
  assert.ok(notifications.length > 0);
});
