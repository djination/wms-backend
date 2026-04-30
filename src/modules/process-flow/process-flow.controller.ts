import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateInternalTransferDto } from './dto/create-internal-transfer.dto';
import { CreateMaterialTransformationDto } from './dto/create-material-transformation.dto';
import { CreateProcessRecipeDto } from './dto/create-process-recipe.dto';
import { CreateTransformationFromRecipeDto } from './dto/create-transformation-from-recipe.dto';
import { ProcessGenealogyQueryDto } from './dto/process-genealogy-query.dto';
import { UpdateProcessRecipeDto } from './dto/update-process-recipe.dto';
import { ProcessFlowService } from './process-flow.service';

@ApiTags('process-flow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('process-flow')
export class ProcessFlowController {
  constructor(private readonly service: ProcessFlowService) {}

  @Get('transfers')
  @ApiOperation({ summary: 'List internal transfer orders' })
  listTransfers(@CurrentUser() user: JwtPayload) {
    return this.service.listTransfers(user);
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Create internal transfer order (draft)' })
  createTransfer(@Body() dto: CreateInternalTransferDto, @CurrentUser() user: JwtPayload) {
    return this.service.createTransfer(dto, user);
  }

  @Patch('transfers/:id/complete')
  @ApiOperation({ summary: 'Complete internal transfer and move stock' })
  completeTransfer(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.completeTransfer(id, user);
  }

  @Get('transformations')
  @ApiOperation({ summary: 'List material transformations' })
  listTransformations(@CurrentUser() user: JwtPayload) {
    return this.service.listTransformations(user);
  }

  @Get('events')
  @ApiOperation({ summary: 'List process flow event logs' })
  listEvents(@CurrentUser() user: JwtPayload, @Query('processType') processType?: string) {
    return this.service.listEvents(user, processType);
  }

  @Get('genealogy')
  @ApiOperation({ summary: 'Trace transformation genealogy by output lot/batch or transformation ID' })
  genealogy(@CurrentUser() user: JwtPayload, @Query() query: ProcessGenealogyQueryDto) {
    return this.service.genealogy(user, query);
  }

  @Get('billing-summary')
  @ApiOperation({ summary: 'Get process flow billing summary' })
  billingSummary(@CurrentUser() user: JwtPayload) {
    return this.service.billingSummary(user);
  }

  @Post('billing/post-drafts')
  @ApiOperation({ summary: 'Post (finalize) draft billing transactions for process flow activities in scope' })
  postDraftBilling(@CurrentUser() user: JwtPayload) {
    return this.service.postDraftProcessFlowBilling(user);
  }

  @Post('transformations')
  @ApiOperation({ summary: 'Create material transformation order (draft)' })
  createTransformation(@Body() dto: CreateMaterialTransformationDto, @CurrentUser() user: JwtPayload) {
    return this.service.createTransformation(dto, user);
  }

  @Patch('transformations/:id/complete')
  @ApiOperation({ summary: 'Complete material transformation (consume -> output)' })
  completeTransformation(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.completeTransformation(id, user);
  }

  @Get('recipes')
  @ApiOperation({ summary: 'List process recipes (BOM)' })
  listRecipes(@CurrentUser() user: JwtPayload) {
    return this.service.listRecipes(user);
  }

  @Post('recipes')
  @ApiOperation({ summary: 'Create process recipe (BOM)' })
  createRecipe(@Body() dto: CreateProcessRecipeDto, @CurrentUser() user: JwtPayload) {
    return this.service.createRecipe(dto, user);
  }

  @Patch('recipes/:id')
  @ApiOperation({ summary: 'Update process recipe (including lines and active flag)' })
  updateRecipe(@Param('id') id: string, @Body() dto: UpdateProcessRecipeDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateRecipe(id, dto, user);
  }

  @Post('transformations/from-recipe')
  @ApiOperation({ summary: 'Create draft transformation from recipe (auto input qty by output target)' })
  createTransformationFromRecipe(@Body() dto: CreateTransformationFromRecipeDto, @CurrentUser() user: JwtPayload) {
    return this.service.createTransformationFromRecipe(dto, user);
  }
}
