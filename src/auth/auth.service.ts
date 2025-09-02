import { UsersService } from '@/modules/users/users.service';
import { comparePasswordUtils } from '@/utils/hash';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createAuthDto } from './dto/create-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(username);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const isValidPassword = await comparePasswordUtils(pass, user.password);

    if (!user || !isValidPassword) {
      return null;
    }
    return user;
  }

  async login(user: any) {
    const payload = { username: user.email, sub: user._id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(register: createAuthDto) {
    return this.usersService.handleRegister(register);
  }
}
