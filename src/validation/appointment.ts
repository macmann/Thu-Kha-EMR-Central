import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeMinutesSchema = z.number().int().min(0).max(1440);

export const CreateAppointmentSchema = z
  .object({
    patientId: z.string().uuid(),
    doctorId: z.string().uuid(),
    department: z.string().min(1),
    date: z.string().regex(dateRegex, 'Date must be in format YYYY-MM-DD'),
    startTimeMin: timeMinutesSchema,
    endTimeMin: timeMinutesSchema,
    reason: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endTimeMin <= data.startTimeMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTimeMin'],
        message: 'endTimeMin must be greater than startTimeMin',
      });
    }
  });

export const UpdateAppointmentBodySchema = z
  .object({
    patientId: z.string().uuid().optional(),
    doctorId: z.string().uuid().optional(),
    department: z.string().min(1).optional(),
    date: z.string().regex(dateRegex, 'Date must be in format YYYY-MM-DD').optional(),
    startTimeMin: timeMinutesSchema.optional(),
    endTimeMin: timeMinutesSchema.optional(),
    reason: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (typeof data.endTimeMin === 'number' && typeof data.startTimeMin === 'number') {
      if (data.endTimeMin <= data.startTimeMin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endTimeMin'],
          message: 'endTimeMin must be greater than startTimeMin',
        });
      }
    }
  });

export const UpdateAppointmentParamsSchema = z.object({
  appointmentId: z.string().uuid(),
});

export const UpdateAppointmentSchema = {
  body: UpdateAppointmentBodySchema,
  params: UpdateAppointmentParamsSchema,
};

export const PatchStatusSchema = z.object({
  status: z.enum(['CheckedIn', 'InProgress', 'Completed', 'Cancelled']),
  cancelReason: z.string().min(1).optional(),
});

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentBodySchema>;
export type UpdateAppointmentParams = z.infer<typeof UpdateAppointmentParamsSchema>;
export type PatchStatusInput = z.infer<typeof PatchStatusSchema>;
