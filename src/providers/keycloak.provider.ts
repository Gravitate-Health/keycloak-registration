import axios from 'axios';
import AxiosController from '../services/axios.provider';
import Logger from '../services/logger.provider';
import {stringify} from 'qs';

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

  keycloakUsersUrl = `${this.keycloakBaseUrl}/auth/admin/realms/${this.realm}/${this.usersEndpoint}`;
  keycloakUserInfoUrl = `${this.keycloakBaseUrl}/auth/realms/${this.realm}/protocol/openid-connect/userinfo`;
  keycloakTokenUrl = `${this.keycloakBaseUrl}/auth/realms/${this.realm}/protocol/openid-connect/token`;
  // Realm data
  realmData = stringify({
    client_id: 'GravitateHealth',
    grant_type: 'password',
    username: this.serviceUserUsername,
    password: this.serviceUserPassword,
  });

  parseJwt = (token: any) => {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  };

  getUserIdFromParsedToken = (parsedToken: object) => {
    return parsedToken['sub'];
  };

  getParsedJwtFromHeaders = (headers: any) => {
    let authHeader = headers.authorization;
    const jwtToken = authHeader.split(' ')[1];
    return this.parseJwt(jwtToken);
  };

  checkJWTisValid = async () => {
    try {
      const isValid = await this.axiosController.axiosGet({
        url: this.keycloakUserInfoUrl,
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
    try {
      tokenResponse = await this.axiosController.axiosPost({
        data: realmData,
        url: this.keycloakTokenUrl,
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

  sendVerificationEmail = async (userId: any) => {
    let emailIsVerified;
    try {
      emailIsVerified = await this.userHasEmailVerified(userId);
    } catch (error) {
      Logger.log(`[Send Verification Email] Error sending to: ${userId}`);
      throw new Error(error);
    }
    if (emailIsVerified) {
      return false;
    }
    let url = `${this.keycloakUsersUrl}/${userId}/execute-actions-email`;
    const keycloakVerifyEmail = await this.axiosController.axiosPut({
      data: ['VERIFY_EMAIL'],
      url: url,
      token: this.token,
    });
    Logger.log(`[Send Verification email] Sent to ${userId}`);
    return true;
  };

  userHasEmailVerified = async (userId: string) => {
    Logger.log(`[Check User Has Email Verified] Checking user: ${userId}`);
    let user;
    try {
      user = await this.getKeycloakUser(userId);
    } catch (error) {
      Logger.log(`[Check User Has Email Verified] Checking user: ${userId}`);
      throw new Error(error);
    }
    Logger.log(`User Has Email Verified: ${user['emailVerified']}`);
    return user['emailVerified'];
  };

  getKeycloakUser = async (userId: String) => {
    Logger.log(`[Get Keycloak User] Getting user: ${userId}`);

    let response;
    let url = `${this.keycloakUsersUrl}/${userId}`;
    try {
      response = await this.axiosController.axiosGet({
        url: url,
        token: this.token,
      });
    } catch (error) {
      Logger.log('[Get keycloak user] ERROR Getting user: ' + userId);
      throw new Error(error);
    }
    if (response && response.status === 200) {
      Logger.log(`[Get keycloak user] Gotten user with id: ${userId}`);
      return response.data;
    }
    return;
  };

  getKeycloakUsers = async () => {
    Logger.log('[Get Keycloak Users] Getting users...');

    let response;
    try {
      response = await this.axiosController.axiosGet({
        url: this.keycloakUsersUrl,
        token: this.token,
      });
    } catch (error) {
      Logger.log('[Get keycloak Users] ERROR Getting users');
      throw new Error(error);
    }
    if (response && response.status === 200) {
      Logger.log('[Get keycloak Users] OK');
      return response.data;
    }
    return;
  };

  getKeycloakUserByEmail = async (email: string) => {
    let response, users;
    Logger.log(`[Get Keycloak User By Email] Getting user: ${email}`);
    try {
      users = await this.getKeycloakUsers();
    } catch (error) {
      Logger.log('[Get keycloak User By Email] ERROR Getting users');
      throw new Error(error);
    }

    for (const index in users) {
      if (users[index]['email'] === email) {
        // User exists with email providen
        return users[index];
      }
    }
    return;
  };

  createKeycloakUser = async (body: any) => {
    Logger.log(`[Create Keycloak user] Creating keycloak user: ${body}`);
    let createUserResponse = await this.axiosController.axiosPost({
      data: body,
      url: this.keycloakUsersUrl,
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
    let url = `${this.keycloakUsersUrl}/${userId}`;
    try {
      response = await this.axiosController.axiosDelete({
        url: url,
        token: token,
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

  resetPassword = async (email: any) => {
    let user: any;
    try {
      user = await this.getKeycloakUserByEmail(email);
    } catch (error) {
      throw new Error(error);
    }
    if (user === undefined) {
      Logger.log(`[Keycloak Reset Password] Email does not exist`);
      return false;
    }
    let userId = user['id'];

    Logger.log(
      `[Keycloak Reset Password] Sending reset password email to: ${userId}`,
    );
    const url = `${this.keycloakUsersUrl}/${userId}/execute-actions-email`;
    const keycloakResetPassword = await this.axiosController.axiosPut({
      url: url,
      data: ['UPDATE_PASSWORD'],
      token: this.token,
    });
    return keycloakResetPassword;
  };
}

export default KeycloakController;
