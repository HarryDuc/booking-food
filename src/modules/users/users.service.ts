import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import mongoose, { Model } from 'mongoose';
import { hashPasswordUtils } from '@/utils/hash';
import aqp from 'packages/api-query-params/params';
import { createAuthDto } from '@/auth/dto/create-auth.dto';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async isEmailTaken(email: string): Promise<boolean> {
    const user = await this.userModel.exists({ email }).exec();
    return !!user;
  }

  async create(createUserDto: CreateUserDto) {
    try {
      const { name, email, password, phone, address, image } = createUserDto;
      const isEmailTaken = await this.isEmailTaken(email);
      if (isEmailTaken) {
        throw new BadRequestException('Email is already taken');
      }
      const hashedPassword = await hashPasswordUtils(password);
      const createdUser = await this.userModel.create({
        name,
        email,
        password: hashedPassword,
        phone,
        address,
        image,
      });
      return createdUser;
    } catch (error) {
      throw error;
    }
  }

  async findAll(query: string) {
    const { filter, limit, skip, sort } = aqp(query);
    if (!limit || limit < 1) {
      throw new BadRequestException('Limit must be greater than 0');
    }
    if (!skip || skip < 1) {
      throw new BadRequestException('Skip must be greater than 0');
    }
    const totalItems = await this.userModel.countDocuments(filter || {}).exec();
    const totalPages = limit ? Math.ceil(totalItems / limit) : 1;
    const skipItems = (skip - 1) * limit || 0;

    const results = await this.userModel
      .find(filter as any)
      .limit(limit as any)
      .skip(skipItems as any)
      .sort(sort as any)
      .select('-password')
      .exec();

    return {
      data: results,
      meta: { totalItems, totalPages, currentPage: skip, itemsPerPage: limit },
    };
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email }).exec();
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-password')
      .exec();
  }

  async remove(id: string) {
    if (mongoose.isValidObjectId(id)) {
      return await this.userModel.findByIdAndDelete(id).exec();
    } else {
      throw new BadRequestException('Invalid user ID');
    }
  }

  async handleRegister(register: createAuthDto) {
    try {
      const { name, email, password, } = register;
      const isEmailTaken = await this.isEmailTaken(email);
      if (isEmailTaken) {
        throw new BadRequestException('Email is already taken');
      }
      const hashedPassword = await hashPasswordUtils(password);
      const createdUser = await this.userModel.create({
        name,
        email,
        password: hashedPassword,
        isActive: false,
        codeId: uuidv4(),
        codeExpired: dayjs().add(1, 'minutes').toDate(),
      });
      return createdUser;
    } catch (error) {
      throw error;
    }
  }
}
