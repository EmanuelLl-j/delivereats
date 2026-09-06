import { Injectable } from '@nestjs/common';
import { haversineKm } from '@delivereats/shared-utils';

export type Coordinates = { latitude: number; longitude: number };

export interface MapsProvider {
  calculateDistance(origin: Coordinates, destination: Coordinates): Promise<number>;
  calculateETA(origin: Coordinates, destination: Coordinates): Promise<number>;
  getRoute(origin: Coordinates, destination: Coordinates): Promise<Coordinates[]>;
}

@Injectable()
export class MapsService implements MapsProvider {
  async calculateDistance(origin: Coordinates, destination: Coordinates): Promise<number> {
    return haversineKm(origin, destination);
  }

  async calculateETA(origin: Coordinates, destination: Coordinates): Promise<number> {
    const distance = await this.calculateDistance(origin, destination);
    return Math.max(5, Math.ceil((distance / 22) * 60));
  }

  async getRoute(origin: Coordinates, destination: Coordinates): Promise<Coordinates[]> {
    return [origin, destination];
  }
}
