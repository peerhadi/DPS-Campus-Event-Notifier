import { URLSearchParams } from 'url';
import { DPS_URL } from './config';
import { client } from './client';

export async function login(username: string, password: string) {
  await client.post(`${DPS_URL}/user/login`, new URLSearchParams({ username, password }));
}
