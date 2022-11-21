import { Logger } from '@skeldjs/hindenburg';
import mariadb, { SqlError } from 'mariadb';

export class DbConnection {
    private pool: mariadb.Pool
    private logger: Logger

    constructor(database: string, user: string, password: string, host: string, port: number, logger: Logger) {
        this.logger = logger;
        this.pool = mariadb.createPool({
            host: host,
            user: user,
            database: database,
            password: password,
            port: port,
            connectionLimit: 1
        });
        this.logger.info("[DB] DATABASE CONNECTED")

    }

    async query(query: string) {
        let conn;
        try {
            conn = await this.pool.getConnection();
            const result = await conn.query(query);
            return result;
        } catch (error: any) {
            this.logger.error("[DB] SQL ERROR")
            this.logger.error(error)
        }
        finally {
            if (conn) conn.release();
        }        
    }
}