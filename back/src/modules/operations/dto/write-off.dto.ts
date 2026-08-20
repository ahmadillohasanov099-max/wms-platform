import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Cross-field class-level validator:
 * Either assetId (for BERILADIGAN) OR (productId + quantity) must be provided.
 */
function EitherAssetOrProduct(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'EitherAssetOrProduct',
      target: (object as any).constructor,
      propertyName,
      options: {
        message:
          'assetId (BERILADIGAN uchun) yoki productId + quantity (SARFLANADIGAN uchun) berish majburiy',
        ...validationOptions,
      },
      validator: {
        validate(_value: any, args: ValidationArguments) {
          const obj = args.object as WriteOffDto;
          const hasAsset = !!obj.assetId;
          const hasProduct =
            !!obj.productId && obj.quantity !== undefined && obj.quantity >= 1;
          return hasAsset || hasProduct;
        },
      },
    });
  };
}

export class WriteOffDto {
  @ApiPropertyOptional({
    example: 'uuid',
    description: 'BERILADIGAN uchun asset ID',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'SARFLANADIGAN uchun product ID',
  })
  @IsOptional()
  @IsUUID()
  @ValidateIf((o: WriteOffDto) => !o.assetId)
  productId?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'SARFLANADIGAN uchun miqdor',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @ValidateIf((o: WriteOffDto) => !o.assetId)
  quantity?: number;

  @ApiPropertyOptional({
    example: 'uuid',
    description: "Bo'limdan hisobdan chiqarish uchun bo'lim ID",
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'AKT-2024-010' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'Eskirgan' })
  @IsOptional()
  @IsString()
  note?: string;

  @EitherAssetOrProduct()
  private _crossFieldValidation?: undefined;
}
