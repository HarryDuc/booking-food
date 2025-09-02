import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService
  ) { }

  async sendTestEmail() {
    this.mailerService
      .sendMail({
        to: 'vuminhduc.contact@gmail.com', // list of receivers
        subject: 'Testing Nest MailerModule ✔', // Subject line
        text: 'welcome', // plaintext body
        html: '<b>welcome</b>', // HTML body content
      })
      .then(() => {})
      .catch(() => {});
      return "Sent email successfully";
  }
}
