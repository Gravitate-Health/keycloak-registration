import {inject} from '@loopback/core';
import {post, Request, Response, RestBindings} from '@loopback/rest';

import { AxiosError } from 'axios';
import KeycloakController from '../providers/keycloak.provider';
import Logger from '../services/logger.provider';

export class ResetPasswordController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @inject(RestBindings.Http.RESPONSE) private response: Response,
  ) {}

  keycloakController = new KeycloakController();


  processAxiosError = (error: AxiosError, response?: any) => {
    let statusCode = null;
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      let errorMessage = error.response.data.errorMessage;
      let errorData = error.response.data.error;
      let errorStatusCode = error.response.status;
      let errorUrl = error.config.url;
      try {
        Logger.log(
          `[Process Axios Error] Error Details: ${error.response.data.error.details}`,
        );
      } catch (error) {}
      if (errorUrl) Logger.log(`[Process Axios Error] Error URL: ${errorUrl}`);
      if (errorMessage)
        Logger.log(`[Process Axios Error] Error Message: ${errorMessage}`);
      if (errorData)
        Logger.log(
          `[Process Axios Error] Error data: ${JSON.stringify(errorData)}`,
        );
      if (errorStatusCode)
        Logger.log(
          `[Process Axios Error] Error status code: ${errorStatusCode}`,
        );

      let message;
      switch (error.response.status) {
        case 409:
          message = 'User exists with same email';
          break;
        case 404:
          message = 'Service unavailable';
          statusCode = 503;
          break;
        case 422:
          message = 'Unprocessable entity. Send correct body in petition';
          break;
        case 503:
          message = 'Service unavailable';
          break;
        default:
          break;
      }
      if (!response) {
        response = {};
      }
      response.message = message;
      response.reason = errorMessage;
      this.response.status(statusCode || error.response.status).send(response);
    } else {
      Logger.log(JSON.stringify(error));
      this.response
        .status(500)
        .send(
          this.generateErrorResponse(
            'Internal Error registering the user.',
            error.message,
          ),
        );
    }
  };
  
  generateErrorResponse = (
    message: any = 'There was an error creating the user.',
    reason: any = 'unknown',
  ) => {
    return {
      created: false,
      message: message,
      reason: reason,
    };
  };

  authenticateService = async () => {
    try {
      await this.keycloakController.getToken();
    } catch (error) {
      Logger.log('[Get ServiceUser Token] Error');
      this.processAxiosError(error);
      return this.response;
    }
  };

  @post('/reset-password')
  async resetPassword() {
    Logger.log('------------------[POST]-------------------------');
    Logger.log('[POST] reset-password');

    await this.authenticateService()

    const email = this.req.query.email as string;
    if (!email || email == undefined) {
      this.response.status(400).send('Provide email in query parameter');
      return;
    }

    try {
      await this.keycloakController.resetPassword(email);
    } catch (error) {
      Logger.log('[Reset Password] Error resetting password');
      Logger.log(JSON.stringify(error));
    }
    return this.response.status(204).send();
  }
}
