import { inject } from '@loopback/core';
import {
  post,
  Request,
  Response,
  RestBindings,
} from '@loopback/rest';

import axios from "axios";
import qs from 'qs';
const fs = require('fs');

const sanitizer = require('sanitizer');


export class ResetPasswordController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request,
    @inject(RestBindings.Http.RESPONSE) private response: Response) { }

  readDockerSecret = function read(secretName = '') {
    let secretPath = `/run/secrets/${secretName}`;
    try {
      return fs.readFileSync(secretPath, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.log(
          `An error occurred while trying to read the secret: ${secretName}. Err: ${err}`,
        );
      } else {
        console.log(
          `Could not find the secret, probably not running in swarm mode: ${secretName}. Err: ${err}`,
        );
      }
      return false;
    }
  };
  

  keycloakPath = process.env.KEYCLOAK_BASE_PATH ?? 'https://keycloak.pandevita.d.lst.tfo.upm.es/';
  usersEndpoint = 'users'

  realm = process.env.PANDEVITA_REALM ?? 'pandevita';
  pandevitaServiceUserFile = process.env.PANDEVITA_SERVICE_USER_FILE ?? 'pandevita-service-user-dev';
  pandevitaServicePassFile = process.env.PANDEVITA_SERVICE_PASS_FILE ?? 'pandevita-service-pass-dev';
  serviceUser = this.readDockerSecret(this.pandevitaServiceUserFile)
  servicePass = this.readDockerSecret(this.pandevitaServicePassFile)

  realmData = qs.stringify({
    'client_id': 'admin-cli',
    'grant_type': 'password',
    'username': this.serviceUser,
    'password': this.servicePass,
  })

  log = (msg: string) => {
    console.log(new Date().toISOString() + msg);
  }

  get_token = async (realm = this.realm, realmData = this.realmData) => {
    this.log("[get_token] Getting token for realm " + realm);
    const token_response = await axios({
      method: 'post',
      url: this.keycloakPath + 'auth/realms/' + realm + '/protocol/openid-connect/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: realmData
    });
    if (token_response.status === 200) {
      this.log("[get_token] OK");
    } else {
      this.log("[get_token] ERROR: NOT OK");
      this.log(JSON.stringify(token_response))
    }
    return token_response.data.access_token
  }

  @post('/reset-password')
  async create() {

    const email = this.req.query.email
    if(!email || email==undefined) {
      this.response.status(400).send("Provide email in query parameter")
      return
    }

    let getUserId: any
    try {
      getUserId = await axios({
        method: 'get',
        url: this.keycloakPath + 'auth/admin/realms/' + this.realm + '/' + this.usersEndpoint,
        params: {
          'email': email
        },
        headers: {
          'Authorization': 'Bearer ' + await this.get_token(),
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.log(error);
      this.response.send(500).send("server error trying to reset password")
      return
    }

    console.log("email: " + email);
    const matches = getUserId.data
    let userId = null
    for (const index in matches) {
      if (matches[index]["email"] === email) {
        // User exists with email providen
        userId = matches[index]["id"]
      }
    }
    if (userId === null) {
      return "Bad address"
    }

    console.log("Reset password for userId " + userId + " with email " + email);
    const keycloakResetPassword = await axios({
      method: 'put',
      url: this.keycloakPath + 'auth/admin/realms/' + this.realm + '/' + this.usersEndpoint + "/" + userId + "/execute-actions-email",
      data: ["UPDATE_PASSWORD"],
      headers: {
        'Authorization': 'Bearer ' + await this.get_token(),
        'Content-Type': 'application/json'
      }
    });
    if (keycloakResetPassword.status == 204) {
      return "OK"
    }
    return "Try again"
  }

}
