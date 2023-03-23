import AxiosController from '../services/axios.provider';
import Logger from '../services/logger.provider';

export class GlensController {
  axiosController = new AxiosController();

  glensProfileUrl =
    process.env.GLENS_PROFILE_BASE_PATH ??
    'https://fosps.gravitatehealth.eu/profiles';

  createGlensProfileBody = (keycloakUserId: string) => {
    return {
      id: keycloakUserId,
    };
  };

  getGlensProfile = async (id: string, token: string) => {
    let glensProfileUrl = this.glensProfileUrl + '/' + id;
    let response;
    try {
      response = await this.axiosController.axiosGet({
        url: glensProfileUrl,
        token: token,
      });
    } catch (error) {
      Logger.log('[Get G-Lens user] ERROR Getting G-Lens Profile: ' + id);
      return;
    }
    
    if (response && response.status === 200) {
      Logger.log(`[Get G-Lens user] G-Lens with id: ${id}`);
      return response.data;
    }
  };

  createGlensProfile = async (glensProfile: object, token: string) => {
    Logger.log(
      `[Create G-Lens Profile] Creating g-lens profile: ${JSON.stringify(
        glensProfile,
      )}`,
    );
    let glensProfileResponse = await this.axiosController.axiosPost({
      data: glensProfile,
      url: this.glensProfileUrl,
      token: token,
    });
    Logger.log('[Create G-Lens Profile] Created');
    return glensProfileResponse;
  };

  patchGlensProfile = async (
    glensProfile: string,
    id: string,
    token: string,
  ) => {
    Logger.log(
      `[Patch G-Lens Profile] Patching g-lens profile: ${JSON.stringify(
        glensProfile,
      )}`,
    );
    let url = this.glensProfileUrl + '/' + id;
    let glensProfileResponse = await this.axiosController.axiosPatch({
      data: glensProfile,
      url: this.glensProfileUrl,
      token: token,
    });
    Logger.log('[Patch G-Lens Profile] Patched');
    return glensProfileResponse;
  };

  deleteGlensProfile = async (profileId: String) => {
    Logger.log(`[Delete G-Lens User] Deleting user with id ${profileId}`);
    let response;
    let url = this.glensProfileUrl + '/' + profileId;
    try {
      response = await this.axiosController.axiosDelete({url: url});
    } catch (error) {
      Logger.log(
        `[Delete G-Lens Profile] ERROR Deleting G-Lens Profile: ${profileId}`,
      );
      return;
    }
    if (response && response.status === 204) {
      Logger.log(
        `[Delete G-Lens Profile] Deleted G-Lens Profile with id: ${profileId}`,
      );
      return response;
    }
    return;
  };
}
export default GlensController;
