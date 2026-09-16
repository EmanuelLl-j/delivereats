export function productionEnvironmentIssues(env: Record<string, string | undefined>, service = 'all') {
  if (env.NODE_ENV !== 'production') return [];
  const issues: string[] = [];
  const required = (name: string, min = 1) => {
    const value = env[name] ?? '';
    if (value.length < min || /change.?me|replace.?me|development|example|demo|your[-_ ]/i.test(value)) issues.push(`${name}: falta un valor real válido`);
  };
  const publicUrl = (name: string, protocol = 'https:') => {
    try { const url = new URL(env[name] ?? ''); if (url.protocol !== protocol || url.username || url.password || /^(localhost|127\.|10\.0\.2\.2)|\.test$|\.example$/i.test(url.hostname)) throw new Error(); }
    catch { issues.push(`${name}: requiere URL pública ${protocol}`); }
  };
  const secretUrl = (name: string, protocols: string[]) => {
    try { const url = new URL(env[name] ?? ''); if (!protocols.includes(url.protocol) || decodeURIComponent(url.password).length < 20) throw new Error(); }
    catch { issues.push(`${name}: requiere conexión autenticada y contraseña robusta`); }
  };
  for (const name of ['JWT_SECRET', 'INTERNAL_SERVICE_SECRET', 'EVENTS_ENCRYPTION_KEY']) required(name, 32);
  const secretNames = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'INTERNAL_SERVICE_SECRET', 'EVENTS_ENCRYPTION_KEY'];
  const secrets = secretNames.map(name => env[name]).filter(Boolean);
  if (new Set(secrets).size !== secrets.length) issues.push('Los secretos de JWT, sesiones, tráfico interno y eventos deben ser independientes');
  if (!env.CORS_ORIGINS || env.CORS_ORIGINS.split(',').some(origin => { try { const url = new URL(origin); return url.protocol !== 'https:' || url.origin !== origin || origin.includes('*'); } catch { return true; } })) issues.push('CORS_ORIGINS: declara orígenes HTTPS exactos separados por coma, sin barra final ni comodines');
  secretUrl('RABBITMQ_URL', ['amqp:', 'amqps:']);
  if (service !== 'all') secretUrl('DATABASE_URL', ['postgres:', 'postgresql:']);
  else for (const name of ['USERS_DATABASE_URL', 'ORDERS_DATABASE_URL', 'DRIVERS_DATABASE_URL', 'NOTIFICATIONS_DATABASE_URL']) secretUrl(name, ['postgres:', 'postgresql:']);
  if (['all', 'users-service'].includes(service)) {
    required('JWT_REFRESH_SECRET', 32); publicUrl('WEB_URL'); publicUrl('PUBLIC_USERS_URL');
    if (env.STORAGE_PROVIDER !== 's3') issues.push('STORAGE_PROVIDER: producción requiere s3; no se permite fallback local');
    for (const name of ['S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']) required(name);
    publicUrl('S3_ENDPOINT'); if (env.S3_PUBLIC_ENDPOINT) publicUrl('S3_PUBLIC_ENDPOINT');
  }
  if (['all', 'orders-service'].includes(service)) {
    publicUrl('WEB_URL'); publicUrl('PUBLIC_API_URL');
    if (!/^[A-Za-z0-9+/]{43}=$/.test(env.SHIPMENT_CODES_KEY ?? '') || Buffer.from(env.SHIPMENT_CODES_KEY ?? '', 'base64').length !== 32) issues.push('SHIPMENT_CODES_KEY: requiere 32 bytes aleatorios codificados en base64');
    if (env.MERCADOPAGO_ACCESS_TOKEN || env.MERCADOPAGO_WEBHOOK_SECRET) {
      required('MERCADOPAGO_ACCESS_TOKEN'); required('MERCADOPAGO_WEBHOOK_SECRET');
      if (env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('TEST-')) issues.push('MERCADOPAGO_ACCESS_TOKEN: no se permiten credenciales de prueba en producción');
    }
  }
  if (['all', 'drivers-service'].includes(service)) {
    secretUrl('REDIS_URL', ['redis:', 'rediss:']);
    if (env.LIVEKIT_URL || env.LIVEKIT_API_KEY || env.LIVEKIT_API_SECRET) {
      publicUrl('LIVEKIT_URL', 'wss:'); required('LIVEKIT_API_KEY'); required('LIVEKIT_API_SECRET', 32);
    }
  }
  if (['all', 'notifications-service'].includes(service)) {
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM']) required(name);
    if (!['465', '587', '2525'].includes(env.SMTP_PORT ?? '')) issues.push('SMTP_PORT: utiliza el puerto TLS autenticado de tu proveedor (465, 587 o 2525)');
    if (env.SMTP_SECURE !== 'true' && env.SMTP_REQUIRE_TLS !== 'true') issues.push('SMTP_REQUIRE_TLS: debe ser true para STARTTLS');
    if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try { const data = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON); if (!data.project_id || !data.client_email || !data.private_key?.includes('BEGIN PRIVATE KEY')) throw new Error(); }
      catch { issues.push('FIREBASE_SERVICE_ACCOUNT_JSON: cuenta de servicio incompleta o JSON inválido'); }
    }
  }
  return [...new Set(issues)];
}
