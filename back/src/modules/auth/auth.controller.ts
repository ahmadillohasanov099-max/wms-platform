import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Tizimga kirish' })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Token yangilash' })
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  refresh(@Req() req: any) {
    const user = req.user;
    return this.authService.refresh(user.sub, user.refreshTokenId);
  }

  @ApiOperation({ summary: 'Tizimdan chiqish' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('logout')
  logout(@Req() req: any) {
    return this.authService.logout(req.user.sub, req.user.refreshTokenId);
  }

  @ApiOperation({ summary: 'Mening profilim' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: any) {
    return user;
  }

  @ApiOperation({ summary: 'Parolni ozgartirish' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  @ApiOperation({ summary: 'Parolni tekshirish' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('verify-password')
  verifyPassword(@CurrentUser() user: any, @Body('password') password?: string) {
    return this.authService.verifyPassword(user.id, password);
  }
}
