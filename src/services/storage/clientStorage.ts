
import { Client, CreateClientData } from '@/types/client';
import { BaseStorageService } from './baseStorage';
import { mapClientFromDB, mapClientToDB } from './mappers/clientMappers';

class ClientStorageService extends BaseStorageService<Client, CreateClientData> {
  constructor() {
    super({
      tableName: 'clients',
      mapFromDB: mapClientFromDB,
      mapToDB: mapClientToDB
    });
  }

  async getAll(): Promise<Client[]> {
    return super.getAll({ column: 'created_at', ascending: false });
  }
}

export const clientStorage = new ClientStorageService();
