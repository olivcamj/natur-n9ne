import { z } from 'zod';
import { HttpError } from './errors';

// Parse untrusted input (req.body, req.query, req.params) with a shared schema.
// Throws a 400 with a readable message on failure, returns typed data on success.
//
//   const line = parse(CartLineInputSchema, req.body);
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
 
  if (!result.success) {
    throw new HttpError(400, z.prettifyError(result.error));
  }
  
  return result.data;
}
