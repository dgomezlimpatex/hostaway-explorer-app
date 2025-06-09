
import { Property, CreatePropertyData } from '@/types/property';

class PropertyStorage {
  private storageKey = 'cleaning-properties';

  private getProperties(): Property[] {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? JSON.parse(stored) : [];
  }

  private saveProperties(properties: Property[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(properties));
  }

  getAll(): Property[] {
    return this.getProperties();
  }

  getById(id: string): Property | null {
    const properties = this.getProperties();
    return properties.find(property => property.id === id) || null;
  }

  getByClientId(clienteId: string): Property[] {
    const properties = this.getProperties();
    return properties.filter(property => property.clienteId === clienteId);
  }

  create(propertyData: CreatePropertyData): Property {
    const properties = this.getProperties();
    const newProperty: Property = {
      ...propertyData,
      id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    };

    properties.push(newProperty);
    this.saveProperties(properties);
    return newProperty;
  }

  update(id: string, updates: Partial<CreatePropertyData>): Property | null {
    const properties = this.getProperties();
    const index = properties.findIndex(property => property.id === id);
    
    if (index === -1) return null;

    properties[index] = {
      ...properties[index],
      ...updates,
      fechaActualizacion: new Date().toISOString(),
    };

    this.saveProperties(properties);
    return properties[index];
  }

  delete(id: string): boolean {
    const properties = this.getProperties();
    const filtered = properties.filter(property => property.id !== id);
    
    if (filtered.length === properties.length) return false;
    
    this.saveProperties(filtered);
    return true;
  }
}

export const propertyStorage = new PropertyStorage();
