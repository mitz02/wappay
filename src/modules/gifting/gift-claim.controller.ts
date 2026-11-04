import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GiftService } from './gift.service';
import {
  renderGiftPage,
  renderNotFoundPage,
} from './gift-page.renderer';

@Controller('gift')
export class GiftClaimController {
  constructor(private readonly giftService: GiftService) {}

  @Get(':token')
  view(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const gift = this.giftService.verifyToken(token);
    if (!gift) {
      return res.status(404).type('html').send(renderNotFoundPage());
    }

    const cookieClaimed = (req.headers.cookie || '').includes(
      `wappay_gift_${gift.id}=claimed`,
    );
    const claimed = this.giftService.isClaimed(gift.id) || cookieClaimed;

    return res.type('html').send(renderGiftPage(token, gift, claimed));
  }

  @Post(':token/claim')
  claim(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const gift = this.giftService.verifyToken(token);
    if (!gift) {
      return res.status(404).type('html').send(renderNotFoundPage());
    }

    const cookieClaimed = (req.headers.cookie || '').includes(
      `wappay_gift_${gift.id}=claimed`,
    );
    if (this.giftService.isClaimed(gift.id) || cookieClaimed) {
      return res.type('html').send(renderGiftPage(token, gift, true));
    }

    this.giftService.claim(gift.id);
    res.setHeader(
      'Set-Cookie',
      `wappay_gift_${gift.id}=claimed; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`,
    );
    return res.type('html').send(renderGiftPage(token, gift, true));
  }
}
