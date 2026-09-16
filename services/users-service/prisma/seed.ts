import { LegalDocumentType, PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();
// Operational drafts only. Never creates accounts, credentials, addresses or acceptances.
const titles: Record<LegalDocumentType, string> = {
  GENERAL_TERMS: 'Términos generales del servicio', PRIVACY_POLICY: 'Política de privacidad',
  SHIPPING_TERMS: 'Condiciones de envíos personales', PROHIBITED_ITEMS_POLICY: 'Política de artículos prohibidos y restringidos',
  DRIVER_TERMS: 'Condiciones para repartidores', MERCHANT_TERMS: 'Condiciones para comercios',
};
async function main() {
  for (const type of Object.values(LegalDocumentType)) {
    await prisma.legalDocument.upsert({
      where: { type_version: { type, version: 'draft-1' } }, update: {},
      create: { type, title: titles[type], version: 'draft-1', status: 'DRAFT', mandatory: true,
        content: `[REVISIÓN JURÍDICA PENDIENTE]\n${titles[type]}\n\nEste borrador no está publicado ni constituye asesoría legal. Completar con asesoría peruana: identidad y domicilio del operador, alcance del servicio, derechos y obligaciones, tarifas y devoluciones, responsabilidades, atención de reclamos, vigencia y canales de contacto.\n\nPara privacidad: responsables, finalidades y base de tratamiento, consentimiento opcional, destinatarios, transferencias, seguridad, plazos de conservación y ejercicio de derechos. Para envíos: categorías y capacidades autorizadas, declaración de contenido, aceptación versionada, revisión de restringidos, exclusión de prohibidos, evidencias y procedimiento de incidencias.\n\nSustituir íntegramente antes de publicar.` },
    });
  }
  process.stdout.write('Borradores legales preparados. No se crearon cuentas.\n');
}
main().catch(() => { process.stderr.write('No se pudieron preparar los borradores legales.\n'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
