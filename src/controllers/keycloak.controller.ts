import axios from 'axios';
import AxiosController from './axios.controller';
import Logger from './logger.controller';
import qs from 'qs';

export class KeycloakController {
  axiosController = new AxiosController();

  keycloakBaseUrl =
    process.env.KEYCLOAK_BASE_PATH ?? 'https://fosps.gravitatehealth.eu';
  usersEndpoint = 'users';

  token = '';

  // For users
  realm = process.env.KEYCLOAK_REALM ?? 'GravitateHealth';
  serviceUserUsername = process.env.SERVICE_USERNAME ?? 'user-test@gh.com';
  serviceUserPassword =
    process.env.SERVICE_PASSWORD ?? 'Alumni-diabetic-attentive1';

  keycloakUsersEndpoint =
    this.keycloakBaseUrl +
    '/auth/admin/realms/' +
    this.realm +
    '/' +
    this.usersEndpoint;

  // Realm data
  realmData = qs.stringify({
    client_id: 'GravitateHealth',
    grant_type: 'password',
    username: this.serviceUserUsername,
    password: this.serviceUserPassword,
  });

  parseJwt = (token: any) => {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  };

  getUserIdFromToken = (token: string) => {};

  getParsedJwtFromHeaders = (headers: any) => {
    let authHeader = headers.authorization || '';
    const jwtToken = authHeader.split(' ')[1];
    return this.parseJwt(jwtToken);
  };

  checkJWTisValid = async () => {
    let url =
      this.keycloakBaseUrl +
      '/auth/realms/' +
      this.realm +
      '/protocol/openid-connect/userinfo';
    try {
      const isValid = await this.axiosController.axiosGet({
        url: url,
        token: this.token,
      });
      let statusCode = isValid.status;
      if (statusCode < 200 && statusCode > 299) {
        return false;
      }
      return true;
    } catch (error) {
      Logger.log('[Check JWT is valid] Error');
      Logger.log(error);
      return false;
    }
  };

  getToken = async (realm = this.realm, realmData = this.realmData) => {
    let tokenResponse: any;
    let url =
      this.keycloakBaseUrl +
      '/auth/realms/' +
      realm +
      '/protocol/openid-connect/token';
    try {
      tokenResponse = await this.axiosController.axiosPost({
        data: realmData,
        url: url,
        contentType: 'application/x-www-form-urlencoded',
      });
    } catch (error) {
      Logger.log(error);
      return;
    }
    if (tokenResponse.status === 200) {
      Logger.log('[Get ServiceUser Token] OK');
    } else {
      Logger.log('[Get ServiceUser Token] ERROR: NOT OK');
      Logger.log(`[Get ServiceUser Token] ${JSON.stringify(tokenResponse)}`);
    }
    let token = tokenResponse.data.access_token;
    if (!token)
      throw new Error('[Get ServiceUser Token] Error contacting keycloak');
    this.token = token;
    return token;
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

  sendVerificationEmail = async (token: any, userId: any) => {
    let url =
      this.keycloakBaseUrl +
      '/auth/admin/realms/' +
      this.realm +
      '/' +
      this.usersEndpoint +
      '/' +
      userId +
      '/execute-actions-email';
    const keycloakVerifyEmail = await this.axiosController.axiosPut({
      data: ['VERIFY_EMAIL'],
      url: url,
      token: token
    });
    Logger.log(`[Send Verification email] Sent to + ${userId}`);
  };

  getKeycloakUser = async (userId: String) => {
    Logger.log(`[Get Keycloak User] Getting user: ${userId}`);

    let response;
    let url =
      this.keycloakBaseUrl +
      '/auth/admin/realms/' +
      this.realm +
      '/users/' +
      userId;
    try {
      response = await this.axiosController.axiosGet({
        url: url,
        token: this.token,
      });
    } catch (error) {
      Logger.log('[Get keycloak user] ERROR Getting user: ' + userId);
      return;
    }
    if (response && response.status === 204) {
      Logger.log(`[Get keycloak user] Gotten user with id: ${userId}`);
      return response;
    }
    return;
  };

  createKeycloakUser = async (body: any) => {
    Logger.log(`[Create Keycloak user] Creating keycloak user: ${body}`);
    let url =
      this.keycloakBaseUrl +
      '/auth/admin/realms/' +
      this.realm +
      '/' +
      this.usersEndpoint;

    let createUserResponse = await this.axiosController.axiosPost({
      data: body,
      url: url,
      token: this.token,
    });
    return createUserResponse;
  };

  deleteKeycloakUser = async (
    token: string,
    userId: String,
    realm = this.realm,
  ) => {
    Logger.log('[Delete Keycloak User] Deleting');

    let response;
    let url =
      this.keycloakBaseUrl + '/auth/admin/realms/' + realm + '/users/' + userId;
    try {
      response = await axios({
        method: 'delete',
        url: url,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      Logger.log('[Delete keycloak user] ERROR Deleting user: ' + userId);
      return;
    }
    if (response && response.status === 204) {
      Logger.log(`[Delete keycloak user] Deleted user with id: ${userId}`);
      return response;
    }
    return;
  };
}

export default KeycloakController;
