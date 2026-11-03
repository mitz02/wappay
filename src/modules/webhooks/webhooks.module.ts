/**
 * WebhooksModule — DEPRECATED
 *
 * The WhatsApp webhook handling has been migrated to WhatsAppModule
 * (src/modules/whatsapp/whatsapp.module.ts).
 *
 * This module is retained as an empty placeholder to avoid import churn in
 * any external references. It does not register any routes or providers.
 *
 * TODO: Remove this module entirely in a future cleanup pass once all
 *       import references have been confirmed absent.
 */
import { Module } from '@nestjs/common';

@Module({})
export class WebhooksModule {}
