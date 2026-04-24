import { PartialType } from '@nestjs/swagger';
import { CreateBillingTransactionDto } from './create-billing-transaction.dto';

export class UpdateBillingTransactionDto extends PartialType(CreateBillingTransactionDto) {}
