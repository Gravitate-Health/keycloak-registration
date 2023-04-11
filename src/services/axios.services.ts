import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import Logger from './logger.services';
import {stringify} from 'qs';
import {LogLevel, RetryConfig} from './types';
import ResponseError from '../error/ResponseError';

const globalConfig: RetryConfig = {
  retry: 2,
  retryDelay: 1000,
};

class AxiosController {
  protected readonly axiosInstance: AxiosInstance;

  axiosConfig: AxiosRequestConfig;
  baseUrl: string;
  tokenEndpoint: string;
  serviceUserUsername: string;
  serviceUserPassword: string;
  realmData: string;
  realm: string;

  token: string;

  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.axiosConfig = this._createAxiosConfig(baseUrl);
    this.axiosInstance = axios.create(this.axiosConfig);

    this.serviceUserUsername =
      process.env.SERVICE_USERNAME as string;
    this.serviceUserPassword =
      process.env.SERVICE_PASSWORD as string;
    this.realm = process.env.KEYCLOAK_REALM ?? 'GravitateHealth';
    this.tokenEndpoint = `${this.baseUrl}/auth/realms/${this.realm}/protocol/openid-connect/token`;

    this.realmData = stringify({
      client_id: 'GravitateHealth',
      grant_type: 'password',
      username: this.serviceUserUsername,
      password: this.serviceUserPassword,
    });

    this._initializeRequestInterceptor();
    this._initializeResponseInterceptor();
  }

  private _createAxiosConfig = (baseUrl: string): RetryConfig => {
    return {
      baseURL: baseUrl,
      retry: 2,
      retryDelay: 1000,
      timeout: 10 * 1000,
      headers: {
        Accept: '*/*',
        Authorization: '',
      },
    };
  };
  private _initializeRequestInterceptor = () => {
    this.axiosInstance.interceptors.request.use(
      this._handleRequest,
      this._handleResponseError,
    );
  };

  private _initializeResponseInterceptor = () => {
    this.axiosInstance.interceptors.response.use(
      this._handleResponse,
      this._handleResponseError,
    );
  };

  private _handleResponse = (response: AxiosResponse) => {
    Logger.log(
      LogLevel.DEBUG,
      `[Response interceptor] [Status: ${response.status}] [Data: ${response.data}]`,
    );
    return response;
  };

  private _handleRequest = (config: AxiosRequestConfig) => {
    Logger.log(
      LogLevel.DEBUG,
      `[Request interceptor] [Method: ${config.method}] [URL: ${
        config.url
      }] [Content-Type: ${config.headers!['Content-Type']}] [DATA: ${
        config.data
      }]`,
    );
    config.headers!.Authorization = `Bearer ${this.token}`;
    return config;
  };

  private refreshToken = async () => {
    let token, tokenResponse: any;
    let config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    } as AxiosRequestConfig;
    try {
      Logger.log(LogLevel.DEBUG, '[Get ServiceUser Token] Getting token...');
      tokenResponse = await this.request.post(
        this.tokenEndpoint,
        this.realmData,
        config,
      );
    } catch (error) {
      Logger.log(LogLevel.ERROR, error);
      throw new Error(error);
    }
    if (tokenResponse.status !== 200) {
      Logger.log(LogLevel.ERROR, '[Get ServiceUser Token] ERROR');
      Logger.log(
        LogLevel.ERROR,
        `[Get ServiceUser Token] ${JSON.stringify(token)}`,
      );
      throw new Error('Could not get token');
    }
    token = tokenResponse.data.access_token;
    this.axiosConfig.headers!.Authorization = `Bearer ${token}`;
    this.token = token;
    return token;
  };

  private retryRequest = async (originalConfig: RetryConfig) => {
    originalConfig.headers!.Authorization =
      this.axiosConfig.headers!.Authorization;
    originalConfig.retry -= 1;
    const delayRetryRequest = new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, originalConfig.retryDelay || 1000);
    });
    return delayRetryRequest.then(() => {
      Logger.log(LogLevel.DEBUG, '[Handle response error] Retrying request...');
      return this.axiosInstance(originalConfig);
    });
  };

  private _handleResponseError = async (error: any) => {
    const originalConfig = error.config as RetryConfig;

    let errorUrl = error.config.url;
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx

      if (error.response.status === 401 && originalConfig.retry) {
        // Service is unauthorized
        await this.refreshToken();
        return this.retryRequest(originalConfig);
      }
      Logger.log(
        LogLevel.ERROR,
        `[Response Error Interceptor] Error URL: ${errorUrl}`,
      );
      let errorStatusCode = error.response.status;
      let errorMessage, errorData, errorDetails;
      try {
        errorMessage = error.response.data.errorMessage;
        errorData = error.response.data.error;
        errorDetails = error.response.data.error.details;
      } catch (error) {}
      let errorHeaders = error.request.headers;
      Logger.log(
        LogLevel.ERROR,
        `[Response Error Interceptor] [Request Headers: ${errorHeaders}]`,
      );
      Logger.log(
        LogLevel.ERROR,
        `[Response Error Interceptor] [Status Code: ${errorStatusCode}]`,
      );
      Logger.log(
        LogLevel.ERROR,
        `[Response Error Interceptor] [Error Message: ${errorMessage}] [Error Data: ${JSON.stringify(
          errorData,
        )}] [Error Details: ${errorDetails}]  [Error Details: ${errorDetails}]`,
      );
      switch (errorStatusCode) {
        case 400:
          error.response!.data.error = 'Bad Request';
          break;
        case 401:
          errorStatusCode = 500;
          error.response!.data.error = 'Internal server error';
          break;
        case 404:
          error.response!.data.error = 'Not found';
          break;
        case 409:
          error.response!.data.error = 'Conflict';
          break;
        case 422:
          error.response!.data.error =
            'Unprocessable entity. Send correct body in petition';
          break;
        case 503:
          error.response!.data.error = 'Service unavailable';
          break;
        default:
          errorStatusCode = 500;
          break;
      }
      error.response.status = errorStatusCode
      throw new ResponseError(error);
    } else if (error.request) {
      // The request was made but no response was received. `error.request` is an instance of http.ClientRequest
      console.log('error.request');
      Logger.log(LogLevel.ERROR, JSON.stringify(error));
    } else {
      console.log('error');
      Logger.log(LogLevel.ERROR, `Error: ${error.message}`);
    }
    throw new Error('error');
  };

  request = {
    get: <T>(endpoint: string, config?: AxiosRequestConfig) =>
      this.axiosInstance.get<T>(endpoint, config).then(response),
    post: <T>(endpoint: string, body: {}, config?: AxiosRequestConfig) =>
      this.axiosInstance.post<T>(endpoint, body, config).then(response),
    put: <T>(endpoint: string, body: {}, config?: AxiosRequestConfig) =>
      this.axiosInstance.put<T>(endpoint, body, config).then(response),
    patch: <T>(endpoint: string, body: {}, config?: AxiosRequestConfig) =>
      this.axiosInstance.patch<T>(endpoint, body, config).then(response),
    delete: <T>(endpoint: string, config?: AxiosRequestConfig) =>
      this.axiosInstance.delete<T>(endpoint, config).then(response),
  };
}
const response = (response: AxiosResponse) => response;

export default AxiosController;
