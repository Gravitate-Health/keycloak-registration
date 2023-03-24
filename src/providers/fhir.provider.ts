import AxiosController from '../services/axios.provider';
import Logger from '../services/logger.provider';

export class FhirController {
  axiosController = new AxiosController();

  fhirPatientUrl =
    process.env.PATIENT_PATH ??
    'https://fosps.gravitatehealth.eu/ips/api/fhir/Patient';

  buildFhirPatient = (keycloakUserId: string) => {
    return {
      id: keycloakUserId,
      resourceType: 'Patient',
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
      let url = `${this.fhirPatientUrl}/${patient.id}`;
      return await this.axiosController.axiosPut({
        data: patient,
        url: url,
      });
    } catch (error) {
      Logger.log('[Create FHIR Patient] Error');
      throw new Error(error);
    }
  };

  patchFhirPatient = async (patient: any, id: string, token = "") => {
    try {
      Logger.log('[Patch FHIR Patient] Patching FHIR Patient...');
      let url = this.fhirPatientUrl + "/" + id;
      return await this.axiosController.axiosPatch({
        data: patient,
        url: url,
        contentType: 'application/fhir+json'
      });
    } catch (error) {
      Logger.log('[Patch FHIR Patient] Error');
      throw new Error(error);
    }
  };
}

export default FhirController;
