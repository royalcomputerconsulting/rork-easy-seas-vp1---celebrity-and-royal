import * as z from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';
import {
  assertOptimizationOwnerScope,
  deleteOptimizationSnapshotsForOwner,
  loadLatestOptimizationSnapshot,
  persistOptimizationSnapshot,
} from '@/backend/services/casino-optimization/optimizationSnapshotService';

const snapshotTypeSchema = z.enum(['bundle', 'recommendation', 'learning-outcome', 'release-gate']);
const ownerSchema = z.object({ ownerProfileId: z.string().min(1), ownerScopeId: z.string().min(1) });

export const certificateOptimizationRouter = createTRPCRouter({
  saveSnapshot: publicProcedure.input(ownerSchema.extend({
    id: z.string().min(1),
    snapshotType: snapshotTypeSchema,
    generatedAt: z.string().min(1),
    version: z.string().min(1),
    payload: z.unknown(),
  })).mutation(async ({ input, ctx }) => {
    assertOptimizationOwnerScope(input.ownerProfileId, input.ownerScopeId);
    const requestScope = ctx.req.headers.get('x-easyseas-owner-scope');
    if (!requestScope || requestScope.trim().toLowerCase() !== input.ownerScopeId.trim().toLowerCase()) {
      throw new Error('Missing or mismatched optimization owner-scope header.');
    }
    return persistOptimizationSnapshot(input);
  }),
  getLatestSnapshot: publicProcedure.input(ownerSchema.extend({ snapshotType: snapshotTypeSchema })).query(async ({ input, ctx }) => {
    assertOptimizationOwnerScope(input.ownerProfileId, input.ownerScopeId);
    const requestScope = ctx.req.headers.get('x-easyseas-owner-scope');
    if (!requestScope || requestScope.trim().toLowerCase() !== input.ownerScopeId.trim().toLowerCase()) {
      throw new Error('Missing or mismatched optimization owner-scope header.');
    }
    return loadLatestOptimizationSnapshot(input.ownerProfileId, input.snapshotType);
  }),
  deleteOwnerSnapshots: publicProcedure.input(ownerSchema).mutation(async ({ input, ctx }) => {
    assertOptimizationOwnerScope(input.ownerProfileId, input.ownerScopeId);
    const requestScope = ctx.req.headers.get('x-easyseas-owner-scope');
    if (!requestScope || requestScope.trim().toLowerCase() !== input.ownerScopeId.trim().toLowerCase()) {
      throw new Error('Missing or mismatched optimization owner-scope header.');
    }
    await deleteOptimizationSnapshotsForOwner(input.ownerProfileId);
    return { success: true };
  }),
});
