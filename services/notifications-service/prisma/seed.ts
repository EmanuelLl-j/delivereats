import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PrismaClient,
} from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.upsert({
    where: { eventId: 'demo-welcome-event' },
    update: {},
    create: {
      userId: '11111111-1111-4111-8111-111111111111',
      type: NotificationType.PROMOTION,
      channel: NotificationChannel.IN_APP,
      title: '¡Bienvenida a DeliverEats!',
      message: 'Usa el cupón PDGP10 en tu primer carrito multi-negocio.',
      status: NotificationStatus.SENT,
      eventId: 'demo-welcome-event',
      sentAt: new Date(),
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
