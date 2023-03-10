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
import axios from 'axios';
import qs from 'qs';
const fs = require('fs');

import {Registration} from '../models';
const sanitizer = require('sanitizer');

export class RegistrationController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @inject(RestBindings.Http.RESPONSE) private response: Response,
  ) {}

  usersEndpoint = 'users';

  keycloakBaseUrl =
    process.env.KEYCLOAK_BASE_PATH ?? 'https://fosps.gravitatehealth.eu';

  glensProfileUrl =
    process.env.GLENS_PROFILE_BASE_PATH ??
    'https://fosps.gravitatehealth.eu/profiles';
  fhirPatientUrl =
    process.env.PATIENT_PATH ?? 'https://fosps.gravitatehealth.eu/fhir/Patient';
  // For users
  realm = process.env.KEYCLOAK_REALM ?? 'GravitateHealth';
  serviceUserUsername = process.env.SERVICE_USERNAME ?? 'user-test@gh.com';
  serviceUserPassword = process.env.SERVICE_PASSWORD ?? '';

  keycloakUsersEndpoint =
    this.keycloakBaseUrl +
    '/auth/admin/realms/' +
    this.realm +
    '/' +
    this.usersEndpoint;

  // Realm data
  realmData = qs.stringify({
    client_id: 'admin-cli',
    grant_type: 'password',
    username: this.serviceUserUsername,
    password: this.serviceUserPassword,
  });

  log = (msg: string) => {
    console.log(new Date().toISOString() + msg);
  };

  get_token = async (realm = this.realm, realmData = this.realmData) => {
    this.log('Getting token...');
    let tokenResponse: any;
    let url =
      this.keycloakBaseUrl +
      '/auth/realms/' +
      realm +
      '/protocol/openid-connect/token';
    try {
      tokenResponse = await axios({
        method: 'post',
        url: url,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10 * 1000,
        data: realmData,
      });
    } catch (error) {
      this.log(error);
      this.log('Error getting token');
      return;
    }
    if (tokenResponse.status === 200) {
      this.log('[get_token] OK');
    } else {
      this.log('[get_token] ERROR: NOT OK');
      this.log(JSON.stringify(tokenResponse));
    }
    return tokenResponse.data.access_token;
  };

  /*   // Finds user by username or email
  user_field_exists = async (field_name: string, field_value: string, token: string) => {
    this.log("[user_field_exists] Check if exists: " + field_name + " : " + field_value);
    try {

      const field_exists = await axios({
        method: 'get',
        url: this.keycloakPath + 'auth/admin/realms/' + this.realm + '/' + this.usersEndpoint,
        params: {
          field_name: field_value
        },
        timeout: 10 * 1000,
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      });
      const matches = field_exists.data
      for (const index in matches) {
        if (matches[index][field_name] === field_value.toLowerCase()) {
          return true
        }
      }
      return false
    } catch (error) {
      this.log(error);
      this.response.status(500).send({
        error: "Error while checking if user or email exists",
        reason: error.message
      })
      return this.response
    }
  } */

  /*   sanitizeInput = (body: any) => {
    return {
      firstName: sanitizer.sanitize(body.firstName),
      lastName: sanitizer.sanitize(body.lastName),
      email: sanitizer.sanitize(body.email),
      password: sanitizer.sanitize(body.password),
    }
  } */

  parseJwt = (token: any) => {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  };

  getParsedJwtFromHeaders = (headers: any) => {
    let authHeader = headers.authorization || '';
    const jwtToken = authHeader.split(' ')[1];
    return this.parseJwt(jwtToken);
  };

  checkJWTisValid = async (token: any) => {
    let url =
      this.keycloakBaseUrl +
      '/auth/realms/' +
      this.realm +
      '/protocol/openid-connect/userinfo';
    try {
      const isValid = await axios({
        method: 'get',
        url: url,
        timeout: 10 * 1000,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
      });
      let statusCode = isValid.status;
      if (statusCode < 200 && statusCode > 299) {
        return false;
      }
      return true;
    } catch (error) {
      this.log('error checking jwtIsValid');
      this.log(error);
      return false;
    }
  };

  processError = (error: any) => {
    error = error.toJSON();
    this.log(error.stack);
    this.log(error.message);
    this.log(error.status);
  };

  processAxiosError = (error: any, response: any) => {
    this.log(error);
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      let errorMessage = error.response.data.errorMessage;
      this.log('Error Message: ' + errorMessage);
      this.log('Error response data:');
      console.log(error.response.data.error);
      try {
        this.log(' Error Details: ');
        console.log(error.response.data.error.details);
      } catch (error) {}
      this.log('Error Status: ' + error.response.status);
      let message;
      switch (error.response.status) {
        case 409:
          message = 'User exists with same email';
          break;
        case 422:
          message = 'Unprocessable entity. Send correct body in petition';
          break;
        default:
          break;
      }
      response.message = message;
      response.reason = errorMessage;
      this.response.status(error.response.status).send(response);
    } else {
      this.log(error);
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

  axiosPost = async (data: any, url: any, token?: any) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return await axios({
      method: 'post',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
      data: data,
    });
  };

  axiosGet = async (url: any, token?: any) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return await axios({
      method: 'get',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
    });
  };

  axiosPatch = async (data: any, url: any, token?: any) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return await axios({
      method: 'patch',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
      data: data,
    });
  };

  createKeycloakProfile = (profile: any) => {
    return {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      enabled: true,
      credentials: [
        {
          type: 'password',
          value: profile.password,
          temporary: false,
        },
      ],
    };
  };

  createGlensProfileBody = (profile: any, keycloakUserId: any) => {
    let glensProfile = Object.assign({}, profile);
    glensProfile.id = keycloakUserId;
    delete glensProfile.password;
    delete glensProfile.firstName;
    delete glensProfile.lastName;
    delete glensProfile.email;
    return glensProfile;
  };

  createFhirPatient: any = (profile: any, keycloakUserId: any) => {
    console.log('RECEIVING PROFILE');
    console.log(profile);
    return {
      resourceType: 'Patient',
      identifier: [
        {
          use: 'usual',
          value: keycloakUserId,
        },
      ],
      active: true,
      name: [
        {
          use: 'usual',
          family: profile.lastName,
          given: [profile.firstName],
        },
      ],
      gender: profile.sex,
    };
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

  @get('/user')
  @response(200)
  async findUserById(
    @param.filter(Registration) filter?: Filter<Registration>,
  ): Promise<any> {
    console.log('\n\n');
    this.log('------------------[GET]-------------------------');
    this.log('[GET] Get user');
    let serviceUserToken: any;
    let response = {
      profile: false,
      glensProfile: null,
      //fhirPatientProfile: null,
    };

    ///////////////////////////
    // Get userID from token //
    ///////////////////////////
    let parsedToken, requestedUserId;
    try {
      let parsedToken = this.getParsedJwtFromHeaders(this.req.headers);
      requestedUserId = parsedToken['sub']; // "SUB" field of the JWT token is the userid for which the token is granted
      if (!requestedUserId) throw new Error('No token sent, or it is invalid');
    } catch (error) {
      console.log('Invalid or inexistant token. Sending response...');
      response['message'] =
        'Please, send a valid token in authorization header.';
      this.response.status(400).send(response);
      return;
    }

    // Get service token
    try {
      serviceUserToken = await this.get_token(this.realm, this.realmData);
    } catch (error) {
      this.log(error);
      response['message'] = 'There was an error contacting with auth server.';
      this.response.status(500).send({
        message: 'There was an error contacting with auth server.',
        error: '',
      });
      return this.response;
    }

    //////////////////////////
    // Get Keycloak profile //
    //////////////////////////
    let userUrl = this.keycloakUsersEndpoint + '/' + requestedUserId;
    try {
      let profileResponse = await this.axiosGet(userUrl, serviceUserToken);
      response.profile = profileResponse.data;
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
    let glensProfileUrl = this.glensProfileUrl + '/' + requestedUserId;
    try {
      let glensProfileResponse = await this.axiosGet(glensProfileUrl);
      response.glensProfile = glensProfileResponse.data;
    } catch (error) {
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
    this.log('\n\n------------------[POST]-------------------------');
    this.log('[POST] Create user');

    let response = {
      created: false,
      glensProfile: null,
      fhirPatientProfile: null,
    };
    ////////////////////
    // Sanitize input //
    ////////////////////
    const rawBody = body.toString('utf8');
    /*     let sanitizedBody
    try {
      sanitizedBody = this.sanitizeInput(JSON.parse(rawBody));
    } catch (error) {
      this.log(error.message);
      this.log("Body in request is invalid!")
      this.response.status(400).send(this.generateErrorRespose("Error creating user", "Provide valid body in request"))
      return this.response
    } */
    let profile;
    try {
      profile = JSON.parse(rawBody);
    } catch (error) {
      this.response.status(400).send({
        message: 'Provide valid body in the request.',
      });
    }

    let keycloakBody = this.createKeycloakProfile(profile);
    console.log(keycloakBody);

    ///////////////
    // Get token //
    ///////////////
    let serviceUserToken: any;
    try {
      serviceUserToken = await this.get_token(this.realm, this.realmData);
      if (!serviceUserToken) throw new Error('Error contacting keycloak');
    } catch (error) {
      console.log('Error getting tokens');
      this.log(error);
      this.response
        .status(500)
        .send(this.generateErrorResponse('Error creating user.', error));
      return this.response;
    }

    /////////////////
    // Create user //
    /////////////////
    let createUserResponse: any;
    try {
      this.log('creating keycloak user...');

      let url = this.keycloakUsersEndpoint;
      createUserResponse = await this.axiosPost(
        keycloakBody,
        url,
        serviceUserToken,
      );
      if (createUserResponse.status != 201) {
        response['message'] = 'There was an error creating the user.';
        this.response.status(createUserResponse.status).send(response);
        return this.response;
      }
    } catch (error) {
      this.log('error creating Keycloak user');
      this.processAxiosError(error, response);
      return this.response;
    }

    response.created = true;
    this.log('User was created succesfully on keycloak!');

    // Get UserId from Keycloak respose//
    const location = createUserResponse.headers['location'];
    const splitString = location.split('/');
    const keycloakUserId = splitString[splitString.length - 1];
    this.log('[POST] keycloak_user_id: ' + keycloakUserId);

    ////////////////////
    // G-Lens Profile //
    ////////////////////

    let glensProfile = this.createGlensProfileBody(profile, keycloakUserId);
    console.log(JSON.stringify(glensProfile));

    let glensProfileResponse;
    this.log('creating g-lens-profile user...');
    try {
      glensProfileResponse = await this.axiosPost(
        glensProfile,
        this.glensProfileUrl, serviceUserToken
      );
      this.log('OK');
    } catch (error) {
      this.log('error creating g-lens-profile');
      this.processAxiosError(error, response);
      this;
      return this.response;
    }
    response.glensProfile = glensProfile;

    //////////////////
    // FHIR Patient //
    //////////////////
    let fhirPatientProfile = this.createFhirPatient(profile, keycloakUserId);
    console.log(JSON.stringify(fhirPatientProfile));

    let fhirPatientResponse;
    try {
      this.log('creating fhir patient...');
      fhirPatientResponse = await this.axiosPost(
        fhirPatientProfile,
        this.fhirPatientUrl,
        serviceUserToken
      );
      this.log('OK');
    } catch (error) {
      this.log('error creating fhir patient');
      this.processAxiosError(error, response);
      return this.response;
    }
    response.fhirPatientProfile = fhirPatientProfile;

    this.response.status(201).send(response);
    return this.response;
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
    this.log('\n\n------------------[PATCH]-------------------------');
    this.log(`[PATCH] /user/${id}`);

    let response = {};
    ///////////////////////////
    // Get userID from token //
    ///////////////////////////
    let parsedToken, requestedUserId;
    try {
      let parsedToken = this.getParsedJwtFromHeaders(this.req.headers);
      requestedUserId = parsedToken['sub']; // "SUB" field of the JWT token is the userid for which the token is granted
      if (!requestedUserId) throw new Error('No token sent, or it is invalid');
    } catch (error) {
      console.log('Invalid or inexistant token. Sending response...');
      response['message'] =
        'Please, send a valid token in authorization header.';
      this.response.status(400).send(response);
      return;
    }

    if (requestedUserId != id) {
      this.response.status(401).send({
        message: "You don't have permissions to patch this user.",
      });
    }

    // Sanitize input
    const rawBody = body.toString('utf8');
    let profile;
    try {
      profile = JSON.parse(rawBody);
    } catch (error) {
      this.response.status(400).send({
        message: 'Provide valid body in the request.',
      });
    }
    if (requestedUserId != id) {
      this.response.status(401).send({
        success: false,
        reason: 'You are not authorized to edit this user.',
      });
      return this.response;
    }

    ///////////////
    // Get token //
    ///////////////
    let serviceUserToken: any;
    try {
      serviceUserToken = await this.get_token(this.realm, this.realmData);
      if (!serviceUserToken) throw new Error('Error contacting keycloak');
    } catch (error) {
      console.log('Error getting tokens');
      this.log(error);
      this.response
        .status(500)
        .send(this.generateErrorResponse('Error creating user.', error));
      return this.response;
    }

    //////////////////////////
    // PATCH G-Lens Profile //
    //////////////////////////

    let glensProfileResponse;
    this.log('Patching g-lens-profile user...');
    let url = this.glensProfileUrl + '/' + id;
    try {
      glensProfileResponse = await this.axiosPatch(profile, url);
      this.log('Patch glens profile OK');
    } catch (error) {
      this.log('error patching g-lens-profile');
      this.processAxiosError(error, response);
      return;
    }
    this.response.status(200).send(profile);
    return this.response;
  }
  /* 
  @del('/user/{id}')
  @response(204, {
    description: 'Player DELETE success',
  })
  async deleteById(@param.path.string('id') id: string) {
    this.log('\n\n------------------[DELETE]-------------------------');
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
      this.log('Error deleting user');
      this.log(error);
      this.response.status(500).send({
        created: false,
        reason: error,
      });

      return this.response;
    }
  } */
}
