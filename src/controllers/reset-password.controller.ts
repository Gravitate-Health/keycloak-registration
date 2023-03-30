import {inject} from '@loopback/core';
import {post, Request, Response, RestBindings} from '@loopback/rest';

import {AxiosError} from 'axios';
import KeycloakController from '../providers/keycloak.provider';
import Logger from '../services/logger.services';
import { LogLevel } from '../services/types';
import ResponseError from '../error/ResponseError';

export class ResetPasswordController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @inject(RestBindings.Http.RESPONSE) private response: Response,
  ) {}
  
  keycloakBaseUrl =
    process.env.KEYCLOAK_BASE_PATH ?? 'https://fosps.gravitatehealth.eu';

  keycloakController = new KeycloakController(this.keycloakBaseUrl);

  sendErrorResponse = (error: ResponseError) => {
    console.log(JSON.stringify(error));
    return this.response.status(error.statusCode || 500).send(error.body);
  };


  @post('/reset-password')
  async resetPassword() {
    Logger.log(LogLevel.INFO,'------------------[POST /reset-password]-------------------------');

    //await this.authenticateService();

    const email = this.req.query.email as string;
    if (!email || email == undefined) {
      this.response.status(400).send('Provide email in query parameter');
      return;
    }
    try {
      await this.keycloakController.resetPassword(email);
    } catch (error) {
      Logger.log(LogLevel.ERROR,'[Reset Password] Error resetting password');
      Logger.log(LogLevel.ERROR,JSON.stringify(error));
      this.sendErrorResponse(error);
      return;
    }
    return this.response.status(204).send();
  }

  @post('/verification-email')
  async sendVerificationEmail() {
    Logger.log(LogLevel.INFO,'------------------[POST /verification-email]-------------------------');

    const email = this.req.query.email as string;
    if (!email || email == undefined) {
      return this.response.status(400).send('Provide email in query parameter');
    }
    let isSent, user;
    try {
      user = await this.keycloakController.getKeycloakUserByEmail(email);
      if(user) {
        let userId = user.id;
        isSent = await this.keycloakController.sendVerificationEmail(userId);
      }
    } catch (error) {
      Logger.log(LogLevel.ERROR,'[Verification Email] Error sending verification email');
      Logger.log(LogLevel.ERROR,JSON.stringify(error));
      this.sendErrorResponse(error);
      return;
    }
    if (isSent) {
      return this.response.status(200).send({
        message: 'OK',
      });
    } else {
      return this.response.status(400).send({
        message: 'This email is already verified',
      });
    }
  }
}
