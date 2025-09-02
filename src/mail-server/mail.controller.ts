import { Controller, Get } from '@nestjs/common';
import { MailService } from './mail.service';
import { Public } from '@/auth/decorators/public.decorator';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) { }

  @Public()
  @Get('send-test')
  async sendTestEmail() {
    return this.mailService.sendTestEmail();
  }

}
