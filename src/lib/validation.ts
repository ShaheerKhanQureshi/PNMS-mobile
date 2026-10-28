import { z } from "zod";
export const policy = {
  manualEntry: import.meta.env.VITE_ALLOW_MANUAL_MR === "true",
  remarks: import.meta.env.VITE_ALLOW_REMARKS === "true",
  remarksMaxLength: Number(import.meta.env.VITE_REMARKS_MAX_LENGTH || 1000),
  mrPattern: import.meta.env.VITE_MR_NUMBER_REGEX || "^[0-9]{5,20}$",
};
export function validMR(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 255 &&
    !/https?:|[{}[\]\r\n]/i.test(value) &&
    new RegExp(policy.mrPattern).test(value)
  );
}
/**
 * Password policy. MUST stay identical to `passwordPolicy` in src/validators/common.js (the server is the authority):
 * 8-128 characters with an English letter, a digit and a special character (ASCII punctuation/symbol).
 */
export const PASSWORD_POLICY_HINT =
  "8–128 characters, including at least one English letter, one number and one special character (for example ! @ # $ %).";
export const PASSWORD_POLICY_MESSAGE =
  "Use 8–128 characters, including an English letter, a number and a special character.";
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.")
  .regex(/[A-Za-z]/, "Include an English letter.")
  .regex(/\d/, "Include a number.")
  .regex(/[!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~]/, "Include a special character.");
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username.").max(50),
  password: z.string().min(1, "Enter your password.").max(128),
});
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
