import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService
  ) { }

  async sendEmail(email: string, name: string, code: string) {
    this.mailerService
      .sendMail({
        to: email,
        subject: 'Activate your account',
        template: 'register',
        context: {
          name: name,
          activationCode: code,
        },
      })
      .then(() => { })
      .catch(() => { });
    return "Sent email successfully";
  }
}
