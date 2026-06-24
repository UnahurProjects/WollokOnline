/**
 * Tipos compartidos. GitHub es la fuente de verdad del examen (no hay DB).
 */

export type UserRole = "student" | "teacher" | "admin";

export type ActivityEventType =
  | "edit"
  | "delete"
  | "paste_attempt"
  | "copy_attempt"
  | "cut_attempt"
  | "focus_lost"
  | "focus_returned"
  | "test_run"
  | "autosave"
  | "manual_save"
  | "final_submit"
  | "local_recovery_used";
