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

import KeycloakController from '../providers/keycloak.provider';
import FhirController from '../providers/fhir.provider';
import GlensController from '../providers/glens.provider';
import Logger from '../services/logger.services';

import {Registration} from '../models';
import {LogLevel} from '../services/types';
import ResponseError from '../error/ResponseError';
import {
  getParsedJwtFromHeaders,
  getUserIdFromToken,
  parseJSONBody,
} from '../services/utils.services';
import CustomError from '../error/CustomError';

export class RegistrationController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @inject(RestBindings.Http.RESPONSE) private response: Response,
  ) {}

  keycloakBaseUrl =
    process.env.KEYCLOAK_BASE_PATH ?? 'https://fosps.gravitatehealth.eu';

  glensProfileUrl =
    process.env.GLENS_PROFILE_BASE_PATH ??
    'https://fosps.gravitatehealth.eu/profiles';

  fhirPatientUrl =
    process.env.PATIENT_PATH ??
    'https://fosps.gravitatehealth.eu/ips/api/fhir/Patient';

  keycloakController = new KeycloakController(this.keycloakBaseUrl);
  glensController = new GlensController(this.glensProfileUrl);
  fhirController = new FhirController(this.fhirPatientUrl);

  sendErrorResponse = (error: ResponseError) => {
    console.log(JSON.stringify(error));
    return this.response.status(error.statusCode || 500).send(error.body);
  };

  getUserIdFromToken = (): string => {
    let parsedToken, userId;
    try {
      parsedToken = getParsedJwtFromHeaders(this.req.headers);
      return getUserIdFromToken(parsedToken);
    } catch (error) {
      this.response.status(400).send({
        errorMessage: 'Send valid token in headers.',
      });
      return '';
    }
  };

  @get('/user')
  @response(200)
  async findUserById(
    @param.filter(Registration) filter?: Filter<Registration>,
  ): Promise<any> {
    Logger.log(
      LogLevel.INFO,
      '\n\n------------------[GET /user]-------------------------',
    );

    let response = {
      keycloakProfile: {},
      glensProfile: {},
    };

    let userId = this.getUserIdFromToken();
    if (!userId) {
      return;
    }

    //////////////////////////
    // Get Keycloak profile //
    //////////////////////////
    try {
      let keycloakProfile = await this.keycloakController.getKeycloakUser(
        userId,
      );
      if (keycloakProfile) {
        response.keycloakProfile = keycloakProfile;
      }
    } catch (error) {
      this.sendErrorResponse(error);
      return;
    }

    ////////////////////////
    // Get G-lens profile //
    ////////////////////////
    /* try {
      let glensProfile = await this.glensController.getGlensProfile(userId);

      response.glensProfile = glensProfile;
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        '[Get User] ERROR Getting G-Lens Profile: ' + userId,
      );
      this.sendErrorResponse(error);
      return;
    } */

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
    Logger.log(
      LogLevel.INFO,
      '\n\n------------------[POST /user]-------------------------',
    );

    let response = {
      created: false,
      fhirPatient: {},
    };

    // Sanitize input
    let profile;
    try {
      profile = parseJSONBody(body.toString('utf8'));
    } catch (error) {
      this.sendErrorResponse(
        new CustomError(400, {error: 'Provide valid JSON body'}),
      );
      return;
    }

    /////////////////
    // Create user //
    /////////////////
    let keycloakBody = this.keycloakController.createKeycloakProfile(profile);
    let keycloakUserId: string;
    try {
      keycloakUserId = await this.keycloakController.createKeycloakUser(
        keycloakBody,
      );
    } catch (error) {
      Logger.log(LogLevel.ERROR, '[Create Keycloak user] Error');
      this.sendErrorResponse(error);
      return;
    }
    Logger.log(
      LogLevel.INFO,
      `[Create Keycloak user] Created with user ID: ${keycloakUserId}`,
    );

    ////////////////////
    // G-Lens Profile //
    ////////////////////

    //let glensProfile =
    //  this.glensController.createGlensProfileBody(keycloakUserId);
    //let glensProfileResponse;
    //try {
    //  glensProfileResponse = await this.glensController.createGlensProfile(
    //    glensProfile,
    //  );
    //} catch (error) {
    //  Logger.log(LogLevel.ERROR, '[Create G-Lens Profile] Error');
    //  await this.keycloakController.deleteKeycloakUser(keycloakUserId);
    //  this.sendErrorResponse(error);
    //  return;
    //}

    //////////////////
    // FHIR Patient //
    //////////////////
    let fhirPatientProfile =
      this.fhirController.buildFhirPatient(keycloakUserId, keycloakBody.firstName, keycloakBody.lastName);
    Logger.log(
      LogLevel.INFO,
      `[Create FHIR Patient] Creating fhir patient: ${JSON.stringify(
        fhirPatientProfile,
      )}`,
    );

    let fhirPatientResponse;
    try {
      fhirPatientResponse = await this.fhirController.createFhirPatient(
        fhirPatientProfile,
      );
      Logger.log(LogLevel.INFO, '[Create FHIR Patient] Created');
    } catch (error) {
      await this.keycloakController.deleteKeycloakUser(keycloakUserId);
      //await this.glensController.deleteGlensProfile(keycloakUserId);
      this.sendErrorResponse(error);
      return;
    }

    /////////////////////////////
    // Send verification email //
    /////////////////////////////

    try {
      await this.keycloakController.sendVerificationEmail(keycloakUserId);
    } catch (error) {
      await this.keycloakController.deleteKeycloakUser(keycloakUserId);
      //await this.glensController.deleteGlensProfile(keycloakUserId);
      this.sendErrorResponse(error);
      return;
    }

    response.created = true;
    response.fhirPatient = fhirPatientProfile;
    //response.glensProfile = glensProfile;

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
    Logger.log(
      LogLevel.INFO,
      `\n\n------------------[PATCH /user ${id}]-------------------------`,
    );

    let response = {};
    let requestedUserId = this.getUserIdFromToken();
    if (!requestedUserId) {
      return;
    }

    if (requestedUserId != id) {
      this.response.status(401).send({
        message: "You don't have permissions to patch this user.",
      });
    }

    // Sanitize input
    let patchBody;
    try {
      patchBody = parseJSONBody(body.toString('utf8'));
    } catch (error) {
      this.sendErrorResponse(
        new CustomError(400, {error: 'Provide valid JSON body'}),
      );
      return;
    }
    console.log(JSON.stringify(patchBody));

    let glensProfile = patchBody.glensProfile;
    let fhirPatientPatchContent = patchBody.fhirPatient;

    if (glensProfile === undefined && fhirPatientPatchContent === undefined) {
      return this.response.status(400).send({
        message:
          'Provide valid body in the request. At least glensProfile or fhirPatient should be present with valid schemas.',
      });
    }

    //////////////////////////
    // PATCH G-Lens Profile //
    //////////////////////////
    /* if (glensProfile) {
      Logger.log(
        LogLevel.INFO,
        `[Patch G-Lens Profile] Patching G-Lens profile: ${JSON.stringify(
          glensProfile,
        )}`,
      );
      let glensProfileResponse;
      try {
        glensProfileResponse = await this.glensController.patchGlensProfile(
          glensProfile,
          id
        );
        Logger.log(LogLevel.INFO, 'Patch glens profile OK');
        response['glensProfile'] = glensProfile;
      } catch (error) {
        Logger.log(LogLevel.ERROR, 'error patching g-lens-profile');
        this.sendErrorResponse(error);
        return;
      }
    } */

    //////////////////////////
    // PATCH FHIR Patient ////
    //////////////////////////
    if (fhirPatientPatchContent) {
      Logger.log(
        LogLevel.INFO,
        `[Patch FHIR Patient] Patching fhir patient: ${JSON.stringify(
          fhirPatientPatchContent,
        )}`,
      );

      let fhirPatientResponse;
      try {
        fhirPatientResponse = await this.fhirController.patchFhirPatient(
          fhirPatientPatchContent,
          requestedUserId,
        );
        Logger.log(LogLevel.INFO, '[Patch FHIR Patient] Patched');
        response['fhirPatientRespose'] = fhirPatientResponse.data;
      } catch (error) {
        console.log(JSON.stringify(error));
        this.sendErrorResponse(error);
        return;
      }
    }

    this.response.status(200).send(response);
    return this.response;
  }
  @del('/user/{id}')
  @response(204, {
    description: 'Player DELETE success',
  })
  async deleteById(@param.path.string('id') id: string) {
    Logger.log(
      LogLevel.INFO,
      `\n\n------------------[DELETE /user/${id}]-------------------------`,
    );

    let deleted = {};

    let requestedUserId = this.getUserIdFromToken();
    if (!requestedUserId) {
      return;
    }
    if (requestedUserId != id) {
      return this.response.status(401).send({
        message: "You don't have permissions to delete this user.",
      });
    }

    //DELETE the user
    let deleteUserResponse, deleteGlensProfile, deleteFhirPatient;
    try {
      deleteUserResponse = await this.keycloakController.deleteKeycloakUser(
        requestedUserId,
      );
      deleted['keycloakProfileDeleted'] = true;
      deleteGlensProfile = await this.glensController.deleteGlensProfile(
        requestedUserId,
      );
      deleted['glensProfileDeleted'] = true;
      deleteFhirPatient = await this.fhirController.deleteFhirPatient(
        requestedUserId,
      );
      Logger.log(
        LogLevel.INFO,
        `[Delete FHIR Patient] Deleted patient with id: ${requestedUserId}`,
      );
      deleted['fhirPatientDeleted'] = true;
    } catch (error) {
      Logger.log(LogLevel.ERROR, '[Delete user] Error deleting user');
      Logger.log(LogLevel.INFO, JSON.stringify(error));
      this.sendErrorResponse(error);
      return;
    }

    return this.response.status(200).send({
      deleted: deleted,
    });
  }
}
