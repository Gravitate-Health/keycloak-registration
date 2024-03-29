import {Axios, AxiosRequestConfig} from 'axios';
import AxiosController from '../services/axios.services';
import Logger from '../services/logger.services';
import {LogLevel} from '../services/types';

export class FhirController extends AxiosController {
  fhirPatientUrl =
    process.env.PATIENT_PATH ??
    'https://fosps.gravitatehealth.eu/ips/api/fhir/Patient';

  constructor(baseUrl: string) {
    super(baseUrl);
  }

  buildFhirPatient = (keycloakUserId: string, givenName: string, familyName: string) => {
    return {
      resourceType: 'Patient',
      active: true,
      name: [
        {
          use: 'usual',
          family: familyName,
          given: [
            givenName
          ]
        },
      ],
      identifier: [
        {
          "system": "fosps.gravitatehealth.eu",
          "value": keycloakUserId
        }
      ]
    };
  };

  createFhirPatient = async (patient: any): Promise<any> => {
    Logger.log(
      LogLevel.INFO,
      `[FHIR Provider][Create Patient] Creating FHIR Patient with identifier: ${JSON.stringify(patient.identifier[0])}`,
    );
    let createPatientResponse;
    try {
      let url = `${this.fhirPatientUrl}`;
      createPatientResponse = await this.request.post(url, patient);
    } catch (error) {
      Logger.log(LogLevel.ERROR, '[FHIR Provider][Create Patient] Error');
      throw new Error(error);
    }
    return createPatientResponse
  };

  patchFhirPatient = async (patient: any, id: string) => {
    let config = {
      headers: {
        'Content-Type': 'application/fhir+json',
      },
    } as AxiosRequestConfig;
    try {
      Logger.log(
        LogLevel.INFO,
        `[FHIR Provider][Patch Patient] Patching FHIR Patient with id: ${id}`,
      );
      let url = this.fhirPatientUrl + '/' + id;
      return await this.request.patch(url, patient, config);
    } catch (error) {
      Logger.log(LogLevel.ERROR, '[FHIR Provider][Patch Patient] Error');
      throw error;
    }
  };

  deleteFhirPatient = async (id: string) => {
    try {
      Logger.log(
        LogLevel.INFO,
        `[FHIR Provider][Delete Patient] Deleting FHIR Patient with id: ${id}`,
      );
      let url = this.fhirPatientUrl + '/' + id;
      return await this.request.delete(url);
    } catch (error) {
      Logger.log(LogLevel.ERROR, '[FHIR Provider][Delete Patient] Error');
      throw new Error(error);
    }
  };
}

export default FhirController;
