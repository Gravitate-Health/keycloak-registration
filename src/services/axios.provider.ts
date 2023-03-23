import axios from 'axios';

class AxiosController {
  axiosPost = ({
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
    return axios({
      method: 'post',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
      data: data,
    });
  };

  axiosGet = ({url = '', token = ''} = {}) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return axios({
      method: 'get',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
    });
  };

  axiosPatch = ({data = {}, url = '', token = ''} = {}) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return axios({
      method: 'patch',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
      data: data,
    });
  };

  axiosPut = ({data = {}, url = '', token = ''} = {}) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return axios({
      method: 'put',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
      data: data,
    });
  };

  axiosDelete = ({url = '', token = ''} = {}) => {
    let headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return axios({
      method: 'delete',
      url: url,
      timeout: 30 * 1000,
      headers: headers,
    });
  };
}

export default AxiosController;
