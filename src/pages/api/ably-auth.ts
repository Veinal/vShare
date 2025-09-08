import { NextApiRequest, NextApiResponse } from 'next';
import Ably from 'ably';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.ABLY_API_KEY) {
    return res.status(500).json({ error: 'ABLY_API_KEY environment variable not set' });
  }

  const clientId = `vshare-client-${Math.random().toString(36).substring(2, 9)}`;
  const client = new Ably.Rest(process.env.ABLY_API_KEY);
  const tokenRequestData = await client.auth.createTokenRequest({ clientId });
  res.status(200).json(tokenRequestData);
}
