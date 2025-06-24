import Database from 'better-sqlite3';

export interface TestDatabase extends Database.Database {
  schema: {
    hasTable(tableName: string): Promise<boolean>;
    getColumns(tableName: string): Promise<string[]>;
    getPrimaryKey(tableName: string): Promise<string[]>;
    getForeignKeys(tableName: string): Promise<Array<{
      sourceColumn: string;
      targetTable: string;
      targetColumn: string;
    }>>;
    getIndexes(tableName: string): Promise<Array<{
      name: string;
      columns: string[];
    }>>;
  };
}

export class TestDatabaseFactory {
  static async createTestDatabase(): Promise<TestDatabase> {
    const db = new Database(':memory:') as TestDatabase;
    
    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');
    
    // Add schema helper methods
    db.schema = {
      async hasTable(tableName: string): Promise<boolean> {
        const result = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `).get(tableName);
        return !!result;
      },

      async getColumns(tableName: string): Promise<string[]> {
        const pragmaResult = db.pragma(`table_info(${tableName})`);
        return pragmaResult.map((row: any) => row.name);
      },

      async getPrimaryKey(tableName: string): Promise<string[]> {
        const pragmaResult = db.pragma(`table_info(${tableName})`);
        const pkColumns = pragmaResult
          .filter((row: any) => row.pk > 0)
          .sort((a: any, b: any) => a.pk - b.pk)
          .map((row: any) => row.name);
        return pkColumns;
      },

      async getForeignKeys(tableName: string): Promise<Array<{
        sourceColumn: string;
        targetTable: string;
        targetColumn: string;
      }>> {
        const pragmaResult = db.pragma(`foreign_key_list(${tableName})`);
        return pragmaResult.map((row: any) => ({
          sourceColumn: row.from,
          targetTable: row.table,
          targetColumn: row.to
        }));
      },

      async getIndexes(tableName: string): Promise<Array<{
        name: string;
        columns: string[];
      }>> {
        const indexes = db.prepare(`
          SELECT name, sql FROM sqlite_master 
          WHERE type='index' AND tbl_name=? AND name NOT LIKE 'sqlite_%'
        `).all(tableName);
        
        return indexes.map((index: any) => {
          // Extract columns from index SQL
          const match = index.sql?.match(/\((.*?)\)/);
          const columnsStr = match ? match[1] : '';
          const columns = columnsStr.split(',').map((col: string) => col.trim().replace(/['"]/g, ''));
          
          return {
            name: index.name,
            columns: columns.filter((col: string) => col.length > 0)
          };
        });
      }
    };

    return db;
  }

  static async cleanup(db: TestDatabase): Promise<void> {
    if (db && typeof db.close === 'function') {
      db.close();
    }
  }
}