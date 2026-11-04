import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RegistrationService } from './registration.service';
import {
  renderRegisterPage,
  renderRegisterSuccess,
  renderRegisterError,
} from './registration-page.renderer';

@Controller('register')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Get()
  view(@Query('phone') phone: string, @Res() res: Response) {
    const prefilled = phone ? String(phone).replace(/[^0-9]/g, '') : '';
    return res.type('html').send(renderRegisterPage(prefilled));
  }

  @Post()
  async submit(@Body() body: any, @Res() res: Response) {
    try {
      const result = await this.registrationService.register({
        fullName: String(body.fullName ?? ''),
        phone: String(body.phone ?? ''),
        email: body.email ? String(body.email) : undefined,
        identityType: String(body.identityType ?? '') as 'NIN' | 'BVN',
        identityNumber: String(body.identityNumber ?? ''),
        pin: String(body.pin ?? ''),
        pinConfirm: String(body.pinConfirm ?? body.pin ?? ''),
      });

      return res.type('html').send(renderRegisterSuccess(result.accountReference));
    } catch (err: any) {
      const known =
        err instanceof BadRequestException || err instanceof ConflictException;
      const message = known
        ? err.message
        : 'Registration failed. Please try again.';
      return res.status(400).type('html').send(renderRegisterError(message));
    }
  }
}
