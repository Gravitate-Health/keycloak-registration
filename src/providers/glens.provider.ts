import AxiosController from '../services/axios.services';
import Logger from '../services/logger.services';
import {LogLevel} from '../services/types';

export class GlensController extends AxiosController {
  glensProfileUrl: string;

  constructor(baseUrl: string) {
    super(baseUrl);
    this.glensProfileUrl =
      process.env.GLENS_PROFILE_BASE_PATH ??
      'https://fosps.gravitatehealth.eu/profiles';
  }

  createGlensProfileBody = (keycloakUserId: string) => {
    return {
      id: keycloakUserId,
    };
  };

  getGlensProfile = async (id: string): Promise<any> => {
    Logger.log(
      LogLevel.INFO,
      `[G-Lens Provider][Get Profile] Getting profile with id: ${id}`,
    );
    let glensProfileUrl = this.glensProfileUrl + '/' + id;
    let response;
    try {
      response = await this.request.get(glensProfileUrl);
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        `[G-Lens Provider][Get Profile] ERROR Getting Profile with id: ${id}`,
      );
      throw error;
    }
    if (response) {
      return response.data;
    }
  };

  createGlensProfile = async (glensProfile: object): Promise<any> => {
    Logger.log(
      LogLevel.INFO,
      `[G-Lens Provider][Create Profile] Creating profile: ${glensProfile}`,
    );
    let glensProfileResponse;
    try {
      glensProfileResponse = await this.request.post(
        this.glensProfileUrl,
        glensProfile,
      );
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        `[G-Lens Provider][Create Profile] Error Creating profile: ${glensProfile}`,
      );
      throw error;
    }
    return glensProfileResponse.data;
  };

  patchGlensProfile = async (glensProfile: string, id: string): Promise<boolean> => {
    Logger.log(
      LogLevel.INFO,
      `[G-Lens Provider][Patch Profile] Patching profile: ${JSON.stringify(
        glensProfile,
      )}`,
    );
    let url = this.glensProfileUrl + '/' + id;
    let glensProfileResponse;
    try {
      glensProfileResponse = await this.request.patch(url, glensProfile);
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        `[G-Lens Provider][Patch Profile] Error Patching profile: ${JSON.stringify(
          glensProfile,
        )}`,
      );
      throw error
    }
    if(glensProfileResponse.status === 204) {
      return true;
    }
    return false
  };

  deleteGlensProfile = async (profileId: String): Promise<boolean> => {
    Logger.log(
      LogLevel.INFO,
      `[G-Lens Provider][Delete Profiole] Deleting profile with id ${profileId}`,
    );
    let response;
    let url = this.glensProfileUrl + '/' + profileId;
    try {
      response = await this.request.delete(url);
    } catch (error) {
      Logger.log(
        LogLevel.ERROR,
        `[G-Lens Provider][Delete Profile] ERROR Deleting Profile: ${profileId}`,
      );
      throw error;
    }
    if (response && response.status === 204) {
      Logger.log(
        LogLevel.INFO,
        `[Delete G-Lens Profile] Deleted G-Lens Profile with id: ${profileId}`,
      );
      return true;
    }
    return false;
  };
}
export default GlensController;
