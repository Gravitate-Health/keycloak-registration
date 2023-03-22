import axios from 'axios';

class AxiosController {
  axiosPost = async ({
    data = {},
    url = '',
    token = '',
    contentType = 'application/json',
  } = {}) => {
    let headers = {
      'Content-Type': contentType,
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return await axios({
      method: 'post',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
      data: data,
    });
  };

  axiosGet = async ({url = '', token = ''} = {}) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return await axios({
      method: 'get',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
    });
  };

  axiosPatch = async ({data = {}, url = '', token = ''} = {}) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return await axios({
      method: 'patch',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
      data: data,
    });
  };

  axiosPut = async ({data = {}, url = '', token = ''} = {}) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return await axios({
      method: 'put',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
      data: data,
    });
  };

  axiosDelete = async ({url = '', token = ''} = {}) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return await axios({
      method: 'delete',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
    });
  };
}

export default AxiosController;
