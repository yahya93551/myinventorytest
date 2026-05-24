import { getServerTenantContext, jsonError, jsonSuccess, logAudit } from '@/lib/api';

export async function POST(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ('error' in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const action = typeof payload === 'object' && payload !== null && 'action' in payload && typeof (payload as any).action === 'string'
    ? (payload as any).action.toUpperCase()
    : 'LOAD';
  const entity = typeof payload === 'object' && payload !== null && 'entity' in payload && typeof (payload as any).entity === 'string'
    ? (payload as any).entity.toLowerCase()
    : 'product';
  const entityId = typeof payload === 'object' && payload !== null && 'entity_id' in payload && typeof (payload as any).entity_id === 'string'
    ? (payload as any).entity_id
    : undefined;
  const details = typeof payload === 'object' && payload !== null && 'details' in payload && typeof (payload as any).details === 'object'
    ? (payload as any).details
    : undefined;

  await logAudit(
    tenantContext.tenantId,
    tenantContext.userId,
    action,
    entity,
    req,
    entityId,
    details
  );

  return jsonSuccess({ message: 'Activity logged' }, 201);
}
