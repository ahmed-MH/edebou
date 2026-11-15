import {
  cloneElement,
  type AriaAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import { mergeClassNames } from "./class-names";

interface AdminFieldControlProps {
  "aria-describedby"?: AriaAttributes["aria-describedby"];
  "aria-errormessage"?: AriaAttributes["aria-errormessage"];
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  className?: string;
  id?: string;
  required?: boolean;
}

export interface AdminFormFieldProps {
  className?: string;
  control: ReactElement<AdminFieldControlProps>;
  error?: ReactNode;
  hint?: ReactNode;
  id: string;
  label: ReactNode;
  required?: boolean;
  requiredIndicator?: ReactNode;
}

export function AdminFormField({
  className,
  control,
  error,
  hint,
  id,
  label,
  required = false,
  requiredIndicator,
}: AdminFormFieldProps) {
  const hasHint = hint !== undefined && hint !== null;
  const hasError = error !== undefined && error !== null;
  const hintId = hasHint ? `${id}-hint` : undefined;
  const errorId = hasError ? `${id}-error` : undefined;
  const existingDescription = control.props["aria-describedby"];
  const describedBy = [existingDescription, hintId, errorId]
    .filter(Boolean)
    .join(" ");

  const fieldControl = cloneElement(control, {
    "aria-describedby": describedBy || undefined,
    "aria-errormessage": errorId ?? control.props["aria-errormessage"],
    "aria-invalid": hasError || control.props["aria-invalid"] || undefined,
    className: mergeClassNames(
      "min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500",
      hasError
        ? "border-red-600 focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
        : "border-zinc-300 focus:border-[#E60023] focus:ring-2 focus:ring-[#E60023]/15",
      control.props.className,
    ),
    id,
    required: required || control.props.required,
  });

  return (
    <div className={mergeClassNames("space-y-1.5", className)}>
      <label className="block text-sm font-semibold text-zinc-800" htmlFor={id}>
        {label}
        {required &&
        requiredIndicator !== undefined &&
        requiredIndicator !== null ? (
          <span className="ms-1 text-[#C9001F]">{requiredIndicator}</span>
        ) : null}
      </label>
      {fieldControl}
      {hasHint ? (
        <div id={hintId} className="text-xs leading-5 text-zinc-500">
          {hint}
        </div>
      ) : null}
      {hasError ? (
        <div
          id={errorId}
          className="text-xs font-medium leading-5 text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
