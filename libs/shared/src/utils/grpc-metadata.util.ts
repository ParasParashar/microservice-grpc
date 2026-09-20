import { Metadata } from '@grpc/grpc-js';

export interface MetadataOptions {
  authorization?: string;
  requestId?: string;
  correlationId?: string;
  tenantId?: string;
  timeoutMs?: number;
}

export function createGrpcMetadata(options: MetadataOptions): { metadata: Metadata; deadline?: Date } {
  const metadata = new Metadata();

  if (options.authorization) {
    metadata.set('authorization', options.authorization);
  }

  const requestId = options.requestId || `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const correlationId = options.correlationId || requestId;
  const tenantId = options.tenantId || 'default-tenant';

  metadata.set('x-request-id', requestId);
  metadata.set('x-correlation-id', correlationId);
  metadata.set('x-tenant-id', tenantId);

  let deadline: Date | undefined;
  if (options.timeoutMs && options.timeoutMs > 0) {
    deadline = new Date(Date.now() + options.timeoutMs);
  }

  return { metadata, deadline };
}

export function extractGrpcMetadata(metadata: Metadata): Record<string, string> {
  const result: Record<string, string> = {};
  if (!metadata) return result;

  const auth = metadata.get('authorization');
  if (auth && auth.length > 0) result['authorization'] = String(auth[0]);

  const reqId = metadata.get('x-request-id');
  if (reqId && reqId.length > 0) result['requestId'] = String(reqId[0]);

  const corrId = metadata.get('x-correlation-id');
  if (corrId && corrId.length > 0) result['correlationId'] = String(corrId[0]);

  const tenant = metadata.get('x-tenant-id');
  if (tenant && tenant.length > 0) result['tenantId'] = String(tenant[0]);

  return result;
}
