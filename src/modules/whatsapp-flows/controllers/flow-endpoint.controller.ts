import { Controller, Post, Body, Res, Headers, Logger, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { FlowEncryptionService, DecryptedFlowRequest } from '../services/flow-encryption.service';
import { FlowSessionService } from '../services/flow-session.service';
import { RegistrationFlowHandler } from '../handlers/registration-flow.handler';
import { DepositFlowHandler } from '../handlers/deposit-flow.handler';

@Controller('flows')
export class FlowEndpointController {
  private readonly logger = new Logger(FlowEndpointController.name);

  constructor(
    private readonly encryption: FlowEncryptionService,
    private readonly sessionService: FlowSessionService,
    private readonly registrationHandler: RegistrationFlowHandler,
    private readonly depositHandler: DepositFlowHandler,
  ) {}

  @Post('data')
  async handleDataExchange(
    @Body() body: any,
    @Res() res: Response,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    try {
      const request = this.encryption.decryptRequest(body);

      this.logger.debug(
        `Flow request: action=${request.action} screen=${request.screen} token=${request.flow_token}`,
      );

      if (request.action === 'ping') {
        return this.respond(res, { version: '3.0' });
      }

      if (!request.flow_token) {
        throw new BadRequestException('Missing flow_token');
      }

      const session = await this.sessionService.getSession(request.flow_token);

      let response: Record<string, any>;

      if (session.flowType === 'REGISTRATION') {
        response = await this.registrationHandler.handleFlowRequest(
          request,
          session,
        );
      } else if (session.flowType === 'DEPOSIT') {
        response = await this.depositHandler.handleFlowRequest(request, session);
      } else {
        throw new BadRequestException('Unknown flow type');
      }

      if (response.screen === 'SUCCESS' || response.__complete) {
        await this.sessionService.completeSession(request.flow_token);
        delete response.__complete;
      }

      return this.respond(res, response);
    } catch (err: any) {
      this.logger.error(`Flow endpoint error: ${err.message}`, err.stack);

      if (err.message?.includes('not found') || err.message?.includes('expired')) {
        return res.status(427).json({ error: 'Invalid flow_token' });
      }

      // Return error on current screen
      const errorResponse = {
        version: '3.0',
        screen: body?.screen || 'ERROR',
        data: { error_message: 'Something went wrong. Please try again.' },
      };
      return this.respond(res, errorResponse);
    }
  }

  private respond(res: Response, payload: Record<string, any>) {
    const encrypted = this.encryption.encryptResponse({
      version: '3.0',
      ...payload,
    });
    res.setHeader('Content-Type', encrypted.contentType);
    return res.status(200).send(encrypted.body);
  }
}
