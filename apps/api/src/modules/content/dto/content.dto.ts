import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  IsBoolean,
  IsArray,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContentDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsIn(['article', 'video', 'infographic'])
  type?: string = 'article';

  @IsString()
  @IsIn([
    'getting_started',
    'investment_basics',
    'real_estate_101',
    'dao_blockchain',
    'market_insights',
    'advanced_strategies',
  ])
  category: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  difficulty?: string = 'beginner';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  readTime?: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsIn(['article', 'video', 'infographic'])
  type?: string;

  @IsOptional()
  @IsIn([
    'getting_started',
    'investment_basics',
    'real_estate_101',
    'dao_blockchain',
    'market_insights',
    'advanced_strategies',
  ])
  category?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  difficulty?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  readTime?: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class QueryContentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 12;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn([
    'getting_started',
    'investment_basics',
    'real_estate_101',
    'dao_blockchain',
    'market_insights',
    'advanced_strategies',
  ])
  category?: string;

  @IsOptional()
  @IsIn(['article', 'video', 'infographic'])
  type?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  difficulty?: string;
}
