/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */

import {inject} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {
  del,
  get,
  param,
  patch,
  post,
  Request,
  requestBody,
  response,
  Response,
  RestBindings,
} from '@loopback/rest';
import axios, {AxiosError, AxiosResponse} from 'axios';

import KeycloakController from '../providers/keycloak.provider';
import FhirController from '../providers/fhir.provider';
import GlensController from '../providers/glens.provider';
import AxiosController from '../services/axios.provider';
import Logger from '../services/logger.provider';

const fs = require('fs');

import {Registration} from '../models';
const sanitizer = require('sanitizer');

export class RegistrationController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @inject(RestBindings.Http.RESPONSE) private response: Response,
  ) {}

  keycloakController = new KeycloakController();
  axiosController = new AxiosController();
  glensController = new GlensController();
  fhirController = new FhirController();

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
      if (!response) response = {};
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

  getUserIdFromToken = () => {
    let userId;
    try {
      let parsedToken = this.keycloakController.getParsedJwtFromHeaders(
        this.req.headers,
      );
      userId = this.keycloakController.getUserIdFromParsedToken(parsedToken); // "SUB" field of the JWT token is the userid for which the token is granted
      if (!userId) throw new Error('No token sent, or it is invalid');
      return userId;
    } catch (error) {
      console.log('Invalid or inexistant token. Sending response...');
      let response = {};
      response['message'] =
        'Please, send a valid token in authorization header.';
      this.response.status(400).send(response);
      return;
    }
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

  @get('/user')
  @response(200)
  async findUserById(
    @param.filter(Registration) filter?: Filter<Registration>,
  ): Promise<any> {
    console.log('\n\n');
    Logger.log('------------------[GET]-------------------------');
    Logger.log('[GET] Get user');

    let response = {
      keycloakProfile: {},
      glensProfile: {},
    };

    let userId = this.getUserIdFromToken();
    await this.authenticateService();

    //////////////////////////
    // Get Keycloak profile //
    //////////////////////////
    try {
      let keycloakProfile = await this.keycloakController.getKeycloakUser(
        userId,
      );
      response.keycloakProfile = keycloakProfile;
    } catch (error) {
      if (error.code === 'ERR_UNESCAPED_CHARACTERS') {
        console.log('ERR_UNESCAPED_CHARACTERS');
        response['message'] = 'Unvalid token and unvalid userId';
        this.response.status(400).send(response);
      } else if (error.response.status === 404) {
        console.log('User does not exist in keycloak (404)');
        response['message'] = 'User does not exist';
        this.response.status(404).send(response);
      }
    }

    ////////////////////////
    // Get G-lens profile //
    ////////////////////////
    try {
      let glensProfileResponse = await this.glensController.getGlensProfile(
        userId,
        this.keycloakController.token,
      );

      response.glensProfile = glensProfileResponse;
    } catch (error) {
      Logger.log('[Get User] ERROR Getting G-Lens Profile: ' + userId);
      this.response.status(400).send(response);
    }

    this.response.status(200).send(response);
  }

  @post('/user')
  async createUser(
    @requestBody({
      description: 'Keycloak user registration',
      required: true,
      content: {
        'application/json': {
          // Make sure this matches the POST request type
          'x-parser': 'raw', // This is the key to skipping parsing
          //schema: {type: 'object'},
          schema: {
            type: 'object',
            title: 'Registration',
            properties: {
              username: {type: 'string'},
              firstName: {type: 'string'},
              lastName: {type: 'string'},
              enabled: {type: 'boolean'},
              email: {type: 'string'},
              role: {type: 'string'},
              attributes: {
                type: 'object',
                properties: {
                  country: {type: 'string'},
                },
              },
              credentials: {
                type: 'object',
                properties: {
                  type: {type: 'string'},
                  value: {type: 'string'},
                  temporary: {type: 'boolean'},
                },
              },
              headers: {
                type: 'object',
                properties: {
                  'Content-Type': {type: 'string'},
                },
                additionalProperties: true,
              },
            },
          },
        },
      },
    })
    body: Buffer,
  ) {
    Logger.log('\n\n------------------[POST]-------------------------');
    Logger.log('[POST] Create user');

    let response = {
      created: false,
      glensProfile: {},
      fhirPatient: {},
    };

    const rawBody = body.toString('utf8');

    let profile = {};
    try {
      profile = JSON.parse(rawBody);
    } catch (error) {
      this.response.status(400).send({
        message: 'Provide valid body in the request.',
      });
    }

    await this.authenticateService();

    /////////////////
    // Create user //
    /////////////////
    let keycloakBody = this.keycloakController.createKeycloakProfile(profile);
    let createUserResponse: any;
    try {
      createUserResponse = await this.keycloakController.createKeycloakUser(
        keycloakBody,
      );
    } catch (error) {
      Logger.log('[Create Keycloak user] Error');
      this.processAxiosError(error, response);
      return;
    }
    //console.log(createUserResponse);

    // Get UserId from Keycloak respose//
    const location = createUserResponse.headers['location'];
    const splitString = location.split('/');
    const keycloakUserId = splitString[splitString.length - 1];
    Logger.log(
      `[Create Keycloak user] Created with user ID: ${keycloakUserId}`,
    );

    ////////////////////
    // G-Lens Profile //
    ////////////////////

    let glensProfile =
      this.glensController.createGlensProfileBody(keycloakUserId);
    let glensProfileResponse;
    try {
      glensProfileResponse = await this.glensController.createGlensProfile(
        glensProfile,
        this.keycloakController.token,
      );
    } catch (error) {
      Logger.log('[Create G-Lens Profile] Error');
      this.processAxiosError(error, response);
      this.keycloakController.deleteKeycloakUser(
        this.keycloakController.token,
        keycloakUserId,
      );
      this;
      return this.response;
    }

    //////////////////
    // FHIR Patient //
    //////////////////
    let fhirPatientProfile =
      this.fhirController.buildFhirPatient(keycloakUserId);
    Logger.log(
      `[Create FHIR Patient] Creating fhir patient: ${JSON.stringify(profile)}`,
    );

    let fhirPatientResponse;
    try {
      fhirPatientResponse = await this.fhirController.createFhirPatient(
        fhirPatientProfile,
        this.keycloakController.token,
      );
      Logger.log('[Create FHIR Patient] Created');
    } catch (error) {
      await this.keycloakController.deleteKeycloakUser(
        this.keycloakController.token,
        keycloakUserId,
      );
      await this.glensController.deleteGlensProfile(keycloakUserId);
      this.processAxiosError(error, response);
      return this.response;
    }

    /////////////////////////////
    // Send verification email //
    /////////////////////////////

    try {
      await this.keycloakController.sendVerificationEmail(
        this.keycloakController.token,
        keycloakUserId,
      );
    } catch (error) {
      await this.keycloakController.deleteKeycloakUser(
        this.keycloakController.token,
        keycloakUserId,
      );
      await this.glensController.deleteGlensProfile(keycloakUserId);
      this.processAxiosError(error, response);
    }

    response.created = true;
    response.fhirPatient = fhirPatientProfile;
    response.glensProfile = glensProfile;

    return this.response.status(201).send(response);
  }

  @patch('/user/{id}')
  async replaceById(
    @requestBody({
      description: 'Keycloak user PUT',
      required: true,
      content: {
        'application/json': {
          // Make sure this matches the POST request type
          'x-parser': 'raw', // This is the key to skipping parsing
          schema: {type: 'object'},
        },
      },
    })
    @param.path.string('id')
    id: string,
    body: Buffer,
  ) {
    Logger.log('\n\n------------------[PATCH]-------------------------');
    Logger.log(`[PATCH] /user/${id}`);

    let response = {};

    let requestedUserId = this.getUserIdFromToken();
    await this.authenticateService();

    if (requestedUserId != id) {
      this.response.status(401).send({
        message: "You don't have permissions to patch this user.",
      });
    }

    // Sanitize input
    const rawBody = body.toString('utf8');
    let patchBody;
    try {
      patchBody = JSON.parse(rawBody);
    } catch (error) {
      return this.response.status(400).send({
        message: 'Provide valid body in the request.',
      });
    }

    let glensProfile = patchBody.glensProfile;
    let fhirPatient = patchBody.fhirPatient;

    if (glensProfile === undefined && fhirPatient === undefined) {
      return this.response.status(400).send({
        message:
          'Provide valid body in the request. At least glensProfile or fhirPatient should be present with valid schemas.',
      });
    }

    //////////////////////////
    // PATCH G-Lens Profile //
    //////////////////////////
    if (glensProfile) {
      Logger.log(
        `[Patch G-Lens Profile] Patching G-Lens profile: ${JSON.stringify(
          glensProfile,
        )}`,
      );
      let glensProfileResponse;
      Logger.log('Patching g-lens-profile user...');
      try {
        glensProfileResponse = await this.glensController.patchGlensProfile(
          glensProfile,
          id,
          this.keycloakController.token,
        );
        Logger.log('Patch glens profile OK');
        response['glensProfile'] = glensProfile;
      } catch (error) {
        Logger.log('error patching g-lens-profile');
        this.processAxiosError(error, response);
        return;
      }
    }

    //////////////////////////
    // PATCH FHIR Patient ////
    //////////////////////////
    if (fhirPatient) {
      Logger.log(
        `[Patch FHIR Patient] Patching fhir patient: ${JSON.stringify(
          fhirPatient,
        )}`,
      );

      let fhirPatientResponse;
      try {
        fhirPatientResponse = await this.fhirController.patchFhirPatient(
          fhirPatient,
          this.keycloakController.token,
        );
        Logger.log('[Patch FHIR Patient] Patched');
      } catch (error) {
        this.processAxiosError(error, response);
        return this.response;
      }
    }

    this.response.status(200).send(response);
    return this.response;
  }
  /* 
  @del('/user/{id}')
  @response(204, {
    description: 'Player DELETE success',
  })
  async deleteById(@param.path.string('id') id: string) {
    Logger.log('\n\n------------------[DELETE]-------------------------');
    let pandevitaToken: any;
    try {
      pandevitaToken = await this.get_token(this.realm, this.realmData);
    } catch (error) {
      return this.response;
    }

    //DELETE the user
    let userResponse;
    try {
      userResponse = await axios({
        method: 'delete',
        url:
          this.keycloakBaseUrl +
          '/auth/admin/realms/' +
          this.realm +
          '/' +
          this.usersEndpoint +
          '/' +
          id,
        headers: {
          Authorization: 'Bearer ' + pandevitaToken,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      Logger.log('Error deleting user');
      Logger.log(error);
      this.response.status(500).send({
        created: false,
        reason: error,
      });

      return this.response;
    }
  } */
}
