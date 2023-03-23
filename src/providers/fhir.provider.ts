import AxiosController from '../services/axios.provider';
import Logger from '../services/logger.provider';

export class FhirController {
  axiosController = new AxiosController();

  fhirPatientUrl =
    process.env.PATIENT_PATH ??
    'https://fosps.gravitatehealth.eu/ips/api/fhir/Patient';

  buildFhirPatient = (keycloakUserId: string) => {
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
        },
      ],
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
