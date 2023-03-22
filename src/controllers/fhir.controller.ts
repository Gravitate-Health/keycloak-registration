import AxiosController from './axios.controller';
import Logger from './logger.controller';

export class FhirController {
  axiosController = new AxiosController();

  fhirPatientUrl =
    process.env.PATIENT_PATH ??
    'https://fosps.gravitatehealth.eu/ips/api/fhir/Patient';

  buildFhirPatient = (profile: any, keycloakUserId: string) => {
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

  createFhirPatient = async (patient: any, token = "") => {
    try {
      Logger.log('[Create FHIR Patient] Creating FHIR Patient...');
      let url = this.fhirPatientUrl;
      return await this.axiosController.axiosPost({
        data: patient,
        url: url,
      });
    } catch (error) {
      Logger.log('[Create FHIR Patient] Error');
      throw new Error(error);
    }
  };
}

export default FhirController;
