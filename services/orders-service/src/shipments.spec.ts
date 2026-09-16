import { beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { calculateShipment } from './shipments.service';
import { encryptCode, decryptCode } from './shipment-security';
import { type LogisticsConfig, Prisma } from './generated/prisma';
import type { ShipmentInputDto } from './shipments.dto';

const decimal = (value: number) => new Prisma.Decimal(value);
const config: LogisticsConfig = { vehicleType: 'MOTORCYCLE', version: 1, isActive: true, cashAllowed: true, updatedAt: new Date(), maxWeightKg: decimal(15), maxLengthCm: decimal(50), maxWidthCm: decimal(40), maxHeightCm: decimal(40), baseFee: decimal(4), perKmFee: decimal(1.2), perKgFee: decimal(0.2), perLiterFee: decimal(0.01), serviceFee: decimal(1), fragileFee: decimal(2), maxDistanceKm: decimal(20) };
const input: ShipmentInputDto = { pickupAddress: 'Punto A de prueba', pickupLatitude: -13.16, pickupLongitude: -74.22, dropoffAddress: 'Punto B de prueba', dropoffLatitude: -13.17, dropoffLongitude: -74.23, recipientName: 'Destinatario de prueba', packageCategory: 'DOCUMENTS', contentDescription: 'Documentos embalados de prueba', weightKg: 2, lengthCm: 20, widthCm: 20, heightCm: 20, declaredValue: 20, fragile: false, vehicleType: 'MOTORCYCLE' };
describe('shipment pricing and codes', () => {
  beforeEach(() => { process.env.SHIPMENT_CODES_KEY = randomBytes(32).toString('base64'); });
  it('derives the price and labels the distance approximation', () => {
    const quote = calculateShipment(input, config);
    expect(quote.distanceMetric).toBe('STRAIGHT_LINE');
    expect(quote.weight).toBe(0.4);
    expect(quote.volumeLiters).toBe(8);
    expect(quote.total).toBeCloseTo(quote.deliveryFee + quote.serviceFee, 2);
  });
  it('applies only the configured fragile surcharge', () => expect(calculateShipment({ ...input, fragile: true }, config).total - calculateShipment(input, config).total).toBeCloseTo(2, 2));
  it('rejects overweight and oversized packages', () => {
    expect(() => calculateShipment({ ...input, weightKg: 16 }, config)).toThrow('capacidad');
    expect(() => calculateShipment({ ...input, lengthCm: 60 }, config)).toThrow('capacidad');
  });
  it('allows orientation changes that fit the configured box', () => expect(calculateShipment({ ...input, widthCm: 50, lengthCm: 40 }, config).total).toBeGreaterThan(0));
  it('rejects distances outside coverage', () => expect(() => calculateShipment({ ...input, dropoffLatitude: 0 }, config)).toThrow('cobertura'));
  it('encrypts codes nondeterministically and authenticates ciphertext', () => {
    const first = encryptCode('123456'); const second = encryptCode('123456');
    expect(first).not.toBe(second); expect(first).not.toContain('123456'); expect(decryptCode(first)).toBe('123456');
    const parts = first.split('.'); parts[2] = randomBytes(6).toString('base64url');
    expect(() => decryptCode(parts.join('.'))).toThrow();
  });
  it('fails closed without the encryption key', () => { delete process.env.SHIPMENT_CODES_KEY; expect(() => encryptCode('123456')).toThrow('SHIPMENT_CODES_KEY'); });
});
