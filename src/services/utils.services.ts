import {AxiosRequestHeaders} from 'axios';

export const parseJwt = (token: any) => {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
};

export const getUserIdFromParsedToken = (parsedToken: object) => {
  return parsedToken['sub'];
};

export const getParsedJwtFromHeaders = (headers: any) => {
  let authHeader = headers.authorization;
  const jwtToken = authHeader.split(' ')[1];
  return parseJwt(jwtToken);
};

export const getUserIdFromToken = (token: object): string => {
  let userId;
  try {
    userId = getUserIdFromParsedToken(token); // "SUB" field of the JWT token is the userid for which the token is granted
    if (!userId) {
      throw new Error('No token sent, or it is invalid');
    }
  } catch (error) {
    throw new Error('No token sent, or it is invalid');
  }
  return userId;
};

export const parseJSONBody = (rawBody: any) => {
  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw error
  }
};
