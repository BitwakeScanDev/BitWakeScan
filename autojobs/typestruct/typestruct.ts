
import { z, ZodType, ZodSchema } from "zod"

export class TypeStruct<T> {
  constructor(public schema: ZodSchema<T>) {}

  parse(data: unknown): T {
    return this.schema.parse(data)
  }

  safeParse(data: unknown): { success: true; data: T } | { success: false; errors: any[] } {
    const result = this.schema.safeParse(data)
    if (result.success) {
      return { success: true, data: result.data }
    } else {
      return { success: false, errors: result.error.issues }
    }
  }

  toJSONSchema(): object {
    // simplistic conversion
    return (this.schema as any). _def
  }
}
