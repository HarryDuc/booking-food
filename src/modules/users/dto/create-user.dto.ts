import { IsEmail, IsEmpty, IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsNotEmpty()
  password: string;

  @IsEmpty()
  phone: string;

  @IsEmpty()
  address: string;

  @IsEmpty()
  image: string;
}
