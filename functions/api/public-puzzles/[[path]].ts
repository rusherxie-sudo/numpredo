import { handlePublicPuzzles, type Env } from '../../../src/server/public-puzzles/service.ts';
export const onRequest = (context: {request: Request; env: Env}) => handlePublicPuzzles(context.request, context.env);
