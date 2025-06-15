import { Multer } from 'multer';

declare global {
  namespace Express {
    export interface Request {
      files?: {
        [fieldname: string]: Multer.File[];
      } & {
        [fieldname: string]: undefined;
      };
    }
  }
}

export {};
