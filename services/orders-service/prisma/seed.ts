import { MerchantCategory, PrismaClient, PromotionType } from '../src/generated/prisma';

const prisma = new PrismaClient();
const ownerUserId = '33333333-3333-4333-8333-333333333333';

const merchants = [
  {
    id: '51000000-0000-4000-8000-000000000001',
    name: 'Botica San Gabriel',
    description: 'Cuidado personal, botiquín y productos esenciales con entrega segura.',
    category: MerchantCategory.PHARMACY,
    ruc: '20600000001',
    phone: '+51966010001',
    email: 'botica@delivereats.local',
    address: 'Jr. Asamblea 210, Ayacucho',
    latitude: -13.1588,
    longitude: -74.2236,
    rating: 4.82,
    deliveryEstimateMin: 18,
    deliveryEstimateMax: 30,
  },
  {
    id: '52000000-0000-4000-8000-000000000002',
    name: 'Fresh Market Huamanga',
    description: 'Víveres, frutas y packs familiares seleccionados para tu hogar.',
    category: MerchantCategory.SUPERMARKET,
    ruc: '20600000002',
    phone: '+51966010002',
    email: 'fresh@delivereats.local',
    address: 'Av. Mariscal Cáceres 845, Ayacucho',
    latitude: -13.1642,
    longitude: -74.2268,
    rating: 4.71,
    deliveryEstimateMin: 25,
    deliveryEstimateMax: 40,
  },
  {
    id: '53000000-0000-4000-8000-000000000003',
    name: 'Sabor Ayacuchano',
    description: 'Cocina tradicional ayacuchana preparada al momento con ingredientes locales.',
    category: MerchantCategory.RESTAURANT,
    ruc: '20600000003',
    phone: '+51966010003',
    email: 'sabor@delivereats.local',
    address: 'Jr. Bellido 388, Ayacucho',
    latitude: -13.1611,
    longitude: -74.2244,
    rating: 4.91,
    deliveryEstimateMin: 30,
    deliveryEstimateMax: 45,
  },
  {
    id: '54000000-0000-4000-8000-000000000004',
    name: 'Mercado Central Express',
    description: 'Mensajería urbana y entregas express dentro de Huamanga.',
    category: MerchantCategory.EXPRESS,
    ruc: '20600000004',
    phone: '+51966010004',
    email: 'express@delivereats.local',
    address: 'Portal Constitución 15, Ayacucho',
    latitude: -13.1605,
    longitude: -74.2252,
    rating: 4.68,
    deliveryEstimateMin: 15,
    deliveryEstimateMax: 25,
  },
] as const;

const catalog = [
  {
    categoryId: '61000000-0000-4000-8000-000000000001',
    productId: '71000000-0000-4000-8000-000000000001',
    merchantId: merchants[0].id,
    categoryName: 'Botiquín',
    name: 'Kit de Medicamentos Básico',
    description: 'Kit demostrativo de primeros auxilios y cuidado general.',
    price: 42,
    imageUrl: null,
  },
  {
    categoryId: '62000000-0000-4000-8000-000000000002',
    productId: '72000000-0000-4000-8000-000000000002',
    merchantId: merchants[1].id,
    categoryName: 'Packs',
    name: 'Compra de Víveres - Pack Familiar',
    description: 'Selección de arroz, menestras, aceite y productos esenciales.',
    price: 45,
    imageUrl: null,
  },
  {
    categoryId: '63000000-0000-4000-8000-000000000003',
    productId: '73000000-0000-4000-8000-000000000003',
    merchantId: merchants[2].id,
    categoryName: 'Tradicional',
    name: 'Pachamanca 2 personas',
    description: 'Pachamanca ayacuchana con carnes, papas, habas y humitas.',
    price: 68,
    imageUrl: null,
  },
  {
    categoryId: '63000000-0000-4000-8000-000000000003',
    productId: '73000000-0000-4000-8000-000000000004',
    merchantId: merchants[2].id,
    categoryName: 'Tradicional',
    name: 'Chicha de Jora',
    description: 'Bebida tradicional sin alcohol, botella de un litro.',
    price: 12,
    imageUrl: null,
  },
  {
    categoryId: '64000000-0000-4000-8000-000000000004',
    productId: '74000000-0000-4000-8000-000000000005',
    merchantId: merchants[3].id,
    categoryName: 'Mensajería',
    name: 'Envío Documento Legal',
    description: 'Recojo y entrega urbana de documentos en sobre sellado.',
    price: 18,
    imageUrl: null,
  },
] as const;

async function main() {
  for (const merchant of merchants) {
    await prisma.merchant.upsert({
      where: { id: merchant.id },
      update: { ...merchant, ownerUserId, isActive: true, isOpen: true },
      create: { ...merchant, ownerUserId, isActive: true, isOpen: true },
    });
  }
  for (const item of catalog) {
    await prisma.category.upsert({
      where: { id: item.categoryId },
      update: { name: item.categoryName },
      create: { id: item.categoryId, merchantId: item.merchantId, name: item.categoryName },
    });
    await prisma.product.upsert({
      where: { id: item.productId },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        isAvailable: true,
      },
      create: {
        id: item.productId,
        merchantId: item.merchantId,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
      },
    });
  }
  await prisma.promotion.upsert({
    where: { code: 'PDGP10' },
    update: { isActive: true },
    create: {
      id: '81000000-0000-4000-8000-000000000001',
      code: 'PDGP10',
      type: PromotionType.PERCENTAGE,
      value: 10,
      minimumAmount: 30,
      maximumDiscount: 25,
      startsAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date('2035-12-31T23:59:59Z'),
      usageLimit: 10000,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
