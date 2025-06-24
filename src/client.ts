import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

const URL = 'https://campus.dpssrinagar.com';

export function init_client(): AxiosInstance {
  const jar = new CookieJar();
  return wrapper(axios.create({
    jar,
    withCredentials: true,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': `${URL}/`,
      'Origin': URL,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }));
}

export const client = init_client()
