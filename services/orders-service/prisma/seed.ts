import { PrismaClient, ItemPolicyStatus } from '../src/generated/prisma';

const prisma = new PrismaClient();
// Operational catalogues only. Existing configuration is never overwritten.
async function main() {
  const policies: Array<[string, string, ItemPolicyStatus]> = [
    ['DOCUMENTS', 'Documentos y papelería sin contenido ilícito', 'ALLOWED'],
    ['CLOTHING', 'Ropa y textiles embalados', 'ALLOWED'],
    ['HOUSEHOLD', 'Objetos domésticos no peligrosos', 'ALLOWED'],
    ['FOOD', 'Alimentos: validar embalaje, temperatura y conservación', 'RESTRICTED'],
    ['MEDICINE', 'Medicamentos: requiere revisión de requisitos aplicables', 'RESTRICTED'],
    ['VALUABLES', 'Artículos de valor: requiere revisión administrativa', 'RESTRICTED'],
    ['OTHER', 'Contenido no clasificado: requiere revisión previa', 'RESTRICTED'],
    ['WEAPONS', 'Armas, municiones y explosivos', 'PROHIBITED'],
    ['ILLEGAL_SUBSTANCES', 'Sustancias ilegales', 'PROHIBITED'],
    ['HAZARDOUS', 'Sustancias tóxicas, inflamables o peligrosas', 'PROHIBITED'],
    ['ANIMALS', 'Animales vivos', 'PROHIBITED'],
  ];
  for (const [category, description, status] of policies) await prisma.itemPolicy.upsert({ where: { category }, update: {}, create: { category, description, status } });
  for (const [vehicleType, maxWeightKg, maxLengthCm, maxWidthCm, maxHeightCm] of [
    ['BICYCLE', 5, 35, 30, 30], ['MOTORCYCLE', 15, 50, 40, 40], ['CAR', 50, 100, 70, 60],
  ] as const) await prisma.logisticsConfig.upsert({ where: { vehicleType }, update: {}, create: { vehicleType, maxWeightKg, maxLengthCm, maxWidthCm, maxHeightCm, baseFee: 4, perKmFee: 1.2, perKgFee: 0.2, perLiterFee: 0.01, serviceFee: 1, fragileFee: 2, maxDistanceKm: 20, isActive: false } });
  for (const method of ['CASH', 'YAPE_MANUAL', 'PLIN_MANUAL', 'MERCADO_PAGO']) await prisma.paymentConfiguration.upsert({ where: { method }, update: {}, create: { method, enabled: method === 'CASH' } });
  process.stdout.write('Catálogos preparados. Revisar y activar tarifas desde administración. No se crearon comercios.\n');
}
main().catch(() => { process.stderr.write('No se pudieron preparar los catálogos.\n'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
