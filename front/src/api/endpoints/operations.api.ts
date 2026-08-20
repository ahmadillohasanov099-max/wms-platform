import type { GiveToDeptDto, GiveToUserDto, ReturnFromDeptDto, ReturnFromUserDto, StockInDto, TransferUserDto, WriteOffDto, AssignToDeptDto } from '../../types';
import api from '../axios';
export const operationsApi = {
  stockIn: (dto: StockInDto) =>
    api.post('/operations/stock-in', dto).then((r) => r.data),
  giveToUser: (dto: GiveToUserDto) =>
    api.post('/operations/give-to-user', dto).then((r) => r.data),
  returnFromUser: (dto: ReturnFromUserDto) =>
    api.post('/operations/return-from-user', dto).then((r) => r.data),
  transferUser: (dto: TransferUserDto) =>
    api.post('/operations/transfer-user', dto).then((r) => r.data),
  giveToDept: (dto: GiveToDeptDto) =>
    api.post('/operations/give-to-dept', dto).then((r) => r.data),
  assignToDept: (dto: AssignToDeptDto) =>
    api.post('/operations/assign-to-dept', dto).then((r) => r.data),
  returnFromDept: (dto: ReturnFromDeptDto) =>
    api.post('/operations/return-from-dept', dto).then((r) => r.data),
  writeOff: (dto: WriteOffDto) =>
    api.post('/operations/write-off', dto).then((r) => r.data),
  bulkWriteOff: (dto: any) =>
    api.post('/operations/bulk-write-off', dto).then((r) => r.data),
};