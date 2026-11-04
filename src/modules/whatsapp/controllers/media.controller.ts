import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { NETWORK_LOGO_BASE64 } from '../assets/network-logos.embedded';

const ALLOWED_FILES = new Set([
  'data-network-banner.png',
  'mtn.png',
  'airtel.png',
  'glo.png',
  '9mobile.png',
  'data-mtn.png',
  'data-airtel.png',
  'data-glo.png',
  'data-9mobile.png',
]);

function fileToKey(file: string): string {
  let key = file.replace(/\.png$/, '').replace(/-/g, '_');
  if (/^[0-9]/.test(key)) key = `n_${key}`;
  return key;
}

@Controller('media/networks')
export class MediaController {
  @Get(':file')
  serve(@Param('file') file: string, @Res() res: Response) {
    const safeName = file.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!ALLOWED_FILES.has(safeName) || !safeName.endsWith('.png')) {
      throw new NotFoundException('Media not found');
    }

    const b64 = NETWORK_LOGO_BASE64[fileToKey(safeName)];
    if (!b64) {
      throw new NotFoundException('Media not found');
    }

    const buf = Buffer.from(b64, 'base64');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  }
}
