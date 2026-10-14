import { createDeviceApprovalService } from '../../src/device-approval.mjs';

// Keep both public URLs while using one Vercel function on the Hobby plan.
const service = createDeviceApprovalService();

export default function handler(request, response) {
  const path = new URL(request.url ?? '/', 'https://local.invalid').pathname;
  if (path === '/api/device/status') return service.status(request, response);
  if (path === '/api/device/request') return service.request(request, response);
  response.setHeader('Cache-Control', 'no-store');
  return response.status(404).json({ error: 'NOT_FOUND' });
}
