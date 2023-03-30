import AxiosController from '../services/axios.services';
import Logger from '../services/logger.services';
import {LogLevel} from '../services/types';
import {KeycloakUser, NewKeycloakUser} from './types';

export class KeycloakController extends AxiosController {
  keycloakBaseUrl: string;
  keycloakUsersUrl: string;
  keycloakUserInfoUrl: string;
  keycloakTokenUrl: string;
  usersEndpoint: string;
  realm: string;

  constructor(baseUrl: string) {
    super(baseUrl);
    this.realm = process.env.KEYCLOAK_REALM ?? 'GravitateHealth';
    this.keycloakBaseUrl =
      process.env.KEYCLOAK_BASE_PATH ?? 'https://fosps.gravitatehealth.eu';
    this.keycloakUsersUrl = `${this.keycloakBaseUrl}/auth/admin/realms/${this.realm}/users`;
    this.keycloakUserInfoUrl = `${this.keycloakBaseUrl}/auth/realms/${this.realm}/protocol/openid-connect/userinfo`;
    this.keycloakTokenUrl = `${this.keycloakBaseUrl}/auth/realms/${this.realm}/protocol/openid-connect/token`;
  }

  checkJWTisValid = async (token: string): Promise<boolean> => {
    Logger.log(
      LogLevel.INFO,
      '[Keycloak controller] [Check JWT is valid] Checking...',
    );
    let response;
    try {
      response = await this.request.get(this.keycloakUserInfoUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        '[Keycloak controller] [Check JWT is valid] Error',
      );
      return false;
    }
    let statusCode = response.status;
    if (statusCode < 200 && statusCode > 299) {
      return false;
    }
    return true;
  };

  createKeycloakProfile = (profile: any): NewKeycloakUser => {
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

  sendVerificationEmail = async (userId: string): Promise<boolean> => {
    Logger.log(
      LogLevel.INFO,
      `[Keycloak controller][Send Verification Email] Sending to: ${userId}`,
    );
    let emailIsVerified;
    try {
      emailIsVerified = await this.userHasEmailVerified(userId);
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        `[Keycloak controller][Send Verification Email] Error sending to: ${userId}`,
      );
      throw error;
    }
    if (emailIsVerified) {
      return false;
    }
    let url = `${this.keycloakUsersUrl}/${userId}/execute-actions-email`;
    const keycloakVerifyEmail = await this.request.put(url, ['VERIFY_EMAIL']);
    Logger.log(
      LogLevel.INFO,
      `[Keycloak controller][Send Verification email] Sent to ${userId}`,
    );
    return true;
  };

  userHasEmailVerified = async (userId: string): Promise<boolean> => {
    Logger.log(
      LogLevel.INFO,
      `[Keycloak controller][Check User Has Email Verified] Checking user: ${userId}`,
    );
    let user;
    try {
      user = (await this.getKeycloakUser(userId)) as KeycloakUser;
    } catch (error) {
      Logger.log(
        LogLevel.INFO,
        `[Keycloak controller][Check User Has Email Verified] Checking user: ${userId}`,
      );
      throw error;
    }
    return user.emailVerified;
  };

  getKeycloakUser = async (
    userId: String,
  ): Promise<KeycloakUser | undefined> => {
    Logger.log(
      LogLevel.INFO,
      `[Keycloak controller][Get User By ID] Getting user: ${userId}`,
    );
    let response;
    try {
      response = await this.request.get(`${this.keycloakUsersUrl}/${userId}`);
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        '[Keycloak controller][Get User By ID] ERROR Getting user: ' + userId,
      );
      throw error;
    }
    if (response && response.status === 200) {
      return response.data as KeycloakUser;
    }
  };

  getKeycloakUsers = async (): Promise<KeycloakUser[] | undefined> => {
    Logger.log(
      LogLevel.INFO,
      '[Keycloak controller][Get Users] Getting users...',
    );

    let response;
    try {
      response = await this.request.get(this.keycloakUsersUrl);
    } catch (error) {
      throw error;
    }
    if (response && response.status === 200) {
      return response.data;
    }
  };

  getKeycloakUserByEmail = async (email: string): Promise<KeycloakUser | undefined> => {
    let users;
    Logger.log(
      LogLevel.INFO,
      `[Keycloak controller][Get User By Email] Getting user: ${email}`,
    );
    try {
      users = await this.getKeycloakUsers();
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        '[Keycloak controller][Get User By Email] ERROR Getting users',
      );
      throw error;
    }

    for (const index in users) {
      if (users[index]['email'] === email) {
        // User exists with email providen
        return users[index];
      }
    }
    return;
  };

  createKeycloakUser = async (newUser: NewKeycloakUser): Promise<string> => {
    Logger.log(
      LogLevel.INFO,
      `[Keycloak controller][Create user] Creating keycloak user: ${newUser.email}`,
    );
    let createUserResponse;
    try {
      createUserResponse = await this.request.post(this.keycloakUsersUrl, newUser);
    } catch (error) {
      throw error;
    }
    const location = createUserResponse.headers['location'];
    const splitString = location.split('/');
    return splitString[splitString.length - 1];
  };

  deleteKeycloakUser = async (userId: String): Promise<boolean> => {
    Logger.log(LogLevel.INFO, '[Keycloak controller][Delete User] Deleting');

    let response;
    let url = `${this.keycloakUsersUrl}/${userId}`;
    try {
      response = await this.request.delete(url);
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        '[Keycloak controller][Delete user] ERROR Deleting user: ' + userId,
      );
      throw error;
    }
    if (response && response.status === 204) {
      Logger.log(
        LogLevel.INFO,
        `[Keycloak controller][Delete user] Deleted user with id: ${userId}`,
      );
      return true;
    }
    return false;
  };

  resetPassword = async (email: any): Promise<boolean> => {
    let user: any;
    try {
      user = await this.getKeycloakUserByEmail(email);
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        `[Keycloak controller][Reset Password] error getting user with email: ${email}`,
      );
      throw error;
    }
    if (user === undefined) {
      Logger.log(
        LogLevel.WARN,
        `[Keycloak controller][Reset Password] Email does not exist`,
      );
      return false;
    }
    let userId = user['id'];

    Logger.log(
      LogLevel.INFO,
      `[Keycloak controller][Reset Password] Sending reset password email to: ${userId}`,
    );
    const url = `${this.keycloakUsersUrl}/${userId}/execute-actions-email`;
    try {
      const keycloakResetPassword = await this.request.put(url, [
        'UPDATE_PASSWORD',
      ]);
      return true;
    } catch (error) {
      throw error
    }
  };
}

export default KeycloakController;
