import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Version,
} from '@nestjs/common';
import { MenuItemOptionsService } from './menu.item.options.service';
import { CreateMenuItemOptionDto } from './dto/create-menu.item.option.dto';
import { UpdateMenuItemOptionDto } from './dto/update-menu.item.option.dto';

@Controller('menu-item-options')
export class MenuItemOptionsController {
  constructor(
    private readonly menuItemOptionsService: MenuItemOptionsService,
  ) {}

  @Version('1')
  @Post()
  create(@Body() createMenuItemOptionDto: CreateMenuItemOptionDto) {
    return this.menuItemOptionsService.create(createMenuItemOptionDto);
  }

  @Version('1')
  @Get()
  findAll() {
    return this.menuItemOptionsService.findAll();
  }

  @Version('1')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.menuItemOptionsService.findOne(+id);
  }

  @Version('1')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMenuItemOptionDto: UpdateMenuItemOptionDto,
  ) {
    return this.menuItemOptionsService.update(+id, updateMenuItemOptionDto);
  }

  @Version('1')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menuItemOptionsService.remove(+id);
  }
}
